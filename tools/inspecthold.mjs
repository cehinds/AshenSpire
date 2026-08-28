// tools/inspecthold.mjs — hold-to-inspect on the hand, observed: a read can
// happen, and a read can NEVER become a play.
//
// WHAT IT CHECKS, per shape (the disambiguation triangle, all three corners,
// plus the restore):
//   1. rest: every hand card is marked data-inspect="idle" (the gesture is
//      armed, readable by instrument and screenshot alike)
//   2. TAP corner: a quick tap on a targetable card still SELECTS it — the
//      pre-inspect behaviour, untouched
//   3. MID-HOLD: a stationary press reads data-inspect="pending" with no
//      expanded copy in the DOM — the attribute is the observation, so no
//      camera ever has to race a 400 ms window (the same-door note below)
//   4. INSPECT corner: past the dial the card expands — .card-inspect on
//      <body>, scaled visibly past the source card — and discard/energy are
//      UNCHANGED: the read cost nothing
//   5. restore: release removes the copy entirely, the card returns to idle,
//      state still unchanged, and the NEXT tap works (no swallowed tap —
//      Vira's F3 shape, checked here because this gesture swallows one click
//      by design and must swallow exactly that one)
//   6. abandon: movement past the shared 12 px boundary mid-pending hands the
//      press to the drag (ghost appears, inspect back to idle)
//   7. DRAG corner: a careful drag — 150 ms stationary, then onto an enemy —
//      still PLAYS the card (discard +1): the timer did not eat the game's
//      primary verb
//   8. reading is not gated on affordability: with energy forced to 0 (via
//      the window.__combat debug handle — the ONE state setup that does not
//      enter by the finger, named here rather than hidden) a hold on an
//      unaffordable card still expands
//   9-14. THE SAME GESTURE WITHOUT A POINTER (S7) — the keyboard cell and the
//      pad cell, each running the whole triangle: rest, mid-hold, open,
//      the read cost nothing, restore, and the TAP corner. See below.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE GREW TWO MORE INPUTS, AND WHAT IT COULD NOT SEE BEFORE.
//
// Constantine, 2026-08-17: "if press to hold is active for certain things for
// mouse or game pad, it shoudl apply to everything including keyboard as well
// for those same buttons." (S7.)
//
// EVERY CHECK 1-8 ABOVE IS A POINTER CHECK, and all fourteen of them were green
// on a tree where a keyboard player could not read a card at all. MEASURED at
// dev b968e28, ?shot=combat 1200x730, the focus cursor on a hand card, Enter
// held 750 ms against a 400 ms dial: data-inspect never left `idle`, zero
// `.card-inspect` copies, AND THE CARD WAS SELECTED ON KEYDOWN. That absence is
// the finding this section exists for — an instrument that samples one input
// cannot tell you the gesture is a mouse feature.
//
// THE TWO DOORS, AND THEY ARE NOT THE SAME DEPTH — said plainly rather than
// both being called "real input":
//   keyboard  Input.dispatchKeyEvent — the same CDP door the touch checks use,
//             one layer above the page. Real keyDown/keyUp, and the hold is
//             driven with real `autoRepeat` keydowns because A HELD KEY IS NOT
//             ONE KEYDOWN: an OS sends the first and then a ~30 Hz stream, each
//             carrying `ev.repeat`. A harness that omits them measures a key
//             nobody holds. Arrows drive the real focus cursor.
//   gamepad   navigator.getGamepads, SHIMMED. There is NO CDP domain that
//             synthesizes a pad, so this is the deepest door a headless box
//             has: input.js's poller reads that function and nothing else, and
//             the shim is installed with Page.addScriptToEvaluateOnNewDocument
//             so it is present before the app boots, exactly as a plugged-in
//             pad would be. WHAT IT THEREFORE CANNOT SEE: driver mapping,
//             analog thresholds, and the browser's own gamepad plumbing.
//             A green pad cell is a claim about this game's poller, never
//             about a physical controller.
// The shim is installed only for the pad cell and torn down after it: a pad
// visible during checks 1-8 would put the page in pad-mode and change the very
// hand those checks measure.
//
// WHY THE MODE AXIS RIDES ALONG UNCHANGED. Modes exist because `overlap`
// occludes a card's centre and a finger must aim at the exposed strip. A focus
// cursor does not aim — it names an element — so these cells have no aim point
// to get wrong. They still run in every cell rather than being argued out of
// three of them, because that argument is exactly the kind that turns out to be
// wrong about the ghost's size cap on the narrow shape.
//
// WHAT IS STILL POINTER-ONLY, AND IT IS NOT AN OVERSIGHT: the abandon corner
// (check 6) and the drag corner (check 7). Both are defined by MOVEMENT past
// the shared 12 px boundary, and neither a key nor a pad button has coordinates
// to move. The gesture door hands a key press the control's own centre, so slop
// can never fire. There is nothing to sample, not a cell nobody wrote.
//
// Usage
//   node tools/inspecthold.mjs                     source tree via serve.mjs
//   node tools/inspecthold.mjs --selftest          the RE-RUNNABLE known-bad (below)
//   node tools/inspecthold.mjs --root DIR          another tree (the known-bad run)
//   node tools/inspecthold.mjs --only 390x844
//   node tools/inspecthold.mjs --mode overlap      one arm of the hand-layout
//                                                  word (default: both, so the
//                                                  corpus is 2 shapes x 2 modes)
//   node tools/inspecthold.mjs --shots DIR         also write the four 390x844
//                                                  screenshots (rest, mid-hold,
//                                                  open, released), per mode
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// THE MODE AXIS (C2). balance.ui.handLayout arranges the same hand two ways —
// 'paging' (the shipped strip) and 'overlap' (the whole hand in the strip's
// width) — and the gesture must survive both, so the corpus runs once per
// mode rather than once per tree. One axis, not a second file: the checks are
// the same 32, the mode enters through ?shotSettings (the app's own settings
// resolution, the same door a player's stored choice enters), and the ONE
// mode-aware line is where a press aims. In overlap a card's centre can lie
// under its right neighbour, so every aim point is the centre of the card's
// EXPOSED strip — a formula that degenerates to the plain centre wherever
// nothing overlaps, which keeps the paging runs aimed exactly where they
// always were. On a tree without the word (dev), the setting resolves to
// nothing and both mode runs see the shipped strip — the overlap arm is then
// measured by tools/handlayout.mjs going red, not by this corpus.
//
// OBSERVED RED (the instrument rule), same door as the real input — CDP touch
// on the shipped combat screen over ?shot=combat, exactly the entry
// tools/gesture-cancel.mjs already uses:
//   dev 86564e6 (pre-inspect)   exit 1, 18 FAIL (9 per shape): every
//                               inspect-specific line red by name
//                               (data-inspect never appears, nothing expands)
//                               — including "release: state unchanged",
//                               because on that tree A LONG STATIONARY PRESS
//                               PLAYS THE CARD ON RELEASE, which is precisely
//                               the press this gesture reclaims. The corners
//                               that were already true — tap selects,
//                               abandon-to-drag, drag plays — PASS there,
//                               which is exactly what they protect.
//   vega/hold-to-expand         exit 0, both shapes
//   dev b968e28 (pre-S7)        the keyboard and pad cells red at both shapes:
//                               data-inspect never leaves `idle` under a held
//                               Confirm, zero copies, AND `selected true` —
//                               the press was activating on keydown, so the
//                               hold could not exist and the card was played
//                               instead. Not ref-pinned: P3/P4/P5 below rebuild
//                               it from today's tree on demand.
// The run that produced those lines is in the branch report; re-run it with
// --root against any tree.
//
// ...AND THAT RED IS REF-PINNED, WHICH IS WHY --selftest EXISTS (Vira's doors
// audit, 2026-08-14: "SAME-DOOR when run; the known-bad tree is ref-pinned").
// It needs an 86564e6 checkout to still exist on someone's disk; under SOP 2's
// drift clause a red that cannot be re-run is `unknown (drifted)`, not
// coverage. So the corpus is BUILT now, not remembered: --selftest copies this
// tree, cuts ONE REAL LINE out of the gesture in the copy, and re-runs this
// whole tool at --root COPY — real serve, real boot, real CDP touch on the
// real combat screen. Nothing is handed to a function.
//
// THE FIVE PLANTS ARE THE FIVE CONTRACTS, not five convenient lines:
//   P1 swallow cut     holdconfirm.js stops arming the click-swallow at the
//                      lift of a completed read. Every visible thing still
//                      works — the card still expands, still restores — and
//                      the release's click now reaches the screen: A READ
//                      BECOMES A PLAY. That is the exact defect of the
//                      pre-inspect tree, rebuilt on demand instead of
//                      remembered. Expect "release: state unchanged" red.
//   P2 abandon cut     holdconfirm.js stops closing the pending inspect past
//                      the shared 12 px boundary — the ONE disambiguation
//                      boundary the tap, the drag and the read share. The
//                      gesture stops yielding to the drag. Expect "abandon"
//                      red while the tap and drag corners stay green.
//   P3 press unpublished   input.js activates on KEYDOWN again instead of
//                      publishing a press — one line, and it is byte for byte
//                      the pre-S7 tree. The keyboard hold dies; THE KEYBOARD
//                      TAP STAYS GREEN, which is what makes this the defect
//                      and not a crater. Expect "kbd: past the dial" red.
//   P4 release cut     input.js activates on release WHETHER OR NOT the
//                      gesture consumed it. The card still expands and still
//                      restores — and the release now also selects it: A READ
//                      BECOMES A PLAY, one input over from P1. Expect
//                      "kbd: the read did not select" red while the open
//                      check stays green.
//   P5 pad release cut input.js's poller stops reading the falling edge, which
//                      is the state a pad was in before this act: buttons rise
//                      and never fall. The hold OPENS and never ends. Expect
//                      "pad release: the copy is gone" red while the pad open
//                      check stays green.
//   C  clean control   the untouched copy must go GREEN, or a red below only
//                      proves that copying a tree breaks the app.
//
// Each plant refuses at exit 2 if its line does not match exactly once: an
// empty match means the OPPOSITE of clean (SOP 2's wrong-place-empty), and a
// corpus that silently stops matching is the eleven-instruments shape.
//
// BOUNDARY. Linux headless Chromium; synthesized touch is not a finger (no
// fling, no real contact patch). The mid-hold read (check 3) samples at
// ~150 ms of a 400 ms dial through Runtime.evaluate — a slow harness could
// sample late and read "open"; that fails loud, never silently green. The
// screenshot pass is evidence, not a check: it asserts nothing.
//
// REMOVAL: deleted the day the gesture leaves the hand, or a browser-level
// input harness supersedes CDP touch synthesis.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const { serve } = await import(join(TOOLS, 'serve.mjs'));

