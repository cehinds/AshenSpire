import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { decodePng, encodePng, contentBox, resample } from '../../../tools/concept-cutout.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const records = [];
for (const id of ['reaver', 'starseer']) {
  const cut = join(here, 'cut', id), out = join(here, 'frames', id);
  mkdirSync(out, { recursive:true });
  mkdirSync(cut, { recursive:true });
  const raw=decodePng(readFileSync(join(here,'sources',`${id}.png`)));
  const keyed=Buffer.alloc(raw.width*raw.height*4);
  // Unmix the requested magenta matte before the standard pose cutter. Retain
  // fractional edge alpha instead of leaving a bright fringe on a dark stage.
  for(let i=0;i<raw.width*raw.height;i++) {
    const r=raw.px[i*raw.bpp],g=raw.px[i*raw.bpp+1],b=raw.px[i*raw.bpp+2];
    const spill=Math.max(0,Math.min(r,b)-g);
    const alpha=spill>25?1-spill/255:1;
    keyed[i*4]=alpha>0?Math.max(0,(r-255*(1-alpha))/alpha):0;
    keyed[i*4+1]=alpha>0?Math.min(255,g/alpha):0;
    keyed[i*4+2]=alpha>0?Math.max(0,(b-255*(1-alpha))/alpha):0;
    keyed[i*4+3]=Math.round(alpha*255);
  }
  const keyedFile=join(cut,'keyed.png');
  writeFileSync(keyedFile,encodePng(raw.width,raw.height,keyed));
  execFileSync(process.execPath, ['tools/painted-poses.mjs', '--sheet',keyedFile,
    '--class',id,'--out',cut,'--poses','shieldGuard1,shieldGuard2,shieldGuard3,parry1,parry2,parry3',
    '--grid','2x3','--canvas','1000x1000','--grounded'], { cwd:root,stdio:'pipe' });
  const manifest = JSON.parse(readFileSync(join(cut,'lowpoly-renders.manifest.json')));
  const reference = contentBox(decodePng(readFileSync(join(here,'../combat',id,'idle.png'))));
  const first = manifest.renders.find(frame => frame.pose === 'parry1');
  const box = contentBox(decodePng(readFileSync(join(cut,first.file))));
  // ONE scale per sheet, anchored against the existing idle body, not per-frame
  // fit-to-box. A raised shield must not shrink the figure. Feet remain at 600.
  const scale = (reference.y1-reference.y0+1)/(box.y1-box.y0+1);
  for (const frame of manifest.renders) {
    const source=decodePng(readFileSync(join(cut,frame.file))), b=contentBox(source);
    const resized=resample(source,b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1,
      Math.round((b.x1-b.x0+1)*scale),Math.round((b.y1-b.y0+1)*scale));
    const output=Buffer.alloc(640*640*4);
    const left=Math.round(320+(b.x0-frame.root[0])*scale), top=601-resized.height;
    if(left<0 || left+resized.width>640 || top<0) throw new Error(`${id}/${frame.pose} clips`);
    for(let y=0;y<resized.height;y++) resized.px.copy(output,((top+y)*640+left)*4,y*resized.width*4,(y+1)*resized.width*4);
    const file=`frames/${id}/${frame.pose}.png`;
    writeFileSync(join(here,file),encodePng(640,640,output));
    records.push({id,pose:frame.pose,file,scale,box:contentBox({width:640,height:640,px:output}),floor:600});
  }
}
writeFileSync(join(here,'frames.json'),JSON.stringify({canvas:640,footAnchor:[320,600],frames:records},null,2)+'\n');
console.log(`Built ${records.length} technique frames.`);
