import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager } from '../src/engine/save.js';
import { withLegacyDefaults } from './legacyHitRules.mjs';

function fixture() {
  const profile = resolveGameProfile('ashen.core@2.0.0');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, seed: 6, classId: 'reaver' });
  const rng = createRng(run.seed);
  // The prediction save needs an unknown read, which only a fight that still rolls perception (saved before the 2026-11-14 ruling) can have.
  const combat = withLegacyDefaults(() => createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'] }));
  return { run, rng, combat, registries };
}

function checkpoint(run, combat, saveCandidate) {
  return commitExpansionCandidate({ run, candidate: combat, nodeId: 'n1_4', encounterId: 'patrol', saveCandidate });
}

test('Core 2 battle-local knowledge survives the real entry checkpoint and explicit prediction save', () => {
  const { run, rng, combat, registries } = fixture();
  const entries = new Map();
  const saves = createSaveManager({ getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) });
  assert.equal(run.enemyKnowledgeRules, undefined);
  assert.equal(run.enemyKnowledgeState, undefined);
  assert.deepEqual(run.skills, {}, 'configured runs keep legacy progression disabled');
  assert.equal(combat.enemyKnowledge.bankable, false);
  assert.equal(combat.enemyKnowledge.encounter, null);
  assert.equal(combat.enemies[0].knowledgeAction.reads.player.visibility, 'unknown');
  checkpoint(run, combat, (next, committedRng) => saves.saveRun(next, committedRng));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, saves.runStatus().reason);
  assert.deepEqual(validateRunShape(loaded), []);
  assert.deepEqual(deserializeRun(serializeRun(loaded)), loaded);

  const restore = saved => {
    const restoredRng = createRng(saved.seed, saved.streamCounters);
    const before = restoredRng.getCounters();
    const restored = restoreCombatSnapshot({ registries, rng: restoredRng,
      snapshot: saved.combatEntered.snapshot, expectedGameProfile: saved.gameProfile });
    assert.deepEqual(restored.enemyKnowledge, saved.combatEntered.snapshot.enemyKnowledge);
    assert.deepEqual(restored.enemies.map(enemy => enemy.knowledgeAction), saved.combatEntered.snapshot.enemies.map(enemy => enemy.knowledgeAction));
    assert.deepEqual(restoredRng.getCounters(), before, 'restore never rerolls cached reads');
    return restored;
  };
  const restored = restore(loaded);
  const enemy = restored.enemies[0];
  dispatch(restored, { type: 'predictIntent', enemyInstanceId: enemy.id,
    actionSerial: enemy.knowledgeAction.serial, maneuver: enemy.knowledgeAction.category });
  commitCombatSnapshot({ run: loaded, combat: restored, nodeId: 'n1_4', encounterId: 'patrol' });
  saves.saveRun(loaded, restored.rng);
  const predictionSave = saves.loadRun(registries);
  assert.ok(predictionSave, saves.runStatus().reason);
  const resumed = restore(predictionSave);
  assert.equal(resumed.enemies[0].knowledgeAction.reads.player.prediction, enemy.knowledgeAction.category);
  assert.deepEqual(predictionSave.skills, {});
  assert.equal(predictionSave.enemyKnowledgeState, undefined, 'battle-local knowledge never opens a run learning ledger');
  assert.deepEqual(resumed.rng.getCounters(), rng.getCounters());
  assert.equal(resumed.rng.float('enemyIntentVisibility'), rng.float('enemyIntentVisibility'));
  assert.equal(resumed.rng.float('enemyIntentClue'), rng.float('enemyIntentClue'));
});

