// tests/save-epoch-wipe.test.mjs — the one-time HARD save wipe (owner, 2026-11-21; src/engine/epochWipe.js).
// node --test tests/save-epoch-wipe.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStorage, createSaveManager, RUN_KEY, META_KEY, META_BACKUP_KEY, RUN_ARCHIVE_KEY, runKey } from '../src/engine/save.js';
import { ApplyEpochWipe, EPOCH_STAMP_KEY } from '../src/engine/epochWipe.js';
import { BUILD_STAMP_KEY } from '../src/engine/buildWipe.js';
import { uiConfig } from '../src/config/generated/ui.js';

function oldSave() {
  const storage = createMemoryStorage();
  createSaveManager(storage).ensureProfile();
  storage.setItem(RUN_KEY, '{"schemaVersion":1}');
  storage.setItem(runKey(2), '{"schemaVersion":1}');
  storage.setItem(META_BACKUP_KEY, '{"b":1}');
  storage.setItem(RUN_ARCHIVE_KEY, '{"entries":[]}');
  storage.setItem('sote_profile_abc', '{}');
  storage.setItem('sote_profilestamp_abc', '1');
  storage.setItem('sote_transfer_backup_v1', '{}');
  storage.setItem(BUILD_STAMP_KEY, 'old');
  storage.setItem('other.site.key', 'keep');
  return storage;
}
const keysOf = (s) => Array.from({ length: s.length }, (_, i) => s.key(i)).sort();

test('the configured epoch is 2', () => {
  assert.equal(uiConfig.presentation.saves.behavior.epoch, 2);
});

test('an old save (no stamp) is fully discarded, profile included, and stamped', () => {
  const storage = oldSave();
  assert.notEqual(storage.getItem(META_KEY), null);
  const out = ApplyEpochWipe(storage, { epoch: 2 });
  assert.equal(out.cleared, true);
  assert.equal(out.previous, 1);
  assert.deepEqual(keysOf(storage), [EPOCH_STAMP_KEY, 'other.site.key'].sort());
  assert.equal(storage.getItem(EPOCH_STAMP_KEY), '2');
});

test('a second boot at the same epoch changes nothing', () => {
  const storage = oldSave();
  ApplyEpochWipe(storage, { epoch: 2 });
  storage.setItem(RUN_KEY, '{"fresh":1}');
  assert.equal(ApplyEpochWipe(storage, { epoch: 2 }).cleared, false);
  assert.equal(storage.getItem(RUN_KEY), '{"fresh":1}');
});

test('a current-epoch save is untouched', () => {
  const storage = oldSave();
  storage.setItem(EPOCH_STAMP_KEY, '2');
  const before = keysOf(storage);
  assert.equal(ApplyEpochWipe(storage, { epoch: 2 }).cleared, false);
  assert.deepEqual(keysOf(storage), before);
});

test('a fresh browser is stamped with nothing cleared (no notice)', () => {
  const storage = createMemoryStorage();
  const out = ApplyEpochWipe(storage, { epoch: 2 });
  assert.equal(out.cleared, false);
  assert.equal(storage.getItem(EPOCH_STAMP_KEY), '2');
});

test('a higher epoch wipes a lower stamp', () => {
  const storage = oldSave();
  storage.setItem(EPOCH_STAMP_KEY, '2');
  assert.equal(ApplyEpochWipe(storage, { epoch: 3 }).cleared, true);
  assert.equal(storage.getItem(RUN_KEY), null);
});

test('blocked storage (setItem throws) clears nothing', () => {
  const storage = oldSave();
  const before = keysOf(storage);
  storage.setItem = () => { throw new Error('blocked'); };
  assert.equal(ApplyEpochWipe(storage, { epoch: 2 }).cleared, false);
  assert.deepEqual(keysOf(storage), before);
});

test('a stamp that does not read back clears nothing', () => {
  const storage = oldSave();
  const before = keysOf(storage);
  storage.setItem = () => {};
  assert.equal(ApplyEpochWipe(storage, { epoch: 2 }).cleared, false);
  assert.deepEqual(keysOf(storage), before);
});
