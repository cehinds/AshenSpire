#!/usr/bin/env node
// tools/pairsweep.mjs — the settings door, walked: named high-risk pairs of
// (geometry-moving settings row × core gate), each legal value through the
// app's OWN resolution, never the tool's copy of it.
//
// WHY THIS EXISTS. "At shipped defaults" is doing enormous, unstated work in
// this repo's greens. Every instrument here boots the app and measures — and
// almost every one measures the settings store's ABSENT state, so a promise
// like "your next step is on screen, or the screen says so" was measured at
// one point of a space the settings rows multiply by their legal values. The
// founding case (Sunna, 2026-08-14): Map zoom '200' SAVED in settings — a
// legal value, one row, no gesture history — boots floor 11 with the player's
// ONLY next step wholly off screen, and 2646 readings had never met it,
// because every sweep walked shipped defaults. A stored legal value is a boot
// state, not an interaction, and it holds every promise the defaults hold.
//
// THE RULING THIS BUILDS (Marina, 2026-08-14, wave-three board, R-DEFAULTS):
// BOUNDED SWEEP — not a full product instrument, not accepted-blind. Sunna
// names the high-risk pairs and the sweep runs those pairs only, with its
// boundary stating what it does not sweep. A full cartesian instrument is a
// boil-the-ocean refusal; blind acceptance is the fourth silent state.
//
// THE PAIRS IN (each is a pair NO instrument walks today — that is the
// entry test, and the exit test for the pairs listed OUT below):
//
//   zoom  Map zoom (all legal stored values: Fit + the ladder read from
//         src/model/mapview.js, never retyped here) × the map framing gate:
//         fit-or-confess. At every value: the camera owns X (horizontal
//         travel 0, Law 5 clause 1 per container), and a reachable choice
//         wholly off screen sideways ⇒ .map-clipnote visible, naming a side
//         and both recoveries; no choice off ⇒ the note is SILENT. Two
//         positions: the entrance, and the founding cell (seed BJORN6,
//         n11_0) — so the sweep meets both edges, the kept promise and the
//         confessed break, and refuses to pass if it met only one.
//   text  Text size S / L / XL (M is the default cell every existing green
//         already stands on) × horizontal travel on the map scroller and the
//         settings surface (.set-tabs, .set-panel) at 390x844.
//         tools/axisfit.mjs prints in its own boundary that its default run
//         sweeps ONE text cell; these are the cells it names and does not walk.
//   fade  Walked fade off / subtle / half / strong × the way forward. The
//         row's own note is the gate: "so the way forward stands out from the
//         trail behind you." At every rung: current + reachable nodes never
//         fade (opacity 1, no filter); across rungs: the trail actually moves
//         (a knob whose value changes nothing is Law 0 clause 5's dangerous
//         failure), off leaves it at full, strong still DRAWS it. Posed with
//         ?shotWalk so there is a trail to fade.
//
// THE PAIRS OUT, each with the instrument that already walks it — an entry
// here would be a second copy of a walker, which is the defect this house
// exists to catch:
//
//   tap floor × tap gate        tools/tapsize.mjs walks shape × UI size ×
//                               text size × tap size, same ?shotSettings door.
//   hand layout × hand fit      tools/handlayout.mjs walks mode × text size,
//                               same door, observed red at 71e3edd.
//   high contrast / cb-safe /   tools/contrast-audit.mjs walks nine profiles
//   text-L / ui-S × readability (incl. hi-contrast-off, cb-safe, text-L, ui-S)
//                               through the same door, --gate'd.
//   accent × readability        NOT walked anywhere at its five values — named
//                               here as the nearest cut. The right home is one
//                               PROFILES row per accent in contrast-audit (a
//                               data edit to the instrument that owns render-
//                               level color), not a second contrast reader here.
//   UI size × travel            uiScale is one uniform zoom; travel 0 is scale-
//                               invariant, so the defaults green carries. First
//                               pair to add if that argument ever measures false.
//   map reveal × framing        the framing box derives from the choice set,
//                               which fog/path does not change; the drawn
//                               census gates live in tools/mapfog.mjs.
//
// Usage
//   node tools/pairsweep.mjs                 all three pairs, this tree
//   node tools/pairsweep.mjs --pair zoom     one pair
//   node tools/pairsweep.mjs --root DIR      another tree (the known-bad run)
//   CHROME=/path/to/chrome node tools/pairsweep.mjs
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// OBSERVED RED (the instrument rule), SAME DOOR AS THE REAL INPUT — the value
// enters as ?shotSettings JSON, through saves.saveMeta, resolved by savedZoom /
// applyDisplaySettings, exactly as a player's stored row is:
//
//   zoom @ acb8ffe (pre-#164, the real tree the founding case shipped on):
//       --root <acb8ffe checkout> --pair zoom → exit 1, 28 findings across
//       14 of 14 cells: every cell NOTE-MISSING (.map-clipnote is not in that
//       DOM — a choice gone sideways is silent, the founding defect red by
//       name) and every cell H-TRAVEL > 0 (entrance 57–114 px, founding cell
//       343–685 px; zoom=200 @ founding: 685 px).
//   text @ acb8ffe: --pair text → 3 findings, H-TRAVEL 114 px on .map-scroll
//       at S, L and XL.
//   text @ a planted copy of 929b6ea (applyDisplaySettings's fontSize write
//       commented out; a 600 px ::after child in .set-panel): → 6 findings —
//       DOOR red by name at every rung (root 10px, wanted 9/11/12) and
//       H-TRAVEL 222 px on .set-panel at every rung.
//   fade @ a planted copy of 929b6ea (the three fade rules deleted from
//       styles/map.css): → 3 findings, "a knob value that changes nothing"
//       at every non-off rung. Second plant (a rule fading .map-node.reachable
//       at 'half'): → "1 of 2 way-forward nodes faded at this rung".
//   929b6ea (this tree at authoring)  → exit 0, all three pairs, 21 cells,
//       ~15 s; the zoom pair met both edges (12 cells fit-and-silent, 2
//       clipped-and-confessed at 175/200 on the founding cell).
//
//   STILL UNWATCHED, said rather than implied (the instrument rule: a check
//   nobody has seen fail is unknown, not green, however it prints): the zoom
//   DOOR mismatch arm, the note's side/recovery grammar arms, the
//   note-speaks-while-nothing-is-off arm, and the recovery-buttons-present
//   arm. Each is a belt check layered over an assertion above that HAS been
//   observed red; none of them is load-bearing alone. Cite the observed set,
//   not these.
//
// BOUNDARY — printed by boundary() below in the run's own output, because a
// boundary that lives only in a header is a boundary nobody re-reads.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TREE = resolve(val('--root', ROOT));
const ONLY = val('--pair', null);
if (ONLY && !['zoom', 'text', 'fade'].includes(ONLY)) {
  console.error(`pairsweep: unknown pair '${ONLY}'. Have: zoom, text, fade`);
  process.exit(2);
}

