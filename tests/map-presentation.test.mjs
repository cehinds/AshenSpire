import test from 'node:test';
import assert from 'node:assert/strict';
import { mapNodeInk } from '../src/ui/components/mapNodeInk.js';

test('shared node artwork retains vector text and optional reachable halo', () => {
  const regular=mapNodeInk({type:'monster',x:12,y:25,radius:21.3});
  const reachable=mapNodeInk({type:'monster',x:12,y:25,radius:21.3,reachable:true});
  assert.ok(!regular.includes('node-halo'));
  assert.match(reachable,/class="node-halo"/);
  assert.ok(reachable.endsWith(regular));
  assert.match(mapNodeInk({type:'unknown',radius:21.3}),/>\?<\/text>/);
});
