import {WEAPONS} from './catalog.mjs';
import {GRIPS,weaponTransform} from './weapon-grips.mjs';

const MAIN=[-50,-140,-125,25,45,-20,-50];
const TWIN_MAIN=[-40,-125,0,70,15,-20,-40],TWIN_OFF=[-60,-30,65,0,170,-50,-60];
export const DUMMY={x:565,y:280,width:64,height:235};
export function transformPoint(tx,p){
 const x=(p[0]-tx.grip[0])*tx.scale,y=(p[1]-tx.grip[1])*tx.scale;
 return [tx.anchor[0]+Math.cos(tx.rotation)*x-Math.sin(tx.rotation)*y,tx.anchor[1]+Math.sin(tx.rotation)*x+Math.cos(tx.rotation)*y];
}
export function equippedPose(sequence,index,loadout){
 const f=sequence?.frames[index];if(!f)return null;
 const main=WEAPONS.find(w=>w.id===loadout.main),off=WEAPONS.find(w=>w.id===loadout.off),clip=sequence.clip;
 const two=clip==='two-hand'||clip==='cast-two-hand';
 let angle=clip==='twin'?TWIN_MAIN[index]:MAIN[index];
 if(two&&f.anchors.off)angle=Math.atan2(f.anchors.main[1]-f.anchors.off[1],f.anchors.main[0]-f.anchors.off[0])*180/Math.PI;
 if(clip==='focus'||clip==='buff-free')angle=-85;
 if(['block-shield','hurt-free','dodge-free'].includes(clip))angle=[-60,-65,-45,-30,-40,-55,-60][index];
 if(main.family==='shield')angle=-90;
 function attach(item,anchor,degrees){
  if(!item||!anchor)return null;
  // Rigid weapon: hand separation never changes the item's scale.
  const tx=weaponTransform(item.id,anchor,degrees),d=GRIPS[item.id];
  return {item,tx,angle:degrees,mainGrip:transformPoint(tx,d.grip),supportGrip:d.support?transformPoint(tx,d.support):null,tip:transformPoint(tx,d.tip),bladeStart:transformPoint(tx,d.grip.map((v,i)=>v+(d.tip[i]-v)*.16))};
 }
 const primary=attach(main,f.anchors.main,angle),secondary=attach(off,f.anchors.off,off?.family==='shield'?-90:clip==='twin'?TWIN_OFF[index]:-85);
 return {primary,secondary,two,handAnchors:{main:{position:f.anchors.main,rotation:angle+90},off:{position:f.anchors.off,rotation:(two?angle:secondary?.angle??-85)+90}},supportError:two&&primary.supportGrip&&f.anchors.off?Math.hypot(...primary.supportGrip.map((v,i)=>v-f.anchors.off[i])):null};
}

// Slab intersection for the actual blade segment, not its bounding box.
export function intersectsTarget(a,b,box=DUMMY){
 let lo=0,hi=1;
 for(let i=0;i<2;i++){
  const min=i?box.y:box.x,max=min+(i?box.height:box.width),delta=b[i]-a[i];
  if(Math.abs(delta)<1e-9){if(a[i]<min||a[i]>max)return false;continue;}
  const p=(min-a[i])/delta,q=(max-a[i])/delta;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));if(lo>hi)return false;
 }
 return true;
}
