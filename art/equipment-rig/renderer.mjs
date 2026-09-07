import {RIGS,WEAPONS,SETUPS} from './catalog.mjs';
import {solveArm,weaponPoint,sampleMotion,rotate,add,clamp,LIMITS} from './kinematics.mjs';
const names=['head','torso','cloak','nearUpper','nearFore','nearClosed','nearOpen','farUpper','farFore','farClosed','farOpen','pelvis','nearThigh','nearShin','nearBoot','frontSkirt','farThigh','farShin','farBoot','torsoCrouch','torsoOverhead','cloakAction','backSkirt'];
export async function loadTextures(){
 const entries=[];for(const id of Object.keys(RIGS))for(const part of names)entries.push([id+'/'+part,new URL('./parts/'+id+'/'+part+'.png',import.meta.url).href]);
 for(const id of Object.keys(WEAPONS))entries.push([id,new URL('../../assets/equipment/icon_'+id+'.webp',import.meta.url).href]);
 const loaded=await Promise.all(entries.map(async([id,url])=>{const image=new Image();image.src=url;await image.decode();return [id,image]}));return Object.fromEntries(loaded);
}
export function sceneFor(classId,setupId,action,t){
 const rig=RIGS[classId],setup=SETUPS[setupId],item=WEAPONS[setup.main],pose=sampleMotion(item.family,action,t,classId);
 const body=p=>add(pose.root,rotate(p,pose.spine));
 const near=body([-27,-108]),far=body([14,-108]),two=setup.grip==='two';
 const solveNear=p=>solveArm(near,p,rig.upper,rig.lower,1,LIMITS.nearArm,pose.spine);
 const solveFar=p=>solveArm(far,p,rig.upper,rig.lower,-1,LIMITS.farArm,pose.spine);
 let target=pose.wrist,right=solveNear(target),offTarget;
 // Project the shared weapon grip until both constrained arms agree. The weapon
 // follows the solved primary hand, never the unconstrained requested target.
 if(two)for(let i=0;i<32;i++){
  offTarget=weaponPoint(item,right.wrist,pose.angle,item.support);const support=solveFar(offTarget);
  if(support.error<.001)break;
  target=[right.wrist[0]+(support.wrist[0]-offTarget[0])*.8,right.wrist[1]+(support.wrist[1]-offTarget[1])*.8];right=solveNear(target);
 }
 let offAngle=setup.off==='kiteShield'?-90:-55;
 offTarget=two?weaponPoint(item,right.wrist,pose.angle,item.support):add(pose.root,[0,12]);
 if(!two&&(action==='cast'||item.family==='focus')){offTarget=add(pose.root,[75+35*Math.sin(t*Math.PI),-55]);offAngle=pose.angle-12;}
 else if(!two&&setup.off==='kiteShield')offTarget=body([80,-50]);
 else if(!two&&setup.off){offTarget=body([78+22*Math.sin(t*Math.PI*2),-25-35*Math.sin(t*Math.PI)**2]);offAngle=pose.angle-35*Math.sin(t*Math.PI);}
 const left=solveFar(offTarget);
 const solveFoot=(hip,foot)=>{
  let target=foot.point,leg,ankle;
  for(let i=0;i<24;i++){
   leg=solveArm(hip,target,102,102,-1,LIMITS.leg);
   const bend=clamp(90-leg.foreAngle,...LIMITS.ankle),rotation=leg.foreAngle-90+bend;
   const pivot=rotation>=0?[45,30]:[-15,30],anchor=add(foot.point,pivot);
   ankle={bend,rotation,pivot,anchor};
   const offset=rotate(pivot,rotation),next=[anchor[0]-offset[0],anchor[1]-offset[1]];
   if(Math.hypot(next[0]-target[0],next[1]-target[1])<.00001)break;
   target=next;
  }
  return {leg,ankle};
 };
 const front=solveFoot(add(pose.root,[14,0]),pose.front),rear=solveFoot(add(pose.root,[-14,0]),pose.rear);
 const nearLeg=front.leg,farLeg=rear.leg;
 // Forearm roll is represented by the hand sprite. Bound wrist articulation
 // smoothly without flipping a hand by 180 degrees as the weapon passes it.
 const hand=(arm,angle)=>{const bend=45*Math.sin(2*(angle+90-arm.foreAngle)*Math.PI/180);return {bend,angle:arm.foreAngle+bend}};
 const handNear=hand(right,pose.angle),handFar=hand(left,two?pose.angle:offAngle);
 return {rig,setup,item,pose,right,left,offTarget,shift:pose.lean,action,t,offAngle,nearLeg,farLeg,nearAnkle:front.ankle,farAnkle:rear.ankle,handNear,handFar,body,referenceError:Math.hypot(right.wrist[0]-pose.wrist[0],right.wrist[1]-pose.wrist[1])};
}
export function render(canvas,textures,classId,setupId,action,t,{debug=false,effects=true}={}){
 const ctx=canvas.getContext('2d'),s=sceneFor(classId,setupId,action,t),{rig,setup,item,pose,right,left,body}=s;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,600,600);ctx.translate(42,85);ctx.scale(.74,.74);
 const image=(name,x,y,w,h,rotation=0,alpha=1)=>{if(alpha<.001)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(textures[classId+'/'+name],-w/2,-h/2,w,h);ctx.restore()};
 const limb=(name,a,b,width)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);image(name,(a[0]+b[0])/2,(a[1]+b[1])/2,width,len+17,Math.atan2(b[1]-a[1],b[0]-a[0])-Math.PI/2)};
 const hand=(name,arm,angle)=>image(name,...arm.wrist,rig.handSize,rig.handSize*1.28,angle*Math.PI/180-Math.PI/2);
 const weapon=(id,wrist,angle)=>{const p=WEAPONS[id];ctx.save();ctx.translate(...wrist);ctx.rotate(angle*Math.PI/180-Math.atan2(p.tip[1]-p.grip[1],p.tip[0]-p.grip[0]));ctx.scale(p.scale,p.scale);ctx.drawImage(textures[id],-p.grip[0],-p.grip[1]);ctx.restore()};
 const actionWeight=Math.sin(t*Math.PI)**2;
 image('cloakAction',...body([-62,-7]),190+76*actionWeight,280-52*actionWeight,pose.spine*Math.PI/900);
 limb('farUpper',left.shoulder,left.elbow,rig.armWidth*.9);limb('farFore',left.elbow,left.wrist,rig.foreWidth*.9);
 if(setup.off&&setup.off!=='kiteShield')weapon(setup.off,left.wrist,s.offAngle);
 if(setup.grip!=='two')hand(action==='cast'&&!setup.off?'farOpen':'farClosed',left,s.handFar.angle);
 image('backSkirt',pose.root[0]-27,pose.root[1]+45,125,115,pose.spine*Math.PI/900);
 for(const [prefix,leg,ankle]of [['far',s.farLeg,s.farAnkle],['near',s.nearLeg,s.nearAnkle]]){
  limb(prefix+'Thigh',leg.shoulder,leg.elbow,66);limb(prefix+'Shin',leg.elbow,leg.wrist,48);
  ctx.save();ctx.translate(...leg.wrist);ctx.rotate(ankle.rotation*Math.PI/180);ctx.drawImage(textures[classId+'/'+prefix+'Boot'],-17,-11,70,42);ctx.restore();
 }
 image('pelvis',pose.root[0],pose.root[1]+4,112,64);
 image('frontSkirt',pose.root[0]+7,pose.root[1]+50,137,115,pose.spine*Math.PI/1800);
 // Hand-painted torso variants preserve the silhouette at the sprite landmarks;
 // blend at the shared neck/waist anchors while the skeleton moves continuously.
 const crouch=clamp((pose.spine-10)/25,0,1),overhead=(action==='attack'&&item.family!=='focus')?Math.max(0,1-Math.abs(t-.46)/.20)*(1-crouch):0;
 image('torso',...body([0,-75]),...rig.torsoSize,pose.spine*Math.PI/180,1);
 image('torsoCrouch',...body([0,-75]),...rig.torsoSize,pose.spine*Math.PI/180,crouch);
 image('torsoOverhead',...body([0,-75]),...rig.torsoSize,pose.spine*Math.PI/180,overhead);
 if(overhead>.15){limb('farUpper',left.shoulder,left.elbow,rig.armWidth*.9);limb('farFore',left.elbow,left.wrist,rig.foreWidth*.9);}
 if(setup.off==='kiteShield'){limb('farFore',left.elbow,left.wrist,rig.foreWidth*.9);weapon(setup.off,left.wrist,s.offAngle);}
 image('head',...body([5,-172]),...rig.headSize,pose.spine*Math.PI/180*.7);
 limb('nearUpper',right.shoulder,right.elbow,rig.armWidth);limb('nearFore',right.elbow,right.wrist,rig.foreWidth);
 weapon(setup.main,right.wrist,pose.angle);
 if(setup.grip==='two')hand('farClosed',left,s.handFar.angle);
 hand('nearClosed',right,s.handNear.angle);
 if(effects&&t>.48&&t<.80){
  ctx.save();ctx.globalAlpha=Math.sin((t-.48)/.32*Math.PI);ctx.strokeStyle=rig.color;ctx.fillStyle=rig.color;ctx.shadowColor=rig.color;ctx.shadowBlur=9;
  if(action==='cast'||item.family==='focus'){
   for(const arm of [left,right]){if(arm===right&&item.family!=='focus')continue;const p=arm===right?weaponPoint(item,right.wrist,pose.angle,item.tip):setup.off?weaponPoint(WEAPONS[setup.off],left.wrist,s.offAngle,WEAPONS[setup.off].tip):left.wrist;
    for(let k=0;k<10;k++){const a=k*Math.PI/5+t*5,r=20+10*Math.sin(t*8);ctx.beginPath();ctx.arc(p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r,2,0,Math.PI*2);ctx.fill()}ctx.beginPath();ctx.arc(...p,14,0,Math.PI*2);ctx.stroke();}
  }else if(action==='attack'){
   const reach=Math.hypot(item.tip[0]-item.grip[0],item.tip[1]-item.grip[1])*item.scale;ctx.lineWidth=4;ctx.beginPath();ctx.arc(...right.wrist,reach,pose.angle*Math.PI/180-.6,pose.angle*Math.PI/180);ctx.stroke();
  }else{ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(left.wrist[0],left.wrist[1],51,78,-.1,-Math.PI/2,Math.PI/2);ctx.stroke()}
  ctx.restore();
 }
 if(debug){
  ctx.save();ctx.strokeStyle='#70dfd2';ctx.fillStyle='#edcc66';ctx.lineWidth=2;
  for(const arm of [right,left,s.nearLeg,s.farLeg]){ctx.beginPath();ctx.moveTo(...arm.shoulder);ctx.lineTo(...arm.elbow);ctx.lineTo(...arm.wrist);ctx.stroke();for(const p of [arm.shoulder,arm.elbow,arm.wrist]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fill()}}
  ctx.strokeStyle='#c29be9';ctx.beginPath();ctx.moveTo(...pose.root);ctx.lineTo(...body([0,-172]));ctx.stroke();
  for(const foot of [pose.front,pose.rear]){ctx.fillStyle=foot.planted?'#6fea94':'#e9b16f';ctx.fillRect(foot.point[0]-12,foot.point[1]+31,48,3)}ctx.restore();
 }
 return s;
}
