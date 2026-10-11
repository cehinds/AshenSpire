// node --test workbench/tests/grid-kit.test.mjs — the grid kit's pure model
// (workbench/ui/kit/grid-model.mjs): typed parsing, sort, filter, selection,
// paste, bulk edit, import merge, validation, and undo/redo exactness.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../ui/kit/grid-model.mjs';

const cols = [
  { key: 'id', type: 'string' },
  { key: 'n', type: 'number' },
  { key: 'on', type: 'boolean' },
  { key: 'tag', type: 'ref' },
  { key: 'data', type: 'json' },
];
const base = () => ({
  columns: cols.map(c => ({ ...c, label: c.key })),
  rows: [
    { id: 'a', n: 2, on: true, tag: 'x', data: { k: 1 } },
    { id: 'b', n: 10, on: false, tag: 'y', data: [1] },
    { id: 'c', n: null, on: null, tag: '', data: null },
    { id: 'd', n: 2, on: true, tag: 'x', data: 'str' },
  ],
});
const snap = d => JSON.parse(JSON.stringify(d));

// Every mutation must (1) leave its input untouched, (2) undo to the exact
// input, (3) redo to the exact output.
function assertRoundTrip(doc, out) {
  assert.deepEqual(snap(doc), snapBefore(doc), 'input was mutated');
  const undone = M.applyChange(out.change, 'undo');
  assert.deepEqual(snap(undone), snap({ columns: doc.columns, rows: doc.rows }), 'undo is not exact');
  const redone = M.applyChange(out.change, 'redo');
  assert.deepEqual(snap(redone), snap({ columns: out.columns, rows: out.rows }), 'redo is not exact');
  assert.equal(typeof out.change.label, 'string');
}
const memo = new WeakMap();
function snapBefore(doc) { if (!memo.has(doc)) memo.set(doc, snap(doc)); return memo.get(doc); }
function fresh() { const d = base(); snapBefore(d); return d; }

test('typed parse and format per column type', () => {
  assert.equal(M.parseValue('abc', 'string'), 'abc');
  assert.equal(M.parseValue('3.5', 'number'), 3.5);
  assert.throws(() => M.parseValue('', 'number'), /valid number/);
  assert.throws(() => M.parseValue('nan', 'number'), /valid number/);
  assert.equal(M.parseValue('true', 'boolean'), true);
  assert.equal(M.parseValue(' FALSE ', 'boolean'), false);
  assert.throws(() => M.parseValue('yes', 'boolean'), /true or false/);
  assert.deepEqual(M.parseValue('{"a":[1]}', 'json'), { a: [1] });
  assert.throws(() => M.parseValue('{bad', 'json'), /valid JSON/);
  assert.equal(M.parseValue('x y', 'formula'), 'x y');
  assert.equal(M.formatValue(null, 'number'), '');
  assert.equal(M.formatValue({ a: 1 }, 'json'), '{"a":1}');
  assert.equal(M.formatValue(false, 'boolean'), 'false');
  assert.equal(M.checkValue('oops', 'number'), 'Not a number');
  assert.equal(M.checkValue(null, 'number'), null);
});

test('multi-key sort is stable, empties last, and does not reorder rows', () => {
  const d = fresh();
  const asc = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'asc' }, { key: 'id', dir: 'desc' }]);
  assert.deepEqual(asc.map(i => d.rows[i].id), ['d', 'a', 'b', 'c']);
  const desc = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]);
  assert.equal(d.rows[desc.at(-1)].id, 'c', 'empty stays last in desc');
  assert.deepEqual(d.rows.map(r => r.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(M.sortIndices(d.rows, d.columns), [0, 1, 2, 3]);
});

test('filter by text across the row and per column', () => {
  const d = fresh();
  assert.deepEqual(M.filterIndices(d.rows, d.columns, { text: 'X' }), [0, 3]);
  assert.deepEqual(M.filterIndices(d.rows, d.columns, { text: 'x true' }), [0, 3]);
  assert.deepEqual(M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'y' } }), [1]);
  assert.deepEqual(M.filterIndices(d.rows, d.columns, { text: '  ' }), [0, 1, 2, 3]);
});

