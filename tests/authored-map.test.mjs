import assert from 'node:assert/strict';
import { framingBox, mapPoint, nodeX, nodeY, nodeRadius } from '../src/model/mapview.js';
import { LEGACY_DUNGEONS } from '../src/model/legacyDungeon.js';

const regular = { col: 3, floor: 5, type: 'monster' };
assert.deepEqual(mapPoint(regular, 1024), { x: nodeX(3), y: nodeY(5, 1024) });
for (const d of LEGACY_DUNGEONS) {
  for (const n of d.nodes) {
    const node = { col: 0, floor: n.number, type: n.kind === 'boss' ? 'boss' : 'event', mapPosition: { x: n.x * 1536 / 100, y: n.y * 1024 / 100 } };
    const box = framingBox([node], 1024), r = nodeRadius(node.type);
    assert.equal(box.x0, node.mapPosition.x - r);
    assert.equal(box.y0, node.mapPosition.y - r);
    assert.equal((box.x0 + box.x1) / 2, node.mapPosition.x);
    assert.ok(Math.abs((box.y0 + box.y1) / 2 - node.mapPosition.y) < 1e-9);
  }
}
console.log('PASS native camera uses all 72 authored positions and retains regular grid geometry');
