#!/usr/bin/env node
// tools/perf-probe.mjs — mobile performance, measured (docs/FINISH.md §7 "60 fps
// on a low-end phone profile", RELEASE-CHECKLIST G20). MEASURES ONLY: it changes
// no game code and asserts nothing; it prints the numbers a tuning step starts from.
//
//   node tools/perf-probe.mjs                      all scenarios, 3 runs, median across runs
//   node tools/perf-probe.mjs --runs 5             more runs
//   node tools/perf-probe.mjs --certify            certification: scenarios combat,hand, 5 runs, no CPU profile,
//                                                  per-run rows, trimmed median (drop min and max), min-max spread
//                                                  and PASS/FAIL against the targets (see TARGETS below)
//   node tools/perf-probe.mjs --scenario combat,map   only these (combat, map, hand, transitions)
//   node tools/perf-probe.mjs --seed PERF1         the fixed seed (default PERF1)
//   node tools/perf-probe.mjs --throttle 4         CPU slowdown (default 4; 1 = none)
//   node tools/perf-probe.mjs --out DIR            raw per-run JSON goes here (default $TMPDIR/ashen-perf)
//   node tools/perf-probe.mjs --keep-trace         also keep each Chromium trace in DIR (large)
//   node tools/perf-probe.mjs --no-profile         skip the CPU-profile pass
//   node tools/perf-probe.mjs --from DIR           re-print the report from the runs-*.json saved in DIR
//   PERF_PROFILE_DIR=DIR node tools/perf-probe.mjs   also save each raw .cpuprofile there (large; prune it)
//   node tools/perf-probe.mjs --force              start although the host is busy (load1 > cores/2 is refused otherwise)
//   node tools/perf-probe.mjs --debug              log each step and the controls on screen
//
// Profile: Playwright Chromium, 390x844 phone (deviceScaleFactor 3, isMobile,
// hasTouch), CDP Emulation.setCPUThrottlingRate 4, real touch input through
// Input.dispatchTouchEvent, the Core profile (`?shot=` doors, memory storage).
// Each scenario is loaded fresh per run and measured twice: pass A records the
// rAF frame deltas, long tasks, animation counts and a CDP trace (layout, style,
// paint, raster, decode, GC, script); pass B records a CDP CPU profile (it
// slows the page, so its frame times are not reported). Raw JSON is never
// written into the tree (CLAUDE.md: no bulk evidence JSON).
//
// Caveat: headless Chromium rasterises in software, so paint/raster numbers
// are a stand-in for a phone GPU; main-thread (script, style, layout) numbers
// are the throttled ones that transfer.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const arg = (name, dflt) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt);
const CERTIFY = argv.includes('--certify');
const RUNS = Math.max(1, Number(arg('--runs', CERTIFY ? 5 : 3)) || (CERTIFY ? 5 : 3));
const SEED = arg('--seed', 'PERF1');
const THROTTLE = Number(arg('--throttle', 4)) || 4;
const OUT = resolve(arg('--out', join(process.env.TMPDIR || tmpdir(), 'ashen-perf')));
const KEEP_TRACE = argv.includes('--keep-trace');
const PROFILE = !argv.includes('--no-profile') && !CERTIFY;
const DEBUG = argv.includes('--debug');
const FORCE = argv.includes('--force');
const WANT = new Set(String(arg('--scenario', CERTIFY ? 'combat,hand' : 'combat,map,hand,transitions')).split(','));
const log = (...a) => { if (DEBUG) console.error('  [dbg]', ...a); };
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// ---- statistics ---------------------------------------------------------------
const sorted = (a) => [...a].sort((x, y) => x - y);
const pct = (a, q) => { if (!a.length) return 0; const s = sorted(a); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const median = (a) => { if (!a.length) return 0; const s = sorted(a), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (a) => a.reduce((t, x) => t + x, 0);
const r1 = (x) => Math.round(x * 10) / 10;
// Trimmed median: drop the single lowest and highest value, take the median of the rest (plain median under 3 values).
const trimmedMedian = (a) => { const s = sorted(a.filter((x) => Number.isFinite(x))); return s.length >= 3 ? median(s.slice(1, -1)) : median(s); };

// ---- host guard and CPU calibration ---------------------------------------------
// The numbers are only comparable when the host is quiet and the throttled CPU runs at the same speed
// in every pass: refuse to start on a busy host, and time a fixed JS loop under the same throttle before
// each pass; a pass whose loop deviates more than CALIB_TOLERANCE from the first pass is rerun (at most
// CALIB_RETRIES times, then it is kept and reported as unstable).
const CALIB_TOLERANCE = 0.15;
const CALIB_RETRIES = 2;
const CALIBRATION = `(() => {
  const once = () => { const t0 = performance.now(); let x = 1;
    for (let i = 0; i < 3e6; i++) x = (x * 1664525 + 1013904223 + (i & 255)) >>> 0;
    globalThis.__calib = x; return performance.now() - t0; };
  once();
  const r = []; for (let k = 0; k < 7; k++) r.push(once());
  r.sort((a, b) => a - b); return r[3]; // the median: a min follows the one lucky fast rep, a mean the one stall
})()`;
function hostLoad() {
  try { return Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]); } catch { return null; }
}
function checkHostIdle() {
  const load = hostLoad(), cores = cpus().length;
  if (load === null) { console.error('host load: /proc/loadavg unavailable, idle check skipped'); return; }
  const busy = load > cores / 2;
  console.error(`host load1 ${load} on ${cores} cores (limit ${cores / 2})${busy ? (FORCE ? ' - busy, continuing because of --force' : ' - BUSY') : ' - idle enough'}`);
  if (busy && !FORCE) { console.error('refusing to measure on a busy host: wait for the load to drop, or pass --force'); process.exit(2); }
}
const calib = { ref: null, rejected: 0 };

