// Tests for the pure view helpers of the tag workbench (the marked view block of
// docs/tag-model/workbench.html): filters, changed rows, tag links and keyboard moves.
//
//   node --test docs/tag-model/tools/workbench-view.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readTable } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'workbench.html');
const TABLES_DIR = path.join(HERE, '..', 'tables');
const VIEW_END = '/* view:end */';

// The view block, evaluated alone; returns the helpers the tests call.
function viewHelpers() {
  const html = readFileSync(PAGE, 'utf8');
  const a = html.indexOf('/* view:begin */');
  const b = html.indexOf(VIEW_END);
  if (a < 0 || b < a) throw new Error('view block markers missing in workbench.html');
  const src = html.slice(a, b + VIEW_END.length);
  return vm.runInNewContext(src + '\n;({ containsText, underTag, rowPasses, TAG_STATUS })', {});
}

const { rowPasses, underTag, TAG_STATUS } = viewHelpers();
const NO_TAG_LOOKUP = () => null;

// The real tags.csv as row objects, with a key lookup over both key and id, as findTag does.
function realTags() {
  const { header, rows } = readTable(path.join(TABLES_DIR, 'tags.csv'));
  const objs = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
  const byId = new Map(objs.map((r) => [r.id, r]));
  const byKey = new Map(objs.filter((r) => r.key).map((r) => [r.key, r]));
  const lookup = (k) => byId.get(String(k).trim()) || byKey.get(String(k).trim()) || null;
  return { objs, lookup };
}

const TAG_COLS = ['id', 'key', 'label', 'parent', 'description', 'related', 'status'];
const mk = (over) => Object.assign({ id: '', key: '', label: '', parent: '', description: '', related: '', status: '' }, over);

test('the view block loads and exposes the status vocabulary the tags use', () => {
  assert.deepEqual([...TAG_STATUS], ['live-tag', 'game-concept', 'new']);
});

test('an empty filter spec keeps every row', () => {
  const row = mk({ id: 'a' });
  assert.equal(rowPasses('tags', row, { text: '', cols: {}, status: '', subtree: '', emptyDesc: false }, TAG_COLS, NO_TAG_LOOKUP), true);
});

test('text search matches any column, case-insensitively, and ignores surrounding spaces', () => {
  const row = mk({ id: 'meta.burn', key: 'burn', label: 'Burning Touch', related: 'ignite' });
  const pass = (text) => rowPasses('tags', row, { text, cols: {} }, TAG_COLS, NO_TAG_LOOKUP);
  assert.equal(pass('burning'), true);
  assert.equal(pass('  IGNITE '), true, 'a hit in the related column counts');
  assert.equal(pass('frost'), false);
});

test('per-column filters are a contains match on that column only, and all of them must match', () => {
  const row = mk({ id: 'meta.burn', key: 'burn', label: 'Burning Touch', description: 'deals fire damage' });
  assert.equal(rowPasses('tags', row, { cols: { label: 'touch' } }, TAG_COLS, NO_TAG_LOOKUP), true);
  assert.equal(rowPasses('tags', row, { cols: { label: 'fire' } }, TAG_COLS, NO_TAG_LOOKUP), false, 'fire is in description, not label');
  assert.equal(rowPasses('tags', row, { cols: { label: 'touch', description: 'fire' } }, TAG_COLS, NO_TAG_LOOKUP), true);
  assert.equal(rowPasses('tags', row, { cols: { label: 'touch', key: 'frost' } }, TAG_COLS, NO_TAG_LOOKUP), false);
});

test('tag-only filters do not change the rows of other tables', () => {
  const row = mk({ id: 'x', status: 'new', description: '' });
  const spec = { status: 'live-tag', emptyDesc: true, subtree: 'nowhere' };
  assert.equal(rowPasses('objects', row, spec, ['id', 'status'], NO_TAG_LOOKUP), true);
});

test('status filter keeps only rows with that status', () => {
  const pass = (s) => rowPasses('tags', mk({ id: 'a', status: s }), { status: 'new' }, TAG_COLS, NO_TAG_LOOKUP);
  assert.equal(pass('new'), true);
  assert.equal(pass('live-tag'), false);
  assert.equal(pass(''), false);
});

test('empty description filter keeps rows whose description is blank or only spaces', () => {
  const pass = (d) => rowPasses('tags', mk({ id: 'a', description: d }), { emptyDesc: true }, TAG_COLS, NO_TAG_LOOKUP);
  assert.equal(pass(''), true);
  assert.equal(pass('   '), true);
  assert.equal(pass('Deals damage.'), false);
});

test('parent subtree keeps the root and everything under it, and nothing beside it', () => {
  const tags = [
    mk({ id: 'meta', key: 'meta' }),
    mk({ id: 'meta.character', key: 'character', parent: 'meta' }),
    mk({ id: 'meta.character.warrior', key: 'warrior', parent: 'meta.character' }),
    mk({ id: 'meta.school', key: 'school', parent: 'meta' }),
  ];
  const lookup = (k) => tags.find((r) => r.id === k || r.key === k) || null;
  const spec = { subtree: 'meta.character' };
  const kept = tags.filter((r) => rowPasses('tags', r, spec, TAG_COLS, lookup)).map((r) => r.id);
  assert.deepEqual(kept, ['meta.character', 'meta.character.warrior']);
  // a key works as well as an id
  assert.equal(rowPasses('tags', tags[2], { subtree: 'character' }, TAG_COLS, lookup), true);
});

test('parent subtree: an unknown root shows nothing, and a parent cycle does not hang', () => {
  const a = mk({ id: 'a', parent: 'b' });
  const b = mk({ id: 'b', parent: 'a' });
  const lookup = (k) => [a, b].find((r) => r.id === k) || null;
  assert.equal(underTag(a, b, lookup), true);
  assert.equal(underTag(a, mk({ id: 'z' }), lookup), false);
  assert.equal(rowPasses('tags', a, { subtree: 'nope' }, TAG_COLS, lookup), false);
});

test('the real tags.csv: the status and empty-description counts match the file', () => {
  const { objs, lookup } = realTags();
  const count = (spec) => objs.filter((r) => rowPasses('tags', r, spec, Object.keys(r), lookup)).length;
  for (const s of TAG_STATUS) {
    assert.equal(count({ status: s }), objs.filter((r) => r.status === s).length, 'status ' + s);
  }
  assert.equal(count({ emptyDesc: true }), objs.filter((r) => String(r.description).trim() === '').length);
  // the meta.character subtree is the character node plus its descendants
  const root = lookup('meta.character');
  const expected = objs.filter((r) => r === root || r.id.startsWith('meta.character.')).length;
  assert.equal(count({ subtree: 'meta.character' }), expected);
});
