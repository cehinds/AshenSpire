import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {directory as dir} from './scenes.mjs';
const brief=JSON.parse(fs.readFileSync(path.join(dir,'brief.json'))),files=new Map(),pages=new Map();
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const groups={streets:['city-street','desert-street','jungle-street','snowy-street','city-street-night','village-lane'],nature:['cave-approach','forest-path','mountain-road','great-tree','open-road'],interiors:['dungeon-corridor','cave-interior','tunnel-interior','dungeon-stairs','boss-arena-interior','castle-throne-room','cinder-tower','astrologer-chamber'],landmarks:['castle-grounds','fortress-gate','boss-arena-exterior','volcanic-castle-exterior','volcanic-castle-interior'],intro:['intro-forge','intro-chapel','intro-archive']};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
for(const [group,settings]of Object.entries(groups)){
 const cards=settings.flatMap(setting=>brief.assetNames.map(role=>{
  const spec=brief.settings[setting],ref=spec.reuse?.[role]??setting+'/'+role,file=path.join(dir,ref+'.png');
  if(!fs.existsSync(file))return '';
  const u='/asset/'+files.size;files.set(u,file);
  return `<article><div class="art"><img src="${u}"></div><p>${esc(setting+' / '+role)}${spec.reuse?.[role]?' · reused':''}</p></article>`;
 })).join('');
 pages.set('/'+group,`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:14px Arial}h1{font-size:25px;margin:0 0 8px}header p{color:#b6c6c6;margin:0 0 20px}main{display:grid;grid-template-columns:repeat(4,290px);gap:12px}article{background:#25363b;padding:10px;border:1px solid #3b5055}.art{height:182px;display:grid;place-items:center;background:linear-gradient(90deg,#bcb8a5 50%,#1b2b30 50%)}img{max-width:100%;max-height:182px;object-fit:contain}article p{font-size:12px;line-height:1.4;min-height:34px;margin:8px 0 0}</style><header><h1>Close locations · ${esc(group)} · source layers</h1><p>Backdrop / floor / left prop / right prop. Independent PNGs and explicit reuse.</p></header><main>${cards}</main>`);
}
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html');res.end(pages.get(req.url));}else if(files.has(req.url)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(files.get(req.url)));}else{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1244,height:1},deviceScaleFactor:1});for(const group of Object.keys(groups)){await page.goto('http://127.0.0.1:'+server.address().port+'/'+group);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(dir,'preview-sources-'+group+'.png'),fullPage:true});}console.log('Rendered delivered source/reuse sheets for five location groups.');}finally{await browser?.close();await new Promise(r=>server.close(r));}
