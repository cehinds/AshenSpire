// node --test workbench/tests/grid-kit.test.mjs — the grid kit's pure model
// (workbench/ui/kit/grid-model.mjs): typed parsing, sort, filter, selection,
// paste, bulk edit, import merge, validation, and undo/redo exactness.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../ui/kit/grid-model.mjs';
import { pasteSummary, pasteNotice, pasteAccepted } from '../ui/kit/grid.mjs';

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

const range = (r0, c0, r1, c1) => ({ r0, c0, r1, c1 });
const selOf = (...ranges) => ({ ranges, anchor: null, active: null });
const docOrder = n => Array.from({ length: n }, (_, i) => i);

test('selection: plain, ctrl, shift, rows, and moves', () => {
  let s = M.createSelection();
  s = M.selectCell(s, { r: 1, c: 1 }, {});
  s = M.selectCell(s, { r: 3, c: 2 }, { shift: true });
  assert.equal(M.selectedCells(s, docOrder(4), cols).cells.length, 3 * 2);
  s = M.selectCell(s, { r: 0, c: 0 }, { ctrl: true });
  assert.equal(s.ranges.length, 2);
  assert.equal(M.selectedCells(s, docOrder(4), cols).cells.length, 7);
  let rowsSel = M.selectRows(M.createSelection(), 2, {}, cols.length);
  assert.equal(M.selectedCells(rowsSel, docOrder(4), cols).cells.length, 5);
  s = M.moveSelection(M.createSelection(), 0, 0, { rowCount: 4, colCount: 5 });
  s = M.moveSelection(s, 9, 9, { rowCount: 4, colCount: 5, extend: true });
  assert.deepEqual(s.active, { r: 3, c: 4 });
  assert.equal(M.selectedCells(s, docOrder(4), cols).cells.length, 20);
});

test('selectedCells: sorted order lists rows in the sorted sequence, not document order', () => {
  const d = base();
  const order = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]); // b, a, d, c
  assert.deepEqual(order, [1, 0, 3, 2]);
  const sel = selOf(range(0, 0, 3, 0)); // column id, every row
  const sc = M.selectedCells(sel, order, d.columns);
  assert.deepEqual(sc.rows, [1, 0, 3, 2]);
  assert.deepEqual(sc.cols, ['id']);
  assert.deepEqual(sc.cells, [[1, 'id'], [0, 'id'], [3, 'id'], [2, 'id']]);
});

test('selectedCells: filtered order never includes a hidden row, even inside the range', () => {
  const d = base();
  const order = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } }); // rows 0 and 3 only
  assert.deepEqual(order, [0, 3]);
  const sc = M.selectedCells(selOf(range(0, 0, 3, 1)), order, d.columns); // rows 0..3 in the range
  assert.deepEqual(sc.rows, [0, 3]);
  assert.deepEqual(sc.cells, [[0, 'id'], [0, 'n'], [3, 'id'], [3, 'n']]);
});

test('selectedCells: multi-range (Ctrl) selections keep every range, in view order, each cell once', () => {
  const order = docOrder(6);
  const sc = M.selectedCells(selOf(range(4, 0, 4, 0), range(0, 1, 1, 2)), order, cols);
  assert.deepEqual(sc.rows, [0, 1, 4], 'the later range comes out in row order, not range order');
  assert.deepEqual(sc.cols, ['id', 'n', 'on'], 'the union of columns, in column order');
  assert.deepEqual(sc.cells, [[0, 'n'], [0, 'on'], [1, 'n'], [1, 'on'], [4, 'id']], 'each cell only from its own range');
});

test('selectedCells: overlapping ranges count each cell once', () => {
  const order = docOrder(4);
  // A covers rows 0-2 x cols 0-1; B covers rows 1-3 x cols 1-2. Union: 2+3+3+2 = 10 cells.
  const sc = M.selectedCells(selOf(range(0, 0, 2, 1), range(1, 1, 3, 2)), order, cols);
  assert.equal(sc.cells.length, 10);
  assert.equal(new Set(sc.cells.map(([r, k]) => `${r}|${k}`)).size, 10, 'no duplicate cells');
  assert.deepEqual(sc.rows, [0, 1, 2, 3]);
  assert.deepEqual(sc.cols, ['id', 'n', 'on']);
});

