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

test('phone packing reserves the full adjacent Info door before exposing it',()=>{
  const viewport={left:0,top:0,right:320,bottom:650};
  const art={right:130,top:340};
  const obstacles=[{left:180,top:160,right:300,bottom:410}];
  const old=playerDetailsPlacement({art,width:128,height:100,viewport,handTop:420,hudBottom:150,obstacles});
  assert.equal(old.left,42,'the former panel-only placement clips a 44px Info door');
  const result=playerDetailsPlacement({art,width:128,height:100,viewport,handTop:420,hudBottom:150,
    leftOverhang:44,obstacles});
  assert.ok(result.left-44>=viewport.left+10);
  assert.ok(result.left+128<=viewport.right-10);
});

test('a later co-op panel avoids the entire earlier reading and Info footprint',()=>{
  const occupied={left:94,top:200,right:266,bottom:300};
  const result=playerDetailsPlacement({art:{right:175,top:230},width:128,height:80,leftOverhang:44,
    viewport:{left:0,top:0,right:390,bottom:650},handTop:445,hudBottom:80,obstacles:[occupied]});
  assert.ok(result.left+128+10<=occupied.left || result.left-44>=occupied.right+10
    || result.top+80+10<=occupied.top || result.top>=occupied.bottom+10);
});
