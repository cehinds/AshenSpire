#!/usr/bin/env node
// Focused rendered receipt for the HUD's two quick controls, Fullscreen and
// Music.
//
// WHAT MOVED, AND WHY (the kit sweep, 2026-09-04). These two used to be a rail
// of their own: a compact CARD inside a bigger touch target, with an authored
// face size, a 70%-scale glyph and a state dot, floated below the HUD. They are
// two kit IconButtons now (styles/kit.css `.as-iconbtn`), in the same cluster as
// ⚒ Armoury and ☰ Menu, at the same `--iconbtn-size` and the same inset — so
// the face/glyph/dot numbers this tool used to hold have no subject any more,
// and holding them would be holding a shape the game deliberately stopped
// drawing. WHAT IT STILL HOLDS is everything the player reported:
//   · the two controls are AT THE PAGE'S OWN icon-button size, measured off a
//     probe element (never parsed out of a calc()), so a Minimum-tap-size or
//     UI-size change moves the assertion with the game;
//   · they are one row with the row's own gap, inside the viewport, flush with
//     the Quick Access panel's right edge, and identical on Map and Combat;
//   · they cover NOTHING: not the entrance-to-boss receipt, not the run header,
//     not a combatant — the two failures this tool was written for;
//   · Map and Combat draw the same HUD (the density delta the compact variant
//     asked for is gone with the variant: one composition, both screens).

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
  // THE SIZE IS THE PAGE'S OWN, MEASURED: a probe sized by var(--iconbtn-size)
  // is appended and read, so this tracks the Minimum-tap-size and UI-size dials
  // instead of a number typed here (tapsize.mjs's lesson).
  const icon = r.iconSize;
  if (!(icon > 0)) bad.push('the page resolved no --iconbtn-size, so nothing could be measured against it');
  if (r.stack.right > r.viewport.width + 0.5 || r.stack.left < -0.5) bad.push('the quick controls leave the viewport');
  if (r.rightGap < -0.5) bad.push(`the cluster hangs off the right edge by ${(-r.rightGap).toFixed(2)}px`);
  if (r.buttons.length !== 2) bad.push(`expected 2 controls, saw ${r.buttons.length}`);
  for (const [index, button] of r.buttons.entries()) {
    if (Math.abs(button.width - icon) > 0.5 || Math.abs(button.height - icon) > 0.5) {
      bad.push(`control ${index + 1} is ${button.width.toFixed(2)}×${button.height.toFixed(2)}px, expected the icon box ${icon.toFixed(2)}×${icon.toFixed(2)}`);
    }
    if (button.border === '0px' && button.background === 'rgba(0, 0, 0, 0)') {
      bad.push(`control ${index + 1} draws no box at all — an IconButton is a bordered square`);
    }
    if (!button.label) bad.push(`control ${index + 1} carries no accessible name`);
  }
  // ONE ROW, THE CLUSTER'S OWN GAP. The gap is read off the cluster the two
  // share with Armoury and Menu, so a change to the kit's cluster moves both.
  if (!r.horizontal) bad.push('the two quick controls are not one row');
  if (r.buttonGap != null && Math.abs(r.buttonGap - r.clusterGap) > 0.5) {
    bad.push(`control gap is ${r.buttonGap.toFixed(2)}px, expected the cluster's own ${r.clusterGap.toFixed(2)}px`);
  }
  if (Math.abs(r.stack.height - icon) > 0.5) {
    bad.push(`the quick controls are ${r.stack.height.toFixed(2)}px tall, expected the icon box ${icon.toFixed(2)}`);
  }
  // THE SAME CLUSTER AS ARMOURY AND THE MENU: same row, same top edge.
  if (r.actionsRow && Math.abs(r.stack.top - r.actionsRow.top) > 0.5) {
    bad.push(`the quick controls sit ${(r.stack.top - r.actionsRow.top).toFixed(2)}px off the Armoury/Menu row`);
  }
  if (r.quickTargets.some((target) => target.width < icon - 0.5 || target.height < icon - 0.5)) {
    bad.push(`a Quick Access target is under the icon box ${icon.toFixed(2)}px`);
  }
  if (r.orientationOverlap > 0.5) bad.push(`the quick controls cover ${r.orientationOverlap.toFixed(2)}px² of the entrance-to-boss receipt`);
  if (r.infoOverlap > 0.5) bad.push(`the quick controls cover ${r.infoOverlap.toFixed(2)}px² of the run header`);
  if (r.combatantOverlap > 0.5) bad.push(`the quick controls cover ${r.combatantOverlap.toFixed(2)}px² of a combatant`);
  return bad;
}

function parityFindings(map, combat) {
  const bad = [];
  const near = (a, b) => Math.abs(a - b) <= 0.75;
  // ONE COMPOSITION, BOTH SCREENS. The compact variant's density delta is gone
  // with the variant: Map and Combat wear the same Band, so the assertion is
  // equality, not a range.
  if (!near(map.hudTop.height, combat.hudTop.height)) {
    bad.push(`Map and Combat draw different HUDs: Map ${map.hudTop.height.toFixed(2)}px, Combat ${combat.hudTop.height.toFixed(2)}px`);
  }
  for (const [name, left, right] of [
    ['Fullscreen/Music right edge', map.stack.right, combat.stack.right],
    ['Fullscreen/Music size', map.stack.height, combat.stack.height],
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
          const painted=buttons.map((el)=>{const c=getComputedStyle(el),r=box(el);return {...r,border:c.borderTopWidth,background:c.backgroundColor,shadow:c.boxShadow,label:el.getAttribute('aria-label')||''}});
          const probe=document.createElement('div');
          probe.style.cssText='position:absolute;left:-9999px;top:0;padding:0;border:0;width:var(--iconbtn-size);height:var(--iconbtn-size)';
          document.body.appendChild(probe);
          const iconSize=probe.getBoundingClientRect().height;
          probe.remove();
          const cluster=stack.closest('.as-cluster')||stack.parentElement;
          // ONE COORDINATE SPACE (Law 2): every box here is getBoundingClientRect,
          // which is VISUAL px, while a computed gap is LOCAL px — and this app
          // scales itself by a zoom on the body. Convert the gap
          // once, here, or the comparison reads 5.09 against 6 and calls a
          // correct layout wrong (observed at 375x667, zoom 0.848).
          const bodyZoom=parseFloat(getComputedStyle(document.body).zoom)||1;
          const clusterGap=(parseFloat(getComputedStyle(cluster).columnGap)||0)*bodyZoom;
          const actionsRow=box(document.querySelector('.hud-actions'));
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
            viewport:{width:innerWidth,height:innerHeight}, stack:sr, buttons:painted,
            iconSize, clusterGap, actionsRow, horizontal,
            rightGap:innerWidth-sr.right,
            buttonGap:painted.length===2?(horizontal?painted[1].left-painted[0].right:painted[1].top-painted[0].bottom):null,
            quickPanel:box(quickPanel), quickTargets:quickTargets.map(box), header,
            hudTop:box(document.querySelector('.hud-top')), route,
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
