import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionMartial, combatExpansionMartialOverlay } from '../src/content/combatExpansionMartial.js';
import { tacticalCarrier, prepareTacticalCard, primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { matchupRiderEffects, beginTacticalAction, setCombatStance, armCombatCounter,
  recordTacticalContact, completeTacticalAction } from '../src/engine/combatMatchups.js';
import { combatExpansionEntityProblems } from '../src/model/combatTacticsRules.js';
import { previewAvoidance } from '../src/engine/combatAvoidance.js';
import { applyStatusPressure } from '../src/engine/combatStatusControl.js';
import { createCombat, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);

test('Sweeping Blow authors bodily Off Balance pressure without changing legacy cards or other Sweeps', () => {
  const original = resolveCard(registries, { cardId: 'sweepingBlow' }, 1);
  const before = JSON.stringify(original);
  const projected = applyCombatExpansionMartial(original);
  assert.deepEqual(projected.effects.find(effect => effect.status === 'offBalance'), {
    op: 'buildup', target: 'allEnemies', status: 'offBalance', amount: 3,
    camp: 'physical', recoveryProfile: 'bodily',
  });
  assert.equal(combatProfileFor(projected).maneuver, 'sweep');
  assert.equal(projected.targeting, 'area');
  assert.match(projected.textTemplate, /Off Balance buildup/);
  assert.equal(JSON.stringify(original), before);
  assert.ok(!original.effects.some(effect => effect.status === 'offBalance'));
  assert.ok(!applyCombatExpansionMartial(resolveCard(registries, { cardId: 'hewingArc' }, 1)).effects
    .some(effect => effect.status === 'offBalance'));
  const f = fixture(), pressure = projected.effects.find(effect => effect.status === 'offBalance');
  const first = applyStatusPressure(f.ctx, f.source, pressure.status, pressure.amount, f.target, pressure);
  assert.equal(first.acceptedBuildup, 3);
  assert.equal(f.source.statuses.offBalance, undefined);
  const second = applyStatusPressure(f.ctx, f.source, pressure.status, pressure.amount, f.target, pressure);
  assert.equal(second.activeAdded, 1);
  assert.equal(f.source.statuses.offBalance.stacks, 1);
});

test('base and upgraded Sweeping Blow full previews bind their printed Off Balance amount', () => {
  for (const upgraded of [false, true]) {
    const ref = { cardId: 'sweepingBlow', instanceId: 'sweep-preview', upgraded };
    const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2,
      enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', maxHp: 100, hp: 100,
        maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10,
        drawPerTurn: 1, deck: [ref] } });
    const preview = previewCard(combat, ref.instanceId, combat.enemies[0].id);
    assert.equal(preview.tokens.offBalance, 3);
    assert.match(preview.resolvedDefinition.textTemplate, /\{offBalance\} Off Balance buildup/);
    const fullText = preview.resolvedDefinition.textTemplate.replace(/\{([^}]+)\}/g,
      (match, token) => preview.tokens[token] ?? match);
    assert.match(fullText, /Add 3 Off Balance buildup to ALL enemies/);
    assert.ok(!fullText.includes('{'), fullText);
  }
  const projected = applyCombatExpansionMartial({ ...registries.cards.get('sweepingBlow'),
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 8 }], textTemplate: 'Deal {damage} damage twice.' } });
  assert.match(projected.upgrade.textTemplate, /Off Balance buildup/);
});
const player = () => ({ id: 'player', kind: 'player', alive: true, hp: 50, block: 0,
  statuses: {}, ratings: { ar: 4, dr: 3, pr: 9 } });
const fixture = () => {
  const queue = [], target = player(), source = { id: 'enemy', kind: 'enemy', alive: true, hp: 50, statuses: {} };
  const ctx = { combatExpansionVersion: 2, player: target, enemies: [source], ratingsRules: {}, registries,
    enqueue: action => queue.push(action), emit() {}, rng: { int() { throw new Error('Unexpected RNG'); } } };
  return { ctx, queue, target, source };
};

test('explicit Martial overlay covers every shipped physical identity and never mutates definitions', () => {
  const physical = registries.cards.all().filter(card => card.minCombatExpansionVersion !== 2 && combatProfileFor(card).camp === 'physical');
  assert.ok(physical.length >= 140);
  for (const def of physical) {
    assert.ok(combatExpansionMartialOverlay[def.id], def.id);
    const original = JSON.stringify(def), card = applyCombatExpansionMartial(def), profile = combatProfileFor(card);
    assert.equal(profile.camp, 'physical', def.id);
    assert.ok(['contact', 'near', 'far'].includes(profile.reach), def.id);
    assert.ok(['single', 'area'].includes(profile.targeting), def.id);
    assert.equal(JSON.stringify(def), original);
  }
});

