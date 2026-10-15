import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const out=dirname(fileURLToPath(import.meta.url));
const repo=resolve(process.env.ASHENSPIRE_REPO||new URL('../../../AshenSpire/',import.meta.url).pathname);
const {serve}=await import(pathToFileURL(resolve(repo,'tools/serve.mjs')));
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const game=await serve({root:repo,port:8766,open:false,lan:false,host:'127.0.0.1'});
createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(p==='/'||p==='/index.html'||p==='/gallery.js'||p==='/proposals.json'){const f=p==='/'?'index.html':p.slice(1);res.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'application/json');res.end(await readFile(out+'/'+f));}else{const r=await fetch(game.url+req.url);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}}catch(e){res.writeHead(500);res.end(String(e));}}).listen(8767,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:8767'));
