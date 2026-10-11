// tools/map-tap-latency.mjs — how long does a phone tap on a map node take to
// show its selection, to travel, and to be felt? A MEASURING TOOL: it reports
// the numbers and does not judge them against a budget yet.
//
// Real Chromium over CDP, the same serve and launch path as
// tools/reward-map-layout-qa.mjs and tools/click-impact-probe.mjs. The page is a
// 390x844 @3x isMobile/hasTouch context. Touch goes in through
// Input.dispatchTouchEvent (the CDP form of page.touchscreen.tap), and the CPU
// is throttled 4x before anything is measured. A page-side `pointerdown` stamp
// starts every clock; the end is a rAF poll in the page.
//
//   A  select:   tap a lit node until .map-tray[data-shown="true"]
//   B  travel:   select, wait 450 ms, tap the same node; until .mapscreen is gone
//                or replaced by a new screen root
//   C  enter:    select, tap the tray's Enter; same end condition as B
//   D  fast dbl: tap a node, tap it again 150 ms later; did travel happen within
//                1500 ms of the first tap, and did a .tooltip show?
//
// Long-task time is the overlap of each PerformanceObserver `longtask` entry
// with the 1000 ms after the measured tap (A to C).
//
//   node tools/map-tap-latency.mjs
//   CHROME=/path/to/chrome node tools/map-tap-latency.mjs
//
// Writes docs/qa/map-tap-latency/result.json and prints one MEASURE line per
// metric. Exit 0 when the measurement completed, whatever the numbers; 1 when
// the drive failed; 2 when no browser was found.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'docs/qa/map-tap-latency');
const REPS = 5;
const CPU_RATE = 4;
const PHONE = { width: 390, height: 844, deviceScaleFactor: 3 };
const LONG_WINDOW_MS = 1000;
const SELECT_TIMEOUT_MS = 8000;
const TRAVEL_TIMEOUT_MS = 8000;
const FAST_WINDOW_MS = 1500;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const maxOf = (xs) => {
  const s = xs.filter((x) => typeof x === 'number');
  return s.length ? Math.max(...s) : null;
};
const round = (x) => (x == null ? null : Math.round(x));

function connectCdp(wsUrl, pageErrors = []) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
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

// Installed on each fresh map load. The pointerdown stamp and the longtask
// observer both live on the page's own clock (performance.now).
const INSTRUMENT = `(() => {
  const mt = window.__mt = { downs: [], longtasks: [] };
  addEventListener('pointerdown', () => mt.downs.push(performance.now()), { capture: true });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) mt.longtasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) { mt.longtaskError = String(e); }
  window.__longMs = (t0) => mt.longtasks.reduce((sum, { start, dur }) =>
    sum + Math.max(0, Math.min(start + dur, t0 + ${LONG_WINDOW_MS}) - Math.max(start, t0)), 0);
  return true;
})()`;

const lastDown = `window.__mt.downs[window.__mt.downs.length - 1]`;

// Centre of the node's fixed face, only if that face is what a finger would hit.
// The pulsing halo changes the group's bounds, so the face is the target (as in
// reward-map-layout-qa.mjs). A node already tapped is reused by identity.
const TARGET = `(() => {
  const pick = (node) => {
    const face = node.querySelector('circle:not(.node-halo)');
    if (!face) return null;
    const r = face.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return document.elementFromPoint(x, y)?.closest('.map-node') === node ? { x, y } : null;
  };
  const kept = window.__tapNode;
  if (kept && kept.isConnected) {
    const p = pick(kept);
    return p ? { ...p, reused: true } : { error: 'the selected node is obstructed' };
  }
  for (const node of document.querySelectorAll('.map-node.reachable')) {
    const p = pick(node);
    if (p) { window.__tapNode = node; return { ...p, reused: false }; }
  }
  return { error: 'no unobstructed lit map node' };
})()`;

const centreOf = (sel) => `(() => {
  const e = document.querySelector(${JSON.stringify(sel)});
  if (!e) return { error: 'missing ${sel}' };
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`;

