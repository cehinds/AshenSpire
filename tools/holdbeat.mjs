#!/usr/bin/env node
// tools/holdbeat.mjs — DID THE BEAT ACTUALLY MAKE A SOUND? (Vega, 2026-08-08.)
//
// THE DEFECT THIS EXISTS FOR. A press-and-hold whose only feedback is a fill is
// a gesture you cannot tell is working once your hand is on top of the fill.
// Measured at 390x844: the event screen's bar is 378x44 mid-screen, and END
// TURN IS 190.2x50.4 AT y=784.6 OF AN 844 px VIEWPORT — a control about the
// size of a contact patch, in the bottom 60 px, approached from below. The
// player presses, sees nothing, presses again, and the thing the hold was
// protecting them from fires twice.
//
// WHY THE INSTRUMENT IS BUILT THE WAY IT IS, and this is the whole point of the
// file. Audio is the easiest claim in this repo to fake. `sfx.recent` records
// every id a call site fired, and it is GREEN WHETHER OR NOT ANY SOUND CAME OUT
// — it is a list of intentions. This tool therefore measures SAMPLES: an
// AnalyserNode is spliced in front of `ctx.destination` before the page's
// scripts run, and the peak amplitude of the actually-rendered audio is polled
// every 8 ms. A tick that is scheduled into a suspended context reads 0.000
// here and reads "fired" in `sfx.recent`, and THAT EXACT DIVERGENCE IS THE BUG
// THIS SESSION FOUND, so `--mutate` reproduces it deliberately.
//
// OBSERVED RED — `--mutate` neuters `ctx.resume` and suspends the AudioContext
// after unlocking it, before every measured hold. Every DOM transition still
// happens, every call site still fires, `sfx.recent` still fills, and NOT ONE
// SAMPLE IS PRODUCED. The sample checks must go red WHILE THE CALL-LEVEL COUNT
// STAYS GREEN, and the run prints both numbers side by side — a check that
// cannot tell those two apart is the check that would have shipped this bug.
// (development.md, the instrument rule.)
//
// WHAT IT CHECKS
//   0. A SILENT BASELINE. Before touching anything: 400 ms of nothing must
//      measure ~0. If music or a bed is leaking into the tap, every number
//      below is about the wrong signal and the run says so instead of
//      crediting the leak to the beat.
//   1. A COMPLETED HOLD IS AUDIBLE — peak well over the floor, and the ONSETS
//      are counted and must equal len(balance.ui.holdBeat.at) + 1.
//   2. THE ABORT IS QUIETER THAN THE COMMIT, and fires no arrival. Releasing
//      early is the feature; a commit sound on an abort would be the cue lying
//      about system state.
//   3. THE BEAT IS DERIVED, NOT WIRED. An element that starts publishing
//      `data-hold` at runtime — one nothing in the tree has ever seen — gets a
//      beat, and one carrying `data-hold-action` composes its own id. Law 0's
//      falsifier for this control: a new action that holds arrives with sound
//      and ZERO code edits.
//   4. BOTH EDGES OF THE DIAL. `off` wires no hold, so it must make no beat at
//      all; `long` must still land its arrival.
//   5. THE FIRST HOLD OF A FRESH PAGE, REPORTED not asserted. See below.
//   6. HAPTICS, REPORTED not asserted. See below.
//   7. THE COST AT HOLD #200. One whole confirmation, measured against one
//      `cardPlay`, on the shared analytic meter (tools/sfx-loudness.mjs — the
//      same instrument, imported, not a second copy).
//
// TWO THINGS THIS TOOL REPORTS AND REFUSES TO ASSERT, each for its own reason:
//
//   THE FIRST HOLD. Chromium grants user activation for a TOUCH at the lift,
//   not at the press: measured here, `pointerdown` and `touchstart` see
//   `userActivation.isActive === false` and `pointerup`/`touchend` see true,
//   while a MOUSE press activates immediately. A press-and-hold fires at full
//   fill with the finger still down, so the page's very first hold runs
//   entirely inside a suspended context and NOTHING CAN MAKE IT SOUND. That is
//   a browser rule, not a defect of ours, and asserting it would be a red
//   nobody can ever fix — the shape people learn to step over. It is printed
//   with its number every run.
//
//   HAPTICS. `navigator.vibrate` exists in headless Chromium on a Linux box
//   with no vibration motor AND RETURNS TRUE. There is no callback, no event
//   and no query: the API reports that a pattern was ACCEPTED, never that a
//   device buzzed. So no check here can distinguish a phone that vibrated from
//   one that did not, feature detection is a lie on every desktop, and iOS
//   Safari has no `navigator.vibrate` at all. The run prints what it found;
//   the decision not to ship haptics is in the report, not in an exit code.
//
// Usage
//   node tools/holdbeat.mjs                  source tree via tools/serve.mjs
//   node tools/holdbeat.mjs --dist           dist/AshenSpire.html over file://
//   node tools/holdbeat.mjs --mutate         must catch a suspended context
//   CHROME=/path/to/chrome node tools/holdbeat.mjs
//
// Exit codes
//   0  every check held     1  a real failure
//   2  usage / no browser / nothing measured / --mutate not caught
//
// BOUNDARY, and it is not small: headless Chromium on one Linux machine, ONE
// shape (390x844), CDP-synthesised touch, and NO EARS ANYWHERE IN IT. It proves
// samples were rendered with the right count and the right relative levels. It
// does not know whether the phrase is pleasant, whether three ticks is two too
// many at hold #200, or what any of it sounds like through a phone speaker.
// Nobody has listened to this. Check 7 is a PROXY for fatigue, not a measure of
// it. And it says nothing about the visible channel, which is the one a muted
// player has and the one that is under the thumb on End Turn.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day no control in the game
// holds — with no hold there is no beat and this tool has no subject.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';
import { recipeLoudness } from './sfx-loudness.mjs';
import { SFX_RECIPES } from '../src/content/sfx.js';
import { balance } from '../src/content/balance.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const mutate = args.includes('--mutate');
const EVENT = argOf('--event') || 'rotPriestOffer';
const SHAPE = { w: 390, h: 844 };
const MARKS = ((balance.ui.holdBeat || {}).at) || [];
const WANT_ONSETS = MARKS.length + 1; // ticks + the arrival

printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);

const BROWSERS = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function cdpConnect(url) {
  const ws = new WebSocket(url); let n = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sid) { const id = n++; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); },
    close: () => ws.close() };
}

// SPLICED IN FRONT OF THE SPEAKER, before any page script runs. Everything the
// engine connects to `ctx.destination` is redirected through an analyser, so
// what is polled below is the rendered mix and not a promise about it. The
// activation log is recorded here too, in the listeners themselves, because
// `userActivation` read afterwards is a different question.
const TAP = `
(() => {
  const Real = window.AudioContext || window.webkitAudioContext;
  if (!Real) return;
  window.__tap = null;
  window.__act = [];
  for (const t of ['pointerdown', 'touchstart', 'pointerup', 'touchend']) {
    addEventListener(t, () => {
      const u = navigator.userActivation;
      window.__act.push([t, u ? u.isActive : null, window.__tap ? window.__tap.ctx.state : null]);
    }, true);
  }
  function Patched(...a) {
    const ctx = new Real(...a);
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    an.connect(ctx.destination);
    Object.defineProperty(ctx, 'destination', { get: () => an, configurable: true });
    if (!window.__tap) window.__tap = { ctx, an };
    return ctx;
  }
  Patched.prototype = Real.prototype;
  window.AudioContext = Patched;
  window.webkitAudioContext = Patched;
})();`;

// The sampler: peak per 8 ms frame, kept as a trace so onsets can be counted
// rather than merely "was there any sound at all".
const SAMPLER = `
(() => {
  const t = window.__tap;
  if (!t) return 'no tap';
  if (window.__timer) clearInterval(window.__timer);
  window.__trace = [];
  const buf = new Float32Array(2048);
  window.__timer = setInterval(() => {
    t.an.getFloatTimeDomainData(buf);
    let p = 0;
    for (let i = 0; i < buf.length; i++) { const a = buf[i] < 0 ? -buf[i] : buf[i]; if (a > p) p = a; }
    window.__trace.push(p);
  }, 8);
  return 'ok';
})()`;

