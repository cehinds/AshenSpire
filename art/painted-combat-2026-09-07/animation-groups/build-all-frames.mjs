import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { decodePng, encodePng, contentBox, resample } from '../../../tools/concept-cutout.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../../..');
const outfits=JSON.parse(readFileSync(join(here,'../requirements.json'))).outfits;
const poses=['shieldGuard1','shieldGuard2','shieldGuard3','parry1','parry2','parry3','shieldBash1','shieldBash2','shieldBash3'];
const selected=process.argv.slice(2),records=[];
for(const {id} of outfits) {
  if(selected.length&&!selected.includes(id))continue;
  const source=join(here,'sources-v2',id+'.png');
  if(!existsSync(source))throw Error('Missing source '+id);
  const cut=join(here,'cut',id+'-v2');mkdirSync(cut,{recursive:true});
  const raw=decodePng(readFileSync(source)),keyed=Buffer.alloc(raw.width*raw.height*4);
  for(let i=0;i<raw.width*raw.height;i++) {
    const r=raw.px[i*raw.bpp],g=raw.px[i*raw.bpp+1],b=raw.px[i*raw.bpp+2];
    const spill=Math.max(0,Math.min(r,b)-g),a=spill>60?1-spill/255:1;
    keyed[i*4]=a>0?Math.max(0,(r-255*(1-a))/a):0;
    keyed[i*4+1]=a>0?Math.min(255,g/a):0;
    keyed[i*4+2]=a>0?Math.max(0,(b-255*(1-a))/a):0;
    keyed[i*4+3]=Math.round(a*255);
  }
  const input=join(cut,'keyed.png');writeFileSync(input,encodePng(raw.width,raw.height,keyed));
  execFileSync(process.execPath,['tools/painted-poses.mjs','--sheet',input,'--class',id,'--out',cut,'--poses',poses.join(','),'--grid','3x3','--canvas','1200x1200','--grounded'],{cwd:root,stdio:'pipe'});
  const mf=JSON.parse(readFileSync(join(cut,'lowpoly-renders.manifest.json')));
  const idle=contentBox(decodePng(readFileSync(join(here,'../combat',id,'idle.png'))));
  const ready=mf.renders.find(frame=>frame.pose==='parry1');
  const reference=contentBox(decodePng(readFileSync(join(cut,ready.file))));
  const scale=(idle.y1-idle.y0+1)/(reference.y1-reference.y0+1);
  mkdirSync(join(here,'frames',id),{recursive:true});
  for(const frame of mf.renders) {
    const file=`frames/${id}/${frame.pose}.png`;
    // The default Starseer's generated recovery dropped the shield. Reuse the
    // approved shield hold as the recovery keyframe instead of shipping that.
    if(id==='starseer'&&frame.pose==='shieldBash3') {
      const bytes=readFileSync(join(here,'frames/starseer/shieldGuard3.png'));
      writeFileSync(join(here,file),bytes);
      records.push({id,pose:frame.pose,file,box:contentBox(decodePng(bytes)),floor:600,source:'approved shieldGuard3 recovery'});continue;
    }
    // Keep the approved initial Reaver/Starseer technique pixels intact.
    if(['reaver','starseer'].includes(id)&&!frame.pose.startsWith('shieldBash')) {
      const img=decodePng(readFileSync(join(here,file)));
      records.push({id,pose:frame.pose,file,box:contentBox(img),floor:600,source:'approved-study-01'});continue;
    }
    const img=decodePng(readFileSync(join(cut,frame.file))),b=contentBox(img);
    const small=resample(img,b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1,Math.round((b.x1-b.x0+1)*scale),Math.round((b.y1-b.y0+1)*scale));
    const px=Buffer.alloc(640*640*4),left=Math.round(320+(b.x0-frame.root[0])*scale),top=601-small.height;
    if(left<0||left+small.width>640||top<0)throw Error(`Clipping ${id}/${frame.pose}`);
    for(let y=0;y<small.height;y++)small.px.copy(px,((top+y)*640+left)*4,y*small.width*4,(y+1)*small.width*4);
    writeFileSync(join(here,file),encodePng(640,640,px));
    records.push({id,pose:frame.pose,file,box:contentBox({width:640,height:640,px}),floor:600,scale,source:`sources-v2/${id}.png`});
  }
  console.log(`Built ${id}: 9 technique frames`);
}
if(!selected.length)writeFileSync(join(here,'frames.json'),JSON.stringify({canvas:640,footAnchor:[320,600],frames:records},null,2)+'\n');
