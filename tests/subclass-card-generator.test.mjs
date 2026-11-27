import test from 'node:test';
import assert from 'node:assert/strict';
import { GenerateSubclassCatalog, SUBCLASS_CATALOG, RefreshSubclassCard } from '../src/model/subclassCardGenerator.js';
import { ValidateSubclassCatalog } from '../src/model/subclassCatalogExport.js';
import { scoring } from '../src/content/generated/scoring.js';
import { ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { UpgradeKindUnlocked, StatusStackCapAtTier, NumericCeilingAtTier } from '../src/model/tierUnlocks.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { botCardTargetId } from '../tools/simbot.mjs';
import { beginAbilityTurn } from '../src/engine/abilityRiders.js';
import { planCardUpgrade, commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { validateCardTemplates } from '../src/model/validate/templates.js';



function assertMeasuredTarget(meta) {
  assert.equal(meta.projectedRank,RankOf(meta.projectedCp,scoring),meta.cardId);
  assert.equal(meta.miss,meta.projectedCp!==meta.targetCp,meta.cardId);
  if(!meta.miss) assert.equal(meta.projectedRank,meta.requestedRank,meta.cardId);
  else {
    assert.ok(meta.projectedRank<=meta.requestedRank,meta.cardId);
    if(meta.projectedRank<meta.requestedRank) assert.ok(meta.adaptations.includes(`Requested Rank ${meta.requestedRank} is infeasible for this signature at the selected rarity and mechanical ceilings; closest legal result is CP ${meta.projectedCp}, Rank ${meta.projectedRank}. Raise rank or rarity, or revise the signature.`),meta.cardId);
  }
}

const catalog = GenerateSubclassCatalog({ seed: 7 });

test('subclass catalog contains the twelve named styles and 180 unique stable named definitions', () => {
  assert.equal(SUBCLASS_CATALOG.length, 12);
  assert.equal(catalog.cards.length, 180);
  assert.equal(catalog.lists.length, 12);
  assert.equal(new Set(catalog.cards.map(card => card.id)).size, 180);
  assert.equal(new Set(catalog.cards.map(card => card.name)).size, 180);
  for (const list of catalog.lists) {
    assert.equal(list.cardIds.length, 15);
    const cards = list.cardIds.map(id => catalog.cards.find(card => card.id === id));
    assert.ok(cards.every(card => card.class === list.classId));
    assert.deepEqual(['common', 'uncommon', 'rare'].map(rarity => cards.filter(card => card.rarity === rarity).length), [8, 5, 2]);
    assert.ok(new Set(cards.map(card => JSON.stringify(card.effects.map(effect => ({ ...effect, amount: 0 }))))).size >= 10, list.id);
  }
  assert.deepEqual(ValidateSubclassCatalog(catalog), []);
});

test('catalog seeds are deterministic, change content without changing IDs, and subsets preserve definitions', () => {
  assert.deepEqual(GenerateSubclassCatalog({ seed: 7 }), catalog);
  const another = GenerateSubclassCatalog({ seed: 8 });
  assert.deepEqual(another.cards.map(card => card.id), catalog.cards.map(card => card.id));
  assert.notDeepEqual(another.cards, catalog.cards);
  const subset = GenerateSubclassCatalog({ seed: 7, subclassIds: ['saint', 'bloodletter'], countPerSubclass: 3 });
  assert.equal(subset.cards.length, 6);
  for (const card of subset.cards) assert.deepEqual(card, catalog.cards.find(row => row.id === card.id));
  for (const criteria of [{ rank: 0 }, { rank: 6 }, { subclassIds: ['invented'] }, { countPerSubclass: 16 }, { subclassIds: [] }]) assert.throws(() => GenerateSubclassCatalog(criteria));
});

test('all default recipes share scoring with upgrades and keep authored signature upgrades inside their requested rank', () => {
  for (const [index, card] of catalog.cards.entries()) {
    const meta = catalog.metadata[index];
    const raw = ScoreCard(CardDefinitionToScoreFace(card, { scoring }), scoring).raw;
    assert.equal(raw, meta.projectedRaw, card.id);
    assert.equal(CombatPower(raw, card.rarity, scoring), meta.projectedCp, card.id);
    assertMeasuredTarget(meta);
    assert.equal(meta.miss, meta.projectedCp !== meta.targetCp, card.id);
    assert.ok(card.upgrade, card.id);
    const after = applyUpgradeSteps(card, [{ k: 'authored' }]);
    assert.notDeepEqual(after.effects, card.effects, card.id);
    assert.notDeepEqual(ProjectCardMechanicalValues(after).card.effects, ProjectCardMechanicalValues(card).card.effects, `${card.id}: upgrade must change actual mechanics`);
    assert.deepEqual(after.effects.filter(effect => effect.if).map(effect => effect.if), card.effects.filter(effect => effect.if).map(effect => effect.if), card.id);
    const cp = CombatPower(ScoreCard(CardDefinitionToScoreFace(after, { scoring }), scoring).raw, after.rarity, scoring);
    assert.ok(RankOf(cp, scoring) <= meta.requestedRank, card.id);
    assert.equal(cp, meta.signatureUpgrade.projectedCp, card.id);
    assert.ok(card.upgradeMenu.every(kind => UpgradeKindUnlocked(kind, meta.effectiveTier, scoring)), card.id);
    for (const effect of after.effects) if (effect.op === 'applyStatus') assert.ok(effect.stacks <= StatusStackCapAtTier(effect.status, meta.effectiveTier, scoring), card.id);
    if (['reaver', 'rogue'].includes(card.class)) {
      assert.equal(card.manaCost, 0, card.id);
      assert.equal(card.abilityKind, 'maneuver', card.id);
      assert.ok(card.tags.includes('source:weapon'), card.id);
      assert.ok(!card.tags.includes('source:spell'), card.id);
    }
  }
});

test('all 900 rank variants enforce actual mechanical ceilings and report any infeasible rank or upgrade', () => {
  for (const rank of [1, 2, 3, 4, 5]) {
    const result = GenerateSubclassCatalog({ seed: 11, rank });
    assert.deepEqual(ValidateSubclassCatalog(result), []);
    for (const [i, card] of result.cards.entries()) {
      const meta = result.metadata[i];
      if (meta.projectedRank !== rank) {
        assert.equal(meta.miss, true, card.id);
        assert.ok(meta.adaptations.some(reason => reason.includes(`Requested Rank ${rank} is infeasible`) && reason.includes('Raise rank or rarity')), card.id);
      }
      if (!card.upgrade) assert.ok(meta.adaptations.some(reason => reason.includes('No legal signature upgrade') && reason.includes('Raise the requested rank or rarity')), card.id);
      const variants = [card, ...(card.upgrade ? [applyUpgradeSteps(card, [{ k: 'authored' }])] : [])];
      for (const op of ['damage', 'block']) {
        for (const variant of variants) {
          const effects = ProjectCardMechanicalValues(variant).card.effects;
          const total = effects.reduce((n, effect) => n + (effect.op === op ? effect.amount * (op === 'damage' ? Math.max(1, effect.hits || 1) : 1) : effect.op === 'grantCardCharge' ? effect[op] || 0 : 0), 0);
          assert.ok(total <= NumericCeilingAtTier(op, meta.effectiveTier, scoring), `${card.id}/${op}`);
        }
      }
      for (const variant of variants) {
        const cp = CombatPower(ScoreCard(CardDefinitionToScoreFace(variant, { scoring }), scoring).raw, variant.rarity, scoring);
        assert.ok(RankOf(cp, scoring) <= rank, card.id);
      }
      assert.ok(card.upgradeMenu.every(kind => UpgradeKindUnlocked(kind, meta.effectiveTier, scoring)), card.id);
      for (const effect of card.effects) if (effect.op === 'applyStatus') assert.ok(effect.stacks <= StatusStackCapAtTier(effect.status, meta.effectiveTier, scoring), card.id);
    }
  }
});

test('all base and authored upgrade text uses bound tokens, including literal Counter counts', () => {
  const problems = [];
  for (const card of catalog.cards) {
    assert.ok(!card.textTemplate.includes('{undefined}'), card.id);
    assert.ok(!card.upgrade.textTemplate.includes('{undefined}'), card.id);
    validateCardTemplates(card, card.id, (path, reason) => problems.push(`${path}: ${reason}`));
  }
  assert.deepEqual(problems, []);
});

test('editing a subclass card rebases its signature upgrade on the current effects without overwriting custom text', () => {
  const original = catalog.cards.find(card => card.name === 'Banked Spark');
  const edited = structuredClone(original);
  edited.name = 'Edited Spark'; edited.effects[0].amount += 2;
  edited.textTemplate = 'My custom description.';
  const refreshed = RefreshSubclassCard(edited, { scoring, requestedRank: 5, rebuildText: false });
  assert.equal(refreshed.textTemplate, edited.textTemplate);
  assert.equal(refreshed.upgrade.name, 'Edited Spark+');
  assert.equal(refreshed.upgrade.effects[0].amount, edited.effects[0].amount);
  assert.notDeepEqual(refreshed.upgrade.effects, original.upgrade.effects);
  assert.notEqual(RefreshSubclassCard(edited).textTemplate, edited.textTemplate);
  assert.equal(original.effects[0].amount + 2, edited.effects[0].amount);
});

test('charge and conditional projections are priced, and spending an enemy status is not rewarded as cleansing', () => {
  const base = { id: 'subclass.fixture', name: 'fixture', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', tags: [], effects: [{ op: 'damage', target: 'enemy', amount: 10 }] };
  const conditional = CardDefinitionToScoreFace({ ...base, effects: [{ ...base.effects[0], if: { p: 'firstAttackThisCombat' } }] });
  const projectedDamage = ProjectCardMechanicalValues({ ...base, effects: [{ ...base.effects[0], if: { p: 'firstAttackThisCombat' } }] }).card.effects[0].amount;
  assert.equal(conditional.dmg, projectedDamage * scoring.conditionals.inlineIf);
  const charged = CardDefinitionToScoreFace({ ...base, effects: [...base.effects, { op: 'grantCardCharge', key: 'fixture', target: 'self', damage: 2 }] });
  assert.ok(charged.dmg > CardDefinitionToScoreFace(base).dmg);
  assert.equal(CardDefinitionToScoreFace({ ...base, effects: [{ op: 'removeStatus', target: 'enemy', status: 'venom', amount: 1 }] }).cleanse, 0);
});

const registries = createRegistries({ ...contentBundle,
  cards: [...contentBundle.cards, ...catalog.cards.map(({ tags, ...card }) => card)],
  tagging: [...contentBundle.tagging, ...catalog.cards.flatMap(card => card.tags.map(tagId => ({ family: 'card', scope: '', objectId: card.id, tagId })))],
});
function combatFor(card, upgraded = false) {
  const player = { id: 'p1', classId: card.class, maxHp: 200, hp: 100, maxMana: 100, mana: 100, maxStamina: 100, stamina: 100, energyMax: 100, drawPerTurn: 2, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: card.id, upgraded, ...(upgraded ? { upgradeSteps: [{ k: 'authored' }] } : {}) })) };
  const combat = createCombat({ registries, rng: createRng(9), player, enemyIds: ['wanderingSoldier'] });
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 10000; enemy.block = 0; }
  combat.player.energy = combat.player.stamina = combat.player.mana = 100;
  return combat;
}

