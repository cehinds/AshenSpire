import {RIGS,WEAPONS,SETUPS} from './catalog.mjs';
import {solveArm,weaponPoint,sampleMotion} from './kinematics.mjs';
const names=['head','torso','hip','cloak','nearUpper','nearFore','nearClosed','nearOpen','farUpper','farFore','farClosed','farOpen'];
export async function loadTextures(){
 const entries=[];for(const id of Object.keys(RIGS))for(const part of names)entries.push([id+'/'+part,new URL('./parts/'+id+'/'+part+'.png',import.meta.url).href]);
 for(const id of Object.keys(WEAPONS))entries.push([id,new URL('../../assets/equipment/icon_'+id+'.webp',import.meta.url).href]);
 const loaded=await Promise.all(entries.map(async([id,url])=>{const image=new Image();image.src=url;await image.decode();return [id,image]}));return Object.fromEntries(loaded);
}
export function sceneFor(classId,setupId,action,t){
 const rig=RIGS[classId],setup=SETUPS[setupId],item=WEAPONS[setup.main],pose=sampleMotion(item.family,action,t);
 // Animate the common shoulder/root frame; legs retain their planted pose in this prototype.
 const shift=pose.lean,near=rig.near.map((v,i)=>v+(i===0?shift:0)),far=rig.far.map((v,i)=>v+(i===0?shift:0));
 const right=solveArm(near,pose.wrist,rig.upper,rig.lower,1);
 const two=setup.grip==='two';
 let offTarget=two?weaponPoint(item,right.wrist,pose.angle,item.support):[312+shift,361];
 if(!two&&action==='cast')offTarget=[350+Math.sin(t*Math.PI)*38,310-Math.sin(t*Math.PI)*42];
 else if(!two&&setup.off==='kiteShield')offTarget=[346+shift,306-Math.sin(t*Math.PI)*20];
 else if(!two&&setup.off)offTarget=[329+Math.sin(t*Math.PI)*30,300];
 let offAngle=setup.off==='kiteShield'?-90:-55+Math.sin(t*Math.PI)*15;
 if(setup.off&&WEAPONS[setup.off].family==='blade'&&action==='attack'){
  const alternate=sampleMotion('blade','attack',t<.5?t*2:2-2*t);offTarget=[alternate.wrist[0]-12,alternate.wrist[1]+12];offAngle=alternate.angle;
 }
 const left=solveArm(far,offTarget,rig.upper,rig.lower,-1);
 return {rig,setup,item,pose,right,left,offTarget,shift,action,t,offAngle};
}
export function render(canvas,textures,classId,setupId,action,t,{debug=false,effects=true}={}){
 const ctx=canvas.getContext('2d'),s=sceneFor(classId,setupId,action,t),{rig,setup,item,pose,right,left,shift}=s;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,600,600);
 // Fixed camera includes the entire overhead greatsword arc for every setup.
 ctx.translate(55,105);ctx.scale(.74,.74);
 const image=(name,x,y,w,h,rotation=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(textures[classId+'/'+name],-w/2,-h/2,w,h);ctx.restore()};
 const limb=(name,a,b,width)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]);image(name,(a[0]+b[0])/2,(a[1]+b[1])/2,width,len+17,Math.atan2(b[1]-a[1],b[0]-a[0])-Math.PI/2)};
 const hand=(name,arm,angle=null)=>{const rotation=angle===null?Math.atan2(arm.wrist[1]-arm.elbow[1],arm.wrist[0]-arm.elbow[0])-Math.PI/2:angle*Math.PI/180-Math.PI/2;image(name,arm.wrist[0],arm.wrist[1],rig.handSize,rig.handSize*1.28,rotation)};
 const weapon=(id,wrist,angle)=>{const p=WEAPONS[id];ctx.save();ctx.translate(...wrist);ctx.rotate(angle*Math.PI/180-Math.atan2(p.tip[1]-p.grip[1],p.tip[0]-p.grip[0]));ctx.scale(p.scale,p.scale);ctx.drawImage(textures[id],-p.grip[0],-p.grip[1]);ctx.restore()};
 // Paint order deliberately keeps weapons behind gripping fingers and the far arm behind the chest.
 image('cloak',rig.cloak[0]+shift*.5,rig.cloak[1],...rig.cloakSize,Math.sin(t*Math.PI)*.06);
 limb('farUpper',left.shoulder,left.elbow,rig.armWidth*.9);limb('farFore',left.elbow,left.wrist,rig.foreWidth*.9);
 if(setup.off&&setup.off!=='kiteShield')weapon(setup.off,left.wrist,s.offAngle);
 if(setup.grip!=='two')hand(action==='cast'&&!setup.off?'farOpen':'farClosed',left);
 image('hip',...rig.hip,...rig.hipSize);
 image('torso',rig.torso[0]+shift,rig.torso[1],...rig.torsoSize,shift*.002);
 // A raised shield belongs in front of the torso, behind the weapon arm.
 if(setup.off==='kiteShield'){limb('farFore',left.elbow,left.wrist,rig.foreWidth*.9);weapon(setup.off,left.wrist,s.offAngle);}
 image('head',rig.head[0]+shift,rig.head[1]-Math.abs(shift)*.12,...rig.headSize,shift*.003);
 limb('nearUpper',right.shoulder,right.elbow,rig.armWidth);limb('nearFore',right.elbow,right.wrist,rig.foreWidth);
 weapon(setup.main,right.wrist,pose.angle);
 if(setup.grip==='two')hand('farClosed',left,pose.angle);
 hand('nearClosed',right,pose.angle);
 if(effects&&t>.42&&t<.82){
  const alpha=Math.sin((t-.42)/.4*Math.PI);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=rig.color;ctx.fillStyle=rig.color;ctx.shadowColor=rig.color;ctx.shadowBlur=14;
  if(action==='cast'){
   for(const hand of [left,right]){if(hand===right&&item.family!=='focus')continue;const p=hand===right?weaponPoint(item,right.wrist,pose.angle,item.tip):setup.off?weaponPoint(WEAPONS[setup.off],left.wrist,-55+Math.sin(t*Math.PI)*15,WEAPONS[setup.off].tip):left.wrist;
    for(let k=0;k<10;k++){const a=k*Math.PI/5+t*5,r=20+10*Math.sin(t*8);ctx.beginPath();ctx.arc(p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r,2,0,Math.PI*2);ctx.fill()}ctx.beginPath();ctx.arc(...p,14,0,Math.PI*2);ctx.stroke();}
  }else if(action==='attack'){
   const reach=Math.hypot(item.tip[0]-item.grip[0],item.tip[1]-item.grip[1])*item.scale;
   ctx.lineWidth=4;ctx.beginPath();ctx.arc(...right.wrist,reach,pose.angle*Math.PI/180-.65,pose.angle*Math.PI/180);ctx.stroke();
  }else{ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(left.wrist[0],left.wrist[1],51,78,-.1,-Math.PI/2,Math.PI/2);ctx.stroke()}
  ctx.restore();
 }
 if(debug){ctx.save();ctx.strokeStyle='#70dfd2';ctx.fillStyle='#edcc66';ctx.lineWidth=2;for(const arm of [right,left]){ctx.beginPath();ctx.moveTo(...arm.shoulder);ctx.lineTo(...arm.elbow);ctx.lineTo(...arm.wrist);ctx.stroke();for(const p of [arm.shoulder,arm.elbow,arm.wrist]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.fill()}}ctx.restore()}
 return s;
}


