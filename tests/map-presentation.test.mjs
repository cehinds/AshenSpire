import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS, generateJourney, reachableJourneyNodes } from '../src/model/worldAtlas.js';
import { atlasFocusCamera, ATLAS_NODE_SIZE } from '../src/ui/models/AtlasCameraModel.js';
import { mapNodeInk } from '../src/ui/components/mapNodeInk.js';

test('journey profiles frame their starting junction at phone and desktop sizes', () => {
  for (const profile of ['wanderer', 'expedition']) for (let seed = 0; seed < 30; seed++) {
    const journey = generateJourney(`camera-${seed}`, profile);
    const positions = Object.fromEntries(ATLAS.data.world_map_nodes.filter(n => n.mapId === journey.mapId).map(n => [n.nodeId,n]));
    const points = [journey.currentNodeId,...reachableJourneyNodes(journey)].map(id => positions[id]);
    for (const [width,height] of [[407,583],[660,320],[900,560]]) {
      const camera = atlasFocusCamera(points,width,height), size = width * camera.zoom;
      assert.ok(camera.zoom > 1 && camera.zoom <= 32);
      for (const p of points) {
        assert.ok(Math.abs(p.x-camera.x)*size+ATLAS_NODE_SIZE/2 <= width/2+1);
        assert.ok(Math.abs(p.y-camera.y)*size+ATLAS_NODE_SIZE/2 <= height/2+1);
      }
    }
  }
});

test('an isolated node still gets a finite close-up, and crowded views fit', () => {
  const one = atlasFocusCamera([{x:.4,y:.6}],400,500);
  assert.ok(Number.isFinite(one.zoom) && one.zoom > 1);
  assert.equal(one.x,.4); assert.equal(one.y,.6);
  const points=[{x:.4,y:.25},{x:.4,y:.4},{x:.4,y:.55}];
  assert.ok(atlasFocusCamera(points,400,300).zoom < atlasFocusCamera(points,400,600).zoom);
});

test('shared node artwork retains vector text and optional reachable halo', () => {
  const regular=mapNodeInk({type:'monster',x:12,y:25,radius:21.3});
  const reachable=mapNodeInk({type:'monster',x:12,y:25,radius:21.3,reachable:true});
  assert.ok(!regular.includes('node-halo'));
  assert.match(reachable,/class="node-halo"/);
  assert.ok(reachable.endsWith(regular));
  assert.match(mapNodeInk({type:'unknown',radius:21.3}),/>\?<\/text>/);
});
