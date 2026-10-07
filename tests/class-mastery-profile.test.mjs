import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSaveManager, META_KEY, META_BACKUP_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { masteryRowId } from '../src/model/classMastery.js';

const registry = createRegistries(contentBundle);
const legacyRegistry = createRegistries(legacyContentBundle);
function store() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const run = (id, xp, level = 0) => ({ classMasteryState: { version: 1, bankable: true, receiptId: id, earnedXp: { reaver: xp } }, skills: { 'class:reaver': { level } } });

test('v2 migration preserves veteran access without manufacturing any class XP', () => {
  const storage = store();
  const old = { schemaVersion: 2, settings: { volume: 0.3 }, results: [{ victory: true }], progress: { runs: 2000, maxClassLevel: 8, wins: 700 }, unlocked: ['kept'], discoveredArmaments: ['greatsword'] };
  storage.setItem(META_KEY, JSON.stringify(old));
  const saves = createSaveManager(storage);
  const meta = saves.loadMeta();
  assert.equal(meta.schemaVersion, META_SCHEMA_VERSION);
  assert.deepEqual(meta.settings, old.settings);
  assert.equal(meta.progress.runs, 2000);
  assert.equal(meta.progress.maxClassLevel, 0);
  assert.deepEqual(meta.unlocked, old.unlocked);
  assert.deepEqual(meta.discoveredArmaments, old.discoveredArmaments);
  for (const cls of registry.classes.all()) {
    assert.deepEqual(meta.classMastery[cls.id], { xp: 0, level: 0, unlockedRows: legacyRegistry.classMastery.filter(row => row.classId === cls.id).map(masteryRowId) });
  }
  assert.equal(saves.saveMeta(meta).ok, true);
  assert.equal(JSON.parse(storage.getItem(META_KEY)).schemaVersion, 3);
});

test('fresh and unfinished v2 profiles open at zero with all unlock rows locked', () => {
  for (const old of [null, { schemaVersion: 2, results: [], progress: { runs: 0, maxClassLevel: 19 } }]) {
    const storage = store();
    if (old) storage.setItem(META_KEY, JSON.stringify(old));
    const meta = createSaveManager(storage).loadMeta();
    for (const cls of registry.classes.all()) assert.deepEqual(meta.classMastery[cls.id], { xp: 0, level: 0, unlockedRows: [] });
  }
});

test('two slots add XP, retries are idempotent, and deleted slots keep claimed unlocks', () => {
  const storage = store();
  const first = createSaveManager(storage);
  const second = createSaveManager(storage);
  const stale = first.loadMeta();
  stale.progress = { runs: 0, maxClassLevel: 0 };
  first.saveMeta(stale);
  assert.equal(first.bankClassMastery(run('slot-a', 50, 1), registry).ok, true);
  assert.equal(second.bankClassMastery(run('slot-b', 75, 1), registry).ok, true);
  assert.equal(first.bankClassMastery(run('slot-a', 50, 1), registry).changed, false);
  assert.equal(first.bankClassMastery(run('slot-a', 100, 1), registry).ok, true);
  first.clearRun(1);
  stale.settings.volume = 0.6;
  assert.equal(first.saveMeta(stale).ok, true);
  const meta = second.loadMeta();
  assert.equal(meta.classMastery.reaver.xp, 175);
  assert.equal(meta.classMastery.reaver.level, 1);
  assert.equal(meta.progress.maxClassLevel, 1);
  assert.deepEqual(meta.classMastery.reaver.unlockedRows, registry.classMastery.filter(row => row.classId === 'reaver' && row.level === 1).map(masteryRowId));
  assert.deepEqual(meta.classMasteryReceipts, { 'slot-a': { reaver: 100 }, 'slot-b': { reaver: 75 } });
  assert.equal(meta.settings.volume, 0.6);
});

test('a v2 mastery-like payload cannot seed XP or withhold veteran access', () => {
  const storage = store();
  storage.setItem(META_KEY, JSON.stringify({ schemaVersion: 2, progress: { runs: 1 }, classMastery: { reaver: { xp: 900, level: 5, unlockedRows: [] } } }));
  const meta = createSaveManager(storage).loadMeta();
  assert.equal(meta.classMastery.reaver.xp, 0);
  assert.equal(meta.classMastery.reaver.level, 0);
  assert.equal(meta.classMastery.reaver.unlockedRows.length, legacyRegistry.classMastery.filter(row => row.classId === 'reaver').length);
});

