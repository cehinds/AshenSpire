#!/usr/bin/env node
// tools/displayfirst.mjs — FULLSCREEN IS THE FIRST THING A PLAYER MEETS UNDER
// DISPLAY, ON THE SCREEN, AT BOTH DOORS. The rendered check on E3 / #248.
//
// WHY IT EXISTS, and it is not that the ordering is broken — it is not.
//
// His words, 2026-08-15 (#248): "the full screen option toggle should be the
// first option in the display". PR #287 moved the row to the head of `ROWS` and
// landed `tests/engine.test.js` test 61 to hold the seat. That test reads
//
//     categoryHandler('Display').rows[0].key === 'fullscreen'
//
// which is an assertion about an ARRAY, and its own comment states the missing
// half as a fact rather than checking it: *"Order on the screen IS array order
// in ROWS — categoryHandler() filters without sorting, rowHtml renders in
// sequence."* That sentence is true today. Nothing in this repo watches it stay
// true, and three separate one-line edits make it false while test 61 stays
// green — each of them is a plant in the corpus below:
//
//   · the RENDERER reorders (`categoryHtml`'s `h.rows.map(...)`), leaving
//     `categoryHandler().rows` untouched;
//   · CSS hides the first row — it is still first in the array, and the first
//     control a player can SEE is Character sprites;
//   · CSS reverses the visual order of a DOM that never moved (`column-reverse`
//     / `order:`), which is the same shape as a box that "never moved" because
//     what moved was its parent.
//
// So this file is not a second copy of test 61. Test 61 asserts the TABLE; this
// asserts the SCREEN, and the two disagree exactly where the bugs live.
//
// THE BEFORE, MEASURED AT dev = 897d9fa BEFORE A LINE OF THIS EXISTED, so the
// claim "the ordering already holds" is a reading and not a hope. Four cells,
// title door and in-run door, 1440x860 and 390x844: `#set-panel` renders TWENTY
// Display rows, row 0 is `fullscreen` in every one, `display:flex`,
// `visibility:visible`, box 83.5 px tall wide / 64.4 px phone, top edge equal to
// the panel's own top, panel `scrollTop` 0. It is first, and it is INK.
//
// WHAT IT CHECKS, per cell:
//   D1 ORDER    the first Display control a player meets is `fullscreen`.
//               "First" is GEOMETRIC — visible rows sorted by rendered (top,
//               left) — never DOM order. A check that read DOM order would be
//               green under `flex-direction: column-reverse`, where every box
//               is where it always was and the player sees the list backwards.
//   D2 ONCE     exactly one `fullscreen` CONTROL is in the panel. A move that
//               copies is not a move. IT COUNTED ROWS UNTIL 2026-08-22, and a
//               row reports only its FIRST `[data-key]`: two Fullscreen toggles
//               rendered inside ONE `.set-row` gave `count=1` and passed. The
//               sentence said control, the predicate said container. Codex,
//               `:419`. Both numbers are printed now — `controls=N rows=M` —
//               because their divergence IS the defect.
//   D3 INK      that row AND THE CONTROL INSIDE IT are on screen ON ARRIVAL —
//               non-zero box, not `display:none` / `visibility:hidden`, not
//               transparent through ANY ancestor, and each box wholly inside the
//               viewport ON ALL FOUR EDGES, with nothing scrolled ON ALL THREE
//               AXES (panel, document Y, document X).
//               TWO BOXES SINCE 2026-08-22, and the second one is the sweep D2's
//               finding earned: this judged the `.set-row` and called it the
//               control. A toggle displaced, shrunk or faded INSIDE a row that
//               is exactly where it belongs left every number correct and the
//               control out of reach.
//               ANCESTOR OPACITY SINCE 2026-08-22 TOO: opacity neither inherits
//               nor collapses the box, so `.modal-veil { opacity: 0 }` left the
//               row at `opacity: 1`, full size, and this tool printed
//               `OK — 8 checks passed` over a panel nobody could see.
//               "First" that a player has to scroll to is not first.
//               NOTHING SCROLLED MEANT TWO AXES UNTIL 2026-08-22: `docX` was
//               read off the page and never reached the predicate, so a document
//               scrolled 500 px sideways printed "nothing scrolled" and exited
//               0. That is a FALSE PRINTED CLAIM rather than a demonstrated
//               false green — `.modal-veil` is fixed, so the row could not
//               actually be pushed off — and on this house's own test that is
//               the worse of the two, because nothing fails and the reader is
//               left confidently wrong.
//               THE FOUR EDGES ARE THE POINT, and this sentence was a lie for
//               one of them until 2026-08-22: the predicate named top, left and
//               bottom and never mentioned the RIGHT edge, so a row pushed
//               clean off the right of the viewport passed. Measured at the
//               real door, one plant per edge — left, top and bottom CAUGHT,
//               right UNCAUGHT with `OK — 2 cells passed`, exit 0. All four are
//               in the corpus now, so the sentence and the predicate name the
//               same set and each edge has been WATCHED to fail.
//   D4 DOORS    the title-screen modal and the in-run overlay give the SAME
//               answer at the same shape and text size. One home renders both
//               (`renderSettings`); a divergence means that stopped being true.
//   D0 POP      the declared cell count is reached, and a Display panel with NO
//               rows is RED. An empty population and a clean one look identical
//               to a check that only hunts for violations, and they mean the
//               opposite. AND THE DECLARED COUNT ITSELF MAY NOT BE ZERO:
//               `reached === expected` is self-satisfying at zero, so a zero
//               population is REFUSED (exit 2, UNKNOWN), never passed — and a
//               narrowing flag that matches nothing is refused before it can
//               produce one. See the `--only-*` block below for the run that
//               printed `OK — 1 checks passed` over no cells at all.
//
// BOTH EDGES, named because the gate requires it:
//   · EMPTY — Display with zero rows (plant 5). D0 goes red; nothing else may
//     report green over it.
//   · MAX — Text XL, the longest labels and notes and the tallest rows this
//     screen has, at the narrow shape where the panel is nearest to overflowing.
//
// THE THRESHOLD'S OWN NEIGHBOURHOOD (Charter 2b). The threshold here is ordinal
// position, and its unit is one row: plant 1 moves `fullscreen` exactly ONE
// position and the verdict flips, so there is a cell either side of the line,
// adjacent, and both enter by the same door as every other input — file bytes in
// a copied real tree.
//
// THE DOOR: the SOURCE TREE over http in headless Chromium (tools/serve.mjs).
// Text size is set through the game's own settings store (`?shotSettings`), the
// panel is opened by CLICKING the same controls a player clicks, and every box
// is read with `getBoundingClientRect()` off the live page. Nothing is injected
// and no module is imported to be asked a question. `--selftest` plants its
// known-bads as file bytes in a copied real tree (tools/doorplant.mjs) and runs
// this tool WHOLE from the copy — the same door, narrowed population declared in
// its own output.
//
// WHAT IT DOES NOT COVER, and this is the boundary rather than a to-do:
//   · THE OTHER HALF OF HIS SENTENCE. "the menu settings need some work in look
//     and feel" is unspecified, unowned, and NOT ASSERTED ANYWHERE HERE. This
//     tool would be green on a settings screen he hates. It says one thing:
//     the first control under Display is the Fullscreen toggle, and you can see
//     it without scrolling.
//   · THE REMAINING ROWS. Only position 1 has an ask attached to it, so only
//     position 1 is held. The rest may be reordered freely.
//   · Linux headless Chromium, two shapes, two text sizes, two doors. Windows
//     and macOS are `unknown` here as everywhere else in this repo.
//   · IT IS WIRED INTO ci.yml's MANUAL Ubuntu browser job. One clean run
//     measures eight rendered cells; the selftest adds eighteen copied-tree
//     browser plants, including deliberate 25-second and 30-second timeout
//     defects. The workflow states that cost beside the steps. Until an
//     exact-head dispatch finishes, this gate is `unknown`, not green.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day #248's ordering ask is
// withdrawn or superseded by a different first row — in which case the ask moves
// and this file moves with it, it does not quietly widen. Also deleted if test
// 61 is ever replaced by a check that reads the rendered screen itself, since
// then this is the second copy.
//
// Vira Falk, 2026-08-22.

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

const WANT = 'fullscreen';

const ALL_SHAPES = [
  { tag: '1440x860', w: 1440, h: 860, d: 1, mobile: false },
  { tag: '390x844', w: 390, h: 844, d: 3, mobile: true },
];
const ALL_TEXTS = ['M', 'XL'];
const ALL_DOORS = ['title', 'inrun'];

// The selftest narrows the population so five whole-tool browser runs finish in
// a sensible time. It is DECLARED, never implied: `--only-shape` / `--only-text`
// print in the header of every run that uses them.
//
// AND THE VALUE IS NOW VALIDATED, because a narrowing flag is the one input that
// can empty the population. Found by Marina 2026-08-22 at this line, reproduced
// here before the fix:
//
//   $ node tools/displayfirst.mjs --only-shape 1440x680     # typo for 860
//     ok  D0/population reached=0 declared=0 (0 shape(s) x 2 text size(s) x 2 doors)
//   · cells measured: 0 of 0 declared.
//   displayfirst: OK — 1 checks passed                       exit 0
//
// `expected` derives from the SAME filter that produces the cells, so
// `reached === expected` is SELF-SATISFYING AT ZERO — the check compares a
// number against itself and calls the agreement a pass.
//
// IT WALKS THROUGH #294's FLOOR, and the count is why: ONE check passed, not
// zero, and that one is the self-satisfying D0 line. `verdict.mjs`'s ZERO-WORK
// GREEN floor fires only at exactly 0, so wrapped in the real door this read
// `verdict: OK — verdict: 1 via [label: OK — N checks passed]`, exit 0.
//
// THE INVERSION IS THE PART WORTH KEEPING. The boundary block told the truth in
// the same breath — `cells measured: 0 of 0 declared` — while the verdict line
// lied. That is the exact defect this tool exists to catch, committed by this
// tool: a predicate narrower than the sentence it backs, printed as green.
//
// So, two refusals, and neither is a pass:
//   · an unknown VALUE is refused before anything boots, by name, with the legal
//     set printed — a typo may not silently select an empty world;
//   · a DECLARED POPULATION OF ZERO is refused outright, whatever produced it.
//     The second does not depend on my having enumerated every narrowing axis,
//     which is the half that would rot when someone adds a third flag.
// Both exit 2 as `UNKNOWN — nothing was measured`, which #294's `readVerdict`
// reads as SILENCE and blocks on. Nothing measured is not a verdict.
const hasFlag = (f) => args.indexOf(f) >= 0;
const onlyShape = argOf('--only-shape');
const onlyText = argOf('--only-text');
const narrowingErrors = [];
if (hasFlag('--only-shape') && !ALL_SHAPES.some((s) => s.tag === onlyShape)) {
  narrowingErrors.push(`--only-shape ${JSON.stringify(onlyShape ?? null)} matches no known shape `
    + `(known: ${ALL_SHAPES.map((s) => s.tag).join(', ')}) — it would select ZERO cells.`);
}
if (hasFlag('--only-text') && !ALL_TEXTS.includes(onlyText)) {
  narrowingErrors.push(`--only-text ${JSON.stringify(onlyText ?? null)} matches no known text size `
    + `(known: ${ALL_TEXTS.join(', ')}) — it would select ZERO cells.`);
}
const SHAPES = onlyShape != null ? ALL_SHAPES.filter((s) => s.tag === onlyShape) : ALL_SHAPES;
const TEXTS = onlyText != null ? ALL_TEXTS.filter((t) => t === onlyText) : ALL_TEXTS;
const DOORS = ALL_DOORS;