// One shape. The sweep is bounded ON PURPOSE; the shape most likely to clip is
// the narrow one, and the wave-three ruling asked for pairs, not a shape matrix.
const SHAPE = { w: 390, h: 844 };

// ---- legal values, READ FROM THE TREE, never retyped ------------------------
// The zoom ladder's one home is src/model/mapview.js; the text ladder's is
// balance.ui.textSize. A copy of either here would agree today and be
// synchronised by nothing — the exact defect the founding case rode in on
// (a settings row that once carried four of the ladder's six steps).
function zoomValuesFromTree() {
  const src = readFileSync(resolve(TREE, 'src/model/mapview.js'), 'utf8');
  const m = /ZOOM_STEPS\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/.exec(src);
  if (!m) throw new Error('ZOOM_STEPS not found in src/model/mapview.js — nothing to sweep');
  const steps = m[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  if (steps.length < 2) throw new Error(`ZOOM_STEPS parsed to ${steps.length} entries — refusing a ladder of one`);
  return ['Fit', ...steps.map((z) => String(Math.round(z * 100)))];
}
function textSizesFromTree() {
  const src = readFileSync(resolve(TREE, 'src/content/balance.js'), 'utf8');
  const m = /textSize:\s*\{([^}]+)\}/.exec(src);
  if (!m) throw new Error('balance.ui.textSize not found — nothing to sweep');
  const out = {};
  for (const mm of m[1].matchAll(/([A-Z]+):\s*'([\d.]+)%'/g)) out[mm[1]] = Number(mm[2]);
  if (Object.keys(out).length < 2) throw new Error('textSize ladder parsed to fewer than 2 rungs');
  return out;
}
// The fade ladder: its one CODE home is the inline set in main.js's
// applyDisplaySettings (a documented restatement of the settings row's
// choices). Read the settings row, which is the authored home.
function fadeValuesFromTree() {
  const src = readFileSync(resolve(TREE, 'src/ui/screens/settings.js'), 'utf8');
  const m = /key:\s*'walkedFade'[\s\S]{0,200}?choices:\s*\[([^\]]+)\]/.exec(src);
  if (!m) throw new Error('walkedFade row not found in src/ui/screens/settings.js — nothing to sweep');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

