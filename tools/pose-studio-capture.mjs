import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {handler} from '../pose-studio/server.mjs';
import {launchBrowser,resolveBrowser} from './browser.mjs';
const out=process.argv[process.argv.indexOf('--out')+1];if(!process.argv.includes('--out')||!out)throw Error('Provide --out screenshot directory');await mkdir(out,{recursive:true});
const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await launchBrowser({prefix:'pose-studio-',browser:resolveBrowser(['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'])});
 const ws=new WebSocket(browser.wsUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});const pending=new Map();let serial=0;ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true}),call=(m,p)=>send(m,p,sessionId);
 await call('Page.enable');await call('Runtime.enable');
 for(const [name,width,height]of [['desktop',1440,1100],['phone',390,844]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='phone'});await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/pose-studio/index.html`});
  const result=await call('Runtime.evaluate',{expression:`new Promise((resolve,reject)=>{let tries=0;const check=()=>{if(document.querySelectorAll('.effect').length===80)resolve(true);else if(++tries>100)reject(Error('Studio failed to render'));else setTimeout(check,100);};check();})`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error('Studio did not render');
  await call('Runtime.evaluate',{expression:`new Promise(r=>setTimeout(r,500))`,awaitPromise:true});const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,`studio-${name}.png`),Buffer.from(shot.data,'base64'));
 }
 ws.close();console.log('Pose Studio rendered: desktop and phone screenshots captured.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
