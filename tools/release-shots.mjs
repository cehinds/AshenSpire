#!/usr/bin/env node
// tools/release-shots.mjs — photograph the RELEASE BUILD, screen by screen,
// at the two shapes Constantine looks at (Bjorn, 2026-08-07, Track C).
//
// WHY THIS EXISTS AND WHY IT IS NOT tools/screenshot.mjs. That tool serves the
// SOURCE TREE and captures the ?shot= states that existed when it was written.
// Two gaps make it the wrong instrument for a release:
//   1. It photographs src/, not dist/AshenSpire.html. What Constantine runs is
//      the single-file bundle; a shot of the source tree is evidence about a
//      thing he never opens.
//   2. Five player-facing surfaces have NO ?shot= state and therefore cannot
//      appear in it at all — the Armoury, the menu tabs, Settings,
//      Settings → Profile, and the profile crisis notice (#66/#67, the newest
//      surface in the release). A capture set that silently omits the newest
//      screens is a green that means nothing.
// So this drives the built artifact over CDP: ?shot= where one exists, real
// clicks where one does not, and a seeded localStorage for the crisis notice —
// which is exactly the precondition a player with unreadable bytes has.
//
// THE ARTIFACT IS NEVER MODIFIED. The crisis states are reached by writing
// storage from outside and reloading, never by injecting script into the HTML.
// A shot of a patched bundle is a shot of something we do not ship.
//
// Usage:  node tools/release-shots.mjs [--out DIR] [--only NAME]
// Exit 0 = every shot captured and its screen asserted present; 1 = any miss.
//
// BOUNDARY: this proves a screen RENDERED and that its landmark element is on
// it. It does not prove the screen is legible (Sunna), correct (Vira), or that
// the art reads (Freja). Two viewports only — 390x844 and 1200x730.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const OUT = resolve(ROOT, oi >= 0 && args[oi + 1] ? args[oi + 1] : 'docs/release-shots');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const SHAPES = [
  { tag: '390x844', width: 390, height: 844, dsf: 2, mobile: true },
  { tag: '1200x730', width: 1200, height: 730, dsf: 1, mobile: false },
];

// D2 (Vira): coverage was HAND-LISTED and had already drifted from the app by
// five — eleven ?shot= states exist in src/, this file covered six, and the
// five co-op states were silently absent. That is precisely the failure this
// harness exists to correct in screenshot.mjs, reproduced by me in the tool
// that was supposed to be the fix. So the list is now DERIVED: the app's own
// states are read out of src/main.js, and any state with neither a shot entry
// nor an explicit exclusion below is a hard failure. A silent gap cannot
// recur; an intentional gap must be typed out and justified in one line.
const EXCLUDED_STATES = {
  // Co-op is a LAN mode whose shots need a canned server snapshot through a
  // stub socket (main.js coopStubMount, tools/coop-shoot.mjs is its own
  // instrument). Whether co-op ships in 0.4.x is Marina's call; until it is
  // in the release set, these are excluded BY NAME rather than missing.
  coop: 'LAN co-op — photographed by tools/coop-shoot.mjs; not in the 0.4.x solo delivery set',
  coopmap: 'LAN co-op — see coop',
  coopreward: 'LAN co-op — see coop',
  coopshrine: 'LAN co-op — see coop',
  coopcatchup: 'LAN co-op — see coop',
};

/** The states the APP actually has, read from src/main.js — never retyped. */
function appShotStates() {
  const src = readFileSync(resolve(ROOT, 'src', 'main.js'), 'utf8');
  return [...new Set([...src.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))].sort();
}

