// node --test workbench/tests/watch.test.mjs — the watch mode each platform gets,
// and the batches a watcher hands over for folders that appear, go away or are renamed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWatcher, watchModeFor } from '../core/watch.mjs';

test('Linux watches folder by folder; Windows, macOS and others watch recursively', () => {
  assert.equal(watchModeFor('linux'), 'folders');
  assert.equal(watchModeFor('win32'), 'recursive');
  assert.equal(watchModeFor('darwin'), 'recursive');
  assert.equal(watchModeFor('freebsd'), 'recursive');
});

test('a watcher on a recursive platform watches the whole tree with one watch', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/deep'), { recursive: true });
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'darwin', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  assert.equal(w.modes.content, 'watch');
  await new Promise((r) => setTimeout(r, 200));
  await fs.writeFile(path.join(root, 'content/deep/a.json'), '1');
  await waitFor(() => batches.length > 0);
  assert.deepEqual(batches.flat(), ['content/deep/a.json']);
});

async function waitFor(ok, ms = 3000) {
  for (let i = 0; i < ms / 20 && !ok(); i++) await new Promise((r) => setTimeout(r, 20));
}
