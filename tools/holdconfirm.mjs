#!/usr/bin/env node
// tools/holdconfirm.mjs — THE SECOND BEAT: WHICH ACTIONS TAKE ONE, WHICH FORM,
// AND CAN THE PLAYER STILL GET OUT? (Sunna 2026-08-08; widened by Rune the same
// week, when Marina ruled that which actions take a second beat is a
// CHARACTERISTIC ON THE ACTION and never a list of call sites.)
//
// IT KEEPS ITS NAME AND ITS FILE. The hold's physics are the hardest thing here
// and they already live in this harness; a second tool for "the other beats"
// would be one subject with two instruments, which is the second copy this
// house is named for. What it grew is a SET section and four more surfaces.
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
//   8. THE SET IS ENUMERABLE, AND THE PAGE AGREES WITH IT. Every action in
//      `src/model/secondbeat.js` is printed with every cell of every
//      state-dependent row expanded, then held against what the game ACTUALLY
//      DREW, both directions: a declared action that draws no control is a
//      declaration with no handler; a control armed under an id nobody declared
//      is a gap. Neither is visible from a source tree.
//   9. END TURN ALWAYS HOLDS while the dial is enabled — the literal ruling on
//      "same with ending turn". A spent hand does not remove the beat. Off still
//      restores the old one-tap pointer path, while keyboard/pad activation
//      remains immediate because it cannot be a pointing miss.
//  10. THE SMITH CONFIRMS, and the confirm carries the preview. #105 shipped
//      that preview as a HOVER tooltip and a phone has no hover, so the touch
//      player's preview was nothing at all. One tap ARMS, CANCEL takes it back,
//      CONFIRM commits — and both answers are measured against the tap floor
//      and against the sideways travel of their own scroll container.
//  11. THE MERCHANT'S BRAZIER, which nobody asked for and which burns a card
//      out of the deck for good on one tap of a small card in a wrapped grid.
//  12. THE THREE BEATS THIS GAME ALREADY HAD, IN THEIR OWN SCREENS' HANDS —
//      the census's `handledBy` rows, which this tool took ON FAITH from the
//      day the set section was written until the three `?shot=` states landed
//      (title / profile / crisis, main.js). Each is driven in its own idiom,
//      because handledBy is an exemption from the shared machinery and not
//      from being watched: the title's ✕ arms on one press, takes itself back
//      at 2.5 s, and deletes only on the armed second press; the drawer's
//      Restore opens an inline confirm that names what happens to the profile
//      in play; the crisis screen's "Start a new profile" opens a modal, and
//      its commit is read off the save manager's own named state
//      (window.__profile → profileStatus()), never inferred from which screen
//      mounted next. Every pose enters by the real doors: a real save written
//      then listed, a real profile archived by replacePrimaryWith, real torn
//      bytes read by the real parser.
//
// OBSERVED RED — `--mutate`, and it falsifies the thing that would be silent.
// It puts the OLD DOOR back on every one of the eight armed surfaces: the
// binding bars, End Turn, the shrine's Rest, every Smith candidate, every
// brazier card, the title's ✕, the drawer's Restore and the crisis screen's
// fresh-profile button are rewired so a pointer `click` commits (or looks
// committed) directly, leaving the classes exactly where they are. Each screen
// still LOOKS right and each abort silently commits. EIGHT SEPARATE VERDICTS,
// one per surface, and a run where any one of them fails to go red exits 2 — a
// mutation caught on the event bars and missed on End Turn would have printed
// CAUGHT under one filter, which is a green that proves the wrong thing. A
// guard nobody has watched fail is `unknown`, not green (development.md, the
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
// Surfaces driven: ?shot=event, ?shot=combat, ?shot=rest, ?shot=shop,
// ?shot=title, ?shot=profile, ?shot=crisis. Which ones is DERIVED from the
// table's own `surface` field, so a new row with a reachable surface is swept
// the day it is written and a new row WITHOUT one is named in the skips rather
// than skipped in silence.
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
  const held = bars.filter((b) => b.classList.contains('beat-hold'));
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

  // The centre of any element, in DEVICE px — where a thumb goes. Returns null
  // for a selector that matches nothing OR matches something with no box: a
  // zero-size element is not a thing a finger can press, and treating one as a
  // point would dispatch a touch at (0,0) and report whatever that hit.
  const pointOf = async (sel, n = 0) => ev(`(() => {
    const b = [...document.querySelectorAll(${JSON.stringify(sel)})][${n}];
    if (!b) return null; const r = b.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);

  // A real finger: down, wait, up. `ms` under the dial aborts; over it commits.
  // A NULL POINT IS A REFUSAL, NOT A CRASH. Under --mutate the control a later
  // step reaches for may genuinely be gone — that is the mutation working — and
  // a tool that dies on the defect it found reports an exception where a
  // reader needed a result.
  async function press(p, ms) {
    if (!p) return false;
    await touch('touchStart', p);
    await wait(ms);
    await touch('touchEnd', p);
    await wait(280);
    return true;
  }

  async function openShot(state, extra = {}) {
    const q = [`shot=${state}`, ...Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)];
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 100; i++) { if (await ev(`!!document.querySelector('[data-beat-action], .combat, .screen')`)) break; await wait(120); }
    await wait(400);
  }

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
      const b = document.querySelector('button.ev-choice.beat-hold');
      if (!b) return { error: 'no held bar' };
      const cs = getComputedStyle(b);
      const bef = getComputedStyle(b, '::before');
      return { bg: cs.backgroundImage, beforeContent: bef.content, beforePos: bef.position };
    })()`);
    ok(`the fill is a background, not an overlay`,
      !paint.error && /gradient/.test(paint.bg) && (paint.beforeContent === 'none' || paint.beforeContent === 'normal'),
      `background-image=${paint.bg ? 'gradient' : 'none'}, ::before content=${paint.beforeContent}`);

    // ---- 6b. THE FILL IS STILL THERE WITH A POINTER ON IT, AND IT IS THE
    // PAINTED VALUE THAT IS READ (Sunna, 2026-08-08 — this branch shipped the
    // defect and nothing here could see it).
    //
    // Every check above this line reads `data-hold-progress`, which is written
    // by the same function that writes `--hold` and is therefore incapable of
    // disagreeing with it. THE DEFECT WAS IN THE PAINT. `base.css` carries a
    // bare `button:hover { background: #2e2517 }` — a SHORTHAND, so it resets
    // `background-image` — at specificity (0,1,1). Renaming `.ev-hold` to
    // `.beat-hold` dropped the fill rule to (0,1,0), under it. A hovering
    // pointer therefore deleted the entire fill while `--hold` climbed
    // perfectly, and YOU CANNOT HOLD A CONTROL WITHOUT BEING OVER IT.
    //
    // So this reads `getComputedStyle().backgroundSize` — the picture — with a
    // MOUSE over the bar, mid-press, and holds it against `--hold`. It is the
    // one check in this file that could ever have gone red on that defect, and
    // it was OBSERVED RED against the branch head before the CSS fix, entering
    // by the same door a player does: the real bundle, a real hover, a real
    // press. dev's `button.ev-choice.ev-hold` (0,2,1) passes it too, which is
    // why the defect was a regression and not a shipped bug.
    //
    // The second half is the ease. `button` also declares
    // `transition: background 120ms` — same shorthand, so `background-size`
    // eases: on dev the paint ran ~13 points behind and GREW on the frame after
    // the finger lifted. That is the one frame the rule's own comment says must
    // tell the truth instantly, so the tolerance here is tight on purpose: an
    // eased fill cannot stay inside 2 points of a value moving at ~1.7 points
    // per frame.
    {
      const b = await pointOf('button.ev-choice.beat-hold');
      if (!b) skip('the painted fill', 'unasked', 'no held bar to hover');
      else {
        const M = (t, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type: t, x, y, button: t === 'mouseMoved' ? 'none' : 'left', clickCount: 1, ...extra }, sessionId);
        await M('mouseMoved', b.x, b.y);
        await wait(200);
        const hov = await ev(`(() => { const cs = getComputedStyle(document.querySelector('button.ev-choice.beat-hold'));
          return { img: /gradient/.test(cs.backgroundImage) }; })()`);
        ok(`a pointer resting on the bar does not delete the fill`, hov.img === true,
          `background-image with :hover applied = ${hov.img ? 'gradient' : 'NONE — base.css button:hover out-specifies the fill rule'}`);
        await M('mousePressed', b.x, b.y, { buttons: 1 });
        await wait(300);
        const mid = await ev(`(() => { const e = document.querySelector('button.ev-choice.beat-hold');
          const painted = parseFloat(getComputedStyle(e).backgroundSize);
          const truth = parseFloat(e.style.getPropertyValue('--hold')) * 100;
          return { painted, truth, img: /gradient/.test(getComputedStyle(e).backgroundImage) }; })()`);
        await M('mouseReleased', b.x, b.y, { buttons: 0 });
        await wait(250);
        ok(`the PAINTED fill matches the hold, under the pointer that is holding it`,
          mid.img === true && Number.isFinite(mid.painted) && Math.abs(mid.painted - mid.truth) <= 2,
          `painted ${Number.isFinite(mid.painted) ? mid.painted.toFixed(1) : mid.painted}% vs --hold ${mid.truth.toFixed(1)}%`
          + ` (>2 points apart means the fill is eased, or gone)`);
        await M('mouseMoved', 5, 5);
      }
    }
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


  // ==========================================================================
  // THE SET — "WHICH ACTIONS TAKE A SECOND BEAT?" ANSWERED, AND THEN CHECKED
  // AGAINST THE PAGE IN BOTH DIRECTIONS.
  //
  // Marina's ruling is that the answer is a characteristic on the action, never
  // a list of call sites — so the answer has to be ENUMERABLE, and this is the
  // thing that enumerates it. A table nobody can print is a list of call sites
  // that happens to live in one file.
  //
  // BOTH DIRECTIONS, because each catches a different lie:
  //   TABLE -> PAGE   a row that draws no control is a declaration with no
  //                   handler — the exact defect ui/surfaces.js exists for.
  //   PAGE -> TABLE   a control armed under an id nobody declared. Weaker than
  //                   it sounds and it is said out loud below: a destructive
  //                   control that calls NO machinery at all marks nothing and
  //                   is invisible to this and to every static read of the
  //                   tree. That hole is answered by a person, and tonight it
  //                   was — the merchant's card-burn and the flask were found
  //                   that way, not by this tool.
  let table = null;
  {
    console.log(`\n  the set — every action, every cell of every state-dependent row`);
    // READ IN NODE, NOT IN THE PAGE, and that is a correction rather than a
    // convenience. Importing it through the page made the whole census
    // STRUCTURALLY UNASKABLE of `--dist` — a single inlined file has no module
    // graph — so the one artifact a player is handed got the hold physics and
    // none of the set, and one check went FAIL rather than skip because a null
    // import is not a form. The table is source at this ref; what ties it to
    // the artifact under test is tools/verify-shipped.mjs (dist === build ===
    // this source), and that chain is named here rather than assumed.
    table = await (async () => {
      try {
        const b = await import(pathToFileURL(resolve(ROOT, 'src/model/secondbeat.js')).href);
        return { rows: b.enumerateBeats(), owed: b.beatsOwed(), sane: b.assertTableSane(),
                 ids: Object.keys(b.ACTIONS), endTurnForm: b.beatFor('endTurn').form };
      } catch (e) { return { skip: `could not read src/model/secondbeat.js at this ref: ${e.message}` }; }
    })();
    if (table && table.skip) skip('the-set', 'structural', table.skip);
    else {
      ok(`the table is well formed`, table.sane.length === 0, table.sane.join(' | ') || `${table.ids.length} actions declared`);
      if (useDist) console.log(`    ---- the table is read from the SOURCE TREE at this ref; tools/verify-shipped.mjs`
        + ` is what says the artifact under test was built from it.`);
      // A ZERO-ROW TABLE IS NOT A CLEAN TABLE. Every check below iterates it, so
      // an empty one turns this whole section green by having nothing to ask —
      // the wrong-place empty SOP 2 calls malformed.
      ok(`the set is not empty`, table.rows.length > 0 && table.owed.length > 0,
        `${table.rows.length} cell(s), ${table.owed.length} action(s) owe a beat`);
      const w = Math.max(...table.rows.map((r) => r.id.length));
      for (const r of table.rows) {
        const cell = Object.keys(r.ctx).length ? ` ${JSON.stringify(r.ctx)}` : '';
        console.log(`    ${String(r.form).padEnd(7)} ${r.id.padEnd(w)}${cell}`
          + `${r.handledBy ? `   [in its own hand: ${r.handledBy}]` : ''}`);
      }
      console.log(`    ---- OWES A BEAT TODAY: ${table.owed.join(', ')}`);
      console.log(`    ---- TAKES A TAP: ${[...new Set(table.rows.filter((r) => r.form === 'none').map((r) => r.id))].join(', ')}`);
    }
  }

  // ---- the census, per surface ---------------------------------------------
  if (table && !table.skip) {
    console.log(`\n  table vs page — every declared action must draw the control it claims`);
    const surfaces = [...new Set(table.rows.map((r) => r.surface).filter(Boolean))];
    const seen = new Map();      // id -> Set(forms drawn)
    const undeclared = [];
    for (const surface of surfaces) {
      await openShot(surface, surface === 'event' ? { shotEvent: EVENT } : {});
      // Two of the controls live behind a reveal (the Smith's grid, the
      // merchant's brazier). A census that only reads the first paint would
      // report them absent, which is the same word as "not wired" and means the
      // opposite — so the reveal is part of opening the surface.
      // THE FLASK MOVED BEHIND A MENU (Codex, #142-era flask-action work): the
      // slot itself is now inert selection — tapping it opens the shared
      // action menu, and the second beat rides the menu's Use row
      // (combat.js openCombatFlaskMenu -> arm(button, 'useFlask', ...)).
      // That is the door a player's thumb actually walks, so the census walks
      // it too: slot LAST, after the other openers, so an outside press does
      // not close the menu before the scan reads it. Observed red without
      // this press at dev = 86564e6 ('7 claimed, 1 absent: useFlask') — the
      // census reading a closed menu as 'not wired', which means the opposite.
      for (const opener of ['#smith-opt', '#remove-opt', '.flask-slot']) {
        const p = await pointOf(opener);
        if (p) { await press(p, 30); await wait(220); }
      }
      const drawn = await ev(`[...document.querySelectorAll('[data-beat-action]')].map((e) => ({
        id: e.dataset.beatAction, form: e.dataset.beat || 'none' }))`);
      for (const d of drawn) {
        if (!seen.has(d.id)) seen.set(d.id, new Set());
        seen.get(d.id).add(d.form);
        if (!table.ids.includes(d.id)) undeclared.push(`${surface}: ${d.id}`);
      }
      const here = [...new Set(drawn.map((d) => `${d.id}=${d.form}`))].sort();
      console.log(`    ?shot=${surface.padEnd(7)} ${drawn.length} armed control(s)  ${here.join('  ') || '(none)'}`);
    }
    const claimed = table.rows.filter((r) => r.surface && !r.handledBy);
    const missing = [...new Set(claimed.filter((r) => !seen.has(r.id)).map((r) => r.id))];
    ok(`every action that names a reachable surface draws a control there`, missing.length === 0,
      `${claimed.length ? [...new Set(claimed.map((r) => r.id))].length : 0} claimed, ${missing.length} absent${missing.length ? `: ${missing.join(', ')}` : ''}`);
    ok(`every armed control on every driven surface is a declared action`, undeclared.length === 0,
      undeclared.length ? undeclared.join(', ') : `${[...seen.keys()].length} distinct action(s) drawn`);
    // The form the PAGE drew must be a form the TABLE derives. This is the
    // check that would catch a screen quietly hard-coding a hold on something
    // the table rules 'none' — which is the defect Marina's ruling forbids,
    // wearing the machinery's own clothes.
    const wrongForm = [];
    for (const [id, forms] of seen) {
      const legal = new Set(table.rows.filter((r) => r.id === id).map((r) => r.form));
      for (const f of forms) if (!legal.has(f)) wrongForm.push(`${id} drew '${f}', table derives ${[...legal].join('|')}`);
    }
    ok(`no control draws a form its own row does not derive`, wrongForm.length === 0, wrongForm.join(' | ') || 'every drawn form is a cell of its row');
    // The rows that reach NO instrument. Named, counted, and they take the exit
    // code with them — a gap folded into a pass is the silence that hid the
    // second half of his sentence in the first place.
    // A ROW THAT OWES NO BEAT AND IS NOT ROUTED HAS NOTHING TO WATCH, and
    // counting it as a gap would be inflating the red with rows working exactly
    // as declared (playCard, rewardPick, draftPick). THE GAP IS A SECOND BEAT
    // THIS GAME HAS THAT NOTHING HERE CAN OPEN. For a week that named three
    // `handledBy` rows — deleteSave, profileRestore, freshProfile — real
    // confirms nobody had ever watched run; the three `?shot=` states this
    // line asked for exist now (title / profile / crisis) and their beats are
    // DRIVEN below, in their own screens' hands. What this skip still guards
    // is the FUTURE row: any beat-owing action whose row names no surface
    // lands here by name and takes the exit code with it, exactly as the
    // first three did.
    const unreachable = [...new Set(table.rows.filter((r) => r.form !== 'none' && !r.surface)
      .map((r) => `${r.id} (${r.handledBy ? 'its own hand: ' + r.handledBy.split(' — ')[0] : 'nothing wires it'})`))];
    if (unreachable.length) skip(`${unreachable.length} second beat(s) no instrument can open`, 'unasked', unreachable.join(' · '));
  }

  // ---- END TURN, DRIVEN. "same with ending turn." --------------------------
  {
    console.log(`\n  END TURN — the half of his sentence that was dropped`);
    await openShot('combat');
    if (mutate) {
      // PUT THE OLD DOOR BACK. The button keeps its class, its fill and its
      // HOLD word — only the wiring changes, so the screen looks identical and
      // the abort silently ends the turn. The check below must go red.
      const rewired = await ev(`(() => {
        const b = document.querySelector('.end-turn'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { window.__combat.turn++; });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no End Turn button to rewire. unknown, not caught.'); cdp.close(); child.kill(); stop(); process.exit(2); }
      console.log(`    (mutation rewired End Turn to commit on a pointer click)`);
    }
    const st = () => ev(`(() => {
      const c = window.__combat; const b = document.querySelector('.end-turn');
      if (!c || !b) return null;
      return { turn: c.turn, phase: c.phase, energy: c.player.energy,
               beat: b.dataset.beat, holdMs: Number(b.dataset.holdMs || 0),
               pulse: b.classList.contains('pulse'),
               hint: !!b.querySelector('.hold-hint') };
    })()`);
    const a = await st();
    if (!a) skip('end-turn', 'unasked', 'no ?shot=combat board with a window.__combat handle at this ref');
    else {
      ok(`with a play still in hand, End Turn owes a HOLD`, a.beat === 'hold' && a.holdMs > 0,
        `beat=${a.beat} ms=${a.holdMs} energy=${a.energy} pulse=${a.pulse}`);
      ok(`and it SAYS so on the button`, a.hint === true, `HOLD hint present=${a.hint}`);
      ok(`the table rules End Turn as an unconditional hold`, table && !table.skip && table.endTurnForm === 'hold',
        `beatFor('endTurn') = ${table && table.endTurnForm}`);

      const p = await pointOf('.end-turn');
      if (!p) ok(`End Turn is pressable`, false, 'the button has no box');
      else {
        // 1. THE ABORT. This is the check that matters: an early release
        // committing would look exactly like a working feature.
        await press(p, Math.round(a.holdMs * 0.4));
        const b1 = await st();
        ok(`a release before the fill lands does NOT end the turn`,
          b1.turn === a.turn && b1.phase === a.phase,
          `turn ${a.turn} -> ${b1.turn}, phase ${a.phase} -> ${b1.phase}`);
        // 2. A COMPLETED HOLD ENDS IT.
        await press(p, a.holdMs + 350);
        await wait(900);
        const b2 = await st();
        ok(`a completed hold ends the turn`, b2 && (b2.turn > a.turn || b2.phase !== 'player'),
          `turn ${a.turn} -> ${b2 && b2.turn}, phase ${a.phase} -> ${b2 && b2.phase}`);
      }

      // 3. THE SPENT EDGE. The ruling is state-independent: energy reaching 0
      // does not take the safety step off End Turn.
      await openShot('combat');
      const c0 = await ev(`(() => {
        const c = window.__combat; if (!c) return null;
        c.player.energy = 0;
        const b = document.querySelector('.end-turn');
        return { turn: c.turn, beat: b && b.dataset.beat, holdMs: Number((b && b.dataset.holdMs) || 0) };
      })()`);
      if (!c0) skip('end-turn spent edge', 'unasked', 'no combat handle');
      else {
        ok(`with nothing left to spend, End Turn still owes the enabled hold`,
          c0.beat === 'hold' && c0.holdMs > 0,
          `energy=0 beat=${c0.beat} ms=${c0.holdMs}`);
      }

      // 4. OFF IS STILL OFF. The characteristic remains `hold`, but the dial
      // removes its timer and visible hint, and a pointer tap commits once.
      await openShot('combat', { shotSettings: JSON.stringify({ holdConfirm: 'off' }) });
      const off = await st();
      ok(`Off removes End Turn's hold timer and hint`, off && off.holdMs === 0 && off.hint === false,
        off ? `beat=${off.beat} ms=${off.holdMs} hint=${off.hint}` : 'no combat state');
      const op = await pointOf('.end-turn');
      if (!off || !op) ok(`Off leaves End Turn pressable`, false, 'no button box');
      else {
        await press(op, 30); await wait(900);
        const off2 = await st();
        ok(`Off restores one-tap pointer End Turn`, off2 && (off2.turn > off.turn || off2.phase !== 'player'),
          `turn ${off.turn} -> ${off2 && off2.turn}, phase ${off.phase} -> ${off2 && off2.phase}`);
      }

      // 5. Keyboard/pad activation is a synthetic click (detail 0), not a
      // pointing hazard. It remains immediate under the enabled dial.
      await openShot('combat');
      const key0 = await st();
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'e', code: 'KeyE', windowsVirtualKeyCode: 69 }, sessionId);
      await wait(900);
      const key1 = await st();
      ok(`the End Turn key remains immediate and commits once`, key0 && key1 && (key1.turn > key0.turn || key1.phase !== 'player'),
        `turn ${key0 && key0.turn} -> ${key1 && key1.turn}, phase ${key0 && key0.phase} -> ${key1 && key1.phase}`);
    }
  }

  // ---- THE SHRINE: one screen, two forms -----------------------------------
  {
    console.log(`\n  THE SHRINE — Rest holds, the Smith confirms (two mistakes, two answers)`);
    await openShot('rest');
    if (mutate) {
      const rewired = await ev(`(() => {
        const b = document.querySelector('#rest-opt'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { c.remove(); });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no #rest-opt to rewire. unknown, not caught.'); cdp.close(); child.kill(); stop(); process.exit(2); }
      console.log(`    (mutation rewired Rest to commit on a pointer click)`);
    }
    const onShrine = () => ev(`!!document.querySelector('#rest-opt')`);
    const restBeat = await ev(`(() => { const e = document.querySelector('#rest-opt'); return e ? { beat: e.dataset.beat, ms: Number(e.dataset.holdMs || 0) } : null; })()`);
    if (!restBeat) skip('shrine', 'unasked', 'no ?shot=rest screen at this ref');
    else {
      ok(`Rest owes a HOLD`, restBeat.beat === 'hold' && restBeat.ms > 0, `beat=${restBeat.beat} ms=${restBeat.ms}`);
      const rp = await pointOf('#rest-opt');
      await press(rp, Math.round(restBeat.ms * 0.4));
      ok(`a release before the fill lands does NOT spend the shrine`, await onShrine(), `still on the shrine=${await onShrine()}`);

      // The Smith. Reveal the grid, then press a candidate.
      const sp = await pointOf('#smith-opt');
      await press(sp, 30); await wait(250);
      if (mutate) {
        // The pre-#115 shape of THIS ask: one tap on a candidate commits.
        await ev(`(() => { for (const el of document.querySelectorAll('#smith-grid .card')) {
          const c = el.cloneNode(true); el.parentNode.replaceChild(c, el);
          c.addEventListener('click', () => { document.querySelector('#smith-grid').remove(); });
        } })()`);
        console.log(`    (mutation rewired every Smith candidate to commit on a pointer click)`);
      }
      const cardP = await pointOf('#smith-grid .card');
      if (!cardP) ok(`the Smith grid offers a candidate`, false, 'no card in #smith-grid — nothing to confirm');
      else {
        await press(cardP, 30); await wait(260);
        const armed = await ev(`(() => {
          const panel = document.querySelector('.beat-confirm');
          return { panel: !!panel,
                   detail: panel ? (panel.querySelector('.beat-detail') || {}).innerHTML || '' : '',
                   yes: !!document.querySelector('.beat-confirm .beat-yes'),
                   no: !!document.querySelector('.beat-confirm .beat-no'),
                   stillHere: !!document.querySelector('#smith-grid'),
                   armedCard: document.querySelectorAll('.beat-armed').length };
        })()`);
        ok(`one tap on a candidate ARMS, it does not smith`, armed.panel && armed.stillHere,
          `panel=${armed.panel} still on the shrine=${armed.stillHere} armed card(s)=${armed.armedCard}`);
        // THE ASK, LITERALLY: "the upgrade preview, confirmable." A confirm
        // panel with no preview in it is a modal, which is the thing the hold
        // was chosen over.
        ok(`the panel carries the upgrade preview a phone never had`, armed.detail.length > 0,
          `.beat-detail is ${armed.detail.length} chars`);
        ok(`and both answers are offered`, armed.yes && armed.no, `CONFIRM=${armed.yes} CANCEL=${armed.no}`);
        // LAW 4 AND LAW 5 ON THE THING THIS BRANCH DREW. A confirm step is a
        // NEW pair of targets on a phone and a NEW box in a wrapped grid, so
        // both laws land on it the moment it exists — and neither is somebody
        // else's tool's job to notice for me. The floor is read from the page's
        // own `--tap-floor` rather than from the number 44, because the number
        // has a home and a second copy of it here would be the defect this
        // house is named for. NOT A FOURTH AXIS CHECKER: it measures the ONE
        // container this branch added, and says so.
        const box = await ev(`(() => {
          const p = document.querySelector('.beat-confirm'); if (!p) return null;
          // A CUSTOM PROPERTY READ OFF :root IS THE RAW TOKEN, NOT A NUMBER.
          // The tap floor is a calc() over the zoom variable, so parseFloat of
          // it is NaN -- which this check first read as 0 and then compared
          // every button against, passing on any height at all. A floor of zero
          // is not a floor; it is an assertion that cannot fail. So the value
          // is RESOLVED by making the browser lay a box out at it.
          const probe = document.createElement('div');
          probe.style.cssText = 'position:absolute;left:-9999px;top:0;height:var(--tap-floor);width:var(--tap-floor)';
          document.body.appendChild(probe);
          const floor = +probe.getBoundingClientRect().height.toFixed(1);
          probe.remove();
          const btns = [...p.querySelectorAll('.beat-actions button')].map((b) => {
            const r = b.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
          });
          // The nearest ancestor that can actually scroll sideways, which is
          // the only container Law 5 clause 1 is measured on. A document-level
          // read is 0 by construction here and proves nothing.
          let sc = p.parentElement, travel = null, which = null;
          while (sc && sc !== document.body) {
            const cs = getComputedStyle(sc);
            if (/(auto|scroll)/.test(cs.overflowX + cs.overflow)) {
              travel = sc.scrollWidth - sc.clientWidth; which = sc.className || sc.tagName; break;
            }
            sc = sc.parentElement;
          }
          const r = p.getBoundingClientRect();
          return { floor, btns, travel, which, right: +r.right.toFixed(1), docW: document.documentElement.clientWidth };
        })()`);
        if (!box) ok(`the confirm panel obeys the floors`, false, 'no panel to measure');
        else {
          ok(`both answers meet the tap floor (Law 4)`,
            box.floor > 0 && box.btns.length === 2 && box.btns.every((b) => b.h >= box.floor - 0.5 && b.w >= box.floor - 0.5),
            `floor ${box.floor} px${box.floor > 0 ? '' : ' — THE FLOOR DID NOT RESOLVE, so this check could not fail'}`
            + ` · ${box.btns.map((b) => `${b.w}x${b.h}`).join(' ')}`);
          ok(`the panel adds no sideways travel to its own scroller (Law 5)`,
            (box.travel === null || box.travel === 0) && box.right <= box.docW + 0.5,
            `scroller ${box.which || '(none — nothing scrolls sideways above it)'} travel=${box.travel} · panel right edge ${box.right} of ${box.docW} px`);
        }
        // CANCEL puts it back.
        const noP = await pointOf('.beat-confirm .beat-no');
        if (!(await press(noP, 30))) ok(`CANCEL takes it back and nothing was smithed`, false, 'no CANCEL button — the panel never opened');
        else {
          await wait(250);
          const afterNo = await ev(`({ panel: !!document.querySelector('.beat-confirm'), stillHere: !!document.querySelector('#smith-grid') })`);
          ok(`CANCEL takes it back and nothing was smithed`, !afterNo.panel && afterNo.stillHere,
            `panel=${afterNo.panel} still on the shrine=${afterNo.stillHere}`);
        }
        // CONFIRM commits.
        const c2 = await pointOf('#smith-grid .card');
        if (await press(c2, 30)) await wait(260);
        const yesP = await pointOf('.beat-confirm .beat-yes');
        if (!yesP) ok(`a confirmed upgrade commits and leaves the shrine`, false, 'the panel did not re-open — there was nothing to confirm');
        else {
          await press(yesP, 30); await wait(500);
          ok(`a confirmed upgrade commits and leaves the shrine`, !(await onShrine()), `still on the shrine=${await onShrine()}`);
        }
      }
    }
  }

  // ---- THE MERCHANT: the one nobody asked for ------------------------------
  {
    console.log(`\n  THE MERCHANT — burning a card out of the deck for good`);
    await openShot('shop');
    const openGrid = await pointOf('#remove-opt');
    if (!openGrid) skip('merchant', 'unasked', 'no ?shot=shop screen with a payable brazier at this ref');
    else {
      await press(openGrid, 30); await wait(250);
      if (mutate) {
        await ev(`(() => { for (const el of document.querySelectorAll('#remove-grid .card')) {
          const c = el.cloneNode(true); el.parentNode.replaceChild(c, el);
          c.addEventListener('click', () => { c.remove(); });
        } })()`);
        console.log(`    (mutation rewired every brazier card to burn on a pointer click)`);
      }
      const before = await ev(`(() => ({ cards: document.querySelectorAll('#remove-grid .card').length }))()`);
      const cp = await pointOf('#remove-grid .card');
      if (!cp) ok(`the brazier offers a card`, false, 'no card in #remove-grid');
      else {
        await press(cp, 30); await wait(260);
        const armed = await ev(`(() => ({ panel: !!document.querySelector('.beat-confirm'),
          q: (document.querySelector('.beat-confirm .beat-q') || {}).textContent || '',
          cards: document.querySelectorAll('#remove-grid .card').length }))()`);
        ok(`one tap ARMS the burn, it does not burn`, armed.panel && armed.cards === before.cards,
          `panel=${armed.panel} deck ${before.cards} -> ${armed.cards}`);
        ok(`and the question names the card and the price`, /cinders/.test(armed.q), JSON.stringify(armed.q.slice(0, 70)));
      }
    }
  }

  // ==========================================================================
  // THE THREE BEATS IN THEIR OWN SCREENS' HANDS — the census's `handledBy`
  // rows, watched instead of believed. Each is driven in its own idiom, on a
  // state posed by the real doors (see main.js, the three states' comments).
  // The exemption `handledBy` names is from the SHARED MACHINERY, never from
  // being measured: no `data-beat-action` is expected on any of these, and
  // none of these sections reads one.

  // ---- THE TITLE: deleting a run — the game's oldest second beat ------------
  {
    console.log(`\n  THE TITLE — the ✕ arms, takes itself back, and deletes only on the armed second press`);
    await openShot('title');
    if (mutate) {
      // THE OLD DOOR: one click deletes, no arm. The button keeps its class
      // and its glyph — only the wiring changes.
      const rewired = await ev(`(() => {
        const b = document.querySelector('.slot-delete'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { c.closest('.slot').remove(); });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no .slot-delete to rewire at ?shot=title. unknown, not caught.'); cdp.close(); child.kill(); stop(); process.exit(2); }
      console.log(`    (mutation rewired the slot's ✕ to delete on ONE pointer click)`);
    }
    const tState = () => ev(`(() => {
      const d = document.querySelector('.slot-delete');
      return {
        occupied: document.querySelectorAll('.slot.occupied').length,
        del: !!d,
        armed: d ? d.dataset.armed === '1' : null,
        label: d ? d.textContent.trim() : null,
        cont: !!document.querySelector('.slot-continue'),
      };
    })()`);
    const t0 = await tState();
    if (!t0.del || !t0.occupied) skip('title', 'unasked', 'no occupied slot with a delete control at ?shot=title at this ref');
    else {
      ok(`the pose surfaced a REAL save through the real reader`, t0.occupied === 1 && t0.cont,
        `${t0.occupied} occupied slot(s), CONTINUE drawn=${t0.cont} — listSlots reading the bytes newRun wrote`);
      ok(`at rest the ✕ is not armed`, t0.armed === false && t0.label === '✕',
        `armed=${t0.armed} label=${JSON.stringify(t0.label)}`);
      const dp = await pointOf('.slot-delete');
      await press(dp, 30);
      const t1 = await tState();
      ok(`one press ARMS the delete and deletes NOTHING`,
        t1.del && t1.armed === true && /Delete\?/.test(t1.label || '') && t1.occupied === t0.occupied,
        `armed=${t1.armed} label=${JSON.stringify(t1.label)} occupied ${t0.occupied} -> ${t1.occupied}`);
      // THE ABORT IS TIME, which is this form's whole difference: nobody
      // presses again and the arm takes itself back. title.js resets at
      // 2500 ms; measured past it.
      await wait(2700);
      const t2 = await tState();
      ok(`an armed ✕ nobody presses again takes itself back`,
        mutate ? true : (t2.armed === false && t2.label === '✕' && t2.occupied === t0.occupied),
        `armed=${t2.armed} label=${JSON.stringify(t2.label)} occupied=${t2.occupied} after the 2.5 s self-reset`);
      // THE ARMED SECOND PRESS COMMITS — and the verdict is the re-render the
      // real reader draws from storage, not the button's own state.
      const dp2 = await pointOf('.slot-delete');
      if (await press(dp2, 30)) { await press(await pointOf('.slot-delete'), 30); await wait(400); }
      const t3 = await tState();
      ok(`the second press while armed deletes the run`,
        mutate ? true : (t3.occupied === 0 && !t3.cont),
        `occupied ${t0.occupied} -> ${t3.occupied}, CONTINUE=${t3.cont} — read off the re-rendered slot list`);
    }
  }

  // ---- SETTINGS → PROFILE: restoring a set-aside profile --------------------
  {
    console.log(`\n  SETTINGS → PROFILE — Restore opens an inline confirm that names what happens to the profile in play`);
    await openShot('profile');
    // The player's own door into the section: the Profile tab in the modal.
    const tab = await pointOf('.set-tab[data-member="Profile"]');
    if (!tab) skip('profile', 'unasked', 'no Profile tab in the Settings modal at ?shot=profile at this ref');
    else {
      await press(tab, 30); await wait(300);
      if (mutate) {
        // THE OLD DOOR: one tap "restores" — the result line speaks, no
        // confirm ever opens.
        const rewired = await ev(`(() => {
          const b = document.querySelector('.prof-restore'); if (!b) return 0;
          const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
          c.addEventListener('click', () => { const r = document.querySelector('.prof-result'); if (r) r.textContent = 'Restored.'; });
          return 1;
        })()`);
        if (!rewired) { console.error('\nholdconfirm --mutate: no .prof-restore to rewire at ?shot=profile. unknown, not caught.'); cdp.close(); child.kill(); stop(); process.exit(2); }
        console.log(`    (mutation rewired Restore to look committed on ONE pointer click)`);
      }
      const pState = () => ev(`(() => ({
        restore: !!document.querySelector('.prof-restore'),
        confirm: !!document.querySelector('.prof-confirm'),
        entries: document.querySelectorAll('.prof-entry').length,
        result: ((document.querySelector('.prof-result') || {}).textContent || '').trim(),
      }))()`);
      const p0 = await pState();
      if (!p0.restore) skip('profile', 'unasked', 'the drawer offered no restorable profile — the ?shot=profile pose did not archive one');
      else {
        ok(`the drawer lists the REAL set-aside profile the pose archived`, p0.entries > 0,
          `${p0.entries} entr(ies) — listArchives reading what replacePrimaryWith wrote`);
        const rp = await pointOf('.prof-restore');
        await press(rp, 30);
        const p1 = await pState();
        ok(`one tap on Restore ARMS the confirm and restores NOTHING`,
          p1.confirm === true && p1.result === '' && p1.entries === p0.entries,
          `confirm=${p1.confirm} result=${JSON.stringify(p1.result.slice(0, 40))} entries ${p0.entries} -> ${p1.entries}`);
        const stated = await ev(`(() => { const c = document.querySelector('.prof-confirm'); return c ? c.textContent : ''; })()`);
        ok(`and the confirm names what happens to the profile in play`,
          mutate ? true : /set aside/.test(stated),
          JSON.stringify(String(stated).replace(/\s+/g, ' ').trim().slice(0, 70)));
        // "Not yet" takes it back.
        const cp = await pointOf('.prof-cancel');
        if (!(await press(cp, 30))) ok(`"Not yet" takes it back and nothing was restored`, mutate ? true : false, 'no cancel button — the confirm never opened');
        else {
          const p2 = await pState();
          ok(`"Not yet" takes it back and nothing was restored`,
            !p2.confirm && p2.result === '' && p2.entries === p0.entries,
            `confirm=${p2.confirm} result=${JSON.stringify(p2.result.slice(0, 20))} entries=${p2.entries}`);
        }
        // "Restore it" commits — witnessed by the re-render's own words AND by
        // the drawer growing by the profile that was set aside in its place,
        // both read back through the real reader.
        const rp2 = await pointOf('.prof-restore');
        if (await press(rp2, 30)) await wait(200);
        const gp = await pointOf('.prof-go');
        if (!gp) ok(`"Restore it" commits and the outgoing profile is set aside in its place`, mutate ? true : false, 'the confirm did not re-open — nothing to commit');
        else {
          await press(gp, 30); await wait(400);
          const p3 = await pState();
          ok(`"Restore it" commits and the outgoing profile is set aside in its place`,
            /Restored\./.test(p3.result) && p3.entries === p0.entries + 1,
            `result=${JSON.stringify(p3.result.slice(0, 44))} entries ${p0.entries} -> ${p3.entries}`);
        }
      }
    }
  }

  // ---- THE CRISIS SCREEN: starting a new profile over an unreadable one -----
  {
    console.log(`\n  THE CRISIS SCREEN — "Start a new profile" opens its confirm; the commit is read off the manager's own state`);
    await openShot('crisis');
    const cState = () => ev(`(() => {
      const p = typeof window.__profile === 'function' ? window.__profile() : null;
      return {
        notice: !!document.querySelector('.profile-notice'),
        modal: !!document.querySelector('.confirm-fresh'),
        title: !!document.querySelector('.title-screen'),
        state: p && p.state, ok: p && p.ok, quarantined: p && p.quarantined,
        archived: !!(p && p.archiveId),
      };
    })()`);
    const c0 = await cState();
    if (!c0.notice) skip('crisis', 'unasked', 'no .profile-notice mounted at ?shot=crisis at this ref');
    else {
      ok(`the torn bytes entered by the real door: named, quarantined, archived`,
        c0.ok === false && c0.state === 'corrupt' && c0.quarantined === true && c0.archived,
        `state=${c0.state} quarantined=${c0.quarantined} old bytes ${c0.archived ? 'kept in the drawer' : 'MISSING'}`);
      if (mutate) {
        // THE OLD DOOR: one click starts fresh, no confirm.
        const rewired = await ev(`(() => {
          const b = document.querySelector('.fresh'); if (!b) return 0;
          const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
          c.addEventListener('click', () => { const n = document.querySelector('.profile-notice'); if (n) n.remove(); });
          return 1;
        })()`);
        if (!rewired) { console.error('\nholdconfirm --mutate: no .fresh to rewire at ?shot=crisis. unknown, not caught.'); cdp.close(); child.kill(); stop(); process.exit(2); }
        console.log(`    (mutation rewired "Start a new profile" to commit on ONE pointer click)`);
      }
      const fp = await pointOf('.fresh');
      await press(fp, 30);
      const c1 = await cState();
      ok(`"Start a new profile" OPENS its confirm and starts NOTHING`,
        c1.modal === true && c1.notice && c1.quarantined === true,
        `modal=${c1.modal} notice still mounted=${c1.notice} quarantined=${c1.quarantined}`);
      // "Not yet" — the safe answer holds everything exactly where it was.
      const np = await pointOf('.confirm-fresh .cancel');
      if (!(await press(np, 30))) ok(`"Not yet" closes the confirm and the old bytes stay quarantined`, mutate ? true : false, 'no cancel — the confirm never opened');
      else {
        const c2 = await cState();
        ok(`"Not yet" closes the confirm and the old bytes stay quarantined`,
          !c2.modal && c2.notice && c2.quarantined === true && c2.state === 'corrupt',
          `modal=${c2.modal} state=${c2.state} quarantined=${c2.quarantined}`);
      }
      // "Start fresh" commits — and because navigation after it is
      // unconditional, the screen alone cannot witness the write: the verdict
      // is profileStatus() itself, plus the promise the modal makes kept in
      // state (the old bytes still archived, not deleted).
      const fp2 = await pointOf('.fresh');
      if (await press(fp2, 30)) await wait(200);
      const gp2 = await pointOf('.confirm-fresh .go');
      if (!gp2) ok(`"Start fresh" commits: a fresh profile is live and the torn one is KEPT`, mutate ? true : false, 'the confirm did not re-open — nothing to commit');
      else {
        await press(gp2, 30); await wait(500);
        const c3 = await cState();
        ok(`"Start fresh" commits: a fresh profile is live and the torn one is KEPT`,
          c3.ok === true && c3.state === 'ok' && c3.quarantined === false && c3.archived && c3.title,
          `state=${c3.state} quarantined=${c3.quarantined} old bytes ${c3.archived ? 'kept' : 'LOST'} title mounted=${c3.title}`);
      }
    }
  }

  cdp.close(); child.kill(); stop();

  if (!checks) { console.error(`\nholdconfirm: nothing was measured. That is unknown, not a pass.`); process.exit(2); }

  if (mutate) {
    // ONE VERDICT PER FALSIFIED SURFACE, not one for the whole run. A mutation
    // that is caught on the event screen and slips past End Turn would have
    // printed CAUGHT under the old single filter — which is the shape of a
    // green that proves the wrong thing.
    const CAUGHT_BY = [
      ['event bars', 'commits NOTHING'],
      ['End Turn', 'does NOT end the turn'],
      ['the shrine', 'does NOT spend the shrine'],
      ['the Smith', 'it does not smith'],
      ['the merchant', 'it does not burn'],
      ['the title slot', 'deletes NOTHING'],
      ['the profile drawer', 'restores NOTHING'],
      ['the crisis screen', 'starts NOTHING'],
    ];
    const caught = findings.filter((f) => CAUGHT_BY.some(([, needle]) => f.includes(needle)));
    for (const [name, needle] of CAUGHT_BY) {
      const hit = findings.some((f) => f.includes(needle));
      console.log(`    --mutate ${name.padEnd(12)} ${hit ? 'CAUGHT' : 'NOT CAUGHT — that check proves nothing'}`);
    }
    const missed = CAUGHT_BY.filter(([, needle]) => !findings.some((f) => f.includes(needle)));
    if (missed.length) {
      console.log(`\n  --mutate: ${missed.length} surface(s) did not go red. That is unknown, not a caught mutation.`);
      for (const f of findings) console.log(`    - ${f}`);
      process.exit(2);
    }
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
  (e) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.
  (f) NOT THAT THE SET IS COMPLETE. Both directions of the census run between
      the table and THE CONTROLS THE MACHINERY ARMED. A destructive control
      that calls no machinery at all marks nothing, so it is invisible here and
      to every static read of the tree — the same hole ui/surfaces.js names
      about navigable sets. The merchant's card-burn and the drinkable flask
      were found by a person reading nine screens, not by this.
  (g) NOT THAT THE FORMS ARE THE RIGHT ONES. The table's axis (stakes / undo /
      hazard) is a design claim. This proves the derivation is applied
      consistently and reaches the page; it cannot tell you that a hold on End
      Turn is what a player wants, and NOBODY HAS WATCHED A PLAYER USE IT.
  (h) THE THREE handledBy BEATS ARE MEASURED AS THEY ARE, NOT AS THE TABLE
      DERIVES THEM. deleteSave's row derives 'hold'; its hand answers with a
      two-click self-resetting arm — a third form. This proves that arm works
      (arms, resets, commits only armed); whether it SHOULD be the shared
      hold is a design call, and a green here licenses nothing about it. The
      crisis pose is the corrupt state only: 'older' and 'newer' render
      different screens and neither is driven here.`);
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
