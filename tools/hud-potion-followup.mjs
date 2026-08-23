#!/usr/bin/env node
// tools/hud-potion-followup.mjs — the exact approved shared-HUD follow-up.
//
// Source checks hold the authored seams. The browser door reads the resulting
// geometry and key labels at 1200x730. `--source-selftest` and
// `--receipt-selftest` are browser-free discriminators. The preserved default
// source gate stays browser-free; `--browser` is the explicit rendered door.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const sourceReceipt = () => ({
  balance: read('src/content/balance.js'),
  main: read('src/main.js'),
  input: read('src/ui/input.js'),
  combat: read('src/ui/screens/combat.js'),
  css: read('styles/combat.css'),
});

export function sourceFindings(s) {
  const bad = [];
  if (!/main:\s*\{\s*scaleByMax:\s*true,\s*maxViewportPct:\s*40,\s*availableWidthPct:\s*82\s*\}/.test(s.balance)
      || !s.main.includes("setProperty('--hud-resource-available-pct', `${hudAvailableWidthPct}%`)")
      || !s.main.includes("setProperty('--hud-resource-available-vw', `${hudAvailableWidthPct}vw`)")) {
    bad.push('S1 available-width authority is not authored at 82 and projected to the CSS variable');
  }
  if (!/\.hud-vitals-panel\s*\{[^}]*width:\s*min\(100%, var\(--hud-resource-available-vw\)\);/.test(s.css)) {
    bad.push('S2 the Vitals panel no longer consumes the configurable viewport-width cap');
  }
  if (!/id:\s*'flask1'[\s\S]*?defKey:\s*'f'/.test(s.input)
      || !/id:\s*'flask2'[\s\S]*?defKey:\s*'g'/.test(s.input)
      || !s.combat.includes('appendFlaskHotkey(el, hotkeySlot);')) {
    bad.push('S3 Health and Mana no longer own the F/G hotkey slots');
  }
  if (!/id:\s*'flask3'[\s\S]*?defKey:\s*'h'/.test(s.input)
      || !s.combat.includes('appendFlaskHotkey(el, CHARGE_FLASK_KINDS.length + slot);')) {
    bad.push('S4 the first utility potion no longer follows Health/Mana into the H slot');
  }
  if (!/\.topbar\.combat-hud\.shared-hud \.hud-potions\s*\{[^}]*justify-content:\s*flex-start;[^}]*flex-direction:\s*row;[^}]*direction:\s*rtl;/.test(s.css)
      || !/\.topbar\.combat-hud\.shared-hud \.hud-potions\s*\{\s*grid-column:\s*2;\s*\}/.test(s.css)) {
    bad.push('S5 utility potions no longer pack from the Quick Access right edge');
  }
  if (!/\.hud-potions,\s*\n\.topbar\.combat-hud\.shared-hud \.hud-relics\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;/.test(s.css)
      || !/\.hud-potions\s*>\s*\*\s*\{[^}]*flex:\s*0 0 auto;/.test(s.css)) {
    bad.push('S6 utility growth no longer uses one non-wrapping horizontal tray');
  }
  if (!/\.hud-control-grid :is\(\.topbar-btn, \.flask-slot\)\s*\{[^}]*width:\s*var\(--tap-floor\);\s*height:\s*var\(--tap-floor\);/.test(s.css)) {
    bad.push('S7 the wide primary grid no longer gives all four cards one tap-floor size');
  }
  if (!/:root:not\(\[data-layout='narrow'\]\) \.topbar\.combat-hud\.shared-hud \.flask-charge-count\s*\{\s*font-size:\s*calc\(14px \/ var\(--ui-zoom, 1\)\);\s*\}/.test(s.css)) {
    bad.push('S8 the wide HUD charge count no longer scales to 14 screen pixels');
  }
  if (!/\.topbar\.combat-hud\.shared-hud \.hud-vitals-panel\s*\{[^}]*border:\s*0;[^}]*padding:\s*0;/.test(s.css)
      || !/\.topbar\.combat-hud\.shared-hud \.hud-vitals-panel \.rescard-frame\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;/.test(s.css)) {
    bad.push('S9 Vitals still paints a bordered/scaled container around the resource stack');
  }
  return bad;
}