test('selectedCells: a range over hidden rows only adds no columns and no rows', () => {
  const d = base();
  const order = [0, 3];
  const sc = M.selectedCells(selOf(range(1, 4, 2, 4), range(0, 0, 0, 0)), order, d.columns);
  assert.deepEqual(sc.rows, [0]);
  assert.deepEqual(sc.cols, ['id'], 'the data column of the hidden-row range is not selected');
});

test('copyVisible: TSV follows the sorted view, and skips hidden rows', () => {
  const d = base();
  const order = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]); // b, a, d, c
  const tsv = M.copyVisible(d.rows, d.columns, order, selOf(range(0, 0, 3, 1)));
  assert.equal(tsv, 'b\t10\na\t2\nd\t2\nc\t');
  const filtered = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } }); // a and d
  assert.equal(M.copyVisible(d.rows, d.columns, filtered, selOf(range(0, 0, 3, 0))), 'a\nd');
});

test('copyVisible: a Ctrl selection with mismatched columns uses the column union, blank where no range covers', () => {
  const d = base();
  const order = docOrder(4);
  const text = M.copyVisible(d.rows, d.columns, order, selOf(range(3, 0, 3, 0), range(0, 1, 1, 1)));
  // Rows 0, 1, 3. Columns id and n. Row 0 and 1 have n only, row 3 has id only.
  assert.equal(text, '\t2\n\t10\nd\t');
});

test('copyVisible: overlapping ranges copy each cell once, and quoting survives', () => {
  const rows = [{ id: 'a\tb', n: 1, on: true, tag: 'x', data: null }];
  const d = { columns: cols.map(c => ({ ...c, label: c.key })), rows };
  const text = M.copyVisible(rows, d.columns, [0], selOf(range(0, 0, 0, 1), range(0, 1, 0, 2)));
  assert.equal(text, '"a\tb"\t1\ttrue');
});

test('copyVisible: an empty selection copies nothing', () => {
  const d = base();
  assert.equal(M.copyVisible(d.rows, d.columns, [], selOf(range(0, 0, 3, 0))), '');
});

test('pasteVisible: clipboard rows follow the sorted view from the anchor\'s visible position', () => {
  const d = fresh();
  const order = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]); // b, a, d, c
  const out = M.pasteVisible(d.rows, d.columns, order, { r: 1, c: 0 }, 'x\t5\ny\t6');
  assert.equal(out.rows[1].id, 'x', 'b is the anchor: line 1 lands on the anchor row');
  assert.equal(out.rows[1].n, 5);
  assert.equal(out.rows[0].id, 'y', 'line 2 lands on the next visible row (a), not document row 1');
  assert.equal(out.rows[0].n, 6);
  assert.equal(out.rows[2].id, 'c', 'untouched');
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.overflow, { rows: 0, cols: 0 });
  assertRoundTrip(d, out);
});

test('pasteVisible: a filtered view takes lines only on visible rows, and reports the overflow', () => {
  const d = fresh();
  const order = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } }); // a and d
  const out = M.pasteVisible(d.rows, d.columns, order, { r: 0, c: 0 }, 'p\t1\nq\t2\nr\t3');
  assert.equal(out.rows[0].id, 'p');
  assert.equal(out.rows[3].id, 'q', 'the next visible row is d, the hidden b and c are skipped');
  assert.equal(out.rows[3].n, 2);
  assert.equal(out.rows.length, 4, 'no rows appended in a filtered view');
  assert.equal(out.rows[1], d.rows[1], 'hidden rows are the same objects');
  assert.equal(out.rows[2], d.rows[2]);
  assert.deepEqual(out.overflow, { rows: 1, cols: 0 }, 'the third line did not fit');
  assertRoundTrip(d, out);
});

test('pasteVisible: a sorted view also stops at its last visible row instead of appending', () => {
  const d = fresh();
  const order = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]); // b, a, d, c
  const out = M.pasteVisible(d.rows, d.columns, order, { r: 2, c: 0 }, 'x\t1\ny\t2'); // anchor c, the last row
  assert.equal(out.rows[2].id, 'x');
  assert.equal(out.rows.length, 4);
  assert.deepEqual(out.overflow, { rows: 1, cols: 0 });
});

test('pasteVisible: an unfiltered, unsorted view appends blank rows past the end', () => {
  const d = fresh();
  const order = docOrder(4);
  const out = M.pasteVisible(d.rows, d.columns, order, { r: 3, c: 0 }, Array(6).fill('v\t1').join('\n'));
  assert.equal(out.rows.length, 9, 'row 3 is kept and six lines land on rows 3..8');
  assert.equal(out.rows[4].id, 'v');
  assert.equal(out.rows[8].n, 1);
  assert.equal(out.rows[5].tag, '', 'appended rows start blank');
  assert.deepEqual(out.overflow, { rows: 0, cols: 0 });
  assertRoundTrip(d, out);
});

