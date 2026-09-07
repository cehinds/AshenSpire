import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(root,'../..');
const port=Number(process.argv[2]||4287);
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    const base=/^\/(src|assets)\//.test(url.pathname)?repo:root;
    const path=resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/animation-groups/reaver.html':url.pathname));
    if(!path.startsWith(base+sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(path);
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(path)]||'application/octet-stream');
    res.end(data);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Animation review: http://127.0.0.1:${port}/animation-groups/reaver.html`));
