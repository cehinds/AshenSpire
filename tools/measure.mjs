// tools/measure.mjs — measured counts against budgets, so a performance PR can
// show before/after numbers instead of an argument.
//
//   node tools/measure.mjs [--url http://localhost:PORT[/path]] [--serve]
//                          [--json out.json] [--budget] [--scenes title,combat]
//
// WHAT IT DRIVES. The game on a phone profile (390x844, touch, DPR 3) through
// the existing boot states `?shot=title|map|combat|rest|shop` (src/main.js,
// `shotState`). --serve starts tools/serve.mjs itself on a free port and serves
// this checkout; --url points at any server instead (a build folder served by
// tools/serve.mjs --root build, say; a path in the URL is kept, `?shot=` is
// appended). With neither, the default is --serve.
//
// WHAT IT PRINTS. One line per scene, counts first (these are the numbers that
// are gated; they do not move with the machine):
//
//   MEASURE <scene> nodes=<DOM elements> filters=<elements with computed
//           filter != none> anims=<running CSS animations> requests=<n>
//           bytes=<transferred>
//   MEASURE boot dcl_ms=<DOMContentLoaded> longest_task_ms=<longest long task>
//   MEASURE combat.play plays=<n> layouts=<..> recalcs=<..> forcedReads=<..>
//           mutations=<..> longTasks=<..> longTasksMs=<..>
//
// `combat.play` is THREE REAL TOUCH PLAYS (tap a card in the hand, then tap the
// enemy when the card wants a target) and every figure on it is the MEAN PER
// PLAY. Fewer than three landing is a failed attempt (retried once, then exit 2
// and a budget run fails too); --json still gets the partial means under
// `play.partial: true`, which budget checks ignore. layouts and
// recalcs are CDP Performance.getMetrics deltas over the play window; forcedReads
// counts getBoundingClientRect + getComputedStyle calls the page made (a
// page.addInitScript wrapper; this tool's own reads go around it);
// mutations is the MutationObserver record count on <body>; longTasks and
// longTasksMs are PerformanceObserver `longtask` entries (>= 50 ms) that started
// in the window. The play window is the tap plus 2.7 s of settle.
//
// TIMES ARE REPORTED, NEVER GATED (dcl_ms, longest_task_ms, longTasksMs): this
// is a loaded 2-core box in CI, and a millisecond figure on it is a mood.
//
// --budget compares the counts against BUDGET below and exits 1 when any value
// exceeds its budget by more than 25% (a value that could not be measured counts
// as a failure). The default run exits 0. TODAY'S NUMBERS ARE EXPECTED TO FAIL
// the budget; that is the point, the budget is the target the performance PRs
// are written against. The figures come from the owner's performance review of
// origin/dev a0b54c60e.
//
// A scene is measured once its element count holds still; a scene that fails
// is tried a second time, and one that fails twice is named on stderr (exit 2).
// --scenes limits the run to some of title,map,combat,rest,shop (a budget run
// then reports the budgets it could not measure as missing). MEASURE_DEBUG=1
// traces the touch plays on stderr.
//
// Needs only node, Playwright (PLAYWRIGHT_MODULE, then `playwright`, then
// /opt/npm-tools/node_modules) and a chromium (CHROME, then /opt/pw-browsers/
// chromium, via tools/browser.mjs resolveBrowser). It changes nothing in src/.

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const VIEWPORT = { width: 390, height: 844 };
export const DPR = 3;
export const SCENES = ['title', 'map', 'combat', 'rest', 'shop'];
export const PLAYS_WANTED = 3;
export const SLACK = 0.25;

/** key -> ceiling. Keys are `<scene>.<count>` or `play.<count>`. */
export const BUDGET = {
  'combat.nodes': 1000,
  'combat.filters': 30,
  'play.layouts': 30,
  'play.forcedReads': 300,
  'play.recalcs': 100,
  'play.mutations': 500,
  'play.longTasks': 2,
};

