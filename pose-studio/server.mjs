import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authoringRoot,compositeSourcePath,isAuthoringFile} from '../tools/art-authoring.mjs';

// Game code/editor pages always come from this root; mutable source art comes
// from an explicit AI-Art/ashenspire checkout, never a verified runtime cache.
export function projectRoot(argv=[],env={}){const i=argv.indexOf('--project'),dir=i>=0?argv[i+1]:env.POSE_STUDIO_ROOT;return dir?path.resolve(dir):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');}
let artPath=null;try{({artPath}=await import('../tools/art-source.mjs'));}catch{/* portable package has materialized runtime art */}
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
export function createHandler({root=projectRoot(),assetRoot,env=process.env}={}){
  root=path.resolve(root);
  const artCheckout=authoringRoot({root,assetRoot,env,required:false}),checkout=existsSync(path.join(root,'art-release.json'));
  return function(req,res){(async()=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(decoded==='/__serve/info'){
      const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress||'')&&/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'');
      res.writeHead(local?200:403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      return res.end(JSON.stringify(local?{root}:{error:'Local requests only.'}));
    }
    const name=decoded==='/'?'/pose-studio/index.html':decoded;
    if(!/^\/(pose-studio|src|engine|assets|assets-mobile|assets-display|assets-alternative|art)\//.test(name)&&name!=='/AshenSpire.html'){res.writeHead(404);return res.end();}
    if(name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}
    const rel=name.slice(1);
    let target=compositeSourcePath(rel,{root,assetRoot:artCheckout,env});
    const runtimeImage=/^(assets|assets-mobile|assets-display)\//.test(rel)&&!/^assets-display\/.*\.(json|md)$/.test(rel);
    if(checkout&&runtimeImage&&!(artCheckout&&isAuthoringFile(rel))){
      if(!artPath)throw Error('Runtime art resolver is missing');
      try{target=artPath(rel,{root,env});}catch(error){if(!rel.startsWith('assets/'))throw error;target=artPath('assets-mobile/'+rel.slice(7),{root,env});}
    }
    if((await stat(target)).isDirectory())target=path.join(target,'index.html');
    const bytes=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:bytes);
  })().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end('Not found');});};
}
const isMain=Boolean(process.argv[1])&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
const argv=isMain?process.argv.slice(2):[],i=argv.indexOf('--asset-root');
export const handler=createHandler({root:projectRoot(argv,process.env),assetRoot:i>=0?argv[i+1]:undefined});
if(isMain){const server=http.createServer(handler);server.listen(Number(process.env.POSE_STUDIO_PORT||4318),'127.0.0.1',()=>console.log(`Pose Studio ready: http://127.0.0.1:${server.address().port}/pose-studio/index.html`));}
