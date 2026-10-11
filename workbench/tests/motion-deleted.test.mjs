// node --test workbench/tests/motion-deleted.test.mjs — Motion Studio: a pose file deleted on disk
// (its read is a 404) is forgotten: its draft and library entry go, and the open file clears.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isMissingOnDisk, forgetDeletedFile } from '../modules/motion/model.mjs';

const project = { name: 'Slash', poses: [] };
const rec = (path) => ({ path, kind: 'animation', hash: 'h', original: '{}', project, problems: [] });

test('only a 404 from the read counts as a file deleted on disk', () => {
  assert.equal(isMissingOnDisk({ status: 404 }), true);
  assert.equal(isMissingOnDisk({ status: 500 }), false);
  assert.equal(isMissingOnDisk(new Error('network down')), false);
  assert.equal(isMissingOnDisk(null), false);
});

test('a deleted open file clears the file, its draft, its selection and its library entry', () => {
  const path = 'pose-studio/anims/slash.pose.json';
  const other = { path: 'pose-studio/anims/other.pose.json' };
  const next = forgetDeletedFile({
    file: rec(path),
    drafts: new Map([[path, rec(path)], [other.path, rec(other.path)]]),
    sets: new Map([[path, { path }], [other.path, other]]),
    selected: 3,
  }, path);
  assert.equal(next.closed, true);
  assert.equal(next.file, null, 'nothing stays open');
  assert.equal(next.selected, null);
  assert.deepEqual([...next.drafts.keys()], [other.path], 'only the deleted file draft goes');
  assert.deepEqual([...next.sets.keys()], [other.path], 'the file leaves the library list');
});

test('a deleted file that is not open leaves the open file alone', () => {
  const open = rec('pose-studio/anims/other.pose.json');
  const gone = 'pose-studio/anims/slash.pose.json';
  const next = forgetDeletedFile({
    file: open,
    drafts: new Map([[gone, rec(gone)], [open.path, open]]),
    sets: new Map([[gone, { path: gone }], [open.path, { path: open.path }]]),
    selected: 2,
  }, gone);
  assert.equal(next.closed, false);
  assert.equal(next.file, open);
  assert.equal(next.selected, 2);
  assert.deepEqual([...next.drafts.keys()], [open.path]);
  assert.deepEqual([...next.sets.keys()], [open.path]);
});

test('the helper returns new maps and leaves the given ones unchanged', () => {
  const path = 'pose-studio/anims/slash.pose.json';
  const drafts = new Map([[path, rec(path)]]);
  const sets = new Map([[path, { path }]]);
  forgetDeletedFile({ file: rec(path), drafts, sets, selected: null }, path);
  assert.equal(drafts.size, 1);
  assert.equal(sets.size, 1);
});

test('the module forgets a pose file whose read is a 404, and says so once', () => {
  const src = fs.readFileSync(new URL('../modules/motion/index.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(isMissingOnDisk\(err\)\) \{[\s\S]*?forgetDeletedFile\(/, 'openFile hands a 404 to the forget step');
  assert.match(src, /was deleted on disk/, 'the toast names the file');
  assert.match(src, /const gone = changed\.includes\(path\) \? await openFile\(path\) : null;\s*if \(gone === 'deleted'\) return;/, 'Reload does not also report success');
});
