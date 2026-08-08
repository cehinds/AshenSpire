#!/usr/bin/env node
// tools/holdconfirm.mjs — CAN THE PLAYER LET GO IN TIME? (Sunna, 2026-08-08.)
//
// THE DEFECT THIS EXISTS FOR, and it is the one number that would not move. The
// event screen's three choice bars are 44/44/44 across sixteen cells — the SIZE
// was fixed and the miss stayed, because the GAPS are 9-9.7 px at every dial
// setting and nothing in this game reads a gap. A thumb 9 px low lands on the
// neighbour, and on that screen the neighbour is a permanent curse with no
// confirm and no undo. Constantine: "yes press and hold."
//
// WHAT IT MEASURES, with real pointer input dispatched at real coordinates —
// never a synthetic `.click()`, because the whole feature is about which door a
// pointer opens and a synthesised click walks through a different one:
//
//   1. THE ABORT IS THE FEATURE. Press a binding bar, release BEFORE the fill
//      lands. The screen must be unchanged: the bars still there, no result
//      text, nothing committed. THIS IS THE EDGE THAT MATTERS — an early
//      release quietly committing would make the safety step a second way to
//      fire the thing, and it would look identical to working.
//   2. A COMPLETED HOLD COMMITS. Hold past the dial's duration; the result
//      text arrives. A confirm nobody can complete is a lockout, not a guard.
//   3. NOBODY IS LOCKED OUT. Every one of the shipped events must offer at
//      least one UNCONDITIONAL non-binding choice, so a player who cannot
//      perform a hold at all can still leave every event screen. This is the
//      property that makes "the off switch lives on a debug page" safe, and it
//      is checked against the content rather than assumed.
//   4. `off` IS THE OLD BEHAVIOUR, byte for byte: one tap commits.
//   5. THE DERIVATION IS NOT A LIST. `--new-entry` authors a fictional event
//      whose only interesting property is a curse, injects it as CONTENT with
//      no code change, and requires that it arrive holding. That is Law 0's
//      falsifier for this control.
//
// OBSERVED RED — `--mutate`, and it falsifies the thing that would be silent.
// It rewires the binding bars so a pointer `click` commits directly (the shape
// this feature replaced), leaving the fill exactly where it is. The screen
// still LOOKS right; the abort silently commits. Check 1 must go red. A guard
// nobody has watched fail is `unknown`, not green (development.md, the
// instrument rule).
//
// Usage
//   node tools/holdconfirm.mjs                 source tree via tools/serve.mjs
//   node tools/holdconfirm.mjs --dist          dist/AshenSpire.html over file://
//   node tools/holdconfirm.mjs --mutate        must catch the falsified wiring
//   node tools/holdconfirm.mjs --new-entry     Law 0 falsifier, content only
//   CHROME=/path/to/chrome node tools/holdconfirm.mjs
//
// Exit codes
//   0  every check held
//   1  a real failure
//   2  usage / no browser / a screen that would not mount / nothing measured /
//      --mutate not caught — never a pass
//
// BOUNDARY, and it is not small: headless Chromium on one Linux machine, one
// shape (390x844), CDP-synthesised touch. It measures WHAT THE DOM DID. It does
// not measure whether 600 ms FEELS right under a real thumb, it does not know
// what a tremor does to a hold, and NOBODY HAS WATCHED A PERSON USE THIS — the
// duration is reasoned from Android's long-press threshold, not observed.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const mutate = args.includes('--mutate');
const newEntry = args.includes('--new-entry');

printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);

const BROWSERS = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// `rotPriestOffer` is the adjacency the feature is about: two binding choices
// stacked over a free one, so a low thumb finds a curse.
const EVENT = argOf('--event') || 'rotPriestOffer';
const SHAPE = { w: 390, h: 844 };

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

// What the PLAYER can see: are the bars still there, or has the result arrived?
const STATE = `(() => {
  const box = document.querySelector('#choices');
  if (!box) return { error: 'no #choices' };
  const bars = [...box.querySelectorAll('button.ev-choice')];
  const binding = bars.filter((b) => b.dataset.binding === '1');
  const held = bars.filter((b) => b.classList.contains('ev-hold'));
  return {
    bars: bars.length,
    binding: binding.length,
    held: held.length,
    hints: box.querySelectorAll('.hold-hint').length,
    committed: bars.length === 0,
    holdMs: held.length ? Number(held[0].dataset.holdMs) : null,
    progress: held.length ? Number(held[0].dataset.holdProgress || 0) : null,
    holdState: held.length ? held[0].dataset.hold : null,
    labels: bars.map((b) => b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 44)),
  };
})()`;

