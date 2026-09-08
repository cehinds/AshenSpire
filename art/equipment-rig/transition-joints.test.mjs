import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {TRANSITION_JOINTS,TRANSITION_SEQUENCE,SUPPORTED_TRANSITIONS} from './transition-joints.mjs';
import {SOURCE_SEQUENCE,REVIEW_SEQUENCE,sourceAsset} from './source-joints.mjs';
import {tracedKeys} from './traced-motion.mjs';
test('each original interval contains an independently authored painted reference with its own traced landmarks',async()=>{
 const hashes=new Set();
 for(let i=1;i<SOURCE_SEQUENCE.length;i++)assert(TRANSITION_SEQUENCE.some(k=>k.t>SOURCE_SEQUENCE[i-1].t&&k.t<SOURCE_SEQUENCE[i].t));
 assert.equal(REVIEW_SEQUENCE.length,11);
 for(const cls of ['reaver','starseer'])for(const key of TRANSITION_SEQUENCE){
  const frame=TRANSITION_JOINTS[cls][key.pose];assert.equal(frame.provenance,'authored-painted-strip');assert.equal(Object.keys(frame.joints).length,14);
  assert(frame.estimated.includes('pelvis'));assert(frame.estimated.includes('farShoulder'));
  const bytes=await readFile(new URL('../../'+sourceAsset(cls,key.pose),import.meta.url));
  assert.equal(bytes.readUInt32BE(16),640);assert.equal(bytes.readUInt32BE(20),640);assert.equal(bytes[25],6,'normalized PNG must retain alpha');
  const hash=createHash('sha256').update(bytes).digest('hex');assert(!hashes.has(hash),'references cannot be repeated frames');hashes.add(hash);
 }
});
test('only supported intermediate references drive the rig; depth-changing studies stay reviewable',()=>{
 for(const [cls,action,family]of [['reaver','attack','heavy'],['starseer','cast','focus']]){
  const keys=tracedKeys(cls,action,family);assert.deepEqual(keys.filter(k=>k.pose.startsWith('between')).map(k=>k.pose),SUPPORTED_TRANSITIONS[cls]);
  for(const key of keys.filter(k=>k.pose.startsWith('between'))){
   const source=TRANSITION_JOINTS[cls][key.pose].joints;
   for(const name of ['nearShoulder','nearElbow','nearWrist','nearKnee','nearAnkle'])for(let axis=0;axis<2;axis++)assert(Math.abs((key.joints[name][axis]-key.joints.pelvis[axis])-(source[name][axis]-source.pelvis[axis])*1.5)<1e-8,'guide must use the traced artwork, not the old interpolator');
  }
 }
 assert.equal(tracedKeys('reaver','cast','heavy').length,SOURCE_SEQUENCE.length,'unsupported two-hand casting remains on previous keys');
});
