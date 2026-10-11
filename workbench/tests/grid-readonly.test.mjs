// node --test workbench/tests/grid-readonly.test.mjs — the read-only parts of the data grid: the
// locked-cell map (derived columns and meta.presentation rows), the rule that refuses a change that
// touches them, and a read-only grid's every change path (apply, add, delete, import, paste, fill,
// clear, undo). The DOM grid is checked at source level; its rules are the pure ones tested here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../ui/kit/grid-model.mjs';

const columns = [
  { key: 'id', label: 'id', type: 'string' },
  { key: 'key', label: 'key', type: 'string' },
  { key: 'label', label: 'label', type: 'string' },
  { key: 'status', label: 'status', type: 'string' },
];
const LOCK = { columns: ['key', 'status'], rows: { column: 'id', prefix: 'meta.presentation' } };
const rows = () => [
  { id: 'card.strike', key: 'strike', label: 'Strike', status: 'live' },
  { id: 'meta.presentation.hud', key: 'hud', label: 'HUD', status: 'meta' },
  { id: 'card.block', key: 'block', label: 'Block', status: 'live' },
];

test('the locked-cell map: derived columns locked in every row, a meta.presentation row locked whole', () => {
  const map = M.lockedCellMap(rows(), columns, LOCK);
  assert.equal(M.isLockedCell(map, 0, 'key'), true, 'a derived column in an ordinary row');
  assert.equal(M.isLockedCell(map, 0, 'status'), true);
  assert.equal(M.isLockedCell(map, 0, 'label'), false, 'a base column in an ordinary row is editable');
  assert.equal(M.isLockedCell(map, 1, 'id'), true, 'every cell of a meta.presentation row is locked');
  assert.equal(M.isLockedCell(map, 1, 'label'), true);
  assert.equal(map.size, 8, 'two derived cells in row 0, all four in row 1, two in row 2');
});

test('the locked-cell map is empty for a table with no lock', () => {
  assert.equal(M.lockedCellMap(rows(), columns, {}).size, 0);
  assert.equal(M.lockedCellMap(rows(), columns).size, 0);
});

test('a changed base cell touches nothing locked; a changed derived cell does', () => {
  const before = rows();
  const after = before.map((r, i) => (i === 0 ? { ...r, label: 'Strike+' } : r));
  assert.equal(M.touchesLocked(before, after, columns, LOCK), false);
  const bad = before.map((r, i) => (i === 0 ? { ...r, status: 'dead' } : r));
  assert.equal(M.touchesLocked(before, bad, columns, LOCK), true);
});

test('a change to a meta.presentation row touches a locked row, whichever cell it changes', () => {
  const before = rows();
  const after = before.map((r, i) => (i === 1 ? { ...r, label: 'HUD 2' } : r));
  assert.equal(M.touchesLocked(before, after, columns, LOCK), true);
});

test('a deleted meta.presentation row touches a locked row; a deleted ordinary row does not', () => {
  const before = rows();
  assert.equal(M.touchesLocked(before, before.filter((_, i) => i !== 1), columns, LOCK), true);
  assert.equal(M.touchesLocked(before, before.filter((_, i) => i !== 0), columns, LOCK), false);
});

test('a new meta.presentation row is refused; a new ordinary row with empty derived cells is allowed', () => {
  const before = rows();
  const meta = { id: 'meta.presentation.new', key: '', label: '', status: '' };
  assert.equal(M.touchesLocked(before, [...before, meta], columns, LOCK), true);
  const fresh = { id: 'card.new', key: '', label: 'New', status: '' };
  assert.equal(M.touchesLocked(before, [...before, fresh], columns, LOCK), false);
});

test('mutationAllowed: a read-only grid refuses every change, whichever path made it', () => {
  const before = rows();
  const edit = before.map((r, i) => (i === 0 ? { ...r, label: 'x' } : r));
  assert.deepEqual(M.mutationAllowed({ readOnly: true, before, after: edit, columns, lock: LOCK }), { ok: false, reason: 'This table is read-only.' });
  assert.deepEqual(M.mutationAllowed({ readOnly: true, before, after: before.slice(1), columns, lock: LOCK }).ok, false, 'delete');
  assert.deepEqual(M.mutationAllowed({ readOnly: true, before, after: [...before, { id: 'card.new' }], columns, lock: LOCK }).ok, false, 'add');
  assert.equal(M.mutationAllowed({ readOnly: false, before, after: edit, columns, lock: LOCK }).ok, true);
});

test('mutationAllowed: an editable grid refuses a change that touches a locked cell, with the derived reason', () => {
  const before = rows();
  const bad = before.map((r, i) => (i === 2 ? { ...r, key: 'changed' } : r));
  assert.deepEqual(M.mutationAllowed({ readOnly: false, before, after: bad, columns, lock: LOCK }), { ok: false, reason: 'Derived by build.mjs: those cells cannot be changed here.' });
});

test('setCells on a locked cell is a change the rule refuses, and setCells on a base cell is not', () => {
  const doc = { columns, rows: rows() };
  const onKey = M.setCells(doc, [{ r: 0, c: 1 }], 'zzz');
  assert.equal(M.touchesLocked(doc.rows, onKey.rows, columns, LOCK), true);
  const onLabel = M.setCells(doc, [{ r: 0, c: 2 }], 'zzz');
  assert.equal(M.touchesLocked(doc.rows, onLabel.rows, columns, LOCK), false);
});

test('a paste or a fill that reaches a locked cell is refused as a whole', () => {
  const doc = { columns, rows: rows() };
  const pasted = M.pasteVisible(doc.rows, doc.columns, [0, 1, 2], { r: 0, c: 2 }, 'a\tb\nc\td', M.createSelection());
  // Paste lands on label and status (column 3, a locked column): the change touches it.
  assert.equal(M.touchesLocked(doc.rows, pasted.rows, columns, LOCK), true);
});

test('the grid source: every bulk path is refused by a read-only grid, and undo is never recorded there', () => {
  const src = readFileSync(new URL('../ui/kit/grid.mjs', import.meta.url), 'utf8');
  assert.match(src, /addRow: \(index\) => \(readOnly \? false : commit\(/);
  assert.match(src, /deleteRows: \(indices\) => \(readOnly \? false : commit\(/);
  assert.match(src, /importText: \(text, opts\) => \(readOnly \? false : commit\(/);
  assert.match(src, /apply: \(res\) => \(readOnly \? false : commit\(res\)\)/);
  assert.match(src, /if \(track && res\.change && !readOnly\) \{ history\.undo\.push/);
  assert.match(src, /function step\(direction\) \{\s*if \(readOnly\) return;/);
  assert.match(src, /undo: \(\) => step\('undo'\)/);
  assert.match(src, /\$\('\.gk-undo'\)\.disabled = readOnly \|\|/);
});

test('the grid source: a locked cell is drawn greyed with the derived tooltip, and cannot start an edit', () => {
  const src = readFileSync(new URL('../ui/kit/grid.mjs', import.meta.url), 'utf8');
  assert.match(src, /if \(locked\) cls\.push\('gk-locked'\)/);
  assert.match(src, /locked \? M\.LOCKED_NOTE : ''/);
  assert.match(src, /if \(M\.isLockedCell\(lockedMap, r, doc\.columns\[c\]\.key\)\) return;/);
  assert.equal(M.LOCKED_NOTE, 'Derived by build.mjs');
});
