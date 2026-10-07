import test from 'node:test';
import assert from 'node:assert/strict';
import { mapHeaderLayout } from '../src/ui/models/MapHeaderLayout.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

const at = (viewportWidthPx, viewportHeightPx, extra = {}) => mapHeaderLayout({ viewportWidthPx, viewportHeightPx, ...extra });

test('the header is 10% of the visible height where that clears one touch row', () => {
  assert.equal(at(1280, 800).heightPx, 80);
  assert.equal(at(1440, 860).heightPx, 86);
  assert.equal(at(390, 844).heightPx, 84.4);
  assert.equal(at(375, 667).heightPx, 66.7);
  for (const [w, h] of [[1280, 800], [1440, 860], [390, 844], [375, 667]]) assert.equal(at(w, h).floored, false);
});

test('a short host takes the physical minimum instead: one 44 px row plus its insets', () => {
  const short = at(844, 390);
  assert.equal(short.nominalPx, 39);
  assert.equal(short.minimumPx, 44 + 2 * wireframeUi.map.header.insetPx);
  assert.equal(short.heightPx, short.minimumPx);
  assert.equal(short.floored, true);
});

test('the player tap size raises the floor; a missing one falls back to the configured 44', () => {
  assert.equal(at(844, 390, { targetPx: 56 }).heightPx, 56 + 2 * wireframeUi.map.header.insetPx);
  assert.equal(at(844, 390, { targetPx: Number.NaN }).targetPx, 44);
});

test('wide hosts carry the route in its own column; narrow hosts stack it as a third line', () => {
  assert.deepEqual([at(1280, 800).layout, at(1280, 800).route], ['wide', 'side']);
  assert.deepEqual([at(844, 390).layout, at(844, 390).route], ['wide', 'side']);
  assert.deepEqual([at(390, 844).layout, at(390, 844).route], ['narrow', 'line']);
  assert.deepEqual([at(375, 667).layout, at(375, 667).route], ['narrow', 'line']);
  assert.ok(at(375, 667).lines >= 3);
});

test('a narrow band too short for three lines drops the route line, never the controls', () => {
  const phone = at(320, 480);
  assert.equal(phone.layout, 'narrow');
  assert.ok(phone.lines < 3);
  assert.equal(phone.route, 'hidden');
  assert.ok(phone.heightPx >= phone.targetPx);
});

test('nonsense input still yields a readable band', () => {
  const none = mapHeaderLayout();
  assert.equal(none.heightPx, none.minimumPx);
  assert.equal(none.layout, 'narrow');
  assert.ok(Object.isFrozen(none));
  assert.ok(Object.isFrozen(wireframeUi.map.header));
});
