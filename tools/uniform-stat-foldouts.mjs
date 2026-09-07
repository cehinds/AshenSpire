#!/usr/bin/env node
// Focused rendered-browser contract for the primary-stat foldouts.
//
// Door: the source tree (or --standalone shipped alias) through serve.mjs, in
// real Chromium, at desktop and phone shapes. The card presses below are
// trusted CDP mouse/touch input; DOM clicks are used only to establish the
// Character Creation and Armoury routes.
//
// Boundary: this proves equal rendered face boxes and single-open behavior for
// the five primary stats in Character Creation, Assign Points, and the Armoury
// Character pane. It does not compare pixels to a golden image or judge every
// other <details> family in the game.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.env.ASHENSPIRE_FOLDOUT_OUT || join(ROOT, 'outputs', 'uniform-stat-foldouts'));
const STANDALONE = process.argv.includes('--standalone');
const APP_PATH = STANDALONE ? '/AshenSpire.html' : '/';
const DOOR = STANDALONE ? 'standalone' : 'source';
const SHAPES = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const browserPath = resolveBrowser([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]);

if (!browserPath) {
  console.error('uniform-stat-foldouts: no Chrome/Edge found; set CHROME');
  process.exit(2);
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const pair = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) pair.reject(new Error(message.error.message));
    else pair.resolve(message.result);
  });
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId = null) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { resolve: done, reject: fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

let checks = 0;
let failures = 0;
function check(condition, message, detail = null) {
  checks += 1;
  if (condition) console.log(`PASS ${message}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  else {
    failures += 1;
    console.log(`FAIL ${message}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  }
}

const server = await serve({ root: ROOT, port: 8494, open: false });
const browser = await launchBrowser({ prefix: 'uniform-foldouts-', browser: browserPath, timeoutMs: 20000 });
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
mkdirSync(OUT, { recursive: true });

async function openTarget(shape) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
  }, sessionId);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile, maxTouchPoints: 5 }, sessionId);
  const evaluate = async (expression) => {
    const reply = await cdp.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'evaluation failed');
    return reply.result.value;
  };
  const until = async (expression, label, timeout = 30000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  return { targetId, sessionId, evaluate, until };
}

async function trustedClick(page, shape, selector) {
  const point = await page.evaluate(`(async () => {
    const target=document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    target.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    window.__uniformFoldoutPress=null;
    target.addEventListener('pointerdown', (event) => {
      window.__uniformFoldoutPress={trusted:event.isTrusted,pointerType:event.pointerType};
    }, {once:true,capture:true});
    const rect=target.getBoundingClientRect();
    for (const yf of [0.5,0.25,0.75]) for (const xf of [0.5,0.25,0.75,0.1,0.9]) {
      const x=rect.left+rect.width*xf, y=rect.top+rect.height*yf;
      if (x<0 || y<0 || x>innerWidth || y>innerHeight) continue;
      const hit=document.elementFromPoint(x,y);
      if (hit && (hit===target || target.contains(hit))) return {x,y};
    }
    return {covered:true,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};
  })()`);
  if (!point) throw new Error(`missing click target ${selector}`);
  if (point.covered) throw new Error(`no exposed point for ${selector}: ${JSON.stringify(point.rect)}`);
  if (shape.mobile) {
    const touch = { x: point.x, y: point.y, id: 1, radiusX: 8, radiusY: 8, force: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] }, page.sessionId);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, page.sessionId);
  } else {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, page.sessionId);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, page.sessionId);
  }
  await wait(180);
  const receipt = await page.evaluate('window.__uniformFoldoutPress');
  check(receipt?.trusted === true, `${shape.name}: ${selector} receives trusted ${shape.mobile ? 'touch' : 'mouse'} input`, receipt);
}

async function screenshot(page, shape, selector, name) {
  await page.evaluate(`(async () => {
    const target=document.querySelector(${JSON.stringify(selector)});
    target?.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  })()`);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false,
  }, page.sessionId);
  const path = join(OUT, `${name}-${shape.name}-${DOOR}.png`);
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log(`SHOT ${path}`);
}

