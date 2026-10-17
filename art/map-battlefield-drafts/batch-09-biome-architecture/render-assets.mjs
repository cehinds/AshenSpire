import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const dir=path.dirname(fileURLToPath(import.meta.url)),brief=JSON.parse(fs.readFileSync(path.join(dir,'brief.json'))),files=new Map();
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const groups=Object.fromEntries([...Object.keys(brief.biomes).map(b=>[b,brief.perBiome.map(n=>b+'/'+n)]),['mountains',brief.mountains.map(n=>'mountains/'+n)]]);
const pages=new Map();
for(const [group,names]of Object.entries(groups)){
 const cards=names.filter(n=>fs.existsSync(path.join(dir,n+'.png'))).map(name=>{const u='/asset/'+files.size;files.set(u,path.join(dir,name+'.png'));return `<article><div class="art"><img src="${u}"></div><p>${esc(name.split('/')[1].replaceAll('-',' '))}</p></article>`;}).join('');
 pages.set('/'+group,`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:15px Arial}h1{font-size:25px;margin:0 0 8px}header p{margin:0 0 20px;color:#b8c6c4}main{display:grid;grid-template-columns:repeat(3,380px);gap:14px}article{padding:10px;background:#25363b;border:1px solid #3b5055;border-radius:7px}.art{height:214px;display:grid;place-items:center;background:linear-gradient(90deg,#bcb8a5 50%,#1b2b30 50%)}img{max-width:100%;max-height:214px;object-fit:contain}article p{margin:10px 0 2px;font-size:14px}</style><header><h1>Ashen Spire · ${esc(group)} · component sources</h1><p>Shared painted world · separate PNG layers · daylight / rain / night</p></header><main>${cards}</main>`);
}
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html');res.end(pages.get(req.url));}else if(files.has(req.url)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(files.get(req.url)));}else{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1216,height:1},deviceScaleFactor:1});for(const group of Object.keys(groups)){await page.goto('http://127.0.0.1:'+server.address().port+'/'+group);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(dir,'preview-assets-'+group+'.png'),fullPage:true});}console.log(`Rendered ${files.size} delivered source cards.`);}finally{await browser?.close();await new Promise(r=>server.close(r));}
