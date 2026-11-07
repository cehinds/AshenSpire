// A run saved while LAN co-op existed must still load as a plain solo run
// (owner, 2026-10-31: co-op is removed). The only co-op-only field a saved run
// could carry was the host's `coopLevelCards` receipt map; the loader drops it.
// Map "seats" and item "possession" are NOT co-op and are untouched here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);

test('a saved run with a stray co-op receipt map loads as solo and drops the field', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const run = createRunState({ seed: 0x51a7, classId: 'reaver', registries });
  saves.saveRun(run, createRng(7));
  const stored = JSON.parse(storage.getItem(RUN_KEY));
  const runJson = stored.run ?? stored;
  runJson.coopLevelCards = { 'coop-character:2:1': { key: 'coop-character:2:1', level: 2, cardIds: ['strike'] } };
  storage.setItem(RUN_KEY, JSON.stringify(stored));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, 'the save still loads');
  assert.equal(loaded.coopLevelCards, undefined, 'the co-op receipt map is dropped');
  assert.equal(loaded.class, run.class);
  assert.deepEqual(loaded.seatOrder, run.seatOrder, 'map seats are not co-op and survive');
});

test('a plain solo save is unchanged by the migration', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const run = createRunState({ seed: 0x51a7, classId: 'reaver', registries });
  saves.saveRun(run, createRng(7));
  const loaded = saves.loadRun(registries);
  assert.ok(loaded);
  assert.equal(Object.hasOwn(loaded, 'coopLevelCards'), false);
  assert.equal(loaded.maxHp, run.maxHp);
});
