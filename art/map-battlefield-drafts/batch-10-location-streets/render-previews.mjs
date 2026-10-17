import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {loadLocationScenes,directory as dir} from './scenes.mjs';
const data=loadLocationScenes({check:true}),files=new Map(),checks=[];
const sourceByPath=new Map(data.manifest.map(a=>[path.resolve(dir,a.file),a]));
// Older approved sources can be added by an intro-map recipe without duplicating their PNGs.
for(const batch of ['batch-05-regions']){
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'..',batch,'manifest.json')));
 for(const a of manifest.assets)sourceByPath.set(path.resolve(dir,'..',batch,a.file),a);
}
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function url(file){const absolute=path.resolve(dir,file);if(!files.has(absolute))files.set(absolute,'/asset/'+files.size);return files.get(absolute);}
function scene(preset,width,cameraId='landscape'){
 const c=data.cameras.find(c=>c.id===cameraId),scale=width/c.width,height=c.height*scale;
 const ground=preset.layers.find(l=>l.role==='ground'),groundSource=sourceByPath.get(path.resolve(dir,ground.asset)),horizon=groundSource.medianCenterHorizonY*data.canvas.height/groundSource.height;
 if(!Number.isFinite(horizon))throw Error('Missing measured ground horizon '+preset.id);
 const layers=preset.layers.map(layer=>{
  const source=sourceByPath.get(path.resolve(dir,layer.asset)),u=url(layer.asset),grade=layer.previewAmbientGrade;
  const filter=`opacity:${layer.opacity??1};`+(grade?`filter:brightness(${grade.brightness}) saturate(${grade.saturation});`:'');
  if(layer.role==='prop'){
   if(!source?.visibleBoundsAt32)throw Error('Missing measured prop alpha bounds '+layer.asset);
   const [left,top,right,bottom]=source.visibleBoundsAt32,w=right-left,h=bottom-top,p=layer.placement;
   let s=c.height*p.heightFraction/h,x;
   if(p.mode==='side-framing')x=c.x+c.width*p.innerEdgeU-(p.side==='left'?right:left)*s;
   else{
    s=Math.min(s,c.width*p.visibleWidthFraction/w,(horizon+p.baseOcclusionPixels-c.y-12)/h);
    x=c.x+c.width*p.anchorU-(left+right)/2*s;
   }
   if(!(s>0))throw Error('Invalid prop scale '+preset.id);
   const y=horizon+p.baseOcclusionPixels-bottom*s;
   const bounds={left:x+left*s,top:y+top*s,right:x+right*s,bottom:y+bottom*s};
   const inside=bounds.left>=c.x&&bounds.right<=c.x+c.width&&bounds.top>=c.y&&bounds.bottom<=c.y+c.height;
   const clearsCombatCenter=p.mode==='rear-focal'||(p.side==='left'?bounds.right<=c.x+c.width*.4+.01:bounds.left>=c.x+c.width*.6-.01);
   if(!clearsCombatCenter||(!p.intentionalViewportCrop&&!inside))throw Error('Prop placement failed '+preset.id+'/'+cameraId+'/'+layer.asset);
   checks.push({scene:preset.id,camera:cameraId,asset:layer.asset,placementMode:p.mode,intentionalViewportCrop:p.intentionalViewportCrop,insideViewport:inside,clearsCombatCenter,baseOccludedByGround:true,visibleBounds:bounds});
   return `<img src="${u}" style="left:${x}px;top:${y}px;width:${source.width*s}px;height:${source.height*s}px;${filter}">`;
  }
  if(['filter','particles'].includes(layer.role)){
   const side=2*Math.max(c.width,c.height),left=c.x+(c.width-side)/2,top=c.y+(c.height-side)/2;
   const common=`left:${left}px;top:${top}px;width:${side}px;height:${side}px;opacity:${layer.opacity??1};`;
   return layer.role==='filter'?`<img src="${u}" style="${common}">`:`<div class="particles" style="${common}background-image:url('${u}');background-size:1024px 1024px"></div>`;
  }
  return `<img src="${u}" style="inset:0;width:${data.canvas.width}px;height:${data.canvas.height}px;${filter}">`;
 }).join('');
 return `<div class="scene" style="width:${width}px;height:${height}px"><div class="world" style="left:${-c.x*scale}px;top:${-c.y*scale}px;transform:scale(${scale});width:${data.canvas.width}px;height:${data.canvas.height}px">${layers}</div></div>`;
}
const css='<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:15px Arial}h1{font-size:26px;margin:0 0 8px}header p{margin:0 0 20px;color:#b4c6c6;line-height:1.4}main{display:grid;gap:16px}article{background:#24353b;overflow:hidden}article p{margin:12px;font-size:15px;line-height:1.35}.scene{position:relative;overflow:hidden;background:#253139}.world{position:absolute;transform-origin:0 0}.world>img,.particles{position:absolute}</style>';
const head=(title,note)=>`<header><h1>${esc(title)}</h1><p>${esc(note)}</p></header>`;
const card=(preset,width=600,camera='landscape',label=preset.label)=>`<article>${scene(preset,width,camera)}<p>${esc(label)}</p></article>`;
const get=id=>data.scenes.find(p=>p.id===id),pages=new Map();
const groups={streets:['city-street','desert-street','jungle-street','snowy-street','city-street-night','village-lane'],nature:['cave-approach','forest-path','mountain-road','great-tree','open-road','boss-arena-exterior'],interiors:['dungeon-corridor','cave-interior','tunnel-interior','dungeon-stairs','boss-arena-interior','castle-throne-room','cinder-tower','astrologer-chamber'],castles:['castle-grounds','fortress-gate','volcanic-castle-exterior','volcanic-castle-interior']};
for(const [group,ids]of Object.entries(groups))pages.set('/'+group,css+head('Inside the location · '+group,'Separate backdrop, near-side props and floor. Large side props intentionally extend past viewport edges; the combat center stays open.')+'<main style="grid-template-columns:repeat(2,600px)">'+ids.map(id=>card(get(id))).join('')+'</main>');
const introScenes=data.introMap.items.map(item=>{
 const base=structuredClone(get(item.sceneId));base.id='intro:'+item.nodeId;base.label=item.displayName;
 const floorIndex=base.layers.findIndex(l=>l.role==='ground');base.layers.splice(floorIndex,0,...item.additionalProps??[]);return base;
});
pages.set('/intro-map',css+head('Crownfall · the actual intro-map locations','Candidate art for the starter city, six services and five regional gates. Node IDs and positions come from local:crownfall; runtime wiring stays separate.')+'<main style="grid-template-columns:repeat(3,400px)">'+introScenes.map((s,i)=>card(s,400,'landscape',s.label+' · '+data.introMap.items[i].nodeId)).join('')+'</main>');
pages.set('/cameras',css+head('Crownfall street · adjustable framing','Portrait, landscape and ultrawide crops use the same untouched PNGs. Side props move with camera edges; source silhouettes remain complete.')+'<main style="grid-template-columns:270px 800px"><div>'+card(get('city-street'),270,'portrait','Portrait')+'</div><div>'+card(get('city-street'),800,'landscape','Landscape')+card(get('city-street'),800,'ultrawide','Ultrawide')+'</div></main>');
pages.set('/all',css+head('28 editable location scenes','27 settings plus a rain-overlay example. Reuse is by reference; 86 unique new paintings.')+'<main style="grid-template-columns:repeat(3,400px)">'+data.scenes.map(p=>card(p,400)).join('')+'</main>');
for(const preset of [...data.scenes,...introScenes])for(const camera of data.cameras)scene(preset,400,camera.id);
const unique=[...new Map(checks.map(c=>[c.scene+'|'+c.camera+'|'+c.asset,c])).values()];
fs.writeFileSync(path.join(dir,'composition-checks.json'),JSON.stringify({status:'passed',scope:'Static measured alpha>=32 framing bounds across four cameras. Side props deliberately crop at outer edges; this is not actor, animation or arbitrary camera travel QA.',registration:'Wide sources register to a1672x941 CSS canvas. A940-high source stretches vertically by one pixel and its measured horizon follows that registration in the preview only; original PNG bytes stay unchanged.',checks:unique,cameras:data.cameras.map(c=>({id:c.id,insideSourceCanvas:c.x>=0&&c.y>=0&&c.x+c.width<=data.canvas.width&&c.y+c.height<=data.canvas.height}))},null,2)+'\n');
const assets=new Map([...files].map(([f,u])=>[u,f]));
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html');res.end(pages.get(req.url));}else if(assets.has(req.url)){res.setHeader('Content-Type',assets.get(req.url).endsWith('.webp')?'image/webp':'image/png');res.end(fs.readFileSync(assets.get(req.url)));}else{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:1},deviceScaleFactor:1});for(const [route,file]of [...Object.keys(groups).map(g=>['/'+g,'preview-'+g+'.png']),['/intro-map','preview-intro-map.png'],['/cameras','preview-cameras.png'],['/all','preview-all-scenes.png']]){await page.goto('http://127.0.0.1:'+server.address().port+route);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(dir,file),fullPage:true});}console.log(`Rendered seven scene sheets; verified ${unique.length} prop/camera placements.`);}finally{await browser?.close();await new Promise(r=>server.close(r));}