async function main() {
  if (!browserPath) { console.error('holdconfirm: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }

  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  else { const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8288), open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  const dir = mkdtempSync(join(tmpdir(), 'holdc-'));
  const { child, wsUrl } = await new Promise((res, rej) => {
    const c = spawn(browserPath, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = ''; const on = (x) => { buf += x; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res({ child: c, wsUrl: m[1] }); };
    c.stderr.on('data', on); c.stdout.on('data', on); c.on('error', rej);
    setTimeout(() => rej(new Error('holdconfirm: chromium never printed an endpoint')), 20000);
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  // `awaitPromise` because two of the checks import the shipped modules and an
  // un-awaited promise resolves to `undefined`, which reads exactly like a
  // clean empty result — the wrong-place empty SOP 2 calls `malformed`.
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: SHAPE.w, height: SHAPE.h, deviceScaleFactor: 2, mobile: true }, sessionId);

  const findings = [];
  let checks = 0;
  const ok = (name, cond, detail) => {
    checks++;
    console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };

  async function open(dial, { entry = false } = {}) {
    const q = [`shot=event`, `shotEvent=${encodeURIComponent(entry ? 'sunnaFalsifierRite' : EVENT)}`];
    if (dial) q.push(`shotSettings=${encodeURIComponent(JSON.stringify({ holdConfirm: dial }))}`);
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 80; i++) { if (await ev(`!!document.querySelector('#choices button')`)) break; await wait(120); }
    await wait(250);
  }

  // The centre of the Nth binding bar, in DEVICE px — where a thumb goes.
  const barPoint = async (n) => ev(`(() => {
    const b = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')[${n}];
    if (!b) return null; const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);

  async function touch(type, p) {
    await cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x: p.x, y: p.y, id: 1 }],
    }, sessionId);
  }

  console.log(`\nholdconfirm — ${useDist ? 'dist/AshenSpire.html' : 'source tree'} · ${SHAPE.w}x${SHAPE.h} · event '${EVENT}'`
    + `${mutate ? '  ·  --mutate: the binding bars are rewired to commit on a pointer click' : ''}`);

  // ---- 3. NOBODY IS LOCKED OUT (content, no browser needed for the truth,
  // but read through the page so it is the SHIPPED content being asked).
  console.log(`\n  lockout — every event must leave a door for a player who cannot hold`);
  await open('normal');
  const lock = await ev(`(async () => {
    const m = await import('./src/content/events.js').catch(() => null);
    const c = await import('./src/model/consequence.js').catch(() => null);
    const i = await import('./src/content/index.js').catch(() => null);
    const g = await import('./src/model/registries.js').catch(() => null);
    if (!m || !c || !i || !g) return { skip: 'modules not importable at this base (expected under --dist)' };
    // The tool builds its own registries from the SHIPPED content rather than
    // reaching for a debug handle — no window global was added to main.js so an
    // instrument could be convenient.
    const reg = g.createRegistries(i.contentBundle);
    const bad = [];
    for (const e of m.events) {
      const free = e.choices.filter((ch) => !ch.requires && !c.isBindingChoice(ch, reg));
      if (!free.length) bad.push(e.id);
    }
    return { total: m.events.length, bad };
  })()`);
  if (lock && lock.skip) console.log(`    skip  ${lock.skip}`);
  else ok('every event has an unconditional non-binding choice', lock && lock.bad && lock.bad.length === 0,
    lock ? `${lock.total} events, ${lock.bad.length} without one${lock.bad.length ? `: ${lock.bad.join(', ')}` : ''}` : 'no answer');

  // ---- the dial's four positions, and what each one wires.
  for (const dial of ['off', 'short', 'normal', 'long']) {
    console.log(`\n  dial '${dial}'`);
    await open(dial);
    if (mutate) {
      // THE MUTATION: put the old door back. The bar keeps its class, its hint
      // and its fill — only the wiring changes, so the screen looks identical
      // and the abort silently commits.
      await ev(`(() => {
        for (const b of [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1')) {
          const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
          c.addEventListener('click', () => { document.querySelector('#choices').innerHTML = '<p>mutated commit</p>'; });
        }
        return 1;
      })()`);
    }
    const before = await ev(STATE);
    if (before && before.error) { findings.push(`dial ${dial}: ${before.error}`); continue; }

    if (dial === 'off') {
      ok(`off wires no hold`, before.held === 0 && before.hints === 0, `${before.held} held bar(s), ${before.hints} hint(s)`);
      const p = await barPoint(0);
      await touch('touchStart', p); await wait(40); await touch('touchEnd', p);
      await wait(220);
      const after = await ev(STATE);
      ok(`off commits on a tap (the pre-hold behaviour)`, mutate ? true : after.committed, `committed=${after.committed}`);
      continue;
    }

    ok(`the binding bars hold`, before.held > 0 && before.held === before.binding,
      `${before.binding} binding, ${before.held} armed, ${before.hints} hint(s), ${before.holdMs} ms`);

    // ---- 1. THE ABORT. Press the bar a low thumb finds, let go early.
    const p = await barPoint(0);
    if (!p) { findings.push(`dial ${dial}: no binding bar to press`); continue; }
    await touch('touchStart', p);
    await wait(Math.round(before.holdMs * 0.45));
    const mid = await ev(STATE);
    await touch('touchEnd', p);
    await wait(260);
    const aborted = await ev(STATE);
    ok(`a release before the fill lands commits NOTHING`, !aborted.committed && aborted.bars === before.bars,
      `bars ${before.bars} -> ${aborted.bars}, committed=${aborted.committed}`);
    ok(`the fill was visibly under way when the finger lifted`, mutate ? true : (mid.progress > 0.05 && mid.progress < 1),
      `progress ${mid.progress} at 45% of ${before.holdMs} ms`);
    ok(`the bar returned to rest after the abort`, mutate ? true : aborted.holdState === 'idle' && aborted.progress === 0,
      `state=${aborted.holdState} progress=${aborted.progress}`);

    // ---- 2. A COMPLETED HOLD COMMITS.
    // If the abort above already committed, there is no bar left to hold and
    // that is the finding, not a crash — a tool that dies on the defect it
    // found reports it as an exception instead of a result.
    const p2 = await barPoint(0);
    if (!p2) { ok(`a completed hold commits`, false, 'no binding bar left — the abort above already committed it'); continue; }
    await touch('touchStart', p2);
    await wait(before.holdMs + 320);
    await touch('touchEnd', p2);
    await wait(260);
    const done = await ev(STATE);
    ok(`a completed hold commits`, done.committed, `committed=${done.committed}, bars=${done.bars}`);
  }

  // ---- 5. THE DERIVATION IS NOT A LIST (Law 0's falsifier for this control).
  if (newEntry) {
    console.log(`\n  --new-entry — one fictional event, content only, ZERO code commits`);
    await open('normal');
    const res = await ev(`(async () => {
      const c = await import('./src/model/consequence.js').catch(() => null);
      const i = await import('./src/content/index.js').catch(() => null);
      const g = await import('./src/model/registries.js').catch(() => null);
      if (!c || !i || !g) return { skip: 'not importable under --dist' };
      const reg = g.createRegistries(i.contentBundle);
      // A brand-new entry, authored the way content is authored: a label, some
      // effects, a card that declares itself a curse. Nothing registers it as
      // dangerous; nothing lists its id anywhere.
      const choice = { label: 'Take the rite', effects: [{ op: 'addCardToDeck', card: 'guilt' }], resultText: '.' };
      const safe = { label: 'Walk on', effects: [], resultText: '.' };
      return { binding: c.isBindingChoice(choice, reg),
               free: c.isBindingChoice(safe, reg),
               why: c.bindingReasons(choice, reg) };
    })()`);
    if (res && res.skip) console.log(`    skip  ${res.skip}`);
    else {
      ok(`a never-seen entry with a curse arrives holding`, res && res.binding === true, `reasons ${JSON.stringify(res && res.why)}`);
      ok(`a never-seen entry with no cost does not`, res && res.free === false, `free=${res && res.free}`);
    }
  }

  cdp.close(); child.kill(); stop();

  if (!checks) { console.error(`\nholdconfirm: nothing was measured. That is unknown, not a pass.`); process.exit(2); }

  if (mutate) {
    const caught = findings.filter((f) => f.includes('commits NOTHING'));
    console.log(`\n  --mutate: ${caught.length ? `CAUGHT — ${caught.length} abort(s) silently committed. The check can go red.`
      : 'NOT CAUGHT — the check proves nothing.'}`);
    for (const f of findings) console.log(`    - ${f}`);
    process.exit(caught.length ? 0 : 2);
  }

  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) NOT THAT THE DURATION IS RIGHT. 600 ms is reasoned from Android's
      long-press threshold. NOBODY HAS WATCHED A PERSON USE THIS.
  (b) NOT A TREMOR, not a prosthetic, not a cold hand. CDP touch is a perfect
      finger and a perfect finger is the one case that was never at risk.
  (c) ONE MACHINE, headless Chromium, 390x844, one event.
  (d) NOTHING ABOUT THE 9 px GAP ITSELF, which is unchanged and still nobody's
      measurement to read — this makes the miss survivable, not impossible.
  (e) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.`);
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} check(s)` : `PASS — ${checks} checks`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error(`holdconfirm: ${e.message}`); process.exit(2); });
