#!/usr/bin/env node
// Focused real-Chromium verification for the character-creation redesign.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'outputs'));
const browserCandidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);
if (!browserPath) {
  console.error('character-creation-check: no Chrome/Edge found; set CHROME');
  process.exit(2);
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const pair = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) pair.reject(new Error(message.error.message)); else pair.resolve(message.result);
    } else if (message.method && handlers.has(message.method)) handlers.get(message.method)(message.params, message.sessionId);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady);
      ws.addEventListener('error', rejectReady);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolve: resolveSend, reject: rejectSend });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on(method, handler) { handlers.set(method, handler); },
    close() { ws.close(); },
  };
}

const server = await serve({ root: ROOT, port: 8391, open: false });
const browser = await launchBrowser({ prefix: 'character-creation-', browser: browserPath, timeoutMs: 15000 });
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
mkdirSync(OUT, { recursive: true });

let failures = 0;
let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (condition) console.log(`PASS ${message}`);
  else { failures += 1; console.log(`FAIL ${message}`); }
};

async function exercise(width, height, screenshotName, screenshotSection, profileMeta = null) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  }, sessionId);
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params, sourceSession) => {
    if (sourceSession !== sessionId) return;
    const detail = params && params.exceptionDetails;
    errors.push((detail && (detail.exception && detail.exception.description || detail.text)) || 'runtime exception');
  });
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  const click = async (selector, index = 0) => {
    await evaluate(`(() => { const e=document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!e) return false; e.scrollIntoView({block:'center',inline:'center'}); return true; })()`);
    await wait(80);
    const point = await evaluate(`(() => { const e = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing selector ${selector}[${index}]`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(100);
  };
  const setInput = async (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); e.value=${JSON.stringify(value)}; e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${JSON.stringify(value)}})); e.dispatchEvent(new Event('change',{bubbles:true})); return e.value; })()`);
  const open = (key) => click(`[data-face="${key}"]`);
  const noOverflow = () => evaluate(`(() => {
    const root=document.querySelector('.customize');
    const scrollers=[root,...root.querySelectorAll('*')].filter(e=>getComputedStyle(e).overflowX!=='visible');
    return root.scrollWidth<=root.clientWidth+1 && scrollers.every(e=>e.scrollWidth<=e.clientWidth+1);
  })()`);

  if (profileMeta) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.clear(); localStorage.setItem('sote_meta_v1', ${JSON.stringify(JSON.stringify(profileMeta))});`,
    }, sessionId);
  }

  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/${profileMeta ? '' : '?shot=customize'}` }, sessionId);
  if (profileMeta) {
    await until(`!!document.querySelector('.slot-new')`, 'title screen for veteran profile');
    await click('.slot-new');
  }
  await until(`document.querySelectorAll('.cz-flow > .disc-faces > .disc-face').length===4`, 'four creation sections');
  await wait(250);
  const arrival = await evaluate(`(() => ({
    labels:[...document.querySelectorAll('.cz-flow > .disc-faces > .disc-face .disc-name')].map(e=>e.textContent.trim()),
    open:[...document.querySelectorAll('.cz-flow > .disc-faces > .disc-face[aria-expanded="true"]')].map(e=>e.dataset.face)
  }))()`);
  assert(JSON.stringify(arrival.labels) === JSON.stringify(['CLASS', 'CHARACTER', 'STARTING EQUIP', 'SEED']), `${width}x${height}: sections are in the requested order`);
  assert(JSON.stringify(arrival.open) === JSON.stringify(['class']), `${width}x${height}: exactly Class opens on arrival`);
  assert(await noOverflow(), `${width}x${height}: Class has no horizontal overflow`);

  if ((profileMeta && profileMeta.unlocked || []).includes('winAsReaver')) {
    await open('equipment');
    assert(await evaluate(`!!document.querySelector('#cz-armours [data-starting-armour-id="oathsworn"]')`), `${width}x${height}: profile-earned armour appears beside JSON defaults`);
    await click('#cz-armours [data-starting-armour-id="oathsworn"]');
    await open('character');
    await open('equipment');
    assert((await evaluate(`document.querySelector('#cz-armours [data-starting-armour-id="oathsworn"]').getAttribute('aria-pressed')`)) === 'true', `${width}x${height}: profile-earned armour selection persists through section changes`);
  }

  await open('character');
  const characterFold = await evaluate(`(() => ({
    labels:[...document.querySelectorAll('#cz-character-fold > .disc-faces > .disc-face .disc-name')].map(e=>e.textContent.trim()),
    open:[...document.querySelectorAll('#cz-character-fold > .disc-faces > .disc-face[aria-expanded="true"]')].map(e=>e.dataset.face),
    resourceOrder:[...document.querySelectorAll('#cz-primary-group > *')].map(e=>e.id)
  }))()`);
  assert(JSON.stringify(characterFold.labels) === JSON.stringify(['PRIMARY STATS', 'SPRITE', 'TINT', 'SIGIL', 'KEEPSAKE'])
    && JSON.stringify(characterFold.open) === JSON.stringify(['primary'])
    && JSON.stringify(characterFold.resourceOrder) === JSON.stringify(['cz-primary-stats', 'cz-derived', 'cz-statedit']),
  `${width}x${height}: Character uses one-open nested disclosures and keeps resources after stats before modes`);
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points overlay');
  for (let i = 0; i < 3; i += 1) {
    await click('.cc-stat-overlay [aria-label="Decrease Strength"]');
    await click('.cc-stat-overlay [aria-label="Increase Dexterity"]');
  }
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points overlay close');
  await open('equipment');
  const errorsBeforeIncompatiblePick = errors.length;
  await click('#cz-right-hand [data-armament-id="greatsword"]');
  const incompatible = await evaluate(`(() => {
    const begin = document.querySelector('#cz-start');
    return { disabled: begin.getAttribute('aria-disabled'), refusal: begin.dataset.refusal || '' };
  })()`);
  assert(errors.length === errorsBeforeIncompatiblePick, `${width}x${height}: incompatible hand selection keeps the live preview total`);
  assert(incompatible.disabled === 'true' && /Greatsword needs strength 12.*have 11/.test(incompatible.refusal), `${width}x${height}: Begin recomputes the current equipment requirement refusal`);
  await open('character');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Reaver correction overlay');
  await click('.cc-stat-overlay [data-stat-done]');
  const modalRefusal = await evaluate(`(() => {
    const done = document.querySelector('.cc-stat-overlay [data-stat-done]');
    const tip = document.querySelector('#tooltip');
    return { open: !!done, disabled: done?.getAttribute('aria-disabled'), refusal: done?.dataset.refusal || '', tip: tip?.textContent || '', shown: tip?.style.display };
  })()`);
  assert(modalRefusal.open && modalRefusal.disabled === 'true' && /Greatsword needs strength 12.*have 11/.test(modalRefusal.refusal)
    && modalRefusal.shown === 'block' && /Greatsword needs strength 12.*have 11/.test(modalRefusal.tip),
  `${width}x${height}: Assign Points Done explains the current equipment refusal`);
  await click('.cc-stat-overlay [aria-label="Decrease Dexterity"]');
  await click('.cc-stat-overlay [aria-label="Increase Strength"]');
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Reaver correction overlay close');
  assert((await evaluate(`document.querySelector('#cz-start').hasAttribute('aria-disabled')`)) === false, `${width}x${height}: correcting stats clears the equipment refusal`);

  await open('class');

  await click('.cz-class[data-class="starseer"]');
  assert((await evaluate(`document.querySelector('[data-face="class"] .disc-value').textContent`)) === 'Starseer', `${width}x${height}: class selector updates its receipt`);
  await open('character');
  assert(await noOverflow(), `${width}x${height}: Character has no horizontal overflow`);
  assert((await evaluate(`document.querySelectorAll('.cc-primary-stats .cc-primary-stat').length`)) === 5, `${width}x${height}: five primary stats are vertical cards`);
  assert((await evaluate(`document.querySelectorAll('#cz-character-panel .se-step').length`)) === 0, `${width}x${height}: Standard shows no plus/minus controls`);
  await click('#cz-character-fold [data-face="sprite"]');
  await click('#cz-styles .cz-opt', 1);
  await click('#cz-character-fold [data-face="tint"]');
  await click('#cz-tints .cz-opt', 1);
  await click('#cz-character-fold [data-face="sigil"]');
  await click('#cz-glyphs .cz-opt', 1);
  await click('#cz-character-fold [data-face="keepsake"]');
  await click('#cz-keepsakes .cz-keepsake', 1);
  assert((await evaluate(`[...document.querySelectorAll('#cz-character-fold > .disc-faces > .disc-face[aria-expanded="true"]')].map(e=>e.dataset.face).join(',')`)) === 'keepsake', `${width}x${height}: nested Character disclosures keep only the focused picker open`);
  await setInput('#cz-name', 'Marya');
  await click('#cz-character-fold [data-face="primary"]');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Assign Points overlay');
  assert((await evaluate(`document.querySelectorAll('.cc-stat-overlay .se-step').length`)) === 10, `${width}x${height}: Assign Points reuses five plus/minus rows in an overlay`);
  await evaluate(`(() => { document.querySelectorAll('.gp-focus').forEach(e => e.classList.remove('gp-focus')); const e=document.querySelector('.cc-stat-overlay [aria-label="Decrease Dexterity"]'); e.focus(); e.classList.add('gp-focus'); e.click(); })()`);
  assert(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Decrease Dexterity' && document.querySelector('.cc-stat-overlay .gp-focus')?.getAttribute('aria-label') === 'Decrease Dexterity'`), `${width}x${height}: redraw preserves keyboard and gamepad focus on the decremented stat`);
  await evaluate(`(() => { const e=document.querySelector('.cc-stat-overlay [aria-label="Increase Dexterity"]'); document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus')); e.focus(); e.classList.add('gp-focus'); e.click(); })()`);
  assert(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Increase Dexterity' && document.querySelector('.cc-stat-overlay .gp-focus')?.getAttribute('aria-label') === 'Increase Dexterity'`), `${width}x${height}: redraw preserves keyboard and gamepad focus on the incremented stat`);
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Assign Points overlay close');

  await open('equipment');
  assert(await noOverflow(), `${width}x${height}: Starting Equip has no horizontal overflow`);
  assert((await evaluate(`document.querySelectorAll('#cz-armours .equip-chip').length`)) >= 2, `${width}x${height}: at least two armour cards are direct selectors`);
  assert((await evaluate(`document.querySelectorAll('#cz-left-hand .equip-chip').length`)) >= 2, `${width}x${height}: Left Hand has direct armament cards`);
  assert((await evaluate(`document.querySelectorAll('#cz-right-hand .equip-chip').length`)) >= 2, `${width}x${height}: Right Hand has direct armament cards`);
  await click('#cz-armours .equip-chip', 1);
  await click('#cz-left-hand [data-armament-id="ashStaff"]');
  await click('#cz-right-hand [data-armament-id="ashStaff"]');
  const moved = await evaluate(`(() => ({left:document.querySelector('#cz-left-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed'),right:document.querySelector('#cz-right-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed')}))()`);
  assert(moved.left === 'false' && moved.right === 'true', `${width}x${height}: choosing one armament for the other hand moves it`);
  await click('#cz-left-hand [data-armament-id="starstoneStaff"]');
  await click('#cz-relics .cc-relic-card', 1);

  await open('character');
  const persisted = await evaluate(`(() => ({
    name:document.querySelector('#cz-name').value,
    pointbuy:document.querySelector('#cz-statedit .se-mode[data-creation-mode="pointbuy"]').getAttribute('aria-pressed'),
    keepsake:document.querySelector('#cz-keepsakes [data-keepsake-id="oldCinder"]').getAttribute('aria-pressed')
  }))()`);
  assert(persisted.name === 'Marya' && persisted.pointbuy === 'true' && persisted.keepsake === 'true', `${width}x${height}: character choices persist through section changes`);
  await open('equipment');
  const gearPersisted = await evaluate(`(() => ({
    armour:document.querySelectorAll('#cz-armours .equip-chip')[1].getAttribute('aria-pressed'),
    left:document.querySelector('#cz-left-hand [data-armament-id="starstoneStaff"]').getAttribute('aria-pressed'),
    right:document.querySelector('#cz-right-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed'),
    relic:document.querySelectorAll('#cz-relics .cc-relic-card')[1].getAttribute('aria-pressed')
  }))()`);
  assert(Object.values(gearPersisted).every((value) => value === 'true'), `${width}x${height}: equipment choices persist through section changes`);

  await open('seed');
  await setInput('#seed-input', 'REDESIGN');
  assert(await noOverflow(), `${width}x${height}: Seed has no horizontal overflow`);
  await open(screenshotSection);
  await wait(250);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, screenshotName), Buffer.from(shot.data, 'base64'));

  await open('seed');
  await click('#cz-start');
  await until(`!!document.querySelector('.mapscreen')`, 'Begin to enter the map');
  const begun = await evaluate(`document.querySelector('.mapscreen .nm').textContent`);
  assert(/MARYA.*STARSEER/.test(begun), `${width}x${height}: Begin consumes the selected character values`);
  assert(errors.length === 0, `${width}x${height}: no uncaught browser exceptions`);
  await cdp.send('Target.closeTarget', { targetId });
}

