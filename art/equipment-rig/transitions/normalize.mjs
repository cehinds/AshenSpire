import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),sharp=require('sharp');
const base='art/equipment-rig/transitions';
export const NORMALIZATION={reaver:{scale:.85,x:125,y:45,width:2038},starseer:{scale:.70,x:155,y:180,width:2172}};
// One shared scale and vertical registration per strip. No pose is independently
// fitted. The generator returned an opaque pale matte; only edge-connected
// pale neutral pixels are removed. Large enclosed white matte islands are also
// removed; small enclosed metallic highlights are retained.
for(const cls of ['reaver','starseer']){
 const {data,info}=await sharp(`${base}/masters/${cls}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,n=w*h,seen=new Uint8Array(n),queue=new Int32Array(n);let count=0;
 const pale=i=>{const k=i*4;return Math.min(data[k],data[k+1],data[k+2])>165&&Math.max(data[k],data[k+1],data[k+2])-Math.min(data[k],data[k+1],data[k+2])<25};
 const add=i=>{if(!seen[i]&&pale(i)){seen[i]=1;queue[count++]=i}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 for(let q=0;q<count;q++){const i=queue[q],x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w)}
 for(let i=0;i<n;i++)if(seen[i])data[i*4+3]=0;
 // Bent elbows and staff gaps enclose matte. Preserve small bright highlights,
 // but remove connected near-white neutral islands larger than 24 pixels.
 const holes=new Uint8Array(n),white=i=>{const k=i*4;return data[k+3]&&Math.min(data[k],data[k+1],data[k+2])>225&&Math.max(data[k],data[k+1],data[k+2])-Math.min(data[k],data[k+1],data[k+2])<18};
 for(let i=0;i<n;i++)if(!holes[i]&&white(i)){let size=1;queue[0]=i;holes[i]=1;for(let q=0;q<size;q++){const p=queue[q],x=p%w,y=Math.floor(p/w);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!holes[j]&&white(j)){holes[j]=1;queue[size++]=j}}}if(size>24)for(let q=0;q<size;q++)data[queue[q]*4+3]=0;}
 // Connected silhouettes separate the cape/blade overflow across nominal cells.
 const labels=new Int32Array(n),components=[];let label=0;
 for(let i=0;i<n;i++)if(data[i*4+3]&&!labels[i]){
  label++;let size=1;queue[0]=i;labels[i]=label;let x0=w,y0=h,x1=0,y1=0;
  for(let q=0;q<size;q++){const p=queue[q],x=p%w,y=Math.floor(p/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&!labels[j]&&data[j*4+3]){labels[j]=label;queue[size++]=j}}
  }
  components.push({label,size,x0,y0,x1,y1});
 }
 const figures=components.sort((a,b)=>b.size-a.size).slice(0,5).sort((a,b)=>a.x0-b.x0),config=NORMALIZATION[cls];
 await mkdir(`${base}/${cls}`,{recursive:true});
 for(const [index,fig]of figures.entries()){
  const assigned=components.filter(c=>c.label===fig.label||(c.size>8&&Math.abs((c.x0+c.x1)/2-(fig.x0+fig.x1)/2)<110&&c.y0>=fig.y0&&c.y1<=fig.y1));
  const accepted=new Set(assigned.map(c=>c.label));const frame=Buffer.alloc(n*4);
  for(let i=0;i<n;i++)if(accepted.has(labels[i]))data.copy(frame,i*4,i*4,i*4+4);
  const x0=Math.min(...assigned.map(c=>c.x0)),x1=Math.max(...assigned.map(c=>c.x1));
  const strip=await sharp(frame,{raw:{width:w,height:h,channels:4}}).extract({left:x0,top:0,width:x1-x0+1,height:h}).resize({width:Math.round((x1-x0+1)*config.scale),height:Math.round(h*config.scale)}).png().toBuffer();
  const left=Math.round(config.x+(x0-index*w/5)*config.scale),top=config.y;
  const placed=await sharp({create:{width:640,height:Math.max(640,top+Math.round(h*config.scale)),channels:4,background:'#00000000'}}).composite([{input:strip,left,top}]).png().toBuffer();
  await sharp(placed).extract({left:0,top:0,width:640,height:640}).png().toFile(`${base}/${cls}/between${index+1}.png`);
 }
 await writeFile(`${base}/${cls}/normalization.json`,JSON.stringify({config,figures,matteRemoved:count},null,2));
 console.log(cls,figures.map(c=>({size:c.size,bounds:[c.x0,c.y0,c.x1,c.y1]})));
}