/** Flatten a result into the budget key space. */
export function budgetValues(result) {
  const v = {};
  const combat = result?.scenes?.combat;
  if (combat) for (const k of ['nodes', 'filters']) if (Number.isFinite(combat[k])) v[`combat.${k}`] = combat[k];
  const play = result?.play;
  if (play && !play.partial && play.plays >= PLAYS_WANTED) {
    for (const k of ['layouts', 'recalcs', 'forcedReads', 'mutations', 'longTasks']) {
      if (Number.isFinite(play[k])) v[`play.${k}`] = play[k];
    }
  }
  return v;
}

/**
 * Compare measured values with budgets. A row is over when the value is more
 * than `slack` above its budget (value > budget * 1.25); a budget with no
 * measured value is `missing`, and missing fails like over does.
 */
export function checkBudget(values, budgets = BUDGET, slack = SLACK) {
  return Object.entries(budgets).map(([key, budget]) => {
    const value = values[key];
    const limit = budget * (1 + slack);
    if (!Number.isFinite(value)) return { key, value: null, budget, limit, status: 'missing' };
    return { key, value, budget, limit, status: value > limit ? 'over' : 'ok' };
  });
}

export const budgetFailed = (rows) => rows.some((r) => r.status !== 'ok');

export function parseArgs(argv) {
  const out = { url: null, serve: false, json: null, budget: false, scenes: SCENES };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--serve') out.serve = true;
    else if (a === '--budget') out.budget = true;
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--json') out.json = argv[++i];
    else if (a === '--scenes') out.scenes = String(argv[++i] ?? '').split(',').filter(Boolean);
    else throw new Error(`measure: unknown argument ${a}`);
  }
  if (out.url === undefined || out.json === undefined) throw new Error('measure: --url and --json each need a value');
  if (!out.scenes.length || out.scenes.some((x) => !SCENES.includes(x))) throw new Error(`measure: --scenes takes some of ${SCENES.join(',')}`);
  if (out.url && out.serve) throw new Error('measure: use --url or --serve, not both');
  if (!out.url) out.serve = true;
  return out;
}

/** The page URL for one scene: the base (path kept), `?shot=<scene>` appended. */
export function sceneUrl(base, scene) {
  const u = new URL(base);
  u.searchParams.set('shot', scene);
  return u.href;
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n) => Math.round(n * 10) / 10;

/** Mean per play over the plays that landed; `partial: true` when fewer than `wanted` did. */
export function playSummary(plays, wanted = PLAYS_WANTED) {
  const key = (k) => round1(mean(plays.map((p) => p[k])));
  const out = { plays: plays.length, layouts: key('layouts'), recalcs: key('recalcs'), forcedReads: key('forcedReads'), mutations: key('mutations'), longTasks: key('longTasks'), longTasksMs: key('longTasksMs') };
  if (plays.length < wanted) out.partial = true;
  return out;
}

/** Why an HTTP status is not a loaded game, or null. A file: URL has no status. */
export function httpProblem(status, protocol = 'http:') {
  if (protocol === 'file:' && status == null) return null;
  if (!Number.isFinite(status)) return 'no HTTP response';
  return status >= 200 && status < 300 ? null : `HTTP ${status}`;
}

/**
 * Why a probe of the page (`{ appChildren, banners }`, see readinessProbe) is
 * not a mounted screen, or null: #app must have drawn something and the
 * failure banner (`.validation-banner`, src/ui/debuglog.js) must be absent.
 */
export function readinessProblem(probe) {
  if (!probe || !(probe.appChildren > 0)) return 'no screen mounted in #app';
  if (probe.banners > 0) return `failure banner on the page (${probe.banners})`;
  return null;
}

/** Why uncaught page errors (strings) void a measurement, or null. Names the first. */
export function pageErrorProblem(errors) {
  if (!errors || !errors.length) return null;
  return `page error${errors.length > 1 ? ` (1 of ${errors.length})` : ''}: ${errors[0]}`;
}

// Wall-clock cap for the whole touch-play driver in one attempt. Three plays
// take about a minute on a healthy scene; 5 minutes means it is stuck.
export const PLAYS_BUDGET_MS = 5 * 60 * 1000;

/** Why the touch-play driver has run too long (`now - startedAt` past `budgetMs`), or null. */
export function playsBudgetProblem(startedAt, now, budgetMs = PLAYS_BUDGET_MS) {
  const used = now - startedAt;
  return used > budgetMs ? `touch plays ran past their ${Math.round(budgetMs / 1000)} s budget (${Math.round(used / 1000)} s)` : null;
}

