import {gameAsset} from '../paired-game.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const dir=fileURLToPath(new URL('.',import.meta.url));
const recipe=JSON.parse(readFileSync(resolve(dir,'composition.example.json'))),manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json')));
const byFile=new Map(manifest.assets.map(a=>[a.file,a])),files=new Map();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function url(file){const path=file.startsWith('../../../assets-mobile/')?gameAsset(file.slice(9)):resolve(dir,file);if(!files.has(path))files.set(path,'/asset/'+files.size);return files.get(path);}
const checks=[];
function scene(preset,width,cameraId='landscape'){
 const c=recipe.cameras[cameraId],scale=width/c.width,height=c.height*scale;
 const backdropScale=preset.backdropScale??1;
 if(backdropScale<1)throw new Error('Backdrop scale must cover the canvas');
 const backdropStyle=`left:${1672*(1-backdropScale)/2}px;top:${941*(1-backdropScale)}px;width:${1672*backdropScale}px;height:${941*backdropScale}px`;
 const props=preset.props.map(prop=>{
  const a=byFile.get(prop.file),b=a.visibleBoundsAt32;
  const s=Math.min(c.width*prop.visibleWidthFraction/(b[2]-b[0]),c.height*prop.maximumHeightFraction/(b[3]-b[1]));
  const x=c.left+c.width*prop.anchorU-(b[0]+b[2])/2*s,y=preset.groundContactY+prop.baseOcclusionPixels-b[3]*s;
  const bounds={left:x+b[0]*s,top:y+b[1]*s,right:x+b[2]*s,bottom:y+b[3]*s};
  const inside=bounds.left>=c.left&&bounds.right<=c.left+c.width&&bounds.top>=c.top&&bounds.bottom<=c.top+c.height;
  checks.push({preset:preset.id,camera:cameraId,file:prop.file,visibleBounds:bounds,insideViewport:inside});
  return `<img src="${url(prop.file)}" style="left:${x}px;top:${y}px;width:${a.width*s}px;height:${a.height*s}px">`;
 }).join('');
 return `<div class="scene" style="width:${width}px;height:${height}px"><div class="world" style="left:${-c.left*scale}px;top:${-c.top*scale}px;transform:scale(${scale})"><img src="${url(preset.backdrop)}" style="${backdropStyle}">${props}<img src="${url(preset.ground)}" style="inset:0;width:1672px;height:941px"></div></div>`;
}
const style='<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#182328;color:#e6e5dc;font:17px sans-serif}h1{font-size:25px;margin:0 0 18px}p{margin:10px}main{display:grid;gap:16px}article{background:#263539}.scene{position:relative;overflow:hidden;background:#30383b}.world{position:absolute;transform-origin:0 0;width:1672px;height:941px}.world img{position:absolute}.map{width:120px;height:180px;object-fit:contain;align-self:center}.region{display:flex;gap:16px;background:#263539;padding:12px;align-items:center}.props img{width:230px;height:230px;object-fit:contain}</style>';
const overview=style+'<h1>Regional grounds and independent props · draft combinations</h1><main style="grid-template-columns:repeat(2,600px)">'+recipe.presets.filter(p=>p.overview).map(p=>'<article>'+scene(p,600)+'<p>'+escape(p.label)+'</p></article>').join('')+'</main>';
const regionIds=['ashen-crown','hollow-weald','pale-marches','cinder-reach','drowned-coast'];
const matches=style+'<h1>Live map palette → two regional ground combinations</h1><main>'+regionIds.map(id=>'<section class="region"><img class="map" src="'+url('../../../assets-mobile/environments/'+id+'-map.webp')+'">'+recipe.presets.filter(p=>p.regionId===id).slice(0,2).map(p=>'<article>'+scene(p,520)+'<p>'+escape(p.label)+'</p></article>').join('')+'</section>').join('')+'</main>';
const all=style+'<h1>All 13 ground and backdrop combinations</h1><main style="grid-template-columns:repeat(3,400px)">'+recipe.presets.map(p=>'<article>'+scene(p,400)+'<p>'+escape(p.label)+'</p></article>').join('')+'</main>';
const props=style+'<h1>Twelve separate rear-scene props</h1><main class="props" style="grid-template-columns:repeat(4,280px)">'+manifest.assets.filter(a=>a.category==='prop').map(a=>'<article style="text-align:center;padding:10px"><img src="'+url(a.file)+'"><p>'+escape(a.id.replaceAll('/',' / ').replaceAll('-',' '))+'</p></article>').join('')+'</main>';
const cropPreset=recipe.presets.find(p=>p.id==='hollow-weald/ground-moss-clearing');
const crops=style+'<h1>Same sources · props repositioned for each camera</h1><main style="grid-template-columns:270px 1fr"><article>'+scene(cropPreset,270,'portrait')+'<p>Portrait 450 × 800 source crop</p></article><div><article>'+scene(cropPreset,800,'landscape')+'<p>Landscape 960 × 540 source crop</p></article><article style="margin-top:16px">'+scene(cropPreset,800,'ultrawide')+'<p>Ultrawide 1280 × 540 source crop</p></article></div></main>';
for(const preset of recipe.presets)for(const id of Object.keys(recipe.cameras))scene(preset,400,id);
const uniqueChecks=[...new Map(checks.map(c=>[c.preset+'|'+c.camera+'|'+c.file,c])).values()];
if(uniqueChecks.some(c=>!c.insideViewport))throw new Error('A prop silhouette exceeds its camera viewport.');
writeFileSync(resolve(dir,'composition-checks.json'),JSON.stringify({status:'passed',scope:'Measured alpha>=32 prop bounds and camera-rectangle coverage; not actor or animation QA.',cameraCoverage:Object.entries(recipe.cameras).map(([id,c])=>{if(c.left<0||c.top<0||c.left+c.width>1672||c.top+c.height>941)throw new Error('Camera exceeds painted canvas');return {id,insidePaintedCanvas:true};}),checks:uniqueChecks},null,2)+'\n');
const pages=new Map([['/',overview],['/matches',matches],['/all',all],['/props',props],['/crops',crops]]),assets=new Map([...files].map(([path,u])=>[u,path]));
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pages.get(req.url));}else if(assets.has(req.url)){const p=assets.get(req.url);res.setHeader('Content-Type',p.endsWith('.webp')?'image/webp':'image/png');res.end(readFileSync(p));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({deviceScaleFactor:1});
 for(const [route,width,file] of [['/',1264,'preview-regions.png'],['/matches',1264,'preview-map-matches.png'],['/all',1280,'preview-all-combinations.png'],['/props',1216,'preview-props.png'],['/crops',1120,'preview-camera-crops.png']]){await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:'+server.address().port+route);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:file.startsWith('../../../assets-mobile/')?gameAsset(file.slice(9)):resolve(dir,file),fullPage:true});}
 console.log('Rendered 5 review sheets; verified '+uniqueChecks.length+' prop/camera bounds.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
