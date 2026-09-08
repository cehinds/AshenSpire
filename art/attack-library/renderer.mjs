import {WEAPONS} from './catalog.mjs';
import {GRIPS,weaponTransform} from './weapon-grips.mjs';
export async function loadImages(manifest){
 const paths=new Set([...WEAPONS.map(w=>w.image),'art/attack-library/hands/reaver-closed.png','art/attack-library/hands/reaver-open.png']);
 for(const seq of Object.values(manifest.sequences))for(const f of seq.frames.filter(Boolean)){paths.add(f.file);for(const hand of Object.values(f.hands))paths.add(hand.file)}
 const images={};await Promise.all([...paths].map(async path=>{const img=new Image();img.src=path;await img.decode();images[path]=img}));return images;
}
const MAIN=[-50,-140,-125,25,45,-20,-50],TWIN_MAIN=[-40,-125,0,70,15,-20,-40],TWIN_OFF=[-60,-30,65,0,170,-50,-60];
export function drawPose(canvas,images,sequence,index,loadout,{debug=false,layer='assembled'}={}){
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,640,640);ctx.fillStyle='#17130f';ctx.fillRect(0,0,640,640);
 const frame=sequence?.frames[index];if(!frame)return false;
 ctx.save();ctx.translate(24,92);ctx.scale(.82,.82);
 ctx.drawImage(images[frame.file],0,0);
 const main=WEAPONS.find(w=>w.id===loadout.main),off=WEAPONS.find(w=>w.id===loadout.off),clip=sequence.clip;
 let angle=clip==='twin'?TWIN_MAIN[index]:MAIN[index],length;
 if((clip==='two-hand'||clip==='cast-two-hand')&&frame.anchors.off){const a=frame.anchors.main,b=frame.anchors.off,d=GRIPS[main.id];angle=Math.atan2(a[1]-b[1],a[0]-b[0])*180/Math.PI;
  if(d.support)length=Math.hypot(a[0]-b[0],a[1]-b[1])/Math.hypot(d.grip[0]-d.support[0],d.grip[1]-d.support[1])*Math.hypot(d.tip[0]-d.grip[0],d.tip[1]-d.grip[1]);}
 if(clip==='focus'||clip==='buff-free')angle=-85;
 if(clip==='block-shield'||clip==='hurt-free'||clip==='dodge-free')angle=[-60,-65,-45,-30,-40,-55,-60][index];
 if(main.family==='shield')angle=-90;
 function item(weapon,anchor,orientation,len){
  if(!anchor||!weapon)return;
  const tx=weaponTransform(weapon.id,anchor,orientation,len),img=images[weapon.image];ctx.save();ctx.translate(...tx.anchor);ctx.rotate(tx.rotation);ctx.scale(tx.scale,tx.scale);ctx.drawImage(img,-tx.grip[0],-tx.grip[1],512,512);ctx.restore();
 }
 if(layer!=='body'){
  item(main,frame.anchors.main,angle,length);
  if(off)item(off,frame.anchors.off,off.family==='shield'?-90:clip==='twin'?TWIN_OFF[index]:-85);
  if(layer==='assembled'){
   for(const [hand,h]of Object.entries(frame.hands)){
    ctx.drawImage(images[h.file],h.x,h.y,h.size,h.size);
    if(sequence.classId==='reaver'&&sequence.outfit!=='reaver-oathsworn'){
     const held=hand==='main'||!!off||clip==='two-hand',kind=held?'closed':'open',p=frame.anchors[hand];
     const img=images[`art/attack-library/hands/reaver-${kind}.png`],w=held?24:23,h=w*img.height/img.width;
     ctx.drawImage(img,p[0]-w/2,p[1]-h/2,w,h);
    }
   }
   // Shield faces cover the strap hand, rather than showing fingers floating
   // over the shield boss. Weapon grips keep their fingers in the foreground.
   if(main.family==='shield')item(main,frame.anchors.main,-90);
   if(off?.family==='shield')item(off,frame.anchors.off,-90);
  }
 }
 if(debug)for(const [hand,p]of Object.entries(frame.anchors)){if(!p)continue;ctx.strokeStyle=hand==='main'?'#ff78d9':'#8ac5ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p[0],p[1],7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(p[0]-12,p[1]);ctx.lineTo(p[0]+12,p[1]);ctx.moveTo(p[0],p[1]-12);ctx.lineTo(p[0],p[1]+12);ctx.stroke()}
 ctx.restore();return true;
}