// ---- in-page instrumentation (installed before any page script) --------------
const INIT = `(() => {
  window.__perfCounts = {};
  // Marks are [name, performance.now()] in call order: every __perfCount call (the screens' counters, e.g.
  // render, stage, hand, beatFlush, finishRender) and the probe's own __perfMark('tap') before each input.
  window.__perfMarks = [];
  window.__perfCount = (name) => { window.__perfCounts[name] = (window.__perfCounts[name] || 0) + 1; if (S.on) window.__perfMarks.push([name, performance.now()]); };
  window.__perfMark = (name) => { if (S.on) window.__perfMarks.push([name, performance.now()]); };
  const S = { on: false, frames: [], ft: [], turn: [], long: [], anim: [] };
  try { new PerformanceObserver((l) => { if (S.on) for (const e of l.getEntries()) S.long.push(e.duration); }).observe({ type: 'longtask' }); } catch {}
  let last = 0, n = 0;
  const tick = (t) => {
    if (!S.on) return;
    if (last) { S.frames.push(t - last); S.ft.push(t); S.turn.push(document.querySelector('.combat')?.dataset.turn || ''); }
    last = t;
    if (++n % 15 === 0) {
      const all = document.getAnimations();
      S.anim.push([all.length,
        all.filter((a) => a.transitionProperty !== undefined).length,
        all.filter((a) => { try { return a.effect.getComputedTiming().iterations === Infinity; } catch { return false; } }).length]);
    }
    requestAnimationFrame(tick);
  };
  window.__perf = {
    counts() { return { ...window.__perfCounts }; },
    start() { for (const k of Object.keys(window.__perfCounts)) delete window.__perfCounts[k]; window.__perfMarks = []; S.frames = []; S.ft = []; S.turn = []; S.long = []; S.anim = []; last = 0; n = 0; S.on = true; requestAnimationFrame(tick); },
    stop() { S.on = false; return { frames: S.frames, ft: S.ft, turn: S.turn, marks: window.__perfMarks, long: S.long, anim: S.anim }; },
    census() {
      const all = [...document.getElementsByTagName('*')];
      const cs = all.map((e) => getComputedStyle(e));
      const has = (f) => cs.filter(f).length;
      const imgs = [...document.images].filter((i) => i.naturalWidth);
      let over = 0, decoded = 0, shown = 0;
      for (const i of imgs) {
        const r = i.getBoundingClientRect(); decoded += i.naturalWidth * i.naturalHeight;
        shown += Math.max(1, r.width * r.height) * 9; // deviceScaleFactor 3 squared
        if (i.naturalWidth > r.width * 3 * 1.5 && r.width > 0) over++;
      }
      return { nodes: all.length, canvases: document.getElementsByTagName('canvas').length, imgs: imgs.length,
        filter: has((c) => c.filter !== 'none'), backdrop: has((c) => c.backdropFilter && c.backdropFilter !== 'none'),
        boxShadow: has((c) => c.boxShadow !== 'none'), textShadow: has((c) => c.textShadow !== 'none'),
        blend: has((c) => c.mixBlendMode !== 'normal'), willChange: has((c) => c.willChange !== 'auto'),
        maskImage: has((c) => (c.maskImage && c.maskImage !== 'none')),
        oversizedImgs: over, decodedMpx: Math.round(decoded / 1e5) / 10, neededMpx: Math.round(shown / 1e5) / 10 };
    },
  };
})();`;

// ---- trace analysis ----------------------------------------------------------
const JS_ENTRY = new Set(['FunctionCall', 'EvaluateScript', 'FireAnimationFrame', 'TimerFire', 'EventDispatch',
  'v8.callFunction', 'FireIdleCallback', 'RunMicrotasks', 'v8.run', 'v8.compile']);
const MAIN_NAMES = ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'UpdateLayer',
  'HitTest', 'IntersectionObserverController::computeIntersections', 'MajorGC', 'MinorGC', 'V8.GC_MC_BACKGROUND_MARKING',
  'FunctionCall', 'FireAnimationFrame', 'TimerFire', 'EventDispatch', 'ImageDecodeTask', 'Decode Image', 'Decode LazyPixelRef'];

function analyseTrace(events) {
  const threadName = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threadName.set(`${e.pid}:${e.tid}`, e.args?.name);
  // The page's main thread: the CrRendererMain that fires animation frames.
  const votes = new Map();
  for (const e of events) if (e.name === 'FireAnimationFrame' || e.name === 'RunTask') {
    const k = `${e.pid}:${e.tid}`;
    if (threadName.get(k) === 'CrRendererMain') votes.set(k, (votes.get(k) || 0) + 1);
  }
  const main = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const on = (e) => `${e.pid}:${e.tid}` === main;
  const ms = (e) => (e.dur || 0) / 1000;
  const by = {};
  const add = (k, d, n = 1) => { (by[k] ||= { ms: 0, n: 0 }); by[k].ms += d; by[k].n += n; };
  const jsIv = [];
  for (const e of events) if (e.ph === 'X' && on(e) && JS_ENTRY.has(e.name)) jsIv.push([e.ts, e.ts + (e.dur || 0)]);
  jsIv.sort((a, b) => a[0] - b[0]);
  const inJs = (e) => jsIv.some(([a, b]) => e.ts >= a && e.ts + (e.dur || 0) <= b);
  const forced = new Map(); // "file:line" -> { ms, n }
  let syncLayout = { ms: 0, n: 0 }, syncStyle = { ms: 0, n: 0 };
  for (const e of events) {
    if (e.ph !== 'X') continue;
    if (on(e) && MAIN_NAMES.includes(e.name)) add(e.name, ms(e));
    if (on(e) && (e.name === 'Layout' || e.name === 'UpdateLayoutTree') && inJs(e)) {
      const tgt = e.name === 'Layout' ? syncLayout : syncStyle;
      tgt.ms += ms(e); tgt.n++;
      const f = (e.args?.beginData?.stackTrace || e.args?.stackTrace || [])[0];
      if (f) {
        const k = `${(f.url || '').replace(/^https?:\/\/[^/]+\//, '')}:${f.lineNumber}${f.functionName ? ` ${f.functionName}` : ''}`;
        const kk = (e.name === 'Layout' ? 'L ' : 'S ') + k; const o = forced.get(kk) || { ms: 0, n: 0 }; o.ms += ms(e); o.n++; forced.set(kk, o);
      }
    }
    // Raster and decode run on worker threads: sum them all.
    if (!on(e) && (e.name === 'RasterTask' || e.name === 'ImageDecodeTask' || e.name === 'Decode Image' || e.name === 'Decode LazyPixelRef')) add(`worker:${e.name}`, ms(e));
    if (e.name === 'DrawFrame' && e.ph === 'X') add('DrawFrame', ms(e));
  }
  // Compositor frame cadence: BeginMainThreadFrame / DrawFrame instants.
  const draws = events.filter((e) => e.name === 'Display::FrameDisplayed').map((e) => e.ts / 1000).sort((a, b) => a - b);
  const gaps = draws.slice(1).map((t, i) => t - draws[i]);
  const mainFrames = events.filter((e) => e.ph === 'X' && on(e) && e.name === 'ProxyMain::BeginMainFrame').map(ms);
  // Script time is the union of the JS entry points (they nest: an event handler calls a function).
  let scriptMs = 0, edge = -Infinity;
  for (const [a, b] of jsIv) { if (b > edge) { scriptMs += (b - Math.max(a, edge)) / 1000; edge = b; } }
  const tasks = events.filter((e) => e.ph === 'X' && on(e) && e.name === 'RunTask').map(ms);
  return { by, syncLayout, syncStyle, forced: [...forced.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 16),
    drawGaps: gaps, mainFrames, scriptMs, mainTasksOver50: tasks.filter((d) => d > 50), mainBusyMs: sum(tasks) };
}

