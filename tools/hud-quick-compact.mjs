#!/usr/bin/env node
// Focused rendered receipt for the compact Fullscreen/Music utility rail.
// It checks the two player-reported failures: oversized visible cards and the
// phone rail covering the entrance-to-boss orientation receipt.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tools/results/hud-quick-compact');
const BUILD = process.argv.includes('--build');
const SHAPES = [
  { name: 'desktop', width: 1200, height: 730, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'iphone-se', width: 375, height: 667, mobile: true },
];
const SURFACES = [
  { name: 'title', query: '' },
  { name: 'map', query: '?shot=map' },
  { name: 'combat', query: '?shot=combat' },
  { name: 'map-compact', query: '?shot=map&shotSettings=%7B%22runHudMode%22%3A%22compact%22%7D', compact: true },
  { name: 'combat-compact', query: '?shot=combat&shotSettings=%7B%22runHudMode%22%3A%22compact%22%7D', compact: true },
  { name: 'music-off', query: '?shot=map&shotSettings=%7B%22musicEnabled%22%3Afalse%7D' },
];

const intersection = (a, b) => !a || !b ? 0
  : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function findings(r) {
  const bad = [];
  const expectedOuter = r.phone && r.compact ? 36 : 44;
  const expectedFace = r.phone ? 32 : 40;
  const expectedGlyph = r.phone ? 22 : 28;
  const expectedButtonGap = r.compact ? 2 : 0;
  const expectedFaceGap = expectedOuter - expectedFace + expectedButtonGap;
  if (r.stack.right > r.viewport.width + 0.5 || r.stack.left < -0.5) bad.push('rail leaves the viewport');
  if (r.rightGap < -0.5 || r.rightGap > 9) bad.push(`right gap is ${r.rightGap.toFixed(2)}px`);
  if (r.buttons.length !== 2) bad.push(`expected 2 controls, saw ${r.buttons.length}`);
  for (const [index, button] of r.buttons.entries()) {
    if (Math.abs(button.width - expectedOuter) > 0.5 || Math.abs(button.height - expectedOuter) > 0.5) {
      bad.push(`control ${index + 1} is ${button.width.toFixed(2)}×${button.height.toFixed(2)}px, expected ${expectedOuter}×${expectedOuter}`);
    }
    if (button.border !== '0px' || button.background !== 'rgba(0, 0, 0, 0)' || button.shadow !== 'none') {
      bad.push(`control ${index + 1} outer touch target paints a second card`);
    }
  }
  if (Math.abs(r.buttonGap - expectedButtonGap) > 0.5) bad.push(`control gap is ${r.buttonGap.toFixed(2)}px, expected ${expectedButtonGap}px`);
  const expectedStackHeight = r.horizontal ? expectedOuter : ((expectedOuter * 2) + expectedButtonGap);
  if (Math.abs(r.stack.height - expectedStackHeight) > 0.5) bad.push(`shared rail is ${r.stack.height.toFixed(2)}px tall, expected ${expectedStackHeight}px`);
  for (const [index, face] of r.faces.entries()) {
    if (Math.abs(face.width - expectedFace) > 0.5 || Math.abs(face.height - expectedFace) > 0.5) {
      bad.push(`face ${index + 1} is ${face.width.toFixed(2)}×${face.height.toFixed(2)}px, expected ${expectedFace}×${expectedFace}`);
    }
    if (face.border === '0px' || face.background === 'rgba(0, 0, 0, 0)') bad.push(`face ${index + 1} does not paint the compact card`);
  }
  if (Math.abs(r.faceGap - expectedFaceGap) > 0.5) bad.push(`visible card gap is ${r.faceGap.toFixed(2)}px, expected ${expectedFaceGap}px`);
  if (Math.abs(r.glyphPx - expectedGlyph) > 0.5) bad.push(`primary glyph is ${r.glyphPx.toFixed(2)}px, expected ${expectedGlyph}px`);
  if (r.stateDotPx < 5.5 || r.stateDotPx > 6.5) bad.push(`state dot is ${r.stateDotPx.toFixed(2)}px, expected 6px`);
  if (r.phone && r.quickPanel && r.quickPanel.height > 89.5) bad.push(`Quick Access panel is still ${r.quickPanel.height.toFixed(2)}px tall on mobile`);
  if (r.phone && r.quickTargets.some((target) => target.width < expectedOuter - 0.5 || target.height < expectedOuter - 0.5)) {
    bad.push(`Quick Access density reduced a gameplay target below ${expectedOuter}px`);
  }
  if (r.orientationOverlap > 0.5) bad.push(`rail covers ${r.orientationOverlap.toFixed(2)}px² of the entrance-to-boss receipt`);
  if (r.infoOverlap > 0.5) bad.push(`rail covers ${r.infoOverlap.toFixed(2)}px² of the run header`);
  if (r.combatantOverlap > 0.5) bad.push(`rail covers ${r.combatantOverlap.toFixed(2)}px² of a combatant`);
  if (r.compact && r.stack.top < r.header.bottom - 0.5) bad.push('compact Fullscreen/Music pair is not below the shared HUD');
  return bad;
}

