#!/usr/bin/env node
// tools/shotguard-probe.mjs — prove, in a real browser, that a ?shot= boot cannot
// write to the player's durable save, and that a normal boot still can.
//
// WHY A BROWSER AND NOT A UNIT TEST
// --------------------------------
// The defect was a URL reaching localStorage: `?shot=map` wrote
// settings.seenTutorial into sote_meta_v1 and then newRun({slot:1}) →
// startClimb() → persist() → saveRun(run, rng, 1) overwrote sote_run_v1. Nothing
// about that is reachable from Node — it needs `location.search`, a real
// `window.localStorage`, and the module graph actually booting. A unit test here
// would assert my own mock, which is the shape of evidence this branch exists to
// delete.
//
// HOW IT MEASURES
// --------------
// CDP `Page.addScriptToEvaluateOnNewDocument` installs a recorder BEFORE any page
// script runs, wrapping localStorage.setItem/removeItem and logging every key.
// So we observe writes directly, rather than comparing before/after values — a
// write of identical bytes would pass a value comparison and is still a write.
//
// The discriminator is `sote_probe`: pickStorage() sets and removes it to test
// that localStorage is usable. Its presence in the log means localStorage was
// chosen; its absence means the memory stub was.
//
//   node tools/shotguard-probe.mjs              # both edges, exit 1 on failure
//   node tools/shotguard-probe.mjs --keep-open  # leave the browser up to poke at
//
// Zero dependencies: Node 22's global WebSocket speaks CDP directly.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day the ?shot=
// hook is removed from src/main.js, or the day the shot states stop booting a run
// at all (e.g. they are replaced by static fixtures) — with no run to persist
// there is nothing for this to guard. It is NOT removed merely because it has
// passed for a long time; a guard that has never failed is exactly what it was
// written to replace, which is why --mutate below exists.
//
//   node tools/shotguard-probe.mjs --mutate
// re-runs the ?shot= edge with the gate defeated in-page (localStorage forced as
// the store) and requires the probe to FAIL. A run of this tool that cannot fail
// is not evidence.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const MUTATE = args.includes('--mutate');

const BROWSERS = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  // Unreachable instrument is `unknown`, and unknown blocks. It is NOT a pass.
  console.error('shotguard: no Chrome/Chromium found — cannot verify. This is unknown, not green.');
  process.exit(2);
}

// A sentinel save the game itself would never write, so any surviving byte is
// provably ours and any overwrite is provably the game's.
const SENTINEL_RUN = JSON.stringify({ sentinel: 'rune-shotguard-run', schemaVersion: -1 });
const SENTINEL_META = JSON.stringify({ sentinel: 'rune-shotguard-meta', settings: {}, results: [] });

// Patch Storage.PROTOTYPE, not the localStorage instance. A Storage object is an
// exotic legacy platform object: its [[DefineOwnProperty]] stores an ITEM, so
// `Object.defineProperty(localStorage, 'setItem', …)` silently writes a
// localStorage entry called "setItem" and leaves the real method untouched. My
// first cut did exactly that and reported "no writes observed" on both edges —
// an instrument that says clean over a tree it never opened. Recorded here
// because the failure is invisible and the next reader would repeat it.
const RECORDER = `
  window.__writes = [];
  (function () {
    const P = Storage.prototype;
    const set = P.setItem, del = P.removeItem, clr = P.clear;
    // Storage.prototype is shared with sessionStorage; only durable writes count.
    const mine = (t) => t === window.localStorage;
    P.setItem = function (k, v) { if (mine(this)) window.__writes.push(['set', String(k)]); return set.call(this, k, v); };
    P.removeItem = function (k) { if (mine(this)) window.__writes.push(['del', String(k)]); return del.call(this, k); };
    P.clear = function () { if (mine(this)) window.__writes.push(['clear', '*']); return clr.call(this); };
    window.__recorderInstalled = true;
  })();
`;