const PROBE_NOISE = new Set(['elementFromPoint', 'evaluate', 'tick', 'getAnimations']);
// ---- phase attribution -----------------------------------------------------------
// Each rAF interval (a, b] gets one phase, from the marks (probe input marks 'tap' and the screens' counters):
//   finish      a render() / finishRender() call lands in the interval while a playback is running
//   tap         an input mark lands in it, or an input happened and no beat has been flushed yet
//   enemy turn  combat.dataset.turn is 'enemy' at b (and the interval is not tap / finish)
//   playback    a beat has flushed since the input and the playback has not finished
//   idle        everything else
// Until the screens emit 'finishRender' (the incremental end-of-playback update) a full 'render' during a
// playback is the finish; once they do, 'render' mid-playback would only be a resync, which is counted as such.
const PHASE_COUNTERS = ['render', 'finishRender', 'stage', 'hand', 'beatFlush', 'hudPass', 'hudTrack'];
const PHASES = ['tap', 'playback', 'finish', 'enemy turn', 'idle'];
const TAP_WINDOW_MS = 1500, PLAYBACK_MAX_MS = 4000; // a tap with no beat flush, or a playback with no finish, lapses to idle
function attributePhases(raw) {
  const { frames = [], ft = [], turn = [], marks = [] } = raw;
  const out = [], perMark = [];
  let mi = 0, state = 'idle', since = 0;
  for (let i = 0; i < frames.length; i++) {
    const b = ft[i], a = b - frames[i];
    if (state === 'tap' && a - since > TAP_WINDOW_MS) state = 'idle';
    if (state === 'playback' && a - since > PLAYBACK_MAX_MS) state = 'idle';
    const startState = state;
    let tap = false, finish = false;
    const inFrame = [];
    while (mi < marks.length && marks[mi][1] <= b) {
      const [name, t] = marks[mi++];
      inFrame.push(name);
      if (name === 'tap') { tap = true; state = 'tap'; since = t; }
      else if (name === 'beatFlush' && state === 'tap') { state = 'playback'; since = t; }
      else if ((name === 'finishRender' || name === 'render') && state === 'playback') { finish = true; state = 'idle'; }
    }
    let phase;
    if (finish) phase = 'finish';
    else if (tap || startState === 'tap') phase = 'tap';
    else if (turn[i] === 'enemy') phase = 'enemy turn';
    else if (startState === 'playback') phase = 'playback';
    else phase = 'idle';
    out.push({ d: frames[i], phase });
    perMark.push(inFrame);
  }
  const long = Object.fromEntries(PHASES.map((p) => [p, { n: 0, ms: 0, max: 0 }]));
  const framesBy = Object.fromEntries(PHASES.map((p) => [p, 0]));
  const counts = Object.fromEntries(PHASES.map((p) => [p, {}]));
  out.forEach((f, i) => {
    framesBy[f.phase]++;
    if (f.d > 33.4) { const o = long[f.phase]; o.n++; o.ms += f.d; o.max = Math.max(o.max, f.d); }
    for (const nm of perMark[i]) if (nm !== 'tap') counts[f.phase][nm] = (counts[f.phase][nm] || 0) + 1;
  });
  for (const p of PHASES) { long[p].ms = r1(long[p].ms); long[p].max = r1(long[p].max); }
  return { long, framesBy, counts };
}

// ---- CPU profile -> top self-time functions -----------------------------------
function analyseProfile(profile, top = 25) {
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const total = sum(profile.timeDeltas) / 1000;
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  }
  const agg = new Map();
  for (const [id, t] of self) {
    const f = nodes.get(id).callFrame;
    const file = (f.url || '').replace(/^https?:\/\/[^/]+\//, '');
    const key = f.url ? `${file}:${f.lineNumber + 1} ${f.functionName || '(anonymous)'}` : `${f.functionName || '(native)'}`;
    agg.set(key, (agg.get(key) || 0) + t);
  }
  const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]);
  const meta = (k) => rows.find((r) => r[0] === k)?.[1] || 0;
  return { totalMs: total, idleMs: meta('(idle)'), programMs: meta('(program)'), gcMs: meta('(garbage collector)'),
    // The probe's own calls (hit-testing for its touches, its rAF loop, animation counting) are not the game.
    top: rows.filter((r) => !/^\((idle|program|root|garbage collector)\)$/.test(r[0]) && !PROBE_NOISE.has(r[0])).slice(0, top) };
}

// ---- touch input (real events through CDP) -------------------------------------
function makeInput(cdp, page) {
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // A fan that is still re-laying out has no unobstructed point yet: retry for ~2 s.
  const at = async (selector) => {
    for (let i = 0; ; i++) {
      try { return await page.evaluate(pointerTargetExpression(selector)); }
      catch (e) { if (i >= 8) throw e; await wait(250); }
    }
  };
  const api = {
    at,
    async tapAt({ x, y }, holdMs = 40) { await page.evaluate("window.__perfMark('tap')"); await touch('touchStart', [[x, y]]); await wait(holdMs); await touch('touchEnd', []); },
    async tap(selector, holdMs) { await api.tapAt(await at(selector), holdMs); },
    async hold(selector, ms) { await api.tapAt(await at(selector), ms); },
    // A drag from a to b in `steps` touchMove events, one every ~16 ms; `back` returns to a before release.
    async drag(a, b, { steps = 14, back = false, dwell = 0 } = {}) {
      await page.evaluate("window.__perfMark('tap')");
      await touch('touchStart', [[a.x, a.y]]);
      const go = async (p, q) => { for (let i = 1; i <= steps; i++) { await touch('touchMove', [[p.x + (q.x - p.x) * i / steps, p.y + (q.y - p.y) * i / steps]]); await wait(16); } };
      await go(a, b);
      if (dwell) await wait(dwell);
      if (back) await go(b, a);
      await touch('touchEnd', []);
    },
    async pinch(c, from, to, steps = 12) {
      await page.evaluate("window.__perfMark('tap')");
      const pts = (d) => [[c.x - d, c.y], [c.x + d, c.y]];
      await touch('touchStart', pts(from));
      for (let i = 1; i <= steps; i++) { await touch('touchMove', pts(from + (to - from) * i / steps)); await wait(16); }
      await touch('touchEnd', []);
    },
  };
  return api;
}

async function until(page, expr, what, timeoutMs = 20000) {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(expr)) return;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await wait(100);
  }
}

// ---- scenarios: each is { url, ready, run(ctx) }, `run` is the measured window -
const PLAYABLE = `(() => { const c = window.__combat; return [...document.querySelectorAll('.hand .card:not(.unaffordable)')].map((n) => n.dataset.cardId).length; })()`;
const COMBAT_READY = `!!(window.__combat && document.querySelector('.combatant.enemy') && document.querySelector('.hand .card') && document.querySelector('.end-turn') && !document.querySelector('.end-turn').disabled)`;
const TARGET = `(() => {
  const picker = document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])');
  if (picker) return '.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])';
  const enemy = document.querySelector('.combat[data-target-hud="true"] .combatant.enemy.targetable:not([inert])');
  if (enemy) return '.combat[data-target-hud="true"] .combatant.enemy.targetable:not([inert])';
  const self = document.querySelector('.combatant.player.targetable:not([inert])');
  return self ? '.combatant.player.targetable:not([inert])' : null;
})()`;