// ---------------------------------------------------------------------------
// THE COUNTERS AND THE BOUNDARY LIVE AT MODULE SCOPE, AND THE REASON IS A
// MEASUREMENT ABOUT THIS FILE, NOT A STYLE PREFERENCE.
//
// Bjorn measured in #320 that 41 of 69 boundary-printing tools in this repo
// have an EXIT PATH ABOVE THEIR PRINT. This tool was one of them. Until
// 2026-08-22 the BOUNDARY block sat inside `main()` after the cell loop, and
// three paths reached an exit without ever passing it:
//
//   · `process.exit(2)` when no browser is found;
//   · the top-level `main().catch(...)`, which any throw takes — a navigation
//     that never settles, a door whose controls are gone, a dead server;
//   · consequently, EVERY run against a subject that will not boot.
//
// Planted and watched rather than assumed (corpus plant 10, below): a settings
// module that throws on load leaves the page blank, `until()` times out, and at
// `07ead53` that run printed a stack, exit 1, ZERO boundary lines and ZERO
// verdict lines. A tool that says nothing about its own limits exactly when it
// failed to measure anything is the "green wasn't clearance" shape inverted.
//
// So: counters at module scope, `printBoundary()` at module scope, and EVERY
// exit goes through `finish()`. `printBoundary()` is idempotent, so a path that
// is reached twice prints once.
//
// THE FAILURE-PATH LINE IS DELIBERATELY NOT VERDICT-SHAPED. #294's
// `readVerdict` reads a stream and returns the one terminated verdict line;
// `displayfirst: STOPPED — …` and `displayfirst: UNKNOWN — …` match no row in
// its grammar, so it returns `{error:'none'}` — SILENCE, which blocks. That is
// the correct reading of a run that measured nothing, and it is why those lines
// are shaped the way they are rather than merely worded that way. Checked
// against `readVerdict` itself, not eyeballed.
//
// THE GREEN LINE IS VERDICT-SHAPED, and it moved to get there: it used to read
// `OK — N cells passed; 0 findings`, which `readVerdict` also returns
// `{error:'none'}` for — prose after the counted claim is unrecognised grammar,
// by that door's contract. A green nobody can read is the same silence as a red
// nobody printed.
// ---------------------------------------------------------------------------
let bad = 0;
let unknown = 0;
let passes = 0;
let reached = 0;
let expected = null;
const fail = (line) => { bad++; console.error(`RED  ${line}`); };
const note = (line) => { passes++; console.log(`  ok  ${line}`); };
const unk = (line) => { unknown++; console.log(`  ??  ${line}`); };

let boundaryPrinted = false;
function printBoundary() {
  if (boundaryPrinted) return;
  boundaryPrinted = true;
  console.log('');
  console.log('BOUNDARY — printed on EVERY exit path, green, red or crashed, because a gate that prints');
  console.log('  only on the paths it survived is "green wasn\'t clearance" shipped as infrastructure:');
  console.log('  · THE LOOK-AND-FEEL HALF OF #248 IS NOT ASSERTED HERE and is still unowned. This tool');
  console.log('    would be green on a settings screen Constantine dislikes. It holds ONE sentence:');
  console.log('    the first control under Display is the Fullscreen toggle, and it is on screen.');
  console.log('  · Only position 1 is held. The remaining Display rows may be reordered freely.');
  console.log('  · D1 orders ROWS, and that is its subject on purpose: two controls inside ONE row have');
  console.log('    no order of their own here, and D1 would report whichever the DOM lists first. D2');
  console.log('    counts controls and D3 judges the control\'s own box, so a duplicate or a displaced');
  console.log('    control is caught — but their ORDER within a shared row is not measured.');
  console.log('  · D3 judges the Fullscreen row\'s own box against all four viewport edges, and its');
  console.log('    EFFECTIVE OPACITY through every ancestor to the root. It still says nothing about');
  console.log('    whether an ANCESTOR CLIPS it (overflow/clip-path), whether another ELEMENT COVERS');
  console.log('    it, or whether an ancestor is merely FAINT — the opacity test is `> 0`, so 0.01 is');
  console.log('    invisible to a player and green here. Closing those means deciding what "painted"');
  console.log('    means, which is a different instrument.');
  console.log('  · Linux headless Chromium only; windows-latest and macos-latest are `unknown`.');
  console.log('  · WIRED INTO ci.yml\'s MANUAL Ubuntu browser job (see the header) — between');
  console.log('    exact-head dispatches this is `unknown`, not green.');
  if (expected === null) {
    console.log('  · this run measured NO cells of its own — it is the corpus harness, and what it');
    console.log('    reports is whether the plants went red, never whether the screen is right.');
  } else {
    console.log(`  · cells measured: ${reached} of ${expected} declared.`);
  }
  if (unknown) console.log(`  · ${unknown} check(s) resolved UNKNOWN in this run and counted toward nothing.`);
  console.log('');
}

// ---------------------------------------------------------------------------
// THE EXIT DOES NOT CUT THE OUTPUT OFF, AND UNTIL 2026-08-22 IT COULD.
//
// `finish()` printed the boundary and the verdict and called `process.exit()`
// in the same breath, on every state; `--selftest` did the same. On POSIX,
// Node's stdout is SYNCHRONOUS to a file or a TTY and ASYNCHRONOUS TO A PIPE.
// `process.exit()` does not drain a queued write. So the one line this gate
// promises on every exit path is exactly the line a pipe can eat.
//
// MEASURED, NOT REASONED, and it is not a race — it is deterministic once the
// pipe is full (Linux pipe buffer, 64 KiB; a reader stalled 300 ms):
//
//   bytes on stdout   process.exit()     process.exitCode
//   1 KiB             0/20 truncated     0/20
//   64 KiB           20/20 TRUNCATED     0/20
//   256 KiB          20/20 TRUNCATED     0/20
//   1 MiB            20/20 TRUNCATED     0/20
//
// SIZED HONESTLY, BECAUSE THE SIZING IS THE INTERESTING PART: this tool's own
// largest measured run is 5,207 bytes of stdout (the full 8-cell green), an
// order of magnitude under the buffer, so I could not produce a truncation from
// its own output on Linux. What CAN produce one is a CONSUMER whose pipe is
// already full — a log collector, a `tee`, a CI step reading two streams — and
// that is the corpus's flush plant below, which fills the pipe first and then
// requires the terminal line to survive. So: a real defect, watched, whose
// exposure today is a slow consumer rather than this tool's own verbosity.
//
// AND THE OTHER HALF, WHICH IS WHY THIS IS NOT A ONE-WORD CHANGE. `process.exit`
// was also doing a second job nobody wrote down: killing a process that
// `serve.mjs`'s HTTP server and a live Chromium would otherwise hold open.
// Removing it without `shutdown()` converts every truncation into a HANG — the
// same defect in a worse coat, since a hang prints nothing at all. So the exits
// are ordered: close what we opened, print, set `process.exitCode`, return, and
// let the loop drain and end by itself. `forceExitAfterDrain` is the backstop
// for a handle nobody accounted for, and it arms ONLY AFTER both streams have
// flushed — never before, because that would be the truncation again.
// ---------------------------------------------------------------------------

/** What this run opened, so an error path can close it. Set as each is created. */
const live = { cdp: null, dropBrowser: null, server: null };

/** The verdict this run has already ended on, if any. See the latch in `finish`. */
let ended = null;

/** Idempotent, and it never throws: a failed teardown may not eat the verdict. */
async function shutdown() {
  const { cdp, dropBrowser, server } = live;
  live.cdp = null; live.dropBrowser = null; live.server = null;
  try { cdp?.close(); } catch { /* the socket may already be gone — that is the case we are in */ }
  try { await dropBrowser?.(); } catch { /* browser.mjs prints its own removal failures by name */ }
  try {
    // `serve()` returns a record; the Node HTTP server is its `server` member.
    // Wait for its close callback so the event loop can drain without the
    // three-second forced-exit backstop becoming the normal shutdown path.
    if (server?.server) await new Promise((resolveClose) => server.server.close(resolveClose));
  } catch { /* nothing left to serve */ }
}

/**
 * The backstop, and it is deliberately NOT a substitute for closing handles.
 * If something still holds the event loop three seconds after the promised
 * output has DRAINED, leave anyway with the verdict's own code — a gate that
 * hangs is read as slow, not as failing. The empty write's callback is what
 * "drained" means here, and the timer is unref'd so a process that can exit on
 * its own still does, immediately.
 */
function forceExitAfterDrain(code) {
  let waiting = 2;
  const armed = () => {
    if (--waiting) return;
    const t = setTimeout(() => process.exit(code), 3000);
    t.unref?.();
  };
  try { process.stdout.write('', armed); process.stderr.write('', armed); } catch { /* closed */ }
}

/**
 * The ONE exit. Every path — pass, fail, no-browser, thrown — ends here.
 * Returns the exit code; callers RETURN this so nothing runs after a verdict.
 */
function finish(state, detail) {
  const code = state === 'ok' ? 0 : state === 'unknown' ? 2 : 1;
  // THE FATAL STATE LATCHES. `process.exit()` made an exit FINAL, and that was
  // the second job nobody wrote down when four seats were told to switch to
  // `process.exitCode` today: a code is a VARIABLE, so a later path can set it
  // back to 0 and a run that already died prints a green. Codex found that on
  // #322. Silence blocks; a green does not — trading truncation for a false
  // green would be worse than the bug the switch was for.
  //
  // MEASURED IN THIS FILE RATHER THAN ASSUMED FROM THE CLASS: no
  // `uncaughtException` and no `unhandledRejection` handler is installed
  // anywhere in this tool's import graph (`browser.mjs` installs `exit` and the
  // four signals and nothing else), so Node's default — terminate — still holds
  // for an async throw, and `main()`'s promise settles once. I found no
  // reachable double-finish path here. THE LATCH IS NOT RELYING ON THAT SURVEY:
  // a survey is a claim about today's call graph, and this is a claim about the
  // verdict. A non-green may be overwritten by nothing; a green may always be
  // overwritten by a later non-green, which is the direction that keeps a late
  // failure visible.
  if (ended && code === 0 && ended.code !== 0) {
    console.error(`displayfirst: SECOND VERDICT REFUSED — this run already ended on `
      + `${ended.state.toUpperCase()} (exit ${ended.code}) and a later path tried to print OK. `
      + 'The first stands. A green may not overwrite a run that already failed.');
    return ended.code;
  }
  printBoundary();
  if (state === 'ok') {
    console.log(`displayfirst: OK — ${passes} checks passed`);
  } else if (state === 'fail') {
    console.error(`displayfirst: FAIL — ${bad} finding(s) across ${reached} cells`);
  // NOT VERDICT-SHAPED, ON PURPOSE — see the block above. `readVerdict` returns
  // {error:'none'} for both of these, which is silence, which blocks.
  } else if (state === 'unknown') {
    console.error(`displayfirst: UNKNOWN — nothing was measured (${detail}).`);
  } else {
    console.error(`displayfirst: STOPPED — the run ended on an error after ${reached}`
      + `${expected === null ? '' : ` of ${expected}`} cell(s) (${detail}). Nothing above is a verdict.`);
  }
  ended = { state, code };
  process.exitCode = code;
  forceExitAfterDrain(code);
  return code;
}

