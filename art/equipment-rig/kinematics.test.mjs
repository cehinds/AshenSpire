import {test} from 'node:test';import assert from 'node:assert/strict';
import {solveArm,weaponPoint,sampleMotion} from './kinematics.mjs';
import {RIGS,SETUPS,WEAPONS} from './catalog.mjs';import {sceneFor} from './renderer.mjs';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('IK preserves bone lengths and safely clamps unreachable or coincident targets',()=>{
 for(const p of [[100,100],[0,0],[1000,0],[-1000,-1000]]){
  const s=solveArm([0,0],p,75,70);assert(Math.abs(dist(s.shoulder,s.elbow)-75)<1e-6);assert(Math.abs(dist(s.elbow,s.wrist)-70)<1e-6);assert(s.wrist.every(Number.isFinite));
 }
});
test('Every supported combination remains reachable throughout all three motions',()=>{
 for(const id of Object.keys(RIGS))for(const setup of Object.keys(SETUPS))for(const action of ['attack','cast','guard'])for(let i=0;i<=100;i++){
  const s=sceneFor(id,setup,action,i/100);assert(s.left.error<.01&&s.right.error<.01,`${id}/${setup}/${action}/${i}`);
  assert(dist(weaponPoint(s.item,s.right.wrist,s.pose.angle,s.item.grip),s.right.wrist)<1e-9);
  if(s.setup.grip==='two')assert(dist(weaponPoint(s.item,s.right.wrist,s.pose.angle,s.item.support),s.left.wrist)<.01,'support hand detached');
 }
});
test('Family motion returns to rest and weapon substitution requires no new motion',()=>{
 for(const family of ['blade','heavy','focus'])for(const action of ['attack','cast','guard']){
  const a=sampleMotion(family,action,0),b=sampleMotion(family,action,1);assert.deepEqual(a.wrist,b.wrist);assert.equal(a.angle,b.angle);
 }
 for(let i=0;i<=100;i++)assert.deepEqual(sceneFor('reaver','sword','attack',i/100).pose,sceneFor('reaver','newWeapon','attack',i/100).pose);
 assert.equal(WEAPONS.straightSword.family,WEAPONS.katana.family);
});
