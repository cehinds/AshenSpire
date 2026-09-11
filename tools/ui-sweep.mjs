#!/usr/bin/env node
// tools/ui-sweep.mjs — THE CONTACT SHEET, AND THE FACTS IT WAS TAKEN FOR.
//
// Constantine, 2026-09-11: "clean up the ui and ux experience. not very great
// right now. do a review". The review was thirty photographs — fifteen states
// at a desk width and a phone width — and every finding in it was a thing a
// photograph showed that no instrument had asserted: a merchant with no purse
// on screen, an event choice cut mid-consequence, a phone's End Turn three
// lines tall, a map camera that landed on bare parchment. This tool is that
// sheet turned into a predicate: it photographs the same states at the same
// widths (--out DIR keeps the PNGs) and asserts the facts the fixes stand on,
// so the next sweep starts from a green rather than from scratch.
//
// WHAT IT CHECKS, per shape (1280x800 desk, 390x844 phone; combat also 390x650):
//   R1 EVENT     every choice label wraps — computed white-space is `normal`
//                and no label is wider than its box (the kit's ellipsis rule
//                outranked the wrap fix at (0,4,1) until 2026-09-11).
//   R2 ROOMS     the merchant, the Shrine, the Smith and an event carry the
//                shared run band: a Cinders chip with height, the resource
//                bars, the Armoury and Menu controls (components/runHud.js).
//   R3 COMBAT    on a phone the End Turn control is at least 80 px wide, shows
//                no keycap, and the reserved status tray answers no hit
//                (pointer-events none) — the covered-nameplate finding.
//   R4 MAP       the entrance camera reports `data-framing="fit"` UNDER
//                REDUCED MOTION at both shapes (the transition-duration trick
//                made the first landing read stale geometry).
//   R5 CREATION  stacked (phone), the class list sits above the preview pane;
//                at the desk the selected armour's info button lies inside its
//                card, not over the section header.
//   R6 ARMOURY   on a phone every view tab and the close control share one
//                row.
//   R7 SMITH     `?shot=smith` opens the Shrine with the upgrade modal up.
//
// Usage:
//   node tools/ui-sweep.mjs                      every state, both shapes
//   node tools/ui-sweep.mjs --only event,map     a subset (comma-separated)
//   node tools/ui-sweep.mjs --out docs/sweep     keep the photographs
//   node tools/ui-sweep.mjs --selftest           plant three known-bads
//
// Exit 0 = every fact held; 1 = a finding; 2 = no browser / bad arguments.
//
// BOUNDARY. Headless Chromium, emulated shapes, `?shot=` fixtures with
// reducedMotion on. It asserts geometry and DOM facts, not legibility or
// taste; the review that produced it is docs work, not this file's.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const only = (argOf('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
const outDir = argOf('--out');

if (args.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const plants = [
    {
      name: 'the event wrap rule drops back under the OptionCard ellipsis rule',
      file: 'styles/kit.css',
      find: '.event-door .ev-choices .as-option .on .as-label-text { white-space: normal;',
      replace: '.event-door .as-option .on .as-label-text { white-space: normal;',
      expectRed: /R1 .*event/,
    },
    {
      name: 'reduced motion goes back to a 0.01ms transition on every property',
      file: 'styles/base.css',
      find: '.reduced-motion, .reduced-motion *, .reduced-motion *::before, .reduced-motion *::after {\n  animation-duration: 0.01ms !important;\n  animation-iteration-count: 1 !important;\n  transition: none !important;',
      replace: '.reduced-motion, .reduced-motion *, .reduced-motion *::before, .reduced-motion *::after {\n  animation-duration: 0.01ms !important;\n  animation-iteration-count: 1 !important;\n  transition-duration: 0.01ms !important;',
      expectRed: /R4 .*map/,
    },
    {
      name: 'the reserved status tray answers hits again',
      file: 'styles/combat.css',
      find: 'width:100%; margin:0; pointer-events:none;\n}\n:root .combat[data-layout=\'formation\'] .combatant .statuses > * { pointer-events:auto; }',
      replace: 'width:100%; margin:0; pointer-events:auto;\n}',
      expectRed: /R3 .*combat/,
    },
  ];
  process.exit(await doorSelftest({ tool: 'ui-sweep.mjs', plants, args: ['--only', 'event,map,combat'], timeoutMs: 400000 }));
}