test('reserved receipt keys are refused without prototype mutation', () => {
  const saves = createSaveManager(store());
  for (const id of ['__proto__', 'constructor', 'prototype']) assert.equal(saves.bankClassMastery(run(id, 50, 1), registry).ok, false);
  assert.equal(Object.prototype.reaver, undefined);
  assert.equal(saves.loadMeta().classMastery.reaver.xp, 0);
});

test('a committed primary remains successful when its backup rotation throws', () => {
  const storage = store();
  const saves = createSaveManager(storage);
  saves.saveMeta(saves.loadMeta());
  const write = storage.setItem;
  storage.setItem = (key, value) => { if (key === META_BACKUP_KEY) throw new Error('quota'); write(key, value); };
  const result = saves.bankClassMastery(run('backup-quota', 50, 1), registry);
  assert.equal(result.ok, true);
  assert.match(result.warning, /backup could not rotate/);
  assert.equal(result.meta.classMastery.reaver.xp, 50);
  assert.equal(saves.bankClassMastery(run('backup-quota', 50, 1), registry).changed, false);
  assert.equal(saves.loadMeta().classMastery.reaver.xp, 50);
});

test('a failed write pays nothing and a later retry credits the full delta', () => {
  const storage = store();
  const saves = createSaveManager(storage);
  saves.saveMeta(saves.loadMeta());
  const good = storage.getItem(META_KEY);
  const write = storage.setItem;
  storage.setItem = (key, value) => { if (key !== META_KEY) write(key, value); };
  assert.equal(saves.bankClassMastery(run('retry', 50, 1), registry).ok, false);
  assert.equal(storage.getItem(META_KEY), good);
  assert.equal(storage.getItem(META_BACKUP_KEY), good);
  storage.setItem = write;
  assert.equal(saves.bankClassMastery(run('retry', 50, 1), registry).ok, true);
  assert.equal(saves.loadMeta().classMastery.reaver.xp, 50);
});

test('nonbanking scenes, unearned levels, malformed profiles and future schemas stay protected', () => {
  const storage = store();
  const saves = createSaveManager(storage);
  const scene = run('scene', 50, 1);
  scene.classMasteryState.bankable = false;
  assert.equal(saves.bankClassMastery(scene, registry).changed, false);
  assert.equal(saves.bankClassMastery(run('unearned', 1, 2), registry).ok, false);
  assert.equal(saves.loadMeta().classMastery.reaver.xp, 0);
  const bad = saves.loadMeta();
  bad.classMastery.reaver.xp = -1;
  assert.equal(saves.saveMeta(bad).ok, false);
  const newer = JSON.stringify({ schemaVersion: 9, precious: true });
  storage.setItem(META_KEY, newer);
  assert.equal(saves.bankClassMastery(run('future', 50, 1), registry).ok, false);
  assert.equal(storage.getItem(META_KEY), newer);
});

test('two thousand receipts survive mirror recovery and cannot pay again', () => {
  const storage = store();
  const saves = createSaveManager(storage);
  for (let index = 0; index < 2000; index++) {
    const result = saves.bankClassMastery(run(`finished-${index}`, 10), registry);
    assert.equal(result.ok, true);
  }
  const canonical = saves.loadMeta();
  assert.equal(canonical.classMastery.reaver.xp, 20000);
  assert.equal(Object.keys(canonical.classMasteryReceipts).length, 2000);
  storage.setItem(META_KEY, storage.getItem(META_KEY).slice(0, -8));
  const recovered = createSaveManager(storage);
  assert.deepEqual(recovered.loadMeta().classMasteryReceipts, canonical.classMasteryReceipts);
  assert.equal(recovered.bankClassMastery(run('finished-0', 10), registry).changed, false);
  assert.equal(recovered.loadMeta().classMastery.reaver.xp, 20000);
});

test('inherited object method names are durable ordinary receipt IDs', () => {
  const storage = store();
  const saves = createSaveManager(storage);
  for (const id of ['toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(saves.bankClassMastery(run(id, 50, 1), registry).ok, true);
    assert.equal(Object.hasOwn(saves.loadMeta().classMasteryReceipts, id), true);
  }
  assert.equal(Object.prototype.toString.reaver, undefined);
  assert.equal(createSaveManager(storage).bankClassMastery(run('toString', 50, 1), registry).changed, false);
  assert.equal(saves.loadMeta().classMastery.reaver.xp, 150);
});
