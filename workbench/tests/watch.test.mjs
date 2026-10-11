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

test('a folder that appears while watching (Linux) batches the files written into it', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content'), { recursive: true });
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  assert.equal(w.modes.content, 'watch');
  await fs.mkdir(path.join(root, 'content/newdir'));
  await sleep(300);
  await fs.writeFile(path.join(root, 'content/newdir/a.json'), '1');
  await sleep(300);
  await fs.writeFile(path.join(root, 'content/newdir/a.json'), '22');
  await waitFor(() => batches.flat().includes('content/newdir/a.json'));
  assert.ok(batches.flat().includes('content/newdir/a.json'), `a write in the new folder reaches a batch: ${JSON.stringify(batches)}`);
});

test('a folder deleted and recreated while watching (Linux) batches its new files', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/d'), { recursive: true });
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await fs.writeFile(path.join(root, 'content/d/a.json'), '1');
  await sleep(300);
  await fs.rm(path.join(root, 'content/d'), { recursive: true });
  await sleep(300);
  await fs.mkdir(path.join(root, 'content/d'));
  await sleep(300);
  batches.length = 0;
  await fs.writeFile(path.join(root, 'content/d/b.json'), '1');
  await waitFor(() => batches.flat().includes('content/d/b.json'));
  assert.deepEqual(batches.flat(), ['content/d/b.json'], 'the recreated folder is watched again');
});

test('a folder renamed while watching (Linux) batches its later writes under the new name only', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/A'), { recursive: true });
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(200);
  await fs.rename(path.join(root, 'content/A'), path.join(root, 'content/B'));
  await sleep(300);
  batches.length = 0;
  await fs.writeFile(path.join(root, 'content/B/c.json'), '1');
  await waitFor(() => batches.flat().includes('content/B/c.json'));
  await sleep(200);
  const paths = batches.flat();
  assert.ok(paths.includes('content/B/c.json'), `a write under the new name is batched: ${JSON.stringify(batches)}`);
  assert.deepEqual(paths.filter((p) => p.startsWith('content/A/')), [], 'no path under the old name');
});

test('a subfolder moved out of the watched tree (Linux) batches the files that were under it, at any depth', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/d/sub'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/d/a.json'), '1');
  await fs.writeFile(path.join(root, 'content/d/sub/deep.json'), '1');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(200);
  await fs.rename(path.join(root, 'content/d'), path.join(root, '.gone-d'));
  await waitFor(() => batches.flat().includes('content/d/a.json') && batches.flat().includes('content/d/sub/deep.json'));
  assert.ok(batches.flat().includes('content/d/a.json'), `the moved folder's file is in a batch: ${JSON.stringify(batches)}`);
  assert.ok(batches.flat().includes('content/d/sub/deep.json'), `a file in a moved subfolder is in a batch: ${JSON.stringify(batches)}`);
});

test('a subfolder deleted while watching (Linux) batches the files that were under it, at any depth', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/d/sub'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/d/a.json'), '1');
  await fs.writeFile(path.join(root, 'content/d/sub/deep.json'), '1');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(200);
  await fs.rm(path.join(root, 'content/d'), { recursive: true });
  await waitFor(() => batches.flat().includes('content/d/a.json') && batches.flat().includes('content/d/sub/deep.json'));
  assert.ok(batches.flat().includes('content/d/a.json'), `the deleted folder's file is in a batch: ${JSON.stringify(batches)}`);
  assert.ok(batches.flat().includes('content/d/sub/deep.json'), `a file in a deleted subfolder is in a batch: ${JSON.stringify(batches)}`);
});

test('a folder renamed while watching (Linux) batches its old paths and its new ones', async (t) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/A'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/A/x.json'), '1');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'linux', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(200);
  await fs.rename(path.join(root, 'content/A'), path.join(root, 'content/B'));
  await waitFor(() => batches.flat().includes('content/A/x.json') && batches.flat().includes('content/B/x.json'));
  assert.ok(batches.flat().includes('content/A/x.json'), `the old path is in a batch: ${JSON.stringify(batches)}`);
  assert.ok(batches.flat().includes('content/B/x.json'), `the new path is in a batch: ${JSON.stringify(batches)}`);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(ok, ms = 3000) {
  for (let i = 0; i < ms / 20 && !ok(); i++) await sleep(20);
}
