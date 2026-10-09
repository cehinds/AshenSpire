// Reproduce the curated capture from the repository root after building and running tools/verify-shipped.mjs.
// Outputs use QA_OUT or .codex/display-browser; co-op uses the existing canned transport.
import { launchBrowser } from '../../../tools/browser.mjs';
import { devtoolsClient } from '../../../tools/shotReady.mjs';
import { serve } from '../../../tools/serve.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const out=resolve(process.env.QA_OUT || '.codex/display-browser');mkdirSync(out,{recursive:true});
console.log('Starting appearance QA');
const host=await serve({root:resolve('dist'),port:4497,open:false,lan:false,quiet:true});
console.log('Server ready',host.url);
const browser=await launchBrowser({prefix:'display-',headless:'--headless=new',timeoutMs:30000});
const report={built:JSON.parse(readFileSync('buildordinal.json','utf8')),cases:[],errors:[],network:[],httpErrors:[]};
console.log('Browser ready');
let socket;
try{
 const port=Number(new URL(browser.wsUrl).port);
 const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((ok,no)=>{socket.onopen=ok;socket.onerror=no});
 const client=devtoolsClient(socket),send=(method,params={},timeout=60000)=>client(method,params,timeout);
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails);if(m.method==='Network.loadingFailed')report.network.push(m.params);if(m.method==='Network.responseReceived'&&m.params.response.status>=400)report.httpErrors.push({url:m.params.response.url,status:m.params.response.status,type:m.params.type});});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},60000);if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const wait=async(expression,label)=>{const until=Date.now()+120000;while(Date.now()<until){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,200));}throw Error('Timed out: '+label);};
 const click=async selector=>{const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden control');return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});};
 const playCard=async()=>{const playerLeft=await evaluate("document.querySelector('.combatant.player').style.left");const energy=await evaluate('window.__combat.player.energy');const p=await evaluate(`(()=>{const e=document.querySelector('.hand .card');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await new Promise(r=>setTimeout(r,1500));await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});await wait(`window.__combat.player.energy<${energy}`,'card played');await new Promise(r=>setTimeout(r,600));assert.equal(await evaluate("document.querySelector('.combatant.player').style.left"),playerLeft,'playing a card must retain the resting player anchor');};
 const snapshot=()=>evaluate(`JSON.stringify({combat:window.__combat,run:window.__combatRunForShot})`);
 const picture=async name=>{await evaluate(`(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0}).map(i=>i.decode()));await Promise.all([...document.querySelectorAll('svg image')].map(async e=>{const i=new Image();i.src=e.getAttribute('href');await i.decode()}));await Promise.all(document.getAnimations().filter(a=>a.playState==='running'&&Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})));await new Promise(r=>setTimeout(r,2000));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})()`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(resolve(out,name+'.png'),Buffer.from(shot.data,'base64'));};
 const settings=async()=>{await click('#combat-menu');await wait(`!!document.querySelector('[data-search-toggle]')`,'Settings');await click('[data-search-toggle]');await evaluate(`(()=>{const i=document.querySelector('[data-advanced-search]');i.value='Classic appearance';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);};
 for(const [name,width,height]of [['desktop',1440,1000],['phone',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const config={quickNav:'off',promptSettingsExport:false,settingsCategory:'Advanced',settingsAdvancedCategory:'Export',reducedMotion:true};
  const url=host.url+'AshenSpire.html?shot=combat&debug=1&shotSettings='+encodeURIComponent(JSON.stringify(config));
  console.log(name,'navigating');await send('Page.navigate',{url});
  await wait(`!!window.__combat&&!!document.querySelector('.alternative-card-stage canvas')&&!/Loading art/.test(document.body.innerText)`,'combat');
  await wait(`Array.from(document.querySelectorAll('.alternative-card-stage canvas')).every(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))`,'painted class canvas');
  await wait(`Array.from(document.images).filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(i).display!=='none'}).every(i=>i.complete&&i.naturalWidth)`,'images');
  const before=await snapshot();
  await picture(name+'-alternative');
  const resizeProbe=async(w,h)=>{await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});await wait(`(()=>{const e=document.querySelector('.hand'),r=e.getBoundingClientRect();return e.dataset.handGeometry===[e.clientWidth,e.clientHeight,r.width/e.clientWidth,getComputedStyle(document.documentElement).fontSize,r.left].join(':')})()`,'published resize geometry');await new Promise(r=>setTimeout(r,500));return evaluate(`({left:document.querySelector('.combatant.player').style.left,geometry:document.querySelector('.hand').dataset.handGeometry})`);};
  const originalAnchor=await resizeProbe(width,height);const resizedAnchor=await resizeProbe(width===390?360:1200,height);const restoredAnchor=await resizeProbe(width,height);
  assert.notEqual(resizedAnchor.geometry,originalAnchor.geometry);assert.equal(restoredAnchor.geometry,originalAnchor.geometry);assert.ok(Math.abs(parseFloat(restoredAnchor.left)-parseFloat(originalAnchor.left))<1,'resize restores the resting player position');
  report.resizeChecks??=[];report.resizeChecks.push({name,originalAnchor,resizedAnchor,restoredAnchor});
  await settings();await wait(`!!document.querySelector('[data-key="classicAppearance"]')`,'Classic appearance');
  await picture(name+'-setting');
  await click('[data-key="classicAppearance"]');
  await wait(`document.documentElement.dataset.displayAppearance==='classic'&&!document.querySelector('.alternative-backdrop')&&!document.querySelector('.alternative-card-stage')`,'classic');
  assert.equal(await snapshot(),before,'appearance must preserve run and combat');
  console.log(name,'classic applied without changing combat');
  await click('[aria-label="Close menu"]');
  await wait(`!document.querySelector('[data-search-toggle]')`,'close Settings');
  await wait(`document.body.classList.contains('reduced-motion')`,'reduced motion applied');await new Promise(r=>setTimeout(r,500));await picture(name+'-classic');const geometry=await evaluate(`Array.from(document.querySelectorAll('.enemy .sprite')).map(h=>({className:h.className,style:h.style.cssText,rect:h.getBoundingClientRect().toJSON(),children:Array.from(h.querySelectorAll('*')).map(e=>({tag:e.tagName,cls:e.className,ds:{...e.dataset},style:e.style.cssText,visibility:getComputedStyle(e).visibility,display:getComputedStyle(e).display,opacity:getComputedStyle(e).opacity,overflow:getComputedStyle(e).overflow,rect:e.getBoundingClientRect().toJSON(),naturalWidth:e.naturalWidth,naturalHeight:e.naturalHeight}))}))`);writeFileSync(resolve(out,name+'-classic-geometry.json'),JSON.stringify(geometry,null,2));await playCard();const afterClassicAction=await snapshot();
  await settings();await wait(`!!document.querySelector('[data-key="classicAppearance"]')`,'restored settings search');await click('[data-key="classicAppearance"]');
  await wait(`document.documentElement.dataset.displayAppearance==='alternative'&&!!document.querySelector('.alternative-backdrop')&&!!document.querySelector('.alternative-card-stage')`,'alternative restored');
  assert.equal(await snapshot(),afterClassicAction);await click('[aria-label="Close menu"]');await playCard();
  await send('Page.navigate',{url:url.replace('debug=1','debug=0')});
  await wait(`!!window.__combat`,'debug off combat');await settings();await new Promise(r=>setTimeout(r,250));
  assert.equal(await evaluate(`!!document.querySelector('[data-key="classicAppearance"]')`),false,'debug off hides Classic search result');
  report.cases.push({name,width,height,statePreserved:true,default:'alternative',classicToggle:true,hiddenWithDebugOff:true,cardActions:2});
 }
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  let receipt;
  for(const mode of ['alternative','classic']){
   const config={quickNav:'off',promptSettingsExport:false,reducedMotion:true,classicAppearance:mode==='classic'};
   await send('Page.navigate',{url:host.url+'AshenSpire.html?shot=coop&shotSeats=2&debug=1&shotSettings='+encodeURIComponent(JSON.stringify(config))});
   await wait(`!!window.__coopSnapshot&&document.documentElement.dataset.displayAppearance===${JSON.stringify(mode)}`,'co-op '+mode);
   if(mode==='alternative')await wait(`Array.from(document.querySelectorAll('.alternative-card-stage canvas')).length>=2&&Array.from(document.querySelectorAll('.alternative-card-stage canvas')).every(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0))`,'co-op class canvases');
   await picture(name+'-coop-'+mode);
   const next=await evaluate('JSON.stringify(window.__coopSnapshot)');
   if(receipt)assert.equal(next,receipt,'co-op snapshot identical between appearances');else receipt=next;
  }
  report.cases.push({name:name+'-coop',width,height,appearances:['alternative','classic'],sameSnapshot:true,transport:'canned screenshot state'});
 }
 assert.equal(report.errors.length,0,'JavaScript exceptions');
 report.optionalSfxProbes=report.httpErrors.filter(r=>r.status===404&&/^\/assets\/sfx\/(holdTick|cardPlay|holdCommit|block)\.ogg$/.test(new URL(r.url).pathname));
 assert.equal(report.httpErrors.filter(r=>r.type!=='Media'&&!report.optionalSfxProbes.includes(r)).length,0,'required HTTP resources');
 assert.equal(report.network.filter(r=>!r.canceled&&r.type!=='Media').length,0,'required network resources');
 console.log(JSON.stringify(report));
}finally{writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');socket?.close();await browser.close();await new Promise(r=>host.server.close(r));}