// ---------------------------------------------------------------------------
// The page-side read. Returns the VISIBLE Display rows in GEOMETRIC order, each
// with the key of the control it carries, plus the fullscreen row's own box and
// the viewport it was measured in.
// ---------------------------------------------------------------------------
const READ = `(() => {
  const panel = document.querySelector('#set-panel');
  if (!panel) return { panel: false };
  // EFFECTIVE OPACITY — the row's own value MULTIPLIED BY EVERY ANCESTOR'S.
  //
  // Opacity is the one of the three hiding mechanisms that neither inherits nor
  // collapses the box. \`display:none\` on an ancestor gives the row a 0x0 rect,
  // and \`visibility:hidden\` inherits, so \`getComputedStyle(row).visibility\`
  // already carries an ancestor's. \`opacity: 0\` on \`.set-panel\` or
  // \`.modal-veil\` does NEITHER: the row keeps its dimensions and reports
  // \`opacity: 1\`, so a per-element read sees a visible row on an invisible
  // panel. Codex found it at this line, 2026-08-22; it is the same shape as the
  // right edge and \`docX\` — a predicate narrower than the sentence it backs.
  const effOpacity = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return +o.toFixed(4);
  };
  const rows = [...panel.querySelectorAll('.set-row')].map((row) => {
    const ctrl = row.querySelector('[data-key]');
    const b = row.getBoundingClientRect();
    const cs = getComputedStyle(row);
    return {
      key: ctrl ? ctrl.dataset.key : null,
      effOpacity: effOpacity(row),
      // ALL FOUR SIDES ARE READ, because all four are judged. The right edge
      // was not read here until 2026-08-22, which is half of why D3 never
      // checked it: a predicate cannot name an edge the read never carried.
      top: +b.top.toFixed(2), left: +b.left.toFixed(2),
      bottom: +b.bottom.toFixed(2), right: +b.right.toFixed(2),
      w: +b.width.toFixed(2), h: +b.height.toFixed(2),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    };
  });
  // VISIBLE means a player could see it if they looked: it occupies space and
  // is not hidden. Being off-screen is D3's question, not this one.
  const visible = rows.filter((r) => r.display !== 'none' && r.visibility !== 'hidden'
    && r.w > 0 && r.h > 0 && r.opacity !== '0' && r.effOpacity > 0);
  // GEOMETRIC ORDER, not DOM order. This is the whole reason the tool exists.
  visible.sort((a, b2) => (a.top - b2.top) || (a.left - b2.left));
  const fs = rows.filter((r) => r.key === ${JSON.stringify(WANT)});
  // THE CONTROLS THEMSELVES, COUNTED AS CONTROLS. \`rows\` is one entry per
  // \`.set-row\`, and each row reports \`querySelector('[data-key]')\` — THE
  // FIRST match. A regression that renders the Fullscreen toggle TWICE INSIDE
  // ONE ROW collapses to a single key there, so counting rows returns 1 while
  // two controls are on the screen. D2 promises exactly one CONTROL. Codex, at
  // \`:419\`, 2026-08-22 — the third time in this file a predicate measured
  // something adjacent to the noun its own sentence used.
  const fsEls = [...panel.querySelectorAll('[data-key="' + ${JSON.stringify(WANT)} + '"]')];
  const boxOf = (el) => {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: +b.top.toFixed(2), left: +b.left.toFixed(2),
      bottom: +b.bottom.toFixed(2), right: +b.right.toFixed(2),
      w: +b.width.toFixed(2), h: +b.height.toFixed(2),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      effOpacity: effOpacity(el),
    };
  };
  return {
    panel: true,
    tab: (document.querySelector('.set-tab.on') || { dataset: {} }).dataset.member,
    domKeys: rows.map((r) => r.key),
    visibleKeys: visible.map((r) => r.key),
    first: visible.length ? visible[0] : null,
    fsCount: fsEls.length,
    fsRowCount: fs.length,
    fs: fs[0] || null,
    // The control's OWN box, so D3 can stop trusting the container to speak for
    // the thing inside it.
    fsCtrl: fsEls[0] ? boxOf(fsEls[0]) : null,
    panelEffOpacity: effOpacity(panel),
    scroll: { panelTop: panel.scrollTop, docY: window.scrollY, docX: window.scrollX },
    vp: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

// EVERY COMMAND HAS TO COME BACK, OR SAY THAT IT DID NOT. A HANG IS THE SAME
// DEFECT AS A BLANK BAND IN A DIFFERENT COAT — Sunna's sentence, 2026-08-22,
// after her screenshot harness hung forever on `Page.captureScreenshot` and two
// runs died having photographed four screens and reported nothing about the six
// they missed.
//
// THE DEFECT, at this line until 2026-08-22 (Codex, `:351`): a promise went into
// `pending` and ONLY a matching `message` event ever took it out. There was no
// close handler, no error handler and no timeout. So there were two ways to
// suspend `main()` forever, and neither printed anything:
//
//   1. THE SOCKET DIES. Chromium crashes or the DevTools socket drops after the
//      command is sent and before the reply arrives. No message ever comes.
//   2. THE SOCKET LIVES AND THE REPLY DOES NOT. The renderer is blocked, so
//      `Runtime.evaluate` is queued behind a main thread that never yields.
//      **This is Sunna's shape, and it is the one a close handler does NOT
//      cover** — the socket is perfectly healthy the whole time.
//
// Either way `main()` never settles, `serve.mjs`'s HTTP server keeps the loop
// alive, and this hand-run gate hangs WITHOUT printing the STOPPED line and the
// boundary it promises on every exit path. A gate that hangs is read as a slow
// gate, not a failing one; nobody re-runs it and nothing goes red.
//
// BOTH DOORS ARE CLOSED HERE, because they are two different failures:
//   · close/error rejects EVERY pending command by name and poisons the socket,
//     so a command issued after the death fails immediately instead of joining
//     a queue nothing will ever drain;
//   · each command carries its own timeout, which is the ONLY thing that
//     catches case 2. Watched, not asserted: corpus plant 14 blocks the page's
//     main thread and the run reaches STOPPED naming this timeout.
//
// The bound is generous on purpose — the slowest legitimate command here is an
// `awaitPromise` evaluate that clicks through two menus with ~1.6 s of waits
// inside it. 30 s is 18x that. It is a deadline, not a performance budget.
const CDP_TIMEOUT_MS = 30000;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  let dead = null;
  const killPending = (why) => {
    dead = dead || why;
    for (const [, p] of pending) { clearTimeout(p.timer); p.rej(cdpError(why)); }
    pending.clear();
  };
  // Tagged so `until()` can tell a transport death from a page that has simply
  // not painted yet. A polling loop that swallows the first is a hang wearing a
  // retry's clothes.
  const cdpError = (msg) => Object.assign(new Error(msg), { cdp: true });
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej, timer } = pending.get(m.id); pending.delete(m.id); clearTimeout(timer);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  });
  ws.addEventListener('close', () => killPending('the DevTools socket CLOSED with commands still in '
    + 'flight — Chromium is gone and no reply is coming'));
  ws.addEventListener('error', (e) => killPending('the DevTools socket ERRORED with commands still in '
    + `flight (${(e && (e.message || e.error?.message)) || 'no detail'})`));
  return {
    ready: new Promise((res, rej) => {
      ws.addEventListener('open', res);
      ws.addEventListener('error', rej);
      ws.addEventListener('close', () => rej(cdpError('the DevTools socket closed before it opened')));
    }),
    send(method, params = {}, sessionId) {
      if (dead) return Promise.reject(cdpError(`${method} was not sent: ${dead}`));
      const id = nextId++;
      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rej(cdpError(`CDP ${method} did not answer within ${CDP_TIMEOUT_MS} ms. The socket is `
            + 'alive and the reply never came — a blocked renderer looks exactly like this, and so '
            + 'does a command the browser silently dropped. Nothing below it was measured.'));
        }, CDP_TIMEOUT_MS);
        // A deadline must not be the thing that keeps the process alive after
        // the verdict is printed.
        timer.unref?.();
        pending.set(id, { res, rej, timer });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Open Settings and select Display, THROUGH THE CONTROLS A PLAYER USES.
const OPEN_TITLE = `(async () => {
  const b = [...document.querySelectorAll('button')].find((x) => /settings/i.test(x.textContent));
  if (!b) return { err: 'no Settings button on the title screen' };
  b.click(); await new Promise((r) => setTimeout(r, 500));
  const d = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === 'Display');
  if (!d) return { err: 'no Display tab in the settings modal' };
  d.click(); await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
})()`;

const OPEN_INRUN = `(async () => {
  const m = [...document.querySelectorAll('button')].find((x) => /^\\s*(menu|☰)\\s*$/i.test(x.textContent) || x.id === 'menu' || /(^|\\s)menu(\\s|$)/i.test(x.className));
  if (!m) return { err: 'no menu button in combat' };
  m.click(); await new Promise((r) => setTimeout(r, 550));
  // QuickNav includes the row's icon in its text, so use the public menu-act
  // attributes rather than a whole-button text match. With QuickNav disabled,
  // the menu opens the overlay directly and the overlay tab is the same
  // player-facing next step.
  const t = document.querySelector('.qn-row[data-act="tab"][data-tab="settings"]')
    || document.querySelector('.ov-tab[data-member="settings"]');
  if (!t) return { err: 'no Settings tab in the overlay' };
  t.click(); await new Promise((r) => setTimeout(r, 550));
  const d = [...document.querySelectorAll('.set-tab')].find((e) => e.dataset.member === 'Display');
  if (!d) return { err: 'no Display tab in the overlay settings panel' };
  d.click(); await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
})()`;

/** One cell: judge a read. Returns the key a player meets first, or null. */
function judge(r, cell) {
  if (!r || r.panel === false) {
    fail(`FINDING D0/population cell=${cell} panel=absent — no #set-panel rendered, so every check `
      + 'below had nothing to compare. An empty population is not a pass.');
    return null;
  }
  if (!r.visibleKeys.length) {
    fail(`FINDING D0/population cell=${cell} visible=0 dom=${r.domKeys.length} `
      + `panelEffectiveOpacity=${r.panelEffOpacity} — the Display panel renders NO visible control `
      + 'rows. Nothing here is evidence about ordering. (A panelEffectiveOpacity of 0 means the rows '
      + 'are all there and the whole panel is transparent — the boxes are real and nobody can see them.)');
    return null;
  }
  const first = r.first ? r.first.key : null;
  if (first !== WANT) {
    fail(`FINDING D1/order cell=${cell} first=${first} want=${WANT} — the first control a player meets `
      + `under Display is not the Fullscreen toggle. Visible order: ${JSON.stringify(r.visibleKeys.slice(0, 4))}`
      + `; DOM order: ${JSON.stringify(r.domKeys.slice(0, 4))}.`);
  } else {
    note(`D1/order ${cell} first=${first} (geometric, ${r.visibleKeys.length} visible rows)`);
  }
  // D2 COUNTS CONTROLS, NOT CONTAINING ROWS, AND THE TWO NUMBERS ARE BOTH
  // PRINTED so a reader can see when they diverge. Until 2026-08-22 this read
  // the ROW count: two Fullscreen toggles inside one `.set-row` reported
  // `count=1` and passed, because each row contributes the FIRST `[data-key]`
  // it contains and nothing looks wrong in the code.
  if (r.fsCount !== 1) {
    fail(`FINDING D2/once cell=${cell} controls=${r.fsCount} rows=${r.fsRowCount} want=1 control — the `
      + 'row must have MOVED, not been copied, and a second control inside the SAME row is still a copy. '
      + '(controls > rows means the duplicate is inside one row, which is the shape a row-count check '
      + 'cannot see.)');
  } else {
    note(`D2/once ${cell} controls=1 rows=${r.fsRowCount}`);
  }
  // D3 INK — on screen with nothing scrolled.
  const fs = r.fs;
  if (!fs) {
    fail(`FINDING D3/ink cell=${cell} key=${WANT} present=false — the Fullscreen row is not in the panel at all.`);
  } else {
    // SHOWN NOW INCLUDES EVERY ANCESTOR'S OPACITY, NOT JUST THE ROW'S.
    //
    // Until 2026-08-22 this read `fs.opacity !== '0'` — the ROW's own computed
    // value — and opacity does not inherit. `.set-panel { opacity: 0 }` or
    // `.modal-veil { opacity: 0 }` left the row reporting `opacity: 1` with its
    // full box, so `shown` was true, D1's geometric order was true, and this
    // tool could print OK over a settings panel nobody can see. Codex, at
    // `:413`. `effOpacity` is the product up to the root, computed in the page.
    //
    // THE THRESHOLD IS EXACTLY ZERO AND THAT IS DECLARED, NOT HIDDEN: an
    // ancestor at `opacity: 0.01` is invisible to a player and passes here, the
    // same way the row's own 0.01 always has. Refusing "faint" would need a
    // number nobody has ruled on; refusing "absent" needs none. The residue is
    // in the printed boundary block with ancestor clip and occlusion.
    const shown = fs.display !== 'none' && fs.visibility !== 'hidden' && fs.w > 0 && fs.h > 0
      && fs.opacity !== '0' && fs.effOpacity > 0;
    // eslint-disable-next-line no-unused-vars -- `shown` is the row's half; the
    // control's half is `ctrlState.shown` below, and both are printed.
    // ON SCREEN MEANS THE WHOLE BOX, AND THAT MEANS FOUR EDGES.
    //
    // Until 2026-08-22 this predicate named THREE: `top >= 0 && left >= 0 &&
    // bottom <= vp.h && top <= vp.h`. The RIGHT edge was never mentioned, while
    // the sentence this predicate backs — D3's "its box is wholly inside the
    // viewport" — claimed all four. That is the shape the house found five
    // times over the same night: a predicate narrower than the sentence it
    // backs, and the gap is `unknown`, not green (development.md, the same-door
    // clause: where the two disagree the PREDICATE wins and the sentence is
    // rewritten to it — here the predicate was the thing that was wrong, so it
    // is the predicate that moved).
    //
    // MEASURED, NOT REASONED, and all four edges were exercised rather than
    // three assumed. At `07ead53` + the dev merge, one plant per edge —
    // `position: relative` on the first Display row, +/-4000 px, entering as
    // file bytes in a copied real tree, the tool run WHOLE from the copy:
    //
    //   left -4000   CAUGHT   box printed, exit 1
    //   top  -4000   CAUGHT   box printed, exit 1
    //   top  +4000   CAUGHT   box printed, exit 1
    //   left +4000   UNCAUGHT `displayfirst: OK — 2 cells passed; 0 findings`, exit 0
    //
    // So the right edge was the only one missing — a census of four, not a
    // belief about three. All four plants are now in the corpus below, so this
    // predicate has been watched to fail at every edge it names.
    //
    // ONE TOLERANCE, ALL FOUR EDGES. The old form carried `+ 0.5` at the bottom
    // only; sub-pixel layout is not a property of one side of a box. EPS is
    // half a CSS pixel: it forgives rounding and nothing else — the plants
    // above miss by four thousand.
    const EPS = 0.5;
    // ONE JUDGEMENT, APPLIED TO TWO BOXES — THE ROW AND THE CONTROL INSIDE IT.
    //
    // The sweep Codex's `:419` finding earned: every predicate here was checked
    // against the noun in its own sentence, and D3 was the second one measuring
    // a CONTAINER. The row is `.set-row`, and the thing the player has to reach
    // is the toggle inside it. A control shifted, shrunk or faded WITHIN a row
    // that is still exactly where it belongs leaves every number in the row's
    // rect correct — which is the same way the duplicate hid from D2, and the
    // same way `column-reverse` hid from a DOM-order check.
    const boxState = (b) => {
      const edgeOk = {
        top: b.top >= -EPS,
        left: b.left >= -EPS,
        bottom: b.bottom <= r.vp.h + EPS,
        right: b.right <= r.vp.w + EPS,
      };
      const off = Object.keys(edgeOk).filter((k) => !edgeOk[k]);
      return {
        shown: b.display !== 'none' && b.visibility !== 'hidden' && b.w > 0 && b.h > 0
          && b.opacity !== '0' && b.effOpacity > 0,
        off,
        onscreen: off.length === 0,
      };
    };
    const rowState = boxState(fs);
    const ctrl = r.fsCtrl;
    const ctrlState = ctrl ? boxState(ctrl) : null;
    const offscreen = rowState.off;
    const onscreen = rowState.onscreen;
    // NOTHING SCROLLED MEANS NOTHING, AND THAT IS THREE AXES, NOT TWO.
    //
    // `docX` was READ off the page and never used. With the document scrolled
    // 500 px horizontally the read came back
    // `{"panelTop":0,"docY":0,"docX":500}` in both cells and this tool printed
    // "nothing scrolled", exit 0 — Marina, 2026-08-22.
    //
    // SIZED HONESTLY, and her sizing is kept rather than inflated: `.modal-veil`
    // is `position: fixed; inset: 0`, so a document scroll cannot today push
    // this row off screen, and the four-edge check above reads VIEWPORT
    // coordinates that already account for scroll. So this was a FALSE PRINTED
    // CLAIM, not a demonstrated false green. **On this house's own test that is
    // the worse of the two**: a false green fails the next person who plants
    // against it; a false sentence leaves a reader confidently wrong and
    // nothing ever fails. Same shape as the right edge — a predicate narrower
    // than the sentence it backs — and the predicate is again what moved.
    //
    // Watched, not asserted: corpus plant 11 scrolls the document 500 px right
    // through the real door and this predicate goes red naming `docX=500`.
    const unscrolled = r.scroll.panelTop === 0 && r.scroll.docY === 0 && r.scroll.docX === 0;
    const scrolls = `panelTop=${r.scroll.panelTop} docY=${r.scroll.docY} docX=${r.scroll.docX}`;
    const box = `x ${fs.left}..${fs.right}, y ${fs.top}..${fs.bottom}`;
    const ctrlBox = ctrl ? `x ${ctrl.left}..${ctrl.right}, y ${ctrl.top}..${ctrl.bottom}` : 'absent';
    const ctrlOk = !!ctrlState && ctrlState.shown && ctrlState.onscreen;
    if (!shown || !onscreen || !unscrolled || !ctrlOk) {
      fail(`FINDING D3/ink cell=${cell} key=${WANT} `
        + `row(visible=${shown} onscreen=${onscreen} effectiveOpacity=${fs.effOpacity} `
        + `offscreen-edges=[${offscreen.join(',')}] box=(${box})) `
        + `control(present=${!!ctrl} visible=${ctrlState ? ctrlState.shown : 'n/a'} `
        + `onscreen=${ctrlState ? ctrlState.onscreen : 'n/a'} `
        + `effectiveOpacity=${ctrl ? ctrl.effOpacity : 'n/a'} `
        + `offscreen-edges=[${ctrlState ? ctrlState.off.join(',') : ''}] box=(${ctrlBox})) `
        + `unscrolled=${unscrolled} scroll=(${scrolls}) of viewport ${r.vp.w}x${r.vp.h} `
        + `(row display:${fs.display} visibility:${fs.visibility}) `
        + '— first that a player has to scroll to, or cannot see, is not first, and a row a player '
        + 'can see is not a control a player can reach.');
    } else {
      note(`D3/ink ${cell} row box (${box}) AND control box (${ctrlBox}) both wholly inside viewport `
        + `${r.vp.w}x${r.vp.h} on all four edges, nothing scrolled (${scrolls}), effective opacity `
        + `${fs.effOpacity} row / ${ctrl.effOpacity} control through every ancestor`);
    }
  }
  return first;
}