test('a bow equipment projection keeps Ranged delivery and spell basics retain authored Spell camp', () => {
  const bow = applyCombatExpansionMartial(resolveCard(registries, { cardId: 'strike', profileId: 'bowPierceAttack' }));
  assert.equal(combatProfileFor(bow).maneuver, 'ranged'); assert.equal(bow.reach, 'near');
  const spell = resolveCard(registries, { cardId: 'strike', profileId: 'staffMagicAttack' });
  assert.equal(applyCombatExpansionMartial(spell), spell);
});

test('Quickstep and Dodge print Block5 plus DR and return exactly3 plus AR without restoring Ward', () => {
  for (const id of ['quickstep', 'dodgeRoll']) {
    const f = fixture(), def = applyCombatExpansionMartial(resolveCard(registries, { cardId: id, abilityRank: 0 }, 2));
    const carrier = tacticalCarrier(def, { cardId: id, type: def.type });
    const support = prepareTacticalCard(f.ctx, f.target, f.source, carrier, def.effects);
    assert.equal(f.target.combatCounter.payload.hp, 7);
    assert.equal(f.target.combatCounter.payload.poise, 0);
    assert.equal(f.target.combatEvade.charges, 1);
    assert.equal(support.find(effect => effect.op === 'block').amount, 5);
    assert.ok(!support.some(effect => ['damage', 'gainWard', 'dodgeRoll'].includes(effect.op)));
    assert.deepEqual(combatExpansionEntityProblems(f.target), []);
  }
});

test('printed zero HP cannot invent an AR/PR return and explicit bonuses remain effective', () => {
  const f = fixture(), def = { id: 'guardCounter', type: 'attack', tags: ['camp:spell', 'maneuver:counter'],
    counterPayload: { hp: 0, poise: 4, ward: 2 }, effects: [] };
  prepareTacticalCard(f.ctx, f.target, f.source, tacticalCarrier(def, { cardId: def.id }), [], {}, { poiseBonus: 2 });
  assert.deepEqual(f.target.combatCounter.payload, { hp: 0, poise: 6, ward: 2 });
});

test('authored impact Counter is especially punishing only to its covered Smash contact', () => {
  for (const maneuver of ['attack', 'smash']) {
    const f = fixture(), def = applyCombatExpansionMartial(resolveCard(registries, { cardId: 'riposte', abilityRank: 0 }, 2));
    const carrier = tacticalCarrier(def, { cardId: def.id });
    prepareTacticalCard(f.ctx, f.target, f.source, carrier, def.effects);
    const incoming = { combatProfile: { camp: 'physical', maneuver, reach: 'contact', targeting: 'single' } };
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
    recordTacticalContact(receipt, { blocked: 4 });
    completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
    assert.deepEqual(f.queue.map(action => [action.effect.op, action.effect.amount]), [['poiseDamage', maneuver === 'smash' ? 6 : 4]]);
  }
});

test('Shield Bash is Counter with authored Block and Poise instead of immediate Smash damage', () => {
  const f = fixture(), def = applyCombatExpansionMartial(resolveCard(registries, { cardId: 'shieldBash', abilityRank: 0 }, 2));
  const carrier = tacticalCarrier(def, { cardId: def.id, type: def.type });
  const support = prepareTacticalCard(f.ctx, f.target, f.source, carrier, def.effects);
  assert.equal(combatProfileFor(def).maneuver, 'counter');
  assert.deepEqual(f.target.combatCounter.payload, { hp: 0, poise: 4, ward: 0, smashPoiseBonus: 2 });
  assert.deepEqual(support, [{ op: 'block', target: 'self', amount: 5 }]);
  assert.equal(def.ratingId, 'dr');
});

test('enemy partial Counter payload normalizes all lanes and uses the registered Barrier opcode', () => {
  const f = fixture(), move = { tags: ['camp:spell', 'maneuver:counter', 'counter:spell'],
    counterPayload: { ward: 2 }, barrier: 5 };
  f.source.enemyId = 'fixture'; f.source.intent = { moveId: 'counter' };
  primeEnemyCounter(f.ctx, f.source, move, 'counter');
  assert.deepEqual(f.source.combatCounter.payload, { hp: 0, poise: 0, ward: 2 });
  assert.equal(f.queue[0].effect.op, 'gainBarrier');
  assert.deepEqual(combatExpansionEntityProblems(f.source), []);
});

test('v2 typed riders author gauge buildup and suppress duplication of printed pressure', () => {
  const f = fixture(), carrier = { combatProfile: { camp: 'spell', damageType: 'lightning' }, combatRiderTargets: [] };
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, carrier, { amount: 3, hpLoss: 3 }),
    [{ op: 'buildup', status: 'paralysis', amount: 3, camp: 'spell', recoveryProfile: 'elemental' }]);
  const printed = { ...carrier, combatRiderTargets: [], appliedBuildupStatuses: ['paralysis'] };
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, printed, { amount: 3, hpLoss: 3 }), []);
});