const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const SHAPES = [[390, 844], [1200, 730]];
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const MODES = argOf('--mode') ? [argOf('--mode')] : ['paging', 'overlap'];
const shotsDir = argOf('--shots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map(); const handlers = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); }
    else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params, m.sessionId); });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    on(method, fn) { handlers.set(method, fn); },
    off(method) { handlers.delete(method); },
    close: () => ws.close() };
}

// ---- the re-runnable known-bad ---------------------------------------------
// Exact source lines, as the tree spells them today. Each is one of the
// gesture's CONTRACTS, not a convenient string; see the header.
const PLANTS = [
  {
    name: 'P1 swallow cut',
    file: 'src/ui/components/holdconfirm.js',
    // RE-AIMED 2026-08-17 (Sten): the swallow's own line grew a `source` guard
    // when the gesture gained keyboard and pad (S7), so the old find-string
    // stopped matching. Aimed at the bytes the defect actually replaces — the
    // assignment — never loosened and never deleted (Bjorn's quicknav-reach
    // lesson: a find-string carrying its neighbourhood is a plant aimed at a
    // neighbourhood). P4 below is this same contract on the other two inputs.
    from: "        if (completed && source === 'pointer') swallowClick = true;",
    to: '        /* inspecthold --selftest P1: the swallow is cut — a read can now become a play */',
    what: 'the click-swallow at the lift of a completed read',
    expect: 'the read becomes a PLAY — "release: state unchanged" red',
    mustRed: (out) => /FAIL release: state unchanged/.test(out),
    // The expansion itself is untouched: the card must still open. A plant that
    // also broke the opening would be red for the wrong reason.
    mustStay: (out) => /PASS inspect: past the dial the card is open/.test(out),
  },
  {
    name: 'P2 abandon cut',
    file: 'src/ui/components/holdconfirm.js',
    from: "        if (phase === 'pending' && Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();",
    to: '        /* inspecthold --selftest P2: the shared 12 px boundary is cut */',
    what: "the pending inspect's yield at the shared 12 px boundary",
    expect: 'the gesture stops yielding to the drag — "abandon" red',
    mustRed: (out) => /FAIL abandon:/.test(out),
    mustStay: (out) => /PASS tap: quick tap still SELECTS/.test(out),
  },
  {
    name: 'P3 press unpublished',
    file: 'src/ui/input.js',
    from: '      pressBegin(\'key\');',
    to: '      activateEl(el); /* inspecthold --selftest P3: the press is not published — the pre-S7 tree */',
    what: "the Confirm key's press (it activates on keydown again, as it did before S7)",
    expect: 'a keyboard player cannot hold at all — "kbd: past the dial" red, the kbd TAP still green',
    mustRed: (out) => /FAIL kbd: past the dial/.test(out),
    // The tap corner is the whole point: this plant removes the HOLD and leaves
    // the keyboard otherwise working, which is the defect's real shape. A plant
    // that also broke Enter would be red for being a crater.
    mustStay: (out) => /PASS kbd: a short Enter still SELECTS/.test(out),
  },
  {
    name: 'P4 release cut',
    file: 'src/ui/input.js',
    from: '  if (!consumed && !cancelled && el.isConnected) activateEl(el);',
    to: '  if (!cancelled && el.isConnected) activateEl(el); /* inspecthold --selftest P4: the release no longer asks */',
    what: "the release's question — did the gesture consume this activation?",
    expect: 'a completed keyboard read ALSO selects — "kbd: the read did not select" red',
    mustRed: (out) => /FAIL kbd: the read did not select/.test(out),
    mustStay: (out) => /PASS kbd: past the dial the card is open/.test(out),
  },
  {
    name: 'P5 pad release cut',
    file: 'src/ui/input.js',
    from: '        if (padPressBtn === i) { padPressBtn = null; pressEnd(); }',
    to: '        /* inspecthold --selftest P5: the poller stops reading the falling edge */',
    what: "the pad poller's falling edge — the half it never had before this act",
    expect: 'a pad hold opens and never ends — "pad release: the copy is gone" red',
    mustRed: (out) => /FAIL pad release: the copy is gone/.test(out),
    mustStay: (out) => /PASS pad: past the dial the card is open/.test(out),
  },
];