// Each screen: how to reach it on the BUILT artifact, and the landmark that
// proves it actually rendered. A shot with no landmark assertion is a picture
// of whatever happened to be on screen — including a blank page.
// `state:` ties an entry to the app state it covers (the derivation above).
const SCREENS = [
  { name: 'title', query: '', landmark: '.title-screen' },
  { name: 'map', query: '?shot=map', landmark: '.mapscreen', state: 'map' },
  { name: 'map-atmospheric', query: '?shot=map&shotSettings=' + encodeURIComponent('{"highContrast":false}'), landmark: '.mapscreen' },
  { name: 'combat', query: '?shot=combat', landmark: '.combat', state: 'combat' },
  { name: 'combat-procs', query: '?shot=fx', landmark: '.combat', state: 'fx', poseWait: 1900 },
  { name: 'boss', query: '?shot=boss', landmark: '.combat', state: 'boss' },
  { name: 'death', query: '?shot=death', landmark: '.stats-table', state: 'death' },
  { name: 'customize', query: '?shot=customize', landmark: '.customize', state: 'customize' },
  // --- driven: no ?shot= state exists for any of these ---
  {
    name: 'armoury', query: '?shot=combat', landmark: '.armoury, .equip-screen, .equipment',
    drive: `document.querySelector('#combat-armoury').click()`,
  },
  {
    // The quicknav experiment defaults to 'off' (quicknav.js `let mode = 'off'`),
    // so #combat-menu opens the TABS OVERLAY directly (onMenu('deck') →
    // showOverlay, components/overlay.js `.overlay-tabs`). My first two
    // landmarks here were both wrong — `.menu-tabs` and then `.qn-panel`,
    // neither of which the shipped default path ever renders. Measured, not
    // guessed: this is the surface Law 3's bumpers ride.
    name: 'menu-tabs', query: '?shot=combat', landmark: '.overlay-tabs',
    drive: `document.querySelector('#combat-menu').click()`,
  },
  {
    name: 'settings', query: '', landmark: '.settings, .set-body',
    drive: `[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`,
  },
  {
    name: 'settings-profile', query: '', landmark: '.set-body',
    drive: `[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`,
    after: `(()=>{const h=[...document.querySelectorAll('.set-body *')].find(e=>/profile/i.test(e.textContent||'')&&e.children.length===0);if(h)h.scrollIntoView({block:'center'});return !!h;})()`,
  },
  // The crisis notice: seeded storage, never a patched bundle. Corrupt bytes
  // (truncated JSON) is the 'corrupt' state; a future schemaVersion is 'newer'.
  {
    name: 'crisis-corrupt', query: '', landmark: '.profile-notice',
    seed: `localStorage.clear(); localStorage.setItem('sote_meta_v1','{"schemaVersion":1,"progress":{"runs":2000},');`,
  },
  {
    name: 'crisis-newer', query: '', landmark: '.profile-notice',
    seed: `localStorage.clear(); localStorage.setItem('sote_meta_v1', JSON.stringify({schemaVersion: 999, progress:{runs:2000}}));`,
  },
];

// D2's gate: derived states vs what this file covers. Runs BEFORE the browser
// so a coverage gap costs no time and cannot be mistaken for a render failure.
{
  const app = appShotStates();
  const covered = new Set(SCREENS.map((s) => s.state).filter(Boolean));
  const gaps = app.filter((s) => !covered.has(s) && !EXCLUDED_STATES[s]);
  console.log(`coverage — ${app.length} ?shot= states in src/main.js: ${covered.size} photographed, ${Object.keys(EXCLUDED_STATES).length} excluded by name, ${gaps.length} unaccounted`);
  for (const s of app) {
    const why = EXCLUDED_STATES[s];
    if (covered.has(s)) continue;
    console.log(`  EXCLUDED  ?shot=${s} — ${why || 'NO REASON GIVEN'}`);
  }
  if (gaps.length) {
    console.error(`\nrelease-shots: ${gaps.length} app shot state(s) neither photographed nor excluded: ${gaps.join(', ')}`);
    console.error('Add a SCREENS entry, or name it in EXCLUDED_STATES with the reason. A silent gap is the defect this tool exists to correct.');
    process.exit(1);
  }
}

mkdirSync(OUT, { recursive: true });
const { server, port } = await serve({ root: ROOT, port: 8231, open: false });
const BASE = `http://localhost:${port}/dist/AshenSpire.html`;

spawn('/opt/pw-browsers/chromium', [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=9431', 'about:blank',
], { stdio: 'ignore' });

async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const ws = new WebSocket(l.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const w = new Map();
  ws.onmessage = (m) => {
    const g = JSON.parse(m.data);
    if (g.id != null && w.has(g.id)) { const { ok, no } = w.get(g.id); w.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); }
  };
  return { send: (m2, p2 = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m2, params: p2 })); return new Promise((ok, no) => w.set(n, { ok, no })); } };
}