// ---- browser harness (the house pattern: raw CDP, zero dependencies) --------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BROWSERS = [process.env.CHROME, '/usr/bin/chromium', '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].filter(Boolean);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
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
      `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-400)}`)), 20000);
  });
}

async function open() {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) { console.error('pairsweep: no Chromium/Chrome found — set CHROME=<path>'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'pairsweep-'));
  const { child, wsUrl } = await launchChrome(browser, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: SHAPE.w, height: SHAPE.h, deviceScaleFactor: 1, mobile: true }, S);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (x, what, ms = 20000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(120); }
    throw new Error(`timed out waiting for ${what}`);
  };
  return { cdp, S, ev, until, close: () => { cdp.close(); child.kill(); } };
}

// ---- reads ------------------------------------------------------------------
// Every number is a RENDERED number read off the page the app drew; the only
// facts taken from source files are the ladders themselves (one home each).

// The map cell: the page's own confession, the note, the scroller's travel,
// and an INDEPENDENT count of reachable choices wholly off screen sideways —
// so the note is checked against a measurement, not against itself.
const READ_MAP = `(() => {
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { ok: false, why: 'no .map-scroll' };
  const d = sc.dataset;
  const r = sc.getBoundingClientRect();
  const nodes = [...document.querySelectorAll('.map-node.reachable')];
  let offH = 0;
  for (const n of nodes) {
    const b = n.getBoundingClientRect();
    if (b.right <= r.left + 0.5 || b.left >= r.right - 0.5) offH++;
  }
  const note = document.querySelector('.map-clipnote');
  return {
    ok: true,
    framing: d.framing || null, framingZoom: d.framingZoom || null,
    hTravel: Math.max(0, sc.scrollWidth - sc.clientWidth),
    reachable: nodes.length, offH,
    noteExists: !!note,
    noteShown: !!note && !note.hidden,
    noteText: note ? (note.textContent || '').trim() : '',
    zoomOut: !!document.querySelector('#zoom-out'),
    zoomReset: !!document.querySelector('#zoom-reset'),
  };
})()`;

const READ_TEXT_MAP = `(() => {
  const sc = document.querySelector('.map-scroll');
  if (!sc) return { ok: false, why: 'no .map-scroll' };
  return { ok: true,
    rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    hTravel: Math.max(0, sc.scrollWidth - sc.clientWidth) };
})()`;

const READ_TEXT_SETTINGS = `(() => {
  const tabs = document.querySelector('.set-tabs');
  const panel = document.querySelector('.set-panel');
  if (!tabs || !panel) return { ok: false, why: 'settings surface not open' };
  const t = (el) => Math.max(0, el.scrollWidth - el.clientWidth);
  return { ok: true, tabsTravel: t(tabs), panelTravel: t(panel) };
})()`;

const READ_FADE = `(() => {
  const walked = [...document.querySelectorAll('.map-node.visited')].filter((n) => !n.classList.contains('current'));
  const forward = [...document.querySelectorAll('.map-node.reachable'), ...document.querySelectorAll('.map-node.current')];
  const read = (n) => { const s = getComputedStyle(n); return { opacity: parseFloat(s.opacity), filter: s.filter }; };
  return {
    ok: true,
    applied: document.documentElement.dataset.walkedFade || null,
    walkedCount: walked.length,
    walkedMinOpacity: walked.length ? Math.min(...walked.map((n) => read(n).opacity)) : null,
    forwardCount: forward.length,
    forwardFaded: forward.filter((n) => { const v = read(n); return v.opacity < 0.999 || (v.filter && v.filter !== 'none'); }).length,
  };
})()`;