function parityFindings(map, combat) {
  const bad = [];
  const near = (a, b) => Math.abs(a - b) <= 0.75;
  const headerReductionVh = ((map.header.height - combat.header.height) / combat.viewport.height) * 100;
  if (headerReductionVh < 1 || headerReductionVh > 5) {
    bad.push(`Combat HUD density delta is ${headerReductionVh.toFixed(2)}vh, expected 1–5vh below Map's unchanged shared baseline`);
  }
  if (combat.hudTop.height > map.hudTop.height + 0.75) {
    bad.push(`Combat HUD content grew: Map ${map.hudTop.height.toFixed(2)}px, Combat ${combat.hudTop.height.toFixed(2)}px`);
  }
  for (const [name, left, right] of [
    ['Fullscreen/Music right edge', map.stack.right, combat.stack.right],
  ]) {
    if (!near(left, right)) bad.push(`${name} differs: Map ${left.toFixed(2)}px, Combat ${right.toFixed(2)}px`);
  }
  if (!map.route || map.route.height < 0.5) bad.push('Map route strip is not visibly rendered');
  else if (Math.abs(map.route.width - (map.viewport.width * 0.8)) > 1.5) {
    bad.push(`Map route strip is ${map.route.width.toFixed(2)}px, expected about 80vw`);
  }
  if (combat.route && (combat.route.width > 0.5 || combat.route.height > 0.5)) bad.push('Combat still renders the Map-only route strip');
  if (Math.abs(map.stack.right - map.quickPanel.right) > 0.75) bad.push('Map Fullscreen/Music stack is not flush with Quick Access');
  if (Math.abs(combat.stack.right - combat.quickPanel.right) > 0.75) bad.push('Combat Fullscreen/Music stack is not flush with Quick Access');
  return bad;
}

function cdpClient(wsUrl) {
  return new Promise((resolveClient, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.onerror = reject;
    socket.onopen = () => {
      let id = 0;
      const waiting = new Map();
      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data);
        const pending = waiting.get(packet.id);
        if (!pending) return;
        waiting.delete(packet.id);
        packet.error ? pending.reject(new Error(packet.error.message)) : pending.resolve(packet.result);
      };
      resolveClient({
        send(method, params = {}, sessionId) {
          const requestId = ++id;
          return new Promise((resolveValue, rejectValue) => {
            waiting.set(requestId, { resolve: resolveValue, reject: rejectValue });
            socket.send(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }));
          });
        },
        close() { socket.close(); },
      });
    };
  });
}

async function waitFor(send, sessionId, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (result.result.value) return;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`timed out waiting for ${expression}`);
}

mkdirSync(OUT, { recursive: true });
const served = await serve({ root: ROOT, port: 8563, open: false });
const browser = resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe']);
if (!browser) {
  served.server.close();
  console.error('hud-quick-compact: UNKNOWN — Chrome not found');
  process.exit(2);
}

