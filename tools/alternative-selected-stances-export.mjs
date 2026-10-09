import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),review='pose-studio/stances/options-20261008/';
const selections=JSON.parse(readFileSync(root+review+'selections.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const c of selections.choices)if(sha(readFileSync(root+review+c.source.path))!==c.source.sha256)throw Error('Source changed '+c.sourceOption);
const browser=await chromium.launch({headless:true,...(process.env.CHROME ? {executablePath:process.env.CHROME} : {})});
try{
 const page=await browser.newPage();await page.goto((process.env.STANCE_REVIEW_URL || 'http://127.0.0.1:4391/'+review+'index.html'));
 const exports=await page.evaluate(async selections=>{
  const pieces=[];
  for(const choice of selections.choices){
   const img=new Image();img.src=new URL(choice.source.path,location.href).href;await img.decode();
   const v=choice.source.view,c=document.createElement('canvas');c.width=v.width;c.height=v.height;
   const ctx=c.getContext('2d');ctx.drawImage(img,v.x,v.y,v.width,v.height,0,0,v.width,v.height);
   const p=ctx.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
   pieces.push({choice,canvas:c,bounds:[x0,y0,x1,y1]});
  }
  return pieces.map(({choice,canvas,bounds})=>{
   const own=pieces.filter(p=>p.choice.actor===choice.actor);
   const scale=Math.min(420/Math.max(...own.map(p=>p.bounds[3]-p.bounds[1])),470/Math.max(...own.map(p=>p.bounds[2]-p.bounds[0])));
   const [x0,y0,x1,y1]=bounds,w=Math.round((x1-x0)*scale),h=Math.round((y1-y0)*scale),x=Math.round(256-w/2),y=464-h;
   const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,x0,y0,x1-x0,y1-y0,x,y,w,h);
   const lite=document.createElement('canvas');lite.width=lite.height=256;lite.getContext('2d').drawImage(c,0,0,256,256);
   return {choice,scale,sourceBounds:bounds,bounds:[x,y,x+w,y+h],full:c.toDataURL('image/webp',.9).split(',')[1],lite:lite.toDataURL('image/webp',.84).split(',')[1]};
  });
 },selections);
 const catalog={schemaVersion:1,selections:review+'selections.json',classes:{},hashes:{}};
 for(const e of exports){
  const actor=e.choice.actor,stance={attack:'offensive',defend:'defensive',casting:'casting'}[e.choice.stance];
  const dir='assets-display/alternative/stances/'+actor;mkdirSync(root+dir,{recursive:true});
  const path=dir+'/'+stance+'.webp',lite=dir+'/'+stance+'-mobile.webp',full=Buffer.from(e.full,'base64'),small=Buffer.from(e.lite,'base64');
  writeFileSync(root+path,full);writeFileSync(root+lite,small);
  catalog.hashes[path.replace('assets-display/alternative/','')]=sha(full);catalog.hashes[lite.replace('assets-display/alternative/','')]=sha(small);
  const item=catalog.classes[actor]??={frames:{}};
  item.frames[stance]={path,lite,size:[512,512],bounds:e.bounds,anchor:[256,464],sha256:sha(full),liteSha256:sha(small),sourceOption:e.choice.sourceOption,source:e.choice.source,sourceBounds:e.sourceBounds,scale:e.scale};
 }
 catalog.filePaths=Object.fromEntries(Object.keys(catalog.hashes).map(file=>[file,'assets-display/alternative/'+file]));
 writeFileSync(root+'src/content/alternativeSelectedStances.js','// Owner-selected held poses, exported from unchanged comparison artwork.\nexport const alternativeSelectedStances = '+JSON.stringify(catalog)+';\n');
 mkdirSync(root+'pose-studio/stances/selected-projects',{recursive:true});
 for(const [actor,{frames}]of Object.entries(catalog.classes)){
  const rig={schemaVersion:1,id:'alternative.selected-stances.'+actor,name:actor+' · selected stances',canvas:{width:512,height:512},assets:{},poses:{},animations:{},queues:{}};
  for(const [stance,f]of Object.entries(frames)){
   rig.assets[stance]={id:stance,src:'data:image/webp;base64,'+readFileSync(root+f.path).toString('base64')};
   rig.poses[stance]={id:stance,name:stance,reviewed:true,notes:'Owner-selected pose. Flattened source artwork; floor registration only.',bones:[],layers:[{id:'figure',name:'Selected figure',role:'body',assetId:stance,x:0,y:0,rotation:0,scale:1,opacity:1,pivot:[256,464],visible:true,locked:false,anchors:[{id:'floor',kind:'joint',name:'Floor',x:256,y:464}]}]};
   rig.animations[stance]={id:stance,name:stance,frames:[{id:stance+'-held',poseId:stance,duration:260,event:'',overrides:{}}]};
  }
  rig.queues.review={id:'review',name:'Selected stances',items:Object.keys(frames).map(s=>({id:s,animationId:s,repeats:1,pause:600}))};
  writeFileSync(root+'pose-studio/stances/selected-projects/'+actor+'.rig.json',JSON.stringify(rig,null,2)+'\n');
 }
 console.log('Exported 12 approved stances, 24 Full/Lite assets and four Workshop projects.');
}finally{await browser.close();}

