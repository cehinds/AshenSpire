// tests/save-wipe.test.mjs — the dev toggle that lets a new build delete old run
// saves (owner, 2026-11-18). node --test tests/save-wipe.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMemoryStorage, createSaveManager, RUN_KEY, META_KEY, runKey } from '../src/engine/save.js';
import { ApplyBuildWipe, BuildSaveId, BUILD_STAMP_KEY } from '../src/engine/buildWipe.js';
import { uiConfig } from '../src/config/generated/ui.js';

function seeded(stamp) {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.ensureProfile();
  saves.saveMeta({ ...saves.loadMeta(), settings: { ...(saves.loadMeta().settings || {}), holdConfirm: true } });
  storage.setItem(RUN_KEY, '{"schemaVersion":1}');
  storage.setItem(runKey(2), '{"schemaVersion":1}');
  if (stamp) storage.setItem(BUILD_STAMP_KEY, stamp);
  return storage;
}

test('ON + different build: run saves cleared, settings kept, stamp rewritten', () => {
  const storage = seeded('0.7.4.1+aaaa');
  const metaBefore = storage.getItem(META_KEY);
  const out = ApplyBuildWipe(storage, { enabled: true, buildId: '0.7.4.2+bbbb' });
  assert.deepEqual([out.cleared, out.slots], [true, 2]);
  assert.equal(storage.getItem(RUN_KEY), null);
  assert.equal(storage.getItem(runKey(2)), null);
  assert.equal(storage.getItem(META_KEY), metaBefore);
  assert.equal(createSaveManager(storage).loadMeta().settings.holdConfirm, true);
  assert.equal(storage.getItem(BUILD_STAMP_KEY), '0.7.4.2+bbbb');
});

test('ON + unstamped saves from before this feature: cleared', () => {
  const storage = seeded(null);
  assert.equal(ApplyBuildWipe(storage, { enabled: true, buildId: 'x' }).cleared, true);
  assert.equal(storage.getItem(RUN_KEY), null);
});

test('ON + same build: saves load untouched', () => {
  const storage = seeded('x');
  assert.equal(ApplyBuildWipe(storage, { enabled: true, buildId: 'x' }).cleared, false);
  assert.notEqual(storage.getItem(RUN_KEY), null);
  assert.notEqual(storage.getItem(runKey(2)), null);
});

test('OFF: nothing deleted, stamp still written', () => {
  const storage = seeded('old');
  assert.equal(ApplyBuildWipe(storage, { enabled: false, buildId: 'new' }).cleared, false);
  assert.notEqual(storage.getItem(RUN_KEY), null);
  assert.equal(storage.getItem(BUILD_STAMP_KEY), 'new');
});

test('ON + no run saves: nothing to clear, no notice', () => {
  const storage = createMemoryStorage();
  assert.equal(ApplyBuildWipe(storage, { enabled: true, buildId: 'x' }).cleared, false);
});

test('BuildSaveId adds the source digest only when stamped', () => {
  assert.equal(BuildSaveId({ version: '0.7.4.165', source: 'UNSTAMPED' }), '0.7.4.165');
  assert.equal(BuildSaveId({ version: '0.7.4.165', source: 'abc' }), '0.7.4.165+abc');
});

test('the toggle is a boolean in content/config and is OFF on release and main builds', () => {
  const file = JSON.parse(readFileSync(new URL('../content/config/ui/presentation/saves.json', import.meta.url), 'utf8'));
  assert.equal(typeof file.behavior.discardOnNewBuild, 'boolean');
  assert.equal(uiConfig.presentation.saves.behavior.discardOnNewBuild, file.behavior.discardOnNewBuild);
  const refs = [process.env.GITHUB_REF_NAME, process.env.GITHUB_BASE_REF].filter(Boolean);
  if (refs.some((r) => r === 'release' || r === 'main')) {
    assert.equal(file.behavior.discardOnNewBuild, false, 'turn saves.json discardOnNewBuild OFF before a public release (DEVELOPER.md, Release checklist)');
  }
});

test('ON + the stamp cannot be written: nothing is wiped this session', () => {
  const storage = seeded('old');
  const failing = { length: storage.length, key: i => storage.key(i), getItem: k => storage.getItem(k), removeItem: k => storage.removeItem(k),
    setItem: () => { throw new Error('QuotaExceededError'); } };
  const out = ApplyBuildWipe(failing, { enabled: true, buildId: 'new' });
  assert.equal(out.cleared, false);
  assert.notEqual(storage.getItem(RUN_KEY), null);
  assert.notEqual(storage.getItem(runKey(2)), null);
});
