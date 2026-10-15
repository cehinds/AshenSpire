import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, resolvedCardPlayCosts } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt, profileCardCosts, setProfileStance } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const author = modules => ({ formatVersion: 1, core: 'ashen.core@1.0.0', modules });
const profile = modules => resolveGameProfile(author(modules || {}));
const carrier = maneuver => ({ combatProfile: { maneuver, camp: 'physical' } });
function world(modules = {}) {
  const gameProfile = profile(modules);
  const events = [];
  return { gameProfile, turn: 1, rng: createRng(17), emit: (type, payload) => events.push({ type, ...payload }), events };
}
const fighter = (id, extra = {}) => ({ id, kind: id === 'player' ? 'player' : 'enemy', hp: 80, maxHp: 80,
  alive: true, block: 0, statuses: {}, ratings: { ar: 2, dr: 1, poise: 0 }, ...extra });
function live(modules = {}, selectedProfile = null) {
  const gameProfile = selectedProfile || profile(modules);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `core-${i}`, cardId: i < 6 ? 'core.strike' : 'core.defend', upgraded: false }));
  const combat = createCombat({ registries, rng: createRng(311), gameProfile, enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxStamina: 10, stamina: 10, maxMana: 5, mana: 5,
      energyMax: 10, drawPerTurn: 5, poiseMax: 4, attributes: { intelligence: 1, strength: 2, dexterity: 1 }, deck } });
  return { combat, registries };
}

test('unified Block then pure Poise receipts agree in live application and preview', () => {
  const ctx = world(), source = fighter('player'), target = fighter('foe', { block: 3, gameProfilePoise: 8 });
  const before = structuredClone(target), rngBefore = ctx.rng.getCounters();
  const expected = profileDamageReceipt(ctx, source, target, 10, carrier('attack'));
  assert.equal(expected.hpLoss, 6); // (10+2 AR-3 Block)*.75 floored
  const preview = previewDamageHits(ctx, source, target, 10, [], carrier('attack'));
  assert.equal(preview.hpLoss, expected.hpLoss);
  assert.deepEqual(target, before); assert.deepEqual(ctx.rng.getCounters(), rngBefore);
  applyAttackDamage(ctx, source, target, 10, [], carrier('attack'));
  assert.equal(target.hp, before.hp - expected.hpLoss);
  assert.equal(target.block, expected.blockRemaining);
  assert.equal(target.gameProfilePoise, 8, 'Poise never depletes into a legacy break');
});

test('zero input remains zero; full Block never resurrects damage at Poise floor', () => {
  const ctx = world({ effects: { attackRatingWeight: 0 } });
  const source = fighter('player'), target = fighter('foe', { block: 20, gameProfilePoise: 10 });
  assert.equal(profileDamageReceipt(ctx, source, target, 0, carrier('attack')).hpLoss, 0);
  assert.equal(profileDamageReceipt(ctx, source, target, 1, carrier('attack')).hpLoss, 0);
});

test('defense order is selected JSON policy; defenses off passes damage through', () => {
  const source = fighter('player'), target = fighter('foe', { block: 3, gameProfilePoise: 5 });
  const a = world({ effects: { attackRatingWeight: 0 } });
  const b = world({ effects: { attackRatingWeight: 0 }, defenses: { order: ['poise', 'block'] } });
  assert.equal(profileDamageReceipt(a, source, target, 10).hpLoss, 5);
  assert.equal(profileDamageReceipt(b, source, target, 10).hpLoss, 4);
  assert.equal(profileDamageReceipt(world({ defenses: false, effects: { attackRatingWeight: 0 } }), source, target, 10).hpLoss, 10);
});

test('Evade uses probability and supplied roll, preview exposes bounds without RNG consumption', () => {
  const ctx = world(), source = fighter('player'), target = fighter('foe', { combatStance: { maneuver: 'evade' } });
  const counters = ctx.rng.getCounters();
  const preview = previewDamageHits(ctx, source, target, 5, [], carrier('attack'));
  assert.equal(preview.uncertain, true); assert.ok(preview.hitChance > 0 && preview.hitChance < 1);
  assert.deepEqual(preview.hpLossBounds, [0, 14]);
  assert.deepEqual(ctx.rng.getCounters(), counters);
  assert.equal(profileDamageReceipt(ctx, source, target, 5, carrier('attack'), { roll: 0.999 }).hpLoss, 0);
  assert.equal(profileDamageReceipt(ctx, source, target, 5, carrier('attack'), { roll: 0 }).hpLoss, 14);
});