test('equipment object traits preserve Grounded Counter and caster-only spell HP eligibility', () => {
  const f = fixture(); f.target.combatTraits = { grounded: true }; f.source.combatTraits = { caster: true };
  const counter = { combatProfile: { camp: 'spell', maneuver: 'counter', reach: 'near', targeting: 'single' } };
  setCombatStance(f.ctx, f.target, counter); armCombatCounter(f.ctx, f.target, counter, { payload: { hp: 3 } });
  const incoming = { combatProfile: { camp: 'spell', maneuver: 'casting', school: 'lightning', reach: 'near', targeting: 'single' } };
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 3 }]);
  recordTacticalContact(receipt, { wardResisted: 3 }); completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  assert.deepEqual(f.queue.map(action => action.effect.amount), [3]);
});

test('status-only previews do not advertise damage avoidance or consume readiness', () => {
  const f = fixture(); f.target.combatStance = { maneuver: 'ranged', reach: 'far' };
  f.target.combatEvade = { charges: 1, bonus: 0 };
  assert.equal(previewAvoidance(f.ctx, f.target, { reach: 'contact' }, 0).chance, 0);
  assert.equal(f.target.combatEvade.charges, 1);
});

test('player action carriers expose actual electrical equipment traits to an enemy school Counter', () => {
  const f = fixture(), def = resolveCard(registries, { cardId: 'strike', abilityRank: 0 }, 2);
  f.target.combatTraits = { conductive: true, insulated: true };
  let card = tacticalCarrier(def, {}, f.ctx, f.target);
  assert.ok(card.combatProfile.traits.includes('conductive'));
  assert.ok(card.combatProfile.traits.includes('insulated'));
  f.target.statuses.grounded = { stacks: 1 };
  card = tacticalCarrier(def, {}, f.ctx, f.target);
  assert.ok(card.combatProfile.traits.includes('grounded'));
  assert.ok(!card.combatProfile.traits.includes('conductive'));
});

test('permanent grades retain Quickstep Block, bonus draws and once-per-turn support', () => {
  const card = applyCombatExpansionMartial(resolveCard(registries, { cardId: 'quickstep', abilityRank: 5 }, 2));
  assert.equal(card.effects.find(effect => effect.op === 'block' && !effect.oncePerTurn).amount, 17);
  assert.equal(card.effects.filter(effect => effect.op === 'draw' && !effect.oncePerTurn).reduce((sum, effect) => sum + effect.amount, 0), 2);
  assert.ok(card.effects.some(effect => effect.op === 'block' && effect.oncePerTurn === 'grade-block' && effect.amount === 2));
  assert.ok(card.effects.some(effect => effect.op === 'draw' && effect.oncePerTurn === 'grade-draw' && effect.amount === 1));
});

test('zero-HP Counter grades move earned primary damage to Poise and preserve conditional reply bonuses', () => {
  for (const [id, expected] of [['shieldBash', 20], ['riposte', 16], ['progression-crimson-reprisal', 18]]) {
    const f = fixture(), def = applyCombatExpansionMartial(resolveCard(registries, { cardId: id, abilityRank: 5 }, 2));
    const carrier = tacticalCarrier(def);
    const support = prepareTacticalCard(f.ctx, f.target, f.source, carrier, def.effects);
    assert.equal(f.target.combatCounter.payload.hp, 0, id);
    assert.equal(f.target.combatCounter.payload.poise, expected, id);
    assert.ok(support.some(effect => effect.op === 'draw' && effect.oncePerTurn === 'grade-draw'), id);
  }
  const f = fixture(); f.target.block = 1;
  const def = applyCombatExpansionMartial(resolveCard(registries, { cardId: 'riposte', abilityRank: 5 }, 2));
  prepareTacticalCard(f.ctx, f.target, f.source, tacticalCarrier(def), def.effects);
  assert.equal(f.target.combatCounter.payload.poise, 20);
});

test('Prone combo impact is conditional on a successful Contact return, while conditional Evade needs Prone', () => {
  for (const prone of [false, true]) {
    const f = fixture();
    if (prone) f.target.statuses.prone = { stacks: 1 };
    const def = { tags: ['camp:physical', 'maneuver:counter'], pronePoiseBonus: 2,
      counterPayload: { hp: 0, poise: 3, ward: 0 }, effects: [] };
    const counter = tacticalCarrier(def);
    prepareTacticalCard(f.ctx, f.target, f.source, counter, []);
    const incoming = { combatProfile: { camp: 'physical', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
    recordTacticalContact(receipt, { blocked: 4 });
    completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
    assert.deepEqual(f.queue.map(action => [action.effect.op, action.effect.amount]), [['poiseDamage', prone ? 5 : 3]]);
    const shot = tacticalCarrier({ tags: ['camp:physical', 'maneuver:ranged'],
      evade: { charges: 1, bonus: 0, advantage: true, whileStatus: 'prone' } });
    prepareTacticalCard(f.ctx, f.target, f.source, shot, []);
    assert.equal(!!f.target.combatEvade?.charges, prone);
  }
});