test('all 180 cards preview and resolve through the actual combat dispatcher', () => {
  for (const card of catalog.cards) {
    const combat = combatFor(card);
    const id = combat.piles.hand[0].instanceId;
    assert.doesNotThrow(() => previewCard(combat, id), card.id);
    const targetId = botCardTargetId(combat.registries, combat, combat.piles.hand[0], combat.enemies[0].id);
    assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId }), card.id);
    assert.ok(combat.eventLog.some(event => event.type === 'cardResolved' && event.cardId === card.id), card.id);
    assert.ok(Number.isFinite(combat.player.hp) && Number.isFinite(combat.enemies[0].hp), card.id);
  }
});

test('every first authored upgrade is offered and produces a legal, effective commit; later menus contain actual options', () => {
  const run = { seed: 7, level: { level: 5 } };
  let rolledCount = 0;
  for (const [i, card] of catalog.cards.entries()) {
    const instance = { instanceId: `upgrade.${i}`, cardId: card.id, rank: catalog.metadata[i].requestedRank };
    assert.deepEqual(nextUpgradeOptions(run, instance, card, registries), [{ k: 'authored' }], card.id);
    const upgradeRun = { ...run, deck: [instance], sideboard: [], smithingStones: 10 };
    const before = JSON.stringify(upgradeRun);
    const quote = planCardUpgrade(upgradeRun, registries, instance.instanceId);
    assert.equal(quote.ok, true, card.id);
    assert.equal(JSON.stringify(upgradeRun), before, card.id);
    assert.deepEqual(quote.step, { k: 'authored' }, card.id);
    commitCardUpgrade(upgradeRun, registries, quote);
    assert.deepEqual(instance.upgradeSteps, [{ k: 'authored' }], card.id);
    assert.notDeepEqual(quote.after.effects, quote.before.effects, card.id);
    const options = rollUpgradeOptions(card, [{ k: 'authored' }], 1, upgradeStepRng(7, instance.instanceId, 1), { cardRank: instance.rank, playerLevel: 5, scoring, everyFamily: true }, 20);
    for (const option of options) assert.notDeepEqual(applyUpgradeSteps(card, [{ k: 'authored' }, option]), applyUpgradeSteps(card, [{ k: 'authored' }]), card.id);
    rolledCount += options.length;
  }
  assert.ok(rolledCount > 180, 'continued upgrades remain available across the catalog');
});

