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
  { name: 'music-off', query: '?shot=map&shotSettings=%7B%22musicEnabled%22%3Afalse%7D' },
];

const intersection = (a, b) => !a || !b ? 0
  : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function findings(r) {
  const bad = [];
  if (r.stack.right > r.viewport.width + 0.5 || r.stack.left < -0.5) bad.push('rail leaves the viewport');
  if (r.rightGap < -0.5 || r.rightGap > 9) bad.push(`right gap is ${r.rightGap.toFixed(2)}px`);
  if (r.buttons.length !== 2) bad.push(`expected 2 controls, saw ${r.buttons.length}`);
  for (const [index, button] of r.buttons.entries()) {
    if (button.width < 43.5 || button.height < 43.5) bad.push(`control ${index + 1} lost the shared 44px touch floor`);
    if (button.border !== '0px' || button.background !== 'rgba(0, 0, 0, 0)' || button.shadow !== 'none') {
      bad.push(`control ${index + 1} outer touch target paints a second card`);
    }
  }
  if (r.buttonGap > 1) bad.push(`control gap is ${r.buttonGap.toFixed(2)}px`);
  if (r.stack.height > 89) bad.push(`shared rail is ${r.stack.height.toFixed(2)}px tall`);
  for (const [index, face] of r.faces.entries()) {
    if (face.width < 39.5 || face.width > 40.5 || face.height < 39.5 || face.height > 40.5) {
      bad.push(`face ${index + 1} is ${face.width.toFixed(2)}×${face.height.toFixed(2)}px, expected 40×40`);
    }
    if (face.border === '0px' || face.background === 'rgba(0, 0, 0, 0)') bad.push(`face ${index + 1} does not paint the compact card`);
  }
  if (r.faceGap < 3.5 || r.faceGap > 4.5) bad.push(`visible card gap is ${r.faceGap.toFixed(2)}px, expected 4px`);
  if (r.glyphPx < 27.5 || r.glyphPx > 28.5) bad.push(`primary glyph is ${r.glyphPx.toFixed(2)}px, expected 28px`);
  if (r.stateDotPx < 5.5 || r.stateDotPx > 6.5) bad.push(`state dot is ${r.stateDotPx.toFixed(2)}px, expected 6px`);
  if (r.phone && r.quickPanel && r.quickPanel.height > 89.5) bad.push(`Quick Access panel is still ${r.quickPanel.height.toFixed(2)}px tall on mobile`);
  if (r.phone && r.quickTargets.some((target) => target.width < 43.5 || target.height < 43.5)) bad.push('Quick Access density reduced a gameplay target below 44px');
  if (r.orientationOverlap > 0.5) bad.push(`rail covers ${r.orientationOverlap.toFixed(2)}px² of the entrance-to-boss receipt`);
  if (r.infoOverlap > 0.5) bad.push(`rail covers ${r.infoOverlap.toFixed(2)}px² of the run header`);
  if (r.combatantOverlap > 0.5) bad.push(`rail covers ${r.combatantOverlap.toFixed(2)}px² of a combatant`);
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
          return {
            viewport:{width:innerWidth,height:innerHeight}, stack:sr, buttons:painted, faces,
            rightGap:innerWidth-sr.right,
            buttonGap:painted.length===2?painted[1].top-painted[0].bottom:999,
            faceGap:faces.length===2?faces[1].top-faces[0].bottom:999,
            glyphPx:visibleGlyph?box(visibleGlyph).width:0,
            stateDotPx:state?box(state).width:0,
            quickPanel:box(quickPanel), quickTargets:quickTargets.map(box),
            orientationOverlap:(${intersection.toString()})(sr,box(orientation)),
            infoOverlap:(${intersection.toString()})(sr,box(info)),
            combatantOverlap:Math.max(0,...combatantInk.map((el)=>(${intersection.toString()})(sr,box(el)))),
            phone:${shape.mobile}
          };
        })()`,
      }, sessionId);
      const receipt = evaluated.result.value;
      const bad = findings(receipt);
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