// ---- the sweep --------------------------------------------------------------
const findings = [];
const F = (cell, what) => { findings.push(`${cell}: ${what}`); console.log(`  RED   ${cell}: ${what}`); };
const OK = (cell, what) => console.log(`  ok    ${cell}: ${what}`);

async function nav(b, href, params) {
  const q = new URLSearchParams(params).toString();
  await b.cdp.send('Page.navigate', { url: `${href}?${q}` }, b.S);
  await b.until(`!!document.querySelector('.map-node')`, 'the map');
  await wait(350);
}

async function pairZoom(b, href) {
  const values = zoomValuesFromTree();
  console.log(`\nPAIR zoom — Map zoom x fit-or-confess (${values.length} legal values x 2 positions)`);
  const positions = [
    { label: 'entrance', seed: 'SHOWCASE', at: null },
    // The founding cell: the seed and node of the saved-200 case (Sunna,
    // 2026-08-14, #164 gate). shotAt throws by name if the node is not in
    // this seed's act — a silent fallback would sweep a different cell.
    { label: 'founding', seed: 'BJORN6', at: 'n11_0' },
  ];
  let cells = 0; let confessed = 0; let silent = 0;
  for (const pos of positions) {
    for (const v of values) {
      const cell = `zoom=${v} @ ${pos.label}`;
      const params = { shot: 'map', shotSeed: pos.seed, shotSettings: JSON.stringify({ mapZoom: v }) };
      if (pos.at) params.shotAt = pos.at;
      await nav(b, href, params);
      const m = await b.ev(READ_MAP);
      if (!m.ok) { F(cell, `nothing to measure (${m.why})`); continue; }
      cells++;
      // DOOR: the app resolved the STORED value, not a default. Numeric rungs
      // land exactly; Fit computes, so any positive zoom is the door working.
      if (v !== 'Fit') {
        const want = (Number(v) / 100).toFixed(3);
        if (m.framingZoom !== want) F(cell, `DOOR: stored ${v} resolved to zoom ${m.framingZoom}, wanted ${want}`);
      } else if (!(parseFloat(m.framingZoom) > 0)) {
        F(cell, `DOOR: Fit resolved to zoom ${m.framingZoom}`);
      }
      if (!m.reachable) { F(cell, 'no reachable nodes drawn — empty denominator'); continue; }
      // GATE 1 — Law 5 clause 1, this container: the camera owns X at EVERY
      // rung of the ladder, not only at the default.
      if (m.hTravel > 0) F(cell, `H-TRAVEL ${m.hTravel}px on .map-scroll (camera must own X at every zoom)`);
      // GATE 2 — fit or confess. The note must exist to be able to speak.
      if (!m.noteExists) F(cell, 'NOTE-MISSING: .map-clipnote not in the DOM — a sideways clip here would be silent');
      if (m.offH > 0) {
        confessed++;
        if (m.noteExists && !m.noteShown) F(cell, `${m.offH} reachable choice(s) wholly off screen sideways and the note is hidden`);
        if (m.noteShown) {
          if (!/right|left/.test(m.noteText)) F(cell, `note names no side: "${m.noteText}"`);
          if (!(m.noteText.includes('\u2212') || m.noteText.includes('-')) || !m.noteText.includes('\u2299')) {
            F(cell, `note names no recovery (need \u2212 and \u2299): "${m.noteText}"`);
          }
          if (!m.zoomOut || !m.zoomReset) F(cell, 'note points at recovery buttons that are not on the screen');
          if (findings.every((f) => !f.startsWith(cell))) OK(cell, `clipped and CONFESSED: "${m.noteText}" (zoom ${m.framingZoom})`);
        }
      } else {
        silent++;
        if (m.noteShown) F(cell, `nothing off screen sideways, yet the note speaks: "${m.noteText}"`);
        if (findings.every((f) => !f.startsWith(cell))) OK(cell, `fits, note silent (zoom ${m.framingZoom}, ${m.reachable} choices on)`);
      }
    }
  }
  // BOTH EDGES, or the pair has not been tested: a sweep that never met a clip
  // has never seen the note speak; one that never met a fit has never seen it
  // hush. Either absence is a finding about THIS SWEEP, not about the app.
  if (!confessed) F('pair zoom', 'no cell ever clipped — the confessing edge was never exercised');
  if (!silent) F('pair zoom', 'no cell ever fit — the silence edge was never exercised');
  return { cells, expected: values.length * positions.length };
}

