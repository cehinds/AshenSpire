import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTravelEdgesHtml } from '../src/ui/components/mapboard.js';

const nodes=[{id:'a',x:0,y:0,next:['b','c']},{id:'b',x:1,y:1,next:['a','c']},{id:'c',x:2,y:2,next:['a']}];
const draw = options => mapTravelEdgesHtml({nodes,px:n=>n.x,py:n=>n.y,...options});
test('untraveled routes emit neither stroke nor outline, while navigation remains intact',()=>{
  const before=structuredClone(nodes);
  assert.equal(draw({path:[]}), '');
  assert.equal(draw({path:['a']}), '');
  const html=draw({path:['a','b']});
  assert.equal((html.match(/map-route-outline/g)||[]).length,1);
  assert.equal((html.match(/map-edge traveled/g)||[]).length,1);
  assert.match(html,/x1="0" y1="0" x2="1" y2="1"/);
  assert.doesNotMatch(html,/x2="2"/);
  assert.deepEqual(nodes,before);
});
test('revisited junctions retain later traversed pairs without implying reverse travel',()=>{
  const html=draw({path:['a','b','a','c']});
  assert.equal((html.match(/map-edge traveled/g)||[]).length,3);
  assert.match(html,/x1="0" y1="0" x2="2" y2="2"/);
  assert.doesNotMatch(html,/x1="2" y1="2" x2="0"/);
  assert.equal(draw({path:['a','b'],isDrawn:id=>id!=='b'}),'');
});
test('authored undirected routes render once after reverse traversal',()=>{
  const authoredMap={routes:[{a:'a',b:'b',points:[[0,0],[.5,.8],[1,1]]}]};
  const html=draw({path:['b','a'],authoredMap});
  assert.equal((html.match(/map-route-outline/g)||[]).length,1);
  assert.equal((html.match(/map-edge traveled/g)||[]).length,1);
  assert.match(html,/<polyline/);
  assert.equal(draw({path:['c'],authoredMap}),'');
});