test('pasteVisible: a one-value paste fills every selected cell in all ranges, in visible rows only', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 1 }, '7', selOf(range(0, 1, 1, 1), range(3, 1, 3, 1)));
  assert.deepEqual(out.rows.map(r => r.n), [7, 7, null, 7]);
  assertRoundTrip(d, out);
  const filtered = M.pasteVisible(d.rows, d.columns, [0, 3], { r: 0, c: 1 }, '7', selOf(range(0, 1, 3, 1)));
  assert.deepEqual(filtered.rows.map(r => r.n), [7, 10, null, 7], 'hidden row b keeps its value');
});

test('pasteVisible: a one-value paste whose selection is all hidden lands at the anchor', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, [0, 3], { r: 0, c: 1 }, '7', selOf(range(1, 1, 2, 1)));
  assert.deepEqual(out.rows.map(r => r.n), [7, 10, null, 2]);
});

test('pasteVisible: atomic. One bad value commits nothing and returns the errors', () => {
  const d = fresh();
  const before = snap(d);
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 0 }, 'ok\t1\nbad\tnope');
  assert.equal(out.change, null);
  assert.deepEqual(out.errors, [{ row: 1, key: 'n', value: 'nope', message: 'Enter a valid number' }]);
  assert.deepEqual(snap({ columns: out.columns, rows: out.rows }), before, 'nothing applied, not even the good cells');
});

test('pasteVisible: a bad value in a one-value fill commits nothing and lists each cell', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 1 }, 'nope', selOf(range(0, 1, 2, 1)));
  assert.equal(out.change, null);
  assert.deepEqual(out.errors.map(e => e.row), [0, 1, 2]);
  assert.deepEqual(snap(out.rows), snap(d.rows));
});

test('pasteVisible: a blank copied cell pastes as a clear, so copy-then-paste round-trips', () => {
  const src = { columns: [{ key: 'a', type: 'number', label: 'a' }, { key: 'b', type: 'number', label: 'b' }], rows: [{ a: 1, b: null }, { a: 2, b: 3 }] };
  const text = M.copyVisible(src.rows, src.columns, [0, 1], selOf(range(0, 0, 1, 1)));
  assert.equal(text, '1\t\n2\t3');
  const target = { columns: src.columns, rows: [{ a: 9, b: 9 }, { a: 9, b: 9 }] };
  const out = M.pasteVisible(target.rows, target.columns, [0, 1], { r: 0, c: 0 }, text);
  assert.notEqual(out.change, null, 'the paste applies');
  assert.deepEqual(out.errors, []);
  assert.deepEqual(snap(out.rows), snap(src.rows), 'the blank cell cleared to null');
  assertRoundTrip(target, out);
});

test('pasteAccepted: text proceeds; empty text proceeds only over a selection; read-only takes nothing', () => {
  const sel = selOf(range(0, 1, 1, 1));
  assert.equal(pasteAccepted('x', null), true, 'non-empty text pastes at the anchor as before');
  assert.equal(pasteAccepted('x', selOf()), true);
  assert.equal(pasteAccepted('', sel), true, 'an empty copied cell over a selection clears it');
  assert.equal(pasteAccepted('', null), false, 'an empty paste with no selection does nothing');
  assert.equal(pasteAccepted('', selOf()), false, 'an empty range list is no selection');
  assert.equal(pasteAccepted('x', sel, true), false, 'a read-only grid takes no paste');
  assert.equal(pasteAccepted('', sel, true), false, 'a read-only grid takes no empty paste either');
});

test('pasteVisible: a blank one-value fill clears the selected cells of every type', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 1 }, '', selOf(range(0, 1, 2, 2), range(0, 4, 2, 4)));
  assert.deepEqual(out.rows.map(r => r.n), [null, null, null, 2], 'number cells clear; row 3 is outside the selection and keeps its value');
  assert.deepEqual(out.rows.map(r => r.on), [null, null, null, true], 'boolean cells clear');
  assert.deepEqual(out.rows.map(r => r.data), [null, null, null, 'str'], 'json cells clear');
  assert.deepEqual(out.errors, []);
  assertRoundTrip(d, out);
});

