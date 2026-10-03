import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../src/ui/fx.js';

test('window dragging converts viewport and offset-parent coordinates at the effective zoom', () => {
  for (const zoom of [0.75, 1, 1.5, 2]) {
    const parent = { left: 30, top: 60 };
    const origin = anchorLocalBox(parent, { left: 30 + 100 * zoom, top: 60 + 80 * zoom, width: 320 * zoom, height: 200 * zoom }, { zoom });
    const start = anchorLocalBox(VIEWPORT_ORIGIN, { left: 150, top: 200, width: 0, height: 0 }, { zoom });
    const moved = anchorLocalBox(VIEWPORT_ORIGIN, { left: 150 + 40 * zoom, top: 200 - 20 * zoom, width: 0, height: 0 }, { zoom });
    assert.deepEqual(origin, { left: 100, top: 80, width: 320, height: 200 });
    assert.ok(Math.abs(origin.left + moved.left - start.left - 140) < 1e-9);
    assert.ok(Math.abs(origin.top + moved.top - start.top - 60) < 1e-9);
  }
});