async function main() {
  if (args.includes('--selftest')) {
    const plants = selftestPlants();
    if (!preflightSelftestPlantSites(plants)) {
      return finish('fail', 'selftest plant-site preflight failed');
    }
    const platformCode = await unsupportedPlatformPlant();
    if (platformCode) return finish('fail', 'unsupported-platform regression failed');
    if (process.platform !== 'linux') return refuseUnsupportedPlatform();
    return selftest(plants);
  }

  // THE MEASURED PLATFORM IS PART OF THE POPULATION. A Windows or macOS run
  // with CHROME set can otherwise paint every cell and print OK while the
  // boundary below calls that same run UNKNOWN. Refuse before importing the
  // server or resolving/launching a browser; nothing on an unsupported runtime
  // is evidence about this Linux-only instrument.
  if (process.platform !== 'linux') return refuseUnsupportedPlatform();

  // THE POPULATION IS SETTLED BEFORE ANYTHING BOOTS — no server, no browser, no
  // cells — because both refusals below are about there being nothing to measure.
  if (narrowingErrors.length) {
    for (const e of narrowingErrors) console.error(`displayfirst: ${e}`);
    console.error('              Exit 2, not 0: a narrowing flag that matches nothing selects an EMPTY');
    console.error('              population, and an empty population cannot tell you anything about the');
    console.error('              screen. Nothing was measured, so this is not a verdict.');
    expected = 0;
    return finish('unknown', narrowingErrors.join(' | '));
  }
  expected = SHAPES.length * TEXTS.length * DOORS.length;
  if (expected === 0) {
    console.error('displayfirst: the declared population is ZERO cells '
      + `(${SHAPES.length} shape(s) x ${TEXTS.length} text size(s) x ${DOORS.length} door(s)).`);
    console.error('              REFUSED, not passed. D0 compares `reached` against `expected`, and both');
    console.error('              derive from the same filter — at zero that comparison is self-satisfying');
    console.error('              and would print a green over a world with nothing in it.');
    return finish('unknown', 'declared population is zero cells');
  }

  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')));
  const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8474), open: false });
  // REGISTERED THE MOMENT IT EXISTS, not at the end: an error between here and
  // the last line leaves this server holding the event loop open, and a gate
  // that hangs prints nothing at all.
  live.server = s;
  const base = `http://localhost:${s.port}/`;
  console.log(`displayfirst — ${base} (root ${ROOT})`);
  console.log('DOOR: source tree over http in headless Chromium; the panel is opened by CLICKING the');
  console.log('      same controls a player clicks; text size set through the game\'s own settings');
  console.log('      store (?shotSettings); every box read with getBoundingClientRect() off the live');
  console.log('      page. "First" is GEOMETRIC — visible rows sorted by (top,left) — never DOM order.');
  if (onlyShape || onlyText) {
    console.log(`      NARROWED POPULATION (declared): shape=${onlyShape || 'all'} text=${onlyText || 'all'}`);
  }

  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('displayfirst: no Chrome/Chromium found (tried $CHROME, $CHROME_PATH and the usual paths).');
    console.error('              Exit 2, not 1: nothing was measured, so this is not a verdict about the screen.');
    await shutdown();
    return finish('unknown', 'no Chrome/Chromium found');
  }
  console.log(`      browser: ${browserPath}`);

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'displayfirst-', browser: browserPath, timeoutMs: 15000,
  });
  live.dropBrowser = dropBrowser;
  const cdp = connectCdp(wsUrl); live.cdp = cdp; await cdp.ready;

  const heights = [];

  for (const vp of SHAPES) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
      return r.result.value;
    };
    // A TRANSPORT DEATH IS NOT A PAGE THAT HAS NOT PAINTED YET. This loop used
    // to `.catch(() => false)` everything, which is right for "the selector is
    // not there yet" and wrong for "the socket is gone": it would poll a dead
    // connection until its own 25 s ran out and then report the wrong cause.
    // `e.cdp` marks the transport failures, and those are rethrown so the
    // STOPPED line names what actually happened.
    const until = async (x, w, ms = 25000) => {
      const t = Date.now();
      while (Date.now() - t < ms) {
        let got = false;
        try { got = await ev(x); } catch (e) { if (e && e.cdp) throw e; got = false; }
        if (got) return 1;
        await wait(150);
      }
      throw new Error(`timeout waiting for ${w}`);
    };

    console.log(`\n  ${vp.tag}`);
    for (const text of TEXTS) {
      const perDoor = {};
      for (const door of DOORS) {
        const cell = `${vp.tag} Text ${text} ${door}`;
        const shot = door === 'title' ? 'title' : 'combat';
        const url = `${base}?shot=${shot}&shotSettings=${encodeURIComponent(JSON.stringify({ textSize: text }))}`;
        await cdp.send('Page.navigate', { url }, S);
        const ready = door === 'title'
          ? `!!document.querySelector('button')`
          : `!!document.querySelector('.combat')`;
        await until(ready, `${shot} ${cell}`);
        await wait(700);
        const nav = await ev(door === 'title' ? OPEN_TITLE : OPEN_INRUN);
        if (nav && nav.err) {
          fail(`FINDING D0/population cell=${cell} door=unreachable — ${nav.err}. Nothing was measured here.`);
          reached++;
          perDoor[door] = null;
          continue;
        }
        await wait(400);
        const r = await ev(READ);
        reached++;
        perDoor[door] = judge(r, cell);
        if (r && r.panel && r.tab !== 'Display') {
          fail(`FINDING D0/population cell=${cell} tab=${r.tab} — the panel measured is not Display.`);
        }
        // THE MAX EDGE HAS TO ARRIVE, NOT JUST BE NAMED. Recorded per cell and
        // asserted after the loop: if XL does not render taller than M, the XL
        // cell is a second copy of the M cell wearing a different name, and the
        // "both edges" claim is decoration.
        if (r && r.fs) heights.push({ shape: vp.tag, door, text, h: r.fs.h });
        // THE DIAGNOSTIC MUST NOT KILL THE RUN, and it did until 2026-08-22.
        // Marina's plant: rename `#set-panel`. `judge()` does its job — it
        // records `FINDING D0/population panel=absent` — and then this line read
        // `r.domKeys.length` off `{panel:false}` and threw. Exit was 1 either
        // way, but the tool printed `displayfirst: STOPPED — the run ended on an
        // error`, and STOPPED is deliberately shaped to read as SILENCE:
        // *nothing was measured*. Something WAS measured, and the run also lost
        // its second cell. A diagnostic that converts a FAIL into a STOPPED is
        // an instrument lying about its own death — every field here is now
        // optional-read, because a read that came back empty is exactly when
        // this line matters most.
        console.log(`      ${cell}: tab=${r && r.panel ? r.tab : 'n/a (no #set-panel)'} `
          + `rows=${r && r.domKeys ? r.domKeys.length : 'n/a'} `
          + `fullscreenRowHeight=${r && r.fs ? r.fs.h : 'n/a'}`);
      }
      // D4 DOORS — the two surfaces must agree.
      if (perDoor.title !== undefined && perDoor.inrun !== undefined) {
        if (perDoor.title !== perDoor.inrun) {
          fail(`FINDING D4/doors shape=${vp.tag} text=${text} title=${perDoor.title} inrun=${perDoor.inrun} `
            + '— one renderer, two answers. The doors have stopped sharing renderSettings.');
        } else if (perDoor.title !== null) {
          note(`D4/doors ${vp.tag} Text ${text} — both doors first=${perDoor.title}`);
        }
      }
    }
    await cdp.send('Target.closeTarget', { targetId });
  }

  // D5 MAXEDGE — did Text XL actually arrive? A max edge that renders identically
  // to the middle of the domain was never measured.
  if (TEXTS.includes('M') && TEXTS.includes('XL')) {
    for (const vp of SHAPES) {
      for (const door of DOORS) {
        const m = heights.find((x) => x.shape === vp.tag && x.door === door && x.text === 'M');
        const xl = heights.find((x) => x.shape === vp.tag && x.door === door && x.text === 'XL');
        if (!m || !xl) {
          fail(`FINDING D5/maxedge shape=${vp.tag} door=${door} m=${m ? m.h : 'missing'} xl=${xl ? xl.h : 'missing'} `
            + '— one half of the edge pair never rendered, so the max edge is not evidence.');
        } else if (!(xl.h > m.h)) {
          fail(`FINDING D5/maxedge shape=${vp.tag} door=${door} m=${m.h} xl=${xl.h} `
            + '— Text XL did not render taller than Text M, so the text size did NOT land and the XL '
            + 'cell is the M cell under a different name.');
        } else {
          note(`D5/maxedge ${vp.tag} ${door} — Text XL landed: row ${m.h} px at M, ${xl.h} px at XL`);
        }
      }
    }
  } else {
    unk('D5/maxedge — the text-size population is narrowed by --only-text, so the max edge is NOT '
      + 'measured in this run. Declared, not silent; it counts toward nothing.');
  }

  if (reached !== expected) {
    fail(`FINDING D0/population reached=${reached} declared=${expected} — a check that quietly measures `
      + 'fewer cells than it declares prints a confident green over a smaller world.');
  } else {
    note(`D0/population reached=${reached} declared=${expected} `
      + `(${SHAPES.length} shape(s) x ${TEXTS.length} text size(s) x ${DOORS.length} doors)`);
  }

  await shutdown();

  return finish(bad ? 'fail' : 'ok');
}

