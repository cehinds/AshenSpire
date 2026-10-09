import test from 'node:test';
import assert from 'node:assert/strict';
import { playerDetailsPlacement } from '../src/ui/models/PlayerDetailsPlacementModel.js';
test('details sit right of the body and above the card envelope',()=>{
  const result=playerDetailsPlacement({art:{right:240,top:300},width:128,height:95,
    viewport:{left:0,top:0,right:650,bottom:766},handTop:420,hudBottom:75});
  assert.equal(result.left,250);
  assert.ok(result.top+95<=410);
});
test('phone details clamp inside the viewport without changing the actor',()=>{
  const art={right:295,top:340};
  const result=playerDetailsPlacement({art,width:128,height:95,
    viewport:{left:0,top:0,right:390,bottom:844},handTop:430,hudBottom:84});
  assert.equal(result.left,252);
  assert.ok(result.top+95<=420);
  assert.deepEqual(art,{right:295,top:340});
});
test('co-op player details reserve the earlier panel instead of covering it',()=>{
  const occupied={left:138,top:330,right:266,bottom:410};
  const result=playerDetailsPlacement({art:{right:175,top:374},width:128,height:80,
    viewport:{left:0,top:0,right:390,bottom:844},handTop:445,hudBottom:80,obstacles:[occupied]});
  assert.ok(result.top+80<=occupied.top-10 || result.top>=occupied.bottom+10);
});
test('short landscape uses a clear adjacent slot when vertical packing is full',()=>{
  const obstacles=[{left:225,top:93,right:353,bottom:185},{left:414,top:146,right:518,bottom:198}];
  const result=playerDetailsPlacement({art:{right:283,top:150},width:128,height:49,
    viewport:{left:0,top:0,right:844,bottom:390},handTop:195,hudBottom:45,obstacles});
  assert.ok(obstacles.every(o=>result.left+128<=o.left || result.left>=o.right || result.top+49<=o.top || result.top>=o.bottom));
});
test('selected details reserve the centered Inspect button above the panel',()=>{
  const obstacles=[{left:110,top:190,right:198,bottom:226},{left:200,top:186,right:288,bottom:222},
    {left:153,top:137,right:233,bottom:190}];
  const result=playerDetailsPlacement({art:{right:136,top:206},width:112,height:55,
    viewport:{left:0,top:0,right:288,bottom:513},handTop:289,hudBottom:50,gap:4,
    inspect:{width:32,height:32},obstacles});
  const button={left:result.left+40,right:result.left+72,top:result.top-36,bottom:result.top-4};
  for(const box of [{left:result.left,right:result.left+112,top:result.top,bottom:result.top+55},button])
    assert.ok(obstacles.every(o=>box.right+4<=o.left || box.left>=o.right+4 || box.bottom+4<=o.top || box.top>=o.bottom+4));
  assert.ok(result.top+55<=285);
});