// Compatibility door for the existing focused gate and any importer that
// still supplies its original four-file receipt. The input table is added at
// the reader, not made a new caller obligation.
export function hudPotionFindings({ balance, main, css, combat, input = read('src/ui/input.js') }) {
  return sourceFindings({ balance, main, css, combat, input });
}

const near = (a, b, tolerance = 0.75) => Number.isFinite(a) && Math.abs(a - b) <= tolerance;

export function receiptFindings(r) {
  const bad = [];
  if (r.configuredAvailablePct !== '82%') bad.push(`B1 configured available width is ${JSON.stringify(r.configuredAvailablePct)}, expected 82%`);
  if (!near(r.appliedAvailablePct, 82, 0.35)) bad.push(`B2 applied available width is ${r.appliedAvailablePct}, expected 82%`);
  if (JSON.stringify(r.chargeKeys) !== JSON.stringify(['F', 'G'])) bad.push(`B3 Health/Mana keys are ${JSON.stringify(r.chargeKeys)}, expected ["F","G"]`);
  if (JSON.stringify(r.utilityKeys) !== JSON.stringify(['H'])) bad.push(`B4 first utility key is ${JSON.stringify(r.utilityKeys)}, expected ["H"]`);
  if (!near(r.utilityGrowth.before.right, r.utilityGrowth.after.right)
      || r.utilityGrowth.before.count < 1
      || r.utilityGrowth.after.count !== r.utilityGrowth.before.count + 2) {
    bad.push(`B5 utility right edge/count moved ${JSON.stringify(r.utilityGrowth)}`);
  }
  if (!(r.utilityGrowth.after.scrollWidth > r.utilityGrowth.before.scrollWidth + 1)) {
    bad.push(`B6 utility growth did not extend the right-anchored tray leftward ${JSON.stringify(r.utilityGrowth)}`);
  }
  const cardShape = r.primaryCards[0];
  if (r.viewportWidth < 1000 || r.primaryCards.length !== 4 || !cardShape
      || r.primaryCards.some((box) => !near(box.width, cardShape.width) || !near(box.height, cardShape.height))) {
    bad.push(`B7 wide primary grid is not four equal cards ${JSON.stringify(r.primaryCards)}`);
  }
  if (!near(r.chargeCountScreenPx, 14, 0.35)) bad.push(`B8 wide charge count is ${r.chargeCountScreenPx}px, expected 14px`);
  if (!r.vitalsShell || r.vitalsShell.border !== '0px none' || r.vitalsShell.background !== 'transparent'
      || !Array.isArray(r.resourceFrames) || r.resourceFrames.some((frame) => frame.border !== '0px none' || frame.background !== 'transparent')) {
    bad.push(`B9 Vitals still paints a shell/resource frame ${JSON.stringify({ vitalsShell: r.vitalsShell, resourceFrames: r.resourceFrames })}`);
  }
  if (!near(r.utilityRightEdge, r.quickRightEdge)) {
    bad.push(`B10 potion right edge ${r.utilityRightEdge}px is not flush with Quick Access ${r.quickRightEdge}px`);
  }
  return bad;
}

