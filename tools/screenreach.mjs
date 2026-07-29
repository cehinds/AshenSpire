// tools/screenreach.mjs — is every control on every screen reachable by a
// finger, at the shapes we claim to support?
//
// WHY THIS EXISTS, and it is not a hypothetical. tools/mobilefit.mjs measures
// the combat board in detail and says nothing about the rest of the game. The
// portrait work (EldenSpire#23) changes --ui-zoom for EVERY screen — from 0.62
// to ~0.90 on a phone, which is less local space, not more — while only combat
// gets a narrow layout. Combat came out at 45/45 and I would have shipped it,
// and this sweep found three controls that were reachable on dev at 390x844
// and were NOT on my branch:
//
//   COVERED  ⚒ (#combat-armoury)  <- div.pile.draw   my repositioned piles
//   COVERED  a map node           <- button.zbtn     the map's floating zoom stack (x2)
//
// Fixing a lockout in the fight and putting a different one in the top bar is
// not a fix. Both are fixed; this is the check that has to stay.
//
// WHAT IT DOES. Boots each ?shot= state at each shape, collects everything a
// player can press, and hit-tests the centre of each with elementFromPoint.
//
// THE ONE DISTINCTION THAT MAKES THE NUMBER MEAN ANYTHING — and the first two
// versions of this file got it wrong in opposite directions. A control that
// fails the hit-test is either:
//   - SCROLLED OUT: its centre is outside its scroll ancestor's visible box.
//     The player reaches it by scrolling. Not a defect. The act map is a
//     pannable canvas with 60+ nodes and most of them are off-screen at any
//     moment; counting those called the map 23-unreachable and the desktop
//     4-unreachable, all of it noise.
//   - COVERED: its centre IS inside the scrollport and something else answers
//     the hit-test. That is EldenSpire#21's mechanism, wherever it appears.
// Only COVERED is counted. Getting this wrong in the loud direction buries the
// real finding in false positives; getting it wrong in the quiet direction
// reports zero forever.
//
// Usage
//   node tools/screenreach.mjs                    source tree via tools/serve.mjs
//   node tools/screenreach.mjs --dist             dist/AshenSpire.html over file://
//   node tools/screenreach.mjs --only 390x844
//   CHROME=/path/to/chrome node tools/screenreach.mjs
//
// Exit codes
//   0  no control is covered at any shape
//   1  a covered control  (the known-bad: this branch before the two fixes)
//   2  usage / no browser / a screen that would not mount — never a pass
//
// BOUNDARY, printed again at the end: Linux headless Chromium only, and CDP
// emulation is not a phone. It reaches only the screens that have a ?shot=
// state — title, map, combat, boss, death. CUSTOMIZE, SHOP, REST, REWARDS and
// the overlays have no ?shot= and are NOT covered by this or anything else,
// which matters because #23's own bleed evidence came from customize. It
// hit-tests reachability at rest; it does not press anything, does not judge
// legibility, and cannot see a control that only appears mid-interaction.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// Every screen that can be reached without playing the game. `boss` holds a
// splash deliberately covering the board, so its controls ARE covered by
// design and it is listed with `overlay: true` rather than left out — a screen
// missing from a sweep is invisible, and a screen present with a reason is not.
const SCREENS = [
  { name: 'title', q: '', ready: `!!document.querySelector('#app button')` },
  { name: 'map', q: '?shot=map', ready: `!!document.querySelector('.map-node')` },
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.combat .hand .card')` },
  { name: 'death', q: '?shot=death', ready: `!!document.querySelector('#app button')` },
  { name: 'boss', q: '?shot=boss', ready: `!!document.querySelector('.boss-intro')`, overlay: 'the boss splash covers the board on purpose and is dismissed on a timer' },
];

