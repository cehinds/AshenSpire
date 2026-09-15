import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, reconcileHandOrder, moveHandInstance } from '../src/ui/models/HandLayout.js';
test('hand order survives draws and discards without mutating domain arrays',()=>{
 const previous=['b','a','c'],live=['a','c','d'];
 assert.deepEqual(reconcileHandOrder(previous,live),['a','c','d']);
 assert.deepEqual(moveHandInstance(previous,'a',2),['b','c','a']);
 assert.deepEqual(previous,['b','a','c']); assert.deepEqual(live,['a','c','d']);
 assert.deepEqual(moveHandInstance(previous,'missing',0),previous);
 assert.deepEqual(reconcileHandOrder(previous,[]),[]);
});
test('uniform card proportions, physical exposure, and selected body containment',()=>{
 for(const width of [360,375,844,1440]) for(const zoom of [.67,1,1.5]) {
  const p=handLayout({width:width/zoom,height:234/zoom,count:5,rem:16/zoom,zoom});
  assert.ok(Math.abs(p.cardWidth/p.cardHeight-5/8)<1e-9);
  assert.ok(p.step*zoom>=44);
  assert.ok(p.top-p.lift>=0);
  assert.ok(p.top+p.cardHeight<=234/zoom);
  assert.equal(p.cards.length,5);
 }
});
test('excess cards overflow horizontally with the same face size',()=>{
 const input={width:375,height:208,rem:16};
 const five=handLayout({...input,count:5}),many=handLayout({...input,count:20});
 assert.equal(five.cardWidth,many.cardWidth); assert.ok(many.span>input.width);
 assert.equal(handLayout({...input,count:0}).span,0);
});