test('an authored signature upgrade from each subclass previews and resolves in combat', () => {
  for (const list of catalog.lists) {
    const card = catalog.cards.find(row => row.id === list.cardIds[0]);
    const combat = combatFor(card, true), instance = combat.piles.hand[0];
    assert.doesNotThrow(() => previewCard(combat, instance.instanceId), card.id);
    assert.doesNotThrow(() => dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.enemies[0].id }), card.id);
    assert.ok(combat.eventLog.some(event => event.type === 'cardResolved' && event.cardId === card.id), card.id);
  }
});

test('Reservoir charges expire at the next turn and the catalog promises retention rather than invented Mana banking', () => {
  const card = catalog.cards.find(row => row.name === 'Banked Spark');
  const combat = combatFor(card), instance = combat.piles.hand[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.enemies[0].id });
  assert.ok(Object.keys(combat.player.abilityRiders.charges).length);
  beginAbilityTurn(combat.player);
  assert.deepEqual(combat.player.abilityRiders.charges, {});
  assert.ok(card.keywords.includes('retain'));
  assert.match(card.textTemplate, /next spell this turn/);
});


test('default-rank generation keeps real authored upgrade headroom on the nearest rounded CP plateau', () => {
  const result = GenerateSubclassCatalog({ seed: 'mechanical-export-integration' });
  assert.equal(result.cards.length, 180);
  for (const [index, card] of result.cards.entries()) {
    assert.ok(card.upgrade, card.id);
    const after = applyUpgradeSteps(card, [{ k: 'authored' }]);
    assert.notDeepEqual(ProjectCardMechanicalValues(after).card.effects, ProjectCardMechanicalValues(card).card.effects, card.id);
    assertMeasuredTarget(result.metadata[index]);
    const cp = CombatPower(ScoreCard(CardDefinitionToScoreFace(after, { scoring }), scoring).raw, after.rarity, scoring);
    assert.ok(RankOf(cp, scoring) <= result.metadata[index].requestedRank, card.id);
  }
});