const primaryGeometry = `((rootSelector) => {
  const root=document.querySelector(rootSelector);
  const cards=[...(root?.querySelectorAll('[data-face^="attribute:"]') || [])];
  const rects=cards.map((card) => card.getBoundingClientRect());
  // A node-backed primary face owns its inset on the adopted Row. Armoury's
  // string-backed equivalent owns the same inset on the OptionCard itself.
  const rows=cards.map((card) => card.querySelector(':scope > .as-row') || card);
  const insets=rows.map((row) => {
    if (!row) return null;
    const style=getComputedStyle(row);
    return {
      top:parseFloat(style.paddingTop), right:parseFloat(style.paddingRight),
      bottom:parseFloat(style.paddingBottom), left:parseFloat(style.paddingLeft),
    };
  });
  const balancedInsets=insets.length>0 && insets.every((inset) => inset
    && inset.left>0 && inset.top>0
    && Math.abs(inset.left-inset.right)<=0.01
    && Math.abs(inset.top-inset.bottom)<=0.01);
  const sameInsets=insets.length>0 && insets.every((inset) => inset
    && Object.keys(inset).every((edge) => Math.abs(inset[edge]-insets[0][edge])<=0.01));
  return {
    count:cards.length,
    semanticCards:cards.filter((card) => card.matches('details > summary')).length,
    attachedReveals:cards.filter((card) => card.nextElementSibling?.classList.contains('disc-reveal')).length,
    labels:cards.map((card) => (card.querySelector('.ls-label,.disc-name')?.textContent || '').trim()),
    summaries:cards.map((card) => (card.querySelector('.disc-summary')?.textContent || '').trim()),
    equalWidth:rects.length>0 && rects.every((rect) => Math.abs(rect.width-rects[0].width)<=1),
    equalHeight:rects.length>0 && rects.every((rect) => Math.abs(rect.height-rects[0].height)<=1),
    balancedInsets,
    sameInsets,
    insets,
    widths:rects.map((rect) => Math.round(rect.width*100)/100),
    heights:rects.map((rect) => Math.round(rect.height*100)/100),
  };
})`;

