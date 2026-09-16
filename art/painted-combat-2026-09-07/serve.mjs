import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return}const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png'})[extname(path)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(Number(process.argv[2]||4276),'127.0.0.1',()=>console.log('Art preview: http://127.0.0.1:'+Number(process.argv[2]||4276)));
