import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_JOINTS,SOURCE_SEQUENCE,REVIEW_SEQUENCE,CHAINS,sourceFrame} from './source-joints.mjs';
import {referenceKeys} from './reference-poses.mjs';
import {sceneFor} from './renderer.mjs';
import {SETUPS,WEAPONS} from './catalog.mjs';
test('both class studies cover each shipped combat key with valid source-space landmarks',()=>{
 for(const [cls,poses] of Object.entries(SOURCE_JOINTS)){
  assert.deepEqual(Object.keys(poses),['guard','attack1','attack2','attack3','attack4','between1','between2','between3','between4','between5']);
  for(const [pose,frame]of Object.entries(poses)){
   for(const chain of CHAINS)for(const name of chain){assert(frame.joints[name],`${cls}/${pose}/${name}`);assert(frame.joints[name].every(n=>Number.isFinite(n)&&n>=0&&n<640));}
   for(const name of frame.estimated)assert(frame.joints[name]);
   // Both projected elbow chains must have distinct shoulder, elbow and wrist.
   for(const prefix of ['near','far'])for(const [a,b]of [['Shoulder','Elbow'],['Elbow','Wrist']])assert(Math.hypot(...frame.joints[prefix+a].map((n,i)=>n-frame.joints[prefix+b][i]))>4);
  }
 }
});
test('key-pose playback holds the original frame and returns to guard at its final endpoint',()=>{
 for(const cls of Object.keys(SOURCE_JOINTS)){
  for(const key of REVIEW_SEQUENCE)assert.equal(sourceFrame(cls,key.t).pose,key.pose);
  assert.equal(sourceFrame(cls,.459).pose,'between2');
  assert.equal(sourceFrame(cls,.459,{intermediates:false}).pose,'attack1');
  assert.deepEqual(sourceFrame(cls,0).joints,sourceFrame(cls,1).joints);
  assert.equal(sourceFrame(cls,-1).pose,'guard');assert.equal(sourceFrame(cls,2).pose,'guard');
 }
});
test('every equipment attack starts and finishes in the same guarded pose',()=>{
 for(const cls of Object.keys(SOURCE_JOINTS))for(const [id,setup]of Object.entries(SETUPS)){
  const keys=referenceKeys(cls,WEAPONS[setup.main].family,'attack');assert.equal(keys[0].sprite,'guard');assert.equal(keys.at(-1).sprite,'guard');
  const start=sceneFor(cls,id,'attack',0),end=sceneFor(cls,id,'attack',1);
  for(const limb of ['left','right','nearLeg','farLeg'])for(const p of ['shoulder','elbow','wrist'])assert(Math.hypot(...start[limb][p].map((v,i)=>v-end[limb][p][i]))<.001);
 }
});
