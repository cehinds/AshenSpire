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
//   node tools/shotguard-probe.mjs                     both edges
//   node tools/shotguard-probe.mjs --defeat-gate       gate defeated  → must exit 1
//   node tools/shotguard-probe.mjs --mutate            same, inverted → must exit 0
//   node tools/shotguard-probe.mjs --selftest-unavailable
//                                                      prove exit 2 is reachable
//   --browser <path>            use this binary (how the unavailable cases are driven)
//   --acquire-timeout-ms <n>    ceiling on a cold start, default 60000
//
// EXIT CODES — three states, and the distinction is load-bearing:
//   0  the gate holds (or --mutate correctly saw it fail)
//   1  a check RAN and the gate did not hold
//   2  the instrument was unavailable → `unknown`, which blocks, but says nothing
//      about the gate. Never conflate 1 and 2; I did, and it failed this repo's
//      first CI run. See the block above unavailable().
//
// Zero dependencies: Node 22's global WebSocket speaks CDP directly.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day the ?shot=
// hook is removed from src/main.js, or the day the shot states stop booting a run
// at all (e.g. they are replaced by static fixtures) — with no run to persist
// there is nothing for this to guard. It is NOT removed merely because it has
// passed for a long time; a guard that has never failed is exactly what it was
// written to replace, which is why every verdict it can reach is triggerable:
//
//   --defeat-gate            rewrites src/main.js on the wire with the gate line
//                            deleted → a check runs and fails → exit 1
//   --mutate                 the same defeat, expectation inverted → exit 0
//   --selftest-unavailable   triggers all three unavailability branches → each 2
//
// Between them every exit code this tool produces is reachable on demand. A tool
// whose failure modes only ever appear by accident on someone else's machine is
// not evidence — and that is not hypothetical: run 1 of this repo's CI is where I
// learned it.

