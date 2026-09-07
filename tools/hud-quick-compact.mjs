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
// `pair` SAYS WHICH SURFACES CARRY FULLSCREEN AND MUSIC, and since 2026-09-05
// that is the title screen alone (owner: "the full screen and music buttons
// don't need to be there since we have it in the quick and main menu
// settings"). The run HUD's surfaces stay in this list rather than being
// dropped with the pair, and that is the point: they now assert the pair is
// ABSENT, and they still carry the HUD geometry and the map/combat parity
// check, which is coverage that has nothing to do with the pair and has caught
// three regressions of its own.
//
// `music-off` MOVED SCREENS. Its job is the music button drawn in its off
// state, so it followed the button to the title rather than staying on a map
// that no longer has one — a surface aimed at an element that left is a
// vacuous green (#12).
const SURFACES = [
  { name: 'title', query: '', pair: true },
  { name: 'music-off', query: '?shotSettings=%7B%22musicEnabled%22%3Afalse%7D', pair: true },
  { name: 'map', query: '?shot=map' },
  { name: 'combat', query: '?shot=combat' },
  { name: 'map-compact', query: '?shot=map&shotSettings=%7B%22runHudMode%22%3A%22compact%22%7D', compact: true },
  { name: 'combat-compact', query: '?shot=combat&shotSettings=%7B%22runHudMode%22%3A%22compact%22%7D', compact: true },
];

const intersection = (a, b) => !a || !b ? 0
  : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

