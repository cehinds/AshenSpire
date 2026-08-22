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
//   D2 ONCE     exactly one `fullscreen` control is in the panel. A move that
//               copies is not a move.
//   D3 INK      that row is on screen ON ARRIVAL — non-zero box, not
//               `display:none` / `visibility:hidden`, and its box is wholly
//               inside the viewport ON ALL FOUR EDGES, with nothing scrolled ON
//               ALL THREE AXES (panel, document Y, document X).
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
//   · THE OTHER NINETEEN ROWS. Only position 1 has an ask attached to it, so
//     only position 1 is held. The rest may be reordered freely.
//   · Linux headless Chromium, two shapes, two text sizes, two doors. Windows
//     and macOS are `unknown` here as everywhere else in this repo.
//   · IT IS NOT WIRED INTO ci.yml, AND MY STATED REASON HAS EXPIRED. It read
//     "`ci.yml` is open under #294 and adding a step mid-flight changes the
//     census under its author's feet." #294 has LANDED — `dev` is `8b5c030` —
//     so that sentence is no longer true and I am not keeping a dead reason to
//     hold a live position. The reason NOW is the defect above it: a gate that
//     could print green having measured ZERO cells would make the census say
//     `covered` about a check that can be empty. That refusal landed today, in
//     this file. THE WIRING IS ITS OWN CARD and is not smuggled in behind a
//     fix — Marina's ruling, 2026-08-22. Until it is wired this gate is a seat's
//     hand-run, which under SOP 2's silence guard is `unknown` between runs,
//     not green.
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
  console.log('  · Only position 1 is held. The other nineteen Display rows may be reordered freely.');
  console.log('  · D3 judges the Fullscreen row\'s own box against all four viewport edges. It says');
  console.log('    nothing about whether an ANCESTOR clips it, or whether another element covers it.');
  console.log('  · Linux headless Chromium only; windows-latest and macos-latest are `unknown`.');
  console.log('  · NOT WIRED INTO ci.yml (see the header) — between hand-runs this is `unknown`.');
  if (expected === null) {
    console.log('  · this run measured NO cells of its own — it is the corpus harness, and what it');
    console.log('    reports is whether the plants went red, never whether the screen is right.');
  } else {
    console.log(`  · cells measured: ${reached} of ${expected} declared.`);
  }
  if (unknown) console.log(`  · ${unknown} check(s) resolved UNKNOWN in this run and counted toward nothing.`);
  console.log('');
}

