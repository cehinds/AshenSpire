import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.POSE_STUDIO_PORT||4318);
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
export function handler(req,res){(async()=>{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}const url=new URL(req.url,'http://localhost'),decoded=decodeURIComponent(url.pathname);const name=decoded==='/'?'/pose-studio/index.html':decoded;if(!/^\/(pose-studio|src|assets|assets-mobile|assets-alternative|art)\//.test(name)&&name!=='/AshenSpire.html'){res.writeHead(404);return res.end();}if(name.includes('\\')||name.includes('\0')||name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}let target=path.resolve(root,'.'+name);if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}target=await artTarget(name,target);if((await stat(target)).isDirectory())target=path.join(target,'index.html');const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);})().catch(()=>{if(!res.headersSent)res.writeHead(404);res.end('Not found');});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))http.createServer(handler).listen(port,'127.0.0.1',()=>console.log(`Pose Studio ready: http://127.0.0.1:${port}/pose-studio/index.html`));