test('pasteVisible: an empty paste over a filtered selection clears only the visible selected cells', () => {
  const d = fresh();
  assert.ok(d.rows[0].n != null && d.rows[3].n != null, 'the cells start with values');
  // Rows 1 and 2 are hidden by the filter; the selection covers rows 0..3 of the number column.
  const out = M.pasteVisible(d.rows, d.columns, [0, 3], { r: 0, c: 1 }, '', selOf(range(0, 1, 3, 1)));
  assert.equal(out.rows[0].n, null, 'visible selected row 0 clears');
  assert.equal(out.rows[3].n, null, 'visible selected row 3 clears');
  assert.deepEqual(out.rows[1], d.rows[1], 'hidden row 1 is untouched');
  assert.deepEqual(out.rows[2], d.rows[2], 'hidden row 2 is untouched');
  assert.deepEqual(out.errors, []);
});

test('pasteVisible: a blank value does not excuse a non-blank bad value in the same paste', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 0 }, '\t\nx\tnope');
  assert.equal(out.change, null);
  assert.deepEqual(out.errors, [{ row: 1, key: 'n', value: 'nope', message: 'Enter a valid number' }]);
  assert.deepEqual(snap(out.rows), snap(d.rows), 'nothing applied');
});

test('pasteVisible: a hidden active row refuses the paste with a reason instead of landing on row 0', () => {
  const d = { columns: [{ key: 'a', type: 'number', label: 'a' }], rows: [{ a: 1 }, { a: 2 }, { a: 4 }] };
  const out = M.pasteVisible(d.rows, d.columns, [1, 2], { r: 0, c: 0 }, '9', selOf(range(0, 0, 0, 0)));
  assert.equal(out.change, null);
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.rows.map(r => r.a), [1, 2, 4], 'a is unchanged');
  assert.equal(out.reason, 'The active cell is hidden by the filter; select a visible cell and paste again.');
  assert.equal(out.reason, M.HIDDEN_ANCHOR_REASON);
  assert.deepEqual(pasteNotice(out), { title: 'Paste not applied', lines: [M.HIDDEN_ANCHOR_REASON], more: 0 }, 'the banner shows the reason');
  const multi = M.pasteVisible(d.rows, d.columns, [1, 2], { r: 0, c: 0 }, '9\n8');
  assert.equal(multi.change, null, 'a multi-line paste is refused the same way');
  assert.equal(multi.reason, M.HIDDEN_ANCHOR_REASON);
});

test('pasteVisible: columns past the last one are counted as overflow', () => {
  const d = fresh();
  const out = M.pasteVisible(d.rows, d.columns, docOrder(4), { r: 0, c: 0 }, [['a', '1', 'true', 'z', '{"q":1}', '6', '7']]);
  assert.deepEqual(out.overflow, { rows: 0, cols: 2 });
  assert.deepEqual(out.rows[0], { id: 'a', n: 1, on: true, tag: 'z', data: { q: 1 } });
});

test('paste banner text: the first 10 errors, "and N more", and the overflow notes', () => {
  assert.equal(pasteSummary([], { rows: 0, cols: 0 }), null, 'a clean paste shows no banner');
  const errs = Array.from({ length: 12 }, (_, i) => ({ row: i, key: 'n', value: 'x', message: 'Enter a valid number' }));
  const s = pasteSummary(errs);
  assert.equal(s.lines.length, 10);
  assert.equal(s.more, 2, 'and 2 more');
  assert.equal(s.lines[0], 'Row 1, n: Enter a valid number ("x")', 'rows are shown 1-based');
  assert.match(s.title, /12 values/);
  assert.deepEqual(pasteSummary([{ row: 0, key: 'n', value: 'x', message: 'm' }]).more, 0);
  const o = pasteSummary([], { rows: 1, cols: 2 });
  assert.equal(o.lines.length, 2);
  assert.match(o.lines[0], /1 clipboard row did not fit/);
  assert.match(o.lines[1], /2 clipboard columns did not fit/);
  assert.equal(pasteSummary([{ row: 0, key: 'n', value: 'a'.repeat(80), message: 'm' }]).lines[0].length < 120, true, 'long values are cut');
});