const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  const app = document.getElementById('app');
  const de = document.documentElement;
  const z = parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1;
  // Everything a player can press. .map-node is an SVG <g>, so className is an
  // SVGAnimatedString and must never be string-formatted blindly.
  const sel = 'button,[role=button],.pile,.map-node,.card,.choice,.opt,.zbtn,.topbar-btn';
  const name = (e) => {
    if (!e) return 'null';
    const t = (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 22);
    const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/)[0] : '';
    return (t || '') + (c ? ' .' + c : ' ' + e.tagName);
  };
  const scrollport = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)) return p;
    }
    return null;
  };
  const covered = [], scrolledOut = [];
  const all = [...app.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden';
  });
  for (const c of all) {
    const r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    if (hit && (hit === c || c.contains(hit))) continue;
    // Inside its own scrollport, or scrolled past the edge of it?
    const sp = scrollport(c);
    const box = sp ? sp.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const outside = x < box.left - 0.5 || x > box.right + 0.5 || y < box.top - 0.5 || y > box.bottom + 0.5;
    if (outside) { scrolledOut.push(name(c)); continue; }
    covered.push(name(c) + '  <-  ' + name(hit));
  }
  return { z, local: app.clientWidth + 'x' + app.clientHeight, total: all.length,
           covered, scrolledOut: scrolledOut.length };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

async function main() {
  if (!browserPath) { console.error('screenreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'screenreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`screenreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8264, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`screenreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const evalIn = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };

  const fails = [];
  let shapesRun = 0;
  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    shapesRun++;
    console.log(`\n  ${shape} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    for (const sc of SCREENS) {
      await cdp.send('Page.navigate', { url: `${base}${sc.q}` }, S);
      const t0 = Date.now();
      let up = false;
      while (Date.now() - t0 < 12000) { if (await evalIn(sc.ready).catch(() => false)) { up = true; break; } await wait(150); }
      if (!up) { console.log(`    ${sc.name.padEnd(8)} DID NOT MOUNT — never a pass`); fails.push(`${shape} ${sc.name}: screen would not mount`); continue; }
      await wait(900); // auto-zoom re-flexes on a 150ms debounce plus a boot re-apply
      const r = await evalIn(PROBE);
      const tail = sc.overlay ? `  (overlay screen: ${sc.overlay})` : '';
      console.log(`    ${sc.name.padEnd(8)} zoom ${String(r.z).padEnd(5)} local ${r.local.padEnd(10)} ${String(r.total).padStart(3)} controls · ${r.scrolledOut} scrolled-out (fine) · ${r.covered.length} COVERED${tail}`);
      for (const c of r.covered) console.log(`               ✗ ${c}`);
      if (r.covered.length && !sc.overlay) fails.push(`${shape} ${sc.name}: ${r.covered.length} covered control(s) — ${r.covered[0]}`);
    }
  }

  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS. This exact command —
  // `--only 412x915` — printed "PASS — no covered controls" and exited 0 at the
  // one shape where Sunna had measured a covered map node. It is
  // development.md's `verify-shipped: OK - 0 checks passed` fixture, reproduced
  // in a tool whose own header cites that discipline. She found it despite this
  // tool rather than with it.
  if (shapesRun === 0) {
    console.error(`\nscreenreach: --only ${only} matched no shape. Nothing was tested, so this is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map((v) => `${v.w}x${v.h}`).join(', ')}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone. Only the
  screens with a ?shot= state are reached: title, map, combat, boss, death.
  CUSTOMIZE, SHOP, REST, REWARDS and every overlay have NO ?shot= and are not
  covered here or anywhere — and #23's own bleed evidence came from customize.
  Reachability at rest only: nothing is pressed, legibility is not judged, and a
  control that appears only mid-interaction cannot be seen.

  AND THE SHAPE LIST IS NOT THE OTHER TOOL'S. This runs 1200x730, 390x844,
  360x640, 844x390; tools/mobilefit.mjs runs nine, and neither list is a
  superset. A defect can live in the gap, and one does: Sunna swept nine widths
  by hand and found a covered map node at 412x915 — a shape THIS TOOL DOES NOT
  TEST — that dev does not have. Closing the gap is a card, not a silent edit,
  because adding that shape turns this red on a finding she carried without
  blocking.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length}` : 'PASS — no covered controls'}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`screenreach: ${e.message}`); process.exit(2); });