function refuseUnsupportedPlatform() {
  expected = SHAPES.length * TEXTS.length * DOORS.length;
  const detail = `platform ${process.platform} is unsupported; displayfirst measures Linux headless Chromium only`;
  console.error(`displayfirst: ${detail}.`);
  console.error('              Exit 2, not 0: no server or browser was started and no screen cell was measured.');
  return finish('unknown', detail);
}

// ---------------------------------------------------------------------------
// --selftest — the same-door known-bad corpus.
//
// EIGHTEEN FILE-BYTE PLANTS, PLUS PLANT 15, WHICH IS A CONDITION AND NOT A FILE.
// THREE OF THEM ARE INVISIBLE TO test 61, and that is the argument for this file
// existing at all: plants 2, 3 and 4 leave `ROWS` and
// `categoryHandler('Display').rows` exactly as they are, so the engine suite
// stays green while the screen is wrong.
//
// PLANTS 6-9 are one per viewport edge — D3's four-edge sentence, watched to
// fail at each edge rather than asserted. PLANT 11 is the third scroll axis,
// which the predicate read and never used. PLANT 13 is the ancestor nobody
// asked about: `opacity: 0` on a door's `.modal-veil`, where every box is real,
// every box is first, and nobody can see any of it.
//
// PLANTS 16 AND 17 ARE THE CONTAINER SWEEP, and they are here because the same
// mistake had now been made three times in this one file: a predicate measuring
// the thing NEXT TO the noun its own sentence uses. 16 renders the Fullscreen
// control twice inside one row, which a row-count cannot see; 17 pushes the
// control 4000 px sideways inside a row that never moves, which a row-rect
// cannot see. Both were green before 2026-08-22.
//
// PLANTS 10, 12, 14 AND 15 ARE NOT ABOUT THE SCREEN AT ALL — they are about
// whether THIS TOOL still speaks when it cannot measure. 10 makes the subject
// unreachable and requires the BOUNDARY and a non-verdict-shaped state line to
// print anyway; 12 removes the panel and requires the run to reach its intended
// FAIL with both cells, rather than dying in its own diagnostic and reporting
// SILENCE; 14 blocks the renderer so a CDP command is sent and never answered,
// which is a HANG — the only one of these four that used to print nothing at
// all, not even a wrong thing; 15 hands the run a full pipe and a stalled reader
// and requires the terminal line to arrive whole.
//
// A COUNT IS NOT A GUARANTEE, and this corpus is the evidence for that sentence:
// plant 10 counted for a week while asserting the symptom instead of the thing
// it guards (see its own comment). A corpus counts plants; NOTHING IN THIS HOUSE
// COUNTS WHETHER A PLANT ASSERTS WHAT IT CLAIMS TO PROTECT. The check for that
// is mutation — break the guarded behaviour, leave the defect, and require the
// corpus to go red — and it is caught by hand today, twice tonight (this plant
// and #320's headline plant). Recorded here as a gap; not built here.
// ---------------------------------------------------------------------------
// The Fullscreen toggle's markup, byte-exact from `rowHtml` in
// src/ui/screens/settings.js. A PLAIN STRING, never a template literal: those
// bytes contain `${on ? 'on' : ''}` and friends, and a template literal would
// interpolate them here instead of matching them there — a plant whose
// find-string evaluates is a plant that never arms. doorplant turns an
// unmatched find-string into a hard red, so this is watched, not hoped.
function selftestPlants() {
  const settingsEol = readFileSync(join(ROOT, 'src/ui/screens/settings.js'), 'utf8').includes('\r\n') ? '\r\n' : '\n';
  const fsButton = [
    '      <button class="toggle ${on ? \'on\' : \'\'}" data-key="${r.key}"${r.type === \'action\' ? ` data-action="1" aria-label="${esc(r.label)}" aria-describedby="set-${r.key}-status"` : \'\'} role="switch" aria-checked="${on}">',
    '        <span class="knob"></span>',
    '      </button>',
  ].join(settingsEol);
  // Split the production line so the self-referential plant below does not
  // copy its own find bytes into this file. That leaves exactly one match: the
  // exit it is meant to mutate, which the cross-platform preflight can prove.
  const verdictReturn = ["  return finish(bad ? ", "'fail' : 'ok');"].join('');
  return [
    {
      // 1 — THE NEIGHBOURHOOD. `fullscreen` moves exactly ONE position. One step
      // of the threshold's own unit flips the verdict (Charter 2b). test 61
      // catches this one too, which is the point: on the obvious direction the
      // two agree.
      name: 'the row moves one position down the array',
      file: 'src/ui/screens/settings.js',
      find: [
        "  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',",
        "    note: 'Fill the screen when this browser supports app-controlled fullscreen.' },",
        "  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',",
        "    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },",
      ].join(settingsEol),
      replace: [
        "  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',",
        "    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },",
        "  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',",
        "    note: 'Fill the screen when this browser supports app-controlled fullscreen.' },",
      ].join(settingsEol),
      expectRed: /FINDING D1\/order .*first=useSprites want=fullscreen/,
    },
    {
      // 2 — THE RENDERER REORDERS AND THE TABLE DOES NOT. test 61 reads
      // categoryHandler().rows, which this never touches: GREEN there, wrong
      // here.
      name: 'the renderer reverses what the table hands it (test 61 stays green)',
      file: 'src/ui/screens/settings.js',
      find: '  return `${heading}<div class="set-card-list">${h.rows.map((r) => settingsRowHtml(settings, r)).join(\'\')}</div>`;',
      replace: '  return `${heading}<div class="set-card-list">${[...h.rows].reverse().map((r) => settingsRowHtml(settings, r)).join(\'\')}</div>`;',
      expectRed: /FINDING D1\/order .*want=fullscreen/,
    },
    {
      // 3 — CSS HIDES THE FIRST ROW. Array untouched, test 61 green, and the
      // first control a player can see is Character sprites.
      name: 'CSS hides the first row (test 61 stays green)',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { display: none !important; }',
      expectRed: /FINDING D1\/order .*first=useSprites want=fullscreen/,
    },
    {
      // 4 — THE DOM NEVER MOVES AND THE SCREEN REVERSES. This is the exact
      // shape that costs a reader a whole verdict: every box is where it always
      // was, and the parent changed. A DOM-order check is green here.
      name: 'the scroll parent reverses the visual order (DOM order unchanged)',
      file: 'styles/ui.css',
      append: '.set-panel { display: flex !important; flex-direction: column-reverse !important; }',
      expectRed: /FINDING D1\/order .*want=fullscreen/,
    },
    {
      // 5 — THE EMPTY EDGE. Display renders no rows. A check that only hunts for
      // "the first row is wrong" finds nothing here and reports green over a
      // blank screen.
      name: 'Display renders no rows at all (the empty edge)',
      file: 'src/ui/screens/settings.js',
      find: '  const rows = ROWS.filter((r) => r.cat === cat);',
      replace: '  const rows = ROWS.filter((r) => r.cat === cat && cat !== \'Display\');',
      expectRed: /FINDING D0\/population/,
    },
    // -----------------------------------------------------------------------
    // 6-9 — ONE PLANT PER VIEWPORT EDGE. D3's sentence claims the box is
    // "wholly inside the viewport"; these four are the census that says so
    // instead of believing it. Each pushes the Fullscreen row 4000 px past one
    // edge with `position: relative`, which leaves the ARRAY, the DOM and every
    // other box exactly where they were — the same shape as plant 4.
    //
    // Plant 6 is the one this corpus was missing on 2026-08-22: run against the
    // three-edge predicate it was UNCAUGHT, exit 0, `displayfirst: OK — 2 cells
    // passed; 0 findings`. Plants 7-9 were CAUGHT before the fix and are kept
    // anyway, because "the other three were fine" is a claim that rots the
    // moment someone rewrites the predicate — and it is exactly the claim I
    // could not have made honestly without running them.
    // -----------------------------------------------------------------------
    {
      name: 'EDGE RIGHT — the Fullscreen row sits 4000px off the right of the viewport',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { position: relative !important; left: 4000px !important; }',
      expectRed: /FINDING D3\/ink .*offscreen-edges=\[[^\]]*right/,
    },
    {
      name: 'EDGE LEFT — the Fullscreen row sits 4000px off the left of the viewport',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { position: relative !important; left: -4000px !important; }',
      expectRed: /FINDING D3\/ink .*offscreen-edges=\[[^\]]*left/,
    },
    {
      name: 'EDGE TOP — the Fullscreen row sits 4000px off the top of the viewport',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { position: relative !important; top: -4000px !important; }',
      expectRed: /FINDING D3\/ink .*offscreen-edges=\[[^\]]*top/,
    },
    {
      name: 'EDGE BOTTOM — the Fullscreen row sits 4000px off the bottom of the viewport',
      file: 'styles/ui.css',
      append: '.set-panel .set-row:first-child { position: relative !important; top: 4000px !important; }',
      expectRed: /FINDING D3\/ink .*offscreen-edges=\[[^\]]*bottom/,
    },
    {
      // 10 — THE UNREACHABLE SUBJECT, and this plant is not about the screen at
      // all: it is about whether THIS TOOL still speaks when it cannot measure.
      // The settings module throws on load, the page never boots, `until()`
      // times out and `main()` rejects. At `07ead53` that path printed a stack,
      // exit 1, ZERO boundary lines and ZERO verdict lines — one of Bjorn's 41
      // (#320). The expected red is the BOUNDARY SURVIVING, not a finding about
      // Display: a run that measured nothing must still say what it does not
      // cover, and must say so in a line `readVerdict` reads as silence.
      //
      // THE ASSERTION WAS THE SYMPTOM AND NOT THE THING, until 2026-08-22.
      // `expectRed` named only `STOPPED`, so the plant passed on a tool with no
      // boundary at all. Marina proved it with the exact mutation — settings
      // throws on load AND `printBoundary()` is a no-op — and this plant still
      // reported `CAUGHT`, `SELFTEST GREEN`, exit 0. So the 10/10 above this
      // line was TRUE and meant less than it read: nine plants guarded the
      // screen and the tenth guarded nothing it claimed to.
      //
      // Both outputs are required now. HONEST ABOUT WHAT "IN ORDER" BUYS HERE:
      // `doorplant` concatenates stdout then stderr, the boundary is stdout and
      // the state line is stderr, so the ordering in this regex is satisfied by
      // the concatenation and not by the run. What it actually requires — and
      // what plant 10 was missing — is that BOTH are present.
      //
      // ONE COSMETIC SEAM, NAMED RATHER THAN PATCHED: doorplant reports the
      // matching line with `out.split('\n').find(l => expectRed.test(l))`, which
      // is per-LINE, so a two-line assertion prints `red named:` with nothing
      // after it. The catch is real; only the excerpt is empty. Fixing it is a
      // one-line change in `tools/doorplant.mjs` — a file EVERY corpus in this
      // tree shares — and it is not going in behind a displayfirst fix. Filed,
      // not smuggled.
      //
      // WATCHED, BOTH EDGES, 2026-08-22. Mutation: this plant's own known-bad
      // PLUS `printBoundary()` made a no-op, entering as file bytes in a copied
      // real tree. Against the old one-line assertion: `CAUGHT`, `SELFTEST
      // GREEN`, exit 0 — the corpus counted a plant that did not require the
      // thing it exists to guard. Against this assertion:
      // `RED-FOR-WRONG-REASON`, expected-red NOT in output, `SELFTEST RED`,
      // exit 1.
      name: 'the settings module throws on load — the subject is unreachable (boundary must still print)',
      file: 'src/ui/screens/settings.js',
      append: 'throw new Error("planted: settings module fails on load");',
      expectRed: /BOUNDARY — printed on EVERY exit path[\s\S]*displayfirst: STOPPED — the run ended on an error/,
    },
    {
      // 11 — THE DOCUMENT IS SCROLLED SIDEWAYS. `docX` was read off the page and
      // never used, so this run printed "nothing scrolled" with the document
      // 500 px to the right — a FALSE SENTENCE, exit 0. The plant makes the
      // document wider than the viewport and holds it scrolled; `.modal-veil` is
      // fixed, so the row's own box stays legally on screen and D3's four-edge
      // half stays green. THAT IS THE POINT: only the scroll half can catch this,
      // which is why the scroll half had to name all three axes.
      name: 'the document is scrolled 500px right while the fixed panel stays put (docX)',
      file: 'src/ui/screens/settings.js',
      append: 'document.documentElement.style.minWidth = "3000px";\n'
        + 'setInterval(() => { if (window.scrollX !== 500) window.scrollTo(500, 0); }, 50);',
      expectRed: /FINDING D3\/ink .*unscrolled=false .*docX=500/,
    },
    {
      // 12 — THE PANEL ID IS RENAMED, and this plant is aimed at THIS TOOL's own
      // failure reporting, not at the screen. `judge()` correctly records
      // `D0/population panel=absent`; before 2026-08-22 the per-cell diagnostic
      // then read `r.domKeys.length` off `{panel:false}` and threw, so the run
      // printed `STOPPED` — the line shaped to say NOTHING WAS MEASURED — and
      // lost its second cell. The expected red requires the intended FAIL *and*
      // `across 2 cells`: a real finding, reported as a finding, with no cell
      // dropped on the way.
      name: 'the panel id is renamed — every read returns {panel:false} (must FAIL, not STOP)',
      file: 'src/ui/screens/settings.js',
      find: '<div class="set-panel" id="set-panel" role="tabpanel"',
      replace: '<div class="set-panel" id="set-panel-renamed" role="tabpanel"',
      expectRed: /displayfirst: FAIL — \d+ finding\(s\) across 2 cells/,
    },
    {
      // 13 — AN ANCESTOR IS TRANSPARENT AND EVERY BOX IS STILL THERE. The row
      // is `opacity: 1`, full size, first, on screen, nothing scrolled — and
      // the panel it lives on cannot be seen. Opacity does not inherit and does
      // not collapse the box, which is what separates it from the other two
      // hiding mechanisms this tool already refused. Codex found it at `:413`;
      // it is the same paint gap Bjorn carded on `armoury-arrival-figure`, where
      // `opacity:0` and `visibility:hidden` both passed 21/21.
      //
      // `.modal-veil` and not `.set-panel` on purpose: it is a DOOR-SPECIFIC
      // ancestor several levels above the row (settings.js builds it at the
      // title door, overlay.js in the run), so this plant only passes if the
      // walk really goes to the root rather than checking one parent.
      name: 'a door ancestor is fully transparent — every box is real and nobody can see it',
      file: 'styles/ui.css',
      append: '.modal-veil { opacity: 0 !important; }',
      expectRed: /FINDING D0\/population .*panelEffectiveOpacity=0/,
    },
    {
      // 14 — THE RENDERER NEVER YIELDS: a CDP command that is SENT AND NEVER
      // ANSWERED, with a perfectly healthy socket. This is Sunna's shape, from
      // the night her screenshot harness hung forever on `Page.captureScreenshot`
      // and two runs died having photographed four screens and said nothing
      // about the six they missed — *a hang is the same defect as a blank band
      // in a different coat.*
      //
      // WHY IT IS NOT PLANT 10 AGAIN. Plant 10's page THROWS: `until()` reaches
      // its own 25 s bound and the tool speaks. Here the page's main thread
      // spins, so `Runtime.evaluate` is queued behind it and the reply never
      // comes — `until()` is suspended INSIDE a single await and its own bound
      // never gets to run. Before the timeout landed, this ran until doorplant
      // killed it at 300 s: no boundary, no verdict, no exit code, nothing to
      // read. A close/error handler does not catch this one; only a deadline on
      // the command does.
      //
      // It costs its own 30 s. That wait IS the defect it plants, so it is not
      // tuned away — the same argument plant 10 makes about its 25 s.
      name: 'the page main thread never yields — a CDP command is sent and never answered',
      file: 'src/ui/screens/settings.js',
      append: 'const __planted = Date.now();\n'
        + '// planted: block the renderer so every CDP reply is queued behind a thread that never yields\n'
        + 'while (Date.now() - __planted < 120000) { /* spin */ }',
      expectRed: /BOUNDARY — printed on EVERY exit path[\s\S]*displayfirst: STOPPED — the run ended on an error[\s\S]*did not answer within \d+ ms/,
    },
    {
      // 15 is the piped consumer and is not a file edit — see `pipedOutputPlant`.
      //
      // 16 — THE CONTROL IS RENDERED TWICE INSIDE ITS OWN ROW. Every `.set-row`
      // still holds one key as far as `querySelector` is concerned, because
      // that call returns the FIRST match, so a check that counts ROWS reports
      // `count=1` over two Fullscreen toggles and D2's sentence — *exactly one
      // control* — is false while its predicate is true. Watched: UNCAUGHT
      // before, `displayfirst: OK`, exit 0.
      //
      // A move that copies is the defect D2 exists for, and this is the copy it
      // could not see.
      name: 'the Fullscreen control is rendered twice INSIDE its existing row (row count still 1)',
      file: 'src/ui/screens/settings.js',
      find: fsButton,
      replace: `${fsButton}${settingsEol}${fsButton}`,
      expectRed: /FINDING D2\/once .*controls=2 rows=1/,
    },
    {
      // 17 — THE ROW IS EXACTLY WHERE IT BELONGS AND THE CONTROL IS NOT. The
      // second half of the same sweep: D3 read the ROW's rect, and a toggle
      // pushed 4000 px sideways inside a `position: relative` shift leaves that
      // rect untouched. Same shape as plant 4, one level down — every number
      // the check reads is correct and the player cannot reach the control.
      name: 'the Fullscreen CONTROL sits 4000px right while its row does not move',
      file: 'styles/ui.css',
      append: '.set-panel .set-row [data-key="fullscreen"] { position: relative !important; left: 4000px !important; }',
      expectRed: /FINDING D3\/ink .*control\(present=true .*onscreen=false/,
    },
    {
      // 18 — A FATAL, THEN A GREEN, IN ONE RUN. The only plant here whose
      // known-bad is planted in THIS FILE, because the subject is this file's
      // own exit contract.
      //
      // `process.exit()` was doing a second job nobody wrote down: it made an
      // exit FINAL. `process.exitCode` is a VARIABLE, so once four seats were
      // told to switch today, a run that had already died could have its code
      // set back to 0 by a later path and print a green. Codex found the shape
      // on #322; this requires it to stay impossible here.
      //
      // WATCHED, BOTH EDGES, 2026-08-22, before the latch existed: with the
      // latch removed the same mutation printed `displayfirst: OK — 0 checks
      // passed` after its own STOPPED line and exited 0 — a false green over a
      // dead run, which is strictly worse than the truncation the switch was
      // made to fix. With the latch: exit 1, and the refusal is printed by name.
      name: 'a fatal verdict is followed by a green in the same run (the exit code must not be overwritten)',
      file: 'tools/displayfirst.mjs',
      find: verdictReturn,
      replace: "  finish('stopped', 'planted: a fatal arrived first');\n" + verdictReturn,
      expectRed: /displayfirst: SECOND VERDICT REFUSED — this run already ended on STOPPED \(exit 1\)/,
    },
    {
      // 19 — THE CURRENT SETTINGS SCROLLER MOVES WHILE THE FULLSCREEN ROW
      // remains wholly on screen. The mobile-settings redesign made
      // `#set-panel` the scroll owner for both doors; before that replay the
      // title door scrolled `.modal` and the in-run door scrolled
      // `.overlay-body`. This plant holds the current contract and, more
      // importantly, makes another scroll-owner move fail loudly instead of
      // letting `panelTop=0` print "nothing scrolled" over a different
      // element's non-zero offset.
      name: 'the current settings panel is scrolled four pixels while Fullscreen remains on screen',
      file: 'src/ui/screens/settings.js',
      append: 'setInterval(() => {\n'
        + '  const __displayFirstPanel = document.querySelector("#set-panel");\n'
        + '  if (__displayFirstPanel && __displayFirstPanel.scrollHeight > __displayFirstPanel.clientHeight) {\n'
        + '    __displayFirstPanel.scrollTop = 4;\n'
        + '  }\n'
        + '}, 50);',
      expectRed: /FINDING D3\/ink .*unscrolled=false .*panelTop=4/,
    },
  ];
}

// ANCHORS ARE PART OF THE CORPUS, EVEN ON A PLATFORM THAT CANNOT RUN ITS
// BROWSER DOOR. Windows correctly refuses the rendered verdict, but that used
// to let three retired mutation anchors sit undetected until a Linux hand-run.
// Read every plant site before the platform boundary: append-only plants prove
// their target exists; replacement plants must match exactly once, the same
// arming rule doorplant enforces before it boots Chromium.
function preflightSelftestPlantSites(plants) {
  let anchored = 0;
  let appendOnly = 0;
  let drifted = 0;
  for (const [index, plant] of plants.entries()) {
    let source;
    try {
      source = readFileSync(join(ROOT, plant.file), 'utf8');
    } catch (err) {
      fail(`selftest plant ${index + 1}: PLANT SITE DRIFTED — ${plant.file} could not be read (${err.message}).`);
      drifted++;
      continue;
    }
    if (typeof plant.find === 'string') {
      const matches = source.split(plant.find).length - 1;
      if (matches !== 1) {
        fail(`selftest plant ${index + 1}: PLANT SITE DRIFTED — ${plant.file} contains the exact find bytes `
          + `${matches} time(s), want exactly 1 (${plant.name}).`);
        drifted++;
      } else {
        anchored++;
      }
    } else if (typeof plant.append === 'string') {
      appendOnly++;
    } else {
      fail(`selftest plant ${index + 1}: PLANT SITE DRIFTED — ${plant.name} has neither find/replace nor append bytes.`);
      drifted++;
    }
  }
  if (drifted) return false;
  console.log(`  CAUGHT  selftest plant-site preflight: ${anchored} exact replacement anchor(s), `
    + `${appendOnly} append target(s), 0 drifted — checked before the platform boundary.`);
  return true;
}

async function selftest(plants = selftestPlants()) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // NARROWED ON PURPOSE AND SAID OUT LOUD: eighteen whole-tool browser runs plus
  // a clean run is nineteen browser boots. The population is one shape and one
  // text size, both doors — the DOOR is unnarrowed, which is the axis the corpus
  // is about. Plant 10 spends its own 25 s waiting for a page that never boots
  // and plant 14 its own 30 s waiting for a reply that never comes; those waits
  // ARE the defects they plant, so they are not tuned away. Plant 15 boots no
  // browser at all — its subject is the exit path, not the screen.
  const code = await doorSelftest({
    tool: 'displayfirst.mjs',
    args: ['--only-shape', '1440x860', '--only-text', 'M', '--port', '8475'],
    plants,
    timeoutMs: 300000,
  });
  const filePlantCount = plants.length;
  // THE FIFTEENTH KNOWN-BAD IS NOT A FILE EDIT, so it cannot live in the array
  // above: doorplant runs the tool with `spawnSync`, which drains both pipes
  // continuously, and a reader that always drains is the one consumer this
  // defect cannot reach. See `pipedOutputPlant`.
  const flushCode = await pipedOutputPlant();
  const flushUnknown = flushCode === null;
  const flushLabel = flushUnknown ? 'UNKNOWN' : (flushCode ? 'RED' : 'green');
  // SERVER TEARDOWN IS A THIRD EXIT-DOOR CLAIM. It is browser-free and compares
  // this exact tool with a mutant whose one server-close line is removed; see
  // `serverClosePlant`. The two processes print the same UNKNOWN verdict and
  // exit 2 if the three-second forced-exit backstop is allowed to decide, so the
  // plant requires the fixed process to drain before an earlier outer deadline
  // while the mutant is still alive at that deadline.
  const serverCloseCode = await serverClosePlant();
  const serverCloseLabel = serverCloseCode ? 'RED' : 'green';
  const total = code || serverCloseCode || (flushUnknown ? 2 : flushCode);
  // DOORPLANT'S OWN VERDICT LINE COVERS THE WHOLE FILE-BYTE CORPUS AND IS
  // PRINTED BEFORE THE TWO EXIT-DOOR PLANTS RUN. Left as it is — it is that
  // harness's line about its own corpus —
  // and closed here instead, because a run that printed `SELFTEST GREEN` and
  // then failed either exit-door plant would be a tool contradicting itself,
  // which is the whole complaint this file makes about everything else.
  if (code || serverCloseCode || (!flushUnknown && flushCode)) {
    console.error(`displayfirst: SELFTEST RED — ${filePlantCount} file-byte plants (doorplant, above) ${code ? 'RED' : 'green'}, `
      + `plant 15 the piped consumer ${flushLabel}, server-close regression ${serverCloseLabel}. `
      + `The doorplant line above covers the ${filePlantCount} file-byte plants only.`);
  } else if (flushUnknown) {
    console.error(`displayfirst: SELFTEST UNKNOWN — ${filePlantCount} file-byte plants and the server-close `
      + 'regression were green, but plant 15 the piped consumer was not run on this platform. '
      + 'This is not a green verdict.');
  } else {
    console.log(`displayfirst: SELFTEST GREEN — ${filePlantCount} file-byte plants (doorplant, above), `
      + 'plant 15 the piped consumer, and the browser-free server-close regression.');
  }
  // The corpus run is an exit path too, so it prints the boundary like every
  // other one. doorplant owns the verdict line here; this owns the limits.
  printBoundary();
  process.exitCode = total;
  forceExitAfterDrain(total);
  return total;
}

