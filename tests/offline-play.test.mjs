import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveTransfer } from '../src/engine/saveTransfer.js';
import { createSaveManager, createMemoryStorage, META_KEY, RUN_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { releasedDownload } from '../src/model/offlineDownload.js';

const registries = createRegistries(contentBundle);
function fixture(seed = 7) {
  const storage = createMemoryStorage(), saves = createSaveManager(storage);
  const meta = saves.loadMeta(); meta.settings.tooltipDelay = '1s'; saves.saveMeta(meta);
  const run = createRunState({ seed, classId: contentBundle.classes[0].id, registries });
  saves.saveRun(run, null, 2);
  return { storage, transfer: createSaveTransfer(storage, registries) };
}
test('all slots and profile survive transfer; previous data stays recoverable', () => {
  const source = fixture(7), destination = fixture(9);
  const previous = destination.transfer.createBackup(), exported = source.transfer.createBackup();
  assert.equal(source.transfer.inspect(exported).slots.filter(x => x.summary).length, 1);
  assert.equal(destination.transfer.restore(exported).ok, true);
  assert.equal(destination.transfer.createBackup(), exported);
  assert.equal(destination.transfer.previous(), previous);
  assert.equal(createSaveManager(destination.storage).loadMeta().settings.tooltipDelay, '1s');
  assert(createSaveManager(destination.storage).loadRun(registries, 2));
});
test('bad and future files cannot mutate existing saves', () => {
  const { transfer } = fixture(), before = transfer.createBackup();
  for (const text of ['oops', '{}', JSON.stringify({ ...JSON.parse(before), version: 999 })]) assert.throws(() => transfer.restore(text));
  const future = JSON.parse(before); const profile = JSON.parse(future.entries[META_KEY]);
  profile.schemaVersion = META_SCHEMA_VERSION + 1; future.entries[META_KEY] = JSON.stringify(profile);
  assert.throws(() => transfer.restore(JSON.stringify(future)), /Profile cannot/);
  const corrupt = JSON.parse(before); corrupt.entries[RUN_KEY] = '{}';
  assert.throws(() => transfer.restore(JSON.stringify(corrupt)), /Slot 1/);
  assert.equal(transfer.createBackup(), before); assert.equal(transfer.previous(), null);
});
test('storage failure rolls back every touched key and retains recovery copy', () => {
  const target = fixture(9), original = target.transfer.createBackup(); let refused = false;
  const broken = { ...target.storage, setItem(key, value) {
    if (key === `${RUN_KEY}_s2` && !refused) { refused = true; throw new Error('quota'); }
    target.storage.setItem(key, value);
  } };
  const transfer = createSaveTransfer(broken, registries);
  assert.throws(() => transfer.restore(fixture(7).transfer.createBackup()), /quota/);
  assert.equal(transfer.createBackup(), original); assert.equal(transfer.previous(), original);
});
test('backup failure happens before live storage is touched', () => {
  const target = fixture(), before = target.transfer.createBackup();
  const transfer = createSaveTransfer({ ...target.storage, setItem() { throw new Error('full'); } }, registries);
  assert.throws(() => transfer.restore(before), /full/); assert.equal(transfer.createBackup(), before);
});
test('download metadata pins the exact released file and derives version and filename', () => {
  const result = releasedDownload({ branch: 'main', ordinal: 42, version: '0.6.0', bytes: 500 }, 'https://example.org/game/main/latest/build.json');
  assert.deepEqual(result, { version: '0.6.0.42', bytes: 500, filename: 'AshenSpire-0.6.0.42.html', url: 'https://example.org/game/main/42/index.html' });
  assert.throws(() => releasedDownload({ branch: 'dev', ordinal: 42, version: '0.6.0', bytes: 500 }));
  assert.throws(() => releasedDownload({ branch: 'main', ordinal: '../bad', version: '0.6.0', bytes: 500 }));
});
