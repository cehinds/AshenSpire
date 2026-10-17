import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dir=fileURLToPath(new URL('.',import.meta.url));
const recipe=JSON.parse(readFileSync(resolve(dir,'composition.example.json')));
const maps=readdirSync(dir).filter(x=>x.startsWith('map-')&&x.endsWith('.png')).sort();
const files=[...new Set([...maps,...recipe.presets.flatMap(p=>p.layersBackToFront.map(l=>l.file))])];
const assetUrl=file=>'/asset/'+files.indexOf(file);
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function scene(preset,width){
 const scale=width/recipe.canvas.width;
 return `<div style="position:relative;overflow:hidden;width:${width}px;height:${recipe.canvas.height*scale}px"><div style="position:absolute;transform-origin:0 0;transform:scale(${scale});width:${recipe.canvas.width}px;height:${recipe.canvas.height}px">${preset.layersBackToFront.map(l=>`<img src="${assetUrl(l.file)}" style="position:absolute;left:${l.placement.left}px;top:${l.placement.top}px;width:${l.placement.width}px;height:${l.placement.height}px">`).join('')}</div></div>`;
}
const full=`<meta charset="utf-8"><style>body{margin:0;background:#182328}</style>${scene(recipe.presets.find(p=>p.id==='misty-clearing'),recipe.canvas.width)}`;
const gallery=`<meta charset="utf-8"><style>body{margin:0;padding:24px;background:#182328;color:#e6e5dc;font:18px sans-serif}h1{font-size:25px;margin:0 0 20px}main{display:grid;grid-template-columns:repeat(2,608px);gap:16px}article{background:#263539}p{margin:12px}</style><h1>One component set · four misty scene combinations</h1><main>${recipe.presets.map(p=>`<article>${scene(p,608)}<p>${escape(p.label)}</p></article>`).join('')}</main>`;
const sheet=`<meta charset="utf-8"><style>body{margin:0;padding:24px;background:#182328;color:#e6e5dc;font:18px sans-serif}h1{font-size:25px}main{display:grid;grid-template-columns:repeat(2,350px);gap:16px}article{background:#263539;padding:12px;text-align:center;border-radius:10px}img{width:256px;height:256px;object-fit:contain}.small{width:64px;height:64px;vertical-align:middle}p{margin:6px}</style><h1>Batch 03 · travel landmarks</h1><main>${maps.map(f=>`<article><img src="${assetUrl(f)}"><p>${escape(f.replace('map-','').replace('.png','').replaceAll('-',' '))}</p><img class="small" src="${assetUrl(f)}"><span> 64px readability</span></article>`).join('')}</main>`;
const pages=new Map([['/',full],['/gallery',gallery],['/sheet',sheet]]);
const assets=new Map(files.map((f,i)=>['/asset/'+i,resolve(dir,f)]));
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pages.get(req.url));}else if(assets.has(req.url)){res.setHeader('Content-Type','image/png');res.end(readFileSync(assets.get(req.url)));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const [route,width,height,file] of [['/',recipe.canvas.width,recipe.canvas.height,'preview-misty-composition.png'],['/gallery',1280,900,'preview-scene-combinations.png'],['/sheet',764,900,'preview-map-props.png']]){
  await page.setViewportSize({width,height});
  await page.goto('http://127.0.0.1:'+server.address().port+route);
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await page.screenshot({path:resolve(dir,file),fullPage:true});
 }
 console.log('Rendered three previews from '+recipe.presets.length+' composition presets and '+maps.length+' map props. Source PNGs unchanged.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