// Play one affordable card with real taps: select it, then its target if it asks for one.
async function playCard(ctx, index = 0) {
  const { page, input } = ctx;
  const before = await page.evaluate('window.__combat.piles.hand.length');
  for (let attempt = 0; attempt < 3; attempt++) {
    const ids = await page.evaluate(`[...document.querySelectorAll('.hand .card:not(.unaffordable)')].map((n) => n.dataset.instanceId)`);
    if (!ids.length) return false;
    const sel = `.hand .card[data-instance-id="${ids[Math.min(index, ids.length - 1)]}"]`;
    await input.tap(sel); await wait(350);
    const tgt = await page.evaluate(TARGET);
    log('tap card', sel, 'target', tgt);
    // A card that names no target is played by a second tap on it.
    await input.tap(tgt || sel); await wait(200);
    try { await until(page, `window.__combat.piles.hand.length < ${before}`, 'the card to leave the hand', 12000); await wait(1200); return true; }
    catch { await input.tap('.combat-log, .enemy-row').catch(() => {}); await wait(400); }
  }
  return false;
}
async function endTurn(ctx) {
  const { page, input } = ctx;
  const turn = await page.evaluate('window.__combat.turn');
  await input.hold('.end-turn', 1200);
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(`window.__combat.turn > ${turn} && !document.querySelector('.end-turn').disabled`)) break;
    if (await page.evaluate(`!!document.querySelector('.reaction-choice [data-control-role="exit"]')`)) await input.tap('.reaction-choice [data-control-role="exit"]');
    if (Date.now() - t0 > 60000) throw new Error('the enemies never handed the turn back');
    await wait(100);
  }
  await wait(600);
}