const SHAPES = [
  { w: 1280, h: 800, tag: 'desk', mobile: false },
  { w: 390, h: 844, tag: 'phone', mobile: true },
];
const STATES = [
  { name: 'event', q: 'event', ready: `!!document.querySelector('#choices button')` },
  { name: 'shop', q: 'shop', ready: `!!document.querySelector('#leave-shop')` },
  { name: 'rest', q: 'rest', ready: `!!document.querySelector('#rest-opt')` },
  { name: 'smith', q: 'smith', ready: `!!document.querySelector('.smith-candidate-region')` },
  { name: 'map', q: 'map', ready: `!!document.querySelector('.map-node') && document.querySelector('.map-scroll').dataset.framing` },
  { name: 'combat', q: 'combat', ready: `!!document.querySelector('.combat .hand .card')`, extraShapes: [{ w: 390, h: 650, tag: 'safari', mobile: true }] },
  { name: 'customize', q: 'customize', ready: `!!document.querySelector('.cz-portrait')` },
  { name: 'armoury', q: 'map', ready: `!!document.querySelector('.map-node')`, then: 'armoury' },
];
const wanted = STATES.filter((s) => !only.length || only.includes(s.name));
if (!wanted.length) { console.error(`ui-sweep: --only ${only.join(',')} matches no state. States: ${STATES.map((s) => s.name).join(', ')}`); process.exit(2); }

const served = await serve({ root: ROOT, port: Number(process.env.UI_SWEEP_PORT) || 8531, open: false });
let launched;
try { launched = await launchBrowser({ prefix: 'ui-sweep-', browser: process.env.CHROME, timeoutMs: 20000 }); }
catch (e) { console.error(`ui-sweep: no Chrome/Edge found (${e.message}); set CHROME`); served.close?.(); process.exit(2); }
const socket = new WebSocket(launched.wsUrl);
let id = 0; const pending = new Map();
socket.addEventListener('message', (e) => { const p = JSON.parse(e.data); const w = pending.get(p.id); if (!w) return; pending.delete(p.id); p.error ? w.no(new Error(p.error.message)) : w.ok(p.result); });
const send = (m, params = {}, s) => new Promise((ok, no) => { const i = ++id; pending.set(i, { ok, no }); socket.send(JSON.stringify({ id: i, method: m, params, ...(s ? { sessionId: s } : {}) })); });
await new Promise((r) => socket.addEventListener('open', r));
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr).catch(() => false)) return true; await wait(120); } return false; };
const click = async (sel, i = 0) => { const pt = await ev(`(()=>{const e=document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`); if (!pt) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, sessionId); await wait(400); return true; };
const settings = encodeURIComponent(JSON.stringify({ reducedMotion: true }));

if (outDir) mkdirSync(resolve(ROOT, outDir), { recursive: true });
let findings = 0; let cells = 0;
const check = (ok, label, detail = '') => { cells++; console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) findings++; };

