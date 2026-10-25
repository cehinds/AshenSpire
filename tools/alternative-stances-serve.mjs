import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { artPath } from './art-source.mjs';
import { authoringRoot, compositeSourcePath, isAuthoringFile } from './art-authoring.mjs';

const args=process.argv.slice(2), option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=authoringRoot({root,assetRoot:option('--asset-root',undefined),required:false}), port=Number(option('--port','4329'));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
http.createServer((req,res)=>(async()=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name.includes('\\')||name.includes('\0')||name.split('/').some(part=>part.startsWith('.'))){res.writeHead(403);res.end();return;}
  const rel=name==='/'?'pose-studio/stances/index.html':name.slice(1);
  if(!/^(pose-studio|src|engine|assets-mobile|assets|assets-display)\//.test(rel)){res.writeHead(404);res.end();return;}
  let target=compositeSourcePath(rel,{root,assetRoot:assets});
  if(!(assets&&isAuthoringFile(rel))&&/^(assets-mobile|assets|assets-display)\//.test(rel)&&!/^assets-display\/.*\.(json|md)$/.test(rel)){
    try{target=artPath(rel,{root});}catch(error){if(!rel.startsWith('assets/'))throw error;target=artPath('assets-mobile/'+rel.slice(7),{root});}
  }
  if((await stat(target)).isDirectory())target=path.join(target,'index.html');
  const bytes=await readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:bytes);
})().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end('Not found');})).listen(port,'127.0.0.1',()=>console.log(`Stance preview: http://127.0.0.1:${port}/pose-studio/stances/index.html`));
