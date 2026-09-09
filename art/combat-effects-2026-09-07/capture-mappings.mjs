import {writeFileSync} from 'node:fs';
import {launchBrowser,resolveBrowser} from '../../tools/browser.mjs';
const catalog=process.argv.includes('--catalog'),page=catalog?'sprite-catalog':'integrated-tag-mappings';
const browser=await launchBrowser({prefix:'tag-mapping-review-',browser:resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']),timeoutMs:20000});
const ws=new WebSocket(browser.wsUrl),pending=new Map();let serial=0;
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
await new Promise(r=>ws.addEventListener('open',r));
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
try{
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(m,p)=>send(m,p,sessionId);
 await call('Page.enable');await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1240,height:1100,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://localhost:4290/art/combat-effects-2026-09-07/'+page+'.html'});
 await new Promise(r=>setTimeout(r,1500));
 const decoded=await call('Runtime.evaluate',{expression:'Promise.all([...document.images].map(i=>i.decode())).then(()=>document.images.length)',awaitPromise:true,returnByValue:true});
 if(decoded.exceptionDetails)throw Error(JSON.stringify(decoded.exceptionDetails));
 const result=await call('Runtime.evaluate',{expression:'[...document.querySelectorAll("section")].map(s=>{const b=s.getBoundingClientRect();return {x:b.x,y:b.y+scrollY,width:b.width,height:b.height,scale:1}})',returnByValue:true});
 if(result.result.value.length<1||decoded.result.value<300)throw Error('Mapping page did not load completely');
 for(const [i,clip] of result.result.value.entries()){
  const shot=await call('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});
  writeFileSync(new URL('inspection/'+page+'-'+(i+1)+'.png',import.meta.url),Buffer.from(shot.data,'base64'));
 }
 console.log({decoded:decoded.result.value,screenshots:result.result.value.length});
 if(catalog){
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const layout=await call('Runtime.evaluate',{expression:'document.documentElement.scrollWidth<=innerWidth',returnByValue:true});
  if(!layout.result.value)throw Error('Catalog overflows phone viewport');
  const shot=await call('Page.captureScreenshot',{format:'png'});
  writeFileSync(new URL('inspection/sprite-catalog-phone.png',import.meta.url),Buffer.from(shot.data,'base64'));
 }
}finally{ws.close();await browser.close();}