// ---------------------------------------------------------------------------
// PLANT 15 — THE PIPED CONSUMER. Its known-bad is not a defect in the game and
// not a defect in a file: it is a CONDITION THE CALLER SUPPLIES — stdout is a
// pipe whose buffer is already full and whose reader has stalled. That is an
// ordinary CI log collector, a `| tee`, a wrapper reading two streams.
//
// WHAT IT GUARDS: the complete terminal line, on the exit path this tool
// promises to print one on. `process.exit()` does not drain a queued write, so
// before 2026-08-22 this gate could print its boundary and its verdict into a
// pipe and die with both still in the queue — silence, from the tool whose
// entire argument is that silence is the defect.
//
// IT CARRIES ITS OWN BOTH EDGES, EVERY RUN, and that is deliberate. Plant 10
// counted for a week while asserting the symptom instead of the thing it
// guards, and the check for that is mutation. So this plant MUTATES THE REAL
// TOOL BACK — `process.exitCode` + return replaced by `process.exit(code)`, the
// pre-fix bytes — and requires the mutant to LOSE the line before it will
// believe the fixed tool KEPT it. A run where both survive means the pipe never
// filled and the plant proved nothing; that is a hard red here, not a pass.
//
// THE DOOR: a real subprocess (`node tools/displayfirst.mjs --only-shape
// 1440x680`, the cheap exit-2 path — no browser, no server) run from a COPY of
// tools/, its stdout and stderr joined onto one pipe by the shell, read by a
// consumer that sleeps 400 ms first. The 256 KiB of filler is written by the
// WRAPPER, not by the tool: the plant supplies the full pipe, never fake output
// from the subject.
//
// MEASURED, so the sizing is not a mood: with the reader stalled, the mutant
// loses the line 20/20 at 64 KiB, 256 KiB and 1 MiB, and 0/20 at 1 KiB; the
// fixed form keeps it 0/20 truncated at every one of those sizes. This tool's
// own largest run is 5,207 bytes, well under a Linux pipe buffer — which is why
// the exposure is a full-pipe consumer and not this tool's verbosity, and why
// the plant fills the pipe rather than making the tool shout.
// ---------------------------------------------------------------------------
const FLUSH_FILL_BYTES = 262144;
const FLUSH_RUNS = 5;