import { spawn, spawnSync } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
// Two separable things that --mutate used to conflate: DEFEATING the gate, and
// INVERTING the expectation. Split so each exit code is demonstrable on demand:
//   --defeat-gate            gate defeated, normal expectations  → must exit 1
//   --mutate                 gate defeated, inverted expectation → must exit 0
// Without the split, nothing in this repo could show that exit 1 is reachable at
// all, and "the guard can fail" would rest on a run that reports success.
const MUTATE = args.includes('--mutate');
const DEFEAT_GATE = MUTATE || args.includes('--defeat-gate');
const SELFTEST_UNAVAILABLE = args.includes('--selftest-unavailable');
function argVal(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
// Overridable so the unavailability paths can be exercised on demand — see
// --selftest-unavailable. A guard whose failure modes cannot be triggered is the
// thing this file exists to replace.
const BROWSER_OVERRIDE = argVal('--browser', null);
const ACQUIRE_TIMEOUT_MS = Number(argVal('--acquire-timeout-ms', '60000'));
// `--simulate alive-never-ready` spawns a process that stays up and never opens a
// debugging port: the exact CI failure, on demand, in three seconds. It exists
// because my first attempt at this case used /bin/sleep with no operand, which
// exits instantly — so it re-tested the DEATH path while claiming to test the
// TIMEOUT path, and reported OK. Two branches, one label, and the label was wrong.
const SIMULATE = argVal('--simulate', null);

// Declared here, not beside acquireCdpUrl(). `function` declarations hoist and
// `let` does not, so with this further down the file every acquisition failure
// threw `Cannot access 'acquireMs' before initialization` and exited 2 for the
// WRONG REASON — the right colour hiding a broken mechanism. Found by
// --selftest-unavailable on its first run, which is the entire argument for it.
let acquireMs = 0;

// ---------------------------------------------------------------------------
// THREE EXIT STATES, NOT TWO. This is the correction that matters most in this
// file, and it is a defect I shipped in my own probe on 2026-07-27:
//
//   0 — the gate holds (or, under --mutate, was correctly shown to fail)
//   1 — the GUARD'S VERDICT IS RED: a check ran and the gate did not hold
//   2 — the INSTRUMENT WAS UNAVAILABLE: `unknown`, which blocks, but is NOT a
//       statement about the gate
//
// The first CI run of this repository failed here, and it failed on exactly the
// distinction the file is built around. I handled "no Chrome binary" as exit 2 and
// then let "Chrome launched but had not opened its debugging port yet" fall
// through a `throw` to exit 1 — so a cold GitHub runner (server up 20:44:44.27,
// throw 20:44:59.33, and post-job cleanup then reported `Terminate orphan process:
// pid (2067) (chrome)`, i.e. Chrome was ALIVE) reported *the guard failed* when
// the truth was *the instrument was not ready*. The identical job passed 66
// seconds later. Same colour, opposite meaning — the silence-guard confusion my
// own workflow comment warns about, committed here.
//
// Every acquisition failure now routes through unavailable(), which cannot reach
// exit 1. A check must have RUN to make the run red.
// ---------------------------------------------------------------------------
function unavailable(reason, hint) {
  console.error(`\nshotguard: INSTRUMENT UNAVAILABLE — ${reason}`);
  console.error('  This is `unknown`, which blocks (SOP 2). It is NOT a failed check and NOT a pass:');
  console.error('  nothing was measured about the ?shot= gate either way.');
  if (hint) console.error(`  ${hint}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// --selftest-unavailable: prove the exit-2 path is real, on demand.
//
// Requirement from the failure above: a timeout raised until it stops firing is a
// guard graded by its author. So each unavailability branch gets a case that
// TRIGGERS it, and each must land on 2 — never 1, never 0. The third case
// reproduces the exact CI flake (a browser that is alive and never becomes ready)
// in about three seconds, instead of waiting for a cold runner to do it for us.
// ---------------------------------------------------------------------------
if (SELFTEST_UNAVAILABLE) {
  const self = fileURLToPath(import.meta.url);
  const dies = process.platform === 'win32' ? 'C:/Windows/System32/whoami.exe' : '/bin/false';
  const cases = [
    { label: 'browser path does not exist (never launched)', argv: ['--browser', '/nonexistent/chrome'], wantReason: /path does not exist/ },
    { label: 'browser launches and exits immediately (dead instrument)', argv: ['--browser', dies], needsHelper: true, wantReason: /exited after/ },
    { label: 'browser is ALIVE but never opens its port (the CI flake)', argv: ['--simulate', 'alive-never-ready', '--acquire-timeout-ms', '3000'], wantReason: /alive but never opened its debugging port/ },
  ];
  console.log('shotguard --selftest-unavailable: every case must exit 2 (unknown), never 1 (red) or 0 (green).\n');
  let bad = 0;
  let ran = 0;
  for (const c of cases) {
    // Case 1 REQUIRES a missing path — skipping it for being missing was the guard
    // inverted against its own case. Only the two helper-binary cases can skip.
    if (c.needsHelper && !existsSync(c.argv[1])) {
      console.log(`  SKIP  ${c.label} — no ${c.argv[1]} on this platform (unknown, not pass)`);
      continue;
    }
    ran++;
    const r = spawnSync(process.execPath, [self, ...c.argv], { encoding: 'utf8', timeout: 120000 });
    const ok = r.status === 2;
    console.log(`  ${ok ? 'OK  ' : 'BAD '} ${c.label} → exit ${r.status}${ok ? '' : ' (expected 2)'}`);
    const said = (r.stderr || '').split('\n').find((l) => l.includes('INSTRUMENT UNAVAILABLE')) || '';
    if (said) console.log(`        ${said.trim()}`);
    // An exit 2 whose reason is an internal error is the right colour for the
    // wrong cause — the TDZ bug above passed this check until I looked at the text.
    if (/before initialization|is not defined|is not a function/.test(said)) {
      console.log('        BAD — that reason is an internal error, not a diagnosis of the browser.');
      bad++;
    } else if (c.wantReason && !c.wantReason.test(said)) {
      // A case that lands on the right EXIT via the wrong BRANCH is the defect this
      // selftest was written for. Check the diagnosis, not just the colour.
      console.log(`        BAD — exit 2 but via the wrong branch; reason should match ${c.wantReason}`);
      bad++;
    } else if (!ok) bad++;
  }
  if (bad) {
    console.error(`\nshotguard --selftest-unavailable: ${bad} case(s) did not resolve to 2.`);
    console.error('  An unavailable instrument reading as red (1) or green (0) is the defect');
    console.error('  that failed this repo\'s first CI run. Fix the taxonomy, not the expectation.');
    process.exit(1);
  }
  // Count what actually ran. "all three" over two executed cases is the same
  // absence-as-result error this whole branch is about.
  console.log(`\nshotguard --selftest-unavailable: OK — ${ran} of ${cases.length} unavailability paths ran and all resolved to 2.`);
  if (ran < cases.length) console.log('  (skipped cases are `unknown` on this platform, not verified.)');
  process.exit(0);
}

const BROWSERS = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const browser = SIMULATE ? process.execPath : (BROWSER_OVERRIDE || BROWSERS.find((p) => existsSync(p)));
if (!browser) {
  unavailable('no Chrome/Chromium found on any known path',
    'Paths tried: ' + BROWSERS.join(', '));
}
if (!existsSync(browser)) {
  unavailable(`the browser path does not exist: ${browser}`);
}
if (SIMULATE && SIMULATE !== 'alive-never-ready') {
  unavailable(`unknown --simulate mode: ${SIMULATE}`, 'Only `alive-never-ready` exists.');
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
      'shotguard: the gate line is not in src/main.js as written:\n  ' + GATE_LINE +
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
// #12: the verdict must carry a COUNT of what ran, so the checks are counted
// where they happen rather than described afterwards.
let ranChecks = 0;
function check(name, ok, detail) {
  ranChecks += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

const { server, port } = await serve({ root: ROOT, port: 8127, open: false, lan: false });

// Port 0, not a hard-coded 9333. Two reasons, and the first is a flake I had not
// noticed until the port timing made me look: a fixed port collides with anything
// else on the runner holding it, and the failure mode of that collision is
// indistinguishable from "not ready yet". Port 0 lets the OS pick, and Chrome
// writes the real port into DevToolsActivePort in the profile directory — which is
// the race-free signal, because the file is created AFTER the port is listening.
let chromeExited = null;
// ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
// Chrome's own TMPDIR inside it, and removes it whatever happens. `awaitEndpoint`
// is off because this probe reads DevToolsActivePort out of the profile itself
// rather than off stderr.
//
// SIMULATE IS NOT ROUTED THROUGH THE LAUNCHER, DELIBERATELY. `--simulate` runs a
// bare node process that is alive and never ready — it is a stand-in for a
// browser, not a browser, it takes no `--user-data-dir`, and it has no profile to
// leak. Sending it through the launcher would mean handing node Chrome's flags.
let chrome; let dropBrowser = () => {};
// A path that is never created, so `DevToolsActivePort` never appears under it —
// which is exactly what the old SIMULATE run measured, with a real empty dir.
let profile = join(tmpdir(), 'shotguard-simulate-has-no-profile');
if (SIMULATE) {
  // Alive, quiet, and it will never write DevToolsActivePort nor announce a port.
  chrome = spawn(browser, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'pipe', 'pipe'] });
} else {
  const b = await launchBrowser({
    prefix: 'shotguard-', browser, headless: '--headless=new', awaitEndpoint: false,
    args: ['--remote-debugging-port=0'],
  });
  chrome = b.child; profile = b.profile; dropBrowser = b.close;
}
let chromeErr = '';
chrome.stderr.on('data', (d) => { chromeErr += d; });
chrome.on('exit', (code, sig) => { chromeExited = { code, sig }; });
chrome.on('error', (e) => { chromeExited = { code: null, sig: null, spawnError: e.message }; });

// One cleanup, called from both the unavailable path and the normal finally. The
// CI log said `Terminate orphan process: pid (2067) (chrome)` — my exit path left
// a browser running. Leaking a process while reporting a verdict is its own small
// dishonesty about what the run did.
function cleanup() {
  try { ws && ws.close(); } catch { /* already gone */ }
  dropBrowser();
  try { server.close(); } catch { /* already closed */ }
}

let ws;
let wsUrl;
try {
  wsUrl = await acquireCdpUrl();
} catch (e) {
  // Acquisition can only ever be `unknown`. It must not reach exit 1.
  const stderrTail = chromeErr.trim() ? 'browser stderr (last 2 lines): ' + chromeErr.trim().split('\n').slice(-2).join(' | ') : undefined;
  cleanup();
  unavailable(String(e.message), stderrTail);
}
try {
  ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket failed')); });

  const { targetId } = await cdp(ws, 'Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId, flatten: true });
  await cdp(ws, 'Page.enable', {}, sessionId);
  await cdp(ws, 'Runtime.enable', {}, sessionId);

  if (DEFEAT_GATE) await installSourceMutation(ws, sessionId);

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
  cleanup();
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
console.log(`  · TIMING, and this is the boundary that bit me: acquiring CDP took`);
console.log(`    ${acquireMs} ms here, against a ${ACQUIRE_TIMEOUT_MS} ms budget. Every local run I`);
console.log('    simulated had a WARM browser at a known path; a cold CI runner does not,');
console.log('    and this repo\'s first workflow run failed on exactly that. A pass here is');
console.log('    not evidence about how long a cold start takes on some other machine.');

if (MUTATE) {
  // Inverted expectation: with the gate defeated, the probe MUST report failures.
  if (failures.length === 0) {
    console.error('\nshotguard --mutate: the gate was defeated and the probe still passed.');
    console.error('  A guard that cannot fail is not evidence. Fix the probe, not the expectation.');
    process.exit(1);
  }
  // ONE TERMINATED VERDICT LINE, COUNTED (#12). The old wording carried the
  // word "failed" with a number — true of the planted run and unreadable as a
  // success by any honest reader, human or machine.
  console.log(`\nshotguard --mutate: OK — ${failures.length} defeat(s) planted, ${failures.length} caught.`);
  for (const f of failures) console.log(`    · ${f}`);
  process.exit(0);
}

if (failures.length) {
  console.error(`\nshotguard: ${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nshotguard: OK — ${ranChecks} checks passed; ?shot= cannot reach the player's save, and a normal boot still can.`);
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
      console.log('  (gate defeated: rewrote src/main.js on the wire, gate line deleted)');
      await cdp(sock, 'Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'text/javascript' }],
        body: Buffer.from(mutated, 'utf8').toString('base64'),
      }, session);
    } catch (e) {
      console.error('  (gate-defeat rewrite failed: ' + e.message + ')');
      try { await cdp(sock, 'Fetch.continueRequest', { requestId }, session); } catch {}
    }
  });
}

