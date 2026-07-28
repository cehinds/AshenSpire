// tools/mobilefit.mjs — can a finger reach the combat controls, at every shape
// we ship, in both orientations?
//
// This is the browser instrument for EldenSpire #21 and #23. Sunna measured both
// by hand on the shipped bundle at `bf18a2e`; this re-runs her two edges on
// demand so a proposed fix can be judged by the same numbers rather than by an
// adjective. It measures nothing about how any of it FEELS — that stays her read.
//
// WHAT IT ASSERTS
//   1. #21's reach grid. A 45-point grid over each required combat control,
//      hit-tested with elementFromPoint. Sunna's known-bad is `.end-turn` at
//      0/45 on all three portrait shapes; her green is 45/45 at 844x390. Both
//      are re-run here on every invocation, so the grid is observed red before
//      any number it prints is used as coverage (development.md, The instrument
//      rule).
//   2. #23's fit invariant, in two forms, because the literal one stops being
//      meaningful the moment a layout gains a narrow mode:
//        (a) LITERAL — appliedZoom x designW <= innerWidth, with designW read
//            from balance.ui.uiScale, whatever the running code says it needs.
//        (b) OBSERVATIONAL — the app's own scrollWidth does not exceed the
//            viewport, and no required control's box crosses a viewport edge.
//      (a) is Sunna's card verbatim. (b) is the thing (a) is a proxy FOR, and it
//      survives a design baseline that changes. A fix that satisfies (a) by
//      redefining designW and still bleeds is caught by (b), and only by (b).
//   3. #23's second, independent mechanism: page-level scroll travel. Reported,
//      never asserted — whether a phone SHOULD scroll the board is a design call
//      and not this tool's to make.
//
// WHY LOCAL PX APPEAR NEXT TO VISUAL PX EVERYWHERE BELOW
//   The app is zoomed by `body { zoom: var(--ui-zoom) }`. Hit-testing and
//   getBoundingClientRect are VISUAL; layout authoring is LOCAL. A number without
//   its space is not a measurement (see tools/zoomplace.mjs's header, and
//   EldenSpire#15). Every reported pair is labelled.
//
// Usage
//   node tools/mobilefit.mjs                 source tree via tools/serve.mjs
//   node tools/mobilefit.mjs --dist          dist/AshenSpire.html over file://
//   node tools/mobilefit.mjs --only 390x844
//   node tools/mobilefit.mjs --shots DIR     also write a PNG per shape
//   CHROME=/path/to/chrome node tools/mobilefit.mjs
//
// Exit codes
//   0  every shape satisfied every assertion
//   1  an assertion failed  (expected on `dev` — that is the point)
//   2  usage / no browser / a board that would not mount — never a pass
//
// BOUNDARY, printed again at the end where a reader will see it:
//   Linux headless Chromium 1194 only. CDP device emulation is not a phone: it
//   carries viewport, DPR, the viewport meta and the touch event stream, and it
//   does NOT carry iOS/WebKit, real fonts, the OS gesture layer, or a thumb --
//   these touches land where aimed. It also does not carry a moving address bar:
//   measured in this harness, 100dvh, 100svh and 100lvh are all the same number,
//   so this tool can say NOTHING about the 60-100px the bar eats and returns.
//   It hit-tests reachability only; it never judges legibility.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

