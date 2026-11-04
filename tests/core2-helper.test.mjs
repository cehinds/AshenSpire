// The Core 2 test helper (tests/helpers/core2.mjs) hands out a profile-bound registry set and run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { retiredProfileReason } from '../src/model/retiredProfile.js';
import { serializeRun } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, runKey } from '../src/engine/save.js';
import { core2Profile, core2Registries, core2Run } from './helpers/core2.mjs';

test('core2Profile is the configured ashen.core@2.0.0 default profile', () => {
  const profile = core2Profile();
  assert.equal(profile.lock.core, 'ashen.core@2.0.0');
  assert.equal(profile.foundation.mode, 'configured');
  assert.equal(profile.hash, resolveGameProfile('default').hash);
  assert.equal(retiredProfileReason(profile), null);
  assert.equal(core2Profile(), profile, 'resolved once and cached');
});

test('core2Registries carry the Core 2 gameProfile, and overrides replace only the named registry', () => {
  const registries = core2Registries();
  assert.equal(registries.gameProfile.hash, core2Profile().hash);
  const enemies = { ...registries.enemies };
  const overridden = core2Registries({ enemies });
  assert.equal(overridden.enemies, enemies);
  assert.equal(overridden.gameProfile, registries.gameProfile);
  assert.notEqual(core2Registries().enemies, enemies, 'the cached set is untouched');
});

test('core2Run is bound to the profile and round-trips through save and loadRun', () => {
  const registries = core2Registries();
  const run = core2Run({ seed: 7 });
  assert.equal(run.seed, 7);
  assert.equal(run.gameProfile.hash, core2Profile().hash);
  const storage = createMemoryStorage();
  storage.setItem(runKey(1), serializeRun(run));
  const loaded = createSaveManager(storage).loadRun(registries, 1);
  assert.ok(loaded, 'a Core 2 run loads');
  assert.equal(loaded.gameProfile.hash, core2Profile().hash);
  assert.equal(loaded.seed, 7);
  assert.equal(loaded.classId, run.classId);
});
