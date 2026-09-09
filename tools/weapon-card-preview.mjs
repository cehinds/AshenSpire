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
      const result = await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(selector)});const r=c.getBoundingClientRect();const image=c.querySelector('img');return {ratio:r.width/r.height,art:image?.getAttribute('src'),loaded:image?.naturalWidth>0,name:c.getAttribute('aria-label'),overflow:[...c.querySelectorAll('.epc-frame > *')].filter(e=>e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2).map(e=>e.className),tips:c.querySelectorAll('[data-card-tip][tabindex="0"]').length,details:c.textContent}})()`);
      check(Math.abs(result.ratio-5/7)<0.002, `${name}/${piece.id}: poker proportions`);
      check(result.loaded && result.art === `assets/equipment/icon_${piece.id}.webp`, `${name}/${piece.id}: identity art`);
      check(result.name.includes(piece.name) && result.details.includes(piece.name), `${name}/${piece.id}: full identity`);
      check(result.tips >= 8 && !result.details.includes('Read details'), `${name}/${piece.id}: all fields fit and have focus targets`);
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
    await evaluate("document.querySelector('.epc-fact').focus()"); await wait(250);
    check(await evaluate("(()=>{const t=document.querySelector('#tooltip'),r=t?.getBoundingClientRect();return t?.dataset.open==='true' && t.textContent.includes('Attack') && r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1})()"), `${name}: keyboard tooltip fits viewport`);
    await screenshot(`${name}-tooltip`);
    await evaluate("document.querySelector('.card-info-button').click()");
    check(await evaluate("!!document.querySelector('.modal .card-inspection-layout')"), `${name}: enlarged production inspection`);
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
  await evaluate("document.querySelector('.shop-inspect-card').click()"); await wait(200);
  check(await evaluate("!!document.querySelector('.modal .equipment-poker-card')"), 'merchant reuses poker inspector');
  check(await evaluate('JSON.stringify(weaponPreviewRun)') === before, 'merchant inspection is read-only');
  check(await evaluate("document.querySelector('.modal').textContent.includes('Smithing tier')"), 'merchant preserves live tier/mount information');
  await screenshot('merchant-inspection');
  await evaluate("document.querySelector('.modal-close').click()");
  check(await evaluate('JSON.stringify(weaponPreviewRun)') === before, 'merchant close does not transact');
  // All potion/relic faces share the canvas and must fit their authored text.
  await evaluate(`(async()=>{const {contentBundle}=await import('/src/content/index.js');const {createRegistries}=await import('/src/model/registries.js');const {renderCollectibleInspection}=await import('/src/ui/components/collectibleCard.js');const r=createRegistries(contentBundle);document.body.replaceChildren(Object.assign(document.createElement('main'),{id:'collectible-gallery'}));const gallery=document.querySelector('main');gallery.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,280px);gap:20px;padding:20px';for(const [kind,items] of [['Potion',r.flasks],['Relic',r.relics]])for(const item of items.all()){const inspection=renderCollectibleInspection(r,item,kind);inspection.dataset.kind=kind;gallery.append(inspection);}})()`);
  await wait(300);
  const collectibles = await evaluate("[...document.querySelectorAll('.collectible-poker-card')].map(card=>({id:card.dataset.item,overflow:[...card.querySelectorAll('.epc-frame > *')].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>e.className)}))");
  check(collectibles.length>40, 'all canonical potions and relics render');
  check(await evaluate("[...document.querySelectorAll('.equipment-poker-explanations')].every(el=>el.textContent.length>80)"), `collectible text fits: ${JSON.stringify(collectibles.filter(item=>item.overflow.length))}`);
  await screenshot('collectible-cards');
  // Real Armoury mount, real delegated hold-progress owner and native pointer input.
  await send('Page.navigate', { url: `http://localhost:${server.server.address().port}/index.html?shot=reward` });
  await until("typeof window.__spoils==='function'", 'game boot');
  await evaluate(`(async()=>{const {contentBundle}=await import('/src/content/index.js');const {createRegistries}=await import('/src/model/registries.js');const {createRunState}=await import('/src/model/state.js');const {mountEquipment}=await import('/src/ui/screens/equipment.js');const r=createRegistries(contentBundle);const run=createRunState({seed:671,classId:'reaver',registries:r});run.relics=r.relics.ids().slice(0,3);run.flasks=r.flasks.ids().slice(0,3).map(flaskId=>({flaskId}));window.cardGridRun=run;window.cardGridChanges=0;document.querySelector('#app').replaceChildren();mountEquipment(document.querySelector('#app'),{registries:r,run,meta:{found:r.equipment.armaments.map(p=>p.id),settings:{holdConfirm:'normal'}},inCombat:false,onClose(){},onEquipmentChanged(){window.cardGridChanges++}});})()`);
  await wait(1800);
  await evaluate("[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.includes('Inventory'))?.click()");
  await wait(200);
  check(await evaluate("!!document.querySelector('.poker-inventory-face')"), 'Armoury uses item cards');
  check(await evaluate("getComputedStyle(document.querySelector('.disc-faces:has(.poker-inventory-face)')).display==='grid'"), 'Armoury uses uniform grid tracks');
  await screenshot('desktop-inventory-grid');
  const holdSelector = '[data-hold-capable=true]';
  const point = await evaluate(`(()=>{const e=document.querySelector('${holdSelector}');e?.scrollIntoView({block:'center'});const r=e?.getBoundingClientRect();return r?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`);
  check(!!point, 'inventory has an actionable hold target');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await wait(220);
  check(await evaluate("(()=>{const host=document.querySelector('.inventory-face[data-hold=holding]');const card=host?.querySelector('.equipment-poker-card');return Number(host?.dataset.holdProgress)>0 && getComputedStyle(card,'::after').content!=='none' && getComputedStyle(card,'::after').clipPath!=='none'})()"), 'hold progress paints above the card art');
  await screenshot('inventory-hold-progress');
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  check(await evaluate('window.cardGridChanges===0'), 'early release does not equip');
  check(await evaluate("!document.querySelector('.inventory-face[data-hold=holding]')"), 'early release clears progress');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await wait(850);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  check(await evaluate('window.cardGridChanges===1'), 'completed hold commits exactly once');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await wait(250);
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), 'phone inventory has no horizontal overflow');
  await screenshot('phone-inventory-grid');
  // Enter the game's real reward flow; inspecting and backing out must not collect.
  for (const [name, width, height] of [['desktop',1280,1000],['phone',390,844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:name==='phone' });
    await send('Page.navigate', { url: `http://localhost:${server.server.address().port}/index.html?shot=reward` });
    await until("!!document.querySelector('.reward-kind[data-kind=armament]') && typeof window.__spoils==='function'", 'in-game rewards');
    const original = await evaluate('JSON.stringify(window.__spoils())');
    await evaluate("document.querySelector('.reward-kind[data-kind=armament]').click()");
    await until("!!document.querySelector('[data-reward-detail=armament] .equipment-poker-card')", 'reward weapon card');
    await until("[...document.querySelectorAll('.equipment-poker-card img')].every(i=>i.complete&&i.naturalWidth>0)", 'reward art');
    await wait(1500); // Let the game's entry transition finish before photographing it.
    check(await evaluate('JSON.stringify(window.__spoils())')===original, `${name}: reward inspect does not collect`);
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), `${name}: reward fits width`);
    await screenshot(`${name}-game-reward`);
    await evaluate("document.querySelector('#reward-back').click()");
    check(await evaluate('JSON.stringify(window.__spoils())')===original, `${name}: reward back does not collect`);
    await evaluate("document.querySelector('.reward-kind[data-kind=armament]').click();document.querySelector('#reward-detail-take').click()");
    check(await evaluate("document.querySelector('.reward-kind[data-kind=armament]')?.dataset.state==='taken'"), `${name}: Take collects armament`);
  }
  // The game synthesizes these cues immediately and probes optional recordings
  // in the background (audio.js). Missing recordings and favicon are expected.
  const appErrors = errors.filter(error => !error.includes('/favicon.ico:') && !/\/assets\/sfx\/(hold(Tick|Commit)_equipInventory|cardPlay)\.ogg:/.test(error));
  check(appErrors.length===0, `no browser errors: ${appErrors.join('; ')}`);
  console.log(`PASS — ${checks} checks, ${pieces.length} armaments, ${collectibles.length} potions/relics, Inventory grid and hold gestures${output ? `; screenshots: ${output}` : ''}`);
} finally {
  cdp?.close();
  server.server.close();
  await browser?.close();
}
