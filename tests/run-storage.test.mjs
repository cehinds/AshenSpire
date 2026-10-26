// tests/run-storage.test.mjs — the run's stored form (model/runStorage.js): a Core run no
// longer writes its ~650 KB pinned profile (once, or again per saved fight) into localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, serializeRun, deserializeRun, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { commitCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';

const profile = resolveGameProfile('core');
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function coreRun(seed = 511) {
  const run = createRunState({ registries: core, seed, classId: 'reaver' });
  const combat = createRunCombat({ registries: core, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
  return { run, combat };
}

test('a Core run at rest and in a fight stores a profile reference, not the profile', () => {
  const { run } = coreRun();
  const json = serializeRun(run);
  const stored = JSON.parse(json);
  assert.equal(stored.gameProfile, undefined);
  assert.deepEqual(stored.gameProfileRef, { id: run.gameProfile.id, hash: run.gameProfile.hash });
  assert.equal(stored.combatEntered.snapshot.gameProfile, undefined, 'the fight does not repeat the run\'s profile');
  assert.ok(json.length < 250000, `Core run with a fight in progress is ${json.length} chars`);
  assert.ok(JSON.stringify(run).length > 1200000, 'the live run still holds the full profile twice');
  assert.equal(stored.schemaVersion, RUN_SCHEMA_VERSION);
});

test('the stored form comes back exactly: profile, snapshot copy and everything else', () => {
  const { run } = coreRun(512);
  const back = deserializeRun(serializeRun(run));
  const was = JSON.parse(JSON.stringify(run));
  delete back.migratedFromRunSchemaVersion;
  assert.deepEqual(JSON.parse(JSON.stringify(back)), was);
  assert.equal(back.combatEntered.snapshot.gameProfile.hash, back.gameProfile.hash);
  assert.notEqual(back.combatEntered.snapshot.gameProfile, back.gameProfile, 'copies, not aliases');
});

test('the real save manager round-trips a Core run through the reference form', () => {
  const { run, combat } = coreRun(513);
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, combat.rng);
  assert.ok(storage.getItem(RUN_KEY).length < 250000);
  const loaded = saves.loadRun(core);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(saves.runStatus().state, 'ok');
  assert.equal(loaded.gameProfile.hash, run.gameProfile.hash);
  assert.equal(saves.peekRunGameProfile().hash, run.gameProfile.hash);
});

test('a save from before the reference form (schema 25, profile inline) still loads and is re-saved compact', () => {
  const { run, combat } = coreRun(514);
  const old = JSON.parse(JSON.stringify(run));
  old.schemaVersion = 25;
  const storage = createMemoryStorage();
  storage.setItem(RUN_KEY, JSON.stringify(old));
  const saves = createSaveManager(storage);
  const loaded = saves.loadRun(core);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(loaded.schemaVersion, RUN_SCHEMA_VERSION);
  saves.saveRun(loaded, combat.rng);
  assert.equal(JSON.parse(storage.getItem(RUN_KEY)).gameProfile, undefined);
});

test('a run pinned by a profile this build does not hold keeps its own full snapshot', () => {
  const { run } = coreRun(515);
  run.gameProfile = { ...JSON.parse(JSON.stringify(run.gameProfile)), hash: 'sha256:' + '0'.repeat(64) };
  const stored = JSON.parse(serializeRun(run));
  assert.ok(stored.gameProfile, 'inline when the catalog cannot rebuild it');
  assert.equal(stored.gameProfileRef, undefined);
});

test('a reference this build cannot resolve is a profile mismatch that keeps the bytes', () => {
  const { run, combat } = coreRun(516);
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, combat.rng);
  const stored = JSON.parse(storage.getItem(RUN_KEY));
  stored.gameProfileRef.hash = 'sha256:' + 'f'.repeat(64);
  const bytes = JSON.stringify(stored);
  storage.setItem(RUN_KEY, bytes);
  assert.equal(saves.loadRun(core), null);
  assert.equal(saves.runStatus().state, 'profile-mismatch');
  assert.match(saves.runStatus().reason, /not part of this build/);
  assert.equal(storage.getItem(RUN_KEY), bytes, 'nothing archived or removed');
});
