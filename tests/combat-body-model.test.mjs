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

import { alternativeCardAnimationFamily } from '../src/model/cardAnimationFamily.js';
import { COMBAT_BODY_LANDMARKS } from '../src/content/combatBodyLandmarks.js';

test('all four class held stances share their own unchanged ready body height', () => {
  for (const classId of ['reaver','rogue','starseer','herald']) {
    const {family,heldFrames}=alternativeCardAnimationFamily(classId,{weaponProfile:'reaver-greatsword-pilot',smashProfile:classId});
    const ready=COMBAT_BODY_LANDMARKS[family.frames.ready.path];
    assert(ready,`${classId} ready metadata`);
    const reference=(ready.feetY-ready.headY)*(family.frames.ready.size?.[1]||512)/ready.height;
    for(const [stance,frame] of Object.entries({ ...heldFrames, guarded:family.frames['guard-brace'] })) {
      const body=COMBAT_BODY_LANDMARKS[frame.path];
      assert(body,`${classId} ${stance} semantic landmarks`);
      assert(body.headY>=0&&body.feetY<=body.height&&body.headY<body.feetY);
      const [width,height]=frame.size||[512,512], [left,top]=frame.drawOffset||[128,0];
      const draw=bodyPlacement({left,top:16+top,width,height,anchorX:384},body,reference,480);
      assert(Math.abs(draw.body.feetY-draw.body.headY-reference)<1e-6);
      assert.equal(draw.body.feetY,480,'stance does not move the shadow floor');
    }
  }
});

test('registered enemy held bodies normalize to their idle while preserving floor480',()=>{
  const paths=Object.keys(COMBAT_BODY_LANDMARKS).filter(path=>path.startsWith('assets/enemy-poses/expansion/'));
  assert(paths.length>0);
  for(const path of paths){
    const body=COMBAT_BODY_LANDMARKS[path];
    const idle=COMBAT_BODY_LANDMARKS[path.replace(/\/[^/]+\.webp$/,'/idle.webp')];
    assert(idle,`${path} idle semantic reference`);
    const reference=idle.feetY-idle.headY;
    const draw=bodyPlacement({left:0,top:0,width:512,height:512,anchorX:256},body,reference,480);
    assert.equal(draw.body.feetY,480);
    assert.equal(draw.body.feetY-draw.body.headY,reference);
    assert(body.headY>=0&&body.headY<body.feetY&&body.feetY<=body.height);
  }
});

import { enemyStanceSprites } from '../src/content/enemyStanceSprites.js';
test('all enemy species have semantic metadata for idle and every held stance',()=>{
  for(const [id,stances] of Object.entries(enemyStanceSprites))for(const pose of new Set(['idle',...Object.values(stances)])){
    const path=`assets/enemy-poses/expansion/${id}/${pose}.webp`;
    assert(COMBAT_BODY_LANDMARKS[path],`${path} missing semantic head/body anchor`);
    assert.equal(COMBAT_BODY_LANDMARKS[path].confidence,'visual-reviewed');
  }
});
