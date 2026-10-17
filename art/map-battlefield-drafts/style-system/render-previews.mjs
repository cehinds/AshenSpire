import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {root,repo,buildLibrary} from './build-library.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const library=buildLibrary(),files=new Map();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const groups={grounds:['battlefield-ground'],props:['battlefield-prop'],backdrops:['battlefield-backdrop'],atmosphere:['color-filter','weather-field','weather-particles','weather-lightning']};
const server=createServer((req,res)=>{const file=files.get(req.url);if(file){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(file));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1196,height:800},deviceScaleFactor:1});
 for(const [group,roles]of Object.entries(groups)){
  const entries=library.items.filter(a=>roles.includes(a.profileId)&&a.review.verdict==='approved');
  const cards=entries.map(item=>{
   const url='/asset/'+files.size;files.set(url,path.resolve(repo,item.asset));
   return `<article><div class="art"><img src="http://127.0.0.1:${server.address().port}${url}"></div><h2>${escape(item.sourceAssetId)}</h2><p>${escape(item.assetKey.split('/')[0])} · ${escape(item.review.verdict)}</p></article>`;
  }).join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:14px Arial}h1{font-size:26px;margin:0 0 10px}header p{color:#bbc7c4;margin:0 0 20px}main{display:grid;grid-template-columns:repeat(3,372px);gap:14px}article{padding:12px;background:#24353b;border:1px solid #395157;border-radius:8px;overflow:hidden}.art{height:210px;display:grid;place-items:center;background:linear-gradient(90deg,#d6d0bd 50%,#1b2b30 50%);border-radius:4px}.art img{max-width:100%;max-height:210px;object-fit:contain}h2{font-size:14px;overflow-wrap:anywhere;margin:10px 0 6px}article p{font-size:12px;color:#b4c3c4;margin:0}</style><header><h1>Ashen Spire · ${escape(group)} · ${entries.length} approved sources</h1><p>Shared painted world · role-specific camera · biome and time-of-day variations preserved</p></header><main>${cards}</main>`);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(root,`preview-${group}.png`),fullPage:true});
  console.log(`Rendered ${group}: ${entries.length} sources.`);
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