function runSourceSelftest() {
  const clean = sourceReceipt();
  const plants = [
    ['82 percent changes to 81', 'S1 ', (s) => ({ ...s, balance: s.balance.replace('availableWidthPct: 82', 'availableWidthPct: 81') })],
    ['Vitals stops consuming the viewport cap', 'S2 ', (s) => ({ ...s, css: s.css.replace(
      /(\.topbar\.combat-hud\.shared-hud \.hud-vitals-panel \{[\s\S]*?)width: min\(100%, var\(--hud-resource-available-vw\)\);/,
      '$1width: 100%;',
    ) })],
    ['Health moves off F', 'S3 ', (s) => ({ ...s, input: s.input.replace("defKey: 'f'", "defKey: 'x'") })],
    ['first utility moves off H', 'S4 ', (s) => ({ ...s, input: s.input.replace("defKey: 'h'", "defKey: 'x'") })],
    ['utility row anchors left', 'S5 ', (s) => ({ ...s, css: s.css.replace('justify-content: flex-start;\n  flex-direction: row;', 'justify-content: flex-end;\n  flex-direction: row;') })],
    ['utility row stops flex growth', 'S6 ', (s) => ({ ...s, css: s.css.replace(
      /(\.topbar\.combat-hud\.shared-hud \.hud-potions,\r?\n\.topbar\.combat-hud\.shared-hud \.hud-relics \{\r?\n  )display: flex;/,
      '$1display: grid;',
    ) })],
    ['one primary card gets a fixed width', 'S7 ', (s) => ({ ...s, css: s.css.replace(
      /(\.topbar\.combat-hud\.shared-hud \.hud-control-grid :is\(\.topbar-btn, \.flask-slot\) \{\r?\n  box-sizing: border-box;\r?\n  )width: var\(--tap-floor\); height: var\(--tap-floor\);/,
      '$1width: 40px; height: var(--tap-floor);',
    ) })],
    ['wide charge count stays at narrow size', 'S8 ', (s) => ({ ...s, css: s.css.replace('font-size: calc(14px / var(--ui-zoom, 1));', 'font-size: calc(10px / var(--ui-zoom, 1));') })],
    ['Vitals restores its visible container', 'S9 ', (s) => ({ ...s, css: s.css.replace('border: 0;\n  padding: 0;', 'border: 1px solid var(--line-soft);\n  padding: var(--hud-panel-pad);') })],
  ];
  let failed = 0;
  const cleanBad = sourceFindings(clean);
  if (cleanBad.length) { failed++; console.error(`FAIL clean source — ${cleanBad.join('; ')}`); }
  else console.log('PASS clean source — nine approved seams present');
  for (const [name, own, mutate] of plants) {
    const got = sourceFindings(mutate(clean));
    if (got.some((line) => line.startsWith(own))) console.log(`RED  ${name} — ${got.find((line) => line.startsWith(own))}`);
    else { failed++; console.error(`MISS ${name} — ${got.join('; ') || 'no finding'}`); }
  }
  if (failed) process.exitCode = 1;
  else console.log(`hud-potion-followup --source-selftest: OK — ${plants.length}/${plants.length} plants observed red`);
}

function cleanBrowserReceipt() {
  return {
    viewportWidth: 1200,
    configuredAvailablePct: '82%',
    appliedAvailablePct: 82,
    chargeKeys: ['F', 'G'],
    utilityKeys: ['H'],
    utilityGrowth: {
      before: { left: 1050, right: 1140, count: 1, scrollWidth: 44 },
      after: { left: 1008, right: 1140, count: 3, scrollWidth: 132 },
    },
    primaryCards: Array.from({ length: 4 }, () => ({ width: 44, height: 44 })),
    chargeCountScreenPx: 14,
    vitalsShell: { border: '0px none', background: 'transparent' },
    resourceFrames: [
      { border: '0px none', background: 'transparent' },
      { border: '0px none', background: 'transparent' },
      { border: '0px none', background: 'transparent' },
    ],
    utilityRightEdge: 1140,
    quickRightEdge: 1140,
  };
}

function runReceiptSelftest() {
  const clean = cleanBrowserReceipt();
  const plants = [
    ['configured percentage moves', 'B1 ', (r) => ({ ...r, configuredAvailablePct: '81%' })],
    ['applied percentage ignores config', 'B2 ', (r) => ({ ...r, appliedAvailablePct: 100 })],
    ['Health and Mana swap keys', 'B3 ', (r) => ({ ...r, chargeKeys: ['G', 'F'] })],
    ['first utility loses H', 'B4 ', (r) => ({ ...r, utilityKeys: [] })],
    ['utility right edge moves', 'B5 ', (r) => ({ ...r, utilityGrowth: { ...r.utilityGrowth, after: { ...r.utilityGrowth.after, right: 1100 } } })],
    ['utility tray stops extending', 'B6 ', (r) => ({ ...r, utilityGrowth: { ...r.utilityGrowth, after: { ...r.utilityGrowth.after, scrollWidth: r.utilityGrowth.before.scrollWidth } } })],
    ['one of four primary cards shrinks', 'B7 ', (r) => ({ ...r, primaryCards: r.primaryCards.map((box, i) => i === 3 ? { width: 40, height: 44 } : box) })],
    ['wide charge count stays small', 'B8 ', (r) => ({ ...r, chargeCountScreenPx: 10 })],
    ['Vitals shell becomes visible', 'B9 ', (r) => ({ ...r, vitalsShell: { border: '1px solid', background: 'rgb(18, 15, 12)' } })],
    ['potion right edge drifts', 'B10 ', (r) => ({ ...r, utilityRightEdge: 1120 })],
  ];
  let failed = 0;
  const cleanBad = receiptFindings(clean);
  if (cleanBad.length) { failed++; console.error(`FAIL clean receipt — ${cleanBad.join('; ')}`); }
  else console.log('PASS clean receipt — ten browser contracts hold');
  for (const [name, own, mutate] of plants) {
    const got = receiptFindings(mutate(structuredClone(clean)));
    if (got.some((line) => line.startsWith(own))) console.log(`RED  ${name} — ${got.find((line) => line.startsWith(own))}`);
    else { failed++; console.error(`MISS ${name} — ${got.join('; ') || 'no finding'}`); }
  }
  if (failed) process.exitCode = 1;
  else console.log(`hud-potion-followup --receipt-selftest: OK — ${plants.length}/${plants.length} plants observed red`);
}

function connectCdp(wsUrl, timeoutMs = 15000) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  let closed = null;
  const rejectAll = (error) => {
    closed = closed || error;
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(closed); }
    pending.clear();
  };
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const row = pending.get(message.id);
    if (!row) return;
    pending.delete(message.id); clearTimeout(row.timer);
    if (message.error) row.reject(new Error(message.error.message)); else row.resolve(message.result);
  });
  ws.addEventListener('close', () => rejectAll(new Error('CDP WebSocket closed')));
  ws.addEventListener('error', () => rejectAll(new Error('CDP WebSocket error')));
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady, { once: true });
      ws.addEventListener('error', rejectReady, { once: true });
    }),
    send(method, params = {}, sessionId) {
      if (closed) return Promise.reject(closed);
      const id = nextId++;
      return new Promise((resolveSend, rejectSend) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectSend(new Error(`CDP timeout ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve: resolveSend, reject: rejectSend, timer });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { rejectAll(new Error('CDP WebSocket closed by tool')); ws.close(); },
  };
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const BROWSER_READ = `(() => {
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const box = (el) => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
  const row = document.querySelector('.topbar.shared-hud .hud-resource-row');
  const left = document.querySelector('.topbar.shared-hud .hud-vitals-panel');
  const controls = document.querySelector('.topbar.shared-hud .hud-control-grid');
  const gap = parseFloat(getComputedStyle(row).columnGap) * zoom;
  const rowBox = box(row), leftBox = box(left), controlBox = box(controls);
  const host = document.querySelector('.topbar.shared-hud .hud-potions');
  const utility = [...host.querySelectorAll(':scope > .flask-slot')];
  const beforeBox = { ...box(host), scrollWidth: host.scrollWidth };
  const clones = [];
  for (let i = 0; i < 2; i++) { const clone = utility[0].cloneNode(true); clone.removeAttribute('data-flask-hotkey-slot'); host.appendChild(clone); clones.push(clone); }
  const afterBox = { ...box(host), scrollWidth: host.scrollWidth };
  const afterCount = host.querySelectorAll(':scope > .flask-slot').length;
  clones.forEach((clone) => clone.remove());
  const primary = [...document.querySelectorAll('.topbar.shared-hud .hud-control-grid .topbar-btn, .topbar.shared-hud .hud-control-grid .hud-charge-flasks > .flask-slot')].map(box);
  const chargeCount = document.querySelector('.topbar.shared-hud .flask-charge-count');
  return {
    viewportWidth: window.innerWidth,
    configuredAvailablePct: getComputedStyle(document.documentElement).getPropertyValue('--hud-resource-available-pct').trim(),
    appliedAvailablePct: leftBox.width / window.innerWidth * 100,
    chargeKeys: [...document.querySelectorAll('.topbar.shared-hud .hud-charge-flasks > .flask-slot .flask-key')].map((el) => el.textContent.trim().toUpperCase()),
    utilityKeys: utility.slice(0, 1).map((el) => (el.querySelector('.flask-key') || {}).textContent || '').map((v) => v.trim().toUpperCase()).filter(Boolean),
    utilityGrowth: { before: { ...beforeBox, count: utility.length }, after: { ...afterBox, count: afterCount } },
    primaryCards: primary,
    chargeCountScreenPx: chargeCount ? parseFloat(getComputedStyle(chargeCount).fontSize) * zoom : null,
    vitalsShell: (() => {
      const style = getComputedStyle(left);
      return {
        border: style.borderTopWidth + ' ' + style.borderTopStyle,
        background: /transparent|\/\s*0\)?$/.test(style.backgroundColor) ? 'transparent' : style.backgroundColor,
      };
    })(),
    resourceFrames: [...left.querySelectorAll('.rescard-frame')].map((frame) => {
      const style = getComputedStyle(frame);
      return {
        border: style.borderTopWidth + ' ' + style.borderTopStyle,
        background: /transparent|\/\s*0\)?$/.test(style.backgroundColor) ? 'transparent' : style.backgroundColor,
      };
    }),
    utilityRightEdge: utility.length ? Math.max(...utility.map((el) => box(el).right)) : box(host).right,
    quickRightEdge: controlBox.right,
  };
})()`;

async function runBrowserDoor() {
  const sourceBad = sourceFindings(sourceReceipt());
  if (sourceBad.length) {
    sourceBad.forEach((line) => console.error(`FINDING ${line}`));
    process.exitCode = 1;
    return;
  }
  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('hud-potion-followup: UNKNOWN — no Chrome/Chromium found');
    process.exitCode = 2;
    return;
  }
  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);
  const served = await serve({ root: ROOT, port: 8481, open: false });
  let launched = null;
  let cdp = null;
  try {
    launched = await launchBrowser({ prefix: 'hud-potion-followup-', browser: browserPath, timeoutMs: 15000 });
    cdp = connectCdp(launched.wsUrl);
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${served.port}/?shot=combat` }, sessionId);
    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser receipt threw');
      return result.result.value;
    };
    const started = Date.now();
    let reached = false;
    while (Date.now() - started < 20000) {
      if (await evaluate("document.querySelectorAll('.topbar.shared-hud .hud-charge-flasks .flask-slot').length === 2 && document.querySelectorAll('.topbar.shared-hud .hud-potions .flask-slot').length >= 1").catch(() => false)) { reached = true; break; }
      await wait(150);
    }
    if (!reached) throw new Error('timeout waiting for two charge flasks and at least one utility potion');
    const receipt = await evaluate(BROWSER_READ);
    const bad = receiptFindings(receipt);
    if (bad.length) {
      bad.forEach((line) => console.error(`FINDING ${line}`));
      process.exitCode = 1;
    } else {
      console.log('hud-potion-followup: OK — 10/10 checks passed.');
    }
  } catch (error) {
    console.error(`hud-potion-followup: HARNESS — ${error.stack || error}`);
    process.exitCode = 2;
  } finally {
    if (cdp) cdp.close();
    if (launched) await launched.close();
    await new Promise((resolveClose) => served.server.close(resolveClose));
  }
}

if (process.argv.includes('--selftest') || process.argv.includes('--source-selftest')) runSourceSelftest();
else if (process.argv.includes('--receipt-selftest')) runReceiptSelftest();
else if (process.argv.includes('--browser')) await runBrowserDoor();
else {
  const findings = sourceFindings(sourceReceipt());
  findings.forEach((finding) => console.error(`FAIL ${finding}`));
  if (findings.length) {
    console.log(`hud-potion-followup: ${findings.length} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('hud-potion-followup: OK — 10 checks passed');
  }
}