// ---- the non-pointer doors ---------------------------------------------------
// The pad shim, installed ONLY for the pad cell (see the header: a pad visible
// during checks 1-8 puts the page in pad-mode and changes the hand they
// measure). It replaces navigator.getGamepads and nothing else — input.js's
// poller reads that function, unmodified, at its own 16 ms cadence.
const PAD_SHIM = `(() => {
  const pad = { index: 0, id: 'inspecthold shim (STANDARD GAMEPAD)', mapping: 'standard',
    connected: true, timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [pad, null, null, null];
  window.__pad = {
    down(i) { pad.buttons[i] = { pressed: true, touched: true, value: 1 }; pad.timestamp = performance.now(); },
    up(i) { pad.buttons[i] = { pressed: false, touched: false, value: 0 }; pad.timestamp = performance.now(); },
    connect() { window.dispatchEvent(new Event('gamepadconnected')); },
  };
})()`;

// ---- the browser and its profile, torn down in the order that works ---------
//
// This tool was one of the 25 of 37 that mkdtemp a ~11 MB Chrome profile and
// never remove it (Bjorn's count at b968e28, on a box at 89%). It is closed here
// because this act already had the file open.
//
// THE ORDER IS BJORN'S AND IT IS NOT COSMETIC — 0fe6dfa..06b18f3, where he
// corrected his own first cut: `child.kill()` then `rmSync` DOES NOTHING,
// because SIGTERM starts an ASYNCHRONOUS shutdown and the dying Chromium
// re-creates the tree on its way out. And a `kill` reachable only on the happy
// path orphans a live browser whose profile then gets deleted underneath it,
// which is worse than leaking. So: module scope so the catch can reach it,
// SIGTERM, await `exit` with a 3 s ceiling, SIGKILL anything left, THEN remove.
//
// STILL A PATCH, with his number rather than a shrug: `child.kill()` signals the
// direct child only, so Chromium helpers can outlive it and re-create entries
// after rmSync. The fix is a process-group kill in ONE SHARED LAUNCHER — the
// lane, not a fourteenth private copy of it.
// THE PATCH ABOVE IS NOW THE LANE IT ASKED FOR. Sten's note named the fix — "a
// process-group kill in ONE SHARED LAUNCHER … not a fourteenth private copy" —
// and that launcher is tools/browser.mjs. It does the group kill (measured: with
// only `child.kill()`, an orphaned RENDERER recreated the profile after a removal
// that had already verified it gone, and reported success), joins for real with
// no short ceiling, re-checks after a settle, and sweeps on exit and on signal.
// His `dropBrowser` name is kept below because his call sites read well; it is
// the launcher's `close` now, not a local copy of it.
let dropBrowser = async () => {};

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'inspecthold-kb-'));
  for (const d of ['src', 'styles', 'assets']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  const path = resolve(dir, p.file);
  const src = readFileSync(path, 'utf8');
  const first = src.indexOf(p.from);
  if (first < 0 || src.indexOf(p.from, first + 1) >= 0) {
    console.error(`inspecthold --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  That line is one of this gesture\'s CONTRACTS, not a convenience. If the hand');
    console.error('  renderers were collapsed into one (src/ui/handAxis.js\'s standing debt), find');
    console.error('  where the contract lives now and RE-AIM the plant. Do not delete it: a corpus');
    console.error('  that silently stops matching is the eleven-instruments shape.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runSelfAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root, '--only', '390x844', '--mode', 'paging'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('inspecthold --selftest — the re-runnable known-bad');
  console.log('  DOOR: every known-bad below is a SOURCE EDIT to a disposable copy of this tree');
  console.log(`  (root ${ROOT}), judged by re-running this whole tool at --root COPY: served over`);
  console.log('  http, booted in headless Chromium, and pressed with real CDP touch at real');
  console.log('  coordinates on the real combat screen — every stage a player\'s finger travels.');
  console.log('  Nothing is handed to armInspect(); a source edit is how this defect class arrives.');
  console.log('  SCOPE: the planted runs are 390x844 x paging (one cell) to keep the corpus');
  console.log('  affordable — the full run sweeps 2 shapes x 2 modes and is what the control');
  console.log('  green above does NOT stand in for.\n');

  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  console.log('  control: untouched copy of this tree (no plant)');
  const clean = await runSelfAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants below are the only difference`);
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runSelfAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: the untouched corner stays green (red for the RIGHT reason, not a crater)`);
    // The red itself, quoted — a verdict that will not show its evidence is the
    // shape my own README once wore ("executed rather than asserted", printed
    // and never graded). Read these lines against the PASS above, not instead.
    for (const line of r.out.split('\n').filter((l) => /\s+FAIL /.test(l))) {
      console.log(`    red |${line.replace(/^\s+/, ' ')}`);
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(fails
    ? `\ninspecthold --selftest: ${fails} FAIL — this instrument's red is NOT re-observed; treat its greens as unknown`
    : `\ninspecthold --selftest: held — clean copy green, ${PLANTS.length} contracts red by name, through each input's own door`);
  console.log('  BOUNDARY: five contracts carry a plant — the pointer swallow, the shared 12 px');
  console.log('  boundary, the Confirm press, the release\'s arbitration, and the pad\'s falling edge.');
  console.log('  The TAP corners, the affordability check and the open-inspect drag guard do NOT —');
  console.log('  they are asserted every run and have never been watched to fail. And the planted');
  console.log('  runs are one cell (390x844 x paging), so the pad shim and the keyboard cell are');
  console.log('  watched red at ONE shape; the full run sweeps 2 shapes x 2 modes and the control');
  console.log('  green does not stand in for it.');
  process.exit(fails ? 1 : 0);
}

