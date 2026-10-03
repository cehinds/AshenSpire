// Local documentation preview only. Binds loopback and serves this directory.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.REFERENCE_PORT||4179);
http.createServer((request,response)=>{
 try{
  const requested=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(requested==='/'?'/wireframe-gallery.html':requested));
  if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return}
  response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'})[path.extname(file)]||'text/plain; charset=utf-8');
  response.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(response);
 }catch{response.writeHead(404);response.end()}
}).listen(port,'127.0.0.1',()=>console.log(`Reference preview: http://127.0.0.1:${port}`));
