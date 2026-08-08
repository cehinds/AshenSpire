#!/usr/bin/env node
// tools/axisfit.mjs — LAW 5's machine check. On a narrow shape, every scroll
// container's horizontal travel is ZERO, or the container names its own
// exemption, in the code, with its reason.
//
// Bjorn, 2026-08-08, on Constantine's word:
//
//   "for mobile, if possible, I should only be scrolling up and down, rarely
//    left and right. so if you need to rearrange things to keep everything
//    visible in the vertical dimension, then do so"
//
// Law 5 is house law (commons/laws.md) and is not restated here — the family
// repo is its home and this file is its enforcement pointer. What lives HERE is
// only the mechanism.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS AND tools/mobilefit.mjs DOES NOT ANSWER IT
//
// mobilefit sweeps 32 shapes, passes, and is SILENT about this axis. Its
// horizontal reading is `documentElement.scrollWidth - clientWidth`, and this
// app is `overflow: hidden` at the root, so that number is ZERO BY
// CONSTRUCTION at every shape — measured, not assumed: across 14 surfaces x 5
// shapes at cd3da94 the document itself never once appeared as a scroller. Its
// `clipped()` walk then deliberately SKIPS any element with a scrolling
// ancestor, and its bleed set is `.combat *`. Three mechanisms, none of which
// can see a scroller three elements down on a screen that is not combat.
//
// GREEN ON 32 SHAPES WAS SILENCE ABOUT THE AXIS, NOT COVERAGE OF IT. So the
// unit here is the SCROLL CONTAINER, never the document, and the surface
// population is every ?shot= state, not one board.
//
// ---------------------------------------------------------------------------
// THE POPULATION, STATED, BECAUSE A SHAPE LIST AND A TOLERANCE ARE THE SAME
// OBJECT — a boundary drawn around the cells its author already looked at.
// I cut a shape list and invented a fitted tolerance in one file in one hour
// once. So each edge of this one says who drew it and whether a machine can:
//
//   SURFACES — DERIVED, not typed. A regex over src/main.js's `shotState ===`
//     comparisons, the same home tools/release-shots.mjs reads, with the same
//     two floors it learned the hard way: zero derived states is a FINDING (an
//     empty denominator is not full coverage), and any derived state neither
//     measured nor excluded BY NAME is a FINDING. I cannot shorten this list
//     without the tool saying so.
//   DRIVEN OVERLAYS — A TYPED LIST OF THREE, and the weakest edge in this file.
//     They have no ?shot= state, so nothing derives them; the settings tab
//     strip is one of the offenders Law 5 names by name, and leaving it out
//     because it is awkward would be the boundary drawn around the easy cells.
//     An overlay whose opener does not fire is `unknown` and RED — never a skip.
//   SHAPES — the app decides, not me. A shape is in scope iff the app itself
//     rendered `data-layout="narrow"` there. No width threshold appears in this
//     file. The GEOMETRY fed in is still a typed list, and it is a second copy
//     of the one in mobilefit.mjs — so `assertShapesAgree()` below reads that
//     file and fails if the two ever disagree. A second copy WITH something
//     checking they agree is not the defect; a second copy with nothing is.
//   TEXT SIZE — ONE CELL by default, and it MATTERS: at 390x844 `.hand` runs
//     200px at Text M and 326px at Text XL, and the event screen 18 -> 22.
//     `--text S|M|L|XL` reaches the other cells; the default run does not sweep
//     them and this is printed in the boundary rather than left to be found.
//
//   NO TOLERANCE. Zero is zero — clause 2 of the law says a threshold is not an
//   exemption, "a number a layout can sneak under is how 401px becomes normal
//   one commit at a time." The proof is on this tree: the SMALLEST offender is
//   the event screen at 18px. Any tolerance I could have fitted to the map's
//   401 would have hidden it. Chromium reports scrollWidth/clientWidth as
//   integers, so `> 0` needs no epsilon; if a 1px ever appears, the answer is
//   the layout, never a tolerance here.
//
// ---------------------------------------------------------------------------
// THE EXEMPTION, AND WHY IT IS NOT A LIST IN THIS FILE
//
// Law 5 clause 2: a surface may scroll horizontally only where the horizontal
// run IS the content, "named at the container, in the code, with its reason."
// The house has solved the latch/exemption problem twice already and the answer
// both times was the same: THE EXEMPTION ASSERTS ITS OWN REASON AND FAILS WHEN
// THE REASON DIES.
//
// So there is no allow-list here. A container excuses itself, where it is
// rendered, by carrying:
//
//     data-scroll-axis="x"  data-scroll-axis-why="<why the content IS a run>"
//
// and the check treats that declaration as a claim it can falsify:
//
//   A1  travel > 0 and no declaration            -> FAIL (the law)
//   A2  declaration with no reason, or an empty  -> FAIL (an exemption with no
//       reason, or any value but "x"                reason is a mute button;
//                                                   one word, closed, so the
//                                                   vocabulary cannot widen by
//                                                   accident)
//   A3  declaration and travel > 0               -> excused, printed at volume
//   A4  declaration and travel == 0              -> FAIL (RATCHET). The reason
//       died: either the content stopped being a horizontal run, or this check
//       went blind. Both need a person. An excuse nobody can be forced to
//       revisit is how a suite goes green over a bug.
//
// THE TREE SHIPS WITH ZERO EXEMPTIONS DECLARED, DELIBERATELY. `.hand` at 200px
// is a card hand and is very probably the real one — that is a DESIGN call, and
// design calls are not mine to make from inside an instrument. It stays red
// until the seat that owns that surface writes the reason on the element, where
// a reviewer reads it in the diff.
//
// ---------------------------------------------------------------------------
// KNOWN-BAD FIRST (development.md, The instrument rule). Nothing needed
// authoring to make this falsifiable — the defect was already shipped:
//
//     .map-scroll = 401px horizontal / 19px vertical at 390x844
//     dev = cd3da94, dist/AshenSpire.html sha256 d3925545a6ad
//
// A check whose failing case nobody has watched fail is `unknown`, not green.
// `--selftest` plants all eight of this file's mechanisms in memory and prints
// what went red, INCLUDING the two that must go GREEN — a check that can only
// ever be red is as useless as one that can only ever be green, and only the
// second failure is usually looked for.
//
// Usage
//   node tools/axisfit.mjs                 source tree via tools/serve.mjs
//   node tools/axisfit.mjs --dist          dist/AshenSpire.html over file://
//   node tools/axisfit.mjs --text XL       one other cell of the text axis
//   node tools/axisfit.mjs --only map      one surface (still `unknown` on a typo)
//   node tools/axisfit.mjs --selftest      plant every mechanism, watch it fail
//   CHROME=/path/to/chrome node tools/axisfit.mjs
//
// Exit codes
//   0  every narrow container travelled 0px horizontally, or excused itself
//   1  an assertion failed  (EXPECTED on dev at cd3da94 — that is the point)
//   2  usage / no browser / a surface that would not mount — never a pass
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day EldenSpire
// ships no narrow shape — then `data-layout="narrow"` never renders, the scope
// filter selects nothing, and the run says so out loud instead of passing.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? One home: tools/artifact-provenance.mjs. Facts only;
// it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const SELFTEST = args.includes('--selftest');
const only = argOf('--only');
const textSize = argOf('--text') || null;

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));