async function checkCreation(shape) {
  const page = await openTarget(shape);
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}${APP_PATH}?shot=customize` }, page.sessionId);
  await page.until("document.querySelectorAll('.cz-flow > .disc-faces > .disc-face').length===4", 'Character Creation');
  await page.evaluate("document.querySelector('.cz-flow > .disc-faces > [data-face=\"character\"]').click()");
  await page.until("!!document.querySelector('#cz-primary-stats [data-face=\"attribute:strength\"]')", 'primary stats');

  const geometry = await page.evaluate(`${primaryGeometry}('#cz-primary-stats')`);
  check(geometry.count === 5 && geometry.semanticCards === 5 && geometry.attachedReveals === 5
    && geometry.labels.join(',') === 'STR,DEX,CON,WIS,INT'
    && geometry.summaries.every(Boolean) && geometry.equalWidth && geometry.equalHeight
    && geometry.balancedInsets && geometry.sameInsets,
  `${shape.name}: Character Creation uses five compact, uniform primary-stat faces`, geometry);

  await trustedClick(page, shape, '#cz-primary-stats [data-face="attribute:strength"]');
  await trustedClick(page, shape, '#cz-primary-stats [data-face="attribute:dexterity"]');
  const oneOpen = await page.evaluate(`(() => ({
    faces:[...document.querySelectorAll('#cz-primary-stats [aria-expanded="true"]')].map((node) => node.dataset.face),
    reveals:[...document.querySelectorAll('#cz-primary-stats .disc-reveal')].filter((node) => !node.hidden).map((node) => node.dataset.revealFor),
  }))()`);
  check(oneOpen.faces.join(',') === 'attribute:dexterity' && oneOpen.reveals.join(',') === 'attribute:dexterity',
    `${shape.name}: opening Dexterity closes Strength in Character Creation`, oneOpen);
  await screenshot(page, shape, '#cz-primary-stats', 'character-creation');

  await trustedClick(page, shape, '#cz-statedit [data-creation-mode="pointbuy"]');
  await page.until("!!document.querySelector('.cc-stat-overlay')", 'Assign Points');
  const allocationGeometry = await page.evaluate(`${primaryGeometry}('.cc-stat-overlay')`);
  check(allocationGeometry.count === 5 && allocationGeometry.semanticCards === 5 && allocationGeometry.attachedReveals === 5
    && allocationGeometry.labels.join(',') === 'STR,DEX,CON,WIS,INT'
    && allocationGeometry.equalHeight
    && allocationGeometry.balancedInsets && allocationGeometry.sameInsets,
  `${shape.name}: Assign Points reuses the same compact primary-stat family`, allocationGeometry);
  await trustedClick(page, shape, '.cc-stat-overlay [data-face="attribute:strength"]');
  await trustedClick(page, shape, '.cc-stat-overlay [data-face="attribute:dexterity"]');
  const allocationOpen = await page.evaluate(`(() => ({
    faces:[...document.querySelectorAll('.cc-stat-overlay [aria-expanded="true"]')].map((node) => node.dataset.face),
    reveals:[...document.querySelectorAll('.cc-stat-overlay .disc-reveal')].filter((node) => !node.hidden).map((node) => node.dataset.revealFor),
  }))()`);
  check(allocationOpen.faces.join(',') === 'attribute:dexterity' && allocationOpen.reveals.join(',') === 'attribute:dexterity',
    `${shape.name}: Assign Points also keeps exactly one primary stat open`, allocationOpen);
  await screenshot(page, shape, '.cc-stat-modal', 'assign-points');
  await cdp.send('Target.closeTarget', { targetId: page.targetId });
}

async function checkArmoury(shape) {
  const page = await openTarget(shape);
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}${APP_PATH}?shot=combat` }, page.sessionId);
  await page.until("!!document.querySelector('.combat .hand .card')", 'Combat');
  await page.evaluate("document.querySelector('#combat-armoury').click()");
  await page.until("!!document.querySelector('.armoury-overlay [data-surface=\"armouryView\"]')", 'Armoury');
  await page.evaluate("document.querySelector('.armoury-overlay [data-surface=\"armouryView\"] [data-member=\"grid\"]').click()");
  await page.until("document.querySelector('.armoury')?.dataset.pane==='character' && document.querySelectorAll('.character-info-card').length===4", 'Armoury Character view');

  const arrival = await page.evaluate(`(() => ({
    cards:[...document.querySelectorAll('.character-info-card')].map((card) => card.dataset.component),
    open:[...document.querySelectorAll('.character-info-card[open]')].map((card) => card.dataset.component),
    aria:[...document.querySelectorAll('.character-info-card > summary')].map((head) => head.getAttribute('aria-expanded')),
  }))()`);
  check(arrival.cards.length === 4 && arrival.open.join(',') === 'armoury.attributesCard'
    && arrival.aria.filter((value) => value === 'true').length === 1,
  `${shape.name}: Armoury Character arrives with only Attributes expanded`, arrival);

  const geometry = await page.evaluate(`${primaryGeometry}('.attributesCard')`);
  check(geometry.count === 5 && geometry.semanticCards === 5 && geometry.attachedReveals === 5
    && geometry.labels.join(',') === 'STR,DEX,CON,WIS,INT'
    && geometry.summaries.every(Boolean) && geometry.equalWidth && geometry.equalHeight
    && geometry.balancedInsets && geometry.sameInsets,
  `${shape.name}: Armoury Attributes matches the five compact, uniform rows`, geometry);

  await trustedClick(page, shape, '.attributesCard [data-face="attribute:strength"]');
  await trustedClick(page, shape, '.attributesCard [data-face="attribute:dexterity"]');
  const attributeOpen = await page.evaluate(`(() => ({
    faces:[...document.querySelectorAll('.attributesCard [data-face][aria-expanded="true"]')].map((node) => node.dataset.face),
    reveals:[...document.querySelectorAll('.attributesCard .disc-reveal')].filter((node) => !node.hidden).map((node) => node.dataset.revealFor),
  }))()`);
  check(attributeOpen.faces.join(',') === 'attribute:dexterity' && attributeOpen.reveals.join(',') === 'attribute:dexterity',
    `${shape.name}: Armoury Attributes keeps each detail attached and only one stat open`, attributeOpen);
  await trustedClick(page, shape, '.attributesCard > summary');
  const folded = await page.evaluate(`(() => {
    const cards=[...document.querySelectorAll('.character-info-card')];
    return cards.map((card) => {
      const rect=card.getBoundingClientRect();
      return {open:card.open,width:rect.width,height:rect.height,
        head:card.firstElementChild.getBoundingClientRect().height,
        overflow:card.scrollWidth>card.clientWidth+1};
    });
  })()`);
  check(folded.length === 4 && folded.every((card) => !card.open && !card.overflow
    && card.head >= 43 && Math.abs(card.height-folded[0].height) <= 1
    && Math.abs(card.width-folded[0].width) <= 1),
  `${shape.name}: all four folded information cards have uniform, tap-sized headers`, folded);
  await screenshot(page, shape, '.armoury-character-stats', 'armoury-folded');

  await trustedClick(page, shape, '.combatPowerCard > summary');
  let open = await page.evaluate(`[...document.querySelectorAll('.character-info-card[open]')].map((card) => card.dataset.component)`);
  check(open.join(',') === 'armoury.combatPowerCard', `${shape.name}: opening Combat Power closes Attributes`, open);
  await trustedClick(page, shape, '.relicsCard > summary');
  open = await page.evaluate(`[...document.querySelectorAll('.character-info-card[open]')].map((card) => card.dataset.component)`);
  check(open.join(',') === 'armoury.relicsCard', `${shape.name}: opening Relics closes Combat Power`, open);
  await trustedClick(page, shape, '.attributesCard > summary');
  open = await page.evaluate(`[...document.querySelectorAll('.character-info-card[open]')].map((card) => card.dataset.component)`);
  check(open.join(',') === 'armoury.attributesCard', `${shape.name}: reopening Attributes closes Relics`, open);
  const focus = await page.evaluate(`document.activeElement===document.querySelector('.attributesCard > summary')`);
  check(focus, `${shape.name}: the newly opened information header owns focus`);
  await screenshot(page, shape, '.attributesCard', 'armoury-attributes');
  // Three activations in one task expose races hidden by click-and-wait checks.
  await page.evaluate(`['relicsCard','attributesCard','combatPowerCard'].forEach((name) =>
    document.querySelector('.'+name+' > summary').click())`);
  await wait(200);
  const rapid = await page.evaluate(`(() => {
    const cards=[...document.querySelectorAll('.character-info-card')];
    return {open:cards.filter((card) => card.open).map((card) => card.dataset.component),
      aria:cards.every((card) => card.firstElementChild.getAttribute('aria-expanded')===String(card.open))};
  })()`);
  check(rapid.open.join(',') === 'armoury.combatPowerCard' && rapid.aria,
    `${shape.name}: rapid activation leaves only the last chosen card open with matching ARIA`, rapid);
  await cdp.send('Target.closeTarget', { targetId: page.targetId });
}

try {
  for (const shape of SHAPES) {
    await checkCreation(shape);
    await checkArmoury(shape);
  }
} catch (error) {
  failures += 1;
  console.error(`FAIL browser harness: ${error.stack || error.message}`);
} finally {
  console.log('');
  console.log(`BOUNDARY: rendered ${DOOR}; 1440x900 and 390x844; primary-stat foldouts in Character Creation, Assign Points, and Armoury Character only.`);
  console.log('BOUNDARY: geometry and trusted interaction are checked; screenshots are evidence, not pixel-golden assertions.');
  cdp.close();
  await browser.close();
  await new Promise((done) => server.server.close(done));
}

console.log(`uniform-stat-foldouts: ${checks - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
