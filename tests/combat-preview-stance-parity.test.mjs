import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { configuredContentBundle, advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Use the same configured defaults as a new production run. Raw authored
// registries omit live ratings, which hid the stance bonus in older fixtures.
function fixture(api, { classId = 'rogue', stance = null, protection = 'guard', cardId = 'strike', carrierId } = {}) {
  const run = api.createRunState({ registries: api.registries, classId, seed: 11 });
  if (carrierId) {
    assert.ok(api.applyEquipTransition(api.registries, run.loadout, 'rightHand', 0, carrierId));
    api.stampDeck(api.registries, run);
  }
  const combat = api.createRunCombat({ registries: api.registries, rng: api.createRng(11), run,
    enemyIds: ['wanderingSoldier'] });
  const native = run.deck.find(card => card.cardId === cardId && (!carrierId || card.sourceArmamentId === carrierId));
  const instance = { ...native, cardId, instanceId: 'stance-parity', upgraded: false };
  combat.piles.hand = [instance];
  for (const pile of ['draw', 'discard', 'exhaust']) combat.piles[pile] = [];
  if (stance) combat.player.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  else delete combat.player.combatStance;
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 36, maxHp: 36, block: protection === 'guard' ? 8 : protection === 'blocked' ? 100 : 0,
    barrier: protection === 'typed' ? 1 : 0, statuses: {},
    ratings: { ar: 0, dr: 0, pr: 0, poise: protection === 'guard' ? 10 : 0, ward: protection === 'typed' ? 6 : 0 },
    persistentPoise: { max: protection === 'guard' ? 10 : 0, value: protection === 'guard' ? 10 : 0 },
    persistentWard: { max: protection === 'typed' ? 6 : 0, value: protection === 'typed' ? 6 : 0 },
    damageResistanceFlat: protection === 'typed' ? { slashing: 2, piercing: 2, blunt: 2, arcane: 2 } : {},
    damageWeaknessPercent: {}, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' } });
  delete enemy.combatCounter;
  delete enemy.combatEvade;
  primeAccuracyRolls(combat);
  return { combat, enemy, instance };
}

const state = combat => JSON.stringify({ snapshot: combatState(combat), rng: combat.rng.getCounters(), events: combat.eventLog });
function combatState(combat) {
  return { player: combat.player, enemies: combat.enemies, piles: combat.piles, queue: combat.queue,
    pending: combat.pendingExpansionActions, serial: combat.expansionActionSerial };
}
const losses = (events, id) => events.filter(event => event.type === 'damageDealt' && event.targetId === id)
  .map(event => event.amount - event.blocked);

for (const mode of ['native', 'bundled']) {
  const api = await loadAuditRuntime(mode);
  api.registries = api.createRegistries(configuredContentBundle(api.contentBundle,
    { ...advancedConfigSnapshot(), breakMeterVersion: 2 }));

  test(`${mode}: canonical Rogue Piercing Flurry preview includes the accepted Attack rating`, () => {
    const { combat, enemy, instance } = fixture(api);
    assert.equal(combat.player.hp, 53);
    assert.equal(combat.player.stamina, 3);
    assert.equal(combat.player.mana, 1);
    assert.equal(instance.profileId, 'daggerPierceAttack');
    assert.equal(instance.ratingValue, 2);
    const before = state(combat);
    for (const target of [undefined, enemy.id]) {
      const shown = api.previewCard(combat, instance.instanceId, target);
      const damage = shown.values.find(value => value.op === 'damage');
      assert.deepEqual(Array.from(damage.hitDamages), [1, 1]);
      assert.equal(damage.totalDamage, 2);
      assert.equal(shown.cost, 1, 'price is measured before the new stance');
      if (!target) assert.equal(damage.faceValue, 6, 'card base 3 plus prospective source Attack 3');
      assert.equal(state(combat), before, 'preview spends no RNG, grants, protection or live stance');
    }
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
    const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
    assert.deepEqual(Array.from(damage, event => [event.incoming, event.blocked, event.poiseAbsorbed]), [[6, 4, 1], [6, 4, 1]]);
    assert.deepEqual(Array.from(losses(out.events, enemy.id)), [1, 1]);
    assert.equal(enemy.hp, 34);
    assert.equal(combat.player.stamina, 2);
    assert.equal(out.events.filter(event => event.type === 'statusApplied' && event.status === 'precision').length, 1);
  });

  test(`${mode}: paid native class attacks agree with previews across prior stances and protection`, () => {
    for (const classId of ['reaver', 'rogue', 'starseer', 'herald'])
      for (const stance of [null, 'defend', 'attack'])
        for (const protection of ['none', 'guard', 'typed', 'blocked']) {
          const { combat, enemy, instance } = fixture(api, { classId, stance, protection });
          const before = state(combat), hp = enemy.hp;
          const shown = api.previewCard(combat, instance.instanceId, enemy.id).values.filter(value => value.op === 'damage');
          const hits = shown.flatMap(value => Array.from(value.hitDamages));
          const label = `${classId}/${stance}/${protection}`;
          assert.equal(state(combat), before, label + ': repeatable detached preview');
          const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
          assert.deepEqual(Array.from(losses(out.events, enemy.id)), Array.from(hits), label);
          assert.equal(hp - enemy.hp, hits.reduce((sum, amount) => sum + amount, 0), label + ': HP receipt');
          assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1, label + ': paid play');
        }
  });

  test(`${mode}: prospective Defend protection and refused play previews preserve live state`, () => {
    const { combat, instance } = fixture(api, { cardId: 'defend', protection: 'none' });
    const before = state(combat);
    const shown = api.previewCard(combat, instance.instanceId).values.find(value => value.op === 'block');
    assert.equal(state(combat), before, 'Defend preview does not restore pools or grant entry Block');
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId });
    const own = out.events.filter(event => event.type === 'blockGained' && event.cardInstanceId === instance.instanceId && !event.triggeredBy);
    assert.equal(own.length, 1);
    assert.equal(own[0].amount, shown.value, 'authored Block uses prospective defensive rating');

    const f = fixture(api); f.combat.player.energy = 0;
    const empty = state(f.combat);
    api.previewCard(f.combat, f.instance.instanceId, f.enemy.id);
    assert.equal(state(f.combat), empty, 'unaffordable preview leaves the fight untouched');
    assert.throws(() => api.dispatch(f.combat, { type: 'playCard', cardInstanceId: f.instance.instanceId, targetId: f.enemy.id }), /Not enough/);
    assert.equal(state(f.combat), empty, 'refused play cannot commit the preview stance or grants');

    const wound = fixture(api, { cardId: 'wound' });
    const unplayable = state(wound.combat);
    api.previewCard(wound.combat, wound.instance.instanceId);
    assert.throws(() => api.dispatch(wound.combat, { type: 'playCard', cardInstanceId: wound.instance.instanceId }), /unplayable/);
    assert.equal(state(wound.combat), unplayable, 'unplayable cards retain their refusal without entry grants');
  });

  test(`${mode}: ranged equipment and casting previews use their accepted stance`, () => {
    for (const options of [{ carrierId: 'shortbow' }, { classId: 'starseer', cardId: 'starSpark' }]) {
      const { combat, enemy, instance } = fixture(api, { ...options, stance: 'defend', protection: 'none' });
      if (options.carrierId) assert.equal(instance.profileId, 'bowPierceAttack');
      const before = state(combat);
      const shown = api.previewCard(combat, instance.instanceId, enemy.id).values.filter(value => value.op === 'damage');
      const hits = shown.flatMap(value => Array.from(value.hitDamages));
      assert.equal(state(combat), before);
      const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
      assert.deepEqual(Array.from(losses(out.events, enemy.id)), Array.from(hits));
      assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
    }
  });

  test(`${mode}: default spell Counter support matches paid protection with Ward overflow`, () => {
    const { combat, instance } = fixture(api, { classId: 'starseer', cardId: 'frostCounter', protection: 'none' });
    assert.equal(combat.player.ratings.dr, 2);
    assert.equal(combat.player.ratings.pr, 4);
    const before = state(combat), hp = combat.enemies[0].hp;
    const shown = api.previewCard(combat, instance.instanceId);
    const protection = shown.values.find(value => value.op === 'gainBarrier');
    // Counterstrike makes the base 7 (4 Block/3 Ward); Defense 2 joins Block,
    // and Power 4 plus the accepted Counter's 1 joins Ward. Full Ward overflows.
    assert.equal(protection.value, 14);
    assert.equal(JSON.stringify(protection.defenseSplit), JSON.stringify({ block: 6, ward: 8 }));
    assert.equal(shown.tokens['gainBarrier.block'], 6);
    assert.equal(shown.tokens['gainBarrier.ward'], 8);
    assert.equal(state(combat), before);
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.player.id });
    const own = out.events.filter(event => event.cardInstanceId === instance.instanceId && !event.triggeredBy);
    assert.equal(own.find(event => event.type === 'blockGained').amount, 6);
    assert.equal(own.find(event => event.type === 'persistentWardChanged' && event.source === 'card').credited, 8);
    assert.equal(own.find(event => event.type === 'barrierGained').amount, 8);
    const entry = out.events.filter(event => event.triggeredBy?.kind === 'stance');
    assert.equal(entry.find(event => event.type === 'blockGained').amount, 2);
    assert.equal(entry.find(event => event.type === 'barrierGained').amount, 1);
    assert.equal(combat.player.block, 8);
    assert.equal(combat.player.barrier, 9);
    assert.equal(combat.player.persistentWard.value, 6);
    assert.equal(combat.enemies[0].hp, hp, 'only preparation, no retaliation');
    assert.equal(out.events.filter(event => event.type === 'combatCounterArmed').length, 1);
  });

  test(`${mode}: Counterstrike support keeps duplicate effect slots and deferred Counter payloads`, () => {
    const tags = ['classification.skill', 'camp:physical', 'maneuver:counter', 'damage:blunt', 'range:melee', 'targeting:single'];
    const card = { id: 'auditMixedCounter', name: 'Mixed Counter', class: 'colorless', type: 'skill',
      cost: 1, costRule: 'fixed', traitValues: { counterstrike: true }, tags,
      effects: [
        { op: 'block', target: 'self', amount: 3 },
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'block', target: 'self', amount: 7 },
        { op: 'poiseDamage', target: 'enemy', amount: 2 },
        { op: 'block', target: 'self', amount: { f: 'add', args: [1, 2] } },
        { op: 'wardDamage', target: 'enemy', amount: 1 },
        { op: 'block', target: 'self', amount: 0 },
      ], textTemplate: 'Gain {block} Block. Return {damage} damage. Gain {block.2} Block. Gain {block.3} Block. Gain {block.4} Block.' };
    const registries = api.createRegistries({ ...api.contentBundle,
      balance: { ...api.contentBundle.balance, combatRatings: api.registries.balance.combatRatings },
      cards: [...api.contentBundle.cards, card],
      tagging: [...api.contentBundle.tagging, ...tags.map(tagId => ({ family: 'card', objectId: card.id, tagId }))] });
    const combat = api.createCombat({ registries, rng: api.createRng(11), combatExpansionVersion: 2, reactionRulesVersion: 2,
      ratingsRules: registries.balance.combatRatings, enemyIds: ['wanderingSoldier'],
      player: { classId: 'reaver', hp: 100, maxHp: 100, mana: 20, maxMana: 20, stamina: 20, maxStamina: 20,
        energyMax: 20, drawPerTurn: 1, deck: [{ cardId: card.id, instanceId: 'mixed-counter' }] } });
    combat.player.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
    combat.player.ratingSources = []; combat.player.statuses = {}; combat.player.block = 0;
    const before = state(combat), hp = combat.enemies[0].hp;
    // The explicit hostile Ward row gives this synthetic card an enemy target.
    // Counter beats that enemy's prepared Attack, so the shared bonus is 75%:
    // bases 3/7/3/0 become 5/12/5/0, then the accepted Counter adds 3 Defense.
    const shown = api.previewCard(combat, 'mixed-counter', combat.enemies[0].id);
    assert.deepEqual(Array.from(shown.values, value => value.op), card.effects.map(effect => effect.op));
    assert.deepEqual(Array.from(shown.values.filter(value => value.op === 'block'), value => value.value), [8, 15, 8, 3]);
    assert.deepEqual(['block', 'block.2', 'block.3', 'block.4'].map(token => shown.tokens[token]), [8, 15, 8, 3]);
    assert.equal(shown.tokens.damage, 6, 'deferred damage keeps its unscaled preparation base plus Attack');
    assert.equal(shown.values[3].value, 2, 'deferred Poise keeps its authored value');
    assert.equal(shown.chargedEffects[5].amount, 1, 'deferred Ward keeps its authored value and slot');
    assert.equal(state(combat), before, 'preview neither arms nor consumes a Counter or entry grant');
    const out = api.dispatch(combat, { type: 'playCard', cardInstanceId: 'mixed-counter', targetId: combat.enemies[0].id });
    const support = out.events.filter(event => event.type === 'blockGained' && event.cardInstanceId === 'mixed-counter' && !event.triggeredBy);
    assert.deepEqual(Array.from(support, event => event.amount), [8, 15, 8, 3]);
    assert.equal(combat.enemies[0].hp, hp, 'preparation never deals its deferred damage');
    assert.equal(combat.player.combatCounter.payload.hp, 6);
    assert.equal(combat.player.combatCounter.payload.poise, 2);
    assert.equal(combat.player.combatCounter.payload.ward, 1);
    assert.equal(out.events.filter(event => event.type === 'combatCounterArmed').length, 1);
    assert.equal(out.events.filter(event => event.type === 'combatCounterstrikeApplied').length, 1);
    assert.equal(out.events.filter(event => event.type === 'combatStanceChanged').length, 1);
  });
}
