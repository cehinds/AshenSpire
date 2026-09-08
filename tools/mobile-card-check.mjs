#!/usr/bin/env node
// Touch regression checks for selection, confirmation, cancellation and detail text.
// node tools/mobile-card-check.mjs [--shots absolute-output-directory]
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';


const root = fileURLToPath(new URL('..', import.meta.url));

const shotsArg = process.argv.indexOf('--shots');
const output = shotsArg < 0 ? null : resolve(process.argv[shotsArg + 1] || (() => { throw Error('--shots needs an output directory'); })());
if (output) mkdirSync(output, { recursive: true });
const wait = ms => new Promise(done => setTimeout(done, ms));
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; };
const errors = [];
function connect(url) {
  const socket = new WebSocket(url), pending = new Map(); let next = 1;
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(`${message.params.entry.url || ""}: ${message.params.entry.text}`);
    const request = pending.get(message.id); if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result);
  });
  return { ready: new Promise((ok, fail) => { socket.onopen = ok; socket.onerror = fail; }),
    send(method, params = {}, sessionId) { const id = next++; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close() { socket.close(); } };
}
const server = await serve({ root, port: 0, open: false });
let browser, cdp;
try {
  browser = await launchBrowser({ prefix: 'wpncards-', timeoutMs: 20000 });
  cdp = connect(browser.wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params = {}) => cdp.send(method, params, sessionId);
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await wait(100); }
    throw Error(`Timed out: ${label}`);
  };
  const screenshot = async (name, selector = null) => {
    if (!output) return;
    const clip = selector ? await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()`) : undefined;
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!clip, ...(clip ? { clip } : {}) });
    writeFileSync(resolve(output, `${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  const url = `http://localhost:${server.server.address().port}/?shot=combat&shotSeed=ART1&shotHand=7`;
  const touch = async (type,x,y) => send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
  const tap = async (x,y) => {await touch('touchStart',x,y);await touch('touchEnd',x,y);};
  const box = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`);
  const load = async () => {await send('Page.navigate',{url});await until("document.querySelectorAll('.hand .card').length===7",'hand');await wait(500);};
  for(const [width,height] of [[320,568],[375,667],[1440,900]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await send('Emulation.setTouchEmulationEnabled',{enabled:true});
    await load();
    const selector='.hand .card:nth-child(4)', before=await box(selector);
    await evaluate(`window.testCard=document.querySelector('${selector}')`);
    await tap(before.x+12,before.y+70);
    check(await evaluate("testCard.isConnected && testCard.classList.contains('selected') && document.querySelectorAll('.hand .card').length===7"),'first tap selects without replacing or playing');
    const selected=await box(selector);
    check(Math.abs(selected.x-before.x)<2&&Math.abs(selected.y-before.y)<2,'selected card stays in fan position');
    check(await evaluate("!!document.querySelector('.player.skill-selected')"),'skill highlights player');
    await screenshot(`selected-${width}`);
    await tap(selected.x+30,selected.y+75);
    check(await evaluate("document.querySelectorAll('.hand .card').length===7"),'single additional tap does not play');
    await load();
    const fresh = await box(selector);
    await tap(fresh.x+12,fresh.y+70);
    await tap(fresh.x+30,fresh.y+75);
    await tap(fresh.x+30,fresh.y+75);
    await until("document.querySelectorAll('.hand .card').length===6",'double tap plays once');await wait(500);
    check(await evaluate("document.querySelectorAll('.hand .card').length===6"),'no duplicate play');
    await load();
    const hold=await box(selector);
    const ms=await evaluate(`Number(document.querySelector('${selector}').dataset.holdMs)`);
    check(ms>0,'uses configured shared hold');
    await touch('touchStart',hold.x+12,hold.y+70);await wait(ms / 3);
    check(await evaluate(`(()=>{const c=document.querySelector('${selector}'),p=c.querySelector('.card-hold-progress');return c.dataset.hold==='holding' && Number(c.dataset.holdProgress)>0 && getComputedStyle(p).display==='block' && p.getBoundingClientRect().height>=5;})()`),'hold progress is visible above the card face');
    await screenshot(`hold-progress-${width}`);
    await wait(ms+120);
    await touch('touchEnd',hold.x+12,hold.y+70);
    await until("document.querySelectorAll('.hand .card').length===6",'hold plays once');
    await load();
    const drag=await box(selector),x=drag.x+12,y=drag.y+70;
    await touch('touchStart',x,y);await touch('touchMove',x+20,y-20);await wait(50);
    const ghost=await box('.card-drag-ghost');
    check(Math.abs(ghost.x-(drag.x+20))<3 && Math.abs(ghost.y-(drag.y-20))<3,'drag preserves grab offset');
    await touch('touchCancel',x,y);await wait(100);
    check(await evaluate("document.querySelectorAll('.hand .card').length===7 && !document.querySelector('.card-drag-ghost')"),'cancelled drag costs nothing and removes ghost');
    check(await evaluate("[...document.querySelectorAll('.card-hold-progress')].every(p=>getComputedStyle(p).display==='none')"),'cancel clears every hold progress strip');
    await tap(x,y);await tap(width-3,Math.max(120,drag.y-25));
    check(await evaluate("!document.querySelector('.hand .card.selected')"),'empty field cancels');
    await evaluate(`(async()=>{const {openModal}=await import('/src/ui/kit/index.js');openModal({title:'The exceptionally long quest title beyond the old ellipsis limit — reclaim the lantern at the distant sanctuary',body:document.createTextNode('Details')});})()`);
    check(await evaluate("(()=>{const e=document.querySelector('.modal-head-id h2');return e && getComputedStyle(e).whiteSpace!=='nowrap' && e.scrollWidth<=e.clientWidth+1})()"),'full modal title fits at '+width);
    await screenshot('detail-title-'+width);
    console.log(`PASS touch interactions ${width}x${height}`);
  }
  await load();
  const attack=await box('.hand .card:first-child');
  await tap(attack.x+12,attack.y+70);
  const enemy=await box('.combatant.enemy .sprite');
  await tap(enemy.x+enemy.width/2,enemy.y+enemy.height/2);
  await until("document.querySelectorAll('.hand .card').length===6",'tap enemy confirms attack');checks++;
  await load();
  const invalid=await box('.hand .card:nth-child(4)');
  await touch('touchStart',invalid.x+12,invalid.y+70);
  await touch('touchMove',700,880);await touch('touchEnd',700,880);await wait(200);
  check(await evaluate("document.querySelectorAll('.hand .card').length===7"),'invalid released drop spends no card');
  const key = async (type, value, code) => send('Input.dispatchKeyEvent', { type, key: value, code });
  await load();
  await evaluate("(async()=>{const {focusElement}=await import('/src/ui/input.js');focusElement(document.querySelector('.hand .card'));window.keyboardChosen=__combat.piles.hand[3].instanceId;})()");
  await key('keyDown','4','Digit4');await key('keyUp','4','Digit4');
  check(await evaluate("document.querySelector('.hand .card.selected')?.dataset.instanceId===keyboardChosen && document.querySelector('.hand .card.gp-focus')?.dataset.instanceId===keyboardChosen"),'positional key moves selection and confirmation focus together');
  const keyHold=await evaluate("Number(document.querySelector('.hand .card.selected').dataset.holdMs)");
  await key('keyDown','Enter','Enter');await wait(keyHold+150);await key('keyUp','Enter','Enter');
  await until("!__combat.piles.hand.some(c=>c.instanceId===keyboardChosen)",'keyboard hold plays chosen card');checks++;
  await load();
  await evaluate("(()=>{const id=__combat.piles.hand[3].instanceId;__combat.piles.hand[3]={instanceId:id,cardId:'blindingSand',upgraded:false};__renderCombatForShot();})()");
  await key('keyDown','4','Digit4');await key('keyUp','4','Digit4');
  check(await evaluate("!!document.querySelector('.hand .card:nth-child(4).selected.gp-focus') && !document.querySelector('.player.armed') && document.querySelectorAll('.enemy.targetable').length===__combat.enemies.filter(e=>e.alive).length"),'all-enemy hotkey selects hostile targets rather than arming self');
  await load();
  const pending=await box('.hand .card:nth-child(4)');
  await tap(pending.x+12,pending.y+70);
  await tap(pending.x+12,pending.y+70);
  await touch('touchStart',pending.x+12,pending.y+70);
  await touch('touchMove',700,880);await touch('touchEnd',700,880);await wait(450);
  check(await evaluate("document.querySelectorAll('.hand .card').length===7"),'drag after a confirmation tap cannot spend a card on invalid release');
  await send('Page.navigate',{url:url.replace(/\?.*$/, '?shot=customize')});
  await until("document.querySelectorAll('.cc-equipment-details h3').length>0",'creation equipment details initialize');
  check(await evaluate("!!document.querySelector('.customize') && [...document.querySelectorAll('.cc-equip-group[data-equipment-section]')].every(group => group.children.length === 2 && group.querySelector('.cc-equipment-details').textContent.length>80)"),'creation initializes one complete readable detail pane per equipment section');
  const audioResult = await evaluate(`(async()=>{
    const {initAudio}=await import('/src/ui/audio.js');const Original=window.AudioContext;const gains=[];let resumes=0;
    class Context {state='interrupted';destination={};createGain(){const g={gain:{value:0},connect(){}};gains.push(g);return g;}resume(){resumes++;return Promise.resolve();}}
    try {window.AudioContext=Context;const audio=initAudio();audio.setVolumes({musicVolume:25,sfxVolume:50,muteAudio:false});return {music:gains[1].gain.value,sfx:gains[2].gain.value,resumes};}
    finally {window.AudioContext=Original;}
  })()`);
  check(audioResult.music===.25 && audioResult.sfx===.5 && audioResult.resumes>0,'volume gain and interrupted audio recovery');
  check(errors.filter(e=>!e.includes('favicon')&&!e.includes('/assets/sfx/')).length===0,`no runtime errors: ${errors.join('; ')}`);
  console.log(`PASS — ${checks} mobile interaction checks`);
} finally {
  cdp?.close();server.server.close();await browser?.close();
}
