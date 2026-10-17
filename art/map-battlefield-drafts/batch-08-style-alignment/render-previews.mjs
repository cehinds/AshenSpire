import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {loadStyleLibrary,checkStyleAsset} from '../style-system/art-style.mjs';
import {repo} from '../style-system/build-library.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),recipe=JSON.parse(fs.readFileSync(path.join(dir,'composition.example.json'))),library=loadStyleLibrary(),files=new Map();
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
for(const scene of recipe.scenes)for(const layer of scene.layers){const item=library.items.find(i=>i.assetKey===layer.assetKey);if(!item)throw new Error('Missing source '+layer.assetKey);const errors=checkStyleAsset(library,path.resolve(repo,item.asset),[item.profileId]);if(errors.length)throw new Error(errors.join('\n'));}
function art(layers,width){return `<div class="scene" style="width:${width}px;height:${width*recipe.canvas.height/recipe.canvas.width}px">`+layers.map(l=>{const item=library.items.find(i=>i.assetKey===l.assetKey);if(!item)throw new Error('Unknown source '+l.assetKey);const url='/asset/'+files.size;files.set(url,path.resolve(repo,item.asset));return `<img src="${url}" style="opacity:${l.opacity}">`;}).join('')+'</div>';}
const style='<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#142126;color:#e6ebe4;font:16px Arial}h1{font-size:26px;margin:0 0 8px}header p{color:#b7c6c6;margin:0 0 22px}.grid{display:grid;gap:16px}article{background:#24353b;padding-bottom:12px}.scene{position:relative;overflow:hidden;background:#17252b}.scene img{position:absolute;width:100%;height:100%;inset:0}article p{margin:10px 12px 0}h2{font-size:18px;margin:0 0 10px}section{margin-bottom:24px}</style>';
const scenes=style+'<header><h1>One painted world · coherent layered components</h1><p>Shared material language · biome palettes preserved · unchanged PNG sources</p></header><main class="grid" style="grid-template-columns:repeat(3,400px)">'+recipe.scenes.map(s=>`<article>${art(s.layers,400)}<p>${esc(s.label)}</p></article>`).join('')+'</main>';
const comparisons=style+'<header><h1>Style corrections · before / after</h1><p>Four corrected sources · original drafts retained as history</p></header>'+recipe.comparisons.map(c=>`<section><h2>${esc(c.label)}</h2><div class="grid" style="grid-template-columns:repeat(2,600px)"><article>${art(c.before,600)}<p>Before</p></article><article>${art(c.after,600)}<p>After · approved collection</p></article></div></section>`).join('');
const pages=new Map([['/',scenes],['/comparison',comparisons]]);
const server=createServer((req,res)=>{if(pages.has(req.url)){res.setHeader('Content-Type','text/html');res.end(pages.get(req.url));}else if(files.has(req.url)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(files.get(req.url)));}else{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1280,height:1},deviceScaleFactor:1});for(const [route,file]of [['/','preview-scenes.png'],['/comparison','preview-comparison.png']]){await page.goto('http://127.0.0.1:'+server.address().port+route);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(dir,file),fullPage:true});}console.log('Rendered three approved layered scenes and three before/after pairs.');}finally{await browser?.close();await new Promise(r=>server.close(r));}
