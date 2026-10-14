import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserSaveManager } from '../src/engine/browserSave.js';
import { createSaveManager, createMemoryStorage, META_KEY, META_BACKUP_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { emptyEnemyKnowledge } from '../src/model/enemyKnowledgeProfile.js';
const receipt = (id, bonus = false) => ({ version: 1, enemies: { wanderingSoldier: { target: 30, receipts: { [id]: { bonus } } } } });
const run = id => ({ enemyKnowledgeState: { bankable: true, pending: receipt(id), recoveryTargets: {} } });

test('real browser facade serializes every profile writer and merges independent settings with learning', async () => {
  const storage = createMemoryStorage(), observations = [];
  let depth = 0;
  const guarded = { ...storage, setItem(key, value) {
    if ([META_KEY, META_BACKUP_KEY].includes(key)) assert.equal(depth, 1, 'profile write must be owned');
    storage.setItem(key, value);
  } };
  const locks = { async request(name, operation) {
    observations.push(name); depth++;
    try { return await operation(); } finally { depth--; }
  } };
  const a = createBrowserSaveManager(guarded, { locks }), b = createBrowserSaveManager(guarded, { locks });
  await Promise.all([a.ready, b.ready]);
  assert.equal(storage.getItem(META_KEY), null, 'boot alone does not create a profile');
  await a.ensureProfile();
  const first = a.loadMeta(), second = b.loadMeta();
  const one = run('encounter-one'), two = run('encounter-two');
  await Promise.all([a.bankEnemyKnowledge(one), b.bankEnemyKnowledge(two),
    a.saveMeta({ ...first, found: ['first-find'], settings: { ...first.settings, volume: 20 } }),
    b.saveMeta({ ...second, found: ['second-find'], settings: { ...second.settings, uiScale: 1.2 } })]);
  const durable = a.loadMeta();
  assert.equal(durable.schemaVersion, META_SCHEMA_VERSION);
  assert.deepEqual(durable.settings, { volume: 20, uiScale: 1.2 });
  assert.deepEqual(durable.found, ['first-find', 'second-find']);
  assert.deepEqual(Object.keys(durable.enemyKnowledge.enemies.wanderingSoldier.receipts).sort(), ['encounter-one', 'encounter-two']);
  assert.deepEqual(one.enemyKnowledgeState.pending, emptyEnemyKnowledge());
  assert.deepEqual(two.enemyKnowledgeState.pending, emptyEnemyKnowledge());
  assert.equal(new Set(observations).size, 1);
});

test('real profile repair retains old bonuses and trusted targets after an adopted state changes during the lock wait', async () => {
  const storage = createMemoryStorage();
  const raw = createSaveManager(storage); raw.ensureProfile();
  raw.saveMeta({ ...raw.loadMeta(), enemyKnowledge: receipt('old-bonus', true) });
  let corrupt = true, waiting, release;
  const entered = new Promise(resolve => { waiting = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const locks = { async request(name, operation) { if (corrupt) { waiting(); await gate; } return operation(); } };
  const lossy = { ...storage, setItem(key, value) {
    if (corrupt && key === META_KEY) {
      const data = JSON.parse(value); data.enemyKnowledge.enemies.wanderingSoldier.target = 20;
      delete data.enemyKnowledge.enemies.wanderingSoldier.receipts['old-bonus'];
      storage.setItem(key, JSON.stringify(data)); throw new Error('partial write');
    }
    storage.setItem(key, value);
  } };
  const saves = createBrowserSaveManager(lossy, { locks });
  release(); await saves.ready;
  // Only the bank waits; initialization has completed without a write.
  const pause = new Promise(resolve => { release = resolve; });
  const bankEntered = new Promise(resolve => { waiting = resolve; });
  locks.request = async (name, operation) => { waiting(); await pause; return operation(); };
  const live = run('first-action');
  const bank = saves.bankEnemyKnowledge(live);
  await bankEntered;
  live.enemyKnowledgeState = structuredClone(live.enemyKnowledgeState);
  live.enemyKnowledgeState.pending.enemies.wanderingSoldier.receipts['later-action'] = { bonus: true };
  release();
  assert.equal((await bank).ok, false);
  const pending = live.enemyKnowledgeState.pending.enemies.wanderingSoldier;
  assert.equal(pending.receipts['old-bonus'].bonus, true);
  assert.equal(pending.receipts['later-action'].bonus, true);
  assert.equal(live.enemyKnowledgeState.recoveryTargets.wanderingSoldier, 30);
  corrupt = false;
  assert.equal((await saves.bankEnemyKnowledge(live)).ok, true);
  const durable = saves.loadMeta().enemyKnowledge.enemies.wanderingSoldier;
  assert.equal(durable.target, 30);
  assert.equal(durable.receipts['old-bonus'].bonus, true);
  assert.equal(durable.receipts['later-action'].bonus, true);
});

test('profile schema three migrates without altering existing mastery; unreadable knowledge is quarantined', async () => {
  const storage = createMemoryStorage(), raw = createSaveManager(storage);
  raw.ensureProfile();
  const older = raw.loadMeta(); older.schemaVersion = 3; delete older.enemyKnowledge;
  older.settings.volume = 12;
  storage.setItem(META_KEY, JSON.stringify(older));
  const saves = createBrowserSaveManager(storage);
  await saves.ready;
  const migrated = saves.loadMeta();
  assert.deepEqual(migrated.classMastery, older.classMastery);
  assert.deepEqual(migrated.enemyKnowledge, emptyEnemyKnowledge());
  await saves.saveMeta(migrated);
  const damaged = JSON.parse(storage.getItem(META_KEY)); damaged.enemyKnowledge = { version: 1, enemies: { bad: { target: 100, receipts: {} } } };
  const bytes = JSON.stringify(damaged); storage.setItem(META_KEY, bytes); storage.removeItem(META_BACKUP_KEY);
  saves.loadMeta();
  assert.equal(saves.profileStatus().quarantined, true);
  assert.equal((await saves.saveMeta(migrated)).ok, false);
  assert.equal(storage.getItem(META_KEY), bytes);
});
