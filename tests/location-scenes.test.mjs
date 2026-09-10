import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS } from '../src/model/worldAtlas.js';
import { locationScene } from '../src/content/locationScenes.js';

test('every non-local world location resolves to a WebP scene instead of a map crop', () => {
  for (const { nodeId } of ATLAS.data.world_nodes) {
    if (ATLAS.localByOwner[nodeId]) continue;
    const scene = locationScene(nodeId);
    assert.ok(scene, nodeId);
    assert.match(scene.atlas, /\.webp$/);
    assert.deepEqual(scene.box.slice(2), [768, 512]);
  }
});

test('White Ravine lower road uses road art independently of map coordinates', () => {
  const node = Object.values(ATLAS.nodes).find(n => n.displayName === 'White Ravine — Lower Road');
  assert.equal(locationScene(node.nodeId).name, 'Frozen Pilgrim Road');
  assert.equal(locationScene('unknown-node'), null);
});