// The five phone shapes Sunna measured, plus the two desktop edges every gate in
// this repo has used. `known` records what her run at `bf18a2e` observed, so a
// baseline run either reproduces her numbers or the instrument is wrong.
// 1200x730 RUNS FIRST AND IS THE REFERENCE, not merely the non-regression edge.
// The bar for every other shape is what the SAME control reads here, because a
// 45-point grid over a bounding box cannot read 45/45 on a round control: the
// energy orb is a circle, its box corners belong to the parent, and pi/4 of 45
// is 35. A flat `hits === 45` called the orb broken in LANDSCAPE, where the
// fight is fine and Sunna's own run says so. The reference reading is the
// control's own geometry; a shape is judged against that, never against 45.
const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop', reference: true, known: { endTurn: 45 } },
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait', known: { endTurn: 0 } },
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait', known: { endTurn: 0 } },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait', known: { endTurn: 0 } },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape', known: { endTurn: 45 } },
  { w: 915, h: 412, d: 2.6, mobile: true, tag: 'landscape', known: {} },
  // Landscape as a phone actually reports it while the browser chrome is
  // showing. 844x390 is the DEVICE; innerHeight is smaller whenever the address
  // bar is up, and "landscape already works" is a claim about the shape a player
  // is actually in. ~46px is Chrome-on-Android's landscape bar; the number is a
  // stand-in, so this row is a SENSITIVITY reading, not a device.
  { w: 844, h: 344, d: 3, mobile: true, tag: 'landscape-chrome', known: {} },
  { w: 1920, h: 1080, d: 1, mobile: false, tag: 'desktop', known: { endTurn: 45 } },
  // The decisive case for WHICH primitive a reflow is written in. Settings ->
  // UI size -> XL is zoom 1.45 on a 1200px screen, so the layout has 828 LOCAL
  // px while a media query still reads 1200. Not a phone and not hypothetical:
  // it is a shipped setting, and it is where a media-query breakpoint and a
  // container-query breakpoint give different answers on the same screen.
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop-XL', settings: { uiScale: 'xl' }, known: {} },
];

// The controls a fight cannot be advanced without. `.end-turn` is #21's subject;
// the other three are named in its re-open clause, so they are measured from the
// start rather than added the day one of them regresses.
const CONTROLS = ['.end-turn', '.energy-orb', '.pile.draw', '.pile.discard'];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const shotsDir = argOf('--shots');
const useDist = args.includes('--dist');

const fails = [];
const ok = (cond, msg) => { console.log(`    ${cond ? '\u2713' : '\u2717'} ${msg}`); if (!cond) fails.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const n2 = (v) => (v == null ? 'n/a' : (Math.round(v * 100) / 100).toString());

// ---- minimal CDP client (same shape as tools/zoomplace.mjs / tutorial-reach.mjs)
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
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, userDataDir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, [
      '--headless', '--no-sandbox', '--disable-gpu', '--window-size=1440,860',
      '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files',
      '--no-first-run', 'about:blank',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const onData = (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) res({ child, wsUrl: m[1] });
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);
    child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-500)}`)), 12000);
  });
}

// ------------------------------------------------------------- page probes
//
// THE GRID. 9 columns x 5 rows = 45 points, each at the CENTRE of its cell, so
// no point ever lands on a border pixel where the answer is a rounding coin
// flip. A point counts as reached when elementFromPoint returns the control or
// anything inside it -- `closest()`, not identity, because `.pile` and
// `.end-turn` both have children that would otherwise read as misses.
//
// Reported alongside: what DID answer at the missed points. "0/45" and "0/45,
// and the thing on top is a hand card" are different findings, and only the
// second one names a cause.
const GRID = (sel) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return { present: true, rendered: false, hits: 0, of: 45, r };
  const COLS = 9, ROWS = 5;
  let hits = 0; const blockers = {};
  for (let i = 0; i < COLS; i++) for (let j = 0; j < ROWS; j++) {
    const x = r.left + r.width * (i + 0.5) / COLS;
    const y = r.top + r.height * (j + 0.5) / ROWS;
    const hit = document.elementFromPoint(x, y);
    if (hit && hit.closest(${JSON.stringify(sel)}) === el) { hits++; continue; }
    const k = hit ? (hit.tagName.toLowerCase() + (hit.className && typeof hit.className === 'string' ? '.' + hit.className.trim().split(/\\s+/).join('.') : '')) : 'null';
    blockers[k] = (blockers[k] || 0) + 1;
  }
  return { present: true, rendered: true, hits, of: COLS * ROWS, blockers,
    r: { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
    cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
})()`;

