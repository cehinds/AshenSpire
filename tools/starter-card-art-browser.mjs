// Run against tools/serve.mjs after fetching the pinned art release.
// STARTER_ART_URL / STARTER_ART_OUTPUT override the server and evidence directory.
import {launchBrowser,resolveBrowser} from './browser.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.STARTER_ART_OUTPUT || 'docs/preview/starter-card-art';
mkdirSync(out,{recursive:true});
const {wsUrl,close}=await launchBrowser({prefix:'starter-art-',browser:resolveBrowser(),headless:'--headless=new'});
let socket;
try {
 const pages=await (await fetch(wsUrl.replace(/^ws:/,'http:').replace(/\/devtools\/browser\/.*/, '/json/list'))).json();
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no;});
 let id=0;const waiting=new Map(),errors=[];
 socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.loadingFailed')errors.push(m.params);if(m.method==='Network.responseReceived'&&m.params.response.status>=400)errors.push(m.params.response.url);if(waiting.has(m.id)){const {ok,no}=waiting.get(m.id);waiting.delete(m.id);m.error?no(m.error):ok(m.result);}};
 const send=(method,params={})=>new Promise((ok,no)=>{const i=++id;waiting.set(i,{ok,no});socket.send(JSON.stringify({id:i,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 const report=[];
 for(const width of [1200,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
  await send('Page.navigate',{url:(process.env.STARTER_ART_URL || 'http://127.0.0.1:8787')+'/docs/preview/starter-card-art/'});
  let ready=false;for(let attempt=0;attempt<300&&!ready;attempt++){ready=await evaluate("document.querySelectorAll('.playing-card-art').length===3").catch(()=>false);if(!ready)await new Promise(r=>setTimeout(r,100));}
  if(!ready){console.log(await evaluate("JSON.stringify({url:location.href,state:document.readyState,html:document.body.innerHTML.slice(0,4500),images:document.images.length})"));throw Error('Cards failed to mount '+JSON.stringify(errors));}
  for(const tier of ['high','light']){
   if(tier==='light'){
    await evaluate("document.querySelector('#tier').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   }
   const facts=await evaluate(`(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>setTimeout(r,250));return {tier:document.body.dataset.artTier,overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.querySelectorAll('.playing-card-art')].map(i=>({id:i.closest('.card').dataset.cardId,src:i.getAttribute('src'),kind:i.dataset.cardArt,width:i.naturalWidth,height:i.naturalHeight,renderedWidth:i.getBoundingClientRect().width}))};})()`);
   if(facts.tier!==tier||facts.overflow||facts.images.length!==3||facts.images.some(i=>i.kind!=='official'||!i.width||!i.renderedWidth))throw Error(JSON.stringify(facts));
   const layered=await evaluate("[...document.querySelectorAll('.ic-plane')].every(p=>getComputedStyle(p).position==='absolute')");
   if(!layered)throw Error('Production card layer stylesheet is missing');
   const metrics=await send('Page.getLayoutMetrics');
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});
   writeFileSync(`${out}/${tier}-${width}.png`,Buffer.from(shot.data,'base64'));report.push({width,...facts});
  }
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 writeFileSync(`${out}/browser-report.json`,JSON.stringify({errors,checks:report},null,2)+'\n');console.log(JSON.stringify(report));
}finally{socket?.close();await close();}
