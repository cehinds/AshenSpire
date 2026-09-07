import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {decodePng,encodePng,contentBox,resample} from '../../tools/concept-cutout.mjs';
const here=dirname(fileURLToPath(import.meta.url)), repo=join(here,'../..');
const jobs=JSON.parse(readFileSync(join(here,'requirements.json'),'utf8')).outfits;
const poses=['stand','guard','attack1','attack2','attack3','attack4','hit','detail','portrait'];
const reviewPath=join(here,'selection.json');
const choices=existsSync(reviewPath)?JSON.parse(readFileSync(reviewPath,'utf8')):{};
const reavers=['reaver','reaver-vigil','reaver-oathsworn','reaver-warden'];
const corrections=join(here,'cut-corrections');
mkdirSync(corrections,{recursive:true});
execFileSync(process.execPath,['tools/painted-poses.mjs','--sheet',join(here,'combat-sheets/reaver-facing-corrections.png'),'--class','facing','--out',corrections,'--poses',reavers.map(x=>x+'-guard').concat(reavers.map(x=>x+'-hit')).join(','),'--grid','2x4','--canvas','800x800','--grounded'],{cwd:repo,stdio:'pipe'});
const correctionFrames=JSON.parse(readFileSync(join(corrections,'lowpoly-renders.manifest.json'),'utf8')).renders;
const duelistCut=join(here,'cut-duelist');
mkdirSync(duelistCut,{recursive:true});
execFileSync(process.execPath,['tools/painted-poses.mjs','--sheet',join(here,'combat-sheets/rogue-duelist-facing-corrections.png'),'--class','duelist','--out',duelistCut,'--poses','guard,attack1,attack2,attack3,attack4,hit','--grid','2x3','--canvas','800x800','--grounded'],{cwd:repo,stdio:'pipe'});
const duelistFrames=JSON.parse(readFileSync(join(duelistCut,'lowpoly-renders.manifest.json'),'utf8')).renders;
const selected=process.argv.slice(2);
const results=[];
for(const job of jobs){
 if(selected.length&&!selected.includes(job.id))continue;
 const source=join(here,'menu-sheets',job.id+'.png');
 if(!existsSync(source)){console.log('Pending '+job.id);continue;}
 const cut=join(here,'cut-menu',job.id);mkdirSync(cut,{recursive:true});
 const args=['tools/painted-poses.mjs','--sheet',source,'--class',job.id,'--out',cut,'--poses',poses.join(','),'--grid','3x3','--canvas','800x800','--grounded'];
 if(choices[job.id]?.mirror?.length)args.push('--mirror',choices[job.id].mirror.join(','));
 const log=execFileSync(process.execPath,args,{cwd:repo,encoding:'utf8'});
 writeFileSync(join(cut,'cut.log'),log);
 const mf=JSON.parse(readFileSync(join(cut,'lowpoly-renders.manifest.json'),'utf8'));
 const raw=Object.fromEntries(mf.renders.map(r=>[r.pose,{...r,sourceSheet:'menu-sheets/'+job.id+'.png',img:decodePng(readFileSync(join(cut,r.file)))}]));
 if(reavers.includes(job.id)){
  const target=contentBox(raw.stand.img),guard=correctionFrames.find(r=>r.pose===job.id+'-guard');
  const guardImg=decodePng(readFileSync(join(corrections,guard.file))),reference=contentBox(guardImg);
  const sourceScale=(target.y1-target.y0+1)/(reference.y1-reference.y0+1);
  for(const p of ['guard','hit']){const r=correctionFrames.find(r=>r.pose===job.id+'-'+p);raw[p]={...r,pose:p,sourceScale,sourceSheet:'combat-sheets/reaver-facing-corrections.png',img:decodePng(readFileSync(join(corrections,r.file)))};}
 }
 if(job.id==='rogue-duelist'){
  const oldBox=contentBox(raw.guard.img),guard=duelistFrames.find(r=>r.pose==='guard');
  const newBox=contentBox(decodePng(readFileSync(join(duelistCut,guard.file))));
  const sourceScale=(oldBox.y1-oldBox.y0+1)/(newBox.y1-newBox.y0+1);
  for(const r of duelistFrames)raw[r.pose]={...r,sourceScale,sourceSheet:'combat-sheets/rogue-duelist-facing-corrections.png',img:decodePng(readFileSync(join(duelistCut,r.file)))};
 }
 const fighters=/^(rogue|reaver)/.test(job.id);
 const mapping={idle:fighters?'guard':'stand',guard:'guard',attack1:'attack1',attack2:'attack2',attack3:'attack3',attack4:'attack4',hit:'hit',...choices[job.id]?.mapping};
 const combat=Object.entries(mapping).map(([pose,from])=>({...raw[from],pose,from}));
 const standBox=contentBox(raw.stand.img);
 let scale=340/(standBox.y1-standBox.y0+1);
 for(const r of combat){
  const b=contentBox(r.img);
  const sourceScale=r.sourceScale||1;
  scale=Math.min(scale,290/(Math.max(r.root[0]-b.x0,b.x1-r.root[0])*sourceScale),560/(Math.max(1,r.ground-b.y0)*sourceScale));
 }
 const out=join(here,'combat',job.id);mkdirSync(out,{recursive:true});
 const frames=[];
 for(const r of combat){
  const frameScale=scale*(r.sourceScale||1);
  const src=r.img, w=Math.round(src.width*frameScale),h=Math.round(src.height*frameScale);
  const small=resample(src,0,0,src.width,src.height,w,h);
  const ox=Math.round(320-r.root[0]*frameScale),oy=Math.round(600-r.ground*frameScale);
  const px=Buffer.alloc(640*640*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const tx=x+ox,ty=y+oy;if(tx<0||tx>=640||ty<0||ty>=640)continue;
   const s=(y*w+x)*4,d=(ty*640+tx)*4;small.px.copy(px,d,s,s+4);
  }
  const file='combat/'+job.id+'/'+r.pose+'.png';
  writeFileSync(join(here,file),encodePng(640,640,px));
  const box=contentBox({width:640,height:640,bpp:4,px});
  frames.push({pose:r.pose,sourcePose:r.from,sourceSheet:r.sourceSheet,file,box,anchor:[320,600]});
 }
 const menu=join(here,'menu',job.id);mkdirSync(menu,{recursive:true});
 for(const p of ['stand','detail','portrait']){
  const img=raw[p].img,b=contentBox(img),bw=b.x1-b.x0+1,bh=b.y1-b.y0+1;
  const cw=p==='portrait'?512:640,ch=p==='portrait'?512:800,pad=16;
  const s=Math.min((cw-pad*2)/bw,(ch-pad*2)/bh),w=Math.round(bw*s),h=Math.round(bh*s);
  const small=resample(img,b.x0,b.y0,bw,bh,w,h),px=Buffer.alloc(cw*ch*4);
  const ox=Math.floor((cw-w)/2),oy=ch-pad-h;
  for(let y=0;y<h;y++)small.px.copy(px,((y+oy)*cw+ox)*4,y*w*4,(y+1)*w*4);
  writeFileSync(join(menu,p+'.png'),encodePng(cw,ch,px));
 }
 results.push({...job,scale,canvas:[640,640],frames,menu:{stand:'menu/'+job.id+'/stand.png',detail:'menu/'+job.id+'/detail.png',portrait:'menu/'+job.id+'/portrait.png'},source:'menu-sheets/'+job.id+'.png'});
 console.log(job.id+': '+frames.length+' combat states, 2 menu poses, 1 portrait; shared scale '+scale.toFixed(3));
}
const path=join(here,'manifest.json');
const prev=existsSync(path)?JSON.parse(readFileSync(path,'utf8')).outfits:[];
writeFileSync(path,JSON.stringify({schema:1,generator:'Built-in image_gen; extracted with tools/painted-poses.mjs',status:'Art preview; not installed in game',outfits:jobs.map(j=>results.find(r=>r.id===j.id)||prev.find(r=>r.id===j.id)).filter(Boolean)},null,2)+'\n');
