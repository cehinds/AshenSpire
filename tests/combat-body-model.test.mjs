import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyPlacement, projectBodyBounds } from '../src/ui/models/CombatBodyModel.js';

test('raised weapon alpha does not alter semantic body normalization or feet', () => {
  const placement = {left:128,top:16,width:512,height:512,anchorX:384};
  const idle = bodyPlacement(placement,{headY:203,feetY:464,height:512},261,480);
  const raised = bodyPlacement(placement,{headY:140,feetY:465,height:512},261,480);
  assert.equal(idle.body.headY,raised.body.headY);
  assert.equal(raised.body.feetY,480);
  assert.equal(raised.body.feetY-raised.body.headY,261);
  assert(raised.top+94*raised.height/512<raised.body.headY,'the sword extends above the head');
  const physical=projectBodyBounds(raised.body,{top:30,left:10,right:200,height:200,width:190},768,544);
  assert.equal(physical.headY,30+219*200/544);
  assert.equal(physical.source,'authored');
});

test('missing semantic metadata preserves authored animation placement',()=>{
  const placement={left:1,top:2,width:3,height:4};
  assert.deepEqual(bodyPlacement(placement,null,190,480),placement);
});