const SCENARIOS = {
  combat: {
    title: 'Combat turn (2-3 cards, End Turn, enemy turn)',
    url: (s) => `?shot=combat&shotSeed=${s}`, ready: COMBAT_READY,
    async run(ctx) {
      let played = 0;
      for (let i = 0; i < 3; i++) if (await playCard(ctx)) played++;
      if (played < 2) throw new Error(`only ${played} card(s) played`);
      await endTurn(ctx);
      return { cardsPlayed: played };
    },
  },
  // The deterministic metric (wave 4 step 0): one card play, counted rather than timed. The
  // counters are `globalThis.__perfCount?.(name)` calls in the combat screen and the battlefield stage, live only
  // where the probe installs window.__perfCount. Run `--scenario play --runs 5`.
  play: {
    title: 'One card play (counted renders, HUD passes, forced layouts)',
    url: (s) => `?shot=combat&shotSeed=${s}`, ready: COMBAT_READY,
    async run(ctx) {
      if (!await playCard(ctx)) throw new Error('the card was not played');
      // playCard returns ~1.2 s after the dispatch; the playback's finish (the full render, or finishRender once
      // the screen emits it) lands after that, so the window waits for it, then one more frame.
      let finishSeen = true;
      try { await until(ctx.page, `((window.__perfCounts.render || 0) + (window.__perfCounts.finishRender || 0)) > 0`, 'the playback to finish', 8000); }
      catch { finishSeen = false; }
      await wait(500);
      return { cardsPlayed: 1, finishSeen };
    },
  },
  // The same window with no input at all: what the combat screen costs while it only animates.
  idle: {
    title: 'Combat idle (3.5 s, no input)',
    url: (s) => `?shot=combat&shotSeed=${s}`, ready: COMBAT_READY,
    async run() { await wait(3500); return {}; },
  },
  map: {
    title: 'Act map (pan, drag, one zoom)',
    url: (s) => `?shot=map&shotSeed=${s}&shotWalk=3`, ready: `!!document.querySelector('.map-scroll[data-detail-state="ready"]')`,
    // Unmeasured: find open ground where a touch drag really pans (a press on a node, or under some
    // overlays, is swallowed), by trying a short drag at a few points and watching the scroll offset.
    async setup(ctx) {
      const { page, input } = ctx;
      const read = () => page.evaluate(`(() => { const m = document.querySelector('.map-scroll'); return m.scrollLeft + ',' + m.scrollTop; })()`);
      for (const [x, y] of [[195, 420], [60, 300], [330, 300], [60, 600], [330, 600], [195, 250], [195, 640], [120, 180]]) {
        const before = await read();
        await input.drag({ x, y }, { x: x + 40, y: y + 40 }, { steps: 6 }); await wait(400);
        if (before !== await read()) { ctx.panFrom = { x: Math.min(250, Math.max(140, x)), y: Math.min(560, Math.max(300, y)) }; log('pan point', ctx.panFrom); return; }
      }
      throw new Error('no point on the map pans under a touch drag');
    },
    async run(ctx) {
      const { page, input } = ctx;
      const c = ctx.panFrom;
      const pos = () => page.evaluate(`(() => { const m = document.querySelector('.map-scroll'); return [Math.round(m.scrollLeft), Math.round(m.scrollTop), document.querySelector('.map-scroll').dataset.framingZoom || null]; })()`);
      const p0 = await pos();
      if (DEBUG) await page.evaluate(`window.__ev = []; for (const t of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup']) document.addEventListener(t, (e) => window.__ev.push(t + ':' + e.pointerType), { capture: true, passive: true });`);
      const dirs = [[-150, 0], [0, -160], [150, 0], [0, 160], [-110, -110], [110, 110]];
      for (const [dx, dy] of dirs) { await input.drag(c, { x: c.x + dx, y: c.y + dy }, { steps: 18 }); await wait(250); log('pan', c, dx, dy, await pos(), await page.evaluate('(window.__ev || []).splice(0).join(" ")').then((x) => x.slice(0, 120))); }
      await input.tap('.zbtn.zoom-in'); await wait(700);
      for (const [dx, dy] of dirs.slice(0, 3)) { await input.drag(c, { x: c.x + dx, y: c.y + dy }, { steps: 18 }); await wait(250); }
      await input.tap('.zbtn.zoom-reset'); await wait(700);
      return { scrollBefore: p0, scrollAfter: await pos() };
    },
  },
  hand: {
    title: 'Hand interaction (drag a card, inspect, close)',
    url: (s) => `?shot=combat&shotSeed=${s}`, ready: COMBAT_READY,
    async run(ctx) {
      const { page, input } = ctx;
      let inspected = 0;
      for (let round = 0; round < 2; round++) {
        // Targeted cards only (an Attack): released away from an enemy they are never played by accident.
        const ids = await page.evaluate(`[...document.querySelectorAll('.hand .card.type-attack:not(.unaffordable)')].map((n) => n.dataset.instanceId)`);
        if (!ids.length) throw new Error('no Attack card in the opening hand of this seed');
        const dragSel = `.hand .card[data-instance-id="${ids[(round + 1) % ids.length]}"]`;
        // The inspect card is the same each round: some other cards' info buttons sit under a field hit box.
        const sel = `.hand .card[data-instance-id="${ids[0]}"]`;
        // Drag the card up toward the field, dwell, bring it back and release (no play).
        const a = await input.at(dragSel);
        await input.drag(a, { x: a.x + 30, y: a.y - 230 }, { steps: 16, dwell: 300, back: true });
        await wait(500);
        if (!await page.evaluate(`!!document.querySelector(${JSON.stringify(dragSel)})`)) throw new Error('the dragged card was played');
        // Inspect: the first tap selects the card and reveals its info button, the button opens the modal.
        // A tap that lands while the fan is re-laying out can miss, so each step is retried a few times.
        let opened = false;
        for (let attempt = 0; attempt < 2 && !opened; attempt++) {
          // A card that is still selected from before is not tapped again (that would play or toggle it).
          const state = await page.evaluate(`(() => { const c = document.querySelector(${JSON.stringify(sel)}); return c ? [c.classList.contains('selected'), c.classList.contains('inspection-info-visible')].join() : 'gone'; })()`);
          if (state === 'true,false') { await page.keyboard.press('Escape'); await wait(500); }
          if (state !== 'true,true') await input.tap(sel).catch((e) => log('select', e.message));
          // Once the card's inspection is revealed, the hand lifts its info button out as `.hand-info-portal`.
          await until(page, `(() => { const b = document.querySelector('.hand-info-portal'); return !!b && getComputedStyle(b).visibility !== 'hidden' && b.getBoundingClientRect().width > 0 && !!document.querySelector('.hand .card.inspection-info-visible'); })()`, 'the info button', 4000).catch((e) => log(e.message));
          if (DEBUG) log('portal', await page.evaluate(`(() => { const b = document.querySelector('.hand-info-portal'); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return JSON.stringify([r.x, r.y, r.width, r.height]) + ' hit ' + (h && (h.className || h.tagName)).toString().slice(0, 50) + ' sel ' + [...document.querySelectorAll('.hand .card.selected')].map((c) => c.dataset.cardId); })()`));
          await input.tap('.hand-info-portal').catch((e) => log('info', e.message)); await wait(900);
          opened = await page.evaluate(`!!document.querySelector('.card-inspection-modal')`);
          if (!opened) { await page.keyboard.press('Escape'); await wait(500); }
        }
        inspected += opened ? 1 : 0;
        log('modal', opened);
        await page.keyboard.press('Escape'); await wait(700);
      }
      return { inspectsOpened: inspected };
    },
  },
  transitions: {
    title: 'Transitions (last hit -> reward -> map)',
    url: (s) => `?shot=combat&shotSeed=${s}`, ready: COMBAT_READY,
    // Setup (unmeasured): leave the enemy one hit from death. The measured window is real taps from
    // the killing blow through the reward screen to the act map.
    async setup(ctx) { await ctx.page.evaluate(`window.__combat.enemies.forEach((e) => { e.hp = 1; })`); },
    async run(ctx) {
      const { page, input } = ctx;
      const atkIds = await page.evaluate(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { hasImmediateHostileDamage } = await import('/tools/click-impact-card.mjs');
        const combat = window.__combat;
        return [...document.querySelectorAll('.hand .card:not(.unaffordable)')].filter((node) => {
          const inst = combat.piles.hand.find((c) => c.instanceId === node.dataset.instanceId);
          return inst && hasImmediateHostileDamage(resolveCombatCard(combat, inst), { targeted: true });
        }).map((n) => n.dataset.instanceId);
      })()`);
      if (!atkIds.length) throw new Error('no attack in the opening hand of this seed');
      const sel = `.hand .card[data-instance-id="${atkIds[0]}"]`;
      await input.tap(sel); await wait(350);
      const tgt = await page.evaluate(TARGET); if (tgt) await input.tap(tgt);
      await until(page, `!!document.querySelector('#reward-continue, .reward, .map-scroll')`, 'the reward screen', 30000);
      log('reward screen up', await page.evaluate(`[...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width).map((b) => b.id + '.' + b.className.slice(0, 30)).join(' | ')`));
      await wait(2500); // the reward menu's own count-up / entrance
      for (let i = 0; i < 4; i++) {
        if (await page.evaluate(`!!document.querySelector('.map-scroll') && !document.querySelector('#reward-continue')`)) break;
        await input.hold('#reward-continue', 1300).catch((e) => log('continue', e.message));
        await wait(1500);
      }
      await until(page, `!!document.querySelector('.map-scroll[data-detail-state="ready"]') && !document.querySelector('#reward-continue')`, 'the act map', 30000);
      await wait(800);
      return {};
    },
  },
};

// ---- one pass -----------------------------------------------------------------
async function onePass(browser, base, name, opts) {
  const { trace, profile } = opts;
  const sc = SCENARIOS[name];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(INIT);
  const cdp = await ctx.newCDPSession(page);
  const bcdp = await browser.newBrowserCDPSession();
  let traceOn = false;
  try {
    await page.goto(base + sc.url(SEED));
    await until(page, sc.ready, 'the scenario to mount', 60000);
    await wait(2500); // art decode and entrance motion settle before the window opens
    const c = { page, cdp, input: makeInput(cdp, page) };
    if (sc.setup) await sc.setup(c);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await wait(600);
    const calibMs = r1(await page.evaluate(CALIBRATION));
    let unstable = null;
    if (calib.ref === null) calib.ref = calibMs;
    const drift = (calibMs - calib.ref) / calib.ref;
    log('calibration', calibMs, 'ref', calib.ref, 'drift', r1(drift * 100) + '%');
    if (Math.abs(drift) > CALIB_TOLERANCE) {
      const msg = `calibration ${calibMs} ms vs ${calib.ref} ms (${drift > 0 ? '+' : ''}${r1(drift * 100)}%)`;
      if (opts.rejectable) { const e = new Error(msg); e.calibration = true; throw e; }
      unstable = msg;
    }
    const census = await page.evaluate('window.__perf.census()');
    const events = [];
    if (trace) {
      traceOn = true;
      bcdp.on('Tracing.dataCollected', (m) => events.push(...m.value));
      await bcdp.send('Tracing.start', { traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: [
        'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack',
        'v8', 'cc', 'viz', 'gpu', 'blink'] } });
    }
    if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await page.evaluate('window.__perf.start()');
    const t0 = Date.now();
    const extra = await sc.run(c);
    const wall = Date.now() - t0;
    const raw = await page.evaluate('window.__perf.stop()');
    const counts = await page.evaluate('window.__perf.counts()');
    const end = await page.evaluate('window.__perf.census()');
    let traceOut = null, profOut = null;
    if (profile) { const { profile: p } = await cdp.send('Profiler.stop'); profOut = analyseProfile(p); if (process.env.PERF_PROFILE_DIR) { mkdirSync(process.env.PERF_PROFILE_DIR, { recursive: true }); writeFileSync(join(process.env.PERF_PROFILE_DIR, `${name}-${Date.now()}.cpuprofile`), JSON.stringify(p)); } }
    if (trace) {
      const done = new Promise((res) => bcdp.once('Tracing.tracingComplete', res));
      await bcdp.send('Tracing.end'); await done; traceOn = false;
      traceOut = analyseTrace(events);
      if (KEEP_TRACE) { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, `trace-${name}-${Date.now()}.json`), JSON.stringify({ traceEvents: events })); }
    }
    const f = raw.frames;
    const peak = (i) => Math.max(0, ...raw.anim.map((a) => a[i]));
    const phases = attributePhases(raw);
    return { wallMs: wall, calibMs, unstable, phases, errors, extra, census, end, counts,
      frameList: f.map((d) => Math.round(d * 10) / 10),
      frames: { n: f.length, n33: f.filter((d) => d > 33.4).length, n100: f.filter((d) => d > 100).length, medianMs: r1(median(f)), p95: r1(pct(f, 0.95)), p99: r1(pct(f, 0.99)), maxMs: r1(Math.max(0, ...f)),
        over16: r1(100 * f.filter((d) => d > 16.7 + 0.5).length / (f.length || 1)), over33: r1(100 * f.filter((d) => d > 33.4).length / (f.length || 1)) },
      long: { n: raw.long.length, totalMs: r1(sum(raw.long)), blockingMs: r1(sum(raw.long.map((d) => Math.max(0, d - 50)))), maxMs: r1(Math.max(0, ...raw.long)) },
      anim: { peakRunning: peak(0), peakTransitions: peak(1), peakInfinite: peak(2), meanRunning: r1(median(raw.anim.map((a) => a[0]))) },
      trace: traceOut, profile: profOut };
  } finally {
    // A failed pass must not leave the browser-wide trace running for the next one.
    if (traceOn) { const done = new Promise((res) => bcdp.once('Tracing.tracingComplete', res)); await bcdp.send('Tracing.end').catch(() => {}); await Promise.race([done, wait(5000)]); }
    await ctx.close().catch(() => {});
  }
}

// ---- report -------------------------------------------------------------------
const med = (rs, get) => median(rs.map(get).filter((x) => Number.isFinite(x)));
function summarise(name, runs) {
  const A = runs.map((r) => r.a);
  const t = (k) => med(A, (r) => r.trace?.by[k]?.ms ?? 0);
  const tn = (k) => med(A, (r) => r.trace?.by[k]?.n ?? 0);
  return {
    scenario: name, runs: runs.length, windowS: r1(med(A, (r) => r.wallMs) / 1000),
    frames: Object.fromEntries(['n', 'n33', 'n100', 'medianMs', 'p95', 'p99', 'maxMs', 'over16', 'over33'].map((k) => [k, med(A, (r) => r.frames[k])])),
    long: { n: med(A, (r) => r.long.n), totalMs: med(A, (r) => r.long.totalMs), blockingMs: med(A, (r) => r.long.blockingMs), maxMs: med(A, (r) => r.long.maxMs) },
    anim: { peakRunning: med(A, (r) => r.anim.peakRunning), peakTransitions: med(A, (r) => r.anim.peakTransitions), peakInfinite: med(A, (r) => r.anim.peakInfinite) },
    traceMs: { style: r1(t('UpdateLayoutTree')), styleN: tn('UpdateLayoutTree'), layout: r1(t('Layout')), layoutN: tn('Layout'),
      prepaint: r1(t('PrePaint')), paint: r1(t('Paint')), layerize: r1(t('Layerize')), commit: r1(t('Commit')),
      script: r1(med(A, (r) => r.trace?.scriptMs ?? 0)),
      gc: r1(t('MajorGC') + t('MinorGC')),
      raster: r1(t('worker:RasterTask')), decode: r1(t('worker:ImageDecodeTask') + t('worker:Decode Image') + t('worker:Decode LazyPixelRef')),
      syncLayout: r1(med(A, (r) => r.trace?.syncLayout.ms ?? 0)), syncLayoutN: med(A, (r) => r.trace?.syncLayout.n ?? 0),
      syncStyle: r1(med(A, (r) => r.trace?.syncStyle.ms ?? 0)), syncStyleN: med(A, (r) => r.trace?.syncStyle.n ?? 0),
      mainBusy: r1(med(A, (r) => r.trace?.mainBusyMs ?? 0)), drawGapMedian: r1(med(A, (r) => median(r.trace?.drawGaps ?? []))),
      drawGapP95: r1(med(A, (r) => pct(r.trace?.drawGaps ?? [], 0.95))), drawFrames: med(A, (r) => (r.trace?.drawGaps.length ?? 0) + 1),
      mainFrameMedian: r1(med(A, (r) => median(r.trace?.mainFrames ?? []))), mainFrameP95: r1(med(A, (r) => pct(r.trace?.mainFrames ?? [], 0.95))), mainFrameMax: r1(med(A, (r) => Math.max(0, ...(r.trace?.mainFrames ?? [])))) },
    forced: (A[0].trace?.forced || []).map(([k, v]) => `${k} x${v.n} ${r1(v.ms)} ms`),
    census: { start: A[0].census, end: A[A.length - 1].end },
    extra: A[0].extra,
    profileTop: mergeProfiles(runs.map((r) => r.b?.profile).filter(Boolean)),
    profileTotals: PROFILE ? { totalMs: r1(med(runs.map((r) => r.b), (b) => b?.profile?.totalMs)), idleMs: r1(med(runs.map((r) => r.b), (b) => b?.profile?.idleMs)),
      programMs: r1(med(runs.map((r) => r.b), (b) => b?.profile?.programMs)), gcMs: r1(med(runs.map((r) => r.b), (b) => b?.profile?.gcMs)) } : null,
    counts: Object.fromEntries([...new Set(A.flatMap((r) => Object.keys(r.counts || {})))].sort().map((k) => [k, med(A, (r) => r.counts?.[k] ?? 0)])),
    phases: Object.fromEntries(PHASES.map((ph) => [ph, {
      frames: r1(med(A, (r) => r.phases?.framesBy[ph] ?? 0)),
      longN: r1(med(A, (r) => r.phases?.long[ph].n ?? 0)), longMs: r1(med(A, (r) => r.phases?.long[ph].ms ?? 0)), longMax: r1(med(A, (r) => r.phases?.long[ph].max ?? 0)),
      counts: Object.fromEntries(PHASE_COUNTERS.map((k) => [k, r1(med(A, (r) => r.phases?.counts[ph][k] ?? 0))])) }])),
    errors: [...new Set(runs.flatMap((r) => [...r.a.errors, ...(r.b?.errors || [])]))].slice(0, 5),
  };
}
function mergeProfiles(ps) {
  const m = new Map();
  for (const p of ps) for (const [k, v] of p.top) (m.get(k) || m.set(k, []).get(k)).push(v);
  return [...m.entries()].map(([k, v]) => [k, r1(median(v.concat(Array(Math.max(0, ps.length - v.length)).fill(0))))]).sort((a, b) => b[1] - a[1]).slice(0, 15);
}

// ---- certification ---------------------------------------------------------------
// Targets (docs/PERF-MOBILE-BASELINE.md): decided on the trimmed median of the runs, never a single run.
// Note frame deltas are vsync-quantised (16.7 / 33.4 / 50 ...), so "p95 <= 33" means p95 = 16.7: fewer than
// 5% of frames may take two vsyncs or more.
const TARGETS = {
  combat: [['p95 ms', (f) => f.p95, 100], ['frames > 33 ms %', (f) => f.over33, 8], ['blocking ms', (f, l) => l.blockingMs, 2800]],
  hand: [['p95 ms', (f) => f.p95, 33]],
};
function certify(name, runs) {
  const A = runs.map((r) => r.a);
  const row = (a, i) => {
    const f = a.frames, fl = a.frameList;
    return { i: i + 1, p95: f.p95, n33: f.n33 ?? (fl ? fl.filter((d) => d > 33.4).length : NaN), over33: f.over33, over16: f.over16,
      n100: f.n100 ?? (fl ? fl.filter((d) => d > 100).length : NaN), over100: r1(100 * (f.n100 ?? (fl ? fl.filter((d) => d > 100).length : 0)) / (f.n || 1)),
      blocking: a.long.blockingMs, max: f.maxMs, frames: f.n, calib: a.calibMs ?? NaN, unstable: a.unstable || null };
  };
  const rows = A.map(row);
  const cols = [['p95 ms', 'p95'], ['frames>33ms (n)', 'n33'], ['frames>33ms %', 'over33'], ['frames>100ms (n)', 'n100'], ['frames>100ms %', 'over100'], ['>16.7 %', 'over16'], ['blocking ms', 'blocking'], ['max ms', 'max'], ['frames', 'frames'], ['calib ms', 'calib']];
  const out = [];
  out.push(`\n## certify ${name}: ${SCENARIOS[name].title} — ${runs.length} run(s)`);
  out.push(`| run | ${cols.map((c) => c[0]).join(' | ')} | note |`);
  out.push(`|---|${cols.map(() => '---').join('|')}|---|`);
  for (const r of rows) out.push(`| ${r.i} | ${cols.map((c) => r[c[1]]).join(' | ')} | ${r.unstable ? 'UNSTABLE: ' + r.unstable : ''} |`);
  const tm = (k) => r1(trimmedMedian(rows.map((r) => r[k])));
  const lo = (k) => Math.min(...rows.map((r) => r[k])), hi = (k) => Math.max(...rows.map((r) => r[k]));
  out.push(`| **trimmed median** | ${cols.map((c) => `**${tm(c[1])}**`).join(' | ')} | drop min and max |`);
  out.push(`| min-max | ${cols.map((c) => `${r1(lo(c[1]))}-${r1(hi(c[1]))}`).join(' | ')} | |`);
  const verdicts = [];
  for (const [label, get, limit] of TARGETS[name] || []) {
    const vals = A.map((a) => get(a.frames, a.long));
    const t = r1(trimmedMedian(vals));
    verdicts.push({ label, t, limit, pass: t <= limit, perRunPass: vals.map((v) => v <= limit) });
    // The limit sits inside the kept (middle) runs: the verdict is not decidable at this noise, say so.
    const inner = sorted(vals).slice(vals.length >= 3 ? 1 : 0, vals.length >= 3 ? -1 : undefined);
    const borderline = Math.min(...inner) <= limit && Math.max(...inner) > limit;
    verdicts[verdicts.length - 1].borderline = borderline;
    out.push(`target ${name} ${label} <= ${limit}: trimmed median ${t} -> ${t <= limit ? 'PASS' : 'FAIL'}${borderline ? ' (BORDERLINE: the limit lies inside the kept runs)' : ''} (runs passing ${vals.filter((v) => v <= limit).length}/${vals.length})`);
  }
  return { text: out.join('\n'), rows, verdicts, tm: Object.fromEntries(cols.map((c) => [c[1], tm(c[1])])) };
}

// ---- main ---------------------------------------------------------------------
// A pass that fails (a tap swallowed while the fan re-lays out, a timeout under throttle) is
// retried on a fresh page, up to three times, so one flaky input does not lose the run.
async function passWithRetry(browser, base, name, opts) {
  let drifted = 0;
  for (let attempt = 1; ; attempt++) {
    try { return await onePass(browser, base, name, { ...opts, rejectable: drifted < CALIB_RETRIES }); }
    catch (e) {
      if (e.calibration) { drifted++; calib.rejected++; process.stderr.write(` [${e.message}: pass rerun ${drifted}/${CALIB_RETRIES}]`); attempt--; continue; }
      process.stderr.write(` [attempt ${attempt} failed: ${String(e.message).split('\n')[0].slice(0, 90)}]`);
      if (attempt >= 3) throw e;
    }
  }
}
// --from DIR: summarise the runs-*.json an earlier invocation saved there, without measuring again.
const FROM = arg('--from', null);
const summaries = [];
const allRuns = {};
const droppedRuns = [];
if (FROM) {
  const { readFileSync, existsSync } = await import('node:fs');
  for (const name of Object.keys(SCENARIOS).filter((n) => WANT.has(n))) {
    const f = join(resolve(FROM), `runs-${name}.json`);
    if (existsSync(f)) { allRuns[name] = JSON.parse(readFileSync(f, 'utf8')); summaries.push(summarise(name, allRuns[name])); }
  }
} else {
  checkHostIdle();
  const server = await serve({ root: ROOT, port: 0, open: false, quiet: true });
  const base = `http://localhost:${server.server.address().port}/`;
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  try {
    for (const name of Object.keys(SCENARIOS).filter((n) => WANT.has(n))) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        process.stderr.write(`${name} run ${i + 1}/${RUNS} ...`);
        // A run that still fails after its retries (e.g. the page never loads) is dropped and reported, not fatal:
        // the runs already measured are kept.
        let a, b = null;
        try {
          a = await passWithRetry(browser, base, name, { trace: true, profile: false });
          b = PROFILE ? await passWithRetry(browser, base, name, { trace: false, profile: true }) : null;
        } catch (e) { process.stderr.write(` run dropped: ${String(e.message).split('\n')[0].slice(0, 80)}\n`); droppedRuns.push(`${name} run ${i + 1}`); continue; }
        process.stderr.write(` calib ${a.calibMs} ms${a.unstable ? ' UNSTABLE' : ''}, median frame ${a.frames.medianMs} ms, p95 ${a.frames.p95}, ${a.frames.over16}% over 16.7\n`);
        runs.push({ a, b });
      }
      if (!runs.length) continue;
      allRuns[name] = runs;
      summaries.push(summarise(name, runs));
      mkdirSync(OUT, { recursive: true });
      writeFileSync(join(OUT, `runs-${name}.json`), JSON.stringify(runs));
    }
  } finally {
    await browser.close().catch(() => {});
    server.server.close();
  }
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summaries, null, 1));

