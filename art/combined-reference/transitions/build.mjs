// Technical extraction only: original artwork is retained in masters/.
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const sharp=createRequire(import.meta.url)('sharp'),root='art/combined-reference/transitions';
const sources=JSON.parse(await readFile(`${root}/sources.json`,'utf8'));
const report=[];
for(const [id,s]of Object.entries(sources)){
 await mkdir(`${root}/frames/${id}`,{recursive:true});
 const sheet=sharp(`${root}/masters/${id}.png`),meta=await sheet.metadata();
 assert.equal(meta.width,1536);assert.equal(meta.height,1024);
 for(let i=0;i<7;i++){
  const slot=(s.order||[0,1,2,3,4,5,6])[i],col=slot%4,row=Math.floor(slot/4);
  const left=s.cuts?.[row]?.[col]??col*384,right=s.cuts?.[row]?.[col+1]??(col+1)*384;
  const crop={left:left+3,top:row*512+3,width:right-left-6,height:506};
  const {data,info}=await sheet.clone().extract(crop).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Flood out the neutral gray background; retain the black body and light contour.
  const n=info.width*info.height,seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
  function visit(p){if(seen[p])return;const v=data[p*4];if(v<19||v>100)return;seen[p]=1;queue[tail++]=p;}
  for(let x=0;x<info.width;x++){visit(x);visit((info.height-1)*info.width+x)}
  for(let y=0;y<info.height;y++){visit(y*info.width);visit(y*info.width+info.width-1)}
  while(head<tail){const p=queue[head++],x=p%info.width,y=Math.floor(p/info.width);if(x)visit(p-1);if(x+1<info.width)visit(p+1);if(y)visit(p-info.width);if(y+1<info.height)visit(p+info.width)}
  for(let p=0;p<n;p++)if(seen[p])data[p*4+3]=0;
  let minX=info.width,minY=info.height,maxX=0,maxY=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
  const pivot=s.pivots[slot],dx=330-(pivot[0]-crop.left),dy=490-(pivot[1]-crop.top);
  assert.ok(minX+dx>=0&&maxX+dx<600&&minY+dy>=0&&maxY+dy<560,`${id}/${i} exceeds output canvas`);
  const sprite=await sharp(data,{raw:info}).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).png().toBuffer();
  await sharp({create:{width:600,height:560,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:minX+dx,top:minY+dy}]).png().toFile(`${root}/frames/${id}/${i}.png`);
  report.push({id,frame:i,sourceSlot:slot,pivot,sourceCrop:crop,bounds:[minX+dx,minY+dy,maxX+dx,maxY+dy]});
 }
}
await writeFile(`${root}/extraction.json`,JSON.stringify(report,null,2)+'\n');
console.log(`Extracted ${report.length} frames on a shared 600 × 560 canvas; no per-frame rescaling.`);
