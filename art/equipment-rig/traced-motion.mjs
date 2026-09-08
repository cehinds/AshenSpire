import {SOURCE_JOINTS,SOURCE_SEQUENCE,REVIEW_SEQUENCE} from './source-joints.mjs';
import {SUPPORTED_TRANSITIONS} from './transition-joints.mjs';
import {RIGS,SETUPS,WEAPONS} from './catalog.mjs';
import {weaponPoint,rotate,add,clamp,wrapAngle,solveArm} from './kinematics.mjs';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
// Projected painted poses deliberately change apparent segment length as the
// arms turn in depth. Do not force these through a fixed planar IK bend sign.
// Curves are monotone per coordinate: no overshoot outside the authored envelope.
function curve(keys,t,read){
 let i=keys.findIndex((k,j)=>j&&k.t>=t);if(i<1)i=keys.length-1;
 const slope=j=>{if(j===0||j===keys.length-1)return 0;const a=(read(keys[j])-read(keys[j-1]))/(keys[j].t-keys[j-1].t),b=(read(keys[j+1])-read(keys[j]))/(keys[j+1].t-keys[j].t);return a*b<=0?0:2*a*b/(a+b)};
 const a=keys[i-1],b=keys[i],h=b.t-a.t,u=(t-a.t)/h;
 return (2*u**3-3*u*u+1)*read(a)+(u**3-2*u*u+u)*h*slope(i-1)+(-2*u**3+3*u*u)*read(b)+(u**3-u*u)*h*slope(i);
}
export function tracedKeys(classId,action,family){
 const reference=action==='guard'?classId:action==='cast'||family==='focus'?'starseer':'reaver';
 // Keep depth-changing breakdowns reviewable without forcing them through a
 // planar solver that produces a sharp elbow sweep. Heavy two-hand casting
 // also retains the previous keys until its support arm can follow this art.
 const sequence=action==='guard'||action==='cast'&&family==='heavy'?SOURCE_SEQUENCE:REVIEW_SEQUENCE.filter(k=>!k.pose.startsWith('between')||SUPPORTED_TRANSITIONS[reference].includes(k.pose));
 const roots=new Map(SOURCE_SEQUENCE.map((key,i)=>[key.t,[300,318,308,335,318,300][i]]));
 const steps=sequence.map((key,i)=>{
  const pose=action==='guard'?'guard':key.pose,source=SOURCE_JOINTS[reference][pose].joints,scale=1.5;
  const floor=Math.max(source.nearAnkle[1],source.farAnkle[1]);
  const root=[key.rootX??roots.get(key.t),520-(floor-source.pelvis[1])*scale];
  if(action==='guard'){root[0]=[300,293,287,308,304,300][i];root[1]+=[0,13,22,11,4,0][i];}
  const joints=Object.fromEntries(Object.entries(source).map(([name,p])=>[name,add(root,[(p[0]-source.pelvis[0])*scale,(p[1]-source.pelvis[1])*scale])]));
  if(action==='guard')for(const prefix of ['near','far']){joints[prefix+'Ankle'][1]-=[0,13,22,11,4,0][i];joints[prefix+'Ankle'][0]-=root[0]-300;}
  return {...key,label:action==='guard'?['Guard','Brace','Absorb','Push back','Recover','Guard'][i]:key.label,pose,reference,joints};
 });
 // Keep weapon rotation continuous across the -180/180 boundary.
 let previous;for(const [i,k]of steps.entries()){
  let a=angle(k.joints.nearWrist,k.joints.weaponTip);
  // A heavy overhead cleave deliberately sweeps more than half a circle. The
  // shortest-angle route would send the sword backward through the legs.
  if(reference==='reaver'&&action!=='guard')a=k.t===.11||k.t===.22?a:a+360;
  else if(previous!==undefined)a=previous+wrapAngle(a-previous);
  k.angle=a;previous=a;
 }
 return steps;
}
export function tracedSceneFor(classId,setupId,action,t){
 t=clamp(t,0,1);const setup=SETUPS[setupId],item=WEAPONS[setup.main],rig=RIGS[classId],keys=tracedKeys(classId,action,item.family);
 const joints=Object.fromEntries(Object.keys(keys[0].joints).map(name=>[name,[0,1].map(axis=>curve(keys,t,k=>k.joints[name][axis]))]));
 // Interpolate rotating segments, not endpoint chords. A chord can collapse a
 // forearm to zero length while it crosses from one side of the elbow to another.
 for(const prefix of ['near','far']){
  let last;const polar=keys.map(k=>{const a=k.joints[prefix+'Shoulder'],b=k.joints[prefix+'Elbow'],c=k.joints[prefix+'Wrist'];let rotation=angle(a,b);if(last!==undefined)rotation=last+wrapAngle(rotation-last);last=rotation;return {t:k.t,rotation,upper:distance(a,b),lower:distance(b,c),flex:wrapAngle(angle(b,c)-angle(a,b))}});
  const rotation=curve(polar,t,k=>k.rotation),flex=clamp(curve(polar,t,k=>k.flex),-165,165);
  joints[prefix+'Elbow']=add(joints[prefix+'Shoulder'],rotate([curve(polar,t,k=>k.upper),0],rotation));
  joints[prefix+'Wrist']=add(joints[prefix+'Elbow'],rotate([curve(polar,t,k=>k.lower),0],rotation+flex));
 }
 const root=joints.pelvis,weaponAngle=wrapAngle(curve(keys,t,k=>k.angle));
 const interval=keys.findIndex((k,i)=>i&&k.t>=t),a=keys[Math.max(0,interval-1)],b=keys[Math.max(1,interval)];
 const u=(t-a.t)/(b.t-a.t);
 // Repositioned feet leave the ground instead of skating between key poses.
 for(const prefix of ['near','far'])if(action!=='guard'&&Math.abs(a.joints[prefix+'Ankle'][0]-b.joints[prefix+'Ankle'][0])>3){
  const lift=16*Math.sin(Math.PI*u)**2;joints[prefix+'Ankle'][1]-=lift;joints[prefix+'Knee'][1]-=lift*.4;
 }
 const arm=(prefix,target=joints[prefix+'Wrist'])=>({shoulder:joints[prefix+'Shoulder'],elbow:joints[prefix+'Elbow'],wrist:target,foreAngle:angle(joints[prefix+'Elbow'],target),error:0});
 // Match the support shoulder to the narrower painted torso cutout, instead of
 // leaving its attachment outside the armor while both hands share a handle.
 if(setup.grip==='two')joints.farShoulder=add(joints.nearShoulder,[(joints.farShoulder[0]-joints.nearShoulder[0])*.65,(joints.farShoulder[1]-joints.nearShoulder[1])]);
 const right=arm('near');let offTarget=joints.farWrist,offAngle=weaponAngle;
 if(setup.grip==='two')offTarget=weaponPoint(item,right.wrist,weaponAngle,item.support);
 else if(setup.off==='kiteShield'){offTarget=add(joints.farShoulder,[65,66]);offAngle=-90;}
 else if(!setup.off&&action==='attack'&&item.family!=='focus')offTarget=add(joints.farWrist,[0,18]);
 let left=arm('far',offTarget);
 if(setup.grip==='two'){
  // Keep the hilt outside the support shoulder's folded reach, then solve the
  // support arm on its outward bend. Source-guided primary motion supplies the
  // silhouette; the secondary hand remains locked to the rigid handle.
  const shoulder=joints.farShoulder,delta=[offTarget[0]-shoulder[0],offTarget[1]-shoulder[1]],d=Math.hypot(...delta);
  if(d<30||d>150){const push=delta.map(v=>v/Math.max(d,.001)*(clamp(d,30,150)-d));right.wrist=add(right.wrist,push);right.elbow=add(right.elbow,push.map(v=>v*.5));offTarget=weaponPoint(item,right.wrist,weaponAngle,item.support);right.foreAngle=angle(right.elbow,right.wrist);}
  left=solveArm(shoulder,offTarget,78,74,1,{joint:[-180,180],flex:[8,165]});
 }
 if(setup.off==='kiteShield')left=solveArm(joints.farShoulder,offTarget,78,74,1,{joint:[-180,180],flex:[8,165]});
 const leg=prefix=>({shoulder:joints[prefix+'Hip'],elbow:joints[prefix+'Knee'],wrist:joints[prefix+'Ankle'],foreAngle:angle(joints[prefix+'Knee'],joints[prefix+'Ankle']),error:0});
 const nearLeg=leg('near'),farLeg=leg('far');
 const chest=[(joints.nearShoulder[0]+joints.farShoulder[0])/2,(joints.nearShoulder[1]+joints.farShoulder[1])/2];
 const spine=clamp(angle(root,chest)+90,-12,40),body=p=>add(root,rotate(p,spine));
 const head=add(chest,rotate([0,-67],spine));
 const from=keys.findLast(k=>k.t<=t),to=keys.find(k=>k.t>t)||keys.at(-1);
 const foot=p=>({point:p,planted:Math.abs(p[1]-520)<8});
 const handNear={bend:0,angle:right.foreAngle},handFar={bend:0,angle:left.foreAngle};
 return {guided:true,rig,setup,item,pose:{root,spine,wrist:right.wrist,angle:weaponAngle,from,to,front:foot(nearLeg.wrist),rear:foot(farLeg.wrist)},right,left,nearLeg,farLeg,nearAnkle:{rotation:0},farAnkle:{rotation:0},handNear,handFar,head,chest,body,action,t,offTarget,offAngle,referenceError:distance(left.wrist,joints.farWrist),joints,keys};
}
