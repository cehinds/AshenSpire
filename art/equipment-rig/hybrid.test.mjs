import {test} from 'node:test';import assert from 'node:assert/strict';import {sceneFor} from './renderer.mjs';import {RIGS,SETUPS,WEAPONS} from './catalog.mjs';import {solveArm,LIMITS,sampleMotion,weaponPoint,rotate,add} from './kinematics.mjs';import {referenceKeys} from './reference-poses.mjs';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('unreachable targets obey shoulder and elbow limits while retaining bone lengths',()=>{
 for(const limits of [LIMITS.nearArm,LIMITS.farArm,LIMITS.leg])for(const point of [[0,0],[-1000,0],[1000,-1000],[0,1000]]){
  const s=solveArm([0,0],point,78,74,1,limits);assert(s.joint>=limits.joint[0]&&s.joint<=limits.joint[1]);assert(s.flex>=limits.flex[0]-.0001&&s.flex<=limits.flex[1]+.0001);assert(Math.abs(distance(s.shoulder,s.elbow)-78)<1e-6);assert(Math.abs(distance(s.elbow,s.wrist)-74)<1e-6);assert(s.limited);
 }
});
test('dense full-body playback stays within limits, keeps both grips and has no limb flips',()=>{
 let maxStep=0;
 for(const cls of Object.keys(RIGS))for(const setup of Object.keys(SETUPS))for(const action of ['attack','cast','guard']){let previous;
  for(let i=0;i<=600;i++){
   const s=sceneFor(cls,setup,action,i/600);
   for(const name of ['right','left','nearLeg','farLeg']){
    const limb=s[name];assert(limb.error<.01,`${cls}/${setup}/${action}/${i}/${name} lost target`);
    assert(limb.joint>=limb.limits.joint[0]-.001&&limb.joint<=limb.limits.joint[1]+.001);assert(limb.flex>=limb.limits.flex[0]-.001&&limb.flex<=limb.limits.flex[1]+.001);
    if(previous)for(const p of ['elbow','wrist'])maxStep=Math.max(maxStep,distance(limb[p],previous[name][p]));
   }
   for(const wrist of [s.handNear,s.handFar])assert(wrist.bend>=-50&&wrist.bend<=50);
   for(const ankle of [s.nearAnkle,s.farAnkle])assert(ankle.bend>=-60&&ankle.bend<=60);
   if(s.setup.grip==='two')assert(distance(s.left.wrist,weaponPoint(s.item,s.right.wrist,s.pose.angle,s.item.support))<.01);
   for(const [leg,ankle] of [[s.nearLeg,s.nearAnkle],[s.farLeg,s.farAnkle]])assert(distance(add(leg.wrist,rotate(ankle.pivot,ankle.rotation)),ankle.anchor)<.01,'ground contact drift');
   if(s.pose.front.planted)assert(Math.abs(s.nearAnkle.anchor[1]-550)<.001);if(s.pose.rear.planted)assert(Math.abs(s.farAnkle.anchor[1]-550)<.001);
   previous=s;
  }
 }
 assert(maxStep<6,`limb discontinuity: ${maxStep}px per 1/600 cycle`);
});
test('the authored sprite landmarks are met exactly and every action moves the hips and legs',()=>{
 for(const cls of Object.keys(RIGS))for(const family of ['blade','heavy','focus'])for(const action of ['attack','cast','guard']){
  const keys=referenceKeys(cls,family,action);for(const key of keys){const s=sampleMotion(family,action,key.t,cls);assert(distance(s.root,key.root)<1e-6);assert(distance(s.wrist,[key.root[0]+key.wrist[0],key.root[1]+key.wrist[1]])<1e-6);}
  const poses=[0,.22,.46,.69,1].map(t=>sampleMotion(family,action,t,cls));assert(new Set(poses.map(p=>p.root.join(','))).size>2);assert(poses.some(p=>p.front.point[0]!==poses[0].front.point[0]));assert.deepEqual(poses[0].root,poses.at(-1).root);
 }
});
test('shared tangents keep reference-key velocities aligned on both sides',()=>{
 const epsilon=1e-6;for(const family of ['blade','focus'])for(const action of ['attack','cast','guard']){
  const keys=referenceKeys('reaver',family,action);
  for(const k of keys.slice(1,-1)){const a=sampleMotion(family,action,k.t-epsilon),b=sampleMotion(family,action,k.t),c=sampleMotion(family,action,k.t+epsilon);
   for(const name of ['root','wrist'])for(let axis=0;axis<2;axis++)assert(Math.abs((b[name][axis]-a[name][axis])/epsilon-(c[name][axis]-b[name][axis])/epsilon)<1,'velocity jumps at '+k.label);
  }
 }
});