test('selection: plain, ctrl, shift, rows, and moves', () => {
  let s = M.createSelection();
  s = M.selectCell(s, { r: 1, c: 1 }, {});
  s = M.selectCell(s, { r: 3, c: 2 }, { shift: true });
  assert.equal(M.selectedCells(s, 4, 5).length, 3 * 2);
  s = M.selectCell(s, { r: 0, c: 0 }, { ctrl: true });
  assert.equal(s.ranges.length, 2);
  assert.equal(M.selectedCells(s, 4, 5).length, 7);
  let rowsSel = M.selectRows(M.createSelection(), 2, {}, cols.length);
  assert.deepEqual(M.selectedCells(rowsSel, 4, 5).length, 5);
  s = M.moveSelection(M.createSelection(), 0, 0, { rowCount: 4, colCount: 5 });
  s = M.moveSelection(s, 9, 9, { rowCount: 4, colCount: 5, extend: true });
  assert.deepEqual(s.active, { r: 3, c: 4 });
  assert.equal(M.selectedCells(s, 4, 5).length, 20);
});

test('parse clipboard text as TSV or CSV, with quotes and trailing newline', () => {
  assert.deepEqual(M.parseClipboard('a\tb\r\nc\td\r\n'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(M.parseClipboard('a,"x,""y"""\n1,2'), [['a', 'x,"y"'], ['1', '2']]);
  assert.deepEqual(M.parseClipboard('"multi\nline"\tz'), [['multi\nline', 'z']]);
  assert.throws(() => M.parseClipboard('"open'), /Unclosed/);
});

test('range paste expands rows and skips bad cells without losing the rest', () => {
  const d = fresh();
  const out = M.pasteRange(d, { r: 3, c: 0 }, 'e\t7\ttrue\tz\t{"q":1}\nf\t8\tfalse\tz\t[]\nbad\tnope\ttrue\tz\t1');
  assert.equal(out.rows.length, 6);
  assert.deepEqual(out.rows[3], { id: 'e', n: 7, on: true, tag: 'z', data: { q: 1 } });
  assert.equal(out.rows[4].id, 'f');
  assert.equal(out.rows[4].n, 8);
  assert.deepEqual(out.errors, [{ row: 5, key: 'n', message: 'Enter a valid number' }]);
  assert.equal(out.rows[5].id, 'bad');
  assertRoundTrip(d, out);
});

test('single value paste fills the selected rectangle', () => {
  const d = fresh();
  const out = M.pasteRange(d, { r: 0, c: 1 }, '5', { fill: { r0: 0, c0: 1, r1: 2, c1: 1 } });
  assert.deepEqual(out.rows.map(r => r.n), [5, 5, 5, 2]);
  assertRoundTrip(d, out);
});

test('bulk edit parses per column and rejects bad values with no change', () => {
  const d = fresh();
  const cells = [{ r: 0, c: 1 }, { r: 1, c: 1 }];
  const out = M.bulkEdit(d, cells, '42');
  assert.deepEqual(out.rows.map(r => r.n), [42, 42, null, 2]);
  assertRoundTrip(d, out);
  assert.throws(() => M.bulkEdit(d, [{ r: 0, c: 2 }], 'maybe'), /true or false/);
  assert.deepEqual(snap(d), snapBefore(d));
});

test('clear, fill down, add, delete, duplicate rows: exact undo/redo', () => {
  const d = fresh();
  assertRoundTrip(d, M.clearCells(d, [{ r: 0, c: 0 }, { r: 0, c: 1 }]));
  assert.deepEqual(M.clearCells(d, [{ r: 0, c: 0 }, { r: 0, c: 1 }]).rows[0], { id: '', n: null, on: true, tag: 'x', data: { k: 1 } });
  const fd = M.fillDown(d, { r0: 0, c0: 3, r1: 2, c1: 3 });
  assert.deepEqual(fd.rows.map(r => r.tag), ['x', 'x', 'x', 'x']);
  assertRoundTrip(d, fd);
  assertRoundTrip(d, M.addRow(d, 1, { id: 'new' }));
  const added = M.addRow(d, 1, { id: 'new' });
  assert.equal(added.rows[1].id, 'new');
  assert.equal(added.rows[1].on, null);
  assertRoundTrip(d, M.deleteRows(d, [0, 2]));
  assert.deepEqual(M.deleteRows(d, [0, 2]).rows.map(r => r.id), ['b', 'd']);
  const dup = M.duplicateRows(d, [1]);
  assert.deepEqual(dup.rows.map(r => r.id), ['a', 'b', 'b', 'c', 'd']);
  assert.notEqual(dup.rows[1], dup.rows[2]);
  assertRoundTrip(d, dup);
});

test('add, rename, delete column: exact undo/redo and data follows the key', () => {
  const d = fresh();
  const added = M.addColumn(d, { key: 'extra', type: 'number' });
  assert.equal(added.columns.at(-1).key, 'extra');
  assert.equal(added.rows[0].extra, null);
  assertRoundTrip(d, added);
  assert.throws(() => M.addColumn(d, { key: 'id' }), /already exists/);
  const renamed = M.renameColumn(d, 'n', 'count');
  assert.equal(renamed.rows[1].count, 10);
  assert.equal('n' in renamed.rows[1], false);
  assertRoundTrip(d, renamed);
  assert.throws(() => M.renameColumn(d, 'n', 'id'), /already exists/);
  const del = M.deleteColumn(d, 'data');
  assert.equal(del.columns.some(c => c.key === 'data'), false);
  assert.equal('data' in del.rows[0], false);
  assertRoundTrip(d, del);
});

test('merge-by-key import updates matches, appends new rows, adds columns', () => {
  const d = fresh();
  const out = M.importRows(d, 'id,n,note\nb,11,hi\nz,3,new\n', { format: 'csv', mode: 'merge', key: 'id' });
  assert.equal(out.rows.length, 5);
  assert.deepEqual(out.rows[1], { id: 'b', n: 11, on: false, tag: 'y', data: [1], note: 'hi' });
  assert.equal(out.rows[4].id, 'z');
  assert.equal(out.rows[4].tag, '');
  assert.equal(out.columns.at(-1).key, 'note');
  assertRoundTrip(d, out);
  assert.throws(() => M.importRows(d, 'id,n\nb,nope', { key: 'id', mode: 'merge' }), /valid number/);
  assert.deepEqual(snap(d), snapBefore(d));
});

test('replace import and JSON import with typed inference', () => {
  const d = fresh();
  const rep = M.importRows(d, 'id\nq', { mode: 'replace' });
  assert.deepEqual(rep.rows, [{ id: 'q', n: null, on: null, tag: '', data: null }]);
  assertRoundTrip(d, rep);
  const js = M.importRows(d, '[{"id":"a","score":3},{"id":"b","score":1.5}]', { mode: 'merge', key: 'id' });
  assert.equal(js.columns.find(c => c.key === 'score').type, 'number');
  assert.equal(js.rows[0].score, 3);
  assertRoundTrip(d, js);
});

test('JSON import with a __proto__ key: the row keeps Object.prototype and no inherited id', () => {
  const d = fresh();
  const out = M.importRows(d, '[{"__proto__":{"id":"x"},"name":"a"}]', { mode: 'replace' });
  const row = out.rows[0];
  assert.equal(Object.getPrototypeOf(row), Object.prototype);
  assert.equal(row.id, '', 'id is the column empty value, not an inherited "x"');
  assert.equal(row.name, 'a');
  assert.deepEqual(Object.getOwnPropertyDescriptor(row, '__proto__').value, { id: 'x' }, 'kept as data');
  assertRoundTrip(d, out);
});

test('visible span and row runs: a filtered-out row inside the span is not part of it', () => {
  // Six rows; a filter hides row 2, and a sort puts the rest in this visible order.
  const order = [5, 4, 3, 1, 0];
  assert.deepEqual(M.visibleSpan(order, 5, 0), [5, 4, 3, 1, 0], 'hidden row 2 is skipped');
  assert.deepEqual(M.visibleSpan(order, 4, 1), [4, 3, 1]);
  assert.deepEqual(M.visibleSpan(order, 1, 4), [4, 3, 1], 'direction does not matter');
  assert.deepEqual(M.visibleSpan(order, 2, 0), [0], 'a hidden anchor leaves only the target');
  assert.deepEqual(M.rowRuns([4, 3, 1]), [{ r0: 1, r1: 1 }, { r0: 3, r1: 4 }]);
  assert.deepEqual(M.rowRuns([3, 3, 2]), [{ r0: 2, r1: 3 }], 'duplicates merge');
  assert.deepEqual(M.rowRuns([]), []);
});

test('shift selection in a filtered, sorted view selects only the visible rows', () => {
  const order = [5, 4, 3, 1, 0]; // row 2 is hidden by a filter
  let sel = M.selectCell(M.createSelection(), { r: 5, c: 0 }, {});
  sel = M.selectCell(sel, { r: 0, c: 1 }, { shift: true, order });
  assert.deepEqual([...new Set(M.selectedCells(sel, 6, 5).map(c => c.r))].sort(), [0, 1, 3, 4, 5], 'the hidden row 2 is not selected');
  // Without an order (the unfiltered case) the range is the document rectangle, as before.
  const plain = M.selectCell(M.selectCell(M.createSelection(), { r: 5, c: 0 }, {}), { r: 0, c: 1 }, { shift: true });
  assert.equal(M.selectedCells(plain, 6, 5).length, 6 * 2);
  // Ctrl-shift keeps earlier ranges and adds the visible runs.
  let ctrl = M.selectCell(M.createSelection(), { r: 0, c: 0 }, {});
  ctrl = M.selectCell(ctrl, { r: 4, c: 0 }, { ctrl: true });
  ctrl = M.selectCell(ctrl, { r: 3, c: 0 }, { shift: true, ctrl: true, order });
  assert.deepEqual([...new Set(M.selectedCells(ctrl, 6, 5).map(c => c.r))].sort(), [0, 3, 4]);
});

test('shift row selection in a filtered view widens every run to whole rows', () => {
  const order = [5, 4, 3, 1, 0]; // row 2 is hidden
  let sel = M.selectRows(M.createSelection(), 4, {}, 5);
  sel = M.selectRows(sel, 1, { shift: true, order }, 5);
  assert.deepEqual([...new Set(M.selectedCells(sel, 6, 5).map(c => c.r))].sort(), [1, 3, 4]);
  assert.equal(M.selectedCells(sel, 6, 5).length, 3 * 5, 'every cell of each selected row, and no hidden row');
});

test('JSON import checks values against the column types and changes nothing on a bad value', () => {
  const d = fresh();
  const before = snap(d);
  assert.throws(() => M.importRows(d, '[{"id":"a","n":"oops"}]', { mode: 'merge', key: 'id' }), /Row 1, n: Not a number/);
  assert.throws(() => M.importRows(d, '[{"id":"a","n":1},{"id":"b","on":"yes"}]', { mode: 'merge', key: 'id' }), /Row 2, on: Not true or false/, 'all-or-nothing');
  assert.deepEqual(snap(d), before, 'the document is untouched');
  const ok = M.importRows(d, '[{"id":"a","n":7,"on":null}]', { mode: 'merge', key: 'id' });
  assert.equal(ok.rows[0].n, 7);
  assert.equal(ok.rows[0].on, null, 'null fits any type');
  assertRoundTrip(d, ok);
});

test('resize a column: one undoable change, clamped to the minimum width', () => {
  const d = fresh();
  const out = M.resizeColumn(d, 'n', 200.4);
  assert.equal(out.columns.find(c => c.key === 'n').width, 200);
  assert.equal(out.columns.find(c => c.key === 'id').width, undefined, 'other columns are untouched');
  assert.equal(out.rows, d.rows, 'rows are shared, not copied');
  assert.equal(out.change.label, 'Resize column');
  assertRoundTrip(d, out);
  assert.equal(M.resizeColumn(d, 'n', 3).columns.find(c => c.key === 'n').width, M.MIN_COLUMN_WIDTH, 'clamped');
  assert.throws(() => M.resizeColumn(d, 'nope', 100), /No column "nope"/);
  assert.throws(() => M.resizeColumn(d, 'n', NaN), /must be a number/);
});

test('export to CSV, TSV and JSON', () => {
  const d = fresh();
  assert.equal(M.toCSV(d).split('\n')[0], 'id,n,on,tag,data');
  assert.ok(M.toCSV(d).includes('a,2,true,x,"{""k"":1}"'));
  assert.ok(M.toTSV(d).startsWith('id\tn\ton\ttag\tdata\n'));
  assert.equal(JSON.parse(M.toJSON(d)).length, 4);
});

test('validation: required, unique, type, ref, custom, with row and key', () => {
  const d = fresh();
  const issues = M.validate(d, [
    { kind: 'required', key: 'n' },
    { kind: 'unique', key: 'id' },
    { kind: 'unique', key: 'tag', level: 'warning' },
    { kind: 'type', key: 'n' },
    { kind: 'ref', key: 'tag', ids: ['x'] },
    { kind: 'custom', fn: row => (row.id === 'b' ? 'bad b' : null) },
  ]);
  const has = (row, key, msg) => issues.some(i => i.row === row && i.key === key && i.message === msg);
  assert.ok(has(2, 'n', 'n is required'));
  assert.ok(issues.some(i => i.row === 1 && i.key === 'tag' && i.message === 'Unknown: y'));
  assert.ok(issues.some(i => i.row === 3 && i.key === 'tag' && i.level === 'warning'));
  assert.ok(issues.some(i => i.row === 1 && i.key === null && i.message === 'bad b'));
  const dupe = M.validate({ columns: [{ key: 'id', type: 'string' }], rows: [{ id: 'a' }, { id: 'a' }] }, [{ kind: 'unique', key: 'id' }]);
  assert.deepEqual(dupe, [{ row: 1, key: 'id', level: 'error', message: 'Duplicate id "a"' }]);
  const typed = M.validate({ columns: [{ key: 'n', type: 'number' }], rows: [{ n: 'x' }] }, [{ kind: 'type', key: 'n' }]);
  assert.equal(typed[0].message, 'Not a number');
});

test('ref rule resolves another table through options.refs and multi lists', () => {
  const doc = { columns: [{ key: 'uses', type: 'string' }], rows: [{ uses: 'a b' }, { uses: 'a q' }] };
  const issues = M.validate(doc, [{ kind: 'ref', key: 'uses', table: 'tags', multi: true }], { refs: { tags: new Set(['a', 'b']) } });
  assert.deepEqual(issues.map(i => [i.row, i.message]), [[1, 'Unknown: q']]);
});

test('20k-row sort on two keys finishes under 200 ms', () => {
  const columns = [{ key: 'name', type: 'string' }, { key: 'n', type: 'number' }];
  const rows = Array.from({ length: 20000 }, (_, i) => ({ name: `item ${(i * 7919) % 20000}`, n: (i * 31) % 997 }));
  const t0 = performance.now();
  const order = M.sortIndices(rows, columns, [{ key: 'n', dir: 'desc' }, { key: 'name', dir: 'asc' }]);
  const ms = performance.now() - t0;
  assert.equal(order.length, 20000);
  assert.ok(ms < 200, `sort took ${ms.toFixed(1)} ms`);
});