for (const state of wanted) {
  for (const shape of [...SHAPES, ...(state.extraShapes || [])]) {
    await send('Emulation.setDeviceMetricsOverride', { width: shape.w, height: shape.h, deviceScaleFactor: 1, mobile: shape.mobile }, sessionId);
    await send('Page.navigate', { url: `${served.url}?shot=${state.q}&shotSettings=${settings}` }, sessionId);
    const ready = await until(state.ready);
    await wait(700);
    const cell = `${state.name} ${shape.w}x${shape.h}`;
    console.log(`\n  ${cell}`);
    if (!ready) { check(false, `${state.name} rendered`, 'landmark never appeared'); continue; }
    if (state.then === 'armoury') {
      await click('#open-armoury');
      const up = await until(`!!document.querySelector('.armoury .modal-tab')`);
      await wait(500);
      if (!up) { check(false, 'armoury opened from the map band'); continue; }
    }
    if (outDir) {
      const png = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      writeFileSync(resolve(ROOT, outDir, `${shape.tag}-${state.name}.png`), Buffer.from(png.data, 'base64'));
    }

    if (state.name === 'event') {
      const labels = await ev(`[...document.querySelectorAll('#choices .ev-choice .as-label-text')].map(e=>({t:e.textContent.slice(0,40),ws:getComputedStyle(e).whiteSpace,over:e.scrollWidth>e.clientWidth+1}))`);
      check(labels.length >= 2 && labels.every((l) => l.ws === 'normal' && !l.over), `R1 ${cell}: every choice label wraps and none is clipped`, JSON.stringify(labels));
    }
    if (['shop', 'rest', 'smith', 'event'].includes(state.name)) {
      const band = await ev(`(()=>{const hud=document.querySelector('.shared-hud');if(!hud)return null;const c=hud.querySelector('.hud-cinders .cv');const r=c&&c.getBoundingClientRect();return {cinders:c&&c.textContent.trim(),h:r&&Math.round(r.height),bars:hud.querySelectorAll('.resbars-host .as-meter').length,armoury:!!hud.querySelector('#open-armoury'),menu:!!hud.querySelector('#open-menu'),under:(()=>{const s=document.querySelector('.screen.room-screen');const b=hud.querySelector('.hud-bottom');if(!s||!b)return null;const first=[...s.children].find(e=>e.getBoundingClientRect().height>0);return first?Math.round(first.getBoundingClientRect().top-b.getBoundingClientRect().bottom):null})()}})()`);
      check(!!band && band.h > 0 && /\d/.test(band.cinders) && band.bars >= 3 && band.armoury && band.menu,
        `R2 ${cell}: the room carries the run band with a visible purse, bars, Armoury and Menu`, JSON.stringify(band));
      if (band && band.under != null && state.name !== 'smith') check(band.under >= 0, `R2 ${cell}: the room's first content starts under the belt`, `gap ${band.under}px`);
    }
    if (state.name === 'combat' && shape.mobile) {
      const row = await ev(`(()=>{const et=document.querySelector('.combat-action-row .end-turn');const key=et.querySelector('.et-key');const tray=document.querySelector('.combatant .statuses');return {endW:Math.round(et.getBoundingClientRect().width),keyShown:!!key&&getComputedStyle(key).display!=='none',trayPE:tray&&getComputedStyle(tray).pointerEvents,orb:Math.round(document.querySelector('.combat-action-row .energy-orb').getBoundingClientRect().width)}})()`);
      check(row.endW >= 80 && !row.keyShown && row.orb <= 60, `R3 ${cell}: End Turn is at least 80 px wide with no keycap beside 56 px orbs`, JSON.stringify(row));
      check(row.trayPE === 'none', `R3 ${cell}: the reserved status tray answers no hit`, JSON.stringify(row));
    }
    if (state.name === 'map') {
      const d = await ev(`(()=>{const s=document.querySelector('.map-scroll').dataset;return {framing:s.framing,miss:s.framingMiss,restore:s.cameraRestore}})()`);
      check(d.framing === 'fit', `R4 ${cell}: the entrance camera lands on the decision under reduced motion`, JSON.stringify(d));
    }
    if (state.name === 'customize') {
      if (shape.mobile) {
        const order = await ev(`(()=>({classes:Math.round(document.querySelector('#cz-classes').getBoundingClientRect().top),preview:Math.round(document.querySelector('.cc-class-preview-host').getBoundingClientRect().top)}))()`);
        check(order.classes < order.preview, `R5 ${cell}: the class list stands above the preview pane`, JSON.stringify(order));
      } else {
        await click('[data-face="equipment"]'); await click('[data-face="armour"]'); await wait(300);
        const info = await ev(`(()=>{const b=document.querySelector('#cz-armours .equip-chip.on .card-info-button');if(!b)return null;const r=b.getBoundingClientRect();const c=b.parentElement.getBoundingClientRect();return {inside:r.top>=c.top&&r.right<=c.right+1&&r.bottom<=c.bottom,top:Math.round(r.top),cardTop:Math.round(c.top)}})()`);
        check(!!info && info.inside, `R5 ${cell}: the selected armour's info button sits inside its card`, JSON.stringify(info));
      }
    }
    if (state.name === 'armoury' && shape.mobile) {
      const head = await ev(`(()=>{const tabs=[...document.querySelectorAll('.armoury-head .modal-tab')].map(t=>Math.round(t.getBoundingClientRect().top));const close=Math.round(document.querySelector('#armoury-close').getBoundingClientRect().top);return {tabs,close}})()`);
      check(head.tabs.length >= 3 && head.tabs.every((t) => Math.abs(t - head.close) <= 2), `R6 ${cell}: every view tab shares one row with the close control`, JSON.stringify(head));
    }
    if (state.name === 'smith') {
      const smith = await ev(`(()=>({modal:!!document.querySelector('.smith-candidate-region'),shrine:!!document.querySelector('#rest-opt')}))()`);
      check(smith.modal && smith.shrine, `R7 ${cell}: the Shrine stands behind the open Smith`, JSON.stringify(smith));
    }
  }
}

socket.close(); await launched.close(); served.close?.();
console.log(`\nui-sweep: ${findings ? `FAIL — ${findings} finding(s)` : 'PASS'} across ${cells} checks${outDir ? ` · photographs in ${outDir}` : ''}`);
process.exit(findings ? 1 : 0);
