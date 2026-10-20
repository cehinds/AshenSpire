import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = resolveGameProfile('core');
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function checkpoint(registries = core) {
  const run = createRunState({ registries, seed: 511, classId: 'reaver' });
  const combat = createRunCombat({ registries, run, rng: createRng(run.seed), enemyIds: ['wanderingSoldier'] });
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  return { run, combat };
}
function roundTrip(run, combat, registries = core) {
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, combat.rng);
  const loaded = saves.loadRun(registries);
  return { saves, loaded };
}

test('new Core per-hit checkpoints reload through the real save manager', () => {
  const { run, combat } = checkpoint();
  assert.equal(run.reactionRules.contactPolicy, undefined, 'the run owns tuning, not a fight contact policy');
  assert.equal(combat.reactionRules.contactPolicy, 'perHit');
  const { saves, loaded } = roundTrip(run, combat);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(saves.runStatus().state, 'ok');
  assert.equal(loaded.combatEntered.snapshot.reactionRules.contactPolicy, 'perHit');
});

test('a historical Core fight keeps its policy on resume and its next fight saves per-hit', () => {
  const { run, combat } = checkpoint();
  delete run.combatEntered.snapshot.reactionRules.contactPolicy;
  const oldRules = structuredClone(run.combatEntered.snapshot.reactionRules);
  const { saves, loaded } = roundTrip(run, combat);
  assert.ok(loaded, saves.runStatus().reason);
  const resumed = restoreCombatSnapshot({ registries: core, rng: createRng(loaded.seed),
    expectedGameProfile: loaded.gameProfile, snapshot: loaded.combatEntered.snapshot });
  assert.deepEqual(resumed.reactionRules, oldRules, 'restoring never upgrades a historical active fight');
  commitCombatSnapshot({ run: loaded, combat: resumed, nodeId: 'n1_4', encounterId: 'patrol' });
  const historical = roundTrip(loaded, resumed);
  assert.ok(historical.loaded, historical.saves.runStatus().reason);
  const next = createRunCombat({ registries: core, run: historical.loaded, rng: createRng(loaded.seed), enemyIds: ['wanderingSoldier'] });
  assert.equal(next.reactionRules.contactPolicy, 'perHit');
  commitCombatSnapshot({ run: historical.loaded, combat: next, nodeId: 'n1_5', encounterId: 'patrol' });
  const current = roundTrip(historical.loaded, next);
  assert.ok(current.loaded, current.saves.runStatus().reason);
  assert.equal(current.saves.runStatus().state, 'ok');
  assert.equal(current.loaded.combatEntered.snapshot.reactionRules.contactPolicy, 'perHit');
});

test('a Core per-hit terminal outcome survives the durable combat save door', () => {
  const { run, combat } = checkpoint();
  const saves = createSaveManager(createMemoryStorage());
  combat.beforeCombatCommit = candidate => commitExpansionCandidate({ run, candidate,
    nodeId: 'n1_4', encounterId: 'patrol', saveCandidate(next, rng) { saves.saveRun(next, rng); return { ok: true }; } });
  Object.assign(combat.enemies[0], { hp: 1, block: 0, wardBarrier: 0, persistentPoise: { value: 0, max: 0 } });
  combat.piles.hand.push({ instanceId: 'final-strike', cardId: 'core.strike', upgraded: false });
  combat.player.stamina = combat.player.maxStamina;
  primeAccuracyRolls(combat, { count: 3 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'final-strike', targetId: combat.enemies[0].id });
  assert.equal(combat.result, 'victory');
  const loaded = saves.loadRun(core);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(loaded.combatEntered, null);
  assert.equal(loaded.combatPendingOutcome.result, 'victory');
  assert.equal(loaded.combatPendingOutcome.snapshot.reactionRules.contactPolicy, 'perHit');
});

test('Core contact-policy ownership does not admit invalid policy or changed reaction tuning', () => {
  for (const mutate of [
    rules => { rules.contactPolicy = 'allAtOnce'; },
    rules => { rules.stack.maxDepth += 1; },
    rules => { rules.counterstrike.pct = 0.25; },
    rules => { rules.enemyReactions = !rules.enemyReactions; },
  ]) {
    const { run, combat } = checkpoint();
    mutate(run.combatEntered.snapshot.reactionRules);
    const { saves, loaded } = roundTrip(run, combat);
    assert.equal(loaded, null);
    assert.equal(saves.runStatus().state, 'archived');
    assert.match(saves.runStatus().reason, /contact policy|reactionRules must match the run/);
  }
});

test('non-Core checkpoints still require identical run and fight contact policy', () => {
  const legacy = createRegistries(contentBundle);
  const { run, combat } = checkpoint(legacy);
  run.combatEntered.snapshot.reactionRules.contactPolicy = 'perHit';
  const { saves, loaded } = roundTrip(run, combat, legacy);
  assert.equal(loaded, null);
  assert.equal(saves.runStatus().state, 'archived');
  assert.match(saves.runStatus().reason, /reactionRules must match the run/);
});
