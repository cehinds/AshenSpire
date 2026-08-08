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
//   5. IT FAILS CLOSED. `--fail-closed` hands the module an op it has never
//      heard of and requires a hold, and prints every opcode the game declares
//      that would now hold. Viki's gate: the first draft enumerated the
//      DANGEROUS ops and defaulted to safe, and its closure was over
//      `RUN_OPCODES` while event effect lists demonstrably leave it. The
//      enumeration was load-bearing where a default should be.
//   6. THE LABEL SURVIVES THE FILL. Bjorn repainted the fill opaque for one
//      frame and the label vanished — `> *` reaches element children and the
//      label is a bare text node, so the line meant to lift it did nothing and
//      only the 0.30 alpha was holding. The fill is a background now, which
//      cannot have that bug, and this asserts the construction rather than
//      trusting the comment.
//   7. THE DERIVATION IS NOT A LIST. `--new-entry` authors a fictional event
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
//   node tools/holdconfirm.mjs --fail-closed   Viki's gate: unknown op must hold
//   node tools/holdconfirm.mjs --schema        the dial's boot refusal, on 5 known-bads
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
// NO OPTIONAL GATES. These were flags because the tool grew that way, and a
// gate you have to remember to pass is one that will be forgotten — which is
// the `unasked` bucket below, self-inflicted. They all run every time now; the
// flags are still accepted so nobody's habit breaks.
const newEntry = true;
const failClosed = true;
const schema = true;

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
  // WHAT THIS RUN COULD NOT ASK, BY NAME. Vira: `--dist` skipped two checks and
  // still printed PASS — "the gate this commit exists to satisfy is never asked
  // of the file that ships." A skip folded into a pass is the silence SOP 2
  // calls unknown, and unknown blocks. So skips are collected here, named in
  // the verdict, and they take the exit code with them.
  // AND IT SAYS WHICH KIND, which is Vira's answer to my `--accept-skips`
  // question and it is better than the flag I asked for. She refused the flag
  // for a reason worth keeping: A FLAG MOVES THE RECORD OF WHAT WAS NOT ASKED
  // OUT OF THE RUN'S OUTPUT AND INTO THE RUNNER'S COMMAND LINE. The output is
  // what gets pasted into a PR and read a week later; the invocation is not.
  // That is `verified-at` with the ref left off.
  //
  // But she granted the annoyance is real: these skips are STRUCTURAL AND
  // PERMANENT — no amount of running discharges them — and a gate that is red
  // forever for a reason nobody can fix is the shape people learn to step over.
  // So the fix is a WORD, not a flag:
  //
  //   structural  this surface cannot be asked at all (a single inlined file
  //               has no module graph), and no run will ever change that
  //   unasked     nobody ran it — a real gap, and a runnable one
  //
  // Same exit code, same floored denominator. What changes is that a reader can
  // finally tell "I could not look" from "I did not look". The floor goes under
  // the POPULATION, never the findings list.
  const notAsked = [];
  const skip = (name, kind, why) => { notAsked.push({ name, kind, why }); console.log(`    skip  ${name} [${kind}] — ${why}`); };
  let checks = 0;
  const ok = (name, cond, detail) => {
    checks++;
    console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };

  async function open(dial, { id = null } = {}) {
    const q = [`shot=event`, `shotEvent=${encodeURIComponent(id || EVENT)}`];
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

  // ---- 3. NOBODY IS LOCKED OUT — DRIVEN ON THE ARTIFACT UNDER TEST, not
  // imported from it. This used to import events.js and consequence.js, which a
  // single inlined dist file has no module graph for, so the one property the
  // debug-page placement RESTS ON was never asked of the thing that ships.
  //
  // It now mounts every event and reads the SCREEN: a free door is a bar that is
  // neither `data-binding` nor disabled. The ids come from the source tree at
  // this ref because a bundle cannot be asked what it contains — and that gap is
  // itself worth checking, so an id that will not mount on the artifact is a
  // finding rather than a skipped row.
  console.log(`\n  lockout — every event must leave a door for a player who cannot hold`);
  let overlapCount = null;
  const ids = await (async () => {
    try {
      const m = await import(pathToFileURL(resolve(ROOT, 'src/content/events.js')).href);
      // How much of the priced-AND-binding class shipped content can exercise.
      // Stated, never assumed — a check whose population is zero is green for
      // the wrong reason and must say so.
      try {
        const c = await import(pathToFileURL(resolve(ROOT, 'src/model/consequence.js')).href);
        const g = await import(pathToFileURL(resolve(ROOT, 'src/model/registries.js')).href);
        const i = await import(pathToFileURL(resolve(ROOT, 'src/content/index.js')).href);
        const reg = g.createRegistries(i.contentBundle);
        overlapCount = m.events.reduce((n, e) => n + e.choices.filter((ch) => ch.requires && c.isBindingChoice(ch, reg)).length, 0);
      } catch { overlapCount = null; }
      return m.events.map((e) => e.id);
    } catch { return null; }
  })();
  if (!ids || !ids.length) {
    skip('lockout', 'unasked', 'could not read the event ids from src/content/events.js at this ref');
  } else {
    const noDoor = [];
    const wontMount = [];
    for (const id of ids) {
      await open('normal', { id });
      // A FREE DOOR IS: NO HOLD AND NO PRICE. Not "not disabled" — that was a
      // fact about the one state this sweep mounts (startingCinders is 0, so it
      // mounts poor), and it agreed with the property only by a number in
      // balance.js that nothing tied to it. `data-requires` is the content fact
      // the screen now publishes, so this verdict does not depend on what the
      // player can afford and there is no purse to state.
      const r = await ev(`(() => {
        const bars = [...document.querySelectorAll('button.ev-choice')];
        if (!bars.length) return null;
        return {
          bars: bars.length,
          free: bars.filter((b) => b.dataset.binding !== '1' && b.dataset.requires !== '1').length,
          priced: bars.filter((b) => b.dataset.requires === '1').length,
        };
      })()`);
      if (!r) { wontMount.push(id); continue; }
      if (!r.free) noDoor.push(id);
    }
    ok(`every event leaves a door that needs no hold AND no price`, noDoor.length === 0,
      `${ids.length} events driven on ${useDist ? 'dist/AshenSpire.html' : 'the source tree'}, ${noDoor.length} without one${noDoor.length ? `: ${noDoor.join(', ')}` : ''}`
      + ` — purse-independent: the door must carry neither data-binding nor data-requires`);
    ok(`every event the source declares mounts on the artifact under test`, wontMount.length === 0,
      `${wontMount.length} would not mount${wontMount.length ? `: ${wontMount.join(', ')}` : ''}`);
  }

  // ---- 3b. THE CONTENT FACTS SURVIVE THE UNAFFORDABLE BRANCH. Vira's second
  // hand-back: `data-binding` used to be written only inside the AFFORDABLE
  // branch, so an unaffordable binding choice published nothing and the screen
  // said "not binding" about a choice that is. Both facts are hoisted above the
  // branch now, and this drives the one shipped event that renders a bar the
  // player cannot pay for (startingCinders is 0).
  //
  // THE POPULATION IS STATED RATHER THAN THE VERDICT ASSUMED: the
  // priced-AND-binding overlap is empty across shipped content, so the exact
  // combination that was broken has no case to drive. A green here is about the
  // WRITE POSITION, which is the thing that was wrong, and the number below
  // says how much of the class the content can actually exercise.
  {
    console.log(`\n  content facts vs the unaffordable branch`);
    await open('normal', { id: 'weepingPilgrim' });
    const r = await ev(`(() => {
      const bars = [...document.querySelectorAll('button.ev-choice')];
      const priced = bars.filter((b) => b.dataset.requires === '1');
      return {
        bars: bars.length,
        priced: priced.length,
        pricedDisabled: priced.filter((b) => b.disabled).length,
        pricedKeptFact: priced.filter((b) => b.dataset.requires === '1').length,
      };
    })()`);
    ok(`a bar the player cannot pay for still publishes its price`,
      r.priced > 0 && r.pricedDisabled === r.priced && r.pricedKeptFact === r.priced,
      `${r.priced} priced bar(s), ${r.pricedDisabled} disabled, all still carrying data-requires`);
    if (overlapCount != null) {
      console.log(`    ---- priced AND binding across shipped content: ${overlapCount} choice(s).`
        + `${overlapCount === 0 ? ' The exact combination that was broken has no case to drive — the write POSITION is what is proven here.' : ''}`);
    }
  }

  // ---- the dial's four positions, and what each one wires.
  for (const dial of ['off', 'short', 'normal', 'long']) {
    console.log(`\n  dial '${dial}'`);
    await open(dial);
    if (mutate) {
      // THE MUTATION: put the old door back. The bar keeps its class, its hint
      // and its fill — only the wiring changes, so the screen looks identical
      // and the abort silently commits.
      //
      // AND IT COUNTS WHAT IT REWIRED, which is not bookkeeping. Rune's finding
      // tonight, and it is general: A KNOWN-BAD PINNED TO A VALUE DIES THE DAY
      // THE TREE REACHES THAT VALUE — AND IT DIES GREEN. His framing mutation
      // hardcoded `data-framing = 'fit'`, `entries: 1` made every frame fit, and
      // a lie that had become true reported NOT CAUGHT. Mine is pinned to a
      // different value: that this event still HAS a binding bar to falsify.
      // Author the curse out of `rotPriestOffer` and the mutation rewires
      // nothing, the abort correctly commits nothing, and `--mutate` passes
      // having proved that a screen with no hold on it does not break. So it
      // refuses instead, by name, at exit 2 — which is where `unknown` goes.
      const rewired = await ev(`(() => {
        const bars = [...document.querySelectorAll('button.ev-choice')].filter(x => x.dataset.binding === '1');
        for (const b of bars) {
          const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
          c.addEventListener('click', () => { document.querySelector('#choices').innerHTML = '<p>mutated commit</p>'; });
        }
        return bars.length;
      })()`);
      if (dial !== 'off' && !rewired) {
        console.error(`\nholdconfirm --mutate: '${EVENT}' has no binding bar at dial '${dial}', so the mutation `
          + `rewired NOTHING and every check below would pass by having nothing to break. `
          + `That is unknown, not a caught mutation — pick an event with a binding choice (--event <id>).`);
        cdp.close(); child.kill(); stop(); process.exit(2);
      }
      if (dial !== 'off') console.log(`    (mutation rewired ${rewired} binding bar(s))`);
    }
    const before = await ev(STATE);
    if (before && before.error) { findings.push(`dial ${dial}: ${before.error}`); continue; }

    if (dial === 'off') {
      ok(`off wires no hold`, before.held === 0 && before.hints === 0, `${before.held} held bar(s), ${before.hints} hint(s)`);
      const p = await barPoint(0);
      // Same refusal as the mutation's, one dial position earlier: an event
      // with no binding choice cannot say anything about what `off` does to a
      // binding choice. An exception here would read as a broken tool; this
      // reads as the absence it is.
      if (!p) {
        console.error(`\nholdconfirm: '${EVENT}' has no binding choice, so nothing on this run measures the feature. `
          + `That is unknown, not a pass — pick an event with one (--event <id>).`);
        cdp.close(); child.kill(); stop(); process.exit(2);
      }
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
      if (!c || !i || !g) return { skip: 'the shipped bundle has no module graph to import' };
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
    if (res && res.skip) skip('new-entry', 'structural', res.skip);
    else {
      ok(`a never-seen entry with a curse arrives holding`, res && res.binding === true, `reasons ${JSON.stringify(res && res.why)}`);
      ok(`a never-seen entry with no cost does not`, res && res.free === false, `free=${res && res.free}`);
    }
  }

  // ---- 6. THE LABEL SURVIVES THE FILL (Bjorn's finding, made a check).
  // It asserts CONSTRUCTION, not pixels: a background-image paints under text
  // by definition, and a generated ::before is the shape that overlaid it. A
  // pixel comparison would be the stronger check and this repo has no home for
  // one; stated rather than implied.
  {
    console.log(`\n  the fill paints under the label`);
    await open('normal');
    const paint = await ev(`(() => {
      const b = document.querySelector('button.ev-choice.ev-hold');
      if (!b) return { error: 'no held bar' };
      const cs = getComputedStyle(b);
      const bef = getComputedStyle(b, '::before');
      return { bg: cs.backgroundImage, beforeContent: bef.content, beforePos: bef.position };
    })()`);
    ok(`the fill is a background, not an overlay`,
      !paint.error && /gradient/.test(paint.bg) && (paint.beforeContent === 'none' || paint.beforeContent === 'normal'),
      `background-image=${paint.bg ? 'gradient' : 'none'}, ::before content=${paint.beforeContent}`);
  }

  // ---- 5. IT FAILS CLOSED (Viki's gate).
  if (failClosed) {
    console.log(`\n  --fail-closed — an op this module has never heard of must hold`);
    await open('normal');
    const fc = await ev(`(async () => {
      const c = await import('./src/model/consequence.js').catch(() => null);
      const sc = await import('./src/model/schemas.js').catch(() => null);
      const evs = await import('./src/content/events.js').catch(() => null);
      const i = await import('./src/content/index.js').catch(() => null);
      const g = await import('./src/model/registries.js').catch(() => null);
      if (!c || !sc || !i || !g || !evs) return { skip: 'the shipped bundle has no module graph to import' };
      const reg = g.createRegistries(i.contentBundle);
      const unknown = { label: 'x', effects: [{ op: 'sunnaNeverHeardOfThis' }], resultText: '.' };
      // Viki's own example: a permanent COMBAT op borrowed by an event. The
      // first draft's closure was over RUN_OPCODES, so this was invisible.
      const borrowed = { label: 'x', effects: [{ op: 'exhaust' }], resultText: '.' };
      const spend = { label: 'x', effects: [{ op: 'addCinders', amount: -50 }], resultText: '.' };
      return {
        unknown: c.isBindingChoice(unknown, reg), unknownWhy: c.bindingReasons(unknown, reg),
        borrowed: c.isBindingChoice(borrowed, reg), borrowedWhy: c.bindingReasons(borrowed, reg),
        spend: c.isBindingChoice(spend, reg),
        wouldHold: c.failClosedOps(sc.OPCODES), declared: sc.OPCODES.length,
        premise: c.cinderPremise(evs.events, i.contentBundle.balance.rewards.cinders),
        worstSpend: 60, bestReward: Math.max(...Object.values(i.contentBundle.balance.rewards.cinders).map((b) => b[b.length - 1])),
        proto: c.failClosedOps(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf']).length,
      };
    })()`);
    if (fc && fc.skip) skip('fail-closed', 'structural', fc.skip);
    else {
      ok(`an op nobody has ruled on holds`, fc.unknown === true, JSON.stringify(fc.unknownWhy));
      // Vira's word: `in` walks the prototype chain, so six inherited names came
      // back non-binding from the function whose job is the opposite.
      ok(`inherited Object names hold too (Object.hasOwn, not \`in\`)`, fc.proto === 6, `${fc.proto} of 6 held`);
      ok(`a permanent COMBAT op borrowed by an event holds`, fc.borrowed === true, JSON.stringify(fc.borrowedWhy));
      // THE PREMISE, NOT THE EXCEPTION. Vira: asserting `spend === false` stays
      // green the day the faucet is deleted — the same correction I made one
      // layer up and then failed to apply to myself. Her derivable form: the
      // largest cinder spend must not exceed the largest single encounter
      // reward. Above that line a mis-tap costs more than any one fight returns
      // and "tempo, not state" stops being true.
      ok(`a cinder spend is ruled safe on purpose (the one cost with a faucet)`, fc.spend === false, `binding=${fc.spend}`);
      ok(`and the faucet that justifies it still runs`, fc.premise === null,
        fc.premise ? `worst spend ${fc.premise.worstSpend} > best single reward ${fc.premise.bestReward}` : `worst spend ${fc.worstSpend} vs best single reward ${fc.bestReward}`);
      console.log(`    ---- ${fc.wouldHold.length} of ${fc.declared} declared opcodes would hold if an event used them:`);
      console.log(`         ${fc.wouldHold.join(', ')}`);
    }
  }

  // ---- 8. THE DIAL REFUSES BAD DATA AT BOOT, observed red on its own corpus.
  // Vira: `balance.ui.holdConfirm` validated against NOTHING, so
  // `steps: { normal: 'abc' }` resolved to 0 ms and silently turned the confirm
  // step OFF while validateContent returned ok:true. Law 1 clause 5 failing
  // quiet on the one control whose failure is invisible — nothing on screen
  // looks different, the bars just commit on a tap again.
  if (schema) {
    console.log(`\n  --schema — the dial's boot refusal against five known-bads`);
    await open('normal');
    const sr = await ev(`(async () => {
      const v = await import('./src/model/validate.js').catch(() => null);
      const i = await import('./src/content/index.js').catch(() => null);
      if (!v || !i) return { skip: 'the shipped bundle has no module graph to import' };
      const base = i.contentBundle;
      const plant = (hc) => {
        const b = { ...base, balance: { ...base.balance, ui: { ...base.balance.ui, holdConfirm: hc } } };
        return v.validateContent(b).errors.filter((e) => /holdConfirm/.test(JSON.stringify(e))).map((e) => e.key || e.path);
      };
      return {
        clean: v.validateContent(base).ok,
        bads: [
          ['a duration the code cannot read', plant({ def: 'normal', steps: { normal: 'abc' } })],
          ['a default naming no step', plant({ def: 'nope', steps: { off: 0, normal: 600 } })],
          ['no positions at all', plant({ def: 'normal', steps: {} })],
          ['a negative duration', plant({ def: 'normal', steps: { normal: -5 } })],
          ['not an object', plant('x')],
        ],
      };
    })()`);
    if (sr && sr.skip) skip('schema', 'structural', sr.skip);
    else {
      ok(`the clean tree still validates`, sr.clean === true, `ok=${sr.clean}`);
      for (const [name, keys] of sr.bads) ok(`refuses: ${name}`, keys.length > 0, keys.join(', ') || 'GREEN — nothing named it');
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
  (d2) THE FILL CHECK IS CONSTRUCTION, NOT PIXELS. It proves the fill is a
      background and no ::before overlays the bar; it has not compared one
      rendered label against another. Bjorn's 6.87-7.49:1 is the read that has.
  (e) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.`);
  if (notAsked.length) {
    const structural = notAsked.filter((n) => n.kind === 'structural');
    console.log(`\n  NOT ASKED OF THIS ARTIFACT — ${notAsked.length}:`);
    for (const n of notAsked) console.log(`    - ${n.name} [${n.kind}] — ${n.why}`);
    console.log(`  A skip folded into a PASS is silence, and silence is unknown, which blocks (SOP 2).`);
    if (structural.length === notAsked.length) {
      console.log(`  All ${structural.length} are STRUCTURAL: this surface cannot answer them, and no`);
      console.log(`  re-run will change that. Ask them of the source tree — same ref, same commit.`);
    }
  }
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} check(s)`
    : notAsked.length ? `INCOMPLETE — ${checks} checks held, ${notAsked.length} not asked `
        + `(${notAsked.filter((n) => n.kind === 'structural').length} structural, ${notAsked.filter((n) => n.kind === 'unasked').length} unasked). NOT a pass.`
    : `PASS — ${checks} checks`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : notAsked.length ? 2 : 0);
}

main().catch((e) => { console.error(`holdconfirm: ${e.message}`); process.exit(2); });
