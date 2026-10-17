import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {loadBiomeScenes} from './scenes.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),data=loadBiomeScenes({check:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))),byFile=new Map(manifest.assets.map(a=>[a.file,a])),files=new Map(),checks=[];
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function url(file){const absolute=path.resolve(dir,file);if(!files.has(absolute))files.set(absolute,'/asset/'+files.size);return files.get(absolute);}
function scene(preset,width,cameraId='landscape'){
 const c=data.cameras.find(c=>c.id===cameraId),scale=width/c.width,height=c.height*scale;
 const ground=preset.layers.find(l=>l.role==='ground'),horizon=ground.sourceMetrics.medianCenterHorizonY;
 if(!Number.isFinite(horizon))throw new Error('Missing measured ground horizon for '+preset.id);
 const layers=preset.layers.map(layer=>{
  const source=byFile.get(layer.asset),u=url(layer.asset);
  if(layer.role==='prop'){
   const [left,top,right,bottom]=source.visibleBoundsAt32,w=right-left,h=bottom-top;
   const margin=12,xCenter=c.x+c.width*layer.anchorU;
   const availableWidth=2*Math.min(xCenter-c.x-margin,c.x+c.width-xCenter-margin);
   const availableHeight=horizon+layer.baseOcclusionPixels-c.y-margin;
   const s=Math.min(c.width*layer.visibleWidthFraction/w,c.height*layer.maxHeightFraction/h,availableWidth/w,availableHeight/h);
   if(!(s>0))throw new Error('Prop does not fit camera '+preset.id+'/'+cameraId);
   const x=xCenter-(left+right)/2*s,y=horizon+layer.baseOcclusionPixels-bottom*s;
   const bounds={left:x+left*s,top:y+top*s,right:x+right*s,bottom:y+bottom*s};
   const inside=bounds.left>=c.x&&bounds.right<=c.x+c.width&&bounds.top>=c.y&&bounds.bottom<=c.y+c.height;
   checks.push({scene:preset.id,camera:cameraId,asset:layer.asset,insideViewport:inside,visibleBounds:bounds});
   if(!inside)throw new Error('Visible prop exceeds camera '+preset.id+'/'+cameraId);
   const grade=layer.previewAmbientGrade,filter=grade?`filter:brightness(${grade.brightness}) saturate(${grade.saturation});`:'';
   return `<img src="${u}" style="left:${x}px;top:${y}px;width:${source.width*s}px;height:${source.height*s}px;${filter}">`;
  }
  if(['filter','particles'].includes(layer.role)){
   const side=2*Math.max(c.width,c.height),left=c.x+(c.width-side)/2,top=c.y+(c.height-side)/2;
   const common=`left:${left}px;top:${top}px;width:${side}px;height:${side}px;opacity:${layer.opacity??1}`;
   return layer.role==='filter'?`<img src="${u}" style="${common}">`:`<div class="particles" style="${common};background-image:url('${u}');background-size:1024px 1024px"></div>`;
  }
  return `<img src="${u}" style="inset:0;width:${data.canvas.width}px;height:${data.canvas.height}px">`;
 }).join('');
 return `<div class="scene" style="width:${width}px;height:${height}px"><div class="world" style="left:${-c.x*scale}px;top:${-c.y*scale}px;transform:scale(${scale});width:${data.canvas.width}px;height:${data.canvas.height}px">${layers}</div></div>`;
}
const css='<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:15px Arial}h1{font-size:26px;margin:0 0 8px}header p{margin:0 0 20px;color:#b4c6c6}main{display:grid;gap:16px}article{background:#24353b;overflow:hidden}article p{margin:12px;font-size:15px;line-height:1.35}.scene{position:relative;overflow:hidden;background:#253139}.world{position:absolute;transform-origin:0 0}.world>img,.particles{position:absolute}h2{font-size:17px;margin:0 0 12px}.ridge{height:225px;display:grid;place-items:center;background:#a5b1b4}.ridge img{max-width:100%;max-height:225px;object-fit:contain}</style>';
const head=(title,note)=>`<header><h1>${esc(title)}</h1><p>${esc(note)}</p></header>`;
const card=(preset,width,camera='landscape',label=preset.id)=>`<article>${scene(preset,width,camera)}<p>${esc(label.replaceAll('-',' '))}</p></article>`;
const get=(b,l,c)=>data.presets.find(p=>p.biome===b&&p.location===l&&p.condition===c);
const biomes=data.biomes.map(b=>b.id),conditions=['day','rain','night'];
const pages=new Map();
pages.set('/',css+head('Desert · jungle · snow | daylight, rain and night','Each row shares architecture and materials; night towns, grounds and skies have their own paintings.')+'<main style="grid-template-columns:repeat(3,400px)">'+biomes.flatMap(b=>conditions.map(c=>card(get(b,'town',c),400))).join('')+'</main>');
pages.set('/architecture',css+head('Cities · castles · dungeon entrances','Independent transparent architecture props over matched biome grounds and backdrops.')+'<main style="grid-template-columns:repeat(3,400px)">'+biomes.flatMap(b=>['city','castle','dungeon-entrance'].map(l=>card(get(b,l,'day'),400))).join('')+'</main>');
pages.set('/dungeons',css+head('Dungeon entrances and interiors','Each biome has a separate entrance prop, floor and interior backdrop. Indoor weather is excluded.')+'<main style="grid-template-columns:repeat(2,600px)">'+biomes.flatMap(b=>[card(get(b,'dungeon-entrance','day'),600),card(get(b,'dungeon','local-ambient'),600)]).join('')+'</main>');
const crops=get('jungle','town','night');
pages.set('/cameras',css+head('Night jungle town · responsive placement across cameras','Measured alpha bounds keep props inside these reviewed crops. More painted edges are needed for arbitrary camera travel.')+'<main style="grid-template-columns:270px 800px"><div>'+card(crops,270,'portrait','portrait crop')+'</div><div>'+card(crops,800,'landscape','landscape crop')+card(crops,800,'ultrawide','ultrawide crop')+'</div></main>');
pages.set('/mountains',css+head('Mountain props · near and faded distance','Dry, volcanic and snowy ridges. Separate transparent paintings; distant shapes use softer, lighter, lower-contrast forms.')+'<main style="grid-template-columns:repeat(2,600px)">'+['dry','volcanic','snowy'].flatMap(b=>['near','distant'].map(depth=>`<article><div class="ridge"><img src="${url(`mountains/prop-mountain-${b}-${depth}.png`)}"></div><p>${esc(b+' / '+depth)}</p></article>`)).join('')+'</main>');
pages.set('/all',css+head('All 39 editable scene combinations','New palette candidates; no live-world assignment or production binding.')+'<main style="grid-template-columns:repeat(3,400px)">'+data.presets.map(p=>card(p,400)).join('')+'</main>');
for(const preset of data.presets)for(const camera of data.cameras)scene(preset,400,camera.id);
const unique=[...new Map(checks.map(c=>[c.scene+'|'+c.camera+'|'+c.asset,c])).values()];
fs.writeFileSync(path.join(dir,'composition-checks.json'),JSON.stringify({status:'passed',scope:'Measured alpha>=32 prop bounds inside four static camera crops; no actor or motion QA.',propFitPolicy:'Desired sizes are limited by available space around the requested anchor and measured ground horizon.',checks:unique,cameras:data.cameras.map(c=>({id:c.id,insideSourceCanvas:c.x>=0&&c.y>=0&&c.x+c.width<=data.canvas.width&&c.y+c.height<=data.canvas.height}))},null,2)+'\n');
const assets=new Map([...files].map(([file,u])=>[u,file]));
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html');res.end(pages.get(req.url));}else if(assets.has(req.url)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(assets.get(req.url)));}else{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:1},deviceScaleFactor:1});for(const [route,file]of [['/','preview-conditions.png'],['/architecture','preview-architecture.png'],['/dungeons','preview-dungeons.png'],['/cameras','preview-cameras.png'],['/mountains','preview-mountains.png'],['/all','preview-all-scenes.png']]){await page.goto('http://127.0.0.1:'+server.address().port+route);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(dir,file),fullPage:true});}console.log(`Rendered six composition sheets and verified ${unique.length} prop/camera bounds.`);}finally{await browser?.close();await new Promise(r=>server.close(r));}
