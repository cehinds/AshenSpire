#!/usr/bin/env node
// Real Chromium coverage of every canonical armament through the production renderer.
// node tools/weapon-card-preview.mjs [--shots absolute-output-directory]
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const pieces = createRegistries(contentBundle).equipment.armaments;
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
  const url = `http://localhost:${server.server.address().port}/weapon-cards-preview.html`;
  for (const [name, width, height] of [['desktop',1280,1000],['phone',390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: name === 'phone' });
    await send('Page.navigate', { url });
    await until("document.body?.dataset.previewReady==='true' && [...document.images].every(i=>i.complete)", 'preview and art');
    await wait(150);
    check(await evaluate("document.title==='Ashen Spire · Every weapon'"), `${name}: page identity`);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-weapon-id]')].map(e=>e.dataset.weaponId)"), pieces.map(p=>p.id)); checks++;
    check(await evaluate('document.documentElement.scrollWidth <= innerWidth+1'), `${name}: no horizontal scroll`);
    await screenshot(`${name}-gallery`);
    for (const piece of pieces) {
      const selector = `[data-weapon-id="${piece.id}"] .equipment-poker-card`;
      const result = await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(selector)});const r=c.getBoundingClientRect();const image=c.querySelector('img');return {ratio:r.width/r.height,art:image?.getAttribute('src'),loaded:image?.naturalWidth>0,name:c.getAttribute('aria-label'),overflow:[...c.querySelectorAll('.epc-frame > *')].filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.className),tips:c.querySelectorAll('[data-card-tip][tabindex="0"]').length,details:c.parentElement.querySelector('dl').textContent}})()`);
      check(Math.abs(result.ratio-5/7)<0.002, `${name}/${piece.id}: poker proportions`);
      check(result.loaded && result.art === `assets/equipment/icon_${piece.id}.webp`, `${name}/${piece.id}: identity art`);
      check(result.name.includes(piece.name) && result.details.includes(piece.name), `${name}/${piece.id}: full identity`);
      check(!result.overflow.length && result.tips >= 8, `${name}/${piece.id}: all fields fit and have focus targets`);
      await screenshot(`${name}-${piece.id}`, selector);
    }
    if (output && name === 'desktop') {
      for (let index = 0; index < pieces.length; index += 3) {
        const clip = await evaluate(`(()=>{const row=[...document.querySelectorAll('[data-weapon-id]')].slice(${index},${index+3});const rects=row.map(e=>e.getBoundingClientRect());const g=document.querySelector('#weapon-gallery').getBoundingClientRect();return {x:g.x+scrollX,y:rects[0].top+scrollY,width:g.width,height:Math.max(...rects.map(r=>r.height)),scale:1}})()`);
        const shot = await send('Page.captureScreenshot', { format:'png', captureBeyondViewport:true, clip });
        writeFileSync(resolve(output, `desktop-row-${index/3+1}.png`), Buffer.from(shot.data,'base64'));
      }
    }
    // Exercise real preview controls, full-text disclosure and viewport-contained keyboard tooltip.
    await evaluate("document.querySelector('#weapon-search').value='shortbow';document.querySelector('#weapon-search').dispatchEvent(new Event('input',{bubbles:true}))");
    check(await evaluate("document.querySelectorAll('[data-weapon-id]').length===1 && document.querySelector('[data-weapon-id]').dataset.weaponId==='shortbow'"), `${name}: search`);
    await evaluate("document.querySelector('.equipment-poker-explanations summary').click()");
    check(await evaluate("document.querySelector('.equipment-poker-explanations').open"), `${name}: touch-readable details`);
    await evaluate("document.querySelector('.epc-fact').focus()"); await wait(250);
    check(await evaluate("(()=>{const t=document.querySelector('#tooltip'),r=t?.getBoundingClientRect();return t?.dataset.open==='true' && t.textContent.includes('Attack') && r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1})()"), `${name}: keyboard tooltip fits viewport`);
    await screenshot(`${name}-tooltip`);
    await evaluate("document.querySelector('.weapon-enlarge').click()");
    check(await evaluate("!!document.querySelector('.modal .equipment-poker-inspection')"), `${name}: enlarged production inspection`);
    await screenshot(`${name}-enlarged`);
    await evaluate("document.querySelector('.modal-close').click(); document.querySelector('form').reset()"); await wait(100);
    check(await evaluate('document.querySelectorAll("[data-weapon-id]").length') === pieces.length, `${name}: reset`);
    await evaluate("document.querySelector('#weapon-kind').value='staff';document.querySelector('#weapon-kind').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-weapon-id]')].map(e=>e.dataset.weaponId)"), pieces.filter(p=>p.kind==='staff').map(p=>p.id)); checks++;
    await evaluate("document.querySelector('#weapon-search').value='no-such-weapon';document.querySelector('#weapon-search').dispatchEvent(new Event('input',{bubbles:true}))");
    check(await evaluate("!document.querySelector('#weapon-empty').hidden && !document.querySelector('[data-weapon-id]')"), `${name}: empty results`);
    check(await evaluate("new URL(location.href).searchParams.get('q')==='no-such-weapon'"), `${name}: shareable search`);
    await evaluate("document.querySelector('form').reset()"); await wait(100);

  }
  // A real merchant on a seeded disposable run. Preview/back must not purchase.
  await send('Emulation.setDeviceMetricsOverride', { width:1280, height:1000, deviceScaleFactor:1, mobile:false });
  await evaluate(`(async()=>{const {createRunState}=await import('/src/model/state.js');const {createRng}=await import('/src/engine/rng.js');const {buildShopStock}=await import('/src/engine/encounters.js');const {contentBundle}=await import('/src/content/index.js');const {createRegistries}=await import('/src/model/registries.js');const {mountShop}=await import('/src/ui/screens/shop.js');const r=createRegistries(contentBundle);const run=createRunState({seed:671,classId:'reaver',registries:r});run.cinders=1000;run.shopStock=buildShopStock(r,createRng(671),run);window.weaponPreviewRun=run;document.body.replaceChildren(Object.assign(document.createElement('main'),{id:'app'}));mountShop(document.querySelector('#app'),{registries:r,run,meta:{settings:{}},onLeave(){},onChanged(){}});})()`);
  await evaluate(`document.querySelector('[data-face="bar:armaments"]').click()`); await wait(100);
  check(await evaluate("document.querySelector('.shop-armament-offer').getBoundingClientRect().height>0"), 'merchant shelf exposes weapon cards');
  await screenshot('merchant-offers');
  const before = await evaluate('JSON.stringify(weaponPreviewRun)');
  await evaluate("document.querySelector('.shop-armament-offer button').click()"); await wait(200);
  check(await evaluate("!!document.querySelector('.modal .equipment-poker-card')"), 'merchant reuses poker inspector');
  check(await evaluate('JSON.stringify(weaponPreviewRun)') === before, 'merchant inspection is read-only');
  check(await evaluate("document.querySelector('.modal').textContent.includes('Smithing tier')"), 'merchant preserves live tier/mount information');
  await screenshot('merchant-inspection');
  await evaluate("document.querySelector('.modal-close').click()");
  check(await evaluate('JSON.stringify(weaponPreviewRun)') === before, 'merchant close does not transact');
  check(errors.length===0, `no browser errors: ${errors.join('; ')}`);
  console.log(`PASS — ${checks} checks, ${pieces.length} armaments at desktop and phone sizes${output ? `; screenshots: ${output}` : ''}`);
} finally {
  cdp?.close();
  server.server.close();
  await browser?.close();
}
