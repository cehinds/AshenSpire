import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTravelEdgesHtml } from '../src/ui/components/mapboard.js';

const nodes = [{ id: 'a', x: 0, y: 0, next: ['b', 'c'] }, { id: 'b', x: 1, y: 1, next: ['c'] }, { id: 'c', x: 2, y: 2, next: [] }];
const draw = options => mapTravelEdgesHtml({ nodes, px: n => n.x, py: n => n.y, ...options });

test('allRoutes draws every edge between drawn nodes and marks only path pairs traveled', () => {
  const html = draw({ path: ['a', 'b'], allRoutes: true });
  assert.equal((html.match(/<line /g) || []).length, 3 + 1); // 3 edges + 1 outline for the traveled one
  assert.equal((html.match(/map-edge traveled/g) || []).length, 1);
  assert.equal((html.match(/map-route-outline/g) || []).length, 1);
  assert.equal((html.match(/class="map-edge"/g) || []).length, 2);
});
test('allRoutes still honours isDrawn', () => {
  const html = draw({ path: [], allRoutes: true, isDrawn: id => id !== 'c' });
  assert.equal((html.match(/class="map-edge"/g) || []).length, 1);
});
test('allRoutes off is byte-identical to the default', () => {
  const base = draw({ path: ['a', 'b'] });
  assert.equal(draw({ path: ['a', 'b'], allRoutes: false }), base);
  assert.equal((base.match(/map-edge/g) || []).length, 1);
});