async function pipedOutputPlant() {
  const { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');

  console.log('');
  console.log(`  plant 15 — THE PIPED CONSUMER (${FLUSH_RUNS} repetitions, both edges each run)`);
  if (process.platform === 'win32') {
    unk('plant 15 — NOT RUN on win32: the door is a POSIX shell pipeline. Declared, not skipped '
      + 'quietly; on Windows the drain behaviour of this exit path is `unknown`.');
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), 'flushdoor-'));
  try {
    cpSync(join(ROOT, 'tools'), join(dir, 'tools'), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.png$/.test(src),
    });
    // THE MUTANT IS THE REAL FILE WITH THE FIX TAKEN OUT, and the count is
    // checked: a find-string that has drifted is a hard red, never a skip.
    const real = readFileSync(join(ROOT, 'tools/displayfirst.mjs'), 'utf8');
    // Both find-strings carry real newlines, so they match the CODE and not the
    // two escaped copies of themselves sitting a few lines below this one.
    const FIND_FINISH = '  process.exitCode = code;\n  forceExitAfterDrain(code);\n  return code;\n}';
    const FIND_SELFTEST = '  process.exitCode = total;\n  forceExitAfterDrain(total);\n  return total;\n}';
    const missing = [
      real.includes(FIND_FINISH) ? null : 'finish()',
      real.includes(FIND_SELFTEST) ? null : 'selftest()',
    ].filter(Boolean);
    if (missing.length) {
      fail(`plant 15: PLANT SITE DRIFTED — the drain-safe exit shape is gone from ${missing.join(' and ')}, `
        + 'so the pre-fix mutant could not be built. A corpus that silently stops running is the defect: '
        + 'nothing below this line would have been evidence.');
      return 1;
    }
    const mutant = real
      .split(FIND_FINISH).join('  process.exit(code);\n}')
      .split(FIND_SELFTEST).join('  process.exit(total);\n}');
    writeFileSync(join(dir, 'tools/displayfirst.MUTANT.mjs'), mutant);
    writeFileSync(join(dir, 'flushdoor.mjs'), [
      "// The consumer's side of the door: fill the pipe, THEN run the tool whole.",
      "import { pathToFileURL } from 'node:url';",
      "import { resolve } from 'node:path';",
      'const tool = resolve(process.argv[2]);',
      'process.stdout.write(`${\'#\'.repeat(Number(process.argv[3]))}\\n`);',
      "process.argv = [process.argv[0], tool, '--only-shape', '1440x680'];",
      'await import(pathToFileURL(tool));',
      '',
    ].join('\n'));

    const runOnce = (toolRel) => {
      const cmd = `"${process.execPath}" flushdoor.mjs ${toolRel} ${FLUSH_FILL_BYTES} 2>&1 `
        + '| ( sleep 0.4; cat ) > piped.txt';
      spawnSync('/bin/sh', ['-c', cmd], { cwd: dir, encoding: 'utf8', timeout: 60000 });
      const out = readFileSync(join(dir, 'piped.txt'), 'utf8');
      return {
        whole: out.length >= FLUSH_FILL_BYTES,
        line: /^displayfirst: UNKNOWN — nothing was measured \(.+\)\.$/m.test(out),
        bytes: out.length,
      };
    };

    let bad15 = 0;
    for (let i = 1; i <= FLUSH_RUNS; i++) {
      const m = runOnce('tools/displayfirst.MUTANT.mjs');
      const f = runOnce('tools/displayfirst.mjs');
      // THE ORDER OF THESE THREE IS THE ARGUMENT. The fixed run must be whole;
      // the mutant must have LOST the line; and the mutant must have lost BYTES
      // to it, which is how this run says the pipe really filled rather than
      // asserting that it did. An empty result and a zero look identical and
      // mean the opposite.
      if (!f.whole || !f.line) {
        fail(`plant 15 run ${i}: THE FIX DID NOT HOLD — the terminal line was truncated by a full pipe `
          + `(${f.bytes} B of ${FLUSH_FILL_BYTES} B read, terminal line ${f.line ? 'present' : 'GONE'}). `
          + 'A gate that promises a line on every exit path did not print one.');
        bad15++; continue;
      }
      if (m.line) {
        fail(`plant 15 run ${i}: UNCAUGHT — the pre-fix mutant (process.exit) KEPT its terminal line `
          + `through a full pipe (${m.bytes} B read), so this plant does not distinguish the fix from `
          + 'its absence. Read nothing into the fixed run beside it.');
        bad15++; continue;
      }
      if (m.bytes >= f.bytes) {
        fail(`plant 15 run ${i}: THE PIPE NEVER FILLED — the mutant read ${m.bytes} B against the `
          + `fixed run's ${f.bytes} B, so nothing was queued at exit and this run is evidence of nothing.`);
        bad15++; continue;
      }
      note(`plant 15 run ${i}/${FLUSH_RUNS} — mutant LOST the terminal line and stopped at ${m.bytes} B `
        + `(the pipe buffer); fixed delivered ${f.bytes} B with the terminal line whole.`);
    }
    if (bad15) {
      console.error(`  RED  plant 15 — ${bad15} of ${FLUSH_RUNS} repetition(s) failed.`);
      return 1;
    }
    console.log(`  CAUGHT  "the terminal line survives a full pipe" -> ${FLUSH_RUNS}/${FLUSH_RUNS} `
      + 'repetitions, mutant truncated every time, fixed whole every time.');
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// SERVER-CLOSE REGRESSION — WHY THE BACKSTOP IS NOT THE TEST.
//
// Removing shutdown()'s `server.server.close(...)` does not change the terminal
// line or exit code: the live HTTP server keeps Node open until
// forceExitAfterDrain() calls process.exit(2) three seconds later. That is the
// exact false green the routed review found — a backstop hiding a teardown
// regression while every string assertion still passes.
//
// THE DOOR is the whole real tool in a copied tools/ tree. browser.mjs is
// replaced only at its boundary so resolveBrowser() returns null: main() still
// opens the real tools/serve.mjs HTTP server, takes its real no-browser shutdown
// path, prints its real UNKNOWN line, and returns through finish(). No Chrome is
// launched. The fixed copy must exit 2 before SERVER_CLOSE_DEADLINE_MS; the
// exact one-line mutant must still be alive when that earlier outer deadline
// kills it. Waiting for the mutant's three-second backstop would make fixed and
// mutant look identical, which is the defect this plant exists to prevent.
// ---------------------------------------------------------------------------
const SERVER_CLOSE_DEADLINE_MS = 2000;