const launched = await launchBrowser({ prefix: 'hud-quick-', browser, headless: '--headless=new' });
let client;
let failed = 0;
let passed = 0;
const compactMapReceipts = new Map();
try {
  client = await cdpClient(launched.wsUrl);
  const target = await client.send('Target.createTarget', { url: 'about:blank' });
  const attached = await client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await client.send('Page.enable', {}, sessionId);

  for (const shape of SHAPES) {
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
    }, sessionId);
    for (const surface of SURFACES) {
      await client.send('Page.navigate', { url: `${served.url}/${BUILD ? 'build/AshenSpire.html' : ''}${surface.query}` }, sessionId);
      await waitFor(client.send.bind(client), sessionId, "!!document.querySelector('[data-hud-quick-settings],.startup-gate')");
      const startup = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(()=>{const el=document.querySelector('.startup-gate');if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
      }, sessionId);
      if (startup.result.value) {
        const point = startup.result.value;
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      }
      await waitFor(client.send.bind(client), sessionId, "!!document.querySelector('[data-hud-quick-settings]')");
      await new Promise((done) => setTimeout(done, 250));
      const evaluated = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(()=>{
          const box=(el)=>el?(()=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
          const stack=document.querySelector('[data-hud-quick-settings]');
          const buttons=[...stack.querySelectorAll('.hud-quick-setting')];
          const painted=buttons.map((el)=>{const c=getComputedStyle(el),r=box(el);return {...r,border:c.borderTopWidth,background:c.backgroundColor,shadow:c.boxShadow}});
          const faces=[...stack.querySelectorAll('.hud-quick-setting-face')].map((el)=>{const c=getComputedStyle(el),r=box(el);return {...r,border:c.borderTopWidth,background:c.backgroundColor}});
          const visibleGlyph=[...stack.querySelectorAll('.hud-quick-setting-glyph')].find((el)=>getComputedStyle(el).display!=='none');
          const state=stack.querySelector('.hud-quick-setting-state');
          const quickPanel=document.querySelector('.hud-control-grid');
          const quickTargets=[...document.querySelectorAll('.hud-control-grid :is(.topbar-btn, .flask-slot)')];
          const orientation=document.querySelector('.map-entrance-orientation');
          const info=document.querySelector('.hud-info-row');
          const combatantInk=[...document.querySelectorAll('.combatant .intent, .combatant .sprite, .combatant .nm, .combatant .meters, .combatant .statuses')];
          const sr=box(stack);
          const header=box(document.querySelector('.shared-hud'));
          const route=box(document.querySelector('.act-route-strip'));
          const horizontal=getComputedStyle(stack).flexDirection==='row';
          return {
            viewport:{width:innerWidth,height:innerHeight}, stack:sr, buttons:painted, faces,
            rightGap:innerWidth-sr.right,
            buttonGap:painted.length===2?(horizontal?painted[1].left-painted[0].right:painted[1].top-painted[0].bottom):999,
            faceGap:faces.length===2?(horizontal?faces[1].left-faces[0].right:faces[1].top-faces[0].bottom):999,
            glyphPx:visibleGlyph?box(visibleGlyph).width:0,
            stateDotPx:state?box(state).width:0,
            quickPanel:box(quickPanel), quickTargets:quickTargets.map(box), header,
            hudTop:box(document.querySelector('.hud-top')), route, horizontal,
            orientationOverlap:(${intersection.toString()})(sr,box(orientation)),
            infoOverlap:(${intersection.toString()})(sr,box(info)),
            combatantOverlap:Math.max(0,...combatantInk.map((el)=>(${intersection.toString()})(sr,box(el)))),
            phone:${shape.mobile}, compact:${!!surface.compact}
          };
        })()`,
      }, sessionId);
      const receipt = evaluated.result.value;
      const bad = findings(receipt);
      if (surface.name === 'map-compact') compactMapReceipts.set(shape.name, receipt);
      if (surface.name === 'combat-compact') bad.push(...parityFindings(compactMapReceipts.get(shape.name), receipt));
      const tag = `${surface.name}-${shape.name}`;
      if (bad.length) {
        failed += bad.length;
        console.error(`FAIL ${tag}: ${bad.join('; ')}`);
      } else {
        passed += 1;
        console.log(`PASS ${tag}: compact, inside viewport, collision-free`);
      }
      const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      writeFileSync(resolve(OUT, `${tag}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
} finally {
  client?.close();
  await launched.close();
  served.server.close();
}

if (failed) {
  console.error(`hud-quick-compact: ${passed} surface(s) passed, ${failed} finding(s)`);
  process.exit(1);
}
console.log(`hud-quick-compact: OK — ${passed}/${SHAPES.length * SURFACES.length} rendered ${BUILD ? 'standalone-build' : 'source'} surfaces passed`);