/**
 * Whether End Turn did its job: the combat is over, or it is the player's phase
 * on a later turn than `prev`. `c` is a combat state ({ phase, turn, result }).
 */
export function turnAdvanced(prev, c) {
  return !!(c && (c.result || (c.phase === 'player' && c.turn > prev)));
}

// Runs in the page.
function readinessProbe() {
  return { appChildren: document.querySelector('#app')?.children.length ?? 0, banners: document.querySelectorAll('.validation-banner').length };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbg = (...a) => { if (process.env.MEASURE_DEBUG) console.error('measure:', ...a); };

function loadPlaywright() {
  const tries = [
    () => createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright'),
    () => createRequire('/opt/npm-tools/node_modules/')('playwright'),
  ];
  let last;
  for (const t of tries) { try { return t(); } catch (e) { last = e; } }
  throw new Error(`measure: Playwright not found (set PLAYWRIGHT_MODULE): ${last && last.message}`);
}

// Runs in the page before any page script.
function initScript() {
  const rect = Element.prototype.getBoundingClientRect;
  const cstyle = window.getComputedStyle;
  const perf = window.__perf = { on: false, reads: 0, muts: 0, lt: [], rect: (el) => rect.call(el) };
  Element.prototype.getBoundingClientRect = function (...a) { if (perf.on) perf.reads++; return rect.apply(this, a); };
  window.getComputedStyle = function (...a) { if (perf.on) perf.reads++; return cstyle.apply(window, a); };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) perf.lt.push([e.startTime, e.duration]); }).observe({ entryTypes: ['longtask'] });
  } catch { /* long tasks unsupported: reported as 0 */ }
}

// Runs in the page; reads through the unwrapped functions so it counts nothing.
function sceneCounts() {
  const all = document.querySelectorAll('*');
  let filters = 0;
  for (const e of all) { const f = getComputedStyle(e).filter; if (f && f !== 'none') filters++; }
  const anims = document.getAnimations().filter((a) => a.playState === 'running' && typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation).length;
  const nav = performance.getEntriesByType('navigation')[0];
  const res = performance.getEntriesByType('resource');
  const size = (e) => e.transferSize || e.encodedBodySize || 0;
  return {
    nodes: all.length, filters, anims,
    requests: 1 + res.length,
    bytes: (nav ? size(nav) : 0) + res.reduce((s, e) => s + size(e), 0),
    dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    longest: Math.round(Math.max(0, ...window.__perf.lt.map((x) => x[1]))),
  };
}

async function metrics(cdp) {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(m.map((x) => [x.name, x.value]));
}

// The scene is ready when its element count holds still (within 3%) for three
// looks a second apart; a fixed sleep measured half-drawn scenes on a busy box.
// Throws when 45 looks never gave three still ones: a half-drawn scene is a
// failed attempt, not a sample.
async function settle(page) {
  let still = 0;
  for (let i = 0, last = -1; i < 45 && still < 3; i++) {
    await sleep(1000);
    const n = await page.evaluate(() => document.querySelectorAll('*').length);
    still = last > 0 && Math.abs(n - last) <= last * 0.03 ? still + 1 : 0;
    last = n;
  }
  if (still < 3) throw new Error('element count never held still (45 looks)');
}

async function measureScene(browser, base, scene, wantPlays) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, hasTouch: true, isMobile: true, deviceScaleFactor: DPR });
  try {
    const page = await ctx.newPage();
    const pageErrors = []; // this attempt's uncaught page errors
    page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 160)); console.error(`measure: ${scene} pageerror: ${pageErrors.at(-1)}`); });
    await page.addInitScript(initScript);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const url = sceneUrl(base, scene);
    const response = await page.goto(url, { waitUntil: 'load', timeout: 150000 });
    const bad = httpProblem(response ? response.status() : null, new URL(url).protocol);
    if (bad) throw new Error(`${bad} for ${url}`);
    // a banner counts at once; an empty #app gets 60 s to fill, then the probe below fails it
    await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0 || document.querySelector('.validation-banner'), null, { timeout: 60000 })
      .catch(() => {});
    await settle(page);
    const unready = readinessProblem(await page.evaluate(readinessProbe));
    if (unready) throw new Error(`${scene} not ready: ${unready}`);
    const errored = pageErrorProblem(pageErrors);
    if (errored) throw new Error(`${scene} ${errored}`);
    const counts = await page.evaluate(sceneCounts);
    const plays = wantPlays ? await touchPlays(page, cdp, wantPlays) : [];
    if (plays.length < wantPlays) {
      const e = new Error(`only ${plays.length} of ${wantPlays} touch plays landed`);
      e.partial = { counts, plays }; // kept for --json (run marks it partial: true)
      throw e;
    }
    return { counts, plays };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Combat: tap a card, tap an enemy if the card wants one, repeat; end the turn