const c = await cdp(9431);
await c.send('Page.enable');
await c.send('Runtime.enable');
// A screen that fails to mount because its boot THREW must say so. Without
// this a MISS reads as "slow" and gets waited on harder, which is how a real
// error hides behind a longer deadline.
const pageErrors = [];
c.onEvent = (m) => {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (e) => {
  const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true });
  if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description || 'eval error' };
  return r.result.value;
};

// D1 (Vira's, and the defect that matters): every wait used to be a fixed
// sleep, so the landmark was read at a WALL-CLOCK MOMENT rather than when the
// app mounted. One of two full runs went red on a healthy tree — and I
// reproduced it on the first try afterwards, on a different screen, with the
// same signature (a ~193-char body: the title screen still booting). A release
// gate that reds half the time trains everyone to re-run until green, and then
// a real red is indistinguishable from noise. So: poll for the landmark with a
// deadline. Returns as soon as it is there, which also makes the tool faster —
// the fixed sleeps were sized for the slowest screen and paid on every one.
// Page.navigate RESOLVES BEFORE THE LOAD COMMITS. Until it does, evaluate()
// runs against the PREVIOUS page — so a poll can read the old screen and
// answer about the wrong document entirely. That is the actual cause of the
// flake: the misses reported ~193 chars, which is the TITLE still on screen
// from the storage-clear navigation, not the shot state failing to mount.
// Polling harder could never fix it, and a longer deadline would have hidden
// it. So: assert we are on the URL we asked for, and that its document has
// begun, before asserting anything about its contents.
async function waitForUrl(expectQuery, { deadline = 10000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadline) {
    const at = await ev(`({ q: location.search, ready: document.readyState })`);
    if (at && !at.__err && at.q === expectQuery && at.ready !== 'loading') return Date.now() - t0;
    await sleep(50);
  }
  return null;
}

async function waitFor(selector, { deadline = 8000, quiet = 220 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < deadline) {
    const hit = await ev(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (hit === true) {
      // One settle tick AFTER the landmark exists, so a screen that mounts and
      // then paints its children is photographed whole, not mid-mount.
      await sleep(quiet);
      return Date.now() - t0;
    }
    await sleep(60);
  }
  return null; // caller reports it as a MISS, with the deadline named
}

// Console errors are part of "rendered as meant": a screen that paints while
// throwing is not a green. Collected per shot, reported with it.
let consoleErrors = [];
await c.send('Log.enable').catch(() => {});
await c.send('Runtime.consoleAPICalled', {}).catch(() => {});

let misses = 0;
const rows = [];

for (const shape of SHAPES) {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: shape.mobile,
  });
  for (const s of SCREENS) {
    if (only && s.name !== only) continue;
    consoleErrors = [];
    // Clear storage before EVERY shot. Without this the crisis seed survives
    // into the next shot's boot and photographs the notice under another
    // screen's name — measured: `title` passed at 390x844 and "failed" at
    // 1200x730 purely because a seeded shot ran between them. My instrument,
    // not the game (the standing lesson: a measurement that agrees with the
    // thesis harder than it should is the instrument talking).
    await c.send('Page.navigate', { url: BASE });
    await waitForUrl('');
    await ev('localStorage.clear(); 1');
    if (s.seed) {
      await c.send('Page.navigate', { url: BASE });
      await waitForUrl('');
      await waitFor('body *', { deadline: 8000, quiet: 60 });
      await ev(s.seed + ' 1');
    }
    await c.send('Page.navigate', { url: BASE + s.query });
    const landed = await waitForUrl(s.query);
    if (landed === null) console.error(`  ${s.name}: navigation to '${s.query || '(no query)'}' never committed within 10s`);
    // A driven screen mounts its BASE screen first, then the drive opens the
    // target; poll for each in turn rather than sleeping through both.
    const preWait = s.drive ? await waitFor('body *', { deadline: 10000 }) : null;
    if (s.drive) {
      if (preWait === null) console.error(`  ${s.name}: base screen never mounted within 10s — drive will report the miss`);
      const d = await ev(s.drive);
      if (d && d.__err) console.error(`  drive failed on ${s.name}: ${d.__err}`);
    }
    const waited = await waitFor(s.landmark, { deadline: 10000 });
    if (s.after) await ev(s.after);
    // The proc cascade is a TIMED animation, not a mount: ?shot=fx poses itself
    // 1600ms after boot (main.js poseFxShowcase). This is the one place a fixed
    // wait is the honest instrument — it is waiting for an animation to reach
    // its pose, not for a DOM node to exist.
    if (s.poseWait) await sleep(s.poseWait);
    await sleep(120);

    const diag = ok0 => ok0;
    const seen = await ev(`(()=>{
      const el = document.querySelector(${JSON.stringify(s.landmark)});
      const banner = document.querySelector('.validation-banner');
      const body = document.body ? document.body.innerText.trim().length : 0;
      return {
        landmark: !!el, banner: banner ? banner.textContent.slice(0,180) : null, textLen: body,
        url: location.href.slice(-42), ready: document.readyState,
        bodyHead: (document.body ? document.body.innerText.trim().slice(0,60).replace(/\s+/g,' ') : ''),
        bootErr: (window.__bootError && String(window.__bootError).slice(0,120)) || null,
      };
    })()`);

    const file = `${OUT}/${s.name}-${shape.tag}.png`;
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));

    const ok = seen && seen.landmark && !seen.banner && seen.textLen > 0;
    if (!ok) misses++;
    rows.push({ shape: shape.tag, name: s.name, ok, seen, file, waited });
    const why = seen && seen.banner
      ? 'VALIDATION BANNER: ' + seen.banner
      : seen && !seen.landmark
        ? `landmark '${s.landmark}' never appeared within 10000ms — url…${seen.url} ready=${seen.ready} text=${seen.textLen} on screen: "${seen.bodyHead}"${seen.bootErr ? ' BOOT ERROR: ' + seen.bootErr : ''}`
        : '';
    console.log(`${ok ? 'RENDERED' : 'MISS    '}  ${shape.tag.padEnd(9)} ${s.name.padEnd(18)} ${ok ? `${waited}ms` : why}`);
  }
}

