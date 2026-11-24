// tests/save-transfer-epoch.test.mjs — an exported save from before the current save epoch is refused on import
// (owner, 2026-11-21 hard wipe; review finding on PR #2950). node --test tests/save-transfer-epoch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateSaveTransfer, STALE_EPOCH_CODE } from '../src/engine/saveTransfer.js';
import { EPOCH_STAMP_KEY } from '../src/engine/epochWipe.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { t } from '../src/ui/strings.js';

const registries = createRegistries(contentBundle);
function fixture(epoch) {
  const storage = createMemoryStorage(), saves = createSaveManager(storage);
  saves.loadMeta();
  saves.saveRun(createRunState({ seed: 7, classId: contentBundle.classes[0].id, registries }), null, 1);
  if (epoch) storage.setItem(EPOCH_STAMP_KEY, String(epoch));
  return { storage, transfer: CreateSaveTransfer(storage, registries) };
}

test('an export records the save epoch of the browser that made it', () => {
  const current = uiConfig.presentation.saves.behavior.epoch;
  assert.equal(JSON.parse(fixture(current).transfer.CreateBackup()).epoch, current);
  assert.equal(JSON.parse(fixture().transfer.CreateBackup()).epoch, 1, 'no stamp counts as epoch 1');
});

test('an export from an older epoch, or with no epoch, is refused with a stable code and the live saves stay untouched', () => {
  const current = uiConfig.presentation.saves.behavior.epoch;
  assert.ok(current >= 2, 'the epoch wipe is configured');
  const destination = fixture(current);
  const before = destination.transfer.CreateBackup();
  const legacy = JSON.parse(fixture().transfer.CreateBackup());
  delete legacy.epoch; // an export made before epochs were recorded
  const older = { ...legacy, epoch: current - 1 };
  for (const text of [JSON.stringify(legacy), JSON.stringify(older)]) {
    assert.throws(() => destination.transfer.Inspect(text), error => error.code === STALE_EPOCH_CODE);
    assert.throws(() => destination.transfer.Restore(text), error => error.code === STALE_EPOCH_CODE);
  }
  assert.equal(destination.transfer.CreateBackup(), before);
  assert.equal(destination.transfer.Previous(), null);
});

test('an export from the current epoch still imports', () => {
  const current = uiConfig.presentation.saves.behavior.epoch;
  const exported = fixture(current).transfer.CreateBackup();
  const destination = fixture(current);
  assert.equal(destination.transfer.Restore(exported).ok, true);
});

test('the refusal has a player-facing string', () => {
  assert.match(t('offline.import.staleEpoch'), /before the last save reset/);
});
