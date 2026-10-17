// OBSERVATIONAL HELPER ONLY. Never merge this branch into production.
// Uses the reviewed native probe's exact source flow, seed and browser options.
// The preceding unchanged native workflow step alone judges400/750ms budgets.
// CPU/timeline/timer instrumentation adds overhead; reference median comparisons
// here are observations, never a replacement timing verdict. A complete three-
// play capture exits0 regardless of latency; missing data or capture errors fail.
// No screenshots, network bodies or browser profile directories are recorded.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { platform, release, arch } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(process.env.DIAGNOSTIC_SOURCE_ROOT || process.cwd());
const OUT = resolve(process.env.DIAGNOSTIC_OUT || '/tmp/click-impact-diagnostic');
mkdirSync(OUT, { recursive: true });
const SOURCE_SHA = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(process.env.DIAGNOSTIC_SOURCE_SHA || '') || SOURCE_SHA !== process.env.DIAGNOSTIC_SOURCE_SHA) throw new Error('Pinned source SHA mismatch');
if (!/^[a-f0-9]{40}$/.test(process.env.DIAGNOSTIC_HELPER_SHA || '')) throw new Error('Immutable helper SHA required');
const HELPER_SHA = execFileSync('git', ['-C', resolve(ROOT, '.diagnostic-control'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (HELPER_SHA !== process.env.DIAGNOSTIC_HELPER_SHA) throw new Error('Helper checkout SHA mismatch');
const sourceTool = file => import(pathToFileURL(resolve(ROOT, 'tools', file)).href);
const { CORE_ENTRY_SEED } = await sourceTool('core-entry-fixture.mjs');
const { launchBrowser } = await sourceTool('browser.mjs');
const { serve } = await sourceTool('serve.mjs');
const { pointerTargetExpression } = await sourceTool('pointer-target.mjs');
// Bound the allowlisted JSON files together; no browser profile directory is copied.
const MAX_BYTES = 45 * 1024 * 1024;
let writtenBytes = 0;
function writeDiagnostic(name, value) {
  const bytes = JSON.stringify(value);
  if (writtenBytes + Buffer.byteLength(bytes) > MAX_BYTES) throw new Error('Diagnostic JSON budget exceeded');
  writtenBytes += Buffer.byteLength(bytes);
  writeFileSync(resolve(OUT, name), bytes + '\n');
}
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'disabled-by-default-devtools.timeline.frame', 'v8', 'v8.execute', 'disabled-by-default-v8.gc', 'blink.user_timing', 'toplevel', 'renderer.scheduler', 'cc'];
let traceEvents = [], traceBytes = 0, traceDropped = 0, traceComplete = null, traceSessionId = null;
function traceEvent(message) {
  if (!traceSessionId || message.sessionId !== traceSessionId) return;
  if (message.method === 'Tracing.dataCollected') for (const event of message.params.value) {
    const size = Buffer.byteLength(JSON.stringify(event));
    if (traceBytes + size <= 8 * 1024 * 1024) { traceEvents.push(event); traceBytes += size; }
    else traceDropped++;
  }
  if (message.method === 'Tracing.tracingComplete') traceComplete?.();
}

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// docs/FINISH.md §5: the acceptance number, not a game setting.
const BUDGET_MS = 400;
// Owner, 2026-10-11: the first number of a plain single hit, after the
// defender's reaction (SPEC §7.4, beatOrder 'sequential').
const NUMBER_BUDGET_MS = 750;
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const PLAYS = Number(argOf('--plays') || 5);
const SEED = Number(argOf('--seed') || CORE_ENTRY_SEED);
if (PLAYS !== 3 || SEED !== CORE_ENTRY_SEED) throw new Error('This bounded helper captures exactly three plays of the native default seed');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl, pageErrors = []) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    traceEvent(msg);
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej, timer } = pending.get(msg.id);
      clearTimeout(timer);
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
        const timer = setTimeout(() => { pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }, 10000);
        pending.set(id, { res, rej, timer });
        try { ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
        catch (error) { clearTimeout(timer); pending.delete(id); rej(error); }
      });
    },
    close: () => ws.close(),
  };
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function main() {
  if (!browserPath) { console.error('click-impact-diagnostic: no Chrome/Chromium found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const externalUrl = argOf('--url');
  const hosted = externalUrl ? null : await serve({ root: ROOT, port: 8251, open: false });
  const server = hosted?.server;
  const base = externalUrl || `http://localhost:${hosted.port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'clickimpact-', browser: browserPath,
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const version = execFileSync(browserPath, ['--version'], { encoding: 'utf8' }).trim();
  writeDiagnostic('manifest.json', {
    sourceCommit: SOURCE_SHA, helperCommit: process.env.DIAGNOSTIC_HELPER_SHA,
    captureDate: new Date().toISOString(), captureMode: 'separate observational run; CPU and timeline instrumentation may change latency',
    nativeVerdict: { outcome: process.env.DIAGNOSTIC_NATIVE_OUTCOME || 'unknown', boundary: 'unchanged probe runs in its own preceding workflow step; this run cannot clear that result' },
    browser: { binary: browserPath, version, viewport: { width: 1440, height: 900 }, launchOptions: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] },
    platform: { platform: platform(), release: release(), arch: arch(), node: process.version, imageOS: process.env.ImageOS || null, imageVersion: process.env.ImageVersion || null },
    seed: SEED, requestedPlays: PLAYS, pace: 'Normal', sourceKind: 'checked-out source served locally', traceScope: 'attached page target session; async events must carry the same sessionId',
    sourceProbeSha256: createHash('sha256').update(readFileSync(resolve(ROOT, 'tools/click-impact-probe.mjs'))).digest('hex'),
    build: JSON.parse(readFileSync(resolve(ROOT, 'buildordinal.json'), 'utf8')), categories: TRACE_CATEGORIES,
  });
  const pageErrors = [];
  let lastPicked = null;
  const cdp = connectCdp(wsUrl, pageErrors);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Performance.enable', {}, S);
  await cdp.send('Profiler.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(100);
    }
    throw new Error(`timeout: ${label}`);
  };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, S);
    }
  };
  const click = async (sel, label, settle = true) => {
    const pt = await evalIn(`(() => {
      const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const { x, y } = e.matches('.combatant, .hand .card') ? ${pointerTargetExpression(sel)}
        : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 180) };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    if (args.includes('--debug')) console.log('    input', label, sel, JSON.stringify(pt));
    await clickAt(pt.x, pt.y);
    if (settle) await wait(300);
  };

  let activeCapture = null;
  async function finishCapture(sample, error = null) {
    const capture = activeCapture;
    if (!capture) return;
    activeCapture = null;
    const errors = error ? [String(error.message || error)] : [];
    let profile = null;
    if (capture.profilerStarted) {
      try { profile = await cdp.send('Profiler.stop', {}, S); }
      catch (failure) { errors.push(`CPU stop: ${failure.message}`); }
    }
    if (capture.traceStarted) {
      let traceTimer;
      const completed = new Promise((res, rej) => {
        traceTimer = setTimeout(() => rej(new Error('Tracing completion timeout')), 10000);
        traceComplete = () => { clearTimeout(traceTimer); res(); };
      });
      try { await Promise.all([cdp.send('Tracing.end', {}, S), completed]); }
      catch (failure) { errors.push(`Trace stop: ${failure.message}`); }
      finally { clearTimeout(traceTimer); traceComplete = null; traceSessionId = null; }
    }
    if (!sample) {
      try { sample = { partial: true, diagnostic: await evalIn(`({ ...window.__impactDiag, trace: window.__fx?.trace, resources: window.__impactResources?.(), pointerUps: window.__impact?.ups, contacts: window.__impact?.contacts, numbers: window.__impact?.floats })`) }; }
      catch (failure) { errors.push(`Partial snapshot: ${failure.message}`); }
    }
    const record = { sourceCommit: SOURCE_SHA, card: capture.card, clock: capture.clock, errors, partial: !!error };
    writeDiagnostic(`play-${capture.index}-cpu.json`, { ...record, ...profile });
    writeDiagnostic(`play-${capture.index}-trace.json`, { ...record, traceEvents, dropped: traceDropped, sessionId: S, categories: TRACE_CATEGORIES });
    writeDiagnostic(`play-${capture.index}-measurements.json`, { ...record, sample });
    console.log('OBSERVATIONAL CAPTURE', JSON.stringify({ play: capture.index, card: capture.card, contact: sample?.contact, number: sample?.number, traceEvents: traceEvents.length, traceDropped, errors }));
    if (errors.length && !error) throw new Error(errors.join('; '));
  }

  try {
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`document.readyState === 'complete'`, 'the page');
    await evalIn(`(() => { localStorage.clear(); return true; })()`);
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu .slot-new'))`, 'the startup gate or the title');
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) {
      for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, S);
    }
    await until(`!!document.querySelector('.title-menu .slot-new:not([disabled])')`, 'New Game');
    await click('.title-menu .slot-new', 'New Game');
    await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the slot picker');
    await click('[data-title-action="modal-continue"]', 'Create character');
    await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the slot review');
    await click('[data-title-action="review-new"]', 'Start');
    await until(`!!document.querySelector('#cz-classes .cz-class')`, 'Core class creation');
    await click('#cz-classes .cz-class', 'Reaver');
    await click('#cz-next', 'Review');
    await until(`document.querySelector('.cz-railed')?.dataset.creationStage === 'review'`, 'Core review');
    await click('#seed-input', 'seed field');
    for (const type of ['keyDown','keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }, S);
    await cdp.send('Input.insertText', { text: String(SEED) }, S);
    await click('#cz-start', 'Begin Core');
    // Walk the live entry rest, authored dungeon dialogue and map doors.
    // These are real controls, never engine calls or injected run state.
    for (let step = 0; step < 24; step += 1) {
      if (await evalIn(`!!window.__combat && !!document.querySelector('.hand .card')`)) break;
      const next = await evalIn(`(() => {
        const visible = n => { if (!n || n.hidden || n.disabled || n.getAttribute('aria-disabled') === 'true') return false; const r=n.getBoundingClientRect(); return r.width>0 && r.height>0 && n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)); };
        const pick = selector => [...document.querySelectorAll(selector)].find(visible);
        const direct = pick('#shrine-leave, #leave-shop, .prologue-screen .prologue-controls button, .confirmation-modal .confirmation-confirm, .map-tray [data-map-action="enter"], .map-enter');
        const node = direct || pick('.map-node.monster.reachable:not(.current)') || [...document.querySelectorAll('.map-node.reachable:not(.current):not(.visited)')].filter(visible).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];
        const dialogue = node || [...document.querySelectorAll('.dialogue-screen button, .event-screen button, .class-mastery-node')].find(visible);
        if (!dialogue) return null;
        document.querySelectorAll('[data-input-probe-next]').forEach(n => delete n.dataset.inputProbeNext);
        dialogue.dataset.inputProbeNext = 'true';
        return (dialogue.textContent || dialogue.getAttribute('aria-label') || dialogue.className).trim().slice(0,100);
      })()`);
      if (next) await click('[data-input-probe-next="true"]', next);
      else {

        await wait(500);
      }
    }
    await until(`!!window.__combat && !!document.querySelector('.hand .card')`, 'the first Core fight');
    await wait(1500);
    if (await evalIn(`(() => { const n=document.querySelector('.combat .tut-skip'); return n && !n.hidden && n.getBoundingClientRect().width>0; })()`)) await click('.combat .tut-skip', 'Skip the first-combat tutorial');

    // The page's own clock: pointer releases and visible damage/protection.
    // Dedicated Poise/Ward payloads can update a bar without a damage float.
    await evalIn(`(() => {
      const meters = () => JSON.stringify([...document.querySelectorAll('.combatant [data-res=poise], .combatant [data-res=ward]')].map(e => [e.closest('[data-eid]')?.dataset.eid, e.dataset.res, e.dataset.cur, e.dataset.max]));
      window.__impact = { ups: [], floats: [], contacts: [], meterState: meters(), measureMeters: false };
      window.__impactDiag = { timers: [], frames: [], longtasks: [] };
      window.__impactResources = () => performance.getEntriesByType('resource').flatMap(entry => {
        try {
          const url = new URL(entry.name);
          if (url.origin !== location.origin || !/[.](?:webp|png|jpe?g|avif|svg|woff2?)(?:$)/i.test(url.pathname)) return [];
          return [{ pathname: url.pathname.slice(0, 300), start: entry.startTime, duration: entry.duration,
            transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
            initiatorType: entry.initiatorType }];
        } catch { return []; }
      }).slice(0, 200);
      const nativeTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) => {
        const rec = { scheduled: performance.now(), delay: Number(delay) || 0, name: fn?.name || '' };
        if (typeof fn !== 'function') return nativeTimeout(fn, delay, ...args);
        return nativeTimeout((...values) => {
          if (rec.delay >= 20 && window.__impactDiag.timers.length < 3000) { rec.fired = performance.now(); window.__impactDiag.timers.push(rec); }
          return Reflect.apply(fn, window, values);
        }, delay, ...args);
      };
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) if (window.__impactDiag.longtasks.length < 1000) window.__impactDiag.longtasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ entryTypes: ['longtask'] });
      const frame = t => { if (window.__impactDiag.frames.length < 3000) window.__impactDiag.frames.push(t); requestAnimationFrame(frame); };
      requestAnimationFrame(frame);

      addEventListener('pointerup', () => window.__impact.ups.push(performance.now()), { capture: true });
      new MutationObserver((list) => {
        const t = performance.now();
        for (const m of list) if (m.type === 'attributes' && m.attributeName === 'data-contact') window.__impact.contacts.push(t);
        for (const m of list) for (const n of m.addedNodes || []) {
          if (n.nodeType === 1 && n.classList.contains('float-num') && /\\bdmg\\b|\\bblk\\b/.test(n.className)) window.__impact.floats.push(t);
        }
        const nextMeters = meters();
        if (window.__impact.measureMeters && nextMeters !== window.__impact.meterState) window.__impact.floats.push(t);
        window.__impact.meterState = nextMeters;
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cur', 'data-max', 'data-contact'] });
      return true;
    })()`);

    const played = () => evalIn(`window.__combat?.player?.counters?.cardsPlayedThisCombat || 0`);
    const idle = `!!window.__combat && window.__combat.result == null && window.__combat.phase === 'player' && !!document.querySelector('.hand .card') && !document.querySelector('.combat .end-turn')?.disabled`;
    const samples = [];
    const numbers = [];
    for (let guard = 0; samples.length < PLAYS && guard < PLAYS * 4; guard += 1) {
      if (await evalIn(`!window.__combat || window.__combat.result != null`)) break;
      await until(idle, 'an idle hand', 15000);
      await wait(400);
      const picked = await evalIn(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { hasImmediateCombatImpact } = await import('/tools/click-impact-card.mjs');
        const { immediateCardEffects } = await import('/src/model/cardTargets.js');
        const combat = window.__combat;
        const hand = [...document.querySelectorAll('.hand .card')];
        hand.forEach((c) => delete c.dataset.ciCard);
        const pick = hand.find(c => {
          if (c.classList.contains('unaffordable')) return false;
          const inst = combat.piles.hand.find(card => card.instanceId === c.dataset.instanceId);
          return inst && hasImmediateCombatImpact(resolveCombatCard(combat, inst));
        });
        if (!pick) return false;
        pick.dataset.ciCard = 'true';
        return { cardId: pick.dataset.cardId, instanceId: pick.dataset.instanceId,
          maneuver: pick.dataset.combatManeuver,
          meterImpact: immediateCardEffects(resolveCombatCard(combat, combat.piles.hand.find(card => card.instanceId === pick.dataset.instanceId))).some(effect => ['poiseDamage', 'wardDamage'].includes(effect.op)) };
      })()`);
      lastPicked = picked;
      if (args.includes('--debug')) console.log('    picked', JSON.stringify(picked));
      if (!picked) {
        // A selected card consumes the first End Turn hold by cancelling its
        // targeting state. Mirror full-run-probe's bounded retry instead of
        // burning every sampling attempt on that same unchanged hand.
        const turn = await evalIn(`window.__combat.turn`);
        for (let attempt = 0; attempt < 3 && await evalIn(`window.__combat?.turn === ${turn} && window.__combat?.phase === 'player'`); attempt += 1) {
          const pt = await evalIn(`(() => { const el = document.querySelector('.combat .end-turn'); const r = el?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, hold: Number(el.dataset.holdMs) || 600 } : null; })()`);
          if (!pt) throw new Error('no End Turn');
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y }, S);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          await wait(pt.hold + 250);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          const transitionEnd = Date.now() + 4000;
          while (Date.now() < transitionEnd) {
            if (await evalIn(`window.__combat?.result != null || window.__combat?.turn > ${turn} || window.__combat?.phase !== 'player'`)) break;
            await wait(100);
          }
        }
        await until(`window.__combat?.result != null || window.__combat?.turn > ${turn}`, `turn ${turn + 1} or the fight's end`, 10000);
        continue;
      }
      const before = await played();
      traceEvents = []; traceBytes = 0; traceDropped = 0; traceSessionId = S;
      activeCapture = { index: samples.length + 1, card: picked.cardId, traceStarted: false, profilerStarted: false, clock: null };
      await cdp.send('Tracing.start', { categories: TRACE_CATEGORIES.join(','), transferMode: 'ReportEvents' }, S);
      activeCapture.traceStarted = true;
      await cdp.send('Profiler.start', {}, S);
      activeCapture.profilerStarted = true;
      const metrics = await cdp.send('Performance.getMetrics', {}, S);
      activeCapture.clock = { metrics: Object.fromEntries(metrics.metrics.map(m => [m.name, m.value])), performanceNow: await evalIn('performance.now()'), units: { profileAndTrace: 'monotonic microseconds', navigationStart: 'monotonic seconds', page: 'performance.now milliseconds since navigationStart' } };
      const mark = await evalIn(`(() => { window.__impact.measureMeters = ${!!picked.meterImpact}; window.__fx.trace = []; window.__impactDiag = { timers: [], frames: [], longtasks: [] }; performance.clearResourceTimings(); performance.mark("diagnostic-play-start"); return performance.now(); })()`);
      // Park the pointer off the hand so a hover lift or tooltip from the last
      // play does not cover the next card.
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 120 }, S);
      await wait(250);
      await click('[data-ci-card="true"]', 'an immediate-impact card', false);
      const t0 = Date.now();
      while (Date.now() - t0 < 3000 && (await played()) === before) {
        if (await evalIn(`!!document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])')`)) { await click('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])', 'its legal enemy target', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.enemy.targetable')`)) { await click('.combatant.enemy.targetable', 'its legal battlefield enemy', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.player.targetable, .combatant.player.armed')`)) { await click('.combatant.player.targetable, .combatant.player.armed', 'its legal source target', false); break; }
        await wait(30);
      }
      await until(`(window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) > ${before}`, 'the card to resolve', 5000);
      await until(`window.__impact.floats.some((t) => t > ${mark})`, 'a visible damage, protection or Poise/Ward impact', 5000).catch(() => null);
      const sample = await evalIn(`(() => {
        const f = window.__impact.floats.find((t) => t > ${mark});
        const c = window.__impact.contacts.find((t) => t > ${mark});
        if (f == null || c == null) return null;
        const up = window.__impact.ups.filter((t) => t > ${mark} && t < Math.min(c, f)).pop();
        return up == null ? null : { contact: Math.round(c - up), number: Math.round(f - up), diagnostic: { up, contact: c, number: f, trace: window.__fx.trace, resources: window.__impactResources(), ...window.__impactDiag } };
      })()`);
      await finishCapture(sample);
      if (sample == null) throw new Error('Missing pointer/contact/number timestamps');
      if (sample != null) {
        samples.push(sample.contact); numbers.push(sample.number);
        console.log(`    play ${samples.length}: contact ${sample.contact} ms, number ${sample.number} ms (${picked.cardId}${picked.maneuver === 'counter' ? ', Counter protection' : ''})`);
      }
    }
    // A median over fewer than three plays says too little to judge.
    if (samples.length < 3) { console.error(`click-impact-probe: only ${samples.length} play(s) measured; need 3`); process.exitCode = 2; return; }
    const m = median(samples);
    const contactOkay = m <= BUDGET_MS;
    console.log(`  ${contactOkay ? '✓' : '✗'} OBSERVATIONAL reference click-to-contact ${m} ms over ${samples.length} plays (budget ${BUDGET_MS} ms; samples ${samples.join(', ')})`);
    const n = median(numbers);
    const numberOkay = n <= NUMBER_BUDGET_MS;
    console.log(`  ${numberOkay ? '✓' : '✗'} OBSERVATIONAL reference click-to-first-number ${n} ms over ${numbers.length} plays (budget ${NUMBER_BUDGET_MS} ms; samples ${numbers.join(', ')})`);
    const passed = Number(contactOkay) + Number(numberOkay);
    console.log(`OBSERVATION ONLY: ${samples.length} plays captured; ${passed}/2 instrumented reference medians within the production budgets.`);
    console.log('  boundary: real Chromium headless, 1440x900, Normal pacing, the Quick start class and seed, mouse clicks only.');
    console.log('  Instrumentation overhead is present; native workflow verdict remains authoritative.');
    console.log('  Not checked: touch input, slow or fast pacing, phone layouts, or classes other than the Quick start one.');
    // The unchanged native step owns timing acceptance; profiler overhead is observational.
    process.exitCode = 0;
  } catch (e) {
    if (activeCapture) await finishCapture(null, e).catch(failure => console.error('Partial capture flush:', failure.message));
    console.error(`click-impact-diagnostic: ${e.message}`);
    console.error('last picked card:', JSON.stringify(lastPicked));
    if (pageErrors.length) console.error('page errors:', pageErrors.join('\n'));
    console.error('target state:', JSON.stringify(await evalIn(`({
      selected: document.querySelector('.hand .card.selected')?.dataset.cardId,
      armed: document.querySelector('.hand .card.armed')?.dataset.cardId,
      targetableEnemies: [...document.querySelectorAll('.enemy.targetable')].map(e => e.dataset.eid),
      targetablePlayer: !!document.querySelector('.player.targetable'),
      cardsPlayed: window.__combat?.player?.counters?.cardsPlayedThisCombat,
      phase: window.__combat?.phase, player: { energy: window.__combat?.player?.energy, stamina: window.__combat?.player?.stamina, mana: window.__combat?.player?.mana, statuses: window.__combat?.player?.statuses },
      modal: document.querySelector(".card-choice, .confirmation-modal")?.innerText,
    })`).catch(() => null)));
    process.exitCode = 1;
  } finally {
    if (activeCapture) await finishCapture(null, new Error('Capture interrupted before completion')).catch(failure => console.error('Final partial capture flush:', failure.message));
    cdp.close();
    await dropBrowser();
    server?.close();
  }
}

main();
