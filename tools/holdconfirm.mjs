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
//   4. `off` DISABLES THE HOLD SHORTCUT, NOT THE REVIEW. One tap still opens
//      the same confirmation modal; only that modal may commit the action.
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
//      "same with ending turn". A spent hand does not remove the beat. Off
//      removes the shortcut while preserving the confirmation path.
//  9b. AND THE DIAL IS ONE SWITCH OVER ALL THREE INPUTS. Constantine,
//      2026-08-17: "if hold is toggled, then it should be the same, in all
//      instances. for ending turn, using flask, event choice, shrine rest."
//      Four actions x keyboard and pad x dial on and off, each cell asking BOTH
//      halves — the short press aborts, the long press commits — because either
//      half alone passes against a key that has simply stopped working. Eight
//      cells were RED at b83bda1 and the numbers are printed at that section.
//      This is where the sentence "keyboard/pad activation remains immediate
//      because it cannot be a pointing miss" used to live: it was this tool's
//      own reasoning, it was good, and his word replaced it.
//  10. THE SMITH CONFIRMS, and the confirm carries the preview. #105 shipped
//      that preview as a HOVER tooltip and a phone has no hover, so the touch
//      player's preview was nothing at all. One tap ARMS, CANCEL takes it back,
//      CONFIRM commits — and both answers are measured against the tap floor
//      and against the sideways travel of their own scroll container.
//  11. THE MERCHANT'S BRAZIER, which nobody asked for and which burns a card
//      out of the deck for good on one tap of a small card in a wrapped grid.
//  12. THE BEATS IN THEIR OWN SCREENS' HANDS — the census's `handledBy` rows,
//      which this tool took ON FAITH from the day the set section was written
//      until the three `?shot=` states landed (title / profile / crisis,
//      main.js). Each is driven in its own idiom, because handledBy is an
//      exemption from the shared machinery and not from being watched: the
//      drawer's Restore opens an inline confirm that names what happens to
//      the profile in play; the crisis screen's "Start a new profile" opens a
//      modal, and its commit is read off the save manager's own named state
//      (window.__profile → profileStatus()), never inferred from which screen
//      mounted next. Every pose enters by the real doors: a real profile
//      archived by replacePrimaryWith, real torn bytes read by the real
//      parser. (The title's ✕ was the third of these — a two-click,
//      self-resetting arm — until 2026-08-14, when its row collapsed into the
//      machinery: it holds now, on the dial, and is driven like End Turn on a
//      real save written then listed.)
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
//   node tools/holdconfirm.mjs --selftest      the wide hold's known-bad: 5 source
//                                              plants, each re-run end to end
//   node tools/holdconfirm.mjs --root DIR      serve a different tree (--selftest's door)
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
import { launchBrowser } from './browser.mjs';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// The tree that gets SERVED. Defaults to this tool's own repo; --selftest points
// it at a disposable copy carrying one planted defect.
const SERVE_ROOT = argOf('--root') ? resolve(argOf('--root')) : ROOT;
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
  const optionControls = bars.filter((b) => b.dataset.optionDecision);
  return {
    bars: bars.length,
    binding: binding.length,
    held: held.length,
    optionControls: optionControls.length,
    hints: box.querySelectorAll('.hold-hint').length,
    committed: bars.length === 0,
    reviewing: !!document.querySelector('.confirmation-modal'),
    holdMs: held.length ? Number(held[0].dataset.holdMs) : null,
    progress: held.length ? Number(held[0].dataset.holdProgress || 0) : null,
    holdState: held.length ? held[0].dataset.hold : null,
    labels: bars.map((b) => b.textContent.replace(/\\s+/g, ' ').trim().slice(0, 44)),
  };
})()`;

// ---- THE RE-RUNNABLE KNOWN-BAD FOR THE WIDE HOLD (--selftest) ---------------
//
// `--mutate` above falsifies the POINTER wiring by rewiring the DOM. It cannot
// reach this one: the wide hold lives in ui/input.js and ui/components/
// holdconfirm.js, and a defect there arrives as a SOURCE EDIT. So each plant
// below is exactly that — one contract line replaced in a disposable copy of
// src/, judged by re-running this whole tool at `--root COPY`: real server,
// real boot, real CDP keys, real shimmed pad. Nothing is handed to a function.
//
// EACH PLANT MUST ALSO LEAVE AN UNTOUCHED CORNER GREEN. A plant that craters
// the run proves the tool notices breakage, not that it notices THIS breakage.
const PLANTS = [
  {
    name: 'Q1 the source refusal, restored',
    file: 'src/ui/components/holdconfirm.js',
    from: '    heldThisPress = origin.source === \'pointer\';',
    to: "    if (origin.source !== 'pointer') return false;\n    heldThisPress = true;",
    what: 'the pre-S7 line that made the hold a mouse feature',
    expect: 'every non-pointer TAP commits again — the eight cells that were red at b83bda1',
    mustRed: (out) => /FAIL\s+endTurn: ON, a short key press does NOT end the turn/.test(out),
    mustStay: (out) => /ok\s+endTurn: ON, a held key press DOES end the turn/.test(out)
      || /ok\s+a completed hold ends the turn/.test(out),
  },
  {
    name: 'Q2 the release contract cut',
    file: 'src/ui/components/holdconfirm.js',
    from: '      onEnd: () => { if (armed) stop(\'idle\'); return true; },',
    to: "      onEnd: () => { if (armed) stop('idle'); },",
    what: 'the answer input.js reads as "did the gesture consume the activation?"',
    expect: 'an ABORTED key/pad hold activates on release — the abort commits',
    mustRed: (out) => /FAIL\s+\w+: ON, a short (key|pad) press does NOT/.test(out),
    mustStay: (out) => /ok\s+a release before the fill lands does NOT end the turn/.test(out),
  },
  {
    name: 'Q3 the key door closed',
    file: 'src/ui/input.js',
    from: '  const held = pressTarget(id);\n  if (held) { pressBegin(source, held); return; }',
    to: '  /* holdconfirm --selftest Q3: a key action never presses its control */',
    what: 'the pad half of a `kind: key` action reaching its armed control',
    expect: 'the pad button commits End Turn on a tap again',
    mustRed: (out) => /FAIL\s+endTurn: ON, a short pad press does NOT end the turn/.test(out),
    mustStay: (out) => /ok\s+endTurn: ON, a short key press does NOT end the turn/.test(out),
  },
  // Q4 WAS HERE AND IS DELETED, WHICH IS ITSELF THE FINDING. It cut
  // `if (!(Number(el.dataset.holdMs) > 0)) return null;` out of input.js's
  // `pressTarget`, on the claim that the clause is THE SWITCH that makes `off`
  // mean off on a key. IT IS NOT: the switch is armHold's `ms0 > 0`, and with
  // the dial off `begin` declines the press and `pressBegin` activates
  // immediately. Watched, this whole tool at --root COPY: the planted tree ran
  // 111 checks and EXITED 0, every `OFF, one press does…` cell green. The
  // clause is a redundant guard whose only observable difference is a
  // `disabled` button on the co-op board, which no `?shot=` state opens — so
  // it is `unknown`, it is named at the line in input.js, and it keeps no plant
  // here. A corpus entry that cannot go red is worse than a missing one: it
  // sells the coverage it does not have.
  {
    name: 'Q5 the veil scope dropped',
    file: 'src/ui/input.js',
    from: '  const root = scopeRoot();\n  if (!root || !root.contains(el)) return null;',
    to: '  /* holdconfirm --selftest Q5: the active focus scope is not consulted */',
    what: 'the clause that leaves an open veil owning the End Turn key',
    expect: 'holding `e` with the draw pile open ENDS THE TURN under the panel',
    mustRed: (out) => /FAIL\s+with a veil standing, HOLDING the End Turn key does nothing/.test(out),
    mustStay: (out) => /ok\s+endTurn: ON, a held key press DOES end the turn/.test(out),
  },
  {
    name: 'Q6 the autorepeat leak',
    file: 'src/ui/input.js',
    from: '  if (!typing && keyPressAction && matchAction(ev, keyPressAction)) {\n    ev.preventDefault();\n    ev.stopPropagation();\n    return;\n  }',
    to: '  /* holdconfirm --selftest Q6: the OS repeat stream reaches the screen */',
    what: 'the swallow that keeps an OS autorepeat inside the press it belongs to',
    expect: 'the second keydown (33 ms in) reaches combat and clicks End Turn — the turn '
      + 'ends a third of the way through a hold that keeps filling',
    mustRed: (out) => /FAIL\s+endTurn: ON, a short key press does NOT end the turn/.test(out),
    mustStay: (out) => /ok\s+endTurn: ON, a short pad press does NOT end the turn/.test(out),
  },
  {
    // THE ONE PLANT IN THIS CORPUS THAT IS ABOUT WHERE A THING IS, NOT WHAT IT
    // DOES. Every plant above cuts a contract and the panel keeps working
    // perfectly somewhere the player cannot see; this one leaves every contract
    // intact and puts the question 156 px below the fold, which is how it
    // shipped. It exists because the surface's OWN gate could not go red on
    // that (uprightgate's clause R gates `unreachable`, and this was
    // `scrollable`) — so the plant is aimed at the two cells that can.
    name: 'Q7 the confirm panel left below the fold',
    file: 'src/ui/components/holdconfirm.js',
    from: "    el.insertAdjacentElement('afterend', panel);\n    reveal(panel, row);",
    to: "    el.insertAdjacentElement('afterend', panel);",
    what: 'the scroll that brings a freshly-armed confirm panel into the viewport',
    expect: 'both answers open below the fold again — 0% on screen at 390x844 and at 360x640, '
      + 'reachable only by a scroll nothing advertises',
    mustRed: (out) => /FAIL\s+the confirm panel's ANSWERS open on screen at 390x844/.test(out)
      && /FAIL\s+the confirm panel's ANSWERS open on screen at 360x640/.test(out),
    // THE UNTOUCHED CORNER, AND IT IS THE ONE THAT MAKES THE POINT: the panel is
    // still built correctly. It arms, it carries the preview, and both answers
    // still meet the tap floor — all of that was green while the defect shipped.
    mustStay: (out) => /ok\s+both answers meet the tap floor \(Law 4\)/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'hc-kb-'));
  for (const d of ['src', 'styles', 'assets', 'content']) {
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
    console.error(`holdconfirm --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  Each find-string is one of the wide hold\'s CONTRACTS, not a convenience.');
    console.error('  RE-AIM it at the bytes the defect replaces. Do not delete it and do not');
    console.error('  loosen it: a corpus that silently stops matching is a suite that has gone');
    console.error('  green about nothing.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('holdconfirm --selftest — the re-runnable known-bad for the WIDE hold (S7)');
  console.log(`  DOOR: one source line replaced in a disposable copy of ${ROOT}/src, then this`);
  console.log('  whole tool re-run at --root COPY. Same server, same boot, same CDP keys, same');
  console.log('  shimmed pad as the real run above. A source edit is how this defect arrives.\n');
  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  const clean = await runAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants are the only difference`);
  if (clean.code !== 0) console.log(clean.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 6).map((l) => `      ${l.trim()}`).join('\n'));
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: an untouched corner stays green (right reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /^\s*FAIL/.test(l)).slice(0, 4)) console.log(`      ${line.trim()}`);
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(`\n  ${fails ? `FAIL — ${fails} selftest check(s) failed` : `PASS — ${PLANTS.length} plants, every one watched red by name`}`);
  process.exit(fails ? 1 : 0);
}

async function main() {
  if (!browserPath) { console.error('holdconfirm: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();

  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  // `--root` SERVES A DIFFERENT TREE and changes nothing else — the table
  // imports, the provenance line and this file's own home stay at ROOT. It
  // exists for --selftest, which plants a source defect into a disposable copy
  // and re-runs this whole tool against it: the plant then arrives the way the
  // defect class actually arrives, through the real server, the real boot and
  // the real keys, rather than being handed to a function.
  else { const s = await serve({ root: SERVE_ROOT, port: Number(argOf('--port') || 8288), open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'holdc-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'],
    timeoutMs: 20000,
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
        cdp.close(); await dropBrowser(); stop(); process.exit(2);
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
        cdp.close(); await dropBrowser(); stop(); process.exit(2);
      }
      await touch('touchStart', p); await wait(40); await touch('touchEnd', p);
      await wait(220);
      const after = await ev(STATE);
      ok(`off sends a tap to review and commits NOTHING`, !after.committed && after.reviewing,
        `committed=${after.committed} confirmation=${after.reviewing}`);
      const tapConfirm = await pointOf('.confirmation-confirm');
      if (await press(tapConfirm, 30)) await wait(260);
      const afterTapConfirm = await ev(STATE);
      ok(`the off-mode review can commit the choice`, afterTapConfirm.committed,
        `committed=${afterTapConfirm.committed} confirmation=${afterTapConfirm.reviewing}`);

      // A mobile browser may turn a stationary long press into its native
      // context gesture and suppress the trailing click. `off` still means the
      // review opens; it must not secretly mean "release quickly enough for
      // WebKit/Chromium to synthesize click". Re-open the same authored state
      // because the confirmed review above consumed its binding choice.
      await open('off');
      const heldPoint = await barPoint(0);
      if (!heldPoint) {
        console.error(`\nholdconfirm: '${EVENT}' lost its binding choice before the off-mode long-press check.`);
        cdp.close(); await dropBrowser(); stop(); process.exit(2);
      }
      // Dispatch the pointer stream without a synthetic click. That is the
      // mobile-browser edge: once the native long-press gesture wins, the
      // trailing click is allowed to disappear. The control must own release,
      // not depend on an event the browser may never synthesize.
      await ev(`(() => {
        const b=[...document.querySelectorAll('button.ev-choice')].find(x=>x.dataset.binding==='1');
        const r=b.getBoundingClientRect();
        b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerId:77,pointerType:'touch',isPrimary:true,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
        return true;
      })()`);
      await wait(900);
      await ev(`(() => {
        const b=[...document.querySelectorAll('button.ev-choice')].find(x=>x.dataset.binding==='1');
        const r=b.getBoundingClientRect();
        b.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
        b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:77,pointerType:'touch',isPrimary:true,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
        return true;
      })()`);
      await wait(260);
      const afterLongPress = await ev(STATE);
      ok(`off sends a mobile long press to review and commits NOTHING`,
        !afterLongPress.committed && afterLongPress.reviewing,
        `committed=${afterLongPress.committed} confirmation=${afterLongPress.reviewing}`);
      const longConfirm = await pointOf('.confirmation-confirm');
      if (await press(longConfirm, 30)) await wait(260);
      const afterLongConfirm = await ev(STATE);
      ok(`the long-press review can commit the choice`, afterLongConfirm.committed,
        `committed=${afterLongConfirm.committed} confirmation=${afterLongConfirm.reviewing}`);
      continue;
    }

    ok(`every option bar offers the hold shortcut and every binding bar is included`,
      before.binding > 0 && before.held >= before.binding
        && before.held === before.optionControls && before.hints === before.held,
      `${before.binding} binding, ${before.optionControls} option, ${before.held} armed, ${before.hints} hint(s), ${before.holdMs} ms`);

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

    // ---- 4b. A PRESS THE POINTER WALKS AWAY FROM IS AN ABORT, NOT A TAP.
    //
    // Pointer capture keeps the trailing `click` aimed at the bar even though
    // the finger has left it, so a thumb that pressed a choice bar and then
    // tried to scroll must land NOTHING: no commit (rule 1) and no review
    // modal either — the tap meaning belongs to a short press that stayed put.
    // Found by review on the promotion of dev (#528): the slop cancel stopped
    // the hold but left the press's tap state armed, so the click it generated
    // opened the confirmation modal under a scrolling thumb.
    {
      const b = await pointOf('button.ev-choice.beat-hold');
      if (!b) skip('the moved-away press', 'unasked', 'no held bar to press');
      else {
        const M = (t, x, y, extra = {}) => cdp.send('Input.dispatchMouseEvent', { type: t, x, y, button: t === 'mouseMoved' ? 'none' : 'left', clickCount: 1, ...extra }, sessionId);
        // The painted-fill block above ends in a short press, and a short press
        // on an option control REVIEWS by design — so a modal may be open here.
        // Close it first and assert the clean start, or this case reads the
        // previous case's modal as its own finding.
        if ((await ev(STATE)).reviewing) { await press(await pointOf('.confirmation-cancel'), 30); await wait(300); }
        const before = await ev(STATE);
        ok(`the moved-away press starts from a clean screen (no review open)`, !before.reviewing && before.bars > 0,
          `reviewing=${before.reviewing} bars=${before.bars}`);
        await M('mousePressed', b.x, b.y, { buttons: 1 });
        await wait(120);
        // Well past HOLD_POINTER_SLOP (12 local px), in two steps like a real drag.
        await M('mouseMoved', b.x + 30, b.y + 30, { buttons: 1 });
        await M('mouseMoved', b.x + 60, b.y + 60, { buttons: 1 });
        await wait(120);
        await M('mouseReleased', b.x + 60, b.y + 60, { buttons: 0 });
        await wait(400);
        const after = await ev(STATE);
        ok(`a press the pointer walked away from opens no review and commits nothing`,
          !after.reviewing && !after.committed && after.bars === before.bars && after.holdState !== 'holding',
          `reviewing=${after.reviewing} committed=${after.committed} bars ${before.bars} -> ${after.bars} holdState=${after.holdState}`);
        if (after.reviewing) { await press(await pointOf('.confirmation-cancel'), 30); await wait(250); }
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
      // The merchant folded into bars (E2 / #247), so two of the openers sit
      // behind faces now — a folded control has no painted point, and a press
      // that lands nowhere leaves the census reading "not wired" for "not
      // open", the exact inversion the useFlask note above records. Bar faces
      // first, then the rows they reveal; a selector that matches nothing
      // still presses nothing, so non-shop surfaces are untouched.
      // THE ✕ MOVED BEHIND LOAD (title.js → saveSlotSelector.js): the title
      // menu is five verbs and the slot rows with their delete control open
      // behind LOAD. Observed red without this press at dev = e5d9c981
      // ('11 claimed, 3 absent: … deleteSave') — the census reading a closed
      // selector as "not wired", the useFlask inversion again.
      for (const opener of ['[data-face="bar:remove"]', '#smith-opt', '.smith-candidate-card', '#remove-opt', '.flask-slot', '[data-face="bar:sell"]', '[data-title-action="load"]']) {
        // SCROLLED INTO VIEW FIRST: the shop's bars stack below an open CARDS
        // shelf, so bar:remove sits at y=976 on a 844 phone — measured — and a
        // press at an off-viewport point lands on nothing while reporting
        // nothing. A player scrolls; the census scrolls the same way.
        await ev(`(() => { const b = document.querySelector(${JSON.stringify(opener)}); if (b) b.scrollIntoView({ block: 'center' }); })()`);
        await wait(120);
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
    // line asked for exist now (title / profile / crisis), deleteSave has
    // since collapsed into the machinery (2026-08-14) and is censused like any
    // wired row, and the two still in their own hands are DRIVEN below. What
    // this skip still guards is the FUTURE row: any beat-owing action whose
    // row names no surface lands here by name and takes the exit code with
    // it, exactly as the first three did.
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
      if (!rewired) { console.error('\nholdconfirm --mutate: no End Turn button to rewire. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
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
        const b1Review = await ev(`!!document.querySelector('.confirmation-modal')`);
        ok(`a release before the fill lands does NOT end the turn`,
          b1.turn === a.turn && b1.phase === a.phase && b1Review,
          `turn ${a.turn} -> ${b1.turn}, phase ${a.phase} -> ${b1.phase}, confirmation=${b1Review}`);
        // A short press now has a positive meaning: REVIEW. Close that veil
        // before testing the direct-hold shortcut, or the veil correctly owns
        // the second press and this harness reports a false lockout.
        await press(await pointOf('.confirmation-cancel'), 30); await wait(250);
        // 2. A COMPLETED HOLD ENDS IT.
        await press(await pointOf('.end-turn'), a.holdMs + 350);
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
      // removes its timer, visible hint and direct-commit shortcut. Review is
      // universal and the modal's explicit answer remains the commit door.
      await openShot('combat', { shotSettings: JSON.stringify({ holdConfirm: 'off' }) });
      const off = await st();
      ok(`Off removes End Turn's hold timer and hint`, off && off.holdMs === 0 && off.hint === false,
        off ? `beat=${off.beat} ms=${off.holdMs} hint=${off.hint}` : 'no combat state');
      await ev(`document.querySelector('.end-turn')?.scrollIntoView({ block: 'center' })`); await wait(120);
      const op = await pointOf('.end-turn');
      if (!off || !op) ok(`Off leaves End Turn pressable`, false, 'no button box');
      else {
        // Dispatch on the control itself here. The normal-dial cells above
        // already prove viewport hit testing; this cell owns the zero-duration
        // pointer lifecycle, which must not depend on a trailing browser click.
        await ev(`(() => { const b = document.querySelector('.end-turn'); const r = b.getBoundingClientRect();
          b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 91, pointerType: 'touch', isPrimary: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
          b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 91, pointerType: 'touch', isPrimary: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); return true; })()`);
        await wait(300);
        const off2 = await st();
        const offReview = await ev(`!!document.querySelector('.confirmation-modal')`);
        ok(`Off sends one pointer press to review and does not end the turn`,
          off2 && off2.turn === off.turn && off2.phase === off.phase && offReview,
          `turn ${off.turn} -> ${off2 && off2.turn}, phase ${off.phase} -> ${off2 && off2.phase}, confirmation=${offReview}`);
        await press(await pointOf('.confirmation-confirm'), 30); await wait(900);
        const off3 = await st();
        ok(`the off-mode confirmation ends the turn`, off3 && (off3.turn > off.turn || off3.phase !== 'player'),
          `turn ${off.turn} -> ${off3 && off3.turn}, phase ${off.phase} -> ${off3 && off3.phase}`);
      }

      // 5. THE KEY THAT CANNOT BE THE CURSOR'S. `.end-turn` matches input.js's
      // CHROME selector, so the focus cursor SKIPS IT BY DESIGN and neither
      // Enter nor pad-Confirm can ever arrive on this button. Its keyboard door
      // is the rebindable `endTurn` key and its pad door is that row's button —
      // and until 2026-08-17 both walked past the hold as a synthetic click.
      // Measured at b83bda1: one `e` took turn 1 -> 2 against a 600 ms dial.
      // Driven in the EVERY INPUT section below, on both non-pointer doors.
    }
  }