// ---------------------------------------------------------------------------
// Acquire the CDP endpoint. Replaces a blind 60 x 250ms poll of a hard-coded port,
// which is what timed out at 15.06s on this repo's first CI run.
//
// Three signals instead of one, so the wait ends for the RIGHT reason:
//   1. DevToolsActivePort in the profile dir — Chrome writes it after the port is
//      listening, so its appearance is the authoritative ready signal. Line 1 is
//      the port, line 2 the browser ws path.
//   2. "DevTools listening on ws://…" on stderr — the same fact by another route;
//      kept because it survives a profile dir we cannot read.
//   3. The child exiting — if the browser is DEAD, waiting out the budget tells us
//      nothing we do not already know. Bail immediately.
//
// The budget went 15s → 60s, but note what the budget is now FOR: with a real
// ready signal it is only the ceiling on a genuinely slow cold start, not the
// thing we are relying on to detect readiness. Raising a timeout until it stops
// firing would be the author grading his own guard — which is why
// --selftest-unavailable exists and triggers this path on purpose.
// ---------------------------------------------------------------------------
async function acquireCdpUrl() {
  const started = Date.now();
  const portFile = join(profile, 'DevToolsActivePort');
  while (Date.now() - started < ACQUIRE_TIMEOUT_MS) {
    if (chromeExited) {
      acquireMs = Date.now() - started;
      const how = chromeExited.spawnError
        ? `could not be spawned (${chromeExited.spawnError})`
        : `exited after ${acquireMs} ms with code ${chromeExited.code}${chromeExited.sig ? ` / signal ${chromeExited.sig}` : ''}`;
      throw new Error(`the browser ${how} — it never became a usable instrument`);
    }
    // Signal 1: the port file.
    try {
      const lines = readFileSync(portFile, 'utf8').split('\n');
      if (lines.length >= 2 && lines[0].trim()) {
        const url = await versionWs(Number(lines[0].trim()));
        if (url) { acquireMs = Date.now() - started; return url; }
      }
    } catch { /* not written yet */ }
    // Signal 2: Chrome's own announcement on stderr.
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(chromeErr);
    if (m) { acquireMs = Date.now() - started; return m[1]; }
    await new Promise((res) => setTimeout(res, 100));
  }
  acquireMs = Date.now() - started;
  throw new Error(
    `the browser was alive but never opened its debugging port within ${ACQUIRE_TIMEOUT_MS} ms ` +
    `(waited ${acquireMs} ms). This is the cold-start case, not a verdict about the gate.`
  );
}

async function versionWs(devtoolsPort) {
  try {
    const r = await fetch(`http://127.0.0.1:${devtoolsPort}/json/version`);
    if (r.ok) return (await r.json()).webSocketDebuggerUrl;
  } catch { /* listening but not answering yet */ }
  return null;
}
