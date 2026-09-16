import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from '../../../tools/browser.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const out=join(here,'inspection');mkdirSync(out,{recursive:true});
const browser=await launchBrowser({prefix:'animation-review-',browser:resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']),timeoutMs:20000});
const ws=new WebSocket(browser.wsUrl), pending=new Map(),errors=[];let serial=0;
ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);if(msg.id){const pair=pending.get(msg.id);pending.delete(msg.id);msg.error?pair.reject(msg.error):pair.resolve(msg.result);}});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const checks=[];
try {
  for(const cls of ['reaver','starseer','rogue','herald']) for(const width of [1180,390]) {
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const call=(method,params)=>send(method,params,sessionId);
    await call('Runtime.enable');await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:950,deviceScaleFactor:1,mobile:width===390});
    const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    await call('Page.navigate',{url:`http://127.0.0.1:4290/art/painted-combat-2026-09-07/animation-groups/${cls}.html`});
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector("#actor")?.dataset.pose'))break;await wait(50);}
    assert.equal(await evaluate('document.querySelector("#actor").dataset.pose'),'idle');
    const click=async selector=>{
      const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
    };
    if(cls==='reaver'&&width===1180)for(const resource of ['stamina','mana','hp']){
      await evaluate(`document.querySelector('#resource').value=${JSON.stringify(resource)};document.querySelector('#resource').dispatchEvent(new Event('change'))`);await click('[data-action="power"]');await wait(350);assert.equal(await evaluate('document.querySelector("#actor").dataset.pose'),'power2');await evaluate('scrollTo(0,0)');const glow=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(out,`power-${resource}.png`),Buffer.from(glow.data,'base64'));await wait(650);
    }
    const pose=()=>evaluate('document.querySelector("#actor").dataset.pose');
    await click('[data-action="shieldGuard"]');await wait(350);assert.equal(await pose(),'shieldGuard2');await wait(650);assert.equal(await pose(),'shieldGuard3');
    await click('[data-action="attack"]');await wait(350);assert.equal(await pose(),'attack2');await wait(650);assert.equal(await pose(),'shieldGuard3');
    await click('[data-action="shieldBash"]');await wait(350);assert.equal(await pose(),'shieldBash2');await wait(650);assert.equal(await pose(),'shieldGuard3');
    await click('#hit');await wait(550);assert.equal(await pose(),'shieldGuard3');
    await click('#other-turn');assert.equal(await pose(),'shieldGuard3');
    await click('#next-turn');assert.equal(await pose(),'idle');
    await click('[data-action="parry"]');await wait(1000);assert.equal(await pose(),'parry3');
    await evaluate('document.querySelector("#sequence").value="parry";document.querySelector("#sequence").dispatchEvent(new Event("change"));scrollTo(0,0)');
    await wait(100);
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(out,`${cls}-${width}.png`),Buffer.from(shot.data,'base64'));
    await click('[data-action="power"]');await click('#skip');assert.equal(await pose(),'idle');
    assert.equal(await evaluate('document.querySelector("#actor").dataset.rest'),'cast');
    await click('#reduced');await click('[data-action="shieldGuard"]');assert.equal(await pose(),'shieldGuard3');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow');
    assert.ok(await evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'),'broken images');
    for(const outfit of await evaluate('[...document.querySelector("#outfit").options].map(o=>o.value)')) {
      await evaluate(`document.querySelector('#outfit').value=${JSON.stringify(outfit)};document.querySelector('#outfit').dispatchEvent(new Event('change'))`);await wait(350);await click('[data-action="shieldBash"]');await click('#skip');assert.ok(await evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'));
    }
    checks.push(`${cls} ${width}: button playback, frame progression, guard persistence, hit, other turn, owner reset, parry, Power, skip, reduced motion, images and viewport PASS`);
    await send('Target.closeTarget',{targetId});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(join(out,'checks.json'),JSON.stringify({checks,errors},null,2)+'\n');
  console.log(checks.join('\n'));
} finally {ws.close();await browser.close();}
