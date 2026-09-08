import {test} from 'node:test';import assert from 'node:assert/strict';
import {tracedSceneFor,tracedKeys} from './traced-motion.mjs';
import {SETUPS} from './catalog.mjs';import {weaponPoint,wrapAngle} from './kinematics.mjs';
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('revised primary arms meet traced key positions instead of generic IK targets',()=>{
 for(const cls of ['reaver','starseer'])for(const [setup,action,family]of [['sword','attack','blade'],['focus','cast','focus']])for(const key of tracedKeys(cls,action,family)){
  const s=tracedSceneFor(cls,setup,action,key.t);
  assert(d(s.right.shoulder,key.joints.nearShoulder)<1e-6);assert(d(s.right.elbow,key.joints.nearElbow)<1e-6);assert(d(s.right.wrist,key.joints.nearWrist)<1e-6);
 }
});
test('dense revised playback has no collapsed arms, backward elbow folds, snaps or detached support grip',()=>{
 let step=0;
 for(const cls of ['reaver','starseer'])for(const setup of Object.keys(SETUPS))for(const action of ['attack','cast','guard']){
  let previous;
  for(let i=0;i<=600;i++){
   const s=tracedSceneFor(cls,setup,action,i/600);
   for(const name of ['left','right']){
    const arm=s[name];for(const p of ['shoulder','wrist'])assert(d(arm.elbow,arm[p])>=18,`${cls}/${setup}/${action}/${i}: collapsed ${name}`);
    const rotation=Math.atan2(arm.elbow[1]-arm.shoulder[1],arm.elbow[0]-arm.shoulder[0])*180/Math.PI;
    assert(Math.abs(wrapAngle(arm.foreAngle-rotation))<=165.001,'elbow fold exceeds limit');
    if(previous)for(const p of ['shoulder','elbow','wrist'])step=Math.max(step,d(arm[p],previous[name][p]));
   }
   if(s.setup.grip==='two'){
    assert(d(s.left.wrist,weaponPoint(s.item,s.right.wrist,s.pose.angle,s.item.support))<.001,'support grip detached');
    assert(Math.abs(d(s.left.shoulder,s.left.elbow)-78)<1e-6);assert(Math.abs(d(s.left.elbow,s.left.wrist)-74)<1e-6);
   }
   for(const leg of [s.nearLeg,s.farLeg]){
    const upper=Math.atan2(leg.elbow[1]-leg.shoulder[1],leg.elbow[0]-leg.shoulder[0])*180/Math.PI;
    assert(Math.abs(wrapAngle(leg.foreAngle-upper))<=145,'knee fold exceeds limit');
    assert(d(leg.shoulder,leg.elbow)>30&&d(leg.elbow,leg.wrist)>30,'collapsed leg');
   }
   previous=s;
  }
 }
 assert(step<6,`arm movement jumps ${step}px in 1/600 cycle`);
});
test('revised attacks close in guard and guard feet stay planted while knees move',()=>{
 for(const cls of ['reaver','starseer'])for(const setup of Object.keys(SETUPS)){
  const start=tracedSceneFor(cls,setup,'attack',0),end=tracedSceneFor(cls,setup,'attack',1);
  for(const name of ['left','right','nearLeg','farLeg'])for(const p of ['shoulder','elbow','wrist'])assert(d(start[name][p],end[name][p])<.001);
  const guard=tracedSceneFor(cls,setup,'guard',0),brace=tracedSceneFor(cls,setup,'guard',.46);
  assert(d(guard.nearLeg.wrist,brace.nearLeg.wrist)<.001);assert(d(guard.farLeg.wrist,brace.farLeg.wrist)<.001);assert(d(guard.nearLeg.elbow,brace.nearLeg.elbow)>10);
 }
});