console.log(`# perf-probe: ${THROTTLE}x CPU throttle, 390x844 @3x, seed ${SEED}, ${CERTIFY ? 'trimmed median (min and max dropped) of' : 'median of'} ${RUNS} run(s)\n`);
if (CERTIFY) { for (const s of summaries) console.log(certify(s.scenario, allRuns[s.scenario]).text); console.log(); }

console.log('| scenario | window s | frames | median ms | p95 | p99 | >16.7 % | >33 % | long tasks (n / total ms / blocking ms) | peak anims (running / transitions / infinite) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const s of summaries) {
  console.log(`| ${s.scenario} | ${s.windowS} | ${s.frames.n} | ${s.frames.medianMs} | ${s.frames.p95} | ${s.frames.p99} | ${s.frames.over16} | ${s.frames.over33} | ${s.long.n} / ${s.long.totalMs} / ${s.long.blockingMs} | ${s.anim.peakRunning} / ${s.anim.peakTransitions} / ${s.anim.peakInfinite} |`);
}
console.log('\n| scenario | style ms (n) | layout ms (n) | sync layout ms (n) | sync style ms (n) | prepaint | paint | layerize | commit | script | GC | raster (workers) | decode (workers) | main busy | displayed-frame gap median / p95 (n) | main-frame work median / p95 / max |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of summaries) {
  const t = s.traceMs;
  console.log(`| ${s.scenario} | ${t.style} (${t.styleN}) | ${t.layout} (${t.layoutN}) | ${t.syncLayout} (${t.syncLayoutN}) | ${t.syncStyle} (${t.syncStyleN}) | ${t.prepaint} | ${t.paint} | ${t.layerize} | ${t.commit} | ${t.script} | ${t.gc} | ${t.raster} | ${t.decode} | ${t.mainBusy} | ${t.drawGapMedian} / ${t.drawGapP95} (${t.drawFrames}) | ${t.mainFrameMedian} / ${t.mainFrameP95} / ${t.mainFrameMax} |`);
}
console.log('\n| scenario | DOM nodes (start / end) | canvases | imgs | filter | backdrop-filter | box-shadow | text-shadow | blend | will-change | oversized imgs | decoded Mpx vs needed |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of summaries) {
  const a = s.census.start, e = s.census.end;
  console.log(`| ${s.scenario} | ${a.nodes} / ${e.nodes} | ${e.canvases} | ${e.imgs} | ${e.filter} | ${e.backdrop} | ${e.boxShadow} | ${e.textShadow} | ${e.blend} | ${e.willChange} | ${e.oversizedImgs} | ${e.decodedMpx} / ${e.neededMpx} |`);
}
if (summaries.some((s) => s.scenario === 'play')) {
  console.log('\n| per card play (median) | full renders | stage renders | hand renders | beat flushes | HUD placement passes | HUD tracking frames | forced layouts | forced style | script ms | style ms | layout ms | script+style+layout ms |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of summaries.filter((x) => x.scenario === 'play')) {
    const c = s.counts, t = s.traceMs;
    console.log(`| play | ${c.render ?? 0} | ${c.stage ?? 0} | ${c.hand ?? 0} | ${c.beatFlush ?? 0} | ${c.hudPass ?? 0} | ${c.hudTrack ?? 0} | ${t.syncLayoutN} | ${t.syncStyleN} | ${t.script} | ${t.style} | ${t.layout} | ${r1(t.script + t.style + t.layout)} |`);
  }
}
if (summaries.some((x) => x.phases && PHASES.some((ph) => x.phases[ph].frames))) {
  console.log('\n### long frames (> 33.4 ms) by phase (median over runs; tap = input to first beat flush, playback = beats to finish, finish = the end-of-playback render frame, enemy turn = dataset.turn enemy, idle = the rest)');
  console.log(`| scenario | ${PHASES.map((ph) => `${ph}: frames / long n / long ms / worst ms`).join(' | ')} |`);
  console.log(`|---|${PHASES.map(() => '---').join('|')}|`);
  for (const s of summaries) console.log(`| ${s.scenario} | ${PHASES.map((ph) => { const o = s.phases[ph]; return `${o.frames} / ${o.longN} / ${o.longMs} / ${o.longMax}`; }).join(' | ')} |`);
  console.log('\n### render counts by phase (median over runs; finishRender stays 0 until the screen emits it)');
  console.log(`| scenario | phase | ${PHASE_COUNTERS.join(' | ')} |`);
  console.log(`|---|---|${PHASE_COUNTERS.map(() => '---').join('|')}|`);
  for (const s of summaries) for (const ph of PHASES) { const o = s.phases[ph]; if (PHASE_COUNTERS.some((k) => o.counts[k])) console.log(`| ${s.scenario} | ${ph} | ${PHASE_COUNTERS.map((k) => o.counts[k]).join(' | ')} |`); }
}
for (const s of summaries) {
  console.log(`\n## ${s.scenario}: top JS self time (CPU profile, median ms over the window)${s.profileTotals ? ` — profile total ${s.profileTotals.totalMs} ms, idle ${s.profileTotals.idleMs}, native/program ${s.profileTotals.programMs}, GC ${s.profileTotals.gcMs}` : ''}`);
  for (const [k, v] of s.profileTop) console.log(`  ${String(v).padStart(8)} ms  ${k}`);
  if (s.forced.length) { console.log('  synchronous layout/style, by JS caller (first run; L = layout, S = style recalc):'); for (const f of s.forced) console.log(`    ${f}`); }
  if (s.errors.length) console.log(`  page errors: ${s.errors.join(' | ')}`);
  if (s.extra && Object.keys(s.extra).length) console.log(`  ${JSON.stringify(s.extra)}`);
}
if (droppedRuns.length) console.log(`\nDROPPED runs (failed after retries, the report has fewer runs than asked): ${droppedRuns.join(', ')}`);
if (calib.ref !== null) console.log(`\ncalibration: reference ${calib.ref} ms (first pass), tolerance ${CALIB_TOLERANCE * 100}%, ${calib.rejected} pass(es) rerun`);
console.log(`\nraw per-run JSON: ${OUT}`);
process.exit(0);