// (hold) when nothing affordable is left.
async function touchPlays(page, cdp, want) {
  await page.evaluate(() => {
    const perf = window.__perf;
    new MutationObserver((l) => { if (perf.on) perf.muts += l.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  const state = () => page.evaluate(() => ({ phase: window.__combat?.phase, turn: window.__combat?.turn, result: window.__combat?.result, hand: document.querySelectorAll('.hand .card').length, energy: window.__combat?.player?.energy }));
  const rects = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((el, i) => { const r = window.__perf.rect(el); return { i, x: r.left, y: r.top, w: r.width, h: r.height, un: el.classList.contains('unaffordable') }; }), sel);
  const done = [];
  let tried = new Set(); // hand positions that did not play this hand
  const startedAt = Date.now();
  for (let attempt = 0; attempt < want * 10 && done.length < want; attempt++) {
    const overrun = playsBudgetProblem(startedAt, Date.now());
    if (overrun) throw new Error(overrun);
    let s = await state();
    dbg('attempt', attempt, JSON.stringify(s));
    if (s.result) break;
    for (let i = 0; i < 60 && s.phase !== 'player'; i++) { await sleep(500); s = await state(); }
    // the hand is dealt card by card: wait until its size holds still
    for (let i = 0, last = -1, still = 0; i < 30 && still < 2; i++) {
      const n = (await state()).hand;
      still = n === last ? still + 1 : 0;
      last = n; await sleep(900);
    }
    const hand = await rects('.hand .card');
    const pick = hand.filter((c) => !c.un && !tried.has(c.i)).at(-1);
    dbg('hand', hand.length, 'pick', pick && pick.i);
    if (!pick) { await endTurn(page, cdp, state); tried = new Set(); continue; }
    const before = await state();
    await page.evaluate(() => { const p = window.__perf; p.reads = 0; p.muts = 0; p.on = true; });
    const t0 = await page.evaluate(() => performance.now());
    const m0 = await metrics(cdp);
    const cx = pick.i === hand.length - 1 ? pick.x + pick.w / 2 : pick.x + pick.w * 0.12;
    await page.touchscreen.tap(cx, pick.y + pick.h * 0.45);
    await sleep(500);
    let s2 = await state();
    if (s2.hand === before.hand) {
      for (const h of await rects('.enemy-target-hitbox')) {
        await page.touchscreen.tap(h.x + h.w / 2, h.y + Math.min(h.h * 0.25, 120));
        await sleep(500);
        s2 = await state();
        if (s2.hand !== before.hand) break;
      }
    }
    await sleep(2200);
    const m1 = await metrics(cdp);
    const t1 = await page.evaluate(() => performance.now());
    const w = await page.evaluate(([a, b]) => { const p = window.__perf; p.on = false; const lt = p.lt.filter(([s]) => s >= a && s <= b); return { reads: p.reads, muts: p.muts, longTasks: lt.length, longTasksMs: Math.round(lt.reduce((x, y) => x + y[1], 0)) }; }, [t0, t1]);
    const after = await state();
    dbg('after', JSON.stringify(after), 'reads', w.reads, 'muts', w.muts);
    if (after.hand !== before.hand || after.energy !== before.energy) {
      tried = new Set();
      done.push({ layouts: m1.LayoutCount - m0.LayoutCount, recalcs: m1.RecalcStyleCount - m0.RecalcStyleCount, forcedReads: w.reads, mutations: w.muts, longTasks: w.longTasks, longTasksMs: w.longTasksMs });
    } else {
      tried.add(pick.i);
      await page.touchscreen.tap(30, 760); // dismiss a stuck selection
      await sleep(300);
    }
  }
  return done;
}

async function endTurn(page, cdp, state) {
  const b = await page.evaluate(() => { const el = document.querySelector('.end-turn'); if (!el) return null; const r = window.__perf.rect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (!b) return;
  const prev = (await state()).turn;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', b.x, b.y); await sleep(900); await touch('touchEnd');
  let advanced = false;
  for (let i = 0; i < 120 && !advanced; i++) {
    await sleep(500);
    const back = await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /^back$/i.test(x.textContent.trim()) && x.offsetParent && x.closest('[role=dialog],.modal,.reaction')); if (!el) return null; const r = window.__perf.rect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (back) { await page.touchscreen.tap(back.x, back.y); await sleep(300); }
    const c = await state();
    advanced = turnAdvanced(prev, c);
  }
  // 60 s without a new turn is a stuck scene; falling through would let touchPlays retry for up to 30 hands
  if (!advanced) throw new Error('End Turn never advanced the turn (60 s)');
  await sleep(800);
}

export async function run(opts) {
  let server = null;
  let browser = null;
  const result = { base: opts.url, scenes: {}, boot: null, play: null, failed: [] };
  try {
    // inside the try: a throw from serve, loadPlaywright or launch still reaches the finally
    if (opts.serve) {
      const { serve } = await import('./serve.mjs');
      server = await serve({ port: 0, open: false, lan: false, quiet: true, host: 'localhost' });
      result.base = server.url;
    }
    const base = result.base;
    const { resolveBrowser } = await import('./browser.mjs');
    const { chromium } = loadPlaywright();
    browser = await chromium.launch({ executablePath: resolveBrowser() || undefined });
    for (const scene of opts.scenes) {
      let got = null;
      let partial = null; // the last failed attempt's numbers, when it had any (fewer plays than wanted)
      for (let attempt = 1; attempt <= 2 && !got; attempt++) {
        try { got = await measureScene(browser, base, scene, scene === 'combat' ? PLAYS_WANTED : 0); } catch (e) {
          partial = (e && e.partial) || null;
          console.error(`measure: ${scene} attempt ${attempt} failed: ${String(e && e.message).split('\n')[0]}`);
        }
      }
      if (!got) result.failed.push(scene);
      if (!got && !partial) continue;
      const { counts, plays } = got || partial;
      const { dcl, longest, ...c } = counts;
      result.scenes[scene] = c;
      console.log(`MEASURE ${scene} nodes=${c.nodes} filters=${c.filters} anims=${c.anims} requests=${c.requests} bytes=${c.bytes}`);
      if (scene === 'title') {
        result.boot = { dcl_ms: dcl, longest_task_ms: longest };
        console.log(`MEASURE boot dcl_ms=${dcl} longest_task_ms=${longest}`);
      }
      if (scene === 'combat') {
        const p = result.play = playSummary(plays, PLAYS_WANTED);
        console.log(`MEASURE combat.play plays=${p.plays} layouts=${p.layouts} recalcs=${p.recalcs} forcedReads=${p.forcedReads} mutations=${p.mutations} longTasks=${p.longTasks} longTasksMs=${p.longTasksMs}${p.partial ? ' partial=true' : ''}`);
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.server.close();
  }
  if (opts.budget) {
    result.budget = checkBudget(budgetValues(result));
    for (const r of result.budget) console.log(`BUDGET ${r.key} value=${r.value ?? 'n/a'} budget=${r.budget} limit=${r.limit} status=${r.status}`);
  }
  if (opts.json) writeFileSync(opts.json, JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  run(opts).then((result) => {
    if (opts.budget && budgetFailed(result.budget)) {
      console.log('BUDGET FAILED: at least one count is over budget by more than 25% (or was not measured).');
      process.exit(1);
    }
    if (result.failed.length) { console.error(`measure: scenes that could not be measured: ${result.failed.join(', ')}`); process.exit(2); }
    process.exit(0);
  }).catch((e) => { console.error(e && e.stack || e); process.exit(2); });
}