async function pairText(b, href) {
  const ladder = textSizesFromTree();
  const values = Object.keys(ladder).filter((k) => k !== 'M');
  console.log(`\nPAIR text — Text size x horizontal travel (${values.join('/')}; M is the default cell every instrument already measures)`);
  let cells = 0;
  for (const v of values) {
    const cell = `text=${v}`;
    await nav(b, href, { shot: 'map', shotSeed: 'SHOWCASE', shotSettings: JSON.stringify({ textSize: v }) });
    const m = await b.ev(READ_TEXT_MAP);
    if (!m.ok) { F(cell, `nothing to measure (${m.why})`); continue; }
    cells++;
    // DOOR: the root font-size is the ladder's own percentage of the UA's 16px.
    const want = 16 * ladder[v] / 100;
    if (Math.abs(m.rootPx - want) > 0.1) F(cell, `DOOR: root font-size ${m.rootPx}px, wanted ${want}px (${ladder[v]}%)`);
    if (m.hTravel > 0) F(cell, `H-TRAVEL ${m.hTravel}px on .map-scroll`);
    // The settings surface, by its own door: the in-run overlay's Settings tab.
    await b.ev(`(() => { const bs = [...document.querySelectorAll('button')];
      const x = bs.find((n) => /\u2630/.test(n.textContent)) || bs.find((n) => /menu/i.test(n.getAttribute('aria-label') || ''));
      if (x) x.click(); return !!x; })()`);
    await b.until(`!!document.querySelector('.overlay-tabs .ov-tab')`, 'the overlay strip');
    await b.ev(`(() => { const t = [...document.querySelectorAll('.overlay-tabs .ov-tab')].find((n) => /settings/i.test(n.textContent));
      if (t) t.click(); return !!t; })()`);
    await b.until(`!!document.querySelector('.set-tabs .set-tab')`, 'the settings strip');
    await wait(250);
    const s = await b.ev(READ_TEXT_SETTINGS);
    if (!s.ok) { F(cell, `settings surface: ${s.why}`); continue; }
    if (s.tabsTravel > 0) F(cell, `H-TRAVEL ${s.tabsTravel}px on .set-tabs`);
    if (s.panelTravel > 0) F(cell, `H-TRAVEL ${s.panelTravel}px on .set-panel`);
    if (findings.every((f) => !f.startsWith(cell))) OK(cell, `root ${m.rootPx}px; travel 0 on .map-scroll, .set-tabs, .set-panel`);
  }
  return { cells, expected: values.length };
}

