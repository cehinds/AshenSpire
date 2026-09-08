import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const sharp=createRequire(import.meta.url)('sharp');
const root='art/attack-library';
const outfitIds={reaver:['reaver','reaver-vigil','reaver-oathsworn','reaver-warden'],rogue:['rogue','rogue-nightveil','rogue-duelist','rogue-shadow'],starseer:['starseer','starseer-eclipse','starseer-starlit','starseer-astral'],herald:['herald','herald-ossuary','herald-emberhabit','herald-pilgrim']};
const sources=JSON.parse(await readFile(`${root}/sources.json`,'utf8'));
const manifest={format:1,frameSize:640,frameCount:7,sequences:{},issues:[]};
function marker(data,w,h,kind,relaxed=false){
 const matches=[];
 for(let i=0;i<w*h;i++){
  if(!data[i*4+3])continue;
  const [r,g,b]=data.subarray(i*4,i*4+3);
  if(kind==='main'?(relaxed?r>95&&b>60&&b>r*.45&&g<r*.65&&g<b*.72:r>165&&b>130&&g<110&&r-g>65):(relaxed?b>85&&r<100&&b>r*1.6&&b>g*1.45:b>165&&r<100&&g<120&&b-g>80))matches.push(i);
 }
 if(matches.length<2)return relaxed?null:marker(data,w,h,kind,true);
 // Keep the largest connected marker, ignoring similarly colored accents.
 const pool=new Set(matches),groups=[];
 while(pool.size){const first=pool.values().next().value,group=[first];pool.delete(first);
  for(let q=0;q<group.length;q++){const p=group[q],x=p%w,y=Math.floor(p/w);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&pool.delete(j))group.push(j)}}groups.push(group);
 }
 const candidates=groups.filter(g=>g.length>=2&&g.length<=300&&Math.max(...g.map(i=>i%w))-Math.min(...g.map(i=>i%w))<25&&Math.max(...g.map(i=>Math.floor(i/w)))-Math.min(...g.map(i=>Math.floor(i/w)))<25);
 const group=candidates.sort((a,b)=>b.length-a.length)[0];
 if(!group)return relaxed?null:marker(data,w,h,kind,true);
 const entry=g=>({point:[g.reduce((n,i)=>n+i%w,0)/g.length,g.reduce((n,i)=>n+Math.floor(i/w),0)/g.length],pixels:g});
 return {...entry(group),candidates:candidates.map(entry)};
}
function isolateSubject(raw,w,h){
 const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let largest=[];
 for(let p=0;p<w*h;p++)if(raw[p*4+3]&&!visited[p]){let n=1;queue[0]=p;visited[p]=1;
  for(let q=0;q<n;q++){const i=queue[q],x=i%w,y=Math.floor(i/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&raw[j*4+3]&&!visited[j]){visited[j]=1;queue[n++]=j}}}
  if(n>largest.length)largest=queue.slice(0,n);
 }
 const keep=new Uint8Array(w*h);for(const i of largest)keep[i]=1;for(let i=0;i<w*h;i++)if(!keep[i])raw[i*4+3]=0;
}
for(const source of sources){
 await mkdir(`${root}/masters`,{recursive:true});
 const master=`${root}/masters/${source.cls}-${source.clip}.png`;
 // A checkout can rebuild from its retained master without the originating
 // machine's generated-images directory.
 if(existsSync(source.source))await copyFile(source.source,master);
 else if(!existsSync(master))throw new Error(`Missing source and retained master: ${master}`);
 const {data,info}=await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(source.supersedes&&existsSync(source.supersedes)){await mkdir(`${root}/rejected`,{recursive:true});await copyFile(source.supersedes,`${root}/rejected/${source.cls}-${source.clip}.png`);}
 const gridWidth=Math.floor(info.width/7),cw=gridWidth+40,ch=Math.floor(info.height/4),scale=360/ch;
 for(let row=0;row<4;row++){
  const outfit=outfitIds[source.cls][row],id=`${outfit}/${source.clip}`,dir=`${root}/frames/${id}`;
  await mkdir(dir,{recursive:true});const frames=[];
  for(let col=0;col<7;col++){
   const raw=Buffer.alloc(cw*ch*4);
   const start=col*gridWidth-20,from=Math.max(0,start),to=Math.min(info.width,start+cw);
   for(let y=0;y<ch;y++)data.copy(raw,(y*cw+from-start)*4,((row*ch+y)*info.width+from)*4,((row*ch+y)*info.width+to)*4);
   // Technical matte extraction. Original RGB masters are always retained.
   for(let i=0;i<cw*ch;i++){
    const k=i*4,r=raw[k],g=raw[k+1],b=raw[k+2];
   if(g>120&&b>120&&Math.abs(g-b)<22&&g-r>18&&b-r>18)raw[k+3]=0;
   }
   isolateSubject(raw,cw,ch);
   // Remove cyan matte spill only at exposed edges; preserve the teal cloth
   // inside Rogue silhouettes. Work from the original alpha for one pass.
   const alpha=Uint8Array.from({length:cw*ch},(_,i)=>raw[i*4+3]);
   for(let y=1;y<ch-1;y++)for(let x=1;x<cw-1;x++){
    const i=y*cw+x,k=i*4,r=raw[k],g=raw[k+1],b=raw[k+2];
    if(alpha[i]&&g-r>10&&b-r>10&&Math.abs(g-b)<18&&[i-1,i+1,i-cw,i+cw].some(j=>!alpha[j]))raw[k+3]=0;
   }
   let main=marker(raw,cw,ch,'main'),off=marker(raw,cw,ch,'off');
   // Some twin study markers use the wrong color. These two forward strike
   // poses have a clearly separated rightmost main grip and leftmost off grip.
   if(source.clip==='twin'&&[2,4].includes(col)){
    const dots=[...(main?.candidates||[]),...(off?.candidates||[])].sort((a,b)=>a.point[0]-b.point[0]);
    if(dots.length>=2){off=dots[0];main=dots[dots.length-1];}
   }
   // Directly traced visible fists in the staff studies where blue was omitted.
   if(source.cls==='reaver'&&source.clip==='staff'&&!off&&col<=1)off={point:[20+gridWidth*(col===0?.82:.84),ch*.40],pixels:[],traced:true};
   const free=['empty','focus','bash'].includes(source.clip)||source.clip.endsWith('-free');
   if(!main||!off&&!free){manifest.issues.push(`${id}/${col}: missing ${!main?'main':'off'} registration`);frames.push(null);continue}
   // Registration holes expose the inserted grip; the surrounding painted
   // fingers remain on the foreground hand overlay without repainting them.
   for(const p of [...main.pixels,...(off?.pixels||[])])raw[p*4+3]=0;
   let footY=0;for(let y=0;y<ch;y++){let count=0;for(let x=0;x<cw;x++)if(raw[(y*cw+x)*4+3]>128)count++;if(count>3)footY=y;}
   const rw=Math.round(cw*scale),rh=Math.round(ch*scale),left=Math.round(320-rw/2),top=Math.round(540-footY*scale);
   const input=await sharp(raw,{raw:{width:cw,height:ch,channels:4}}).resize(rw,rh).png().toBuffer();
   const frame=await sharp({create:{width:640,height:640,channels:4,background:'#00000000'}}).composite([{input,left,top}]).png().toBuffer();
   const path=`${dir}/${col+1}.webp`;await sharp(frame).webp({lossless:true,effort:1}).toFile(path);
   const toPoint=p=>[Math.round(left+p[0]*scale),Math.round(top+p[1]*scale)];
   const anchors={main:toPoint(main.point),off:off?toPoint(off.point):null};
   const hands={};
   for(const hand of ['main','off'].filter(h=>anchors[h])){
    const center=anchors[hand],radius=Math.max(9,Math.round(Math.sqrt((hand==='main'?main:off).pixels.length/Math.PI)*scale+6));
    const x=Math.max(0,center[0]-radius),y=Math.max(0,center[1]-radius),size=radius*2;
    const crop=await sharp(frame).extract({left:x,top:y,width:size,height:size}).png().toBuffer();
    const file=`${dir}/${col+1}-${hand}.webp`;await sharp(crop).webp({lossless:true,effort:1}).toFile(file);
    hands[hand]={file,x,y,size};
   }
   frames.push({file:path,anchors,hands});
  }
  // The exact opening guard closes the loop without a regenerated outfit or
  // hand-position jump. The raw seventh drawing remains in the master sheet.
  if(frames[0])frames[6]=frames[0];
  manifest.sequences[id]={classId:source.cls,outfit,clip:source.clip,status:frames.every(Boolean)?'needs-visual-review':'registration-incomplete',frames};
 }
}
await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2));
console.log(JSON.stringify({sequences:Object.keys(manifest.sequences).length,frames:Object.values(manifest.sequences).reduce((s,x)=>s+x.frames.filter(Boolean).length,0),issues:manifest.issues}));
