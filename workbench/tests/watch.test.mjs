// node --test workbench/tests/watch.test.mjs — the watch mode each platform gets,
// and the batches a watcher hands over for folders that appear, go away or are renamed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWatcher, watchModeFor, recursiveEventPaths } from '../core/watch.mjs';

// The per-folder mode is what Linux runs. Elsewhere a watched subfolder holds a handle that
// blocks renaming or removing its parent (Windows: EPERM), so those tests run on Linux only.
const LINUX_ONLY = { skip: process.platform !== 'linux' && 'the per-folder watch mode runs on Linux only; on Windows a watched subfolder blocks renaming its parent' };

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
  // Wait for the file itself: an earlier batch may hold only the folder event macOS can report.
  await waitFor(() => batches.flat().includes('content/deep/a.json'));
  // macOS FSEvents may also report the content/deep folder made just before the watch began.
  const seen = batches.flat();
  assert.ok(seen.includes('content/deep/a.json'), `the write is batched: ${seen}`);
  assert.deepEqual(seen.filter((f) => f !== 'content/deep'), ['content/deep/a.json']);
});

test('a folder that appears while watching (Linux) batches the files written into it', LINUX_ONLY, async (t) => {
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

test('a folder deleted and recreated while watching (Linux) batches its new files', LINUX_ONLY, async (t) => {
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

test('a folder renamed while watching (Linux) batches its later writes under the new name only', LINUX_ONLY, async (t) => {
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

test('a subfolder moved out of the watched tree (Linux) batches the files that were under it, at any depth', LINUX_ONLY, async (t) => {
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

test('a subfolder deleted while watching (Linux) batches the files that were under it, at any depth', LINUX_ONLY, async (t) => {
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

test('a folder renamed while watching (Linux) batches its old paths and its new ones', LINUX_ONLY, async (t) => {
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

test('on macOS a new folder names the files under it; a folder already there, and the watched folder\'s self-named event, name nothing', () => {
  const abs = path.join('/p', 'content');
  const config = path.join(abs, 'config');
  const tokens = path.join(config, 'ui/tokens.json');
  const fake = ({ dirs = [], files = [], known = [], under = {} } = {}) => ({
    isDir: (p) => dirs.includes(p), exists: (p) => dirs.includes(p) || files.includes(p),
    isNewFolder: (p) => !known.includes(p), filesUnder: (p) => under[p] || [],
  });
  assert.deepEqual(recursiveEventPaths(abs, 'content', 'darwin', fake()), [], 'the watched folder itself (content/content)');
  assert.deepEqual(recursiveEventPaths(abs, 'config', 'darwin', fake({ dirs: [config], under: { [config]: [tokens] } })), [tokens], 'a folder moved in is reported only as the folder: its files are noted');
  assert.deepEqual(recursiveEventPaths(abs, 'config', 'darwin', fake({ dirs: [config], known: [config], under: { [config]: [tokens] } })), [],
    'a folder already watched names nothing: a save inside it must not reload its siblings, and replayed events must not either');
  assert.deepEqual(recursiveEventPaths(abs, 'config/a.json', 'darwin', fake()), [path.join(abs, 'config/a.json')], 'a file event, even for a file now gone');
  assert.deepEqual(recursiveEventPaths(abs, 'content', 'darwin', fake({ files: [path.join(abs, 'content')] })), [path.join(abs, 'content')], 'a real file named like its folder is kept');
  assert.deepEqual(recursiveEventPaths(abs, 'config', 'win32', fake({ dirs: [config] })), [config], 'Windows keeps the folder event as it is');
  assert.deepEqual(recursiveEventPaths(abs, null, 'darwin', fake()), []);
});

test('on macOS a folder moved into the watched tree after the watch began batches its files', async (t) => {
  if (process.platform !== 'darwin') return t.skip('needs FSEvents (macOS)');
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-out-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content'), { recursive: true });
  await fs.mkdir(path.join(outside, 'ui'), { recursive: true });
  await fs.writeFile(path.join(outside, 'ui/tokens.json'), '{}');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'darwin', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(500);
  await fs.rename(path.join(outside, 'ui'), path.join(root, 'content/ui'));
  await waitFor(() => batches.flat().includes('content/ui/tokens.json'));
  assert.ok(batches.flat().includes('content/ui/tokens.json'), `the moved-in folder's file is batched: ${batches.flat()}`);
});

test('on macOS a folder replaced at a known path batches the new folder\'s files', async (t) => {
  if (process.platform !== 'darwin') return t.skip('needs FSEvents (macOS)');
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-out-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/ui'), { recursive: true });
  await fs.mkdir(path.join(outside, 'ui'), { recursive: true });
  await fs.writeFile(path.join(outside, 'ui/new.json'), '{}');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'darwin', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(500);
  await fs.rm(path.join(root, 'content/ui'), { recursive: true });
  await fs.rename(path.join(outside, 'ui'), path.join(root, 'content/ui'));
  await waitFor(() => batches.flat().includes('content/ui/new.json'));
  assert.ok(batches.flat().includes('content/ui/new.json'), `the replacement folder's file is batched: ${batches.flat()}`);
});

test('on macOS a known folder moved out and back again batches its files', async (t) => {
  if (process.platform !== 'darwin') return t.skip('needs FSEvents (macOS)');
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-test-')));
  const outside = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'watch-out-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content/ui'), { recursive: true });
  await fs.writeFile(path.join(root, 'content/ui/tokens.json'), '{}');
  const batches = [];
  const w = createWatcher({ root, dirs: ['content'], debounceMs: 50, platform: 'darwin', onBatch: (f) => batches.push(f) });
  t.after(() => w.close());
  await sleep(500);
  await fs.rename(path.join(root, 'content/ui'), path.join(outside, 'ui'));
  await sleep(500);
  batches.length = 0;
  await fs.rename(path.join(outside, 'ui'), path.join(root, 'content/ui'));
  await waitFor(() => batches.flat().includes('content/ui/tokens.json'));
  assert.ok(batches.flat().includes('content/ui/tokens.json'), `the returned folder's file is batched: ${batches.flat()}`);
});