// Fit: the two forms of #23's invariant, plus the scroll travel that survives it.
const FIT = `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const de = document.documentElement, app = document.getElementById('app');
  const ui = window.__uiScale || null;
  const designW = ui ? ui.designW : null, designH = ui ? ui.designH : null;
  // IS THE NARROW LAYOUT ACTUALLY LAID OUT? Observed, not inferred from a
  // breakpoint number this tool would then be holding a second copy of. The
  // narrow rule turns .hand-area into a grid; nothing else in the sheet does.
  const ha = document.querySelector('.hand-area');
  const narrowActive = !!ha && getComputedStyle(ha).display === 'grid';
  // Observational bleed: every element the fight needs, measured against the
  // VISUAL viewport, which is the space a finger and an eye both live in.
  const need = ['.topbar', '.field', '.hand-area', '.end-turn', '.energy-orb', '.pile.draw', '.pile.discard'];
  const bleed = [];
  for (const s of need) {
    const e = document.querySelector(s);
    if (!e) continue;
    const r = e.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) continue;
    const over = { left: Math.max(0, -r.left), right: Math.max(0, r.right - innerWidth),
                   top: Math.max(0, -r.top), bottom: Math.max(0, r.bottom - innerHeight) };
    const worst = Math.max(over.left, over.right, over.top, over.bottom);
    if (worst > 0.5) bleed.push({ sel: s, over, worst });
  }
  // Widest thing on the board, so "bleed" is not limited to the list above.
  //
  // AN ELEMENT CLIPPED BY A SCROLLER IS NOT BLEEDING OFF THE SCREEN. The first
  // version of this loop reported 175.81px of bleed on track B and named
  // '.card' — the fifth card of a hand that is now a horizontal strip, sitting
  // exactly where a scrolled-out card is supposed to sit, inside a container
  // that clips it. document.scrollWidth - clientWidth was 0 at the same
  // moment, which is what a real overflow would have moved. So skip anything
  // with a scrolling/clipping ancestor between it and .combat: that element's
  // container owns its bounds, and the viewport does not.
  const clipped = (e) => {
    // .combat is checked FIRST and ends the walk: it carries overflow:hidden
    // itself and is viewport-sized, so testing it before stopping made every
    // element on the board "clipped" and the metric always zero. The question
    // is whether a container INSIDE the board owns this element's bounds.
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.classList && p.classList.contains('combat')) return false;
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return true;
    }
    return false;
  };
  let widest = 0, widestSel = '';
  for (const e of document.querySelectorAll('.combat *')) {
    const r = e.getBoundingClientRect();
    if (r.width <= 0) continue;
    const o = Math.max(0, -r.left) + Math.max(0, r.right - innerWidth);
    if (o > widest && !clipped(e)) { widest = o; widestSel = e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : e.tagName; }
  }
  return {
    z, designW, designH, vw: innerWidth, vh: innerHeight,
    localW: app ? app.clientWidth : null, localH: app ? app.clientHeight : null,
    // Sunna's form is 'zoom x designW <= innerWidth'. It has exactly one
    // design width in it, and it stops being answerable the moment a layout
    // has two. So: the invariant holds if the applied zoom fits ANY baseline
    // the app is actually drawn for, and the tool names which one carried it.
    // On a tree with one baseline this is her sentence unchanged.
    narrowActive,
    literal: designW == null ? null : (() => {
      const cands = [{ name: 'designW', w: designW }];
      // narrowW counts ONLY when the narrow layout is actually laid out. The
      // first version accepted any baseline that fit, and at 1200x730 with UI
      // size XL it PASSED - 1.45 x 430 = 623 <= 1200 - while the board on
      // screen was the WIDE layout in 828 local px with END TURN at 14/45. A
      // fit against a baseline the layout is not using is not a fit; it is the
      // invariant answering a question about a different app.
      if (ui && ui.narrowW && narrowActive) cands.push({ name: 'narrowW(active)', w: ui.narrowW });
      const evald = cands.map((c) => ({ ...c, lhs: z * c.w, fits: z * c.w <= innerWidth + 0.5 }));
      const winner = evald.find((c) => c.fits);
      return { all: evald, holds: !!winner, by: winner ? winner.name : null,
               lhs: evald[0].lhs, rhs: innerWidth };
    })(),
    literalH: designH == null ? null : { lhs: z * designH, rhs: innerHeight, holds: z * designH <= innerHeight + 0.5 },
    docOverflowX: de.scrollWidth - de.clientWidth,
    pageScrollY: de.scrollHeight - de.clientHeight,
    bleed, worstBleed: widest, worstBleedSel: widestSel,
    hand: (() => { const h = document.querySelector('.hand'); if (!h) return null; const r = h.getBoundingClientRect();
      return { cards: document.querySelectorAll('.hand .card').length, w: r.width, left: r.left, right: r.right }; })(),
    // WHICH ROOM A BREAKPOINT IS EVALUATED IN. A media query resolves against
    // the UNZOOMED viewport; a container query on #app resolves against the
    // local box the layout is actually authored in. Printed at every shape so
    // the divergence is a number in the log and not an argument in a review.
    mq520: matchMedia('(max-width: 520px)').matches,
    // THE ELEMENT AT RISK FROM container-type. Declaring a container makes
    // that element a containing block for its absolutely- AND fixed-positioned
    // descendants. The overlays fixed this week (#15, #18) are children of
    // <body> and out of reach, but #target-arrow is position:fixed with
    // width/height 100% and lives inside .combat, inside #app. If #app becomes
    // its containing block its 100% resolves against #app instead of the
    // viewport. Reported at every shape so the answer is a number rather than
    // an argument about the spec.
    arrow: (() => {
      const a = document.getElementById('target-arrow');
      if (!a) return null;
      // It ships display:none until a card is armed, so at rest it measures
      // 0x0 and the check was vacuously red. Shown for the measurement and put
      // back — the harness must not leave the board in a state no player asked
      // for, and a check that can only run on a state nobody visits is the
      // defect I logged on 2026-07-28.
      const prev = a.style.display;
      a.style.display = 'block';
      const r = a.getBoundingClientRect();
      a.style.display = prev;
      return { w: r.width, h: r.height, left: r.left, top: r.top,
               matchesViewport: Math.abs(r.width - innerWidth) < 1 && Math.abs(r.height - innerHeight) < 1 };
    })(),
    // An orientation gate (track A) is a DELIBERATE cover over the board. Its
    // presence changes what the reach grid means: 0/45 behind a screen that
    // says "turn your phone sideways" is the design, and 0/45 behind a hand of
    // cards is EldenSpire#21. A tool that cannot tell those apart would score
    // the two tracks with the same number and call it a comparison.
    gate: (() => {
      const g = document.getElementById('orient-gate');
      if (!g) return null;
      const cs = getComputedStyle(g);
      const r = g.getBoundingClientRect();
      const up = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0;
      if (!up) return { up: false };
      // Does it actually cover, and does it EAT input? #21 is a lockout because
      // a covered control still looks alive, so a gate that only covers the
      // pixels would reproduce the bug with better manners.
      const pts = [[4, 4], [innerWidth - 4, 4], [4, innerHeight - 4], [innerWidth - 4, innerHeight - 4], [innerWidth / 2, innerHeight / 2]];
      const owned = pts.filter((p) => { const e = document.elementFromPoint(p[0], p[1]); return e && (e === g || g.contains(e)); }).length;
      return { up: true, w: r.width, h: r.height, coversViewport: r.width >= innerWidth - 0.5 && r.height >= innerHeight - 0.5,
        cornersAndCentreOwned: owned + '/5', text: (g.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 70) };
    })(),
  };
})()`;