async function serverClosePlant() {
  const { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');

  console.log('');
  console.log(`  server-close regression — fixed-vs-mutant, browser-free, ${SERVER_CLOSE_DEADLINE_MS} ms outer deadline`);
  const dir = mkdtempSync(join(tmpdir(), 'displayfirst-server-close-'));
  try {
    cpSync(join(ROOT, 'tools'), join(dir, 'tools'), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.png$/.test(src),
    });
    const tool = join(dir, 'tools', 'displayfirst.mjs');
    const real = readFileSync(tool, 'utf8');
    const canonicalReal = real.replace(/\r\n/g, '\n');
    // A MULTI-LINE SITE ASSEMBLED FROM ROWS. A one-line literal appears once in
    // shutdown() and once inside its own quoted declaration here, so counting
    // that string reports two sites before the plant even runs. The assembled
    // block is present contiguously only in production code; its rows are split
    // by this array syntax here. This is the same anti-self-match shape the
    // piped-output plant above uses for its newline-bearing anchors.
    const FIND_CLOSE = [
      '    // `serve()` returns a record; the Node HTTP server is its `server` member.',
      '    // Wait for its close callback so the event loop can drain without the',
      '    // three-second forced-exit backstop becoming the normal shutdown path.',
      '    if (server?.server) await new Promise((resolveClose) => server.server.close(resolveClose));',
    ].join('\n');
    const MUTANT_CLOSE = [
      '    // `serve()` returns a record; the Node HTTP server is its `server` member.',
      '    // Wait for its close callback so the event loop can drain without the',
      '    // three-second forced-exit backstop becoming the normal shutdown path.',
      '    /* planted: HTTP server deliberately left open; only the three-second backstop can exit */',
    ].join('\n');
    if (canonicalReal.split(FIND_CLOSE).length !== 2) {
      fail('server-close regression: PLANT SITE DRIFTED — shutdown() no longer carries its complete awaited '
        + 'server-close block exactly once, so the teardown mutant could not be built unambiguously.');
      return 1;
    }
    writeFileSync(join(dir, 'tools', 'displayfirst.MUTANT.mjs'), canonicalReal.replace(FIND_CLOSE, MUTANT_CLOSE));
    writeFileSync(join(dir, 'tools', 'browser.mjs'), [
      '// Browser boundary for the server-close regression: no browser is launched.',
      'export function resolveBrowser() { return null; }',
      "export async function launchBrowser() { throw new Error('server-close regression must not launch a browser'); }",
      '',
    ].join('\n'));

    const run = (name) => {
      const started = Date.now();
      const result = spawnSync(process.execPath, [join('tools', name),
        '--only-shape', '1440x860', '--only-text', 'M', '--port', '0'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: SERVER_CLOSE_DEADLINE_MS,
        maxBuffer: 4 * 1024 * 1024,
      });
      return { ...result, elapsed: Date.now() - started, output: `${result.stdout || ''}\n${result.stderr || ''}` };
    };

    const fixed = run('displayfirst.mjs');
    const mutant = run('displayfirst.MUTANT.mjs');
    const fixedWhole = fixed.status === 2
      && /displayfirst: UNKNOWN — nothing was measured \(no Chrome\/Chromium found\)\./.test(fixed.output)
      && !fixed.error;
    const mutantHeld = mutant.status === null && mutant.error && mutant.error.code === 'ETIMEDOUT';
    if (!fixedWhole) {
      fail(`server-close regression: FIXED TOOL DID NOT DRAIN — status=${fixed.status}, error=${fixed.error?.code || 'none'}, `
        + `elapsed=${fixed.elapsed} ms. Expected exit 2 with the complete UNKNOWN line before the outer deadline.`);
      return 1;
    }
    if (!mutantHeld) {
      fail(`server-close regression: MUTANT WAS NOT DISTINGUISHED — status=${mutant.status}, `
        + `error=${mutant.error?.code || 'none'}, elapsed=${mutant.elapsed} ms. Removing server.close must leave `
        + 'the real HTTP server alive past the outer deadline; an ordinary exit means the backstop can hide a reversion.');
      return 1;
    }
    console.log(`  CAUGHT  fixed exited 2 with its complete UNKNOWN line in ${fixed.elapsed} ms; mutant still held `
      + `the HTTP server at ${mutant.elapsed} ms and was killed before the three-second backstop.`);
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// UNSUPPORTED-PLATFORM REGRESSION — NO SERVER, NO BROWSER, BOTH EDGES.
//
// The child process changes only Node's configurable `process.platform` value,
// then imports this tool normally. Its copied serve/browser boundaries throw if
// called, so exit 2 plus the explicit UNKNOWN line proves the refusal happened
// before either boot path. The mutant removes both production guard sites; it
// must reach the throwing server boundary and exit 1. A fixed-only assertion
// would not distinguish an early refusal from a late one.
// ---------------------------------------------------------------------------
async function unsupportedPlatformPlant() {
  const { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { spawnSync } = await import('node:child_process');

  console.log('');
  console.log('  unsupported-platform regression — fixed-vs-mutant, browser-free darwin child');
  const dir = mkdtempSync(join(tmpdir(), 'displayfirst-platform-'));
  try {
    cpSync(join(ROOT, 'tools'), join(dir, 'tools'), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.png$/.test(src),
    });
    const tool = join(dir, 'tools', 'displayfirst.mjs');
    const real = readFileSync(tool, 'utf8').replace(/\r\n/g, '\n');
    const FIND_PLATFORM_GUARD = [
      '  if (process.platform !==',
      " 'linux') return refuseUnsupportedPlatform();",
    ].join('');
    const guardCount = real.split(FIND_PLATFORM_GUARD).length - 1;
    if (guardCount !== 2) {
      fail(`unsupported-platform regression: PLANT SITE DRIFTED — expected two production guard sites, `
        + `found ${guardCount}; the no-boot mutant could not be built unambiguously.`);
      return 1;
    }
    writeFileSync(join(dir, 'tools', 'displayfirst.MUTANT.mjs'),
      real.split(FIND_PLATFORM_GUARD).join('  /* planted: unsupported platform allowed through */'));
    writeFileSync(join(dir, 'tools', 'serve.mjs'), [
      'export async function serve() {',
      "  throw new Error('UNSUPPORTED REGRESSION SERVER BOOTED');",
      '}',
      '',
    ].join('\n'));
    writeFileSync(join(dir, 'tools', 'browser.mjs'), [
      "export function resolveBrowser() { throw new Error('UNSUPPORTED REGRESSION BROWSER RESOLVED'); }",
      "export async function launchBrowser() { throw new Error('UNSUPPORTED REGRESSION BROWSER LAUNCHED'); }",
      '',
    ].join('\n'));
    const wrapper = join(dir, 'platform-child.mjs');
    writeFileSync(wrapper, [
      "Object.defineProperty(process, 'platform', { value: 'darwin' });",
      "await import('./tools/' + process.argv[2]);",
      '',
    ].join('\n'));

    const run = (name) => {
      const result = spawnSync(process.execPath, [wrapper, name,
        '--only-shape', '1440x860', '--only-text', 'M', '--port', '0'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 4 * 1024 * 1024,
      });
      return { ...result, output: `${result.stdout || ''}\n${result.stderr || ''}` };
    };

    const fixed = run('displayfirst.mjs');
    const mutant = run('displayfirst.MUTANT.mjs');
    const fixedUnknown = fixed.status === 2 && !fixed.error
      && /displayfirst: UNKNOWN — nothing was measured \(platform darwin is unsupported; displayfirst measures Linux headless Chromium only\)\./.test(fixed.output)
      && !/UNSUPPORTED REGRESSION (?:SERVER|BROWSER)/.test(fixed.output)
      && !/displayfirst: OK/.test(fixed.output);
    const mutantBooted = mutant.status === 1 && !mutant.error
      && /UNSUPPORTED REGRESSION SERVER BOOTED/.test(mutant.output)
      && /displayfirst: STOPPED/.test(mutant.output);
    if (!fixedUnknown) {
      fail(`unsupported-platform regression: FIXED CHILD DID NOT REFUSE BEFORE BOOT — status=${fixed.status}, `
        + `error=${fixed.error?.code || 'none'}. Expected explicit UNKNOWN/2 with neither server nor browser marker.`);
      return 1;
    }
    if (!mutantBooted) {
      fail(`unsupported-platform regression: MUTANT WAS NOT DISTINGUISHED — status=${mutant.status}, `
        + `error=${mutant.error?.code || 'none'}. Removing the guards must reach the throwing server boundary.`);
      return 1;
    }
    console.log('  CAUGHT  fixed darwin child exited UNKNOWN/2 before boot; guardless mutant reached serve() and STOPPED/1.');
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// THE FAILURE PATH GOES THROUGH THE SAME DOOR AS THE SUCCESS PATH. This line
// used to be `console.error(stack); process.exit(1)` — an exit above the
// boundary print, which is the #320 shape. The stack is still printed, because
// a boundary is not a diagnosis; what changed is that the boundary and a
// non-verdict-shaped state line now follow it.
main().catch(async (e) => {
  console.error(`displayfirst: ${(e && e.stack) || e}`);
  // CLOSE FIRST, THEN SPEAK. The server and the browser this run opened are
  // still up on every thrown path, and with `process.exit()` gone they would
  // hold the loop open forever — the STOPPED line would print and the gate
  // would still never return. Teardown never throws (see `shutdown`).
  await shutdown();
  finish('stopped', (e && e.message) || String(e));
});