function findings(r) {
  const bad = [];
  // THE RUN HUD MUST NOT CARRY THE PAIR. A positive assertion, not an absence
  // of checks: this is what fires if fullscreen and music are mounted back into
  // the band. Everything below it is about a pair that should be there, so a
  // surface without one returns here.
  if (!r.expectPair) {
    if (r.stack) bad.push('the run HUD mounts the fullscreen/music pair again — it belongs to the title screen and Settings');
    if (r.buttons.length) bad.push(`${r.buttons.length} quick control(s) drawn in the run HUD`);
    if (r.vitalGaps.length !== 2) {
      bad.push(`Vitals exposes ${r.vitalGaps.length} measurable row gap(s), expected HP→MP and MP→SP`);
    } else if (r.vitalGaps.some((gap) => Math.abs(gap - r.vitalGapExpected) > 0.5)) {
      bad.push(`Vitals row gaps are ${r.vitalGaps.map((gap) => gap.toFixed(2)).join('/')}px, expected the authored ${r.vitalGapExpected.toFixed(2)}px`);
    }
    if (r.quickPanel && r.vitalBottom != null && Math.abs(r.quickPanel.bottom - r.vitalBottom) > 0.75) {
      bad.push(`Quick Access ends at ${r.quickPanel.bottom.toFixed(2)}px, SP ends at ${r.vitalBottom.toFixed(2)}px`);
    }
    if (r.playerFacing && r.playerFacing !== 'none' && r.playerFacing !== 'matrix(1, 0, 0, 1, 0, 0)') {
      bad.push(`the painted player character is mirrored away from the battlefield (${r.playerFacing})`);
    }
    return bad;
  }
  if (!r.stack) {
    bad.push('the surface draws no fullscreen/music pair at all');
    return bad;
  }
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
  // ONE COLUMN, THE CLUSTER'S OWN GAP. The gap is read off the cluster the two
  // share with Armoury and Menu, so a change to the kit's cluster moves both.
  if (r.horizontal) {
    bad.push('the two quick controls are one row, expected a column — the rail is vertical');
  }
  if (r.buttonGap != null && Math.abs(r.buttonGap - r.clusterGap) > 0.5) {
    bad.push(`control gap is ${r.buttonGap.toFixed(2)}px, expected the cluster's own ${r.clusterGap.toFixed(2)}px`);
  }
  if (Math.abs(r.stack.width - icon) > 0.5) {
    bad.push(`the rail is ${r.stack.width.toFixed(2)}px wide, expected one icon box ${icon.toFixed(2)}`);
  }
  // THE UTILITY RAIL, UNDER THE BAND ON THE RIGHT. This contract has been all
  // three placements now, so the history is the point: the pair sat in
  // `.hud-actions` in the HUD's flow; then, for a day, at the viewport's
  // top-right corner (Constantine, 2026-09-04: "move full screen and music …
  // to anchored to top right corner and not block any text"); and now on the
  // rail it had in 0.4.0.1454, after the same owner sent a screenshot of that
  // build (2026-09-05: "I miss the old Hudson and music and full screen
  // placement"). The corner sat INSIDE the band, so "not block any text" cost
  // every surface a horizontal slice of its own top row — 243 of 434 CSS px on
  // the map at 360x800, for a pair 106px wide.
  // Under the band it blocks no text by CONSTRUCTION rather than by reservation,
  // which is what the first assertion below says: the rail's top is at or past
  // the band's bottom. That is strictly stronger than the overlap checks it
  // replaces, because it holds whatever the band's own rows are doing.
  // ONE COORDINATE SPACE, AGAIN (Law 2, as the collector above says). Every box
  // here is getBoundingClientRect — VISUAL px. The authored gap is divided by
  // the zoom in CSS precisely so that it lands as itself ON GLASS, so the value
  // to compare a visual box against is the RAW authored number, not the local
  // one. `edgeGapPx` is the local form and is kept for reporting; comparing a
  // visual box to it was off by a factor of the zoom and survived only on the
  // 1.5px slack, which is the kind of pass that stops being one later.
  const edge = r.edgeGapRawPx == null ? 4 : r.edgeGapRawPx;
  const slack = 1.5;
  if (r.header) {
    // The band's own bottom rule sits between its padding box and its border
    // box, so it is subtracted rather than absorbed into the slack.
    const bandFoot = r.header.bottom - (r.headerBorderBottom || 0);
    if (r.stack.top < bandFoot - slack) {
      bad.push(`the rail starts ${(bandFoot - r.stack.top).toFixed(2)}px INSIDE the band — it hangs below it`);
    } else if (Math.abs(r.stack.top - (bandFoot + edge)) > slack) {
      bad.push(`the rail sits ${(r.stack.top - bandFoot).toFixed(2)}px under the band, expected the authored edge gap ${edge.toFixed(2)}`);
    }
  } else if (Math.abs(r.stack.top - edge) > slack) {
    // A surface with no band of its own (the title screen) keeps the rail at
    // its own top edge, which is where it sat before the band existed.
    bad.push(`the quick controls sit ${r.stack.top.toFixed(2)}px from the top, expected the authored edge gap ${edge.toFixed(2)}`);
  }
  if (Math.abs((r.viewport.width - r.stack.right) - edge) > slack) {
    bad.push(`the quick controls sit ${(r.viewport.width - r.stack.right).toFixed(2)}px from the right, expected the authored edge gap ${edge.toFixed(2)}`);
  }
  if (r.position !== 'absolute') {
    bad.push(`the quick controls are ${r.position}, expected absolute — the rail hangs off the band it follows`);
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
  // THE PAIR IS ON NEITHER SCREEN NOW, so the two rows that compared its right
  // edge and its size across them are gone rather than guarded — comparing two
  // absences is a check that cannot fail. What replaces them is the assertion
  // that it is absent from BOTH, which is the property this pair of surfaces
  // can still speak to and the one that regresses if the band re-mounts it on
  // one screen only.
  if (map.stack || combat.stack) {
    bad.push(`the fullscreen/music pair is back in the run HUD: Map ${map.stack ? 'has one' : 'clear'}, Combat ${combat.stack ? 'has one' : 'clear'}`);
  }
  if (!map.route || map.route.height < 0.5) bad.push('Map route strip is not visibly rendered');
  else if (Math.abs(map.route.width - (map.viewport.width * 0.8)) > 1.5) {
    bad.push(`Map route strip is ${map.route.width.toFixed(2)}px, expected about 80vw`);
  }
  if (combat.route && (combat.route.width > 0.5 || combat.route.height > 0.5)) bad.push('Combat still renders the Map-only route strip');
  // The pair used to be flush with Quick Access because it lived in that panel,
  // then rode the page's corner, then the band's own utility rail. It is off
  // these two screens entirely as of 2026-09-05, so what these surfaces carry
  // is the HUD parity above — one composition on both screens — and the route
  // strip's own geometry, neither of which was ever about the pair.
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
      // A run HUD surface has no pair to wait for since 2026-09-05, so its band
      // is what says the screen is up. Waiting on the pair alone timed out.
      await waitFor(client.send.bind(client), sessionId, "!!document.querySelector('[data-hud-quick-settings],.startup-gate,.shared-hud')");
      const startup = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(()=>{const el=document.querySelector('.startup-gate');if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
      }, sessionId);
      if (startup.result.value) {
        const point = startup.result.value;
        await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
        await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
      }
      // The second wait, after the startup gate is clicked through: the pair on
      // a surface that has one, the band on a surface that does not.
      await waitFor(client.send.bind(client), sessionId, surface.pair
        ? "!!document.querySelector('[data-hud-quick-settings]')"
        : "!!document.querySelector('.shared-hud')");
      await new Promise((done) => setTimeout(done, 250));
      const evaluated = await client.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(()=>{
          const box=(el)=>el?(()=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}})():null;
          const stack=document.querySelector('[data-hud-quick-settings]');
          const buttons=stack?[...stack.querySelectorAll('.hud-quick-setting')]:[];
          const painted=buttons.map((el)=>{const c=getComputedStyle(el),r=box(el);return {...r,border:c.borderTopWidth,background:c.backgroundColor,shadow:c.boxShadow,label:el.getAttribute('aria-label')||''}});
          const probe=document.createElement('div');
          probe.style.cssText='position:absolute;left:-9999px;top:0;padding:0;border:0;width:var(--iconbtn-size);height:var(--iconbtn-size)';
          document.body.appendChild(probe);
          const iconSize=probe.getBoundingClientRect().height;
          probe.remove();
          const cluster=stack?(stack.closest('.as-cluster')||stack.parentElement):document.body;
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
          const vitalRows=[...document.querySelectorAll('.resbars[data-surface="main"] > .resline')].map(box);
          const combatantInk=[...document.querySelectorAll('.combatant .intent, .combatant .sprite, .combatant .nm, .combatant .meters, .combatant .statuses')];
          const playerFacing=document.querySelector('.combatant.player .class-sprite > .facing');
          const sr=box(stack);
          const header=box(document.querySelector('.shared-hud'));
          const route=box(document.querySelector('.act-route-strip'));
          const horizontal=stack?getComputedStyle(stack).flexDirection==='row':false;
          return {
            viewport:{width:innerWidth,height:innerHeight}, stack:sr, buttons:painted,
            position: stack ? getComputedStyle(stack).position : '',
            edgeGapPx: (() => { const raw = getComputedStyle(document.documentElement).getPropertyValue('--hud-quick-edge-gap').trim(); const n = Number.parseFloat(raw); const zoom = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1; return Number.isFinite(n) ? n / zoom : null; })(),
            edgeGapRawPx: (() => { const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-quick-edge-gap').trim()); return Number.isFinite(n) ? n : null; })(),
            iconSize, clusterGap, actionsRow, horizontal,
            rightGap:sr?innerWidth-sr.right:0,
            buttonGap:painted.length===2?(horizontal?painted[1].left-painted[0].right:painted[1].top-painted[0].bottom):null,
            quickPanel:box(quickPanel), quickTargets:quickTargets.map(box), header,
            vitalGaps:vitalRows.slice(1).map((row,index)=>row.top-vitalRows[index].bottom),
            vitalBottom:vitalRows.length?vitalRows[vitalRows.length-1].bottom:null,
            vitalGapExpected:Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-resource-row-gap-px')),
            // The rail hangs off the band's PADDING box (top: 100%), while
            // header.bottom is its BORDER box — the band draws a 1px bottom
            // rule. Visual px, like every box above, so the two subtract.
            headerBorderBottom:(()=>{const h=document.querySelector('.shared-hud');return h?(parseFloat(getComputedStyle(h).borderBottomWidth)||0)*bodyZoom:0})(),
            hudTop:box(document.querySelector('.hud-top')), route,
            orientationOverlap:(${intersection.toString()})(sr,box(orientation)),
            infoOverlap:(${intersection.toString()})(sr,box(info)),
            combatantOverlap:Math.max(0,...combatantInk.map((el)=>(${intersection.toString()})(sr,box(el)))),
            playerFacing:playerFacing?getComputedStyle(playerFacing).transform:null,
            phone:${shape.mobile}, compact:${!!surface.compact}, expectPair:${!!surface.pair}
          };
        })()`,
      }, sessionId);
      // A page-side throw used to surface as `Cannot read properties of
      // undefined` inside findings(), three frames from the cause. Say what
      // actually happened instead.
      if (evaluated.exceptionDetails || !evaluated.result.value) {
        console.error(`hud-quick-compact: the page-side read threw on ${surface.name}-${shape.name}`);
        console.error(JSON.stringify(evaluated.exceptionDetails || evaluated.result, null, 1).slice(0, 900));
        process.exit(2);
      }
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