// ---------------------------------------------------------------- population 1
// SURFACES — derived from the one home, with release-shots' two floors.
// Deliberately the same regex against the same file: two readers of one home is
// not a second copy of a fact, it is two witnesses to it. If the shape of that
// source moves, BOTH go loud, which is the behaviour wanted.
function appShotStates() {
  const src = readFileSync(resolve(ROOT, 'src', 'main.js'), 'utf8');
  return [...new Set([...src.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))].sort();
}

// A ?shot= state excluded from the axis sweep must be named HERE with its
// reason, or the run fails with the state's name in the message. There is no
// silent gap and no way to shrink the denominator quietly.
const EXCLUDED_STATES = {};

// ---------------------------------------------------------------- population 2
// DRIVEN OVERLAYS — no ?shot= state exists, so nothing derives these and this
// list is TYPED. It is the weakest edge in the file and is printed with every
// run. `open` returns true, or a string saying what it could not find; a string
// is RED, because a surface that never opened is `unknown` and unknown blocks.
const DRIVEN = [
  {
    name: 'title-settings', from: '',
    why: 'the settings panel on the title door — Law 5 names its tab strip as a known offender',
    open: `(async () => {
      const b = [...document.querySelectorAll('button')].find((x) => /settings/i.test(x.textContent));
      if (!b) return 'no Settings button on the title door';
      b.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelector('[data-settings-host]') ? true : 'the settings host never appeared';
    })()`,
  },
  {
    name: 'overlay-menu', from: '?shot=combat',
    why: 'the in-run overlay and its six tabs — a tabbed surface, so Law 3 lives here too',
    open: `(async () => {
      const m = [...document.querySelectorAll('button')].find((x) => /^(menu|\\u2630)$/i.test(x.textContent.trim()));
      if (!m) return 'no Menu button on the combat board';
      m.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelectorAll('.ov-tab').length ? true : 'the overlay opened with no tabs';
    })()`,
  },
  {
    name: 'overlay-settings', from: '?shot=combat',
    why: 'settings INSIDE the run — the second of the two doors, and a different scroller from the first',
    open: `(async () => {
      const m = [...document.querySelectorAll('button')].find((x) => /^(menu|\\u2630)$/i.test(x.textContent.trim()));
      if (!m) return 'no Menu button on the combat board';
      m.click(); await new Promise((r) => setTimeout(r, 600));
      const t = [...document.querySelectorAll('.ov-tab')].find((b) => /^settings$/i.test(b.textContent.trim()));
      if (!t) return 'no Settings tab in the overlay strip';
      t.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelectorAll('.set-tab').length ? true : 'the settings pane opened with no tabs';
    })()`,
  },
];

