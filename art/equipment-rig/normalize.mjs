import {createRequire} from 'node:module';import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),sharp=require('sharp');
const base='art/equipment-rig';
const parts=['head','torso','hip','cloak','nearUpper','nearFore','nearClosed','nearOpen','farUpper','farFore','farClosed','farOpen'];
// The generator supplied an opaque pale checkerboard, even after alpha correction.
// Edge-connected matte extraction leaves enclosed armor highlights intact.
for(const id of ['reaver','starseer']){
 const {data,info}=await sharp(`${base}/masters/${id}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,n=w*h,seen=new Uint8Array(n),queue=new Int32Array(n);let count=0;
 const pale=i=>{const k=i*4;return Math.min(data[k],data[k+1],data[k+2])>210&&Math.max(data[k],data[k+1],data[k+2])-Math.min(data[k],data[k+1],data[k+2])<22};
 const add=i=>{if(!seen[i]&&pale(i)){seen[i]=1;queue[count++]=i}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 for(let q=0;q<count;q++){const i=queue[q],x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w)}
 for(let i=0;i<n;i++)if(seen[i])data[i*4+3]=0;
 const normalized=await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
 await mkdir(`${base}/parts/${id}`,{recursive:true});await writeFile(`${base}/parts/${id}/atlas.png`,normalized);
 const bounds={};
 for(let i=0;i<12;i++){
  const col=i%4,row=Math.floor(i/4);let x0=col*w/4,x1=(col+1)*w/4,y0=row*h/3,y1=(row+1)*h/3;
  // The Reaver cloak tail extends a little left of the nominal top-right cell.
  if(row===0&&id==='reaver'){if(col===2)x1=1045;if(col===3)x0=1045}
  let minX=w,minY=h,maxX=0,maxY=0;
  for(let y=Math.ceil(y0);y<y1;y++)for(let x=Math.ceil(x0);x<x1;x++)if(data[(y*w+x)*4+3]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  if(maxX<=minX||maxY<=minY)throw Error(id+' missing '+parts[i]);
  const rect={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};bounds[parts[i]]=rect;
  await sharp(normalized).extract(rect).png().toFile(`${base}/parts/${id}/${parts[i]}.png`);
 }
 await writeFile(`${base}/parts/${id}/bounds.json`,JSON.stringify(bounds,null,2));console.log(id,12+' parts',count+' transparent pixels');
}