async function pairFade(b, href) {
  const values = fadeValuesFromTree();
  console.log(`\nPAIR fade — Walked fade x the way forward (${values.join('/')}, posed with a 6-step trail)`);
  const byRung = {};
  let cells = 0;
  for (const v of values) {
    const cell = `fade=${v}`;
    await nav(b, href, { shot: 'map', shotSeed: 'SHOWCASE', shotWalk: '6', shotSettings: JSON.stringify({ walkedFade: v }) });
    const m = await b.ev(READ_FADE);
    cells++;
    if (m.applied !== v) { F(cell, `DOOR: stored '${v}' applied as '${m.applied}'`); continue; }
    if (!m.walkedCount) { F(cell, 'no walked nodes behind a 6-step trail — empty denominator'); continue; }
    if (!m.forwardCount) { F(cell, 'no current/reachable nodes drawn — empty denominator'); continue; }
    // THE GATE, the row's own sentence: the way forward never fades.
    if (m.forwardFaded > 0) F(cell, `${m.forwardFaded} of ${m.forwardCount} way-forward nodes faded at this rung`);
    byRung[v] = m.walkedMinOpacity;
    if (findings.every((f) => !f.startsWith(cell))) OK(cell, `trail ${m.walkedCount} node(s) at opacity ${m.walkedMinOpacity}; forward ${m.forwardCount} unfaded`);
  }
  // ACROSS THE RUNGS: the knob moves the thing it names, in the direction the
  // labels promise, and the trail never disappears. The exact numbers are the
  // stylesheet's own (styles/map.css) and are deliberately NOT restated here —
  // the assertion is ORDER plus the two ends.
  const got = values.filter((v) => byRung[v] != null);
  if (got.length === values.length) {
    if (byRung[values[0]] !== 1) F('pair fade', `'${values[0]}' leaves the trail at ${byRung[values[0]]}, wanted full (1)`);
    for (let i = 1; i < values.length; i++) {
      if (!(byRung[values[i]] < byRung[values[i - 1]])) {
        F('pair fade', `rung '${values[i]}' (${byRung[values[i]]}) does not fade more than '${values[i - 1]}' (${byRung[values[i - 1]]}) — a knob value that changes nothing`);
      }
    }
    const last = byRung[values[values.length - 1]];
    if (!(last > 0)) F('pair fade', `'${values[values.length - 1]}' erases the trail entirely (opacity ${last})`);
  }
  return { cells, expected: values.length };
}

// ---- boundary ---------------------------------------------------------------
function boundary() {
  console.log(`
BOUNDARY — what this sweep does NOT do, and why bounded is the ruling
  (Marina, 2026-08-14 wave-three board, R-DEFAULTS: bounded pairs, not the
  cartesian, not blind acceptance):
  - NOT the cartesian. One settings row leaves its default at a time, against
    the gate named for it. Combinations of two or more non-default rows are
    unswept here, and unswept everywhere.
  - NOT every row. Non-geometry rows (audio, pacing, hold-to-confirm, swap
    cost, grace refill, quick menu, ambient, shake, sprites...) move behavior,
    not geometry; their contracts live with their own instruments.
  - NOT the pairs other instruments already walk: tap floor (tapsize.mjs),
    hand layout (handlayout.mjs), high contrast / cb-safe / text-L / ui-S
    readability (contrast-audit.mjs). Accent x readability is walked NOWHERE
    at its five values — the named next candidate, and its right home is a
    PROFILES row per accent in contrast-audit, not a second reader here.
  - NOT illegal stored values. This sweep is about LEGAL values breaking
    promises (the founding case was legal); garbage-in contracts belong to
    the resolvers (savedZoom, resolveTapSize, resolveGraceRefill) and their
    own tests.
  - ONE shape (390x844), TWO map positions, ONE seed per position. Narrow is
    where geometry breaks first; this is a floor, not a survey.`);
}

// ---- main -------------------------------------------------------------------
(async () => {
  printArtifactProvenance(resolve(TREE, 'src/ui/screens/settings.js'), TREE);
  console.log(`pairsweep: tree ${TREE}, shape ${SHAPE.w}x${SHAPE.h}`);
  const { server, url } = await serve({ root: TREE, port: 8177, open: false });
  const b = await open();
  let ran = 0; let expected = 0;
  try {
    const pairs = { zoom: pairZoom, text: pairText, fade: pairFade };
    for (const [name, fn] of Object.entries(pairs)) {
      if (ONLY && name !== ONLY) continue;
      const r = await fn(b, url);
      ran += r.cells; expected += r.expected;
    }
  } finally {
    b.close();
    server.close();
  }
  boundary();
  // The denominator's floor: a run that measured fewer cells than it set out
  // to has not swept — whatever the findings list says.
  if (!expected || ran < expected) {
    console.error(`\npairsweep: RAN ${ran} of ${expected} cells — an incomplete sweep is not a sweep. FAIL`);
    process.exit(ran ? 1 : 2);
  }
  if (findings.length) {
    console.error(`\npairsweep: ${findings.length} finding(s) across ${ran} cells:`);
    for (const f of findings) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\npairsweep: PASS — ${ran} cells, every named pair at every legal value, 0 findings.`);
  process.exit(0);
})().catch((e) => {
  console.error(`pairsweep: ${e.message}`);
  process.exit(2);
});