test('clear under a filter: hidden rows inside the selection keep their values', () => {
  const d = fresh();
  const order = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } }); // a and d
  const out = M.clearVisible(d, selOf(range(0, 0, 3, 1)), order); // rows 0..3, columns id and n
  assert.deepEqual(out.rows.map(r => r.id), ['', 'b', 'c', '']);
  assert.deepEqual(out.rows.map(r => r.n), [null, 10, null, null]);
  assert.equal(out.rows[1], d.rows[1], 'hidden row b is the same object');
  assert.equal(out.rows[2], d.rows[2], 'hidden row c is the same object');
  assert.equal(out.change.label, 'Clear cells');
  assertRoundTrip(d, out);
});

test('clear over a sorted view with a hidden row inside the span: only visible selected cells clear', () => {
  // c (row 2) is hidden by a filter but sits inside the selected span and holds a value.
  const columns = base().columns;
  const rows = base().rows.map((r, i) => (i === 2 ? { ...r, tag: 'keep' } : r));
  const d = { columns, rows };
  const viewOrder = [3, 1, 0]; // d, b, a: sorted id desc, c hidden
  const out = M.clearVisible(d, selOf(range(0, 3, 3, 3), range(3, 4, 3, 4)), viewOrder);
  assert.deepEqual(out.rows.map(r => r.tag), ['', '', 'keep', ''], 'the hidden c keeps its tag');
  assert.deepEqual(out.rows.map(r => r.data), [{ k: 1 }, [1], null, null], 'd.data cleared, the rest of the data column untouched');
  assert.deepEqual(out.rows.map(r => r.id), ['a', 'b', 'c', 'd'], 'columns outside the selection are untouched');
  assertRoundTrip(d, out);
});

test('delete rows under a filter: only the visible selected rows go, hidden rows stay', () => {
  const d = fresh();
  const order = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } }); // a and d
  const out = M.deleteVisibleRows(d, selOf(range(0, 0, 3, 4)), order); // the whole span, rows 0..3
  assert.deepEqual(out.rows.map(r => r.id), ['b', 'c'], 'a and d are deleted, hidden b and c survive');
  assert.equal(out.change.label, 'Delete rows');
  assertRoundTrip(d, out);
});

test('delete rows in a sorted view removes the selected rows and keeps document order', () => {
  const d = fresh();
  const order = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]); // b, a, d, c
  const out = M.deleteVisibleRows(d, selOf(range(1, 0, 2, 4)), order); // rows 1 and 2 (b, c)
  assert.deepEqual(out.rows.map(r => r.id), ['a', 'd']);
  assertRoundTrip(d, out);
});

test('delete rows with no selected row changes nothing', () => {
  const d = fresh();
  assert.equal(M.deleteVisibleRows(d, M.createSelection(), docOrder(4)).change, null);
  assert.equal(M.deleteVisibleRows(d, selOf(range(1, 0, 1, 4)), [0, 3]).change, null, 'only a hidden row is selected');
});

test('clear with no selected cell changes nothing and records no step', () => {
  const d = fresh();
  assert.equal(M.clearVisible(d, M.createSelection(), docOrder(4)).change, null);
  assert.equal(M.clearVisible(d, selOf(range(1, 0, 1, 0)), [0, 3]).change, null, 'only a hidden row is selected');
});