// THE MUTATION — how this probe proves it can fail.
//
// Not an in-page monkeypatch: the fix reads the query string exactly ONCE and
// both the storage gate and the shot hook share that const, so nothing in-page
// can defeat the gate without also disabling the hook. (That the mutation is hard
// to write is the collapse working.) So the mutation happens at the network
// layer: CDP Fetch interception rewrites the src/main.js the BROWSER executes,
// deleting the gate line, while the file on disk is untouched.
//
// This is the pre-fix code path, byte-for-byte, and the probe must report
// failures against it. If it does not, the probe is decoration.
const GATE_LINE = '  if (shotState) return createMemoryStorage();';
function mutateSource(body) {
  if (!body.includes(GATE_LINE)) {
    throw new Error(
      'shotguard --mutate: the gate line is not in src/main.js as written:\n  ' + GATE_LINE +
      '\n  Refusing to run — a mutation that mutates nothing would report a false PASS.'
    );
  }
  return body.replace(GATE_LINE, '  /* GATE REMOVED BY --mutate */');
}

let cdpId = 0;
function cdp(ws, method, params, sessionId) {
  return new Promise((done, fail) => {
    const id = ++cdpId;
    const onMsg = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.id !== id) return;
      ws.removeEventListener('message', onMsg);
      if (m.error) fail(new Error(`${method}: ${m.error.message}`));
      else done(m.result);
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params || {}, sessionId }));
  });
}

async function waitLoad(ws, session, url, timeoutMs = 20000) {
  const done = new Promise((res) => {
    const onMsg = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.sessionId === session && m.method === 'Page.loadEventFired') {
        ws.removeEventListener('message', onMsg);
        res();
      }
    };
    ws.addEventListener('message', onMsg);
  });
  await cdp(ws, 'Page.navigate', { url }, session);
  await Promise.race([done, new Promise((r) => setTimeout(r, timeoutMs))]);
}

async function evalIn(ws, session, expr) {
  const r = await cdp(ws, 'Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  }, session);
  if (r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails.text));
  return r.result.value;
}

