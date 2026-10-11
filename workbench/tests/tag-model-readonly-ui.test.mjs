// node --test workbench/tests/tag-model-readonly-ui.test.mjs — Data Studio's read-only tag-model tables:
// the grid lock comes from the server's summary (derived columns and meta.presentation rows), a generated
// table is read-only, and its toolbar add, duplicate, delete and import, and its Row form, are disabled.
// The Data Studio module is checked at source level; the lock and the summary are checked directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tagModelTable, tagModelSummary } from '../core/tag-model.mjs';
import { tagModelLock } from '../modules/data/model.mjs';
import { lockedCellMap, isLockedCell } from '../ui/kit/grid-model.mjs';

const D = 'docs/tag-model/tables';

test('the summary carries the read-only rows of a mixed table, and none for a presentation table', () => {
  const tags = tagModelSummary(tagModelTable(`${D}/tags.csv`));
  assert.deepEqual(tags.readOnlyRows, { column: 'id', prefix: 'meta.presentation' });
  assert.deepEqual(tags.readOnlyColumns, ['key', 'status', 'liveId']);
  assert.equal(tagModelSummary(tagModelTable(`${D}/presentation/layouts.csv`)).readOnlyRows, null);
  assert.equal(tagModelSummary(tagModelTable(`${D}/tag-tree.csv`)).savable, false, 'a generated table is not savable');
});

test('the grid lock of a tag-model table is its derived columns and rows, and none without a summary', () => {
  const lock = tagModelLock(tagModelSummary(tagModelTable(`${D}/tags.csv`)));
  assert.deepEqual(lock.columns, ['key', 'status', 'liveId']);
  assert.deepEqual(lock.rows, { column: 'id', prefix: 'meta.presentation' });
  assert.deepEqual(tagModelLock(null), {});
});

test('tags.csv: the locked cells of its rows are the derived columns, and a meta.presentation row is greyed whole', () => {
  const columns = ['id', 'key', 'label', 'status', 'liveId'].map((key) => ({ key, label: key, type: 'string' }));
  const rows = [
    { id: 'card.strike', key: 'strike', label: 'Strike', status: 'live', liveId: '7' },
    { id: 'meta.presentation.hud', key: 'hud', label: 'HUD', status: 'meta', liveId: '' },
  ];
  const lock = tagModelLock(tagModelSummary(tagModelTable(`${D}/tags.csv`)));
  const map = lockedCellMap(rows, columns, lock);
  assert.equal(isLockedCell(map, 0, 'key'), true);
  assert.equal(isLockedCell(map, 0, 'liveId'), true);
  assert.equal(isLockedCell(map, 0, 'label'), false, 'a base cell of an ordinary row stays editable');
  assert.equal(isLockedCell(map, 1, 'label'), true, 'a meta.presentation row is greyed in every cell');
});

test('the Data Studio module: a read-only table disables the toolbar add, duplicate, delete and import, and the Row form', () => {
  const src = readFileSync(new URL('../modules/data/index.mjs', import.meta.url), 'utf8');
  assert.match(src, /const ro = tagReadOnly\(\);/);
  assert.match(src, /state\.grid\.setLock\(tagModelLock\(tm\)\); state\.grid\.setReadOnly\(ro\);/);
  assert.match(src, /\.ds-toolbar \[data-act="add"\], \.ds-toolbar \[data-act="dup"\], \.ds-toolbar \[data-act="del"\], \.ds-toolbar \[data-act="import"\]'\)\) b\.disabled = ro;/);
  assert.match(src, /function addRow\(\) \{\s*if \(!needTable\(\) \|\| refusesEdit\(\)\) return;/);
  assert.match(src, /if \(\['add', 'dup', 'del', 'import'\]\.includes\(act\) && refusesEdit\(\)\) return;/);
  assert.match(src, /if \(!file \|\| !needTable\(\) \|\| refusesEdit\(\)\) return;/);
  assert.match(src, /input\.disabled \|\| tagReadOnly\(\)\) return;/);
  assert.match(src, /\$\{off \? ' disabled' : ''\}/);
});
