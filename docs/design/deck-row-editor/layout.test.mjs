import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultLayout, validateLayout, clampBox, snapBox } from './editor.js';

test('JSON round trip preserves every component and rejects unknown or malformed input', () => {
  const layout = defaultLayout();
  assert.deepEqual(validateLayout(JSON.parse(JSON.stringify(layout))), layout);
  assert.throws(() => validateLayout({ ...layout, version: 99 }), /version/);
  assert.throws(() => validateLayout({ ...layout, row: { width: Infinity, height: 86 } }), /width/);
  assert.throws(() => validateLayout({ ...layout, elements: { ...layout.elements, script: {} } }), /13/);
  assert.throws(() => validateLayout({ ...layout, elements: { ...layout.elements, title: { ...layout.elements.title, visible: 'yes' } } }), /visibility/);
});
test('drag and resize clamp to the row without negative sizes', () => {
  const row = { width: 520, height: 86 };
  assert.deepEqual(clampBox({ x: -5, y: 100, width: 90, height: 40 }, row), { x: 0, y: 46, width: 90, height: 40 });
  assert.deepEqual(clampBox({ x: 30, y: 20, width: 900, height: -4 }, row), { x: 0, y: 20, width: 520, height: 8 });
});
test('snapping finds peer alignment, while disabled snapping preserves precise placement', () => {
  const layout = defaultLayout();
  const moving = { ...layout.elements.description, x: 104, y: 38 };
  const snapped = snapBox(moving, layout, 'description');
  assert.equal(snapped.box.x, 102);
  assert.ok(snapped.guides.some(guide => guide.axis === 'x' && guide.position === 102));
  assert.deepEqual(snapBox(moving, { ...layout, snap: false }, 'description'), { box: moving, guides: [] });
});
