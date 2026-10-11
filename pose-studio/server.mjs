import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// The project served: `--project <dir>` (the Workbench passes its root), else
// POSE_STUDIO_ROOT, else the checkout holding this file.
export function projectRoot(argv=[],env={}){const i=argv.indexOf('--project'),dir=i>=0?argv[i+1]:env.POSE_STUDIO_ROOT;return dir?path.resolve(dir):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');}
const isMain=Boolean(process.argv[1])&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
const root=projectRoot(isMain?process.argv.slice(2):[],process.env),port=Number(process.env.POSE_STUDIO_PORT||4318);
// The art left this checkout at docs/EXTERNAL-ASSETS-PLAN.md step 13. A file
// on disk is served as before (the packaged app, pose-studio/package.mjs, copies
// its assets/ folders in, and ships no tools/). In a checkout, /assets/â€¦ not on
// disk is read from the fetched packs (tools/art-source.mjs: the high pack, else
// the light twin), and /art/â€¦ from a cehinds/AshenSpire-art checkout named by
// ASHEN_ART_CHECKOUT; without either it is a 404.
let artPath=null;try{({artPath}=await import('../tools/art-source.mjs'));}catch{/* packaged: no tools/ beside it */}
async function onDisk(p){try{await stat(p);return true;}catch{return false;}}
async function artTarget(name,target){if(await onDisk(target))return target;const rel=name.slice(1);if(rel.startsWith('assets/')&&artPath){try{return artPath(rel);}catch{}try{return artPath('assets-mobile/'+rel.slice(7));}catch{}return target;}if(rel.startsWith('art/')&&process.env.ASHEN_ART_CHECKOUT){const base=path.resolve(process.env.ASHEN_ART_CHECKOUT),t=path.resolve(base,rel);if(t.startsWith(base+path.sep))return t;}return target;}
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
export function handler(req,res){(async()=>{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}const url=new URL(req.url,'http://localhost'),decoded=decodeURIComponent(url.pathname);if(decoded==='/__serve/info'){const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress||'')&&/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'');res.writeHead(local?200:403,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(JSON.stringify(local?{root}:{error:'Local requests only.'}));}const name=decoded==='/'?'/pose-studio/index.html':decoded;if(!/^\/(pose-studio|src|assets|assets-mobile|assets-alternative|art)\//.test(name)&&name!=='/AshenSpire.html'){res.writeHead(404);return res.end();}if(name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}let target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}target=await artTarget(name,target);if((await stat(target)).isDirectory())target=path.join(target,'index.html');const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);})().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end('Not found');});}
if(isMain){const server=http.createServer(handler);server.listen(port,'127.0.0.1',()=>console.log(`Pose Studio ready: http://127.0.0.1:${server.address().port}/pose-studio/index.html`));}
