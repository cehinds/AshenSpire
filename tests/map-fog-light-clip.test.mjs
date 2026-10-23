import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTerrainHtml } from '../src/ui/components/environmentArt.js';
import { MAP_TERRAIN_REVEAL_RADIUS } from '../src/content/environments.js';

const world = { id: 'cinder', map: 'x.webp' };
test('fog light is not clipped by the canvas edge', () => {
  const width = 585, height = 1136;
  const html = mapTerrainHtml({ world, width, height, fog: true, points: [{ id: 'start', x: 60, y: 1057 }, { id: 'top', x: 210, y: 20 }] });
  const mask = html.match(/<mask [^>]*>/)[0];
  const n = name => Number(mask.match(new RegExp(`${name}="(-?[\\d.]+)"`))[1]);
  const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
  for (const [cx, cy] of [[60, 1057], [210, 20]]) {
    assert.ok(x <= cx - MAP_TERRAIN_REVEAL_RADIUS, `mask left edge ${x} cuts light at ${cx}`);
    assert.ok(y <= cy - MAP_TERRAIN_REVEAL_RADIUS, `mask top edge ${y} cuts light at ${cy}`);
    assert.ok(x + w >= cx + MAP_TERRAIN_REVEAL_RADIUS && y + h >= cy + MAP_TERRAIN_REVEAL_RADIUS);
  }
});