const failures = [];
function check(name, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const { server, port } = await serve({ root: ROOT, port: 8127, open: false, lan: false });
const profile = mkdtempSync(join(tmpdir(), 'shotguard-'));
const chrome = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=9333', `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let ws;
try {
  const wsUrl = await discoverWs();
  ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket failed')); });

  const { targetId } = await cdp(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await cdp(ws, 'Page.enable', {}, sessionId);
  await cdp(ws, 'Runtime.enable', {}, sessionId);

  if (MUTATE) await installSourceMutation(ws, sessionId);

  const origin = `http://localhost:${port}/`;

  // ---- Seed the durable save on the app's own origin -----------------------
  await waitLoad(ws, sessionId, origin + '?shot=map'); // any boot to reach the origin
  await evalIn(ws, sessionId, `
    localStorage.clear();
    localStorage.setItem('sote_run_v1', ${JSON.stringify(SENTINEL_RUN)});
    localStorage.setItem('sote_meta_v1', ${JSON.stringify(SENTINEL_META)});
    'seeded'`);

  // ---- Edge A: ?shot= must not write at all --------------------------------
  const { identifier } = await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: RECORDER }, sessionId);
  await waitLoad(ws, sessionId, origin + '?shot=map');
  await new Promise((r) => setTimeout(r, 2500)); // let the seeded run build + persist
  const shotEdge = await evalIn(ws, sessionId, `({
    installed: !!window.__recorderInstalled,
    writes: window.__writes || [],
    run: localStorage.getItem('sote_run_v1'),
    meta: localStorage.getItem('sote_meta_v1'),
    booted: !!document.querySelector('#app') && document.querySelector('#app').children.length > 0,
  })`);

  const wroteKeys = shotEdge.writes.map((w) => w.join(' '));
  // The silence guard, on my own instrument: "zero writes observed" and "the
  // recorder never ran" look identical and mean the opposite. Prove the referent
  // resolves before reading an empty result as clean.
  check('the write recorder actually installed', shotEdge.installed,
    shotEdge.installed ? 'Storage.prototype patched' : 'NOT INSTALLED — every "no writes" below is unknown, not green');
  check('?shot=map boots something (the hook still works)', shotEdge.booted,
    `#app children present: ${shotEdge.booted}`);
  check('?shot=map performs ZERO localStorage writes', shotEdge.writes.length === 0,
    wroteKeys.length ? `observed: ${wroteKeys.join(', ')}` : 'none observed');
  check('?shot=map leaves sote_run_v1 byte-identical', shotEdge.run === SENTINEL_RUN,
    shotEdge.run === SENTINEL_RUN ? 'sentinel intact' : `now: ${String(shotEdge.run).slice(0, 70)}`);
  check('?shot=map leaves sote_meta_v1 byte-identical', shotEdge.meta === SENTINEL_META,
    shotEdge.meta === SENTINEL_META ? 'sentinel intact' : `now: ${String(shotEdge.meta).slice(0, 70)}`);
  check('?shot=map never selected localStorage (no sote_probe)',
    !wroteKeys.some((k) => k.includes('sote_probe')),
    'sote_probe is pickStorage()\'s own usability test — its absence is the memory stub');

  // ---- Edge B: a normal boot must still use localStorage -------------------
  // The other edge, and the one that makes the fix a gate rather than a deletion:
  // if this passed too, I would have disabled saving for everyone.
  await evalIn(ws, sessionId, `localStorage.clear(); 'cleared'`);
  await waitLoad(ws, sessionId, origin);
  await new Promise((r) => setTimeout(r, 1500));
  const normalEdge = await evalIn(ws, sessionId, `({ installed: !!window.__recorderInstalled, writes: window.__writes || [] })`);
  const normalKeys = normalEdge.writes.map((w) => w.join(' '));
  check('the write recorder installed on the normal boot too', normalEdge.installed);
  check('normal boot DOES select localStorage (sote_probe set then removed)',
    normalKeys.includes('set sote_probe') && normalKeys.includes('del sote_probe'),
    normalKeys.length ? `observed: ${normalKeys.join(', ')}` : 'no writes observed');

  await cdp(ws, 'Page.removeScriptToEvaluateOnNewDocument', { identifier }, sessionId);
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

// ---- Boundary, printed by the run itself (SOP 3 requirement 4) -------------
console.log('');
console.log('BOUNDARY — what this green does NOT cover:');
console.log('  · only ?shot=map was driven; the other 9 states in tools/screenshot.mjs');
console.log('    share the same storage seam by construction, not by observation here');
console.log('  · nothing about whether the SHOT ITSELF still photographs correctly —');
console.log('    that is `node tools/screenshot.mjs` and a human looking at the PNGs');
console.log('  · one browser (Chromium), one platform (this runner)');
console.log('  · says nothing about the tutorial lockout, which is a different branch');

if (MUTATE) {
  // Inverted expectation: with the gate defeated, the probe MUST report failures.
  if (failures.length === 0) {
    console.error('\nshotguard --mutate: the gate was defeated and the probe still passed.');
    console.error('  A guard that cannot fail is not evidence. Fix the probe, not the expectation.');
    process.exit(1);
  }
  console.log(`\nshotguard --mutate: OK — gate defeated, probe correctly failed ${failures.length} check(s):`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(0);
}

if (failures.length) {
  console.error(`\nshotguard: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('\nshotguard: OK — ?shot= cannot reach the player\'s save; a normal boot still can.');
process.exit(0);

// Intercept src/main.js on the wire and serve the pre-fix body. The disk is never
// touched, so a crash cannot leave a mutated source tree behind — which is why
// this is done here and not with a temp file.
async function installSourceMutation(sock, session) {
  await cdp(sock, 'Fetch.enable', { patterns: [{ urlPattern: '*/src/main.js', requestStage: 'Response' }] }, session);
  sock.addEventListener('message', async (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.method !== 'Fetch.requestPaused' || m.sessionId !== session) return;
    const { requestId } = m.params;
    try {
      const got = await cdp(sock, 'Fetch.getResponseBody', { requestId }, session);
      const body = got.base64Encoded ? Buffer.from(got.body, 'base64').toString('utf8') : got.body;
      const mutated = mutateSource(body);
      console.log('  (--mutate: rewrote src/main.js on the wire, gate line deleted)');
      await cdp(sock, 'Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'text/javascript' }],
        body: Buffer.from(mutated, 'utf8').toString('base64'),
      }, session);
    } catch (e) {
      console.error('  (--mutate failed to rewrite: ' + e.message + ')');
      try { await cdp(sock, 'Fetch.continueRequest', { requestId }, session); } catch {}
    }
  });
}

async function discoverWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9333/json/version');
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error('Chrome never opened its debugging port');
}