// ---------------------------------------------------------------- population 3
// SHAPES. The geometry is typed; the SCOPE is not. A row is measured at every
// shape and ASSERTED only where the app rendered data-layout="narrow".
//
// THIS IS A SECOND COPY of the shape geometry in tools/mobilefit.mjs, and I am
// not going to pretend otherwise — collapsing the two into one home is a real
// change across other seats' instruments and it is not tonight's. What IS
// tonight's is that nothing was checking they agree, which is the whole defect
// class. assertShapesAgree() closes that: it reads mobilefit's own source and
// fails if any shape there is missing here.
const DEVICE_SHAPES = [
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
  { w: 915, h: 412, d: 2.6, mobile: true, tag: 'landscape' },
  { w: 844, h: 344, d: 3, mobile: true, tag: 'landscape-chrome' },
  { w: 834, h: 1194, d: 2, mobile: true, tag: 'tablet' },
  { w: 884, h: 1326, d: 2, mobile: true, tag: 'tablet' },
  { w: 885, h: 1326, d: 2, mobile: true, tag: 'tablet' },
  { w: 900, h: 1600, d: 2, mobile: true, tag: 'tablet' },
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' },
  { w: 1920, h: 1080, d: 1, mobile: false, tag: 'desktop' },
];

function shapesInMobilefit() {
  const src = readFileSync(resolve(ROOT, 'tools', 'mobilefit.mjs'), 'utf8');
  return [...new Set([...src.matchAll(/\{\s*w:\s*(\d+),\s*h:\s*(\d+),\s*d:\s*([\d.]+)/g)]
    .map((m) => `${m[1]}x${m[2]}@${m[3]}`))].sort();
}

// ------------------------------------------------------------------ assertions
const fails = [];
const notes = [];
const ok = (cond, msg) => {
  console.log(`    ${cond ? '\u2713' : '\u2717'} ${msg}`);
  if (!cond) fails.push(msg);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------- page probe
//
// EVERY SCROLL CONTAINER, and the document among them rather than instead of
// them. An element counts when it has real travel on either axis AND the
// computed overflow on some axis is auto/scroll — a clipped `overflow: hidden`
// box is not something a thumb can move, and calling it a scroller would make
// this tool report the layout rather than the gesture.
//
// documentElement is ALWAYS reported, travel or not, and always labelled: it is
// the number mobilefit asserted, it is zero by construction under a fullscreen
// `overflow: hidden` app, and printing it beside the real scrollers is the only
// way a reader stops mistaking it for coverage.
const SCAN = `(() => {
  const path = (e) => {
    const bits = [];
    for (let n = e; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; bits.unshift(s); break; }
      if (n.classList && n.classList.length) s += '.' + [...n.classList].slice(0, 3).join('.');
      bits.unshift(s);
    }
    return bits.join(' > ');
  };
  const de = document.documentElement;
  const read = (e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      path: path(e),
      hx: e.scrollWidth - e.clientWidth,
      hy: e.scrollHeight - e.clientHeight,
      overflowX: cs.overflowX, overflowY: cs.overflowY,
      w: r.width, h: r.height,
      rendered: e.getClientRects().length > 0,
      axis: e.getAttribute('data-scroll-axis'),
      why: e.getAttribute('data-scroll-axis-why'),
    };
  };
  const containers = [];
  for (const e of document.querySelectorAll('*')) {
    const hx = e.scrollWidth - e.clientWidth, hy = e.scrollHeight - e.clientHeight;
    if (hx <= 0 && hy <= 0) continue;
    const cs = getComputedStyle(e);
    if (!/auto|scroll/.test(cs.overflowX) && !/auto|scroll/.test(cs.overflowY)) continue;
    if (!e.getClientRects().length) continue;
    containers.push(read(e));
  }
  return {
    layout: de.getAttribute('data-layout'),
    zoom: parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1,
    htmlFont: getComputedStyle(de).fontSize,
    vw: innerWidth, vh: innerHeight,
    doc: read(de),
    containers,
  };
})()`;

// ------------------------------------------------------------------ CDP client
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

// ------------------------------------------------------------ the law, applied
//
// One container, one verdict. Pulled out of the loop so --selftest exercises the
// SAME function the run does, rather than a re-statement of it that could drift
// green while this one is red.
export function judge(c) {
  const travels = c.hx > 0;
  const declared = c.axis != null;
  if (!declared) {
    return travels
      ? { verdict: 'FAIL', why: `travels ${Math.round(c.hx)}px horizontally and declares no exemption` }
      : { verdict: 'PASS', why: 'no horizontal travel' };
  }
  if (c.axis !== 'x') {
    return { verdict: 'FAIL', why: `data-scroll-axis="${c.axis}" is not a word this check knows — the only exemption is "x"` };
  }
  if (!c.why || !String(c.why).trim()) {
    return { verdict: 'FAIL', why: 'declares data-scroll-axis="x" with no data-scroll-axis-why — an exemption with no reason is a mute button' };
  }
  if (!travels) {
    return { verdict: 'FAIL', why: `RATCHET — declares a horizontal run ("${c.why}") and has ZERO horizontal travel. The reason died, or this check went blind. Both need a person.` };
  }
  return { verdict: 'EXCUSED', why: `${Math.round(c.hx)}px, exempt under Law 5 clause 2: ${c.why}` };
}

// ---------------------------------------------------------------------- main
async function main() {
  if (!browserPath) { console.error('axisfit: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }

  printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);

  // ---- population, derived and floored, BEFORE the browser costs anything ----
  const derived = appShotStates();
  if (!derived.length) {
    console.error('\naxisfit: derived ZERO ?shot= states from src/main.js.');
    console.error('An empty denominator is not full coverage — it is a home this tool can no longer read.');
    process.exit(1);
  }
  const excluded = Object.keys(EXCLUDED_STATES);
  const surfaces = derived.filter((s) => !EXCLUDED_STATES[s]);
  console.log(`\nPOPULATION 1 — surfaces · home: src/main.js (?shot= states), DERIVED`);
  console.log(`  ${derived.length} state(s): ${surfaces.length} swept, ${excluded.length} excluded by name`);
  for (const s of excluded) console.log(`  EXCLUDED  ?shot=${s} — ${EXCLUDED_STATES[s] || 'NO REASON GIVEN'}`);
  console.log(`  ${surfaces.join(', ')}`);
  console.log(`\nPOPULATION 2 — driven overlays · TYPED, ${DRIVEN.length} entries, the weakest edge here`);
  for (const d of DRIVEN) console.log(`  ${d.name.padEnd(18)} ${d.why}`);

  // ---- the second copy, and the thing that watches it ----
  const mine = new Set(DEVICE_SHAPES.map((s) => `${s.w}x${s.h}@${s.d}`));
  const theirs = shapesInMobilefit();
  const missing = theirs.filter((s) => !mine.has(s));
  console.log(`\nPOPULATION 3 — shapes · ${DEVICE_SHAPES.length} typed here, ${theirs.length} read out of tools/mobilefit.mjs`);
  if (missing.length) {
    console.error(`\naxisfit: mobilefit.mjs ships ${missing.length} shape(s) this file does not: ${missing.join(', ')}.`);
    console.error('These two lists are a second copy of one fact. That is tolerable only while something');
    console.error('checks they agree, and they no longer do. Add the shape here, or move both to one home.');
    process.exit(1);
  }
  console.log(`  agree: every shape in mobilefit.mjs is measured here`);
  console.log(`  SCOPE IS NOT THIS LIST — a shape is asserted iff the app renders data-layout="narrow" there.`);

  // ---- serve ----
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`axisfit: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8263, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`\naxisfit — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}${textSize ? `  ·  Text size ${textSize}` : '  ·  Text size: the shipping default'}`);

  const profile = mkdtempSync(join(tmpdir(), 'axisfit-'));
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
  const done = (code) => { cdp.close(); child.kill(); if (server) server.close(); process.exit(code); };

  // `?shotSettings` keys are the app's own. textSize is looked up CASE-SENSITIVE
  // in balance.ui.textSize (S/M/L/XL) while uiScale is lowercased first — so a
  // tool passing "xl" for text size silently gets M and reports a sweep it never
  // ran. Cost me one probe run tonight; named here so it costs nobody else one.
  const settingsQ = textSize ? `&shotSettings=${encodeURIComponent(JSON.stringify({ textSize }))}` : '';
  const settingsQ1 = textSize ? `?shotSettings=${encodeURIComponent(JSON.stringify({ textSize }))}` : '';

  if (SELFTEST) { await selftest(evalIn, cdp, S, base, settingsQ); return done(fails.length ? 1 : 0); }

  // ------------------------------------------------------------------ the sweep
  const rows = [];
  let asserted = 0, narrowCells = 0, matchedOnly = false;

  const measure = async (label, url, driver) => {
    await cdp.send('Page.navigate', { url }, S);
    await wait(1500);
    if (driver) {
      let opened;
      try { opened = await evalIn(driver); } catch (e) { opened = `threw: ${e.message.slice(0, 90)}`; }
      if (opened !== true) {
        // A surface that never opened is `unknown`, and unknown blocks. It is
        // NOT a skip: a skip here reads identically to a clean sweep.
        ok(false, `${label}: the surface never opened (${opened}) — unknown, not a pass`);
        return null;
      }
      await wait(400);
    }
    let r;
    try { r = await evalIn(SCAN); } catch (e) { ok(false, `${label}: the surface would not mount (${e.message.slice(0, 90)})`); return null; }
    return r;
  };

  for (const vp of DEVICE_SHAPES) {
    const shapeName = `${vp.w}x${vp.h}`;
    console.log(`\n  ${shapeName} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);

    const jobs = [
      ...surfaces.map((s) => ({ label: s, url: `${base}?shot=${s}${settingsQ}`, driver: null })),
      ...DRIVEN.map((d) => ({ label: d.name, url: `${base}${d.from ? d.from + settingsQ : settingsQ1}`, driver: d.open })),
    ];
    let shapeReported = false;
    for (const job of jobs) {
      if (only && only !== job.label) continue;
      if (only === job.label) matchedOnly = true;
      const r = await measure(`${shapeName} ${job.label}`, job.url, job.driver);
      if (!r) continue;
      const narrow = r.layout === 'narrow';
      if (!shapeReported) {
        console.log(`    data-layout=${r.layout} · zoom ${r.zoom} · html font ${r.htmlFont} · viewport ${r.vw}x${r.vh}` +
          `  ->  ${narrow ? 'IN SCOPE (asserted)' : 'out of scope (measured, reported, not asserted)'}`);
        // The number mobilefit asserts, printed next to the ones that matter.
        console.log(`    documentElement: ${Math.round(r.doc.hx)}px horizontal (overflow-x: ${r.doc.overflowX})` +
          `${r.doc.hx <= 0 ? '  <-- zero by construction under a fullscreen overflow:hidden app. NOT COVERAGE.' : ''}`);
        shapeReported = true;
      }
      if (narrow) narrowCells++;
      const hs = r.containers.filter((c) => c.hx > 0);
      if (!r.containers.length) { console.log(`    ${job.label.padEnd(17)} no scroll container`); continue; }
      for (const c of r.containers) {
        const j = judge(c);
        const line = `${job.label} · ${c.path} · H ${Math.round(c.hx)}px / V ${Math.round(c.hy)}px`;
        if (!narrow) {
          console.log(`    ${job.label.padEnd(17)} ${c.hx > 0 ? 'H' : ' '}${c.hy > 0 ? 'V' : ' '} ${String(Math.round(c.hx)).padStart(4)}/${String(Math.round(c.hy)).padStart(4)}  ${c.path}   (not asserted — wide layout)`);
          continue;
        }
        asserted++;
        if (j.verdict === 'EXCUSED') { console.log(`    \u2713 [EXEMPT] ${line} — ${j.why}`); notes.push(line); continue; }
        ok(j.verdict === 'PASS', `${line} — ${j.why}`);
      }
      rows.push({ shape: shapeName, surface: job.label, narrow, worst: hs.length ? Math.max(...hs.map((c) => Math.round(c.hx))) : 0,
        who: hs.length ? hs.sort((a, b) => b.hx - a.hx)[0].path.split(' > ').pop() : '' });
    }
  }

  if (only && !matchedOnly) {
    console.error(`\naxisfit: --only ${only} matched no surface. Nothing was tested, so this is unknown, not a pass.`);
    console.error(`  surfaces: ${[...surfaces, ...DRIVEN.map((d) => d.name)].join(', ')}`);
    return done(2);
  }
  // A run that asserted nothing is `unknown`, never a pass — the house's own
  // `verify-shipped: OK — 0 checks passed` fixture, which this repo has now
  // reproduced in three separate tools.
  if (!narrowCells) {
    console.error(`\naxisfit: no shape rendered data-layout="narrow", so ZERO containers were asserted.`);
    console.error('Either the narrow layout is gone (in which case this file\'s removal condition has fired');
    console.error('and it should be deleted), or the attribute moved and the scope filter has gone blind.');
    return done(1);
  }

  // ------------------------------------------------------------------- summary
  const narrowRows = rows.filter((r) => r.narrow);
  const bad = narrowRows.filter((r) => r.worst > 0).sort((a, b) => b.worst - a.worst);
  console.log(`\n  NARROW CELLS — ${bad.length} of ${narrowRows.length} (shape x surface) scroll sideways`);
  for (const r of bad) console.log(`    ${String(r.worst).padStart(4)}px  ${r.shape.padEnd(9)} ${r.surface.padEnd(17)} ${r.who}`);

  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) ONE CELL OF THE TEXT AXIS. This run is Text ${textSize || 'M (shipping default)'}; text size
      moves these numbers (390x844 .hand 200px at M, 326px at XL; the event
      screen 18 -> 22). --text S|M|L|XL reaches the others; nothing sweeps them.
  (b) SCROLLING, NOT WRAPPING. A strip that answers a narrow shape by wrapping
      to two rows spends VERTICAL and reads 0 here. Law 5 clause 4 governs that
      and this tool is silent on it — the settings tab strip at Text L/XL is
      exactly that case.
  (c) NOT BLEED. An element painted past the viewport edge inside a clipping
      box is not scroll travel; tools/mobilefit.mjs owns bleed and this owns
      travel. The Map-zoom chip row's 424.6px was the first kind.
  (d) THE FRAME AFTER IT SETTLES, on Linux headless Chromium, one machine, no
      thumb and no OS gesture layer. Nothing here says a scroller is REACHABLE
      or usable — only which way it moves.
  (e) DRIVEN SURFACES ARE A TYPED LIST OF ${DRIVEN.length}. Anything reachable only by a
      click that is not in it was not looked at.`);

  if (notes.length) {
    console.log(`\n  EXEMPT — ${notes.length} container(s) declared themselves a horizontal run under Law 5 clause 2.`);
    console.log(`  Each is re-checked every run and goes RED the moment its travel reaches zero.`);
  }
  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} assertion(s)` : 'PASS — every assertion held'} over ${asserted} asserted container(s) in ${narrowCells} narrow cell(s).`);
  for (const f of fails) console.log(`    - ${f}`);
  return done(fails.length ? 1 : 0);
}

// -------------------------------------------------------------------- selftest
//
// EIGHT MECHANISMS, PLANTED. Two of them must go GREEN and six must go RED, and
// the greens are the half usually left out: a check that can only ever be red
// passes for rigour and blocks nothing, because the first person to see it
// permanently red turns it off.
async function selftest(evalIn, cdp, S, base, settingsQ) {
  console.log('\n  SELFTEST — planting each mechanism against the known-bad (390x844, ?shot=map)\n');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, S);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
  await cdp.send('Page.navigate', { url: `${base}?shot=map${settingsQ}` }, S);
  await wait(1600);

  const plant = async (attrs) => {
    const set = attrs === null
      ? `e.removeAttribute('data-scroll-axis'); e.removeAttribute('data-scroll-axis-why');`
      : Object.entries(attrs).map(([k, v]) => `e.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ');
    await evalIn(`(() => { const e = document.querySelector('.map-scroll'); if (!e) throw new Error('no .map-scroll'); ${set} return true; })()`);
    const r = await evalIn(SCAN);
    return r.containers.find((c) => c.path.endsWith('.map-scroll'));
  };
  const expect = (label, got, want) => {
    const good = got === want;
    console.log(`    ${good ? '\u2713' : '\u2717'} ${label} -> ${got}${good ? '' : ` (expected ${want})`}`);
    if (!good) fails.push(`selftest: ${label} gave ${got}, expected ${want}`);
  };

  // 1 — THE FREE KNOWN-BAD, unplanted. 401px, no declaration.
  let c = await plant(null);
  console.log(`    (the tree as it ships: .map-scroll H ${Math.round(c.hx)}px / V ${Math.round(c.hy)}px)`);
  expect('A1  travel, no declaration', judge(c).verdict, 'FAIL');

  // 2 — the exemption honoured. This is the GREEN half.
  c = await plant({ 'data-scroll-axis': 'x', 'data-scroll-axis-why': 'the act map is a horizontal run (planted)' });
  expect('A3  declared + travel  (must go GREEN)', judge(c).verdict, 'EXCUSED');

  // 3 — a declaration with no reason.
  c = await plant({ 'data-scroll-axis': 'x', 'data-scroll-axis-why': '   ' });
  expect('A2  declared, blank reason', judge(c).verdict, 'FAIL');
  await evalIn(`document.querySelector('.map-scroll').removeAttribute('data-scroll-axis-why')`);
  c = (await evalIn(SCAN)).containers.find((x) => x.path.endsWith('.map-scroll'));
  expect('A2  declared, reason absent', judge(c).verdict, 'FAIL');

  // 4 — a word outside the closed vocabulary.
  c = await plant({ 'data-scroll-axis': 'both', 'data-scroll-axis-why': 'we need both (planted)' });
  expect('A2  data-scroll-axis="both"', judge(c).verdict, 'FAIL');

  // 5 — THE RATCHET. Declared, and the travel is gone.
  expect('A4  declared, zero travel (RATCHET)',
    judge({ hx: 0, hy: 200, axis: 'x', why: 'a card hand', path: '.hand' }).verdict, 'FAIL');

  // 6 — the other GREEN half: a plain vertical scroller must not be a finding.
  expect('A0  no travel, no declaration (must go GREEN)',
    judge({ hx: 0, hy: 510, axis: null, why: null, path: '.cp-scroll' }).verdict, 'PASS');

  // 7 — the surface denominator's floor, exercised on a string rather than by
  // editing src/main.js: the regex, run over a source that no longer matches.
  const blinded = [...new Set([...'if (shotState===\'map\') {}'.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))];
  expect('P1  a reformatted src/main.js blinds the reader', blinded.length ? 'SAW' : 'ZERO', 'ZERO');
  console.log('        (zero derived states exits 1 in main(); Vira killed release-shots the same way with whitespace)');

  // 8 — the shape second-copy guard, planted by removing a row.
  const mineShort = new Set(DEVICE_SHAPES.slice(1).map((s) => `${s.w}x${s.h}@${s.d}`));
  const missed = shapesInMobilefit().filter((s) => !mineShort.has(s));
  expect('P3  a shape dropped here but shipped in mobilefit', missed.length ? 'CAUGHT' : 'MISSED', 'CAUGHT');

  console.log(`\n  ${fails.length ? `SELFTEST FAIL — ${fails.length} mechanism(s) did not behave` : 'SELFTEST PASS — 8 mechanisms, 2 green and 6 red, each observed'}`);
  for (const f of fails) console.log(`    - ${f}`);
}

main().catch((e) => { console.error(`axisfit: ${e.message}`); process.exit(2); });
