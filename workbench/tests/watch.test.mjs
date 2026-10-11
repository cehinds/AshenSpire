// node --test workbench/tests/watch.test.mjs — the watch mode each platform gets,
// (the folder-by-folder watches are exercised by the batches tests below).
import test from 'node:test';
import assert from 'node:assert/strict';
import { watchModeFor } from '../core/watch.mjs';

test('Linux watches folder by folder; Windows, macOS and others watch recursively', () => {
  assert.equal(watchModeFor('linux'), 'folders');
  assert.equal(watchModeFor('win32'), 'recursive');
  assert.equal(watchModeFor('darwin'), 'recursive');
  assert.equal(watchModeFor('freebsd'), 'recursive');
});