async function main() {
  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('map-tap-latency: no Chrome/Chromium found; set CHROME=/path/to/chrome');
    process.exitCode = 2;
    return;
  }
  console.log(`Browser: ${browserPath}`);
  const { server, url } = await serve({ root: ROOT, port: 0, open: false, quiet: true });
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'maptap-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const pageErrors = [];
  const cdp = connectCdp(wsUrl, pageErrors);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { ...PHONE, mobile: true }, S);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(50);
    }
    throw new Error(`timeout: ${label}`);
  };
  // A finger: touchStart then touchEnd at one point, as page.touchscreen.tap sends.
  const tapAt = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }, S);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S);
  };
  const tapTarget = async () => {
    const t = await evalIn(TARGET);
    if (!t || t.error) throw new Error(t?.error || 'no tap target');
    await tapAt(t.x, t.y);
    return evalIn(lastDown);
  };
  const tapSel = async (sel) => {
    const c = await evalIn(centreOf(sel));
    if (c.error) throw new Error(c.error);
    await tapAt(c.x, c.y);
    return evalIn(lastDown);
  };

  // A fresh run map: the same URL reward-map-layout-qa.mjs uses for a phone.
  // The load runs at full speed; the 4x CPU throttle is switched on once the
  // map is up and before anything is tapped, so it shapes only what is measured.
  const openMap = async () => {
    const before = await evalIn('performance.timeOrigin');
    await cdp.send('Page.navigate', { url: `${url}index.html?shot=map&shotAt=floor:1` }, S);
    await until(`performance.timeOrigin !== ${before} && document.readyState === 'complete' && !!document.querySelector('.map-node.reachable') && !!document.querySelector('.map-tray')`, 'a fresh map with a lit node', 90000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE }, S);
    await evalIn(INSTRUMENT);
    await wait(350);
  };
  // Long-task time in the 1000 ms after the tap at t0 (clipped to that window).
  const longAfter = (t0) => evalIn(`new Promise((res) => setTimeout(() => res(window.__longMs(${t0})), Math.max(0, ${t0} + ${LONG_WINDOW_MS} - performance.now()) + 50))`);
  // Poll in rAF until the .mapscreen this run started with is disconnected.
  const travelFrom = (t0) => evalIn(`new Promise((res) => {
    const ms = window.__ms;
    const tick = () => {
      if (!ms || !ms.isConnected) return res(performance.now() - ${t0});
      if (performance.now() - ${t0} > ${TRAVEL_TIMEOUT_MS}) return res(null);
      requestAnimationFrame(tick);
    };
    tick();
  })`);
  const markMapScreen = () => evalIn(`(window.__ms = document.querySelector('.mapscreen')) != null`);
  const selectNode = async () => {
    const t0 = await tapTarget();
    const shownAt = await evalIn(`new Promise((res) => {
      const t0 = ${t0};
      const tick = () => {
        if (document.querySelector('.map-tray')?.dataset.shown === 'true') return res(performance.now() - t0);
        if (performance.now() - t0 > ${SELECT_TIMEOUT_MS}) return res(null);
        requestAnimationFrame(tick);
      };
      tick();
    })`);
    return { t0, shownAt };
  };
  const closeTray = async () => {
    await tapSel('.map-tray-pair button:first-child');
    await until(`document.querySelector('.map-tray')?.dataset.open === 'false'`, 'the tray closed', 4000);
    await wait(300);
  };

  const samples = { A: [], B: [], C: [], D: [] };
  const failures = [];
  try {
    // A: one map, five selections, each cleared with Back.
    await openMap();
    for (let rep = 0; rep < REPS; rep += 1) {
      const { t0, shownAt } = await selectNode();
      const longtaskMs = await longAfter(t0);
      if (shownAt == null) failures.push({ metric: 'A', rep, reason: 'tray never shown' });
      samples.A.push({ latencyMs: round(shownAt), longtaskMs: round(longtaskMs) });
      await closeTray();
    }

    // B: a fresh run per repetition; select, wait 450 ms, tap the same node.
    for (let rep = 0; rep < REPS; rep += 1) {
      await openMap();
      await selectNode();
      await wait(450);
      await markMapScreen();
      const t0 = await tapTarget();
      const travelMs = await travelFrom(t0);
      const longtaskMs = await longAfter(t0);
      if (travelMs == null) failures.push({ metric: 'B', rep, reason: 'no travel' });
      samples.B.push({ travelMs: round(travelMs), longtaskMs: round(longtaskMs) });
    }

    // C: a fresh run per repetition; select, then tap the tray's Enter.
    for (let rep = 0; rep < REPS; rep += 1) {
      await openMap();
      await selectNode();
      await until(`!document.querySelector('#map-enter')?.disabled`, 'Enter enabled');
      await markMapScreen();
      const t0 = await tapSel('#map-enter');
      const travelMs = await travelFrom(t0);
      const longtaskMs = await longAfter(t0);
      if (travelMs == null) failures.push({ metric: 'C', rep, reason: 'no travel' });
      samples.C.push({ travelMs: round(travelMs), longtaskMs: round(longtaskMs) });
    }

    // D: a fresh run per repetition; two taps on one node, 150 ms apart. The
    // target is resolved before the first tap, and the two touches go out back
    // to back, so the gap is the 150 ms wait and nothing else.
    for (let rep = 0; rep < REPS; rep += 1) {
      await openMap();
      await markMapScreen();
      const target = await evalIn(TARGET);
      if (!target || target.error) throw new Error(target?.error || 'no tap target');
      // Travel and tooltip watcher, installed before the first touch. It samples
      // every frame until the 1500 ms window closes.
      await evalIn(`(() => {
        const ms = window.__ms;
        window.__dTravel = null; window.__dTip = false; window.__dStop = false;
        const visibleTooltip = () => {
          const t = document.querySelector('.tooltip');
          if (!t) return false;
          const s = getComputedStyle(t);
          return t.dataset.open !== 'false' && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && t.getBoundingClientRect().width > 0;
        };
        const tick = () => {
          if (window.__dStop) return;
          if (visibleTooltip()) window.__dTip = true;
          if (window.__dTravel == null && !ms.isConnected) window.__dTravel = performance.now();
          requestAnimationFrame(tick);
        };
        tick();
        return true;
      })()`);
      // The first touch's end is sent without waiting for its reply, so the
      // 150 ms starts when the first touch goes out, not after a throttled round trip.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 1 }] }, S);
      const firstEnd = cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S);
      await wait(150);
      await tapAt(target.x, target.y);
      await firstEnd;
      const stamps = await evalIn(`window.__mt.downs.slice(0, 2)`);
      const t1 = stamps[0];
      await evalIn(`new Promise((res) => {
        const tick = () => {
          if (window.__dTravel != null || performance.now() - ${t1} >= ${FAST_WINDOW_MS}) return res(true);
          requestAnimationFrame(tick);
        };
        tick();
      })`);
      const result = await evalIn(`(() => { window.__dStop = true; return { travelMs: window.__dTravel == null ? null : window.__dTravel - ${t1}, tooltipSeen: window.__dTip }; })()`);
      const travelledWithin = result.travelMs != null && result.travelMs <= FAST_WINDOW_MS;
      if (!travelledWithin) failures.push({ metric: 'D', rep, reason: 'no travel within 1500 ms' });
      samples.D.push({ gapMs: round(stamps[1] - stamps[0]), travelMs: round(result.travelMs), travelledWithin1500: travelledWithin, tooltipSeen: result.tooltipSeen });
    }

    const pick = (key) => samples[key];
    const metric = (key, name) => {
      const xs = pick(key);
      const lat = key === 'A' ? xs.map((s) => s.latencyMs) : xs.map((s) => s.travelMs);
      const lt = xs.map((s) => s.longtaskMs);
      return { name, samples: xs, medianMs: round(median(lat)), maxMs: round(maxOf(lat)), longtaskMedianMs: round(median(lt)), longtaskMaxMs: round(maxOf(lt)), completed: lat.filter((x) => x != null).length };
    };
    const d = samples.D;
    const summary = {
      tool: 'tools/map-tap-latency.mjs',
      measuredAt: new Date().toISOString(),
      browser: browserPath,
      viewport: { ...PHONE, mobile: true, hasTouch: true },
      cpuThrottlingRate: CPU_RATE,
      reps: REPS,
      boundary: 'Headless Chromium, CPU throttled 4x, touch via CDP, source tree served by tools/serve.mjs. Not a real device, not frame-accurate; the clock stamps pointerdown and polls rAF.',
      metrics: {
        A_select: metric('A', 'A select (tap to tray shown)'),
        B_second_tap_travel: metric('B', 'B second tap travels'),
        C_enter_travel: metric('C', 'C Enter travels'),
        D_fast_double_tap: {
          name: 'D fast double tap (150 ms apart)',
          samples: d,
          travelledWithin1500: d.filter((s) => s.travelledWithin1500).length,
          tooltipSeen: d.filter((s) => s.tooltipSeen).length,
          medianMs: round(median(d.map((s) => s.travelMs))),
          maxMs: round(maxOf(d.map((s) => s.travelMs))),
        },
      },
      failures,
      pageErrors,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(resolve(OUT_DIR, 'result.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary, null, 2));
    const m = summary.metrics;
    const line = (name, x) => `MEASURE ${name} median=${x.medianMs ?? 'n/a'} max=${x.maxMs ?? 'n/a'} longtask=${x.longtaskMedianMs ?? 'n/a'}`;
    console.log(line('A-select', m.A_select));
    console.log(line('B-second-tap-travel', m.B_second_tap_travel));
    console.log(line('C-enter-travel', m.C_enter_travel));
    console.log(`MEASURE D-fast-double-tap median=${m.D_fast_double_tap.medianMs ?? 'n/a'} max=${m.D_fast_double_tap.maxMs ?? 'n/a'} travelled_within_1500=${m.D_fast_double_tap.travelledWithin1500}/${REPS} tooltip=${m.D_fast_double_tap.tooltipSeen}/${REPS}`);
    if (failures.length) console.log(`WARN ${failures.length} repetition(s) did not complete; see failures in result.json`);
    if (pageErrors.length) console.log(`WARN ${pageErrors.length} page error(s); see pageErrors in result.json`);
    console.log(`Wrote ${resolve(OUT_DIR, 'result.json')}`);
    process.exitCode = 0;
  } catch (error) {
    console.error(`map-tap-latency: ${error.message}`);
    if (pageErrors.length) console.error('page errors:', pageErrors.join('\n'));
    process.exitCode = 1;
  } finally {
    cdp.close();
    await dropBrowser();
    server.close();
  }
}

main();
