// node --test workbench/tests/review-store.test.mjs — the Visual Review store:
// allowlisted names, plain files only, and accept copies a capture to its baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createReviewStore, reviewDirs } from '../core/review.mjs';

async function store(t) {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-store-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const dirs = reviewDirs(stateDir);
  await fs.mkdir(dirs.captures, { recursive: true });
  return { s: createReviewStore({ stateDir }), dirs };
}

const refused = (p, status = 400) => assert.rejects(p, (e) => e.status === status);

test('list shows only allowlisted capture and baseline names, sorted, with sizes', async (t) => {
  const { s, dirs } = await store(t);
  await fs.writeFile(path.join(dirs.captures, 'desk-title.png'), 'AAAA');
  await fs.writeFile(path.join(dirs.captures, 'phone-map.png'), 'BB');
  await fs.writeFile(path.join(dirs.captures, 'notes.txt'), 'nope');
  const out = await s.list();
  assert.deepEqual(out.captures.map((f) => [f.file, f.size]), [['desk-title.png', 4], ['phone-map.png', 2]]);
  assert.deepEqual(out.baselines, []);
  assert.equal(out.dirs.captures, dirs.captures);
});

test('image serves only allowlisted names, and refuses traversal, unknown sets and links', async (t) => {
  const { s, dirs } = await store(t);
  await fs.writeFile(path.join(dirs.captures, 'desk-title.png'), 'PNGBYTES');
  assert.equal((await s.image('captures', 'desk-title.png')).toString(), 'PNGBYTES');
  await refused(s.image('captures', '../../secret.json'));
  await refused(s.image('captures', 'desk-title.png/../../x.png'));
  await refused(s.image('captures', 'desk-nope.png'));
  await refused(s.image('other', 'desk-title.png'));
  await refused(s.image('captures', '/etc/passwd'));
  await refused(s.image('captures', 'desk-title.png\0'));
  await refused(s.image('baselines', 'desk-title.png'), 404);
  await fs.writeFile(path.join(dirs.captures, 'secret.txt'), 'x');
  await fs.symlink(path.join(dirs.captures, 'secret.txt'), path.join(dirs.captures, 'tablet-title.png'));
  await refused(s.image('captures', 'tablet-title.png'));
});

test('accept copies each named capture over its baseline, and reports the ones with no capture', async (t) => {
  const { s, dirs } = await store(t);
  await fs.writeFile(path.join(dirs.captures, 'desk-title.png'), 'NEW');
  const out = await s.accept([{ device: 'desk', screen: 'title' }, { device: 'phone', screen: 'title' }]);
  assert.deepEqual(out, { accepted: ['desk-title.png'], missing: ['phone-title.png'] });
  assert.equal((await fs.readFile(path.join(dirs.baselines, 'desk-title.png'))).toString(), 'NEW');
  assert.deepEqual((await fs.readdir(dirs.baselines)).sort(), ['desk-title.png']);
  await fs.writeFile(path.join(dirs.captures, 'desk-title.png'), 'NEWER');
  await s.accept([{ device: 'desk', screen: 'title' }]);
  assert.equal((await fs.readFile(path.join(dirs.baselines, 'desk-title.png'))).toString(), 'NEWER');
});

test('accept refuses an empty list, an unknown device or screen, and a path in place of a name', async (t) => {
  const { s } = await store(t);
  await refused(s.accept([]));
  await refused(s.accept(null));
  await refused(s.accept([{ device: 'watch', screen: 'title' }]));
  await refused(s.accept([{ device: 'desk', screen: '../../x' }]));
  await refused(s.accept([{ device: 'desk', screen: 'title', file: '../../x.png' }, { device: '../desk', screen: 'title' }]));
  await refused(s.accept(Array.from({ length: 201 }, () => ({ device: 'desk', screen: 'title' }))));
});

test('accept refuses a linked capture and writes no baseline for it', async (t) => {
  const { s, dirs } = await store(t);
  await fs.writeFile(path.join(dirs.captures, 'outside.txt'), 'x');
  await fs.symlink(path.join(dirs.captures, 'outside.txt'), path.join(dirs.captures, 'desk-title.png'));
  await refused(s.accept([{ device: 'desk', screen: 'title' }]));
  assert.deepEqual(await fs.readdir(dirs.baselines), []);
});
