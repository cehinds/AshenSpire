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
];
const SURFACES = [
  { name: 'title', query: '' },
  { name: 'map', query: '?shot=map' },
  { name: 'combat', query: '?shot=combat' },
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
    if (r.phone && (button.width < 43.5 || button.height < 43.5)) bad.push(`control ${index + 1} lost the 44px phone touch floor`);
    if (!r.phone && (button.height < 23.5 || button.height > 24.5)) bad.push(`control ${index + 1} wide height is ${button.height.toFixed(2)}px, expected 24px`);
    if (button.border !== '0px' || button.background !== 'rgba(0, 0, 0, 0)' || button.shadow !== 'none') {
      bad.push(`control ${index + 1} still paints a card`);
    }
  }
  if (r.buttonGap > 1) bad.push(`control gap is ${r.buttonGap.toFixed(2)}px`);
  if (!r.phone && r.stack.height > 49) bad.push(`wide rail is still ${r.stack.height.toFixed(2)}px tall`);
  if (r.phone && r.glyphPx > 14.5) bad.push(`phone glyph is ${r.glyphPx.toFixed(2)}px`);
  if (r.phone && (r.glyphCenterGap < 27.5 || r.glyphCenterGap > 28.5)) bad.push(`phone glyph-center gap is ${r.glyphCenterGap.toFixed(2)}px, expected 28px`);
  if (!r.phone && r.labelPx > 10.5) bad.push(`desktop label is ${r.labelPx.toFixed(2)}px`);
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
      await waitFor(client.send.bind(client), sessionId, "!!document.querySelector('[data-hud-quick-settings]')");
      await new Promise((done) => setTimeout(done, 250));
      const evaluated = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(()=>{
          const box=(el)=>el?(()=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
          const stack=document.querySelector('[data-hud-quick-settings]');
          const buttons=[...stack.querySelectorAll('.hud-quick-setting')];
          const painted=buttons.map((el)=>{const c=getComputedStyle(el),r=box(el);return {...r,border:c.borderTopWidth,background:c.backgroundColor,shadow:c.boxShadow}});
          const glyph=stack.querySelector('.hud-quick-setting-glyph');
          const glyphBoxes=[...stack.querySelectorAll('.hud-quick-setting-glyph')].map(box);
          const label=stack.querySelector('.hud-quick-setting-label');
          const orientation=document.querySelector('.map-entrance-orientation');
          const info=document.querySelector('.hud-info-row');
          const combatantInk=[...document.querySelectorAll('.combatant .intent, .combatant .sprite, .combatant .nm, .combatant .meters, .combatant .statuses')];
          const sr=box(stack);
          return {
            viewport:{width:innerWidth,height:innerHeight}, stack:sr, buttons:painted,
            rightGap:innerWidth-sr.right,
            buttonGap:painted.length===2?painted[1].top-painted[0].bottom:999,
            glyphPx:glyph?parseFloat(getComputedStyle(glyph).fontSize)*(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))||1):0,
            glyphCenterGap:glyphBoxes.length===2?Math.abs((glyphBoxes[1].top+glyphBoxes[1].bottom-glyphBoxes[0].top-glyphBoxes[0].bottom)/2):999,
            labelPx:label?parseFloat(getComputedStyle(label).fontSize)*(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))||1):0,
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
