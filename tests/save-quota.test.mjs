import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, isStorageFullError, runKey, RUN_ARCHIVE_KEY, META_KEY, META_BACKUP_KEY } from '../src/engine/save.js';

const registries = createRegistries(contentBundle);

function quotaError() {
  const e = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.");
  e.name = 'QuotaExceededError'; e.code = 22;
  return e;
}

// A localStorage-shaped stub with a character budget; `failRunKeys` makes any run key refuse.
function limitedStorage({ budget = Infinity } = {}) {
  const map = new Map();
  const self = { budget };
  const used = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  Object.assign(self, {
    map,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      const next = used() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + String(v).length;
      if (next > self.budget) throw quotaError();
      map.set(k, String(v));
    },
    removeItem: k => map.delete(k),
    key: i => [...map.keys()][i] ?? null,
    used,
  });
  Object.defineProperty(self, 'length', { get: () => map.size });
  return self;
}

function freshRun(seed = 7) {
  const run = createRunState({ registries, seed, classId: 'herald' });
  return { run, rng: createRng(seed) };
}

test('isStorageFullError knows the quota shapes', () => {
  assert.equal(isStorageFullError(quotaError()), true);
  assert.equal(isStorageFullError(Object.assign(new Error('x'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' })), true);
  assert.equal(isStorageFullError(Object.assign(new Error('x'), { code: 22 })), true);
  assert.equal(isStorageFullError(new Error('other')), false);
  assert.equal(isStorageFullError(null), false);
});

test('a full store with nothing reclaimable still throws and keeps savedAt honest', () => {
  const store = limitedStorage();
  const save = createSaveManager(store);
  const { run, rng } = freshRun();
  save.saveRun(run, rng, 1);
  const stamped = run.savedAt;
  store.setItem = () => { throw quotaError(); };
  assert.throws(() => save.saveRun(run, rng, 1), error => isStorageFullError(error));
  assert.equal(run.savedAt, stamped, 'a lost write does not claim a save');
});

test('quota retry frees salvage index bytes and a stale backup, once, then writes', () => {
  const { run, rng } = freshRun();
  const probe = limitedStorage();
  createSaveManager(probe).saveRun(run, rng, 1);
  const runSize = probe.map.get(runKey(1)).length + runKey(1).length;
  const store = limitedStorage();
  const save = createSaveManager(store);
  save.loadMeta(); save.saveMeta(save.loadMeta());
  const salvageKey = `${RUN_ARCHIVE_KEY}_salvage_123`;
  store.map.set(salvageKey, 'x'.repeat(5000));
  store.map.set(META_BACKUP_KEY, JSON.stringify({ stale: true }) + ' '.repeat(2000));
  store.map.set(`${RUN_ARCHIVE_KEY}_profile_keep`, 'a salvaged PROFILE the player owns');
  store.map.set(runKey(2), 'another slot the player owns');
  // Room for the run only if the ~7000 reclaimable characters are freed first.
  store.budget = store.used() + runSize - 3000;
  save.saveRun(run, rng, 1);
  assert.ok(store.map.has(runKey(1)), 'the run landed after the retry');
  assert.equal(store.map.has(salvageKey), false, 'the index salvage was reclaimed');
  assert.equal(store.map.has(META_BACKUP_KEY), false, 'the stale backup was reclaimed');
  assert.ok(store.map.has(`${RUN_ARCHIVE_KEY}_profile_keep`), 'a salvaged profile is never touched');
  assert.equal(store.map.get(runKey(2)), 'another slot the player owns', 'other save slots are never touched');
  assert.ok(store.map.has(META_KEY), 'the primary profile is untouched');
});

test('a save slot is never deleted to make room', () => {
  const { run, rng } = freshRun();
  const store = limitedStorage({ budget: 600 });
  store.map.set(runKey(2), 'slot two');
  const save = createSaveManager(store);
  assert.throws(() => save.saveRun(run, rng, 1), error => isStorageFullError(error));
  assert.equal(store.map.get(runKey(2)), 'slot two');
});