/** The ONE exit. Every path — pass, fail, no-browser, thrown — ends here. */
function finish(state, detail) {
  printBoundary();
  if (state === 'ok') {
    console.log(`displayfirst: OK — ${passes} checks passed`);
    process.exit(0);
  }
  if (state === 'fail') {
    console.error(`displayfirst: FAIL — ${bad} finding(s) across ${reached} cells`);
    process.exit(1);
  }
  // NOT VERDICT-SHAPED, ON PURPOSE — see the block above. `readVerdict` returns
  // {error:'none'} for both of these, which is silence, which blocks.
  if (state === 'unknown') {
    console.error(`displayfirst: UNKNOWN — nothing was measured (${detail}).`);
    process.exit(2);
  }
  console.error(`displayfirst: STOPPED — the run ended on an error after ${reached}`
    + `${expected === null ? '' : ` of ${expected}`} cell(s) (${detail}). Nothing above is a verdict.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// The page-side read. Returns the VISIBLE Display rows in GEOMETRIC order, each
// with the key of the control it carries, plus the fullscreen row's own box and
// the viewport it was measured in.
// ---------------------------------------------------------------------------
const READ = `(() => {
  const panel = document.querySelector('#set-panel');
  if (!panel) return { panel: false };
  const rows = [...panel.querySelectorAll('.set-row')].map((row) => {
    const ctrl = row.querySelector('[data-key]');
    const b = row.getBoundingClientRect();
    const cs = getComputedStyle(row);
    return {
      key: ctrl ? ctrl.dataset.key : null,
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
    && r.w > 0 && r.h > 0 && r.opacity !== '0');
  // GEOMETRIC ORDER, not DOM order. This is the whole reason the tool exists.
  visible.sort((a, b2) => (a.top - b2.top) || (a.left - b2.left));
  const fs = rows.filter((r) => r.key === ${JSON.stringify(WANT)});
  return {
    panel: true,
    tab: (document.querySelector('.set-tab.on') || { dataset: {} }).dataset.member,
    domKeys: rows.map((r) => r.key),
    visibleKeys: visible.map((r) => r.key),
    first: visible.length ? visible[0] : null,
    fsCount: fs.length,
    fs: fs[0] || null,
    scroll: { panelTop: panel.scrollTop, docY: window.scrollY, docX: window.scrollX },
    vp: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
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
  const t = [...document.querySelectorAll('button')].find((x) => /^settings$/i.test(x.textContent.trim()));
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
    fail(`FINDING D0/population cell=${cell} visible=0 dom=${r.domKeys.length} — the Display panel `
      + 'renders NO visible control rows. Nothing here is evidence about ordering.');
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
  if (r.fsCount !== 1) {
    fail(`FINDING D2/once cell=${cell} count=${r.fsCount} want=1 — the row must have MOVED, not been copied.`);
  } else {
    note(`D2/once ${cell} count=1`);
  }
  // D3 INK — on screen with nothing scrolled.
  const fs = r.fs;
  if (!fs) {
    fail(`FINDING D3/ink cell=${cell} key=${WANT} present=false — the Fullscreen row is not in the panel at all.`);
  } else {
    const shown = fs.display !== 'none' && fs.visibility !== 'hidden' && fs.w > 0 && fs.h > 0 && fs.opacity !== '0';
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
    const edgeOk = {
      top: fs.top >= -EPS,
      left: fs.left >= -EPS,
      bottom: fs.bottom <= r.vp.h + EPS,
      right: fs.right <= r.vp.w + EPS,
    };
    const offscreen = Object.keys(edgeOk).filter((k) => !edgeOk[k]);
    const onscreen = offscreen.length === 0;
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
    if (!shown || !onscreen || !unscrolled) {
      fail(`FINDING D3/ink cell=${cell} key=${WANT} visible=${shown} onscreen=${onscreen} unscrolled=${unscrolled} `
        + `scroll=(${scrolls}) `
        + `offscreen-edges=[${offscreen.join(',')}] box=(${box}) of viewport ${r.vp.w}x${r.vp.h} `
        + `(display:${fs.display} visibility:${fs.visibility}) `
        + '— first that a player has to scroll to, or cannot see, is not first.');
    } else {
      note(`D3/ink ${cell} box (${box}) wholly inside viewport ${r.vp.w}x${r.vp.h} on all four edges, `
        + `nothing scrolled (${scrolls})`);
    }
  }
  return first;
}

async function main() {
  if (args.includes('--selftest')) return selftest();

  // THE POPULATION IS SETTLED BEFORE ANYTHING BOOTS — no server, no browser, no
  // cells — because both refusals below are about there being nothing to measure.
  if (narrowingErrors.length) {
    for (const e of narrowingErrors) console.error(`displayfirst: ${e}`);
    console.error('              Exit 2, not 0: a narrowing flag that matches nothing selects an EMPTY');
    console.error('              population, and an empty population cannot tell you anything about the');
    console.error('              screen. Nothing was measured, so this is not a verdict.');
    expected = 0;
    finish('unknown', narrowingErrors.join(' | '));
  }
  expected = SHAPES.length * TEXTS.length * DOORS.length;
  if (expected === 0) {
    console.error('displayfirst: the declared population is ZERO cells '
      + `(${SHAPES.length} shape(s) x ${TEXTS.length} text size(s) x ${DOORS.length} door(s)).`);
    console.error('              REFUSED, not passed. D0 compares `reached` against `expected`, and both');
    console.error('              derive from the same filter — at zero that comparison is self-satisfying');
    console.error('              and would print a green over a world with nothing in it.');
    finish('unknown', 'declared population is zero cells');
  }

  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')));
  const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8474), open: false });
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
    await s.close?.();
    finish('unknown', 'no Chrome/Chromium found');
  }
  console.log(`      browser: ${browserPath}`);

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'displayfirst-', browser: browserPath, timeoutMs: 15000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;

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
    const until = async (x, w, ms = 25000) => {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); }
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

  cdp.close(); await dropBrowser(); await s.close?.();

  finish(bad ? 'fail' : 'ok');
}

// ---------------------------------------------------------------------------
// --selftest — the same-door known-bad corpus.
//
// TWELVE PLANTS. THREE OF THEM ARE INVISIBLE TO test 61, and that is the argument
// for this file existing at all: plants 2, 3 and 4 leave `ROWS` and
// `categoryHandler('Display').rows` exactly as they are, so the engine suite
// stays green while the screen is wrong.
//
// PLANTS 6-9 are one per viewport edge — D3's four-edge sentence, watched to
// fail at each edge rather than asserted. PLANT 11 is the third scroll axis,
// which the predicate read and never used.
//
// PLANTS 10 AND 12 ARE NOT ABOUT THE SCREEN AT ALL — they are about whether THIS
// TOOL still speaks when it cannot measure. 10 makes the subject unreachable and
// requires the BOUNDARY and a non-verdict-shaped state line to print anyway; 12
// removes the panel and requires the run to reach its intended FAIL with both
// cells, rather than dying in its own diagnostic and reporting SILENCE.
//
// A COUNT IS NOT A GUARANTEE, and this corpus is the evidence for that sentence:
// plant 10 counted for a week while asserting the symptom instead of the thing
// it guards (see its own comment). A corpus counts plants; NOTHING IN THIS HOUSE
// COUNTS WHETHER A PLANT ASSERTS WHAT IT CLAIMS TO PROTECT. The check for that
// is mutation — break the guarded behaviour, leave the defect, and require the
// corpus to go red — and it is caught by hand today, twice tonight (this plant
// and #320's headline plant). Recorded here as a gap; not built here.
// ---------------------------------------------------------------------------
async function selftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  const plants = [
    {
      // 1 — THE NEIGHBOURHOOD. `fullscreen` moves exactly ONE position. One step
      // of the threshold's own unit flips the verdict (Charter 2b). test 61
      // catches this one too, which is the point: on the obvious direction the
      // two agree.
      name: 'the row moves one position down the array',
      file: 'src/ui/screens/settings.js',
      find: `  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },
  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },`,
      replace: `  { cat: 'Display', key: 'useSprites', def: true, label: 'Character sprites',
    note: 'Show a drawn class figure in combat instead of your chosen sigil.' },
  { cat: 'Display', key: 'fullscreen', type: 'action', def: false, label: 'Fullscreen',
    note: 'Fill the screen (also toggles with F11 in most browsers).' },`,
      expectRed: /FINDING D1\/order .*first=useSprites want=fullscreen/,
    },
    {
      // 2 — THE RENDERER REORDERS AND THE TABLE DOES NOT. test 61 reads
      // categoryHandler().rows, which this never touches: GREEN there, wrong
      // here.
      name: 'the renderer reverses what the table hands it (test 61 stays green)',
      file: 'src/ui/screens/settings.js',
      find: '  return h.rows.map((r) => rowHtml(settings, r)).join(\'\');',
      replace: '  return [...h.rows].reverse().map((r) => rowHtml(settings, r)).join(\'\');',
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
  ];
  // NARROWED ON PURPOSE AND SAID OUT LOUD: ten whole-tool browser runs plus a
  // clean run is eleven browser boots. The population is one shape and one text
  // size, both doors — the DOOR is unnarrowed, which is the axis the corpus is
  // about. Plant 10 spends its own 25 s waiting for a page that never boots;
  // that wait IS the defect it plants, so it is not tuned away.
  const code = await doorSelftest({
    tool: 'displayfirst.mjs',
    args: ['--only-shape', '1440x860', '--only-text', 'M', '--port', '8475'],
    plants,
    timeoutMs: 300000,
  });
  // The corpus run is an exit path too, so it prints the boundary like every
  // other one. doorplant owns the verdict line here; this owns the limits.
  printBoundary();
  process.exit(code);
}

// THE FAILURE PATH GOES THROUGH THE SAME DOOR AS THE SUCCESS PATH. This line
// used to be `console.error(stack); process.exit(1)` — an exit above the
// boundary print, which is the #320 shape. The stack is still printed, because
// a boundary is not a diagnosis; what changed is that the boundary and a
// non-verdict-shaped state line now follow it.
main().catch((e) => {
  console.error(`displayfirst: ${(e && e.stack) || e}`);
  finish('stopped', (e && e.message) || String(e));
});
