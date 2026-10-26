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
import { createSaveManager, createMemoryStorage, inlineRunJson, RUN_KEY, runKey, profileCopyKey, PROFILE_COPY_PREFIX } from '../src/engine/save.js';

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

test('a reference with no catalog entry and no shared copy is a profile mismatch that keeps the bytes', () => {
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
  assert.match(saves.runStatus().reason, /neither in this build nor kept on this device/);
  assert.equal(storage.getItem(RUN_KEY), bytes, 'nothing archived or removed');
});

test('saving keeps ONE shared copy of the profile, written before the slot names it', () => {
  const { run, combat } = coreRun(517);
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, combat.rng, 1);
  saves.saveRun(run, combat.rng, 2);
  const copies = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(k => k.startsWith(PROFILE_COPY_PREFIX));
  assert.deepEqual(copies, [profileCopyKey(run.gameProfile.hash)]);
  assert.equal(JSON.parse(storage.getItem(copies[0])).hash, run.gameProfile.hash);
  assert.ok(storage.getItem(RUN_KEY).length < 250000 && storage.getItem(runKey(2)).length < 250000);
});

// BUILD N -> BUILD N+1. A content edit changes the profile's hash while the runtime hash (which gates
// saves) stays, so the catalog's profile for the id is no longer the one the run pinned. 'ashen.core@1.0.0'
// is a real second profile with the same id 'core' and another hash: the run pins it, the catalog says
// 'core' is something else, and the run must still resume from the shared copy with its own rules.
test('a run pinned to a profile the catalog no longer holds resumes from the shared copy', () => {
  const old = resolveGameProfile('ashen.core@1.0.0');
  assert.equal(old.id, profile.id);
  assert.notEqual(old.hash, profile.hash);
  const oldRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, old)), old);
  const run = createRunState({ registries: oldRegistries, seed: 520, classId: 'reaver' });
  // The bytes build N wrote: a reference to its own hash, plus its shared copy.
  const storage = createMemoryStorage();
  const stored = JSON.parse(JSON.stringify(run));
  delete stored.gameProfile;
  stored.gameProfileRef = { id: old.id, hash: old.hash };
  stored.schemaVersion = RUN_SCHEMA_VERSION;
  storage.setItem(RUN_KEY, JSON.stringify(stored));
  storage.setItem(profileCopyKey(old.hash), JSON.stringify(old));
  const saves = createSaveManager(storage);
  assert.equal(saves.peekRunGameProfile().hash, old.hash);
  const loaded = saves.loadRun(oldRegistries);
  assert.ok(loaded, saves.runStatus().reason);
  assert.equal(loaded.gameProfile.hash, old.hash, 'pinned rules, not the catalog\'s');
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.gameProfile)), JSON.parse(JSON.stringify(old)));
  // Without the copy the same bytes are refused and kept, never guessed.
  storage.removeItem(profileCopyKey(old.hash));
  assert.equal(saves.loadRun(oldRegistries), null);
  assert.equal(saves.runStatus().state, 'profile-mismatch');
});

test('shared copies are collected only when no slot or archived run names them', () => {
  const { run, combat } = coreRun(518);
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, combat.rng, 1);
  saves.saveRun(run, combat.rng, 2);
  storage.setItem('sote_unrelated', 'keep me');
  storage.setItem(profileCopyKey('sha256:orphan'), '{"hash":"sha256:orphan"}');
  const key = profileCopyKey(run.gameProfile.hash);
  saves.clearRun(1);
  assert.ok(storage.getItem(key), 'slot 2 still names it');
  assert.equal(storage.getItem(profileCopyKey('sha256:orphan')), null, 'an unreferenced copy is collected');
  assert.equal(storage.getItem('sote_unrelated'), 'keep me', 'keys the game does not own are never touched');
  saves.clearRun(2);
  assert.equal(storage.getItem(key), null, 'last reference gone: collected');
});

test('an archived run keeps its profile copy alive', () => {
  const { run, combat } = coreRun(519);
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, combat.rng, 1);
  storage.setItem(RUN_KEY, JSON.stringify({ ...JSON.parse(storage.getItem(RUN_KEY)), seatOrder: ['no-such-seat'] })); // refused: loadRun archives it
  assert.equal(saves.loadRun(core), null);
  assert.equal(storage.getItem(RUN_KEY), null, 'the slot was archived');
  assert.ok(storage.getItem(profileCopyKey(run.gameProfile.hash)), 'the archive entry still names it');
});

test('anything that leaves the device carries the profile inline', () => {
  const { run, combat } = coreRun(521);
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, combat.rng);
  const out = JSON.parse(inlineRunJson(storage.getItem(RUN_KEY), storage));
  assert.equal(out.gameProfileRef, undefined);
  assert.equal(out.gameProfile.hash, run.gameProfile.hash);
  assert.equal(out.combatEntered.snapshot.gameProfile.hash, run.gameProfile.hash);
});