test('custom weight edits reach generated measurements and truthfully report infeasible targets',()=>{
  const custom=structuredClone(scoring);
  custom.costs.sp.weight=-3;
  custom.costs.mp.weight=-7;
  custom.effects.damage.per=2;
  const result=GenerateSubclassCatalog({seed:'weight-propagation',subclassIds:['assassin'],countPerSubclass:3},{scoring:custom});
  assert.equal(result.cards.length,3);
  for(const [index,card] of result.cards.entries()){
    const meta=result.metadata[index];
    const raw=ScoreCard(CardDefinitionToScoreFace(card,{scoring:custom}),custom).raw;
    assert.equal(meta.projectedRaw,raw);
    assert.equal(meta.projectedCp,CombatPower(raw,card.rarity,custom));
    assert.equal(meta.projectedRank,RankOf(meta.projectedCp,custom));
    assert.equal(meta.miss,meta.projectedCp!==meta.targetCp);
    if(meta.projectedRank!==meta.requestedRank)assert.ok(meta.adaptations.some(reason=>reason.includes('infeasible')));
    if(card.upgrade){
      const after=applyUpgradeSteps(card,[{k:'authored'}]);
      assert.notDeepEqual(ProjectCardMechanicalValues(after).card.effects,ProjectCardMechanicalValues(card).card.effects);
      assert.ok(RankOf(CombatPower(ScoreCard(CardDefinitionToScoreFace(after,{scoring:custom}),custom).raw,after.rarity,custom),custom)<=meta.requestedRank);
    }else assert.ok(meta.adaptations.some(reason=>reason.includes('No legal signature upgrade')));
  }
});