test('selectedCells: columns are clipped to the column count', () => {
  const sc = M.selectedCells(selOf(range(0, 0, 0, 99)), [0], cols);
  assert.deepEqual(sc.cols, cols.map(c => c.key));
  assert.equal(sc.cells.length, cols.length);
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

test('fill down over a sorted view copies from the visible-first row, not the smallest index', () => {
  const d = base();
  // Sorted by n descending, empties last: b(10), a(2), d(2), c(null).
  const visible = M.sortIndices(d.rows, d.columns, [{ key: 'n', dir: 'desc' }]);
  assert.deepEqual(visible, [1, 0, 3, 2]);
  // a, b and d are selected. The view shows b first, though a (index 0) is the smallest index.
  const selected = visible.filter(r => [0, 1, 3].includes(r));
  assert.deepEqual(selected, [1, 0, 3]);
  const out = M.fillDownVisible(d.rows, d.columns, selected, ['tag']);
  assert.deepEqual(out.rows.map(r => r.tag), ['y', 'y', '', 'y'], 'b.tag (y) fills a and d, not a.tag (x)');
  assert.equal(out.change.label, 'Fill down');
  assertRoundTrip(d, out);
  // The document-order op, from the smallest index, copies x: the visible-order op is the one to use.
  assert.equal(M.fillDown(d, { r0: 0, c0: 3, r1: 3, c1: 3 }).rows[3].tag, 'x');
});

test('fill down over a selection a filter split into two runs copies to every selected row in view order', () => {
  const rows = [
    { id: 'r0', n: 1, on: true, tag: 'x', data: null },
    { id: 'r1', n: 2, on: true, tag: 'x', data: null },
    { id: 'r2', n: 3, on: true, tag: 'z', data: null },
    { id: 'r3', n: 4, on: true, tag: 'z', data: null },
    { id: 'r4', n: 5, on: true, tag: 'x', data: null },
    { id: 'r5', n: 6, on: true, tag: 'x', data: null },
  ];
  const d = { columns: cols.map(c => ({ ...c, label: c.key })), rows };
  // The filter shows tag x only: the visible selection is two document runs with hidden rows between.
  const visible = M.filterIndices(d.rows, d.columns, { byColumn: { tag: 'x' } });
  assert.deepEqual(visible, [0, 1, 4, 5]);
  assert.deepEqual(M.rowRuns(visible), [{ r0: 0, r1: 1 }, { r0: 4, r1: 5 }]);
  const out = M.fillDownVisible(d.rows, d.columns, visible, ['n']);
  // Row 4 takes r0's value, not the start of its own run; r2 and r3 are hidden and untouched.
  assert.deepEqual(out.rows.map(r => r.n), [1, 1, 3, 4, 1, 1]);
  assert.deepEqual(out.rows.map(r => r.tag), rows.map(r => r.tag));
  assertRoundTrip(d, out);
});

test('fill down over fewer than two rows, or over no column, changes nothing and records no step', () => {
  const d = base();
  assert.equal(M.fillDownVisible(d.rows, d.columns, [2], ['n']).change, null);
  assert.equal(M.fillDownVisible(d.rows, d.columns, [0, 1], ['nope']).change, null);
  assert.deepEqual(M.fillDownVisible(d.rows, d.columns, [0, 0, 9], ['n']).rows, d.rows, 'a repeated or out-of-range row is ignored');
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
  assert.deepEqual(M.selectedCells(sel, order, cols).rows.slice().sort((a, b) => a - b), [0, 1, 3, 4, 5], 'the hidden row 2 is not selected');
  // Without an order (the unfiltered case) the range is the document rectangle, as before.
  const plain = M.selectCell(M.selectCell(M.createSelection(), { r: 5, c: 0 }, {}), { r: 0, c: 1 }, { shift: true });
  assert.equal(M.selectedCells(plain, docOrder(6), cols).cells.length, 6 * 2);
  // Ctrl-shift keeps earlier ranges and adds the visible runs.
  let ctrl = M.selectCell(M.createSelection(), { r: 0, c: 0 }, {});
  ctrl = M.selectCell(ctrl, { r: 4, c: 0 }, { ctrl: true });
  ctrl = M.selectCell(ctrl, { r: 3, c: 0 }, { shift: true, ctrl: true, order });
  assert.deepEqual(M.selectedCells(ctrl, order, cols).rows.slice().sort((a, b) => a - b), [0, 3, 4]);
});

test('shift row selection in a filtered view widens every run to whole rows', () => {
  const order = [5, 4, 3, 1, 0]; // row 2 is hidden
  let sel = M.selectRows(M.createSelection(), 4, {}, 5);
  sel = M.selectRows(sel, 1, { shift: true, order }, 5);
  assert.deepEqual(M.selectedCells(sel, order, cols).rows.slice().sort((a, b) => a - b), [1, 3, 4]);
  assert.equal(M.selectedCells(sel, order, cols).cells.length, 3 * 5, 'every cell of each selected row, and no hidden row');
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
  // keys: a compound unique key. Only the same (scope, key) pair repeats; a blank key cell is skipped.
  const scoped = { columns: [{ key: 'classId', type: 'string' }, { key: 'id', type: 'string' }], rows: [
    { classId: 'reaver', id: 'default' }, { classId: 'starseer', id: 'default' },
    { classId: 'reaver', id: 'default' }, { classId: 'reaver', id: '' },
  ] };
  assert.deepEqual(M.validate(scoped, [{ kind: 'unique', keys: ['classId', 'id'] }]),
    [{ row: 2, key: 'id', level: 'error', message: 'Duplicate classId + id "reaver / default"' }]);
  assert.throws(() => M.validate(scoped, [{ kind: 'unique', keys: ['classId', 'nope'] }]), /unknown column "nope"/);
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