test('stance relation comes from JSON and disabled stances remain neutral', () => {
  const ctx = world(), target = fighter('foe', { combatStance: { maneuver: 'defend' } });
  assert.equal(profileDamageReceipt(ctx, fighter('player'), target, 5, carrier('smash')).advantage, true);
  const off = world({ stances: false });
  assert.equal(profileDamageReceipt(off, fighter('player'), target, 5, carrier('smash')).advantage, false);
  setProfileStance(off, target, carrier('smash')); assert.equal(target.combatStance.maneuver, 'neutral');
});

test('authored resource variants are selected before pricing, including resource-off', () => {
  for (const include of [[], ['sp'], ['mp'], ['sp', 'mp']]) {
    const ctx = world({ resources: { include } });
    const def = projectGameCard(ctx, 'core.strike');
    const costs = profileCardCosts(ctx, def);
    assert.equal(costs.stamina, include.includes('sp') ? def.staminaCost : 0);
    assert.equal(costs.mana, include.includes('mp') ? def.manaCost : 0);
    if (!include.includes('sp')) assert.throws(() => profileCardCosts(ctx, { id: 'unsafe', cost: 3, manaCost: 0 }), /authored disabled-resource variant/);
  }
});

test('configured live combat permits multiple SP-priced cards then refreshes whole pool', () => {
  const { combat } = live();
  assert.equal(combat.piles.hand.length, 5);
  const targetId = combat.enemies[0].id;
  for (const card of combat.piles.hand.slice(0, 2)) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId });
  assert.equal(combat.player.stamina, 8); assert.equal(combat.piles.discard.length, 2);
  const ids = Object.values(combat.piles).flat().map(card => card.instanceId).sort();
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.piles.hand.length, 5); assert.equal(combat.piles.discard.length, 0);
  assert.deepEqual(Object.values(combat.piles).flat().map(card => card.instanceId).sort(), ids);
});

test('card preview and executed configured damage share one receipt path', () => {
  const { combat } = live();
  const card = combat.piles.hand.find(card => card.cardId === 'core.strike');
  const target = combat.enemies[0]; target.hp = target.maxHp = 200; target.block = 3; target.gameProfilePoise = 3;
  const preview = previewCard(combat, card.instanceId, target.id);
  const before = target.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
  const damage = out.events.find(event => event.type === 'damageDealt' && event.targetId === target.id);
  assert.equal(preview.values.find(effect => effect.op === 'damage').value, damage.amount);
  assert.equal(before - target.hp, damage.hpLoss);
});

test('configured snapshot resumes pinned rules and refuses a different run profile', () => {
  const { combat, registries } = live();
  const snapshot = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, snapshot, rng: createRng(combat.rng.seed), expectedGameProfile: combat.gameProfile });
  assert.equal(restored.gameProfile.hash, combat.gameProfile.hash);
  assert.deepEqual(serializeCombatSnapshot(restored), snapshot);
  assert.throws(() => restoreCombatSnapshot({ registries, snapshot, rng: createRng(combat.rng.seed), expectedGameProfile: profile({ stances: false }) }), /profile.*match/);
});

test('cards-off fallback attacks once then yields even with all optional resource pools off', () => {
  const { combat } = live({ cards: false, resources: false, defenses: false, stances: false });
  assert.equal(combat.piles.hand.length, 0);
  const turn = combat.turn;
  dispatch(combat, { type: 'basicAttack', targetId: combat.enemies[0].id });
  assert.ok(combat.turn > turn || combat.result);
  assert.equal(combat.player.stamina, 0);
});

