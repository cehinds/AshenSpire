import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, initializeRunDerivedStats } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createSaveManager } from '../src/engine/save.js';
import { payAshenBlight, chooseAshenBlightFeat } from '../src/engine/ashenBlight.js';
import { awardLevelXp, applyLevelUp, xpToNext } from '../src/model/levelup.js';
import { mountCombatCombo } from '../src/engine/combatExpansionCombos.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

const registries = createRegistries(contentBundle);
function fixture(seed = 11) {
  const run = createRunState({ registries, seed, classId: 'herald' });
  run.deck.unshift({ instanceId: 'save-native', cardId: 'blightedTransmute', upgraded: false });
  return { run, rng: createRng(seed) };
}
function manager() {
  const entries = new Map();
  return createSaveManager({ getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
}
function commitOwner(run, save) {
  return candidate => commitExpansionCandidate({ run, candidate, nodeId: 'n1_4', encounterId: 'patrol',
    saveCandidate: (next, rng) => { assert.deepEqual(validateRunShape(next), []); save.saveRun(next, rng); return { ok: true }; } });
}

test('accepted expanded solo play survives real run save/load and exact combat restore', () => {
  const { run, rng } = fixture(), save = manager();
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  combat.beforeCombatCommit = commitOwner(run, save);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'save-native' });
  const loaded = save.loadRun(registries);
  assert.ok(loaded, 'saved expanded run is accepted by the production load door');
  assert.equal(loaded.ashenBlight.value, 12);
  const restoredRng = createRng(run.seed, loaded.streamCounters);
  const restored = restoreCombatSnapshot({ registries, rng: restoredRng, snapshot: loaded.combatEntered.snapshot });
  assert.equal(restored.piles.exhaust.some(card => card.instanceId === 'save-native'), true);
  assert.equal(restored.player.energy, combat.player.energy);
  assert.deepEqual(restoredRng.getCounters(), rng.getCounters());
  assert.equal(restored.player.ashenBlight.value, 12);
});

test('refused durable solo save leaves run, card, resources, effects and RNG unchanged', () => {
  const { run, rng } = fixture();
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  const before = structuredClone(run), snapshot = serializeCombatSnapshot(combat), counters = rng.getCounters();
  combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run, candidate, nodeId: 'n1_4', encounterId: 'patrol', saveCandidate: () => ({ ok: false, error: 'Storage unavailable' }) });
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'save-native' }), /Storage unavailable/);
  assert.deepEqual(run, before); assert.deepEqual(serializeCombatSnapshot(combat), snapshot);
  assert.deepEqual(rng.getCounters(), counters);
});

test('victory after temporary SP gain saves bounded run pools and exact terminal combat pools', () => {
  const { run, rng } = fixture(), save = manager();
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  combat.beforeCombatCommit = commitOwner(run, save);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'save-native' });
  assert.ok(combat.player.stamina > combat.player.maxStamina);
  const enemy = combat.enemies[0]; enemy.hp = 1; enemy.block = 0; enemy.wardBarrier = 0; enemy.combatStance = 'attacking'; delete enemy.combatCounter;
  const strike = combat.piles.hand.find(card => resolveCombatCard(combat, card).effects.some(effect => effect.op === 'damage'));
  assert.ok(strike);
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  assert.equal(combat.result, 'victory'); assert.ok(combat.player.stamina > combat.player.maxStamina);
  const loaded = save.loadRun(registries);
  assert.ok(loaded, 'the production save accepts a victory with temporary SP');
  assert.equal(loaded.stamina, loaded.maxStamina);
  assert.equal(loaded.combatPendingOutcome.snapshot.player.stamina, combat.player.stamina);
});