async function checkCatalog(width, height, screenshotName) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  }, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=components` }, sessionId);
  const started = Date.now();
  while (Date.now() - started < 15000 && !(await evaluate(`!!document.querySelector('.component-catalog')`).catch(() => false))) await wait(100);
  const receipt = await evaluate(`(() => {
    const root = document.querySelector('.component-catalog');
    const items = [...root.querySelectorAll('[data-catalog-component]')];
    return {
      keys: items.map((item) => item.dataset.catalogComponent),
      visible: items.every((item) => { const r=item.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(item).display!=='none'; }),
      controls: {
        classes: root.querySelectorAll('.cz-class').length,
        stats: root.querySelectorAll('.cc-primary-stat').length,
        keepsakes: root.querySelectorAll('.cz-keepsake').length,
        armour: root.querySelectorAll('#cz-armours .equip-chip').length,
        left: root.querySelectorAll('#cz-left-hand .equip-chip').length,
        right: root.querySelectorAll('#cz-right-hand .equip-chip').length,
        relics: root.querySelectorAll('.cc-relic-card').length,
        seed: root.querySelectorAll('#seed-input').length,
      },
      primitives: {
        disclosure: root.querySelectorAll('[data-catalog-component="character-disclosure"] .disc-face').length,
        stat: root.querySelectorAll('[data-catalog-component="primary-stat-card"] .cc-primary-stat').length,
        resources: root.querySelectorAll('[data-catalog-component="resource-strip"] .cc-derived').length,
        mode: root.querySelectorAll('[data-catalog-component="mode-choice"] .se-mode').length,
        sprite: root.querySelectorAll('[data-catalog-component="sprite-choice"] .cz-opt.style').length,
        tint: root.querySelectorAll('[data-catalog-component="tint-choice"] .cz-opt.tint').length,
        sigil: root.querySelectorAll('[data-catalog-component="sigil-choice"] .cz-opt').length,
        keepsake: root.querySelectorAll('[data-catalog-component="keepsake-choice"] .cz-keepsake').length,
      },
      overflow: root.scrollWidth > root.clientWidth + 1,
    };
  })()`);
  assert(receipt.visible && receipt.keys.join(',') === 'class,character,equipment,seed,character-disclosure,primary-stat-card,resource-strip,mode-choice,sprite-choice,tint-choice,sigil-choice,keepsake-choice', `${width}x${height}: component catalog shows live sections plus all reusable Character primitives`);
  assert(receipt.controls.classes >= 2 && receipt.controls.stats >= 5 && receipt.controls.keepsakes >= 2
    && receipt.controls.armour >= 2 && receipt.controls.left >= 2 && receipt.controls.right >= 2
    && receipt.controls.relics >= 2 && receipt.controls.seed === 1 && !receipt.overflow,
  `${width}x${height}: component catalog includes every creation selector without horizontal overflow`);
  assert(Object.values(receipt.primitives).every((count) => count >= 1),
    `${width}x${height}: component catalog references every reusable Character card primitive`);
  await evaluate(`document.querySelector('[data-catalog-component="character-disclosure"]').scrollIntoView({block:'start'})`);
  await wait(150);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, screenshotName), Buffer.from(shot.data, 'base64'));
  await cdp.send('Target.closeTarget', { targetId });
}

try {
  await exercise(1440, 900, 'character-creation-after-desktop.png', 'character', {
    schemaVersion: 2, settings: {}, results: [], discoveredArmaments: [], discoveryReceipts: [], unlocked: ['winAsReaver'],
  });
  await exercise(390, 844, 'character-creation-after-mobile.png', 'character');
  await checkCatalog(1440, 900, 'character-creation-component-catalog-desktop.png');
  await checkCatalog(390, 844, 'character-creation-component-catalog-mobile.png');
} catch (error) {
  failures += 1;
  console.error(`FAIL browser harness: ${error.stack || error.message}`);
} finally {
  cdp.close();
  await browser.close();
  await new Promise((resolveClose) => server.server.close(resolveClose));
}

console.log(`character-creation-check: ${checks - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
