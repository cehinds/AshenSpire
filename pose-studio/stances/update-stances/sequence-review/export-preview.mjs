// Preview-only mechanical crop/registration. Never writes shipped assets/catalogs/rigs.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const out = fileURLToPath(new URL('./', import.meta.url));
const spec = JSON.parse(readFileSync(resolve(out,'sources.json'),'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
mkdirSync(resolve(out,'frames'),{recursive:true});
const inputs = spec.sources.map(source => {
  const bytes=readFileSync(resolve(root,source.source));
  if(sha(bytes)!==source.sha256) throw new Error('Source hash changed: '+source.id);
  return {source,dataUrl:'data:image/'+(source.preserveBytes?'webp':'png')+';base64,'+bytes.toString('base64')};
});
const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});
let generated;
try {
  const page=await browser.newPage();
  generated=await page.evaluate(async ({inputs,canvas})=>{
    const result=[];
    for(const {source,dataUrl} of inputs){
      if(source.preserveBytes) continue;
      const img=new Image();img.src=dataUrl;await img.decode();
      if(img.width!==source.size[0]||img.height!==source.size[1])throw new Error('Wrong source size: '+source.id);
      const src=document.createElement('canvas');src.width=img.width;src.height=img.height;
      const ctx=src.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const pixels=ctx.getImageData(0,0,src.width,src.height).data;
      const [cx,cy,cx1,cy1]=source.cropBounds,w=cx1-cx,h=cy1-cy;
      const [sx,sy,sx1,sy1]=source.sourceBounds;
      const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);let seed=-1;
      for(let y=sy;y<sy1&&seed<0;y++)for(let x=sx;x<sx1;x++)if(pixels[(y*src.width+x)*4+3]>32){seed=(y-cy)*w+x-cx;break;}
      if(seed<0)throw new Error('No selected opaque figure: '+source.id);
      let head=0,tail=0;queue[tail++]=seed;mask[seed]=1;
      while(head<tail){
        const n=queue[head++],x=n%w,y=(n/w)|0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||yy<0||xx>=w||yy>=h)continue;
          const k=yy*w+xx;
          if(!mask[k]&&pixels[((yy+cy)*src.width+xx+cx)*4+3]>1){mask[k]=1;queue[tail++]=k;}
        }
      }
      const crop=document.createElement('canvas');crop.width=w;crop.height=h;
      const cc=crop.getContext('2d'),data=cc.createImageData(w,h);
      let x0=cx1,y0=cy1,x1=cx,y1=cy,excludedStrong=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const k=y*w+x,n=((y+cy)*src.width+x+cx)*4;
        if(mask[k]){
          data.data.set(pixels.subarray(n,n+4),k*4);
          if(pixels[n+3]>32){x0=Math.min(x0,x+cx);y0=Math.min(y0,y+cy);x1=Math.max(x1,x+cx+1);y1=Math.max(y1,y+cy+1);}
        }else if(pixels[n+3]>32)excludedStrong++;
      }
      if(JSON.stringify([x0,y0,x1,y1])!==JSON.stringify(source.sourceBounds))throw new Error('Selected component bounds changed: '+source.id+' '+[x0,y0,x1,y1]);
      cc.putImageData(data,0,0);
      const output=document.createElement('canvas');output.width=canvas.width;output.height=canvas.height;
      const oc=output.getContext('2d');oc.imageSmoothingEnabled=true;oc.imageSmoothingQuality='high';
      const drawX=canvas.bodyX-(source.sourceAnchor[0]-cx)*source.scale;
      const drawY=canvas.floorY-(source.sourceAnchor[1]-cy)*source.scale;
      const dw=w*source.scale,dh=h*source.scale;
      if(drawX<0||drawY<0||drawX+dw>canvas.width||drawY+dh>canvas.height)throw new Error('Preview crop would clip: '+source.id);
      oc.drawImage(crop,drawX,drawY,dw,dh);
      const px=oc.getImageData(0,0,canvas.width,canvas.height).data;
      let bx0=canvas.width,by0=canvas.height,bx1=0,by1=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(px[(y*canvas.width+x)*4+3]>32){
        bx0=Math.min(bx0,x);by0=Math.min(by0,y);bx1=Math.max(bx1,x+1);by1=Math.max(by1,y+1);
      }
      if(Math.abs(by1-canvas.floorY)>1)throw new Error('Floor registration drift: '+source.id);
      result.push({id:source.id,source,drawTransform:{x:drawX,y:drawY,scale:source.scale},excludedStrong,bounds:[bx0,by0,bx1,by1],bytes:output.toDataURL('image/webp',.9).split(',')[1]});
    }
    return result;
  },{inputs,canvas:spec.canvas});
}finally{await browser.close();}
const frames={};
for(const item of generated){
  const bytes=Buffer.from(item.bytes,'base64'),imagePath='frames/'+item.id+'.webp';
  writeFileSync(resolve(out,imagePath),bytes);
  frames[item.id]={id:item.id,label:item.source.label,imagePath,size:[spec.canvas.width,spec.canvas.height],drawOffset:[0,0],anchor:[spec.canvas.bodyX,spec.canvas.floorY],sha256:sha(bytes),source:item.source,drawTransform:item.drawTransform,bounds:item.bounds,excludedStrong:item.excludedStrong,registration:'manual pelvis projection + unchanged source scale + common floor; no alpha-bounds horizontal centering'};
}
for(const source of spec.sources.filter(s=>s.preserveBytes)){
  const bytes=readFileSync(resolve(root,source.source)),imagePath='frames/'+source.id+'.webp';
  writeFileSync(resolve(out,imagePath),bytes);
  frames[source.id]={id:source.id,label:source.label,imagePath,size:source.size,drawOffset:[spec.canvas.bodyX-source.sourceAnchor[0],spec.canvas.floorY-source.sourceAnchor[1]],anchor:[spec.canvas.bodyX,spec.canvas.floorY],sha256:sha(bytes),source,bytesUnchanged:true};
}
const contract={schemaVersion:1,status:'sequence-order review only; no shipped runtime, catalogs, rigs or selections changed',canvas:spec.canvas,anchorMethod:'manual pelvis projection on common floor; swords/capes do not select horizontal anchor',frames,attack:{status:'pending six owner-selected source figures',frameIds:[]}};
writeFileSync(resolve(out,'preview-assets.json'),JSON.stringify(contract,null,2)+'\n');
console.log('Wrote preview-only frames: '+Object.keys(frames).join(', ')+'; existing S bytes unchanged; attack preview pending.');