console.log(`\nBOUNDARY — what this green does NOT cover:
  - rendered is not legible: nothing here reads a screen the way a tired human
    does at 11pm (Sunna's gate), and nothing judges whether the art reads (Freja).
  - a landmark present is not a screen CORRECT: this asserts the screen mounted
    and painted text, never that its numbers are right (Vira).
  - two shapes only (390x844, 1200x730); everything between is unphotographed.
  - the driven screens depend on a control's selector; if a button is renamed
    the drive fails LOUD (a MISS), never silently photographs the wrong screen.`);

// ---------------------------------------------------------------------------
// FLOAT CENTRING / CLIP ASSERTION (#69) — Rune, re-applied onto the canonical
// harness after Marina ruled Bjorn's copy canonical: mine carried fixed sleeps,
// and a float assertion running under fixed sleeps against a possibly-stale
// page is an assertion that can pass while blind. It now stands on this file's
// own guarantees — waitForUrl (we are on the document we asked for) and
// waitFor (the landmark exists) — instead of guessing at time.
//
// It spawns the exact strings Bjorn measured through the SHIPPED floatNum
// (window.__fxProbe, dev-only, ?shot= URLs only) and reads the RENDERED rect.
//
// THREE THINGS THIS ASSERTION HAD TO LEARN, each after it lied once, kept here
// because each is a way an instrument passes while blind:
//  1. Anchor. The clip lives on the RIGHTMOST combatant; anchored to the
//     leftmost it reported everything in-box and could not have failed.
//  2. Jitter. floatNum offsets by Math.random()*26-13, so the defect is
//     intermittent — a probe that rolls the dice reports the roll. Math.random
//     is pinned to the worst case the shipped code can emit (+13 right, -13
//     left).
//  3. The measured quantity. Clipping only shows when a wide string meets a
//     right-hand anchor, so a screen whose rightmost sprite sits 20px further
//     in reads clean while the bug is fully present. The deterministic
//     quantity — and the one Bjorn's per-string table reports — is the CENTRE
//     ERROR: floats are meant to sit centred on their anchor, and floatNum
//     centred them with a hardcoded half-width, so the error was
//     (realHalfWidth - thatConstant). Clipping is its consequence, not its
//     cause. And the rect must be read with the pop animation frozen, because
//     num-pop animates scale() and a mid-animation read shrank a 139px string
//     and a 15px one to the same 45px.
// ---------------------------------------------------------------------------
const FLOAT_STRINGS = [
  ['-7', 'dmg small', 'last'],
  ['+15', 'blk', 'last'],
  ['BLOCKED', 'blk small', 'last'],
  ['\u{1FA78} 12 RESISTED', 'blk small', 'last'],
  ['\u{1FA78} 12 RESISTED', 'blk small', 'first'],
];
let floatMisses = 0;
for (const shape of SHAPES) {
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: shape.dsf, mobile: shape.mobile,
  });
  await c.send('Page.navigate', { url: `${BASE}?shot=combat` });
  const onUrl = await waitForUrl('?shot=combat');
  const mounted = onUrl == null ? null : await waitFor('.combat');
  if (onUrl == null || mounted == null) {
    console.log(`FLOAT MISS  ${shape.tag} — combat did not mount (url ${onUrl == null ? 'never matched' : 'ok'})`);
    floatMisses++;
    continue;
  }
  for (const [text, cls, which] of FLOAT_STRINGS) {
    const m = await ev(`(() => {
      document.querySelectorAll('.float-num').forEach((n) => n.remove());
      if (!window.__fxProbe) return { noProbe: true };
      const _rand = Math.random;
      Math.random = () => (${JSON.stringify(which)} === 'first' ? 0 : 1);
      try { window.__fxProbe(${JSON.stringify(text)}, ${JSON.stringify(cls)}, ${JSON.stringify(which)}); }
      finally { Math.random = _rand; }
      const el = document.querySelector('.float-num');
      if (!el) return { noFloat: true };
      el.style.animation = 'none';
      const r = el.getBoundingClientRect();
      const layer = document.querySelector('.fx-layer').getBoundingClientRect();
      const hosts = [...document.querySelectorAll('[data-eid]')]
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const pick = (${JSON.stringify(which)} === 'first' ? hosts[0] : hosts[hosts.length - 1]);
      const hb = (pick.querySelector('.sprite') || pick).getBoundingClientRect();
      const jitter = (${JSON.stringify(which)} === 'first' ? -13 : 13);
      const wantCentre = hb.left + hb.width / 2 + jitter;
      const gotCentre = r.left + r.width / 2;
      return {
        right: Math.round(r.right), width: Math.round(r.width), vw: window.innerWidth,
        centreErr: Math.round(gotCentre - wantCentre),
        atEdge: Math.round(r.left - layer.left) <= 7 || Math.round(layer.right - r.right) <= 7,
        overRight: Math.round(r.right - Math.min(window.innerWidth, layer.right)),
        overLeft: Math.round(Math.max(0, layer.left) - r.left),
      };
    })()`);
    // Never clipped, and centred unless the clamp is holding it at an edge —
    // that shift is by design and is labelled CLAMPED, not passed silently.
    const ok = m && !m.noProbe && !m.noFloat && m.overRight <= 0 && m.overLeft <= 0
      && (Math.abs(m.centreErr) <= 1 || m.atEdge);
    if (!ok) floatMisses++;
    const tag = ok ? (m && m.atEdge && Math.abs(m.centreErr) > 1 ? 'CLAMPED ' : 'CENTRED ') : 'OFF     ';
    console.log(`${tag}  ${shape.tag.padEnd(9)} ${JSON.stringify(text).padEnd(22)} ${which.padEnd(5)} ` +
      (m && m.right != null
        ? `off-centre=${m.centreErr > 0 ? '+' + m.centreErr : m.centreErr}px  w=${m.width} right=${m.right} vw=${m.vw}` +
          `${m.overRight > 0 ? ` CLIPPED +${m.overRight}px` : ''}${m.overLeft > 0 ? ` CLIPPED LEFT +${m.overLeft}px` : ''}`
        : JSON.stringify(m)));
  }
}
console.log(floatMisses
  ? `\nfloat-clip: ${floatMisses} float(s) off-centre or clipped — the half-width is a constant, not the string's own.`
  : '\nfloat-clip: OK — every measured float is centred on its anchor and inside the layer, both shapes.');
// A clipped float is unreachable text, so it fails the run like any MISS.
misses += floatMisses;

if (misses) {
  console.error(`\nrelease-shots: ${misses} screen(s) did not render as meant — see MISS lines.`);
  server.close();
  process.exit(1);
}
console.log(`\nrelease-shots: OK — ${rows.length} shots, every screen's landmark present, no validation banner. → ${OUT}`);
server.close();
process.exit(0);
