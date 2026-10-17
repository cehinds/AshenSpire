import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync, readdirSync} from 'node:fs';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dir=fileURLToPath(new URL('.',import.meta.url));
const recipe=JSON.parse(readFileSync(dir+'/composition.example.json'));
const scene=`<style>body{margin:0;overflow:hidden;background:#111}img{position:absolute}</style>${recipe.layersBackToFront.map(x=>`<img src="/${x.file}" style="left:${x.placement.left}px;top:${x.placement.top}px;width:${x.placement.width}px;height:${x.placement.height}px">`).join('')}`;
const maps=readdirSync(dir).filter(x=>x.startsWith('map-')&&x.endsWith('.png')).sort();
const sheet=`<meta charset="utf-8"><style>body{margin:0;padding:30px;background:#182328;color:#e6e5dc;font:18px sans-serif}h1{font-size:26px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}article{background:#263539;padding:12px;text-align:center;border-radius:10px}img{width:256px;height:256px;object-fit:contain}.small{width:64px;height:64px;vertical-align:middle}p{margin:6px}</style><h1>Batch 02 · map prop drafts</h1><main>${maps.map(x=>`<article><img src="/${x}"><p>${x.replace('map-','').replace('.png','').replaceAll('-',' ')}</p><img class="small" src="/${x}"><span> 64px readability</span></article>`).join('')}</main>`;
const server=createServer((req,res)=>{if(req.url==='/'||req.url==='/sheet'){res.setHeader('Content-Type','text/html');res.end(req.url==='/'?scene:sheet);}else if(/^\/[a-z0-9-]+\.png$/.test(req.url)){try{res.setHeader('Content-Type','image/png');res.end(readFileSync(dir+req.url));}catch{res.statusCode=404;res.end();}}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));
 await page.screenshot({path:dir+'/preview-night-composition.png'});
 await page.setViewportSize({width:1060,height:920});
 await page.goto('http://127.0.0.1:'+server.address().port+'/sheet');
 await page.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));
 await page.screenshot({path:dir+'/preview-map-props.png',fullPage:true});
 console.log('Rendered night stack and '+maps.length+'-prop contact sheet; source pixels unchanged.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