test('terminal Blight durable outcome survives production reload with projected maxima and no reroll', () => {
  const seed = Array.from({ length: 100 }, (_, i) => i + 1).find(value => createRng(value).float('ashenBlight') < .9);
  const { run, rng } = fixture(seed), save = manager(), baseHp = run.maxHp;
  payAshenBlight({ combatExpansionVersion: 2, draw: () => .5 }, run, { amount: 88, receiptId: 'prior', combatKey: 'previous' });
  for (const threshold of [25, 50, 75]) chooseAshenBlightFeat({ combatExpansionVersion: 2 }, run, { threshold, path: 'survivor' });
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  assert.ok(combat.player.maxHp > baseHp, 'CON feats project the derived HP maximum');
  combat.beforeCombatCommit = commitOwner(run, save);
  mountCombatCombo(combat, combat.player, { ...registries.cards.get('emberCovenant'), cardId: 'emberCovenant' });
  const barrierBefore = combat.player.wardBarrier;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'save-native' });
  assert.equal(combat.result, 'defeat'); assert.equal(combat.player.ashenBlight.thresholdOutcome, 'lost');
  assert.equal(combat.player.wardBarrier, barrierBefore, 'terminal accepted payment grants no Covenant protection');
  assert.equal(combat.queue.length, 0, 'terminal snapshot contains no queued bonus');
  const loaded = save.loadRun(registries);
  assert.ok(loaded, `terminal pending outcome passes production save validation: ${save.runStatus().reason}`);
  assert.equal(loaded.combatEntered, null); assert.equal(loaded.combatPendingOutcome.result, 'defeat');
  assert.equal(loaded.maxHp, combat.player.maxHp); assert.equal(loaded.hp, 0);
  const counters = createRng(seed, loaded.streamCounters).getCounters();
  const restored = restoreCombatSnapshot({ registries, rng: createRng(seed, loaded.streamCounters), snapshot: loaded.combatPendingOutcome.snapshot });
  assert.equal(restored.result, 'defeat'); assert.deepEqual(restored.rng.getCounters(), counters);
});

test('run validation gates corrupted state and refuses forged terminal outcome/history rollback', () => {
  const { run } = fixture();
  const legacy = structuredClone(run); delete legacy.combatExpansionVersion; delete legacy.ashenBlight;
  delete legacy.reactionRulesVersion;
  delete legacy.combatExpansionRules; delete legacy.ashenBlightBasePools;
  assert.deepEqual(validateRunShape(legacy), []);
  const forged = structuredClone(run); forged.combatExpansionVersion = 3;
  assert.match(validateRunShape(forged).join(';'), /combatExpansionVersion/);
  const crossed = structuredClone(run); crossed.ashenBlight.value = 100;
  assert.match(validateRunShape(crossed).join(';'), /100 event/);
  assert.doesNotThrow(() => initializeRunDerivedStats(run, registries));
});

test('new runs freeze their combat tuning and legacy factory births remain explicitly version one', () => {
  const { run, rng } = fixture();
  assert.equal(run.combatExpansionVersion, 2);
  assert.equal(run.advancedConfigSnapshot.breakMeterVersion, 2);
  const original = run.combatExpansionRules.matchups.counter.incomingMultiplier;
  run.combatExpansionRules.matchups.counter.incomingMultiplier = .75;
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.combatExpansionRules.matchups.counter.incomingMultiplier, .75);
  const fresh = createRunState({ registries, seed: 1, classId: 'herald' });
  assert.equal(fresh.combatExpansionRules.matchups.counter.incomingMultiplier, original);
  const legacy = createRunState({ registries, seed: 1, classId: 'herald', combatExpansionVersion: 1 });
  assert.equal(legacy.ashenBlight, undefined); assert.equal(legacy.combatExpansionRules, undefined);
  assert.equal(legacy.advancedConfigSnapshot.breakMeterVersion, 1);
  const corrupt = structuredClone(run); delete corrupt.combatExpansionRules.statuses.sleep;
  assert.match(validateRunShape(corrupt).join(';'), /statuses.sleep/);
});

test('expanded level and attribute writers preserve Cinder SP penalty and unboosted base maxima', () => {
  const { run } = fixture(), save = manager();
  payAshenBlight({ combatExpansionVersion: 2, draw: () => .5 }, run, { amount: 25, receiptId: 'cinder', combatKey: 'prior' });
  chooseAshenBlightFeat({ combatExpansionVersion: 2 }, run, { threshold: 25, path: 'spell' });
  awardLevelXp(registries, run, xpToNext(registries, 1));
  assert.ok(applyLevelUp(registries, run, 'constitution'));
  assert.equal(run.energyMax, run.maxStamina);
  assert.equal(run.maxStamina, run.ashenBlightBasePools.maxStamina - 1);
  save.saveRun(run, createRng(run.seed));
  const loaded = save.loadRun(registries);
  assert.ok(loaded, save.runStatus().reason);
  const combat = createRunCombat({ registries, run: loaded, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(combat.player.maxStamina, loaded.maxStamina, 'combat entry does not compound Cinder or use a stale level-one base');
});
