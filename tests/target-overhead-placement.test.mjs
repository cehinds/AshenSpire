import test from 'node:test';
import assert from 'node:assert/strict';
import { targetOverheadPlacement } from '../src/ui/components/battlefieldStage.js';

test('compact overhead stays centred and visible below header without touching artwork geometry', () => {
  const art={left:100,right:250,top:140,bottom:300};
  const box={left:120,right:220,top:74,height:52};
  const before=structuredClone({art,box});
  const move=targetOverheadPlacement({art,box,headerBottom:100,zoom:1.2});
  assert.equal(box.top+move.dy*1.2,104);
  assert.equal((box.left+box.right)/2+move.dx*1.2,(art.left+art.right)/2);
  assert.deepEqual({art,box},before);
  const spacious=targetOverheadPlacement({art:{...art,top:240},box,headerBottom:100});
  assert.equal(box.top+spacious.dy,240-14-52,'available overhead keeps its above-head gap');
  const noHeader=targetOverheadPlacement({art,box});
  assert.equal(noHeader.dy,0,'missing header never forces a lower placement');
});