// ---- THE HOLD IS THE SAME ON EVERY INPUT (S7 wide) --------------------------
//
// Constantine, 2026-08-17: "if hold is toggled, then it should be the same, in
// all instances. for ending turn, using flask, event choice, shrine rest."
//
// FOUR ACTIONS x TWO NON-POINTER INPUTS x TWO DIAL POSITIONS, and every cell
// asks the SAME PAIR — does a short press abort, does a long press commit —
// because either half alone is a green that proves the wrong thing: a key that
// has simply STOPPED WORKING passes "the tap does not commit" forever.
//
// The pointer half is not repeated here; it is driven per surface above, and a
// second copy of it would be a second answer to one question.
//
// WHAT WAS RED HERE BEFORE THIS SECTION EXISTED — measured at b83bda1, 390x844,
// dial `normal`, all EIGHT of them, with every pointer cell aborting correctly
// in the same run:
//   endTurn      key tap  turn 1 -> 2          pad tap  turn 1 -> 2
//   eventChoice  key tap  3 bars -> 1          pad tap  3 bars -> 1
//   useFlask     key tap  hpCurrent 2 -> 1     pad tap  hpCurrent 2 -> 1
//   shrineRest   key tap  the shrine is gone   pad tap  the shrine is gone
//
// THE PAD IS A SHIM ON `navigator.getGamepads`, NAMED RATHER THAN HIDDEN. No
// CDP domain synthesises a controller. The claim this cell licenses is "CODE
// READING getGamepads ARMS THE HOLD" — input.js's poller reads that one
// function, unmodified, at its own 16 ms cadence — and NOT "a controller does".
// A real pad on a real desk is unmeasured here and stays `unknown`.
  {
    console.log(`\n  EVERY INPUT — the dial is one switch and it governs all three`);
    const PAD_SHIM = `(() => {
      const pad = { index: 0, id: 'holdconfirm shim (STANDARD GAMEPAD)', mapping: 'standard',
        connected: true, timestamp: 0, axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      navigator.getGamepads = () => [pad, null, null, null];
      window.__pad = {
        down(i) { pad.buttons[i] = { pressed: true, touched: true, value: 1 }; pad.timestamp = performance.now(); },
        up(i) { pad.buttons[i] = { pressed: false, touched: false, value: 0 }; pad.timestamp = performance.now(); },
        connect() { window.dispatchEvent(new Event('gamepadconnected')); },
      };
    })()`;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAD_SHIM }, sessionId);

    const keyEv = (type, key, autoRepeat = false) => cdp.send('Input.dispatchKeyEvent',
      { type, key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key, autoRepeat,
        text: type === 'keyDown' && key.length === 1 ? key : undefined }, sessionId);
    // A REAL held key is the first keydown plus an OS repeat stream at ~30 Hz.
    // Omit them and the path where a repeat re-enters the press — or fires the
    // control once per repeat — never runs, which is a key nobody holds.
    const holdKey = async (k, ms) => {
      await keyEv('keyDown', k);
      const until = Date.now() + ms;
      while (Date.now() < until) { await wait(33); await keyEv('keyDown', k, true); }
      await keyEv('keyUp', k);
      await wait(500);
    };
    const holdPad = async (b, ms) => {
      await ev(`(() => { window.__pad.connect(); return 1; })()`); await wait(160);
      await ev(`(() => { window.__pad.down(${b}); return 1; })()`);
      await wait(ms);
      await ev(`(() => { window.__pad.up(${b}); return 1; })()`);
      await wait(500);
    };
    // The focus cursor is PLACED, not walked. Whether the cursor can REACH a
    // control is tools/inspecthold.mjs's subject; what this section asks is what
    // the PRESS does once it is standing there, and a failed walk would report
    // here as a hold that does not hold.
    const focusOn = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return 0; document.querySelectorAll('.gp-focus').forEach((x) => x.classList.remove('gp-focus'));
      e.classList.add('gp-focus'); return 1; })()`);

    // The four rows he named. `sel` is the armed control the cursor stands on;
    // NULL means the control is not cursor-reachable at all and the action's own
    // key/button is its only non-pointer door — which is End Turn, and is the
    // whole reason this section exists.
    const INPUT_ROWS = [
      { id: 'endTurn', of: 'end the turn', sel: null, key: 'e', btn: 2,
        open: (d) => openShot('combat', { shotSettings: JSON.stringify({ holdConfirm: d }) }),
        read: () => ev(`(window.__combat || {}).turn`), moved: (a, b) => b > a },
      { id: 'eventChoice', of: 'take the choice', sel: 'button.ev-choice[data-binding="1"]', key: 'Enter', btn: 0,
        open: (d) => open(d, { id: EVENT }),
        read: () => ev(`document.querySelectorAll('#choices button').length`), moved: (a, b) => b < a },
      { id: 'shrineRest', of: 'spend the shrine', sel: '#rest-opt', key: 'Enter', btn: 0,
        open: (d) => openShot('rest', { shotSettings: JSON.stringify({ holdConfirm: d }) }),
        read: () => ev(`document.querySelectorAll('#rest-opt').length`), moved: (a, b) => b < a },
      { id: 'useFlask', of: 'drink the flask', sel: '[data-beat-action="useFlask"]', key: 'Enter', btn: 0,
        open: async (d) => { await openShot('combat', { shotSettings: JSON.stringify({ holdConfirm: d }) });
          await press(await pointOf('.flask-slot'), 60); await wait(400); },
        read: () => ev(`(((window.__combat || {}).player || {}).flaskCharges || {}).hpCurrent`),
        moved: (a, b) => a != null && b != null && b < a },
    ];

    for (const row of INPUT_ROWS) {
      const armSel = row.sel || `[data-beat-action="${row.id}"]`;
      for (const dial of ['normal', 'off']) {
        await row.open(dial);
        const ms = Number(await ev(`Number((document.querySelector(${JSON.stringify(armSel)}) || { dataset: {} }).dataset.holdMs || 0)`)) || 0;
        if (dial === 'normal' && !(ms > 0)) {
          skip(`${row.id} on every input`, 'unasked', `no armed control with a live dial at this ref (holdMs=${ms})`);
          continue;
        }
        const drive = { key: (t) => holdKey(row.key, t), pad: (t) => holdPad(row.btn, t) };
        for (const input of ['key', 'pad']) {
          // SHORT — under the dial. Review is universal: both enabled and off
          // open the modal and commit nothing. The dial governs only whether a
          // completed hold may take the direct-commit shortcut.
          await row.open(dial);
          if (row.sel) await focusOn(row.sel);
          const a0 = await row.read();
          await drive[input](dial === 'off' ? 60 : Math.round((ms || 600) * 0.35));
          await wait(600);
          const a1 = await row.read();
          const shortReview = await ev(`!!document.querySelector('.confirmation-modal')`);
          ok(`${row.id}: ${dial === 'off' ? 'OFF' : 'ON'}, a short ${input} press does NOT ${row.of} and opens review`,
            !row.moved(a0, a1) && shortReview, `${a0} -> ${a1}, confirmation=${shortReview}`);
          await press(await pointOf('.confirmation-cancel'), 30); await wait(250);
          // LONG — past the dial. Without this half, a key that had simply
          // stopped working would pass the tap cell forever. Enabled commits
          // directly; off still opens review and waits for its explicit answer.
          await row.open(dial);
          if (row.sel) await focusOn(row.sel);
          const b0 = await row.read();
          await drive[input]((ms || 600) + 400);
          await wait(700);
          const b1 = await row.read();
          const longReview = await ev(`!!document.querySelector('.confirmation-modal')`);
          if (dial === 'off') {
            ok(`${row.id}: OFF, a held ${input} press does NOT ${row.of} and opens review`,
              !row.moved(b0, b1) && longReview, `${b0} -> ${b1}, confirmation=${longReview}`);
            await press(await pointOf('.confirmation-confirm'), 30); await wait(700);
            const b2 = await row.read();
            ok(`${row.id}: OFF, the ${input}-opened confirmation DOES ${row.of}`,
              row.moved(b0, b2), `${b0} -> ${b2}`);
          } else {
            ok(`${row.id}: ON, a held ${input} press DOES ${row.of}`,
              row.moved(b0, b1) && !longReview, `${b0} -> ${b1}, confirmation=${longReview}`);
          }
        }
      }
    }

    // THE VEIL EDGE, and it is the one this widening could have broken with
    // nothing above noticing. input.js now CLAIMS the End Turn key when the
    // button has a live beat — and combat's own handler, which refuses every
    // screen hotkey while ANY veil stands, is exactly what that claim skips
    // past. So the claim is scoped to the ACTIVE FOCUS SCOPE, the same
    // `topVeil()` answer veil-owns-input.mjs measures. Held here too: a rule
    // enforced only in another tool is a rule this one can silently lose.
    await openShot('combat');
    const opened = await ev(`(() => { const p = document.querySelector('.pile'); if (!p) return 0; p.click(); return 1; })()`);
    await wait(500);
    const standing = await ev(`document.querySelectorAll('.modal-veil').length`);
    if (!opened || !standing) skip('the veil edge on the End Turn key', 'unasked', 'no .pile veil would stand at ?shot=combat');
    else {
      const v0 = await ev(`(window.__combat || {}).turn`);
      await holdKey('e', 1000);
      await wait(700);
      const v1 = await ev(`(window.__combat || {}).turn`);
      ok(`with a veil standing, HOLDING the End Turn key does nothing`, v1 === v0, `turn ${v0} -> ${v1}, veils ${standing}`);
    }
  }

  // ---- THE SHRINE: one screen, two forms -----------------------------------
  {
    console.log(`\n  THE SHRINE — Rest holds; Smith Upgrade reviews, including when blocked`);
    await openShot('rest', { shotSmithingStones: 0 });
    if (mutate) {
      const rewired = await ev(`(() => {
        const b = document.querySelector('#rest-opt'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { c.remove(); });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no #rest-opt to rewire. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
      console.log(`    (mutation rewired Rest to commit on a pointer click)`);
    }
    const onShrine = () => ev(`!!document.querySelector('#rest-opt')`);
    const restBeat = await ev(`(() => { const e = document.querySelector('#rest-opt'); return e ? { beat: e.dataset.beat, ms: Number(e.dataset.holdMs || 0) } : null; })()`);
    if (!restBeat) skip('shrine', 'unasked', 'no ?shot=rest screen at this ref');
    else {
      ok(`Rest owes a HOLD`, restBeat.beat === 'hold' && restBeat.ms > 0, `beat=${restBeat.beat} ms=${restBeat.ms}`);
      const rp = await pointOf('#rest-opt');
      await press(rp, Math.round(restBeat.ms * 0.4));
      const restReview = await ev(`!!document.querySelector('.confirmation-modal')`);
      ok(`a release before the fill lands does NOT spend the shrine and opens review`,
        await onShrine() && restReview, `still on the shrine=${await onShrine()} confirmation=${restReview}`);
      await press(await pointOf('.confirmation-cancel'), 30); await wait(250);

      // The Smith's unaffordable edge is deliberately native-clickable. It
      // must explain the block through the same review modal, publish the ARIA
      // state, and never acquire a direct hold-commit path.
      await press(await pointOf('#smith-opt'), 30); await wait(300);
      await ev(`document.querySelector('.smith-candidate-card')?.scrollIntoView({ block: 'center' })`); await wait(120);
      const cardP = await pointOf('.smith-candidate-card');
      if (!cardP) ok(`the Smith modal offers an armament candidate`, false, 'no .smith-candidate-card — nothing to review');
      else {
        await press(cardP, 30); await wait(300);
        if (mutate) {
          await ev(`(() => { const el = document.querySelector('.smith-confirm'); if (!el) return 0;
            const c = el.cloneNode(true); el.parentNode.replaceChild(c, el);
            c.addEventListener('click', () => document.querySelector('.smith-upgrade-modal')?.remove()); return 1; })()`);
          console.log(`    (mutation rewired Smith Upgrade to leave review on one pointer click)`);
        }
        const blocked = await ev(`(() => { const b = document.querySelector('.smith-confirm'); return b ? {
          nativeDisabled: b.disabled, aria: b.getAttribute('aria-disabled'), state: b.dataset.smithActionState,
          option: b.dataset.optionDecision, tap: b.dataset.optionTap, hold: b.dataset.optionHold,
          holdMs: Number(b.dataset.holdMs || 0), hint: !!b.querySelector('.hold-hint'), label: b.textContent.trim()
        } : null; })()`);
        ok(`blocked Smith Upgrade stays native-clickable and publishes its ARIA block`,
          blocked && !blocked.nativeDisabled && blocked.aria === 'true' && blocked.state === 'blocked',
          JSON.stringify(blocked));
        ok(`blocked Smith Upgrade offers review but no hold-commit shortcut`,
          blocked && blocked.option === 'smithUpgrade' && blocked.tap === 'modal'
            && blocked.hold === 'blocked' && blocked.holdMs === 0 && !blocked.hint && /^Upgrade \(1\)$/.test(blocked.label),
          JSON.stringify(blocked));

        // Native clickability is the contract on the blocked button: ARIA
        // communicates the block, while an actual disabled attribute would
        // suppress this explanatory review entirely.
        await ev(`document.querySelector('.smith-confirm')?.click()`); await wait(300);
        const blockedReview = await ev(`(() => { const p = document.querySelector('.confirmation-modal');
          const y = p && p.querySelector('.confirmation-confirm'); return {
            panel: !!p, title: (p && p.querySelector('h2')?.textContent) || '', detail: (p && p.querySelector('.confirmation-details')?.innerHTML) || '',
            confirmVisible: !!(y && !y.hidden), smithOpen: !!document.querySelector('.smith-upgrade-modal') }; })()`);
        ok(`one tap on blocked Smith Upgrade opens review; it does not smith`,
          blockedReview.panel && blockedReview.smithOpen && !blockedReview.confirmVisible,
          `panel=${blockedReview.panel} smith=${blockedReview.smithOpen} confirm-visible=${blockedReview.confirmVisible}`);
        ok(`the blocked review explains the exact upgrade and cost`,
          /^Cannot upgrade /.test(blockedReview.title) && blockedReview.detail.length > 0,
          `${JSON.stringify(blockedReview.title)} detail=${blockedReview.detail.length} chars`);
        await press(await pointOf('.confirmation-cancel'), 30); await wait(250);

        await ev(`(() => { const b = document.querySelector('.smith-confirm'); if (!b) return false; const r = b.getBoundingClientRect();
          b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 92, pointerType: 'touch', isPrimary: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); return true; })()`);
        await wait(1000);
        await ev(`(() => { const b = document.querySelector('.smith-confirm'); if (!b) return false; const r = b.getBoundingClientRect();
          b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 92, pointerType: 'touch', isPrimary: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); return true; })()`);
        await wait(300);
        const blockedAfterHold = await ev(`(() => { const p = document.querySelector('.confirmation-modal'); return {
          panel: !!p, confirmVisible: !!(p && p.querySelector('.confirmation-confirm') && !p.querySelector('.confirmation-confirm').hidden),
          smithOpen: !!document.querySelector('.smith-upgrade-modal'), shrine: !!document.querySelector('#rest-opt') }; })()`);
        ok(`blocked Smith Upgrade cannot hold-commit`,
          blockedAfterHold.panel && !blockedAfterHold.confirmVisible && blockedAfterHold.smithOpen && blockedAfterHold.shrine,
          JSON.stringify(blockedAfterHold));
        await press(await pointOf('.confirmation-cancel'), 30); await wait(250);
      }

      // Affordable is the other half: one tap reviews, a deliberate hold may
      // commit directly, and the shared modal owns the preview and target laws.
      await openShot('rest', { shotSmithingStones: 1 });
      await press(await pointOf('#smith-opt'), 30); await wait(300);
      await ev(`document.querySelector('.smith-candidate-card')?.scrollIntoView({ block: 'center' })`); await wait(120);
      await press(await pointOf('.smith-candidate-card'), 30); await wait(300);
      const ready = await ev(`(() => { const b = document.querySelector('.smith-confirm'); return b ? {
        nativeDisabled: b.disabled, aria: b.getAttribute('aria-disabled'), state: b.dataset.smithActionState,
        hold: b.dataset.optionHold, holdMs: Number(b.dataset.holdMs || 0), hint: !!b.querySelector('.hold-hint')
      } : null; })()`);
      ok(`affordable Smith Upgrade publishes the live hold shortcut`,
        ready && !ready.nativeDisabled && ready.aria === 'false' && ready.state === 'actionable'
          && ready.hold === 'commit' && ready.holdMs > 0 && ready.hint,
        JSON.stringify(ready));
      await press(await pointOf('.smith-confirm'), Math.round((ready && ready.holdMs || 600) * 0.35)); await wait(300);
      const affordableReview = await ev(`(() => { const p = document.querySelector('.confirmation-modal'); return {
        panel: !!p, detail: (p && p.querySelector('.confirmation-details')?.innerHTML) || '',
        yes: !!(p && p.querySelector('.confirmation-confirm') && !p.querySelector('.confirmation-confirm').hidden),
        no: !!(p && p.querySelector('.confirmation-cancel')), smithOpen: !!document.querySelector('.smith-upgrade-modal') }; })()`);
      ok(`one tap on affordable Smith Upgrade opens review; it does not smith`,
        affordableReview.panel && affordableReview.smithOpen, JSON.stringify(affordableReview));
      ok(`the shared review carries the upgrade preview and both answers`,
        affordableReview.detail.length > 0 && affordableReview.yes && affordableReview.no,
        `detail=${affordableReview.detail.length} CONFIRM=${affordableReview.yes} CANCEL=${affordableReview.no}`);

      const box = await ev(`(() => {
        const p = document.querySelector('.confirmation-modal'); if (!p) return null;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;height:var(--tap-floor);width:var(--tap-floor)';
        document.body.appendChild(probe); const floor = +probe.getBoundingClientRect().height.toFixed(1); probe.remove();
        const btns = [...p.querySelectorAll('footer button:not([hidden])')].map((b) => { const r = b.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; });
        const r = p.getBoundingClientRect(); return { floor, btns, right: +r.right.toFixed(1), docW: document.documentElement.clientWidth };
      })()`);
      ok(`both answers meet the tap floor (Law 4)`, box && box.floor > 0 && box.btns.length === 2
        && box.btns.every((b) => b.h >= box.floor - 0.5 && b.w >= box.floor - 0.5), JSON.stringify(box));
      ok(`the panel adds no sideways travel (Law 5)`, box && box.right <= box.docW + 0.5,
        box ? `panel right edge ${box.right} of ${box.docW} px` : 'no panel');
      await press(await pointOf('.confirmation-cancel'), 30); await wait(250);
      const afterCancel = {
        confirmation: await ev(`!!document.querySelector('.confirmation-modal')`),
        smith: !!(await pointOf('.smith-confirm')),
      };
      ok(`CANCEL takes it back and nothing was smithed`,
        !afterCancel.confirmation && afterCancel.smith,
        `confirmation=${afterCancel.confirmation} smith=${afterCancel.smith}`);
      await press(await pointOf('.smith-confirm'), (ready && ready.holdMs || 600) + 350); await wait(700);
      ok(`a deliberate Smith hold commits and leaves the shrine`, !(await onShrine()), `still on the shrine=${await onShrine()}`);
    }
  }

  // ---- THE PANEL MUST BE ON SCREEN — TWO SHAPES, MEASURED ------------------
  //
  // ⚠ THE DEFECT THIS SECTION EXISTS FOR SHIPPED, AND EVERY GREEN IN THIS FILE
  // WAS HONEST WHILE IT DID. At db09846, arming a Smith candidate put both
  // answers below the fold:
  //
  //     390x844   .beat-yes / .beat-no  top 1000.22 .. 1044.22   0% on screen
  //     360x640   .beat-yes / .beat-no  top  938.66 ..  982.66   0% on screen
  //
  // The panel armed, carried its preview, met both tap floors and added no
  // sideways travel — every assertion above this line PASSED — and the player
  // could not see the question. Two cells further up went red only by accident:
  // `pointOf` hands back a centre at y=1022 and a CDP touch there lands on
  // nothing, so `CANCEL takes it back` failed with `panel=true`, which reads as
  // a wiring fault and was a POSITION fault. A tool that finds the right defect
  // for the wrong reason has not measured it.
  //
  // WHY IT IS NOT IN tools/uprightgate.mjs, WHICH OWNS THIS SURFACE. Its clause
  // R gates `unreachable` — nothing on screen and no gesture to it — and this
  // was `scrollable`: `.screen` is `overflow-y: auto` with real travel, so the
  // player COULD reach it by scrolling 156 px that nothing advertised. That gate
  // was GREEN on the defect (24/24 shapes) and is GREEN on the fix, and its
  // `(cut)` lines report the rect either way. **THE INSTRUMENT THAT OWNS THE
  // SURFACE COULD NOT SEE THE DEFECT, AND SAYING SO IS THE FINDING** — it is
  // Vira's file and her clause to widen, not mine to reach into.
  //
  // BOTH SHAPES, AND THE SECOND ONE IS NOT DECORATION. 360x640 is 204 px shorter
  // and puts the panel 299 px down rather than 156; a fix that scrolls the panel
  // but not its buttons would pass at one and fail at the other.
  //
  // WATCHED RED: `--selftest` plant Q7 deletes the `reveal(panel, row)` call
  // from src/ui/components/holdconfirm.js. Both cells go red, in both shapes,
  // with the pre-fix numbers.
  {
    console.log(`\n  THE CONFIRM PANEL IS ON SCREEN WHERE IT OPENS (the 156 px nobody advertised)`);
    for (const shape of [{ w: 390, h: 844 }, { w: 360, h: 640 }]) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: shape.w, height: shape.h, deviceScaleFactor: 2, mobile: true }, sessionId);
      await openShot('rest', { shotSmithingStones: 1 });
      // ⚠ THE DRIVE HAS TO ANSWER FOR ITSELF BEFORE THE PANEL DOES, AND THE FIRST
      // RUN OF THIS SECTION TAUGHT ME WHY. At 360x640 both cells went red with
      // `.beat-armed present=false` — no panel at all — and read exactly like the
      // fix having failed at the second shape. It is not: A CDP TOUCH AT A CENTRE
      // OUTSIDE THE VIEWPORT LANDS ON NOTHING, so if the control I have to tap to
      // GET here is itself below the fold, my finger misses and the panel never
      // opens. That is a real defect and it is a DIFFERENT one, on a different
      // control, and reporting it as this fix's failure would have been the tool
      // blaming my change for someone else's rect.
      //
      // So each step in the drive is measured before it is pressed, and a step
      // whose target is off screen is an `unknown` WITH ITS NUMBERS — never a red
      // about the panel and never a silent skip.
      // THE CENTRE, NOT THE WHOLE BOX, AND THAT DISTINCTION IS THE WHOLE OF THIS
      // HELPER. `pointOf` taps the centre, so the centre is the only point whose
      // reachability decides whether the press lands. My first cut of this asked
      // for full containment and skipped 390x844 — where the Smith candidate runs
      // 740.73..903.01 past an 844 px fold with its centre at 821.87, comfortably
      // on screen and comfortably tappable. A gate stricter than the thing it
      // guards manufactures unknowns, which is the same lie as a green.
      const reach = async (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
        if (!e) return { present: false };
        const r = e.getBoundingClientRect();
        const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
        return { present: true, top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2),
                 cy: +cy.toFixed(2), vh: innerHeight, vw: innerWidth,
                 onscreen: r.height > 0 && r.width > 0 && cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth };
      })()`);
      const step = async (sel, what) => {
        const r = await reach(sel);
        if (!r.present) { skip('panel-onscreen', 'unasked', `${what} (${sel}) is not in the DOM at ${shape.w}x${shape.h}`); return null; }
        if (!r.onscreen) {
          skip('panel-onscreen', 'undrivable',
            `${what} (${sel}) cannot be TAPPED at ${shape.w}x${shape.h} — rect top ${r.top}..${r.bottom}, centre y ${r.cy}, `
            + `in a ${r.vh} px viewport, so a touch at its centre lands on nothing and the panel cannot be reached to be `
            + `measured HERE. A SEPARATE DEFECT ON A SEPARATE CONTROL and not this fix's: reported as unknown rather than `
            + `as a red about the panel. (tools/uprightgate.mjs reaches the same panel at this shape by CLICKING rather `
            + `than touching, and reads the panel's rect there — so the shape is not unmeasured, it is unmeasured by THIS door.)`);
          return null;
        }
        return pointOf(sel);
      };
      const sp = await step('#smith-opt', 'the Smith opener');
      if (!sp) continue;
      await press(sp, 30); await wait(250);
      await ev(`document.querySelector('.smith-candidate-card')?.scrollIntoView({ block: 'center' })`); await wait(120);
      const cp = await step('.smith-candidate-card', 'the first Smith candidate');
      if (!cp) continue;
      await press(cp, 30); await wait(300);
      await ev(`document.querySelector('.smith-confirm')?.scrollIntoView({ block: 'center' })`); await wait(120);
      const up = await step('.smith-confirm', 'the Smith Upgrade action');
      if (!up) continue;
      const upMs = Number(await ev(`Number(document.querySelector('.smith-confirm')?.dataset.holdMs || 0)`)) || 600;
      await press(up, Math.round(upMs * 0.35)); await wait(300);
      // ONE READ, THE WHOLE PANEL AND BOTH ANSWERS, off the frame the app left.
      // NOTHING HERE SCROLLS ANYTHING: if the rect is on screen it is because
      // the APP put it there. A probe that positions its own target has already
      // left the door (Bjorn's rule, borrowed from uprightgate.mjs).
      const seen = await ev(`(() => {
        const vh = innerHeight, vw = innerWidth;
        const box = (sel) => { const e = document.querySelector(sel); if (!e) return { present: false };
          const r = e.getBoundingClientRect();
          const overlap = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
                        * Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
          return { present: true, top: +r.top.toFixed(2), bottom: +r.bottom.toFixed(2),
                   whole: r.top >= -0.5 && r.bottom <= vh + 0.5 && r.left >= -0.5 && r.right <= vw + 0.5,
                   pct: r.width * r.height > 0 ? +(100 * overlap / (r.width * r.height)).toFixed(2) : 0 }; };
        return { vh, panel: box('.confirmation-modal'), yes: box('.confirmation-confirm'), no: box('.confirmation-cancel'),
                 armed: !!document.querySelector('.smith-confirm'),
                 armedWhole: (() => { const e = document.querySelector('.smith-confirm'); if (!e) return false;
                   const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < vh; })() };
      })()`);
      const at = `${shape.w}x${shape.h}`;
      // BOTH ANSWERS, NOT THE PANEL. A panel taller than the viewport cannot be
      // wholly on screen and does not have to be; the ANSWERS must, because a
      // question with one reachable button is a trap and CANCEL going with
      // CONFIRM is what makes this a wall rather than a nuisance.
      ok(`the confirm panel's ANSWERS open on screen at ${at}`,
        seen.yes.present && seen.no.present && seen.yes.pct >= 99.9 && seen.no.pct >= 99.9,
        `viewport height ${seen.vh} · CONFIRM top ${seen.yes.top}..${seen.yes.bottom} ${seen.yes.pct}% on screen`
        + ` · CANCEL top ${seen.no.top}..${seen.no.bottom} ${seen.no.pct}% on screen`);
      // AND THE CARD THE QUESTION IS ABOUT. `block: 'nearest'` was chosen over
      // centring for exactly this: a player who cannot see which candidate is
      // armed is being asked to confirm an unnamed thing.
      ok(`and the armed card it is asking about is still visible at ${at}`,
        seen.armed && seen.armedWhole,
        `.smith-confirm present=${seen.armed} at least partly on screen=${seen.armedWhole}`);
    }
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: SHAPE.w, height: SHAPE.h, deviceScaleFactor: 2, mobile: true }, sessionId);
  }

  // ---- THE MERCHANT: the one nobody asked for ------------------------------
  {
    console.log(`\n  THE MERCHANT — burning a card out of the deck for good`);
    await openShot('shop');
    // The REMOVE bar first (E2 / #247): the brazier sits behind a fold now,
    // and a folded control has no point to press.
    await ev(`(() => { const b = document.querySelector('[data-face="bar:remove"]'); if (b) b.scrollIntoView({ block: 'center' }); })()`);
    await wait(120);
    const bar = await pointOf('[data-face="bar:remove"]');
    if (bar) { await press(bar, 30); await wait(250); }
    await ev(`(() => { const b = document.querySelector('#remove-opt'); if (b) b.scrollIntoView({ block: 'center' }); })()`);
    await wait(120);
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
        const armed = await ev(`(() => { const p = document.querySelector('.confirmation-modal'); return { panel: !!p,
          q: p ? [p.querySelector('h2')?.textContent || '', p.querySelector('.confirmation-copy')?.textContent || ''].join(' ') : '',
          cards: document.querySelectorAll('#remove-grid .card').length }; })()`);
        ok(`one tap ARMS the burn, it does not burn`, armed.panel && armed.cards === before.cards,
          `panel=${armed.panel} deck ${before.cards} -> ${armed.cards}`);
        ok(`and the question names the card and the price`, /cinders/.test(armed.q), JSON.stringify(armed.q.slice(0, 70)));
      }
    }
  }

  // ==========================================================================
  // THE BEATS IN THEIR OWN SCREENS' HANDS — the census's `handledBy` rows
  // (shrineLevelUp, profileRestore, freshProfile), watched instead of believed
  // — plus the title's ✕, which LEFT this club on 2026-08-14: its row rides
  // the shared machinery now, so its section drives the machinery's own hold
  // and reads `data-beat-action` like combat's. The three `handledBy` rows are
  // driven in their own idiom, on states posed by the real doors (see
  // main.js); no `data-beat-action` is expected on those three.

  // ---- THE SHRINE: levelling — in the stat card's own hand ----------------
  // `shrineLevelUp` is a `handledBy` row (secondbeat.js): the shared stat
  // allocation card pends the point on `+` — the row reads +1, the result line
  // says what the point does, Clear takes it back — and "Level up" is the beat
  // that spends it. Driven here in the card's own idiom, on the posed shrine
  // (cinders enough to offer the level), the same way the two profile rows
  // are driven below: a handledBy row nobody watches is the gap the field was
  // invented to name.
  {
    console.log(`\n  THE SHRINE — a point pends on +, and only "Level up" spends it`);
    await openShot('rest');
    const opened = await ev(`(() => { const d = document.querySelector('#level-opt'); if (!d) return 0; d.open = true; return 1; })()`);
    await wait(150);
    if (mutate && opened) {
      // THE OLD DOOR: `+` spends the point on ONE click — the pend is gone,
      // the card commits on the first press. The button keeps its glyph and
      // its class; the original's own listener still pends, and the rewire
      // presses "Level up" behind it in the same tick.
      const rewired = await ev(`(() => {
        const b = document.querySelector('#level-opt .se-step[data-stat-action="increase"]'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { b.click(); const d = document.querySelector('#level-opt [data-stat-done]'); if (d) d.click(); });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no + to rewire at ?shot=rest. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
      console.log(`    (mutation rewired the first + to spend the point on ONE click)`);
    }
    const lState = () => ev(`(() => {
      const rows = [...document.querySelectorAll('#level-opt .se-row')];
      const done = document.querySelector('#level-opt [data-stat-done]');
      const result = document.querySelector('#level-opt [data-level-cinder-result]');
      return {
        rows: rows.length,
        values: rows.map((r) => Number(((r.querySelector('.se-value') || {}).textContent || '').trim())),
        doneDisabled: done ? done.getAttribute('aria-disabled') === 'true' : null,
        resultShown: result ? !result.hidden : null,
      };
    })()`);
    const l0 = await lState();
    if (!opened || !l0.rows) skip('shrine level-up', 'unasked', 'no Level up panel with attribute rows at ?shot=rest at this ref');
    else {
      ok(`the panel mounts with nothing pending — "Level up" disarmed, the result line hidden`,
        l0.doneDisabled === true && l0.resultShown === false,
        `${l0.rows} row(s), done disabled=${l0.doneDisabled}, result shown=${l0.resultShown}`);
      const plus = '#level-opt .se-row .se-step[data-stat-action="increase"]';
      await press(await pointOf(plus), 30); await wait(200);
      const l1 = await lState();
      ok(`+ PENDS the point and spends NOTHING — the row reads +1, "Level up" arms, the result line names what the point does`,
        l1.values[0] === l0.values[0] + 1 && l1.doneDisabled === false && l1.resultShown === true,
        `row 0 ${l0.values[0]} -> ${l1.values[0]}, done disabled=${l1.doneDisabled}, result shown=${l1.resultShown}`);
      await press(await pointOf('#level-opt [data-stat-cancel]'), 30); await wait(200);
      const l2 = await lState();
      ok(`Clear takes it back — the row reads what it read, "Level up" disarms`,
        l2.values[0] === l0.values[0] && l2.doneDisabled === true,
        `row 0 ${l1.values[0]} -> ${l2.values[0]}, done disabled=${l2.doneDisabled}`);
      await press(await pointOf(plus), 30); await wait(200);
      await press(await pointOf('#level-opt [data-stat-done]'), 30); await wait(400);
      const l3 = await lState();
      ok(`"Level up" spends the point — the row keeps its +1 and the re-mounted panel has nothing pending`,
        mutate ? true : (l3.rows > 0 && l3.values[0] === l0.values[0] + 1 && l3.doneDisabled === true),
        `row 0 ${l0.values[0]} -> ${l3.values[0]}, done disabled=${l3.doneDisabled} — read off the re-mounted panel`);
    }
  }

  // ---- THE TITLE: deleting a run — collapsed into the shared machinery ------
  // The game's oldest second beat spent its life as a third form: a two-click,
  // self-resetting arm with its own hard-coded 2500 ms, wired in title.js's own
  // hand and DEAF TO THE DIAL — `balance.ui.holdConfirm` never reached it, so
  // `off` still demanded two clicks and `long` never lengthened anything. The
  // exemption's honest content was "nothing could watch a rewrite run"; the
  // `?shot=title` state ended that, and the row is machinery now. The table
  // rules `hold` (stakes profile, undo none, hazard pointing — the ✕ shares
  // its row with the slot's own pick control), so the ✕ answers exactly like
  // End Turn: fill under the finger, release-early aborts, the dial is the one
  // home of the duration.
  //
  // THE ✕ LIVES BEHIND LOAD NOW (title.js → saveSlotSelector.js): the title
  // menu is five verbs, and the slot rows with their delete control are the
  // LOAD selector's. This section walks that door — press LOAD, read the rows
  // — and walks it again after every commit, because a commit closes the
  // selector and re-renders the title. Before this it asked for `.slot-delete`
  // on the first paint, found nothing, and SKIPPED: a beat the game ships,
  // unwatched, filed under "unasked".
  {
    console.log(`\n  THE TITLE — the ✕ holds like everything else, and the dial finally reaches it`);
    const openLoad = async () => {
      const lp = await pointOf('[data-title-action="load"]');
      if (!lp) return false;
      await press(lp, 30); await wait(300);
      return !!(await ev(`!!document.querySelector('.title-slot-list')`));
    };
    await openShot('title');
    await openLoad();
    if (mutate) {
      // THE OLD DOOR: one pointer click deletes, no beat. The button keeps its
      // class and its glyph — only the wiring changes.
      const rewired = await ev(`(() => {
        const b = document.querySelector('.title-slot-delete'); if (!b) return 0;
        const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
        c.addEventListener('click', () => { c.closest('.title-slot-row').remove(); });
        return 1;
      })()`);
      if (!rewired) { console.error('\nholdconfirm --mutate: no .title-slot-delete to rewire behind LOAD at ?shot=title. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
      console.log(`    (mutation rewired the slot's ✕ to delete on ONE pointer click)`);
    }
    const tState = () => ev(`(() => {
      const d = document.querySelector('.title-slot-delete');
      return {
        selector: !!document.querySelector('.title-slot-list'),
        occupied: document.querySelectorAll('.title-slot-pick.is-filled').length,
        del: !!d,
        action: d ? d.dataset.beatAction : null,
        beat: d ? d.dataset.beat : null,
        holdMs: d ? Number(d.dataset.holdMs || 0) : null,
        // The word HOLD does not fit beside an icon glyph — the flask-slot
        // precedent (ui.css). The dressing exists; the CSS hides it; the
        // native tooltip carries the sentence instead.
        hint: d ? !!d.querySelector('.hold-hint') : null,
        hintShown: (() => { const h = d && d.querySelector('.hold-hint'); return h ? getComputedStyle(h).display !== 'none' : false; })(),
        tip: d ? (d.title || '') : null,
        // CONTINUE on the menu is enabled exactly when a slot is occupied —
        // listSlots read back through the menu, not the selector.
        cont: !!document.querySelector('.slot-continue:not([disabled])'),
      };
    })()`);
    const t0 = await tState();
    if (!t0.selector || !t0.del || !t0.occupied) skip('title', 'unasked', `no occupied slot with a delete control behind LOAD at ?shot=title at this ref (selector open=${t0.selector}, occupied=${t0.occupied}, ✕=${t0.del})`);
    else {
      ok(`the pose surfaced a REAL save through the real reader`, t0.occupied === 1 && t0.cont,
        `${t0.occupied} occupied slot(s) behind LOAD, CONTINUE enabled=${t0.cont} — listSlots reading the bytes newRun wrote`);
      ok(`the ✕ is the machinery's control, ruled HOLD by the table`,
        t0.action === 'deleteSave' && t0.beat === 'hold' && t0.hint === true,
        `data-beat-action=${JSON.stringify(t0.action)} beat=${JSON.stringify(t0.beat)} hint=${t0.hint}`);
      ok(`the word yields to the icon, and the tooltip says HOLD instead (the flask precedent)`,
        t0.hintShown === false && /hold/i.test(t0.tip || ''),
        `hint shown=${t0.hintShown} title=${JSON.stringify(t0.tip)}`);
      ok(`its duration is THE DIAL'S, not a constant of its own`, t0.holdMs > 0,
        `holdMs=${t0.holdMs} under the default dial`);
      // 1. THE ABORT. A release before the fill lands must not delete — under
      // --mutate this is the check that goes red, because the rewired click
      // fires on that release.
      const dp = await pointOf('.title-slot-delete');
      await press(dp, Math.round((t0.holdMs || 600) * 0.4));
      const t1 = await tState();
      const t1Review = await ev(`!!document.querySelector('.confirmation-modal')`);
      ok(`a release before the fill lands deletes NOTHING`,
        t1.occupied === t0.occupied && t1.cont && t1Review,
        `occupied ${t0.occupied} -> ${t1.occupied}, CONTINUE=${t1.cont}, confirmation=${t1Review}`);
      await press(await pointOf('.confirmation-cancel'), 30); await wait(250);
      // 2. A COMPLETED HOLD DELETES — the verdict is the re-render the real
      // reader draws from storage: the selector closes on commit, the title
      // re-renders, and LOAD is walked again to count the rows.
      const dp2 = await pointOf('.title-slot-delete');
      if (dp2) { await press(dp2, (t0.holdMs || 600) + 350); await wait(400); }
      await openLoad();
      const t2 = await tState();
      ok(`a completed hold deletes the run`,
        mutate ? true : (t2.occupied === 0 && !t2.cont),
        `occupied ${t0.occupied} -> ${t2.occupied}, CONTINUE=${t2.cont} — read off the re-rendered title and the re-opened selector`);
      // 3. THE DIAL REACHES IT — both directions. `long` lengthens the arm;
      // `off` removes the shortcut but keeps the universal review door.
      await openShot('title', { shotSettings: JSON.stringify({ holdConfirm: 'long' }) });
      await openLoad();
      const tl = await tState();
      ok(`the 'long' dial lengthens the ✕'s arm — derived, not hard-coded`,
        mutate ? tl.del === false || true : (tl.holdMs === 1000),
        `holdMs=${tl && tl.holdMs} under holdConfirm='long'`);
      await openShot('title', { shotSettings: JSON.stringify({ holdConfirm: 'off' }) });
      await openLoad();
      const toff = await tState();
      if (!toff.del || !toff.occupied) skip('title dial-off', 'unasked', 'no occupied slot behind LOAD at ?shot=title with the dial off');
      else {
        ok(`Off strips the hold dressing from the ✕`, toff.holdMs === 0 && toff.hint === false,
          `holdMs=${toff.holdMs} hint=${toff.hint}`);
        const opd = await pointOf('.title-slot-delete');
        await press(opd, 30); await wait(400);
        const toff2 = await tState();
        const toffReview = await ev(`!!document.querySelector('.confirmation-modal')`);
        ok(`Off sends one tap to review and deletes NOTHING`,
          toff2.occupied === toff.occupied && toff2.cont && toffReview,
          `occupied ${toff.occupied} -> ${toff2.occupied}, confirmation=${toffReview}`);
        await press(await pointOf('.confirmation-confirm'), 30); await wait(400);
        await openLoad();
        const toff3 = await tState();
        ok(`the off-mode confirmation deletes the run`,
          mutate ? true : (toff3.occupied === 0 && !toff3.cont),
          `occupied ${toff.occupied} -> ${toff3.occupied}`);
      }
    }
  }

  // ---- TITLE → PROFILE: restoring a set-aside profile -----------------------
  {
    console.log(`\n  TITLE → PROFILE — Restore opens an inline confirm that names what happens to the profile in play`);
    await openShot('profile');
    const tab = await pointOf('.profile-archive-modal');
    if (!tab) skip('profile', 'unasked', 'no Profile archive modal at ?shot=profile at this ref');
    else {
      if (mutate) {
        // THE OLD DOOR: one tap "restores" — the result line speaks, no
        // confirm ever opens.
        const rewired = await ev(`(() => {
          const b = document.querySelector('.prof-restore'); if (!b) return 0;
          const c = b.cloneNode(true); b.parentNode.replaceChild(c, b);
          c.addEventListener('click', () => { const r = document.querySelector('.prof-result'); if (r) r.textContent = 'Restored.'; });
          return 1;
        })()`);
        if (!rewired) { console.error('\nholdconfirm --mutate: no .prof-restore to rewire at ?shot=profile. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
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
        // The drawer itself. profileStatus().archiveId is a READ-TRANSIENT:
        // loadMeta() re-derives the status on every clean read, and the title
        // screen performs such a read at mount now (the delete beat's dial) —
        // so past a navigation, "the bytes are kept" is the DRAWER's claim,
        // not the pointer's. Observed exactly there: green while nothing on
        // the title read the meta, "old bytes LOST" the day it did, drawer
        // intact both times.
        drawer: typeof window.__archives === 'function' ? window.__archives().length : null,
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
        if (!rewired) { console.error('\nholdconfirm --mutate: no .fresh to rewire at ?shot=crisis. unknown, not caught.'); cdp.close(); await dropBrowser(); stop(); process.exit(2); }
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
        // "KEPT" is read off the drawer, not off profileStatus().archiveId —
        // see cState's comment: the pointer does not survive the title mount's
        // own meta read, and the promise the modal makes is about the bytes.
        const kept = c3.drawer != null && c0.drawer != null && c3.drawer >= c0.drawer && c3.drawer > 0;
        ok(`"Start fresh" commits: a fresh profile is live and the torn one is KEPT`,
          c3.ok === true && c3.state === 'ok' && c3.quarantined === false && kept && c3.title,
          `state=${c3.state} quarantined=${c3.quarantined} drawer ${c0.drawer} -> ${c3.drawer} (${kept ? 'kept' : 'LOST'}) title mounted=${c3.title}`);
      }
    }
  }

  cdp.close(); await dropBrowser(); stop();

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
      ['the level card', 'spends NOTHING'],
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
      DERIVES THEM. shrineLevelUp, profileRestore and freshProfile answer in
      their own screens' hands; this proves each hand works (pends or arms,
      cancels, commits only on the second beat) — whether any should collapse
      into the shared machinery is a design call a green here licenses nothing
      about. (deleteSave was in this club until 2026-08-14; its collapse is
      DONE and its checks above drive the machinery's own hold on the dial.) The crisis pose is the corrupt
      state only: 'older' and 'newer' render different screens and neither is
      driven here.`);
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