test('actual core run hands the same pin and derived AR/DR to the live combat factory', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { deriveStat } = await import('../src/model/derivedStats.js');
  const gameProfile = profile();
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const run = createRunState({ registries, seed: 729, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.gameProfile.hash, run.gameProfile.hash);
  for (const id of ['ar', 'dr']) assert.equal(combat.player.ratings[id], deriveStat(run.derivedStatRuleSnapshot.rules, id,
    { attributes: run.attributes, classDef: registries.classes.get(run.class), level: run.level.level }).value);
  assert.equal(combat.piles.hand.length, 5);
  const card = combat.piles.hand[0], targetId = combat.enemies[0].id;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId });
  assert.equal(combat.player.counters.cardsPlayedThisTurn, 1);
  assert.deepEqual(combat.skillXp, {}, 'configured core does not gain legacy skill XP');
});

test('current profile keeps absent-profile combat traces and snapshot state unchanged', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const current = resolveGameProfile('current');
  const registries = createRegistries(contentBundle);
  const run = createRunState({ registries, seed: 177, classId: 'reaver' });
  const absentRun = structuredClone(run); delete absentRun.gameProfile;
  const selectedRun = structuredClone(run); selectedRun.gameProfile = current;
  const absent = createRunCombat({ registries, run: absentRun, rng: createRng(177), enemyIds: ['wanderingSoldier'] });
  const selected = createRunCombat({ registries, run: selectedRun, rng: createRng(177), enemyIds: ['wanderingSoldier'] });
  const omitPin = snapshot => { const { gameProfile, gameProfileCommands, gameProfileInterrupts, ...rest } = snapshot; return rest; };
  assert.deepEqual(omitPin(serializeCombatSnapshot(selected)), serializeCombatSnapshot(absent));
  assert.deepEqual(dispatch(selected, { type: 'endTurn' }), dispatch(absent, { type: 'endTurn' }));
  assert.deepEqual(omitPin(serializeCombatSnapshot(selected)), serializeCombatSnapshot(absent));
});

test('a real run with only cards disabled gets attack/pass rather than stale starter cards', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const gameProfile = profile({ cards: false });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const run = createRunState({ registries, seed: 142, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(run.deck.length, 0); assert.equal(combat.piles.hand.length, 0);
  dispatch(combat, { type: 'basicAttack', targetId: combat.enemies[0].id });
  assert.ok(combat.turn === 2 || combat.result);
});

test('live Evade uses seeded candidate RNG while card preview exposes only chance and bounds', () => {
  const { combat } = live();
  const card = combat.piles.hand.find(card => card.cardId === 'core.strike'), target = combat.enemies[0];
  target.hp = target.maxHp = 200; target.combatStance = { maneuver: 'evade' };
  const counters = combat.rng.getCounters();
  const shown = previewCard(combat, card.instanceId, target.id).values.find(effect => effect.op === 'damage');
  assert.equal(shown.uncertain, true); assert.ok(shown.hitChance > 0 && shown.hitChance < 1);
  assert.deepEqual(combat.rng.getCounters(), counters);
  const roll = createRng(combat.rng.seed, counters).float('combatAvoidance');
  const expected = profileDamageReceipt(combat, combat.player, target, 6, carrier('attack'), { roll });
  const before = target.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
  assert.equal(before - target.hp, expected.hpLoss);
  assert.notDeepEqual(combat.rng.getCounters(), counters);
});

test('failed configured transaction rolls back a consumed accuracy draw and HP', () => {
  const { combat } = live();
  combat.player.combatStance = { maneuver: 'evade' };
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  const source = combat.enemies[0];
  combat.enqueue({ effect: { op: 'damage', target: 'player', amount: 9 }, source, target: combat.player, card: carrier('attack'), meta: {} });
  combat.enqueue({ effect: { op: 'unknown-test-op' }, source, target: combat.player, meta: {} });
  assert.throws(() => dispatch(combat, { type: 'endTurn' }), /Unknown opcode/);
  assert.deepEqual(combat.rng.getCounters(), counters); assert.equal(combat.player.hp, before.player.hp);
  assert.deepEqual(combat.piles, before.piles);
  assert.equal(combat.turn, before.turn);
});

test('work budget rejects another free card atomically while End Turn remains legal', () => {
  const { combat } = live({ resources: false, cards: { freeCommandLimit: 1 } });
  const targetId = combat.enemies[0].id;
  dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId });
  const before = serializeCombatSnapshot(combat);
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId }), /work budget/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.turn > before.turn || combat.result);
});