const TURN = `(() => { const c = window.__combat; return c ? { turn: c.turn, energy: c.player.energy } : null; })()`;

// ---------------------------------------------------------------------- main
async function main() {
  if (!browserPath) { console.error('mobilefit: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'mobilefit-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`mobilefit: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8262, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  if (shotsDir) mkdirSync(resolve(shotsDir), { recursive: true });
  console.log(`mobilefit — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) { if (await evalIn(expr)) return true; await wait(120); }
    throw new Error(`timeout: ${label}`);
  };

  // A real finger, not a mouse: Input.dispatchTouchEvent is what fires the
  // pointer stream a phone fires, including the pointercancel of #22.
  const tap = async (x, y) => {
    const pt = [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt }, S);
    await wait(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S);
  };

  const rows = [];
  const ceiling = {}; // per-control grid reading at the design baseline — the bar
  for (const vp of SHAPES) {
    const name = `${vp.w}x${vp.h}${vp.settings ? `-${Object.values(vp.settings).join('-')}` : ''}`;
    if (only && only !== name) continue;
    console.log(`\n  ${name} @ dSF ${vp.d}  (${vp.tag})`);

    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    // maxTouchPoints must be >= 1 whatever `enabled` says — CDP rejects 0 with
    // "Touch points must be between 1 and 16", which killed the run at the first
    // desktop shape after five mobile ones. `enabled` is the switch.
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    const q = `shot=combat${vp.settings ? `&shotSettings=${encodeURIComponent(JSON.stringify(vp.settings))}` : ''}`;
    await cdp.send('Page.navigate', { url: `${base}?${q}` }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, `${name}: combat board`);
    await wait(900); // auto-zoom re-flexes on a 150 ms debounce plus a boot re-apply

    // THE SHOT IS TAKEN HERE, BEFORE ANY GESTURE. The first run captured it
    // after the .end-turn tap, and at 390x844 that tap lands on a hand card —
    // so every portrait screenshot carried an armed card and an open tooltip
    // that no player had summoned. A photograph of the board is a photograph of
    // the board at rest, not of the harness poking it.
    if (shotsDir) {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
      const out = join(resolve(shotsDir), `${name}.png`);
      writeFileSync(out, Buffer.from(shot.data, 'base64'));
      console.log(`    shot (at rest, before any gesture): ${out}`);
    }

    const fit = await evalIn(FIT);
    console.log(`    ui-zoom ${fit.z} · viewport ${fit.vw}x${fit.vh} visual · app ${fit.localW}x${fit.localH} local · hand ${fit.hand ? fit.hand.cards : '?'} cards (${n2(fit.hand && fit.hand.w)} visual px)`);
    if (fit.arrow) ok(fit.arrow.matchesViewport, `${name}: #target-arrow (position:fixed inside the new container) still measures the viewport — ${n2(fit.arrow.w)}x${n2(fit.arrow.h)} vs ${fit.vw}x${fit.vh}`);
    console.log(`    narrow layout active: ${fit.narrowActive ? 'YES (.hand-area is a grid)' : 'no (wide layout)'}`);
    console.log(`    breakpoint room: a 520px MEDIA query says ${fit.mq520 ? 'narrow' : 'wide'} (sees ${fit.vw}); a 520px CONTAINER query on #app says ${fit.localW <= 520 ? 'narrow' : 'wide'} (sees ${fit.localW})${fit.mq520 !== (fit.localW <= 520) ? '  <-- THEY DISAGREE' : ''}`);
    // If a gate is up, everything below is measuring the gate. Say so first and
    // switch what is asserted — otherwise track A's "0/45" and dev's "0/45"
    // print identically and mean opposite things. The board behind a screen
    // that says "portrait is not supported" is not making a claim about fit;
    // #23's own removal condition allows exactly that answer, PROVIDED the app
    // says it to the player. The gate assertions are what stands in.
    const gated = !!(fit.gate && fit.gate.up);
    if (!gated) {
      if (fit.literal) {
        const shown = fit.literal.all.map((c) => `${c.name} ${c.w} -> ${n2(c.lhs)}${c.fits ? ' FITS' : ''}`).join(' · ');
        ok(fit.literal.holds, `${name}: #23 (a) LITERAL — the applied zoom ${fit.z} fits a baseline the app is drawn for: ${shown} <= innerWidth ${fit.literal.rhs}`);
      }
      ok(fit.docOverflowX <= 0.5, `${name}: #23 (b) OBSERVATIONAL — nothing overflows the document horizontally (scrollWidth - clientWidth = ${n2(fit.docOverflowX)})`);
      ok(fit.bleed.length === 0, `${name}: #23 (b) OBSERVATIONAL — no required element crosses a viewport edge${fit.bleed.length ? ` (${fit.bleed.map((b) => `${b.sel} by ${n2(b.worst)}px`).join(', ')})` : ''}`);
    }
    console.log(`    page scroll travel: ${n2(fit.pageScrollY)}px vertical, ${n2(fit.docOverflowX)}px horizontal · worst horizontal bleed on the board: ${n2(fit.worstBleed)}px (${fit.worstBleedSel})`);

    if (fit.gate) {
      if (gated) {
        console.log(`    ORIENTATION GATE UP — ${n2(fit.gate.w)}x${n2(fit.gate.h)} covering ${fit.vw}x${fit.vh}, owns ${fit.gate.cornersAndCentreOwned} of the corners+centre · "${fit.gate.text}"`);
        ok(fit.gate.coversViewport, `${name}: the gate covers the whole viewport (a gate written in vw/vh would cover ${n2(fit.vw * fit.z)}x${n2(fit.vh * fit.z)} of it)`);
        ok(fit.gate.cornersAndCentreOwned === '5/5', `${name}: the gate EATS input at all four corners and the centre — a cover that does not hit-test is #21 with better manners`);
      } else {
        console.log(`    orientation gate present in the DOM and DOWN — the board is live here`);
      }
    }

    const grids = {};
    for (const sel of CONTROLS) {
      const g = await evalIn(GRID(sel));
      grids[sel] = g;
      if (!g) { ok(false, `${name}: ${sel} exists in the DOM`); continue; }
      if (!g.rendered) { console.log(`    ${sel.padEnd(14)} not rendered (0x0)`); ok(false, `${name}: ${sel} renders`); continue; }
      const blocked = Object.entries(g.blockers || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${v}x ${k}`).join(', ');
      console.log(`    ${sel.padEnd(14)} ${String(g.hits).padStart(2)}/${g.of} reachable · box ${n2(g.r.width)}x${n2(g.r.height)} at (${n2(g.r.left)},${n2(g.r.top)})${blocked ? ` · on top: ${blocked}` : ''}`);
      if (vp.reference) { ceiling[sel] = g.hits; continue; } // the reference sets the bar; it cannot fail against itself
      if (gated) continue; // measured through a deliberate cover — asserted above, on the gate
      const bar = ceiling[sel];
      if (bar == null) {
        console.log(`      (no reference reading — 1200x730 was skipped, so this number has no bar and is NOT asserted)`);
        continue;
      }
      ok(g.hits >= bar, `${name}: ${sel} reads ${g.hits}/${g.of}, bar is ${bar}/${g.of} (its reading at the 1200x730 design baseline)`);
    }

    // The control that makes the grid mean something: a real touch at the centre
    // of .end-turn either advances the fight or it does not.
    let advanced = null;
    const et = grids['.end-turn'];
    if (vp.mobile && et && et.rendered && !gated) {
      const before = await evalIn(TURN);
      await tap(et.cx, et.cy);
      await wait(700);
      const after = await evalIn(TURN);
      advanced = !!(before && after && after.turn !== before.turn);
      console.log(`    real touch at .end-turn centre (${n2(et.cx)},${n2(et.cy)}): turn ${before && before.turn} -> ${after && after.turn} — ${advanced ? 'ADVANCED' : 'did nothing'}`);
    }

    // The instrument rule, run inline: does this grid reproduce what Sunna
    // observed at bf18a2e? Printed, never asserted — on a FIXED tree it is
    // supposed to disagree, and a tool that fails when its own fix works is a
    // tool that can only ever measure the past.
    if (vp.known && vp.known.endTurn != null && et) {
      const same = et.hits === vp.known.endTurn;
      console.log(`    baseline check: Sunna observed .end-turn ${vp.known.endTurn}/45 at bf18a2e; this tree reads ${et.hits}/45 — ${same ? 'reproduced' : 'CHANGED'}`);
    }

    rows.push({ name, tag: vp.tag, z: fit.z, local: `${fit.localW}x${fit.localH}`,
      endTurn: gated ? 'GATED' : (et && et.rendered ? `${et.hits}/45` : 'n/r'), advanced,
      bleed: n2(fit.worstBleed), scrollY: n2(fit.pageScrollY) });
  }

  console.log('\n  SUMMARY');
  console.log('  shape       kind       zoom  local space   END TURN  touch  worst bleed  page scrollY');
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(11)} ${r.tag.padEnd(10)} ${String(r.z).padEnd(5)} ${r.local.padEnd(13)} ${r.endTurn.padEnd(9)} ${(r.advanced === null ? '-' : r.advanced ? 'yes' : 'NO').padEnd(6)} ${r.bleed.padEnd(12)} ${r.scrollY}`);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; CDP emulation carries viewport, DPR,
  the viewport meta and the touch stream, and carries NO iOS/WebKit, no real
  fonts, no OS gesture layer, no thumb, and NO MOVING ADDRESS BAR (100dvh,
  100svh and 100lvh all measure the same here, so this tool is silent on the
  60-100px the bar eats and returns). It hit-tests reachability; it never judges
  legibility, and it says nothing about #22's pointercancel, which is a separate
  card measured by a separate gesture.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} assertion(s)` : 'PASS — every assertion held'} over ${rows.length} shape(s), ${CONTROLS.length} control(s) each.`);
  for (const f of fails) console.log(`    - ${f}`);

  cdp.close();
  child.kill();
  if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`mobilefit: ${e.message}`); process.exit(2); });
