// Cleanup 3e PR B: a Core 2 run's frozen configuration holds only its version
// fields and the opening (`gameConfig.prologue.*`) overrides. Legacy mechanics
// settings stored in the profile are not frozen into it, and a save written
// before this change, with extra override keys, still loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { core2Run, core2Registries } from './helpers/core2.mjs';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState, deserializeRun, serializeRun } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { PROLOGUE_PREFIX } from '../src/model/prologue.js';

const PROLOGUE_KEY = `${PROLOGUE_PREFIX}sceneCount`;
const LEGACY = {
  'gameConfig.balance.xp.kill.normal': 99,
  'gameConfig.balance.sigils.attuneMax': 9,
  'gameConfig.handRules.reshuffle': false,
  'gameConfig.combatRounds.preview': true,
  'recovery.hp.afterCombat': 50,
  levelUpValue: 3,
};

test('a Core 2 run created with stored legacy keys freezes only version and prologue fields', () => {
  const run = core2Run({ profileMeta: { settings: { ...LEGACY, [PROLOGUE_KEY]: 2 } } });
  const snapshot = run.advancedConfigSnapshot;
  assert.deepEqual(snapshot.overrides, { [PROLOGUE_KEY]: 2 });
  assert.equal(snapshot.breakMeterVersion, 2);
  for (const field of ['schemaVersion', 'ratingsVersion', 'classMasteryVersion', 'xpCurveVersion']) assert.equal(snapshot[field], 1, field);
});

test('a Core 2 run with only legacy keys stored has empty overrides', () => {
  assert.deepEqual(core2Run({ profileMeta: { settings: LEGACY } }).advancedConfigSnapshot.overrides, {});
});

test('a run with no game profile keeps the legacy snapshot of every stored override', () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: createRegistries(contentBundle), profileMeta: { settings: { ...LEGACY, [PROLOGUE_KEY]: 2 } } });
  assert.equal(run.advancedConfigSnapshot.overrides['gameConfig.balance.xp.kill.normal'], 99);
  assert.equal(run.advancedConfigSnapshot.overrides[PROLOGUE_KEY], 2);
});

test('a Core 2 save carrying extra legacy snapshot keys still loads, and the keys change nothing', () => {
  const registries = core2Registries();
  const run = core2Run();
  const extra = { ...LEGACY };
  delete extra.levelUpValue;
  run.advancedConfigSnapshot = { ...run.advancedConfigSnapshot, overrides: { ...extra, [PROLOGUE_KEY]: 2 } };
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, createRng(run.seed));
  const manager = createSaveManager(storage);
  const loaded = manager.loadRun(registries);
  assert.ok(loaded, JSON.stringify(manager.runStatus()));
  assert.deepEqual(loaded.advancedConfigSnapshot.overrides, { ...extra, [PROLOGUE_KEY]: 2 }, 'extra keys are kept as written, not rejected');
  assert.equal(loaded.advancedConfigSnapshot.breakMeterVersion, 2);
  assert.deepEqual(deserializeRun(serializeRun(core2Run())).advancedConfigSnapshot.overrides, {});
});