async function main() {
  if (!browserPath) { console.error('inspecthold: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();
  const s = await serve({ root: ROOT, port: 8272, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`inspecthold — ${base} (root ${ROOT})`);
  if (shotsDir) mkdirSync(shotsDir, { recursive: true });

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close } = await launchBrowser({
    prefix: 'inspect-', browser: browserPath,
    timeoutMs: 12000,
  });
  dropBrowser = close;
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let fails = 0, ran = 0;

  for (const mode of MODES) {
  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points }, S);
    // The keyboard door: real keyDown/keyUp, so a HELD key is two events with a
    // span between them — which is the whole subject of the S7 cells below.
    //
    // `autoRepeat` is passed because a REAL held key is not one keydown. An OS
    // sends the first, then a stream of repeats at ~30 Hz, each arriving with
    // `ev.repeat === true`. A harness that omits them measures a key nobody
    // holds: the code path where a repeat could restart the gesture (or fire a
    // control thirty times) would never run. So the hold below is driven with
    // real repeats.
    const keyDown = (k, autoRepeat = false) => cdp.send('Input.dispatchKeyEvent',
      { type: 'keyDown', key: k, code: k, autoRepeat, text: k.length === 1 ? k : undefined }, S);
    const keyUp = (k) => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, text: k.length === 1 ? k : undefined }, S);
    const tapKey = async (k) => { await keyDown(k); await wait(30); await keyUp(k); };
    /** Keep a key down for `ms`, sending OS-style repeats every ~33 ms. Returns
     *  the number of repeats sent, so a check can say the stream was real. */
    const keepDown = async (k, ms) => {
      const t0 = Date.now();
      let repeats = 0;
      while (Date.now() - t0 < ms) {
        await wait(33);
        await keyDown(k, true); // a repeat, exactly as an OS sends one
        repeats++;
      }
      return repeats;
    };
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };
    const shot = async (name) => { if (!shotsDir || W !== 390) return;
      const st = await ev(`(document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect || 'unmarked'`);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
      const st2 = await ev(`(document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect || 'unmarked'`);
      writeFileSync(join(shotsDir, `${mode}-${name}.png`), Buffer.from(data, 'base64'));
      console.log(`    shot ${mode}-${name}.png (state ${st} -> ${st2})`); };

    // The mode enters by the settings door (?shotSettings -> saves.loadMeta()
    // -> applyDisplaySettings), never by poking the attribute: what runs is the
    // app's own derivation of the word, or on an old tree, nothing.
    const combatUrl = base + '?shot=combat&shotSettings=' + encodeURIComponent(JSON.stringify({ handLayout: mode }));
    await cdp.send('Page.navigate', { url: combatUrl }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(500);
    console.log(`\n  ${shape} · ${mode}`);

    // `sel` was added 2026-08-17 with the S7 cells, and it was VACUOUS before
    // it was here: the keyboard checks read `.sel` off this object, the object
    // did not carry it, and `!undefined` passed forever. Found by watching P4
    // fail to go red. A field a check reads and nothing supplies is a green that
    // means nothing — the shape of the plant that would not fire.
    const state = `(() => ({ discard: +document.querySelector('.pile.discard .n').textContent,
      energy: (document.querySelector('.energy-orb')||{textContent:''}).textContent.trim(),
      open: document.querySelectorAll('body > .card-inspect').length,
      sel: !!document.querySelector('.hand .card.selected'),
      ghosts: [...document.querySelectorAll('body > .card')].filter(e=>e.style.position==='fixed' && !e.classList.contains('card-inspect')).length }))()`;
    // Centre the probe card first — the narrow hand is a scroller (gesture-
    // cancel's lesson: a drag at a stale off-strip centre touches nothing).
    // AIM AT THE EXPOSED STRIP, not the raw centre: in overlap a card's centre
    // can lie under its right neighbour, and a press there belongs to the
    // neighbour — which is true for the player too, so the instrument aims
    // where a finger must. Where nothing overlaps (paging, and any last card)
    // the formula IS the centre, so the shipped runs aim exactly as before.
    const aimFn = `const __aim = (c) => { const r = c.getBoundingClientRect();
      const sib = c.nextElementSibling;
      const sr = sib ? sib.getBoundingClientRect() : null;
      const right = sr && sr.left < r.right && sr.left > r.left ? sr.left : r.right;
      return { x: (r.left + right) / 2, y: r.top + r.height / 2, w: r.width }; };`;
    const cardAt = `(() => { ${aimFn} const c=document.querySelector('.hand .card');
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      return __aim(c); })()`;
    const strikeAt = `(() => { ${aimFn} const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent));
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      return __aim(c); })()`;
    const enemyAt = `(() => { const e=document.querySelector('.enemy:not(.dead)'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const inspectOf = `(() => (document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect)()`;
    const before = await ev(state);

    // 1 — rest
    ok(await ev(`[...document.querySelectorAll('.hand .card')].every(c => c.dataset.inspect === 'idle')`),
      `rest: every hand card marked data-inspect="idle"`);
    await shot('1-hand-at-rest');

    // 2 — TAP corner (targetable card selects; second tap deselects)
    const st0 = await ev(strikeAt);
    await touch('touchStart', [{ x: st0.x, y: st0.y, id: 1 }]); await touch('touchEnd', []); await wait(300);
    ok(await ev(`!!document.querySelector('.hand .card.selected')`), `tap: quick tap still SELECTS a targetable card`);
    const st1 = await ev(strikeAt);
    await touch('touchStart', [{ x: st1.x, y: st1.y, id: 2 }]); await touch('touchEnd', []); await wait(300);

    // 3 + 4 — mid-hold, then open, one continuous press
    const p0 = await ev(cardAt);
    await touch('touchStart', [{ x: p0.x, y: p0.y, id: 3 }]); await wait(150);
    const mid = await ev(`(() => ({ st: ${inspectOf}, open: document.querySelectorAll('body > .card-inspect').length }))()`);
    ok(mid.st === 'pending' && mid.open === 0, `mid-hold: data-inspect="pending", no copy yet (read ${mid.st}, ${mid.open})`);
    await wait(450);
    const opened = await ev(`(() => { const g = document.querySelector('body > .card-inspect');
      return { st: ${inspectOf}, n: document.querySelectorAll('body > .card-inspect').length,
        w: g ? g.getBoundingClientRect().width : 0 }; })()`);
    ok(opened.st === 'open' && opened.n === 1, `inspect: past the dial the card is open (state ${opened.st}, copies ${opened.n})`);
    ok(opened.w >= p0.w * 1.5, `inspect: the copy is visibly expanded (${opened.w.toFixed(0)}px vs card ${p0.w.toFixed(0)}px)`);
    const during = await ev(state);
    ok(during.discard === before.discard && during.energy === before.energy, `inspect: reading changed NOTHING (discard ${during.discard}, energy ${during.energy})`);
    await shot('3-expanded-in-front');

    // 5 — restore on release, and the next tap is not swallowed
    await touch('touchEnd', []); await wait(250);
    const after = await ev(state);
    ok(after.open === 0, `release: the copy is gone (${after.open})`);
    ok(await ev(inspectOf) === 'idle', `release: card back to idle`);
    ok(after.discard === before.discard && after.energy === before.energy, `release: state unchanged`);
    await shot('4-released');
    const st2 = await ev(strikeAt);
    await touch('touchStart', [{ x: st2.x, y: st2.y, id: 4 }]); await touch('touchEnd', []); await wait(300);
    ok(await ev(`!!document.querySelector('.hand .card.selected')`), `release: the NEXT tap still selects (swallow is exactly one click)`);
    const st3 = await ev(strikeAt);
    await touch('touchStart', [{ x: st3.x, y: st3.y, id: 5 }]); await touch('touchEnd', []); await wait(300);

    // The mid-hold PHOTOGRAPH, on its own press — Rune's "the camera was the
    // finger": Page.captureScreenshot takes longer than the 400 ms window, so
    // a single racing capture brackets pending -> open, an ambiguous frame.
    // So the camera does not race: a page-side observer TIMESTAMPS every
    // data-inspect transition on the same epoch clock the screencast stamps
    // its frames with, the whole press is streamed, and the frame chosen is
    // one PROVABLY inside [pending, open) with 30 ms of margin on both sides.
    // Nothing here injects input; the press rides to open before releasing so
    // the lift is swallowed and can never tap-play the probe card.
    if (shotsDir && W === 390) {
      await ev(`(() => { window.__insLog = []; const h = document.querySelector('.hand');
        new MutationObserver((rs) => { for (const r of rs) window.__insLog.push({ v: r.target.dataset.inspect, t: Date.now() }); })
          .observe(h, { subtree: true, attributes: true, attributeFilter: ['data-inspect'] }); return 1; })()`);
      const frames = [];
      cdp.on('Page.screencastFrame', (p, sess) => {
        frames.push({ t: p.metadata.timestamp * 1000, data: p.data });
        cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId }, sess).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }, S);
      const pc = await ev(cardAt);
      await touch('touchStart', [{ x: pc.x, y: pc.y, id: 30 }]);
      await wait(700);
      await cdp.send('Page.stopScreencast', {}, S);
      await touch('touchEnd', []); await wait(250);
      cdp.off('Page.screencastFrame');
      const log = await ev(`window.__insLog`);
      const tPend = (log.find((e) => e.v === 'pending') || {}).t;
      const tOpen = (log.find((e) => e.v === 'open') || {}).t;
      const frame = tPend && tOpen ? frames.filter((f) => f.t > tPend + 30 && f.t < tOpen - 30).pop() : null;
      if (frame) {
        writeFileSync(join(shotsDir, `${mode}-2-mid-hold.png`), Buffer.from(frame.data, 'base64'));
        console.log(`    shot ${mode}-2-mid-hold.png (frame at +${(frame.t - tPend).toFixed(0)}ms of a ${(tOpen - tPend).toFixed(0)}ms hold, ${frames.length} streamed)`);
      } else {
        console.log(`    shot ${mode}-2-mid-hold: no frame provably inside the window (pending ${tPend}, open ${tOpen}, frames ${frames.length}) — nothing ambiguous written`);
      }
    }

    // 6 — movement mid-pending abandons the inspect and hands the press to the drag
    const p1 = await ev(cardAt);
    await touch('touchStart', [{ x: p1.x, y: p1.y, id: 6 }]); await wait(120);
    for (let i = 1; i <= 3; i++) await touch('touchMove', [{ x: p1.x, y: p1.y - i * 30, id: 6 }]);
    const mid2 = await ev(state);
    const stMid = await ev(inspectOf);
    ok(stMid === 'idle' && mid2.open === 0, `abandon: movement mid-pending returns the card to idle (${stMid}), no copy`);
    ok(mid2.ghosts === 1, `abandon: the DRAG took the press (ghost ${mid2.ghosts})`);
    await touch('touchCancel', []); await wait(250);

    // 8 — reading is not gated on affordability. Runs BEFORE the drag-play so
    // a Strike is still in hand for the repaint trick, and energy is restored
    // after. The state edit goes through the window.__combat debug handle —
    // the one non-finger step, named here rather than hidden; the REPAINT goes
    // through the screen's own path (a bare resize does not repaint the hand —
    // observed on the known-bad run): select a Strike while affordable (click
    // renders), zero the energy, cancel targeting via contextmenu (renders).
    const selectStrike = async (idBase) => {
      for (let t = 0; t < 4; t++) {
        const sp = await ev(strikeAt);
        await touch('touchStart', [{ x: sp.x, y: sp.y, id: idBase + t }]); await touch('touchEnd', []); await wait(350);
        if (await ev(`!!document.querySelector('.hand .card.selected')`)) return true;
      }
      return false;
    };
    const cancelTargeting = async () => {
      await ev(`(() => { document.querySelector('.combat').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return 1; })()`);
      await wait(300);
    };
    // select while affordable, THEN zero, then cancel (the cancel repaints)
    await selectStrike(40);
    await ev(`(() => { window.__combat.player.energy = 0; return 1; })()`);
    await cancelTargeting();
    const unaffordable = await ev(`(() => { ${aimFn} const c = [...document.querySelectorAll('.hand .card')].find(x => x.classList.contains('unaffordable'));
      if (!c) return null; c.scrollIntoView({ inline: 'center', block: 'nearest' });
      return __aim(c); })()`);
    if (unaffordable) {
      await touch('touchStart', [{ x: unaffordable.x, y: unaffordable.y, id: 8 }]); await wait(600);
      const ua = await ev(`document.querySelectorAll('body > .card-inspect').length`);
      ok(ua === 1, `unaffordable: a card you cannot pay for still READS (copies ${ua})`);
      await touch('touchEnd', []); await wait(200);
    } else {
      ok(false, `unaffordable: no .unaffordable card appeared after energy 0 — the probe could not repaint the hand`);
    }
    // 7 — DRAG corner: careful drag (150 ms stationary first) still plays.
    // On a FRESH boot: the shot hand carries exactly one guaranteed-targetable
    // Strike, and check 8's energy dance left the previous page's handlers
    // wired at a zero-energy paint (the captured `affordable` closure is how
    // the screen works, not a defect) — a reload is the honest reset, not a
    // second trick through the debug handle.
    await cdp.send('Page.navigate', { url: combatUrl }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat reboot'); await wait(500);
    const before7 = await ev(state);
    const p2 = await ev(strikeAt);
    const en = await ev(enemyAt);
    await touch('touchStart', [{ x: p2.x, y: p2.y, id: 7 }]); await wait(150);
    const steps = 6;
    for (let i = 1; i <= steps; i++) await touch('touchMove', [{ x: p2.x + (en.x - p2.x) * i / steps, y: p2.y + (en.y - p2.y) * i / steps, id: 7 }]);
    await touch('touchEnd', []); await wait(500);
    const played = await ev(state);
    ok(played.discard === before7.discard + 1, `drag: a careful drag onto an enemy still PLAYS (discard ${before7.discard}->${played.discard})`);

    // ---- 9-14 · THE SAME GESTURE WITHOUT A POINTER (S7) --------------------
    // Every check above is a finger. These two cells are the same triangle
    // driven by the focus cursor: a key held, and a pad button held. See the
    // header for the two doors and what the pad shim cannot see.
    //
    // WHAT THE FOCUS CURSOR DOES NOT HAVE is an aim point, so nothing here
    // computes a coordinate. The cursor names an element; that is why these
    // cells assert reachability FIRST — a gesture on a control the cursor
    // cannot arrive at is unreachable however well it works.
    const focusInfo = `(() => { const f = document.querySelector('#app .gp-focus');
      if (!f) return null;
      return { card: !!(f.matches && f.matches('.hand .card')), inspect: f.dataset.inspect || 'unmarked',
        w: f.getBoundingClientRect().width, rings: document.querySelectorAll('.gp-focus').length,
        text: (f.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 26) }; })()`;
    // Walk the cursor with one input's own navigation keys/buttons until it is
    // standing on a hand card (optionally a named one). Tries the axes in turn
    // because moveFocus is spatial and does not wrap — a cursor at the right
    // edge of the hand answers ArrowRight with nothing, which is correct.
    const walkTo = async (step, pred) => {
      for (const dir of ['right', 'down', 'left']) {
        for (let i = 0; i < 14; i++) {
          const f = await ev(focusInfo);
          if (f && f.card && (!pred || pred(f))) return f;
          await step(dir); await wait(70);
        }
      }
      const f = await ev(focusInfo);
      return f && f.card && (!pred || pred(f)) ? f : null;
    };
    const isStrike = (f) => /Strike/.test(f.text);

    // --- 9-13 · KEYBOARD -----------------------------------------------------
    await cdp.send('Page.navigate', { url: combatUrl }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat (kbd cell)'); await wait(500);
    const kbBefore = await ev(state);
    const ARROW = { right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };
    const onCard = await walkTo((d) => tapKey(ARROW[d]));
    ok(!!onCard, `kbd: arrow keys alone REACH a hand card (${onCard ? onCard.text : 'never did'})`);
    if (onCard) {
      ok(onCard.inspect === 'idle', `kbd: the reached card is armed (data-inspect="${onCard.inspect}")`);
      await keyDown('Enter');
      const r1 = await keepDown('Enter', 200);
      const kbMid = await ev(`(() => ({ f: ${focusInfo}, open: document.querySelectorAll('body > .card-inspect').length }))()`);
      ok(kbMid.f && kbMid.f.inspect === 'pending' && kbMid.open === 0,
        `kbd: mid-hold reads pending, no copy yet (${kbMid.f ? kbMid.f.inspect : 'no focus'}, ${kbMid.open})`);
      const r2 = await keepDown('Enter', 450);
      // THE DOOR SAYS WHAT IT SENT, and this check asserts only that — that the
      // press really was driven by a stream of OS-style repeats rather than one
      // lonely keydown. The BEHAVIOURAL claim (a repeat does not restart the
      // fill) is carried by the very next check: a hold longer than the dial can
      // only read `open` if none of the repeats reset the timer.
      //
      // THE FLOOR IS 2, NOT A ROUND NUMBER, and it was 12 for one run. That was
      // a threshold with nothing either side of it (Charter gate 2b) and its own
      // corpus failed it: 18 repeats on an idle box, SEVEN with four Chromiums
      // running on a disk at 89%, because each repeat is a CDP round-trip. The
      // count is EVIDENCE and it is printed; the claim is only that the stream
      // was a stream. A pass here does not say the rate resembles a real
      // keyboard's — nothing in this harness can.
      ok(r1 + r2 >= 2, `kbd: the hold was driven by ${r1 + r2} OS autorepeat keydowns, not one`);
      const kbOpen = await ev(`(() => { const g = document.querySelector('body > .card-inspect');
        return { f: ${focusInfo}, n: document.querySelectorAll('body > .card-inspect').length,
          w: g ? g.getBoundingClientRect().width : 0 }; })()`);
      ok(kbOpen.f && kbOpen.f.inspect === 'open' && kbOpen.n === 1,
        `kbd: past the dial the card is open (state ${kbOpen.f ? kbOpen.f.inspect : 'no focus'}, copies ${kbOpen.n})`);
      ok(kbOpen.n === 1 && kbOpen.w >= onCard.w * 1.5,
        `kbd: the copy is visibly expanded (${kbOpen.w.toFixed(0)}px vs card ${onCard.w.toFixed(0)}px)`);
      const kbDuring = await ev(state);
      ok(kbDuring.discard === kbBefore.discard && kbDuring.energy === kbBefore.energy && !kbDuring.sel,
        `kbd: reading changed NOTHING (discard ${kbDuring.discard}, energy ${kbDuring.energy}, selected ${kbDuring.sel})`);
      // ONE focus ring while a copy of a focused card is on screen. The clone
      // carries the card's classes, so a state that belongs to the original
      // must be stripped from it — the same reason `selected` is.
      ok(kbOpen.f && kbOpen.f.rings === 1, `kbd: the expanded copy does not carry a second focus ring (${kbOpen.f ? kbOpen.f.rings : '?'})`);
      await keyUp('Enter');
      await wait(300);
      const kbAfter = await ev(state);
      ok(kbAfter.open === 0, `kbd release: the copy is gone (${kbAfter.open})`);
      // THE ONE THAT MATTERS MOST, and it is P1's defect one input over: a
      // completed read must not also be the tap that plays the card.
      ok(!kbAfter.sel && kbAfter.discard === kbBefore.discard && kbAfter.energy === kbBefore.energy,
        `kbd: the read did not select or play (selected ${kbAfter.sel}, discard ${kbAfter.discard}, energy ${kbAfter.energy})`);
      // The TAP corner, keyboard side: a short Enter is still the whole action.
      const onStrike = await walkTo((d) => tapKey(ARROW[d]), isStrike);
      if (onStrike) {
        await tapKey('Enter'); await wait(350);
        ok(await ev(`!!document.querySelector('.hand .card.selected')`), `kbd: a short Enter still SELECTS a targetable card`);
      } else {
        ok(false, `kbd: could not steer the cursor to a targetable Strike — the tap corner went unmeasured`);
      }
    }

    // --- 14 · GAMEPAD --------------------------------------------------------
    // The shim goes in LAST and is never removed, because this target is closed
    // immediately after: a pad visible during checks 1-8 would put the page in
    // pad-mode and change the hand they measure.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAD_SHIM }, S);
    await cdp.send('Page.navigate', { url: combatUrl }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat (pad cell)'); await wait(500);
    const padBefore = await ev(state);
    await ev(`(() => { window.__pad.connect(); return 1; })()`); await wait(200);
    ok(await ev(`document.body.classList.contains('has-gamepad')`), `pad: the shimmed pad is seen by the app`);
    const DPAD = { right: 15, down: 13, left: 14 };
    const padTap = async (btn) => { await ev(`(() => { window.__pad.down(${btn}); return 1; })()`); await wait(60);
      await ev(`(() => { window.__pad.up(${btn}); return 1; })()`); };
    const padOnCard = await walkTo((d) => padTap(DPAD[d]));
    ok(!!padOnCard, `pad: the D-pad alone REACHES a hand card (${padOnCard ? padOnCard.text : 'never did'})`);
    if (padOnCard) {
      const CONFIRM_BTN = 0; // ACTIONS' `confirm` defBtn — the button this cell holds
      await ev(`(() => { window.__pad.down(${CONFIRM_BTN}); return 1; })()`);
      await wait(200);
      const pMid = await ev(focusInfo);
      ok(pMid && pMid.inspect === 'pending', `pad: mid-hold reads pending (${pMid ? pMid.inspect : 'no focus'})`);
      await wait(450);
      const pOpen = await ev(`(() => ({ f: ${focusInfo}, n: document.querySelectorAll('body > .card-inspect').length }))()`);
      ok(pOpen.f && pOpen.f.inspect === 'open' && pOpen.n === 1,
        `pad: past the dial the card is open (state ${pOpen.f ? pOpen.f.inspect : 'no focus'}, copies ${pOpen.n})`);
      await ev(`(() => { window.__pad.up(${CONFIRM_BTN}); return 1; })()`);
      await wait(300);
      const pAfter = await ev(state);
      ok(pAfter.open === 0, `pad release: the copy is gone (${pAfter.open})`);
      ok(!pAfter.sel && pAfter.discard === padBefore.discard,
        `pad: the read did not select or play (selected ${pAfter.sel}, discard ${pAfter.discard})`);
      // The TAP corner, pad side: a short press is still the whole action.
      const padOnStrike = await walkTo((d) => padTap(DPAD[d]), isStrike);
      if (padOnStrike) {
        await padTap(CONFIRM_BTN); await wait(350);
        ok(await ev(`!!document.querySelector('.hand .card.selected')`), `pad: a short Confirm still SELECTS a targetable card`);
      } else {
        ok(false, `pad: could not steer the cursor to a targetable Strike — the tap corner went unmeasured`);
      }
    }

    await cdp.send('Target.closeTarget', { targetId });
  }
  }

  cdp.close(); s.server.close();
  await dropBrowser();
  if (!ran) { console.error('inspecthold: NOTHING RAN'); process.exit(2); }
  console.log(fails ? `\ninspecthold: ${fails} FAIL` : '\ninspecthold: all green');
  process.exit(fails ? 1 : 0);
}

// The catch reaches CHILD because it is at module scope. Without that, ANY throw
// in main() orphans a headless Chromium — six were alive on this box when Bjorn
// looked, aged 2 h to 3 h 24 m, none of them killed.
main().catch(async (e) => { console.error('inspecthold:', e.message); await dropBrowser(); process.exit(2); });
