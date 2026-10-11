// node --test workbench/tests/layout-deck-row-model.test.mjs — the card row reference from the Deck
// row tool, as Layout Studio's preview: the JSON round trip and refusals the reference always had,
// the geometry that keeps every component in the row, and the canvas round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../modules/layout/deck-row-model.mjs';

const row = R.defaultRow();

test('the reference JSON round-trips, and malformed or unknown input is refused with the reason', () => {
  assert.deepEqual(R.validateRow(JSON.parse(R.rowJson(row))), row);
  assert.throws(() => R.validateRow({ ...row, version: 99 }), /version/);
  assert.throws(() => R.validateRow({ ...row, row: { width: Infinity, height: 86 } }), /width/);
  assert.throws(() => R.validateRow({ ...row, elements: { ...row.elements, script: {} } }), /13/);
  assert.throws(() => R.validateRow({ ...row, elements: { ...row.elements, title: { ...row.elements.title, visible: 'yes' } } }), /visibility/);
  assert.match(R.ROW_NOTE, /Preview only/);
});

test('a drag or resize is kept inside the row and never gets a negative size', () => {
  const r = { width: 520, height: 86 };
  assert.deepEqual(R.clampBox({ x: -5, y: 100, width: 90, height: 40 }, r), { x: 0, y: 46, width: 90, height: 40 });
  assert.deepEqual(R.clampBox({ x: 30, y: 20, width: 900, height: -4 }, r), { x: 0, y: 20, width: 520, height: 8 });
});

test('the canvas round trip keeps an untouched row, and takes a moved box and a hidden one back', () => {
  const doc = R.toCanvasDoc(row);
  assert.equal(doc.width, 520);
  assert.equal(doc.items.length, R.COMPONENTS.length);
  assert.equal(R.fromCanvasDoc(row, doc), row, 'no change means the same object');
  doc.items.find((it) => it.id === 'title').x = 400;
  const moved = R.fromCanvasDoc(row, doc);
  assert.equal(moved.elements.title.x, 520 - row.elements.title.width, 'a move past the edge is clamped inside the row');
  doc.items.find((it) => it.id === 'harness').hidden = false;
  assert.equal(R.fromCanvasDoc(row, doc).elements.harness.visible, true);
});

test('a single value is checked: font sizes clamp, unknown fields and non-numbers are refused', () => {
  assert.equal(R.setField(row, 'title', 'fontSize', 200).elements.title.fontSize, 72);
  assert.equal(R.setField(row, 'title', 'visible', false).elements.title.visible, false);
  assert.throws(() => R.setField(row, 'title', 'fontSize', Number.NaN), /finite/);
  assert.throws(() => R.setField(row, 'title', 'color', 1), /has no color/);
  assert.throws(() => R.setField(row, 'script', 'x', 1), /no component/);
  assert.throws(() => R.setField(row, 'title', 'visible', 1), /true or false/);
});

test('a row resize keeps every component inside it, and the size stays within its limits', () => {
  const small = R.setSize(row, { width: 300, height: 60 });
  assert.deepEqual(small.row, { width: 300, height: 60 });
  for (const id of R.COMPONENTS) {
    const b = small.elements[id];
    assert.ok(b.x >= 0 && b.x + b.width <= 300 && b.y >= 0 && b.y + b.height <= 60, `${id} stays inside`);
  }
  assert.deepEqual(R.setSize(row, { width: 5000, height: 1 }).row, { width: 1600, height: 48 });
});