/** Group frames over `floor` into onsets; a gap of >= 4 quiet frames (~32 ms) separates two. */
function onsets(trace, floor) {
  let n = 0, quiet = 99, peak = 0;
  const peaks = [];
  for (const v of trace) {
    if (v > floor) {
      if (quiet >= 4) { n++; peaks.push(0); }
      quiet = 0;
      if (v > peaks[peaks.length - 1]) peaks[peaks.length - 1] = v;
      if (v > peak) peak = v;
    } else quiet++;
  }
  return { n, peak: +peak.toFixed(4), peaks: peaks.map((p) => +p.toFixed(4)) };
}

async function main() {
  if (!browserPath) { console.error('holdbeat: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }
  if (!MARKS.length) console.log('  note: balance.ui.holdBeat.at is empty — the ticks are off by data; only the arrival is expected.');

  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  else { const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8291), open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  const dir = mkdtempSync(join(tmpdir(), 'holdbeat-'));
  const { child, wsUrl } = await new Promise((res, rej) => {
    const c = spawn(browserPath, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = ''; const on = (x) => { buf += x; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res({ child: c, wsUrl: m[1] }); };
    c.stderr.on('data', on); c.stdout.on('data', on); c.on('error', rej);
    setTimeout(() => rej(new Error('holdbeat: chromium never printed an endpoint')), 20000);
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: TAP }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: SHAPE.w, height: SHAPE.h, deviceScaleFactor: 2, mobile: true }, sessionId);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId);
    if (r.exceptionDetails) return { __throw: String(r.exceptionDetails.exception && r.exceptionDetails.exception.description).slice(0, 200) };
    return r.result.value;
  };

  const findings = [];
  const notAsked = [];
  let firedIds = 'unread (no module graph on this artifact)';
  const skip = (name, kind, why) => { notAsked.push({ name, kind, why }); console.log(`    skip  ${name} [${kind}] — ${why}`); };
  let checks = 0;
  const ok = (name, cond, detail) => {
    checks++;
    console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };

  // MUSIC IS MUTED FOR EVERY MEASURED RUN, and check 0 proves it took. A bed
  // under the tap would be measured as "the beat made a sound" — the loudest
  // possible false green on a tool about whether something was heard.
  async function open(dial, { id = null, mute = true } = {}) {
    const st = { holdConfirm: dial, ...(mute ? { musicVolume: 0 } : {}) };
    const q = [`shot=event`, `shotEvent=${encodeURIComponent(id || EVENT)}`,
      `shotSettings=${encodeURIComponent(JSON.stringify(st))}`];
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector('#choices button')`)) break; await wait(120); }
    await wait(300);
    await ev(SAMPLER);
  }
  const trace = () => ev(`(() => { const t = window.__trace || []; window.__trace = []; return t; })()`);
  const barPoint = async (n) => ev(`(() => {
    const b = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')[${n}];
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1 }],
  }, sessionId);
  // A tap that ENDS. This is what actually unlocks the audio context, and the
  // reason it is a separate step is the finding in the header.
  async function unlock() {
    await touch('touchStart', { x: 8, y: 8 });
    await wait(60);
    await touch('touchEnd', { x: 8, y: 8 });
    await wait(250);
    if (mutate) await mutateNow();
  }
  // THE KNOWN-BAD, AND IT HAD TO BE STRENGTHENED ONCE. The first version only
  // called ctx.suspend(), and the ENGINE UNDID IT: ui/audio.js resumes on every
  // pointerdown, so the very press being measured put the context back. Half
  // the onsets came through and the mutation reported CAUGHT on a check that
  // was only bruised. Rune's rule, arriving in my hands: a known-bad the tree
  // can quietly repair is a known-bad that will one day die green. So resume is
  // neutered first — which is also the truthful simulation, because the real
  // condition is a browser that will NOT start the context, not one nobody
  // asked.
  const mutateNow = () => ev(`(async () => {
    const c = window.__tap.ctx;
    if (!c.__neutered) { c.__neutered = true; c.resume = () => Promise.resolve(); }
    await Object.getPrototypeOf(c).suspend.call(c);
    return c.state;
  })()`);

  console.log(`\nholdbeat — ${useDist ? 'dist/AshenSpire.html' : 'source tree'} · ${SHAPE.w}x${SHAPE.h} · event '${EVENT}'`
    + ` · marks [${MARKS.join(', ')}] → ${WANT_ONSETS} onsets expected`
    + `${mutate ? '\n  --mutate: the AudioContext is SUSPENDED after unlocking. Every call site still fires; no sample is rendered.' : ''}`);

  // ---- 5. THE FIRST HOLD OF A FRESH PAGE — reported, never asserted.
  console.log(`\n  the first hold of a fresh page (touch)`);
  await open('normal');
  {
    const p = await barPoint(0);
    if (!p) { console.error(`holdbeat: '${EVENT}' has no binding bar; nothing here measures the feature. That is unknown, not a pass.`); cdp.close(); child.kill(); stop(); process.exit(2); }
    // TWO WINDOWS, AND THE SPLIT IS THE WHOLE POINT. A suspended context does
    // not lose what was scheduled into it — it holds it and dumps the lot the
    // instant it starts. Measured before the drop rule went into ui/audio.js:
    // 0.000 during a 600 ms hold and ONE 0.1687 peak after the lift, i.e. the
    // entire four-sound phrase collapsed into a single event describing a
    // gesture that was already over. A tool that measured only "was there any
    // sound" would have called that a pass.
    await touch('touchStart', p);
    await wait(900);
    const during = onsets(await trace(), 0.002);
    const act = await ev(`window.__act`);
    const stateAtCommit = await ev(`window.__tap ? window.__tap.ctx.state : 'no ctx'`);
    await touch('touchEnd', p);
    await wait(500);
    const after = onsets(await trace(), 0.002);
    console.log(`    ---- DURING the hold: peak ${during.peak}, ${during.n} onset(s); context '${stateAtCommit}'.`);
    console.log(`    ---- AFTER the lift:  peak ${after.peak}, ${after.n} onset(s).`);
    console.log(`    ---- activation as the listeners saw it: ${JSON.stringify(act)}`);
    console.log(`    ---- A touch is not an activation until the LIFT, and a hold commits before the lift.`);
    console.log(`         ${during.peak < 0.002 ? 'SILENT DURING, which is correct and unfixable from inside the page.'
      : 'AUDIBLE DURING — the browser activated at the press. Re-read the header of this tool before quoting it.'}`);
    console.log(`         ${after.peak < 0.002 ? 'AND SILENT AFTER — the dropped cues stayed dropped (ui/audio.js). No late pile-up.'
      : 'AND A PILE-UP AFTER — the drop rule in ui/audio.js is not holding. That is a lie about when things happened.'}`);
    console.log(`    ---- Reported, never asserted: a red here could never be fixed, and a permanent red`);
    console.log(`         is the shape people learn to step over (SOP 2 / development.md).`);
  }

  // ---- 0. THE SILENT BASELINE, and 1/2. THE HOLD ITSELF.
  console.log(`\n  dial 'normal'`);
  await open('normal');
  await unlock();
  if (mutate) console.log(`    (mutation: context ${await ev(`window.__tap.ctx.state`)}, resume() neutered)`);
  await trace(); // discard the unlock tap's own frames
  await wait(400);
  const baseline = onsets(await trace(), 0.002);
  ok(`nothing is playing when nothing is happening`, baseline.peak < 0.002,
    `baseline peak ${baseline.peak} (music muted via shotSettings; a bed here would be measured as the beat)`);
  const FLOOR = Math.max(0.002, baseline.peak * 4);

  const holdMs = await ev(`Number((document.querySelector('[data-hold-ms]')||{dataset:{}}).dataset.holdMs || 0)`);
  {
    const p = await barPoint(0);
    await touch('touchStart', p);
    await wait(holdMs + 300);
    await touch('touchEnd', p);
    await wait(300);
    const o = onsets(await trace(), FLOOR);
    ok(`a completed hold renders audio`, o.peak > FLOOR * 4, `peak ${o.peak} (floor ${+FLOOR.toFixed(4)})`);
    ok(`and it is ${WANT_ONSETS} onsets, not one`, o.n === WANT_ONSETS,
      `${o.n} onset(s), peaks ${JSON.stringify(o.peaks)} — ${MARKS.length} tick(s) at [${MARKS.join(', ')}] plus the arrival`);
    ok(`the arrival is the loudest of them`, o.peaks.length > 1 && o.peaks[o.peaks.length - 1] === Math.max(...o.peaks),
      `last ${o.peaks[o.peaks.length - 1]} vs max ${o.peaks.length ? Math.max(...o.peaks) : 'n/a'}`);
  }

  // ---- 2. THE ABORT.
  {
    await open('normal');
    await unlock();
    await trace();
    const p = await barPoint(0);
    await touch('touchStart', p);
    await wait(Math.round(holdMs * 0.55));
    await touch('touchEnd', p);
    await wait(400);
    const o = onsets(await trace(), FLOOR);
    const expect = MARKS.filter((f) => f <= 0.5).length; // marks crossed by ~55% of the fill, minus scheduling slop
    ok(`an abort at ~55% sounds the ticks it reached and no arrival`, o.n >= 1 && o.n <= expect + 1 && o.n < WANT_ONSETS,
      `${o.n} onset(s), peaks ${JSON.stringify(o.peaks)}; ${expect} mark(s) at or under 0.5`);
    ok(`nothing in the abort is as loud as an arrival`, !o.peaks.length || Math.max(...o.peaks) < 0.12,
      `loudest ${o.peaks.length ? Math.max(...o.peaks) : 0} — a commit sound on an abort would be the cue lying about state`);
  }

  // ---- 4. BOTH EDGES OF THE DIAL.
  {
    console.log(`\n  dial edges`);
    await open('off');
    await unlock();
    await trace();
    const p = await barPoint(0);
    await touch('touchStart', p); await wait(120); await touch('touchEnd', p);
    await wait(400);
    const o = onsets(await trace(), FLOOR);
    ok(`'off' makes no beat (no hold, so nothing to report)`, o.n === 0, `${o.n} onset(s), peak ${o.peak}`);
  }
  {
    await open('long');
    await unlock();
    await trace();
    const ms = await ev(`Number((document.querySelector('[data-hold-ms]')||{dataset:{}}).dataset.holdMs || 0)`);
    const p = await barPoint(0);
    await touch('touchStart', p);
    await wait(ms + 350);
    await touch('touchEnd', p);
    await wait(300);
    const o = onsets(await trace(), FLOOR);
    ok(`'long' (${ms} ms) still lands its arrival`, o.n === WANT_ONSETS, `${o.n} onset(s), peaks ${JSON.stringify(o.peaks)}`);
  }

  // ---- 3. THE BEAT IS DERIVED, NOT WIRED — Law 0's falsifier for this control.
  // An element nothing in the tree has ever seen starts publishing `data-hold`
  // at runtime. No call site, no import, no registration. If it gets a beat,
  // then the day End Turn or the Smith becomes an action that holds, it arrives
  // with sound and ZERO code changes.
  {
    console.log(`\n  --derived — a control this build has never heard of starts holding`);
    await open('normal');
    await unlock();
    await trace();
    const res = await ev(`(async () => {
      const el = document.createElement('button');
      el.dataset.holdAction = 'vegaNeverBuiltThis';
      document.body.appendChild(el);
      const step = async (v) => { el.dataset.hold = v; await new Promise(r => setTimeout(r, 90)); };
      const prog = async (p) => { el.dataset.holdProgress = String(p); await new Promise(r => setTimeout(r, 90)); };
      await step('idle');
      await step('holding');
      for (const p of [0.2, 0.5, 0.9]) await prog(p);
      await step('done');
      await new Promise(r => setTimeout(r, 250));
      return true;
    })()`);
    const o = onsets(await trace(), FLOOR);
    ok(`a never-seen control that publishes data-hold gets the whole phrase`, res === true && o.n === WANT_ONSETS,
      `${o.n} onset(s), peaks ${JSON.stringify(o.peaks)}`);

    // ...and the composed id resolved to the FAMILY row, not the 440 Hz blip.
    const ids = await ev(`(async () => {
      const m = await import('./src/ui/sfx.js').catch(() => null);
      const c = await import('./src/content/sfx.js').catch(() => null);
      if (!m || !c) return { skip: 'the shipped bundle has no module graph to import' };
      const fired = m.sfx.recent.filter((i) => /^hold/.test(i));
      return { fired, resolved: fired.map((i) => c.resolveRecipe(i).matched) };
    })()`);
    if (ids && ids.skip) skip('composed-id', 'structural', ids.skip);
    else {
      firedIds = `${ids.fired.length} hold id(s)`;
      ok(`it composed per-action ids`, ids.fired.some((i) => i.endsWith('_vegaNeverBuiltThis')),
        JSON.stringify(ids.fired));
      ok(`and every one resolved to a hold row, never to the 440 Hz default`,
        ids.resolved.length > 0 && ids.resolved.every((m2) => /^hold/.test(m2)),
        JSON.stringify(ids.resolved));
    }
  }

  // ---- 8. THE BEAT'S ROW REFUSES BAD DATA AT BOOT, observed red on its own
  // corpus. Every way `balance.ui.holdBeat` can be wrong is SILENT: a fraction
  // of 1.4 never arrives, a NaN compares false against every progress reading,
  // a descending list fires the late tick once and then never again, and a
  // duplicate fires two ticks in one frame that a player hears as one. In all
  // four the screen is unchanged and the sound is simply absent — which is the
  // exact state the beat exists to distinguish from a tap that missed. That is
  // the same shape Vira found on holdConfirm one row over, so it gets the same
  // gate rather than a comment saying it should.
  {
    console.log(`\n  --schema — the beat row's boot refusal against five known-bads`);
    const sr = await ev(`(async () => {
      const v = await import('./src/model/validate.js').catch(() => null);
      const i = await import('./src/content/index.js').catch(() => null);
      if (!v || !i) return { skip: 'the shipped bundle has no module graph to import' };
      const base = i.contentBundle;
      const plant = (hb) => {
        const b = { ...base, balance: { ...base.balance, ui: { ...base.balance.ui, holdBeat: hb } } };
        return v.validateContent(b).errors.filter((e) => /holdBeat/.test(JSON.stringify(e))).map((e) => e.key || e.path);
      };
      return {
        clean: v.validateContent(base).ok,
        empty: plant({ at: [] }).length,
        bads: [
          ['a fraction the fill never reaches', plant({ at: [0, 1.4] })],
          ['a value the beat cannot read', plant({ at: [0, 'half'] })],
          ['1.0, which is the arrival and not a tick', plant({ at: [0, 1] })],
          ['ticks out of order', plant({ at: [0.8, 0.2] })],
          ['not an object', plant([0.5])],
        ],
      };
    })()`);
    if (sr && sr.skip) skip('schema', 'structural', sr.skip);
    else {
      ok(`the clean tree still validates`, sr.clean === true, `ok=${sr.clean}`);
      ok(`an EMPTY tick list is legal (turning the train off is a tuning decision)`, sr.empty === 0, `${sr.empty} error(s)`);
      for (const [name, keys] of sr.bads) ok(`refuses: ${name}`, keys.length > 0, keys.join(', ') || 'GREEN — nothing named it');
    }
  }

  // ---- 6. HAPTICS — reported, never asserted. See the header.
  console.log(`\n  haptics`);
  {
    const v = await ev(`({
      present: 'vibrate' in navigator,
      type: typeof navigator.vibrate,
      returned: (typeof navigator.vibrate === 'function') ? navigator.vibrate(20) : null,
      cancelled: (typeof navigator.vibrate === 'function') ? navigator.vibrate(0) : null,
    })`);
    console.log(`    ---- navigator.vibrate present=${v.present} typeof=${v.type} · vibrate(20) returned ${JSON.stringify(v.returned)}`);
    console.log(`    ---- THIS MACHINE HAS NO VIBRATION MOTOR. A 'true' means the pattern was accepted, never that`);
    console.log(`         anything buzzed — there is no callback, no event and no query. Feature detection is a`);
    console.log(`         lie on every desktop Chrome, and iOS Safari (so every iOS browser) has no vibrate at all.`);
    console.log(`         Nothing here can go red, which is exactly why the beat is not built on it.`);
  }

  // ---- 7. THE COST AT HOLD #200 — a proxy, named as one.
  console.log(`\n  the cost of one confirmation, against a sound the player already hears`);
  {
    const one = (id) => recipeLoudness(SFX_RECIPES[id]);
    const tickE = Math.pow(10, one('holdTick').dbA / 10);
    const comE = Math.pow(10, one('holdCommit').dbA / 10);
    const total = 10 * Math.log10(MARKS.length * tickE + comE);
    const card = one('cardPlay').dbA;
    ok(`a whole confirmation is quieter than one card play`, total < card,
      `${MARKS.length}x holdTick + holdCommit = ${total.toFixed(1)} dBA vs cardPlay ${card.toFixed(1)} dBA (analytic, tools/sfx-loudness.mjs)`);
    ok(`the tick is the quietest row in the table`,
      Object.keys(SFX_RECIPES).every((id) => id === 'holdTick' || one(id).dbA >= one('holdTick').dbA),
      `holdTick ${one('holdTick').dbA.toFixed(1)} dBA, next quietest ${
        Object.keys(SFX_RECIPES).filter((id) => id !== 'holdTick').map((id) => one(id).dbA).sort((a, b) => a - b)[0].toFixed(1)} dBA`);
    console.log(`    ---- PROXY, NOT A MEASURE OF ANNOYANCE. It says the beat does not out-shout the game;`);
    console.log(`         it cannot say whether three ticks is one too many on the two-hundredth hold.`);
    console.log(`         NOBODY HAS LISTENED TO THIS. That read is Sunna's and it is not discharged here.`);
  }

  cdp.close(); child.kill(); stop();

  if (!checks) { console.error(`\nholdbeat: nothing was measured. That is unknown, not a pass.`); process.exit(2); }

  if (mutate) {
    const caught = findings.filter((f) => /renders audio|onsets, not one/.test(f));
    // THE DIVERGENCE, PRINTED. This is the receipt that the tool measures sound
    // and not intent: under the mutation the call sites fired exactly as many
    // hold ids as they do on a clean run, and zero samples came out. A tool
    // reading `recent` would have called this a pass.
    console.log(`\n  --mutate: ${caught.length ? `CAUGHT — ${caught.length} sample check(s) went red against a suspended context.`
      : 'NOT CAUGHT — this tool is counting intentions, not sound. Do not trust a green from it.'}`);
    console.log(`    call sites vs samples: ${JSON.stringify(firedIds)} fired, ${caught.length ? 'nothing rendered' : 'something rendered'}.`);
    for (const f of findings) console.log(`    - ${f}`);
    process.exit(caught.length ? 0 : 2);
  }

  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) NOT THAT IT SOUNDS GOOD, or that three ticks is the right number. NOBODY
      HAS LISTENED. Check 7 is a level proxy for fatigue, not a measure of it.
  (b) NOT THAT A MUTED PLAYER IS SERVED. Sound is the channel a thumb does not
      cover; it is not the channel that is always on. The visible beat is still
      the floor and on End Turn it is under the finger.
  (c) NOT THE FIRST HOLD OF A PAGE, which is measurably silent on touch and
      cannot be fixed from inside the page.
  (d) NOT HAPTICS EITHER WAY — unobservable here, by construction.
  (e) ONE MACHINE, headless Chromium, 390x844, one event, Text size M.
  (f) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.`);
  if (notAsked.length) {
    console.log(`\n  NOT ASKED OF THIS ARTIFACT — ${notAsked.length}:`);
    for (const n of notAsked) console.log(`    - ${n.name} [${n.kind}] — ${n.why}`);
    console.log(`  A skip folded into a PASS is silence, and silence is unknown, which blocks (SOP 2).`);
  }
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} check(s)`
    : notAsked.length ? `INCOMPLETE — ${checks} checks held, ${notAsked.length} not asked. NOT a pass.`
    : `PASS — ${checks} checks`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : notAsked.length ? 2 : 0);
}

main().catch((e) => { console.error(`holdbeat: ${e.message}`); process.exit(2); });
