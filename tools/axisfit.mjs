#!/usr/bin/env node
// tools/axisfit.mjs — LAW 5's machine check. On a narrow shape, every scroll
// container's horizontal travel is ZERO, or the container names its own
// exemption, in the code, with its reason.
//
// Bjorn, 2026-08-08, on Constantine's word:
//
//   "for mobile, if possible, I should only be scrolling up and down, rarely
//    left and right. so if you need to rearrange things to keep everything
//    visible in the vertical dimension, then do so"
//
// Law 5 is house law (commons/laws.md) and is not restated here — the family
// repo is its home and this file is its enforcement pointer. What lives HERE is
// only the mechanism.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS AND tools/mobilefit.mjs DOES NOT ANSWER IT
//
// mobilefit sweeps 32 shapes, passes, and is SILENT about this axis. Its
// horizontal reading is `documentElement.scrollWidth - clientWidth`, and this
// app is `overflow: hidden` at the root, so that number is ZERO BY
// CONSTRUCTION at every shape — measured, not assumed: across 14 surfaces x 5
// shapes at cd3da94 the document itself never once appeared as a scroller. Its
// `clipped()` walk then deliberately SKIPS any element with a scrolling
// ancestor, and its bleed set is `.combat *`. Three mechanisms, none of which
// can see a scroller three elements down on a screen that is not combat.
//
// GREEN ON 32 SHAPES WAS SILENCE ABOUT THE AXIS, NOT COVERAGE OF IT. So the
// unit here is the SCROLL CONTAINER, never the document, and the surface
// population is every ?shot= state, not one board.
//
// ---------------------------------------------------------------------------
// THE POPULATION, STATED, BECAUSE A SHAPE LIST AND A TOLERANCE ARE THE SAME
// OBJECT — a boundary drawn around the cells its author already looked at.
// I cut a shape list and invented a fitted tolerance in one file in one hour
// once. So each edge of this one says who drew it and whether a machine can:
//
//   SURFACES — DERIVED, not typed. A regex over src/main.js's `shotState ===`
//     comparisons, the same home tools/release-shots.mjs reads, with the same
//     two floors it learned the hard way: zero derived states is a FINDING (an
//     empty denominator is not full coverage), and any derived state neither
//     measured nor excluded BY NAME is a FINDING. I cannot shorten this list
//     without the tool saying so.
//   DRIVEN OVERLAYS — A TYPED LIST OF THREE, and the weakest edge in this file.
//     They have no ?shot= state, so nothing derives them; the settings tab
//     strip is one of the offenders Law 5 names by name, and leaving it out
//     because it is awkward would be the boundary drawn around the easy cells.
//     An overlay whose opener does not fire is `unknown` and RED — never a skip.
//   SHAPES — the app decides, not me. A shape is in scope iff the app itself
//     rendered `data-layout="narrow"` there. No width threshold appears in this
//     file. The GEOMETRY fed in is still a typed list, and it is a second copy
//     of the one in mobilefit.mjs — so `assertShapesAgree()` below reads that
//     file and fails if the two ever disagree. A second copy WITH something
//     checking they agree is not the defect; a second copy with nothing is.
//   TEXT SIZE — ONE CELL by default, and it MATTERS: at 390x844 `.hand` runs
//     200px at Text M and 326px at Text XL, and the event screen 18 -> 22.
//     `--text S|M|L|XL` reaches the other cells; the default run does not sweep
//     them and this is printed in the boundary rather than left to be found.
//
//   NO TOLERANCE. Zero is zero — clause 2 of the law says a threshold is not an
//   exemption, "a number a layout can sneak under is how 401px becomes normal
//   one commit at a time." The proof is on this tree: the SMALLEST offender is
//   the event screen at 18px. Any tolerance I could have fitted to the map's
//   401 would have hidden it. Chromium reports scrollWidth/clientWidth as
//   integers, so `> 0` needs no epsilon; if a 1px ever appears, the answer is
//   the layout, never a tolerance here.
//
// ---------------------------------------------------------------------------
// THE EXEMPTION, AND WHY IT IS NOT A LIST IN THIS FILE
//
// Law 5 clause 2: a surface may scroll horizontally only where the horizontal
// run IS the content, "named at the container, in the code, with its reason."
// The house has solved the latch/exemption problem twice already and the answer
// both times was the same: THE EXEMPTION ASSERTS ITS OWN REASON AND FAILS WHEN
// THE REASON DIES.
//
// So there is no allow-list here. A container excuses itself, where it is
// rendered, by carrying:
//
//     data-scroll-axis="x"  data-scroll-axis-why="<why the content IS a run>"
//
// and the check treats that declaration as a claim it can falsify:
//
//   A1  travel > 0 and no declaration            -> FAIL (the law)
//   A2  declaration with no reason, or an empty  -> FAIL (an exemption with no
//       reason, or any value but "x"                reason is a mute button;
//                                                   one word, closed, so the
//                                                   vocabulary cannot widen by
//                                                   accident)
//   A3  declaration and travel > 0               -> excused, printed at volume
//   A4  declaration and travel == 0              -> FAIL (RATCHET). The reason
//       died: either the content stopped being a horizontal run, or this check
//       went blind. Both need a person. An excuse nobody can be forced to
//       revisit is how a suite goes green over a bug.
//
// TWO EXEMPTIONS SHIP, both built in ONE home (src/ui/handAxis.js — neither
// renderer types the string), both on the hand strip, and they are DIFFERENT
// because the renderers' truths differ:
//   · the combat hand under PAGING — mode-scoped, rendered conditionally
//     (combat.js reads <html data-hand-layout>, attributes only under
//     'paging'), his D19 word as its reason; the mode axis below keeps it
//     honest (A5).
//   · the coop hand, ALWAYS — coop.js renders its own .hand and implements
//     only the paging strip (no overlap arm, no reader of the word), so its
//     declaration is UNSCOPED: true in every mode, held honest by sweeping
//     coop under both modes (A4 is its wake if coop ever grows an overlap
//     arm). Added 2026-08-14 after Bjorn's refused gate found the coop hand
//     travelling 211px undeclared — combat's #169 exemption never travelled
//     to the second renderer.
// From 2026-08-08 to 2026-08-14 this paragraph opened "ZERO EXEMPTIONS SHIP"
// and named `.hand` as receiving none — that refusal stood on D17 msg 3's word
// and was right; D19's later word is what opened it (the history is spelled
// out under THE MODE AXIS below). The act
// map's old declaration ("the act map is a horizontal route", 1c227ec) stays
// DELETED, not moved: D17 message 4 falsified its reason in Constantine's own
// words ("not require any scrollign left or right"), and the camera owns the
// horizontal axis through the viewBox (mapboard.js), so the map's travel is 0
// by construction and A4 would correctly fail that declaration if it ever
// came back without travel under it. Every other scroller remains undecided
// by design.
//
// ---------------------------------------------------------------------------
// THE MODE AXIS — Vega, 2026-08-14, on Marina's ruling, and the words are his.
//
// The hand wears two layouts behind one derived word (C2, D19):
// balance.ui.handLayout -> <html data-hand-layout>, 'paging' | 'overlap'. In
// PAGING the strip scrolls sideways BY DESIGN — his word, D19, 2026-08-13,
// verbatim: "overlap and paging". In OVERLAP the whole hand lays inside the
// container and horizontal travel is ZERO — asserted, never excused.
//
// So an exemption on the hand is legal ONLY under paging, and it says so
// itself: a fourth attribute, data-scroll-axis-mode="<mode>", scopes the
// declaration to the mode that designed the run. The check compares it to the
// page's actual <html data-hand-layout>:
//
//   A5  declaration scoped to a mode the page does not render -> FAIL. The
//       exemption may never outlive its mode: a paging declaration sitting in
//       an overlap DOM is either a conditional render that broke or a hand-
//       typed copy, and both are the trap this axis exists to refuse.
//   A5b scoped declaration on a page with no data-hand-layout    -> FAIL (the
//       scope names a word the page no longer speaks; unverifiable is not
//       excused).
//
// And the sweep itself walks BOTH modes through the settings door
// (?shotSettings={"handLayout":...}) on the surface that renders the hand —
// the modes DERIVED from balance.ui.handLayoutModes, the app's own closed
// set, never typed here. Overlap cells assert 0 like any undeclared
// container; paging cells accept the declaration under A3/A4 as ever.
//
// HISTORY, so nobody reads the exemption as convenience: D17 message 3
// (2026-08-08) is Constantine ANNOYED at this exact scroller — "I'm annoyed
// that in mobile, that the default hand size requires me to scroll left and
// right" — and on that word this file refused `.hand` an exemption by name
// (the paragraph above carried that refusal from 2026-08-08). D19
// (2026-08-13) is his later
// word — "overlap and paging" — that makes paging a DESIGNED pager and the
// declaration writable, scoped to that mode alone. The refusal was right when
// it was written and the exemption is right now; both cite him, not us.
//
// ---------------------------------------------------------------------------
// THE FLOORS, AND THE ONE THAT WAS MISSING — Vira, 2026-08-08, checking gate.
//
// Bjorn floored the DENOMINATOR (zero derived states) and the SCOPE (zero narrow
// cells). He did not floor the thing actually judged. Observed on this tree, at
// dd11e38, no edit to the app:
//
//     $ node tools/axisfit.mjs --dist --only death
//     PASS — every assertion held over 0 asserted container(s) in 4 narrow cell(s).
//     $ echo $?
//     0
//
// Four narrow cells cleared the scope floor; `death` has no scroll container, so
// nothing was judged, and the tool printed a green. That is this file's OWN
// fixture — `verify-shipped: OK — 0 checks passed` — reproduced by the file that
// names it in its own comments. `--only` is the cheapest way to see it; it is
// NOT the dangerous way. The dangerous way needs no flag: the day the app stops
// using native scrollers, or `data-scroll-axis` moves, or the overflow filter
// below stops matching the app's technique, EVERY container vanishes from the
// scan, all 68 narrow cells still count, and the full sweep prints PASS at
// exit 0 over nothing. Measured, not argued: one line changed in SCAN's overflow
// filter turns `FAIL — 41 assertions over 61 containers` into a clean green.
//
// So the floors are now ONE function, `floorVerdict()`, and --selftest calls the
// SAME function main() does — Bjorn's own discipline for judge(), which the two
// population selftests (P1, P3) did not follow: they re-stated their mechanism
// rather than calling it, so they could drift green while main() was red.
//
// A zero-assertion run is `unknown`, and unknown blocks (SOP 2's silence guard).
// It is not a softer bucket than red and it is not a pass.
//
// ---------------------------------------------------------------------------
// KNOWN-BAD FIRST (development.md, The instrument rule). Nothing needed
// authoring to make this falsifiable — the defect was already shipped:
//
//     .map-scroll = 65px horizontal at 390x844, declaration removed in memory
//     integrated milestone = 328d592, dist sha256 89acfa0b15d5
//
// A check whose failing case nobody has watched fail is `unknown`, not green.
// `--selftest` plants all eight of this file's mechanisms in memory and prints
// what went red, INCLUDING the two that must go GREEN — a check that can only
// ever be red is as useless as one that can only ever be green, and only the
// second failure is usually looked for.
//
// Usage
//   node tools/axisfit.mjs                 source tree via tools/serve.mjs
//   node tools/axisfit.mjs --dist          dist/AshenSpire.html over file://
//   node tools/axisfit.mjs --text XL       one other cell of the text axis
//   node tools/axisfit.mjs --only map      one surface (still `unknown` on a typo)
//   node tools/axisfit.mjs --selftest      plant every mechanism, watch it fail
//   CHROME=/path/to/chrome node tools/axisfit.mjs
//
// Exit codes
//   0  every narrow container travelled 0px horizontally, or excused itself
//   1  an assertion failed  (EXPECTED on dev at cd3da94 — that is the point)
//   2  usage / no browser / a surface that would not mount — never a pass
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day EldenSpire
// ships no narrow shape — then `data-layout="narrow"` never renders, the scope
// filter selects nothing, and the run says so out loud instead of passing.
//
// REMOVAL CONDITION FOR THE FLOORS (Vira, 2026-08-08, and it is their falsifier):
// floorVerdict() is CUT if ten runs pass with no arm of it ever firing on a real
// invocation — that is the Charter's decoration test, counted rather than judged.
// It is WRONG, and is rewritten rather than deleted, the first time a run this
// file calls green turns out to have judged nothing that mattered: the floor
// counts containers, and a container count is a proxy for coverage, not coverage.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? One home: tools/artifact-provenance.mjs. Facts only;
// it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const SELFTEST = args.includes('--selftest');
const only = argOf('--only');
const textSize = argOf('--text') || null;

// TEXT SIZE IS A CLOSED SET, AND IT IS THE APP'S, NOT MINE (Law 0 clause 1 —
// the machinery derives; Law 1 clause 3 — the vocabulary is the app's).
//
// Bjorn named this trap in a comment further down and left it as prose:
// `?shotSettings.textSize` is looked up CASE-SENSITIVE in balance.ui.textSize
// and anything not in that object silently becomes M. Observed at dd11e38:
//
//   --text XL      -> html font 12px   (XL: really swept)
//   --text xl      -> html font 10px   header says "Text size xl"      — M
//   --text banana  -> html font 10px   header says "Text size banana"  — M
//
// A run that PRINTS a cell it did not measure is worse than one that skips it:
// the boundary block below then names a swept axis that was never swept. So the
// value is checked against the app's own home before the browser costs anything.
function appTextSizes() {
  const src = readFileSync(resolve(ROOT, 'src', 'content', 'balance.js'), 'utf8');
  const m = /textSize:\s*\{([^}]*)\}/.exec(src);
  return m ? [...m[1].matchAll(/([A-Za-z]+)\s*:/g)].map((x) => x[1]) : [];
}

// THE MODE AXIS IS THE APP'S CLOSED SET, DERIVED — balance.ui.handLayoutModes,
// the same home main.js guards a stored setting against. Typed here it would be
// a second copy that survives the feature's death; derived, it dies loudly with
// its home (the zero-modes refusal in main()).
function appHandModes() {
  const src = readFileSync(resolve(ROOT, 'src', 'content', 'balance.js'), 'utf8');
  const m = /handLayoutModes:\s*\[([^\]]*)\]/.exec(src);
  return m ? [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]) : [];
}

// The surfaces swept once per mode — TYPED, two entries, printed in the
// boundary, and the two are in for OPPOSITE reasons (Vega, 2026-08-14):
//
//   'combat' — the word's reader. src/ui/screens/combat.js is data-hand-layout's
//     only reader; its hand ARRANGES differently per mode, so each mode is a
//     different layout to judge.
//   'coop'   — the word's NON-reader, swept both ways to hold that exact claim.
//     coop.js renders its own .hand (the second renderer Bjorn's gate named)
//     and implements ONLY the paging strip — no overlap arm, no reader of the
//     word — so its declaration (src/ui/handAxis.js) is UNSCOPED: true in
//     every mode. Sweeping coop under both words is that declaration's WAKE
//     (development.md, the wake condition): the day coop grows an overlap arm,
//     the coop[overlap] cells reach zero travel and A4 fires on the unscoped
//     declaration, forcing a person to re-scope it. A surface swept only at
//     the boot default would let that premise die silently.
const MODE_SURFACES = ['combat', 'coop'];

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));

// ---------------------------------------------------------------- population 1
// SURFACES — derived from the one home, with release-shots' two floors.
// Deliberately the same regex against the same file: two readers of one home is
// not a second copy of a fact, it is two witnesses to it. If the shape of that
// source moves, BOTH go loud, which is the behaviour wanted.
function appShotStates() {
  const src = readFileSync(resolve(ROOT, 'src', 'main.js'), 'utf8');
  return [...new Set([...src.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))].sort();
}

// A ?shot= state excluded from the axis sweep must be named HERE with its
// reason, or the run fails with the state's name in the message. There is no
// silent gap and no way to shrink the denominator quietly.
const EXCLUDED_STATES = {};

// ---------------------------------------------------------------- population 2
// DRIVEN OVERLAYS — no ?shot= state exists, so nothing derives these and this
// list is TYPED. It is the weakest edge in the file and is printed with every
// run. `open` returns true, or a string saying what it could not find; a string
// is RED, because a surface that never opened is `unknown` and unknown blocks.
const DRIVEN = [
  {
    name: 'title-settings', from: '',
    why: 'the settings panel on the title door — Law 5 names its tab strip as a known offender',
    open: `(async () => {
      const b = [...document.querySelectorAll('button')].find((x) => /settings/i.test(x.textContent));
      if (!b) return 'no Settings button on the title door';
      b.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelector('[data-settings-host]') ? true : 'the settings host never appeared';
    })()`,
  },
  {
    name: 'overlay-menu', from: '?shot=combat',
    // CLAIM CORRECTED to what is measured — Vira, 2026-08-08. This read "the
    // in-run overlay and its six tabs"; the opener clicks Menu and reads
    // whichever tab opens first, and the Settings entry below reaches one more.
    // FOUR of the six are never opened (relics, stats, save, controls), and
    // boundary (e) covers them only as a generic "not looked at". The tab set is
    // NOT typed anywhere — it is MENU_TABS in src/ui/uiContent.js, one home, the
    // same shape appShotStates() already reads. So the one population Bjorn
    // called his weakest edge is the one that could be half-derived and is not.
    // Left as a finding rather than fixed here: deriving it changes what this
    // tool sweeps, and that is the author's call, not the checker's.
    why: 'the in-run overlay — the DEFAULT tab only; 4 of the 6 in MENU_TABS are never opened',
    open: `(async () => {
      const m = [...document.querySelectorAll('button')].find((x) => /^(menu|\\u2630)$/i.test(x.textContent.trim()));
      if (!m) return 'no Menu button on the combat board';
      m.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelectorAll('.ov-tab').length ? true : 'the overlay opened with no tabs';
    })()`,
  },
  {
    name: 'overlay-settings', from: '?shot=combat',
    why: 'settings INSIDE the run — the second of the two doors, and a different scroller from the first',
    open: `(async () => {
      const m = [...document.querySelectorAll('button')].find((x) => /^(menu|\\u2630)$/i.test(x.textContent.trim()));
      if (!m) return 'no Menu button on the combat board';
      m.click(); await new Promise((r) => setTimeout(r, 600));
      const t = [...document.querySelectorAll('.ov-tab')].find((b) => /^settings$/i.test(b.textContent.trim()));
      if (!t) return 'no Settings tab in the overlay strip';
      t.click(); await new Promise((r) => setTimeout(r, 700));
      return document.querySelectorAll('.set-tab').length ? true : 'the settings pane opened with no tabs';
    })()`,
  },
];

// ---------------------------------------------------------------- population 3
// SHAPES. The geometry is typed; the SCOPE is not. A row is measured at every
// shape and ASSERTED only where the app rendered data-layout="narrow".
//
// THIS IS A SECOND COPY of the shape geometry in tools/mobilefit.mjs, and I am
// not going to pretend otherwise — collapsing the two into one home is a real
// change across other seats' instruments and it is not tonight's. What IS
// tonight's is that nothing was checking they agree, which is the whole defect
// class. assertShapesAgree() closes that: it reads mobilefit's own source and
// fails if any shape there is missing here.
const DEVICE_SHAPES = [
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
  { w: 915, h: 412, d: 2.6, mobile: true, tag: 'landscape' },
  { w: 844, h: 344, d: 3, mobile: true, tag: 'landscape-chrome' },
  { w: 834, h: 1194, d: 2, mobile: true, tag: 'tablet' },
  { w: 884, h: 1326, d: 2, mobile: true, tag: 'tablet' },
  { w: 885, h: 1326, d: 2, mobile: true, tag: 'tablet' },
  { w: 900, h: 1600, d: 2, mobile: true, tag: 'tablet' },
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' },
  { w: 1920, h: 1080, d: 1, mobile: false, tag: 'desktop' },
];

function shapesInMobilefit() {
  const src = readFileSync(resolve(ROOT, 'tools', 'mobilefit.mjs'), 'utf8');
  return [...new Set([...src.matchAll(/\{\s*w:\s*(\d+),\s*h:\s*(\d+),\s*d:\s*([\d.]+)/g)]
    .map((m) => `${m[1]}x${m[2]}@${m[3]}`))].sort();
}

function mapScrollFrom(scan) {
  const found = scan.containers.find((c) => c.path.split(' > ').pop().split('.').includes('map-scroll'));
  if (!found) throw new Error('axisfit selftest: .map-scroll was not collected by SCAN');
  return found;
}

// ------------------------------------------------------------------ assertions
const fails = [];
const notes = [];
const ok = (cond, msg) => {
  console.log(`    ${cond ? '\u2713' : '\u2717'} ${msg}`);
  if (!cond) fails.push(msg);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ----------------------------------------------------------------- page probe
//
// EVERY SCROLL CONTAINER, and the document among them rather than instead of
// them. An element counts when it has real travel on either axis AND the
// computed overflow on some axis is auto/scroll — a clipped `overflow: hidden`
// box is not something a thumb can move, and calling it a scroller would make
// this tool report the layout rather than the gesture.
//
// documentElement is ALWAYS reported, travel or not, and always labelled: it is
// the number mobilefit asserted, it is zero by construction under a fullscreen
// `overflow: hidden` app, and printing it beside the real scrollers is the only
// way a reader stops mistaking it for coverage.
const SCAN = `(() => {
  const path = (e) => {
    const bits = [];
    for (let n = e; n && n.nodeType === 1 && bits.length < 4; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.id) { s += '#' + n.id; bits.unshift(s); break; }
      if (n.classList && n.classList.length) s += '.' + [...n.classList].slice(0, 3).join('.');
      bits.unshift(s);
    }
    return bits.join(' > ');
  };
  const de = document.documentElement;
  const read = (e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return {
      path: path(e),
      hx: e.scrollWidth - e.clientWidth,
      hy: e.scrollHeight - e.clientHeight,
      overflowX: cs.overflowX, overflowY: cs.overflowY,
      w: r.width, h: r.height,
      rendered: e.getClientRects().length > 0,
      axis: e.getAttribute('data-scroll-axis'),
      why: e.getAttribute('data-scroll-axis-why'),
      axisMode: e.getAttribute('data-scroll-axis-mode'),
    };
  };
  const containers = [];
  for (const e of document.querySelectorAll('*')) {
    // A DECLARED CONTAINER IS ALWAYS COLLECTED, whatever it measures — Vira,
    // 2026-08-08. The two filters below are right for FINDING scrollers and
    // wrong for AUDITING an exemption, and A4 (the ratchet) is an audit.
    //
    // OBSERVED at dd11e38: declare data-scroll-axis="x" on .map-scroll at 401px
    // (collected, EXCUSED), then let the reason die the way clause 3 authorises
    // — rearrange until it no longer overflows. hx and hy both reach 0, the two
    // filters below drop the element, and judge() NEVER SEES IT. The stale
    // exemption sits in the DOM with nothing that can force a revisit, which is
    // the precise failure A4 exists to prevent.
    //
    // The selftest could not catch this because mechanism 5 hands judge() a
    // synthetic hx:0/hy:200 object and never goes through SCAN — a re-statement
    // of the mechanism instead of the mechanism, the drift this file's own
    // comment above judge() warns about.
    // AND THAT INCLUDES A HIDDEN ONE, deliberately: a declaration on a container
    // this surface no longer renders is a reason that died by a different route,
    // and it reaches A4 as a ratchet failure rather than disappearing. Two
    // exemptions ship today — the paging hand (combat.js) and the coop hand
    // (coop.js), both from src/ui/handAxis.js — so this arm is live, not
    // latent: it is what forces a person back if a strip ever stops
    // travelling or a hand leaves a surface with its declaration behind.
    const declared = e.hasAttribute('data-scroll-axis');
    const hx = e.scrollWidth - e.clientWidth, hy = e.scrollHeight - e.clientHeight;
    if (!declared) {
      if (hx <= 0 && hy <= 0) continue;
      const cs = getComputedStyle(e);
      if (!/auto|scroll/.test(cs.overflowX) && !/auto|scroll/.test(cs.overflowY)) continue;
      if (!e.getClientRects().length) continue;
    }
    containers.push(read(e));
  }
  return {
    layout: de.getAttribute('data-layout'),
    mode: de.getAttribute('data-hand-layout'),
    zoom: parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1,
    htmlFont: getComputedStyle(de).fontSize,
    vw: innerWidth, vh: innerHeight,
    doc: read(de),
    containers,
  };
})()`;

// ------------------------------------------------------------------ CDP client
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
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

function launchChrome(browser, userDataDir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, [
      '--headless', '--no-sandbox', '--disable-gpu', '--window-size=1440,860',
      '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
      '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--allow-file-access-from-files',
      '--no-first-run', 'about:blank',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const onData = (d) => {
      err += d;
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
      if (m) res({ child, wsUrl: m[1] });
    };
    child.stderr.on('data', onData);
    child.stdout.on('data', onData);
    child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-500)}`)), 12000);
  });
}

// ------------------------------------------------------------ the law, applied
//
// One container, one verdict. Pulled out of the loop so --selftest exercises the
// SAME function the run does, rather than a re-statement of it that could drift
// green while this one is red.
export function judge(c, pageMode) {
  const travels = c.hx > 0;
  const declared = c.axis != null;
  if (!declared) {
    return travels
      ? { verdict: 'FAIL', why: `travels ${Math.round(c.hx)}px horizontally and declares no exemption` }
      : { verdict: 'PASS', why: 'no horizontal travel' };
  }
  if (c.axis !== 'x') {
    return { verdict: 'FAIL', why: `data-scroll-axis="${c.axis}" is not a word this check knows — the only exemption is "x"` };
  }
  // A5 — a mode-scoped declaration is checked BEFORE its reason: an exemption
  // sitting in the wrong mode is wrong whatever its prose says. The scope is
  // the declaration's own claim ("I exist only under this mode"); the page's
  // <html data-hand-layout> is the fact it is checked against.
  if (c.axisMode != null) {
    if (!String(c.axisMode).trim()) {
      return { verdict: 'FAIL', why: 'declares data-scroll-axis-mode with an empty value — a scope that names no mode scopes nothing' };
    }
    if (pageMode == null) {
      return { verdict: 'FAIL', why: `scoped to mode "${c.axisMode}" on a page that renders no <html data-hand-layout> — an unverifiable scope does not hold` };
    }
    if (c.axisMode !== pageMode) {
      return { verdict: 'FAIL', why: `MODE — the exemption outlived its mode: declared for '${c.axisMode}' while the page renders '${pageMode}'. The declaration is a conditional render (combat.js) and must never appear under the other word — D17 msg 3 refused the hand an exemption; D19 grants it to paging alone.` };
    }
  }
  if (!c.why || !String(c.why).trim()) {
    return { verdict: 'FAIL', why: 'declares data-scroll-axis="x" with no data-scroll-axis-why — an exemption with no reason is a mute button' };
  }
  if (!travels) {
    return { verdict: 'FAIL', why: `RATCHET — declares a horizontal run ("${c.why}") and has ZERO horizontal travel. The reason died, or this check went blind. Both need a person.` };
  }
  return { verdict: 'EXCUSED', why: `${Math.round(c.hx)}px, exempt under Law 5 clause 2${c.axisMode ? ` (mode-scoped: ${c.axisMode})` : ''}: ${c.why}` };
}

// --------------------------------------------------------------- the floors
//
// EVERY WAY THIS RUN CAN BE `unknown` RATHER THAN A RESULT, IN ONE PLACE, as a
// pure function of the counts — so --selftest exercises the SAME code main()
// does rather than a re-statement of it (Vira, 2026-08-08; the discipline is
// Bjorn's own, stated above judge() and not applied to the population floors).
//
// Returns null when the run is a real result, or { code, lines } when it is not.
// Ordered widest-first: an empty denominator explains an empty scope, which
// explains an empty assertion count, and reporting the innermost symptom of an
// outer failure sends the reader to the wrong place.
export function floorVerdict({ derived, narrowCells, asserted, only, matchedOnly, surfaces }) {
  if (!derived) return { code: 1, lines: [
    'axisfit: derived ZERO ?shot= states from src/main.js.',
    'An empty denominator is not full coverage — it is a home this tool can no longer read.',
  ] };
  if (only && !matchedOnly) return { code: 2, lines: [
    `axisfit: --only ${only} matched no surface. Nothing was tested, so this is unknown, not a pass.`,
    `  surfaces: ${(surfaces || []).join(', ')}`,
  ] };
  if (!narrowCells) return { code: 1, lines: [
    'axisfit: no shape rendered data-layout="narrow", so ZERO containers were asserted.',
    "Either the narrow layout is gone (in which case this file's removal condition has fired",
    'and it should be deleted), or the attribute moved and the scope filter has gone blind.',
  ] };
  // THE FLOOR THAT WAS MISSING. Narrow cells are the SCOPE; asserted containers
  // are the JUDGEMENT. A run can clear the first and do none of the second, and
  // until this line existed it printed "PASS — every assertion held over 0
  // asserted container(s)" at exit 0. Zero judgements is `unknown`, and unknown
  // blocks exactly as red does — it is never the softer bucket (SOP 2).
  if (!asserted) return { code: 1, lines: [
    `axisfit: ${narrowCells} narrow cell(s) were in scope and ZERO scroll containers were judged.`,
    'Nothing was asserted, so this run is `unknown` — it is NOT a pass, whatever the count above says.',
    'Either every narrow surface here genuinely has no scroller (say so by name and re-scope the run),',
    'or the scan stopped recognising the app\'s scrollers — SCAN requires computed overflow auto|scroll',
    'on some axis, so a move to transform-panning or overflow:clip empties it silently.',
  ] };
  return null;
}

// ---------------------------------------------------------------------- main
async function main() {
  if (!browserPath) { console.error('axisfit: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }

  printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);

  // ---- the text cell is checked against the app's own closed set, first ----
  if (textSize) {
    const known = appTextSizes();
    if (!known.length) {
      console.error('\naxisfit: read ZERO text sizes out of src/content/balance.js (ui.textSize).');
      console.error('That home is how --text is validated; unread, every --text value would be taken on trust.');
      process.exit(1);
    }
    if (!known.includes(textSize)) {
      console.error(`\naxisfit: --text ${textSize} is not one of the app's text sizes (${known.join(', ')}).`);
      console.error('The lookup in balance.ui.textSize is CASE-SENSITIVE and falls back to M in silence, so this');
      console.error('run would have printed "Text size ' + textSize + '" in its header and measured M.');
      console.error('A cell named but not swept is worse than one skipped — the boundary block would name it as covered.');
      process.exit(2);
    }
  }

  // ---- population, derived and floored, BEFORE the browser costs anything ----
  const derived = appShotStates();
  const derivedFloor = floorVerdict({ derived: derived.length, narrowCells: 1, asserted: 1 });
  if (derivedFloor) { console.error(''); for (const l of derivedFloor.lines) console.error(l); process.exit(derivedFloor.code); }
  const excluded = Object.keys(EXCLUDED_STATES);
  const surfaces = derived.filter((s) => !EXCLUDED_STATES[s]);
  console.log(`\nPOPULATION 1 — surfaces · home: src/main.js (?shot= states), DERIVED`);
  console.log(`  ${derived.length} state(s): ${surfaces.length} swept, ${excluded.length} excluded by name`);
  for (const s of excluded) console.log(`  EXCLUDED  ?shot=${s} — ${EXCLUDED_STATES[s] || 'NO REASON GIVEN'}`);
  console.log(`  ${surfaces.join(', ')}`);

  // ---- the mode axis, derived from its one home, refused loudly at zero ----
  const handModes = appHandModes();
  if (!handModes.length) {
    console.error('\naxisfit: derived ZERO hand-layout modes from src/content/balance.js (ui.handLayoutModes).');
    console.error('That closed set is the mode axis of the combat cells; unread, the sweep would silently');
    console.error('collapse to one mode and a green would cover half the hand. If the word left the app,');
    console.error('delete the mode axis here in the same act — loudly, never by a silent shrink.');
    process.exit(1);
  }
  console.log(`\nMODE AXIS — balance.ui.handLayoutModes, DERIVED: ${handModes.join(', ')}`);
  console.log(`  ${MODE_SURFACES.map((s) => `'?shot=${s}'`).join(' and ')} are swept once per mode through the settings door;`);
  console.log(`  combat because it READS the word, coop because its hand does NOT — its unscoped`);
  console.log(`  declaration claims mode-inertness and the overlap cells are that claim's wake (A4).`);
  console.log(`  Every other surface renders the boot default.`);
  console.log(`\nPOPULATION 2 — driven overlays · TYPED, ${DRIVEN.length} entries, the weakest edge here`);
  for (const d of DRIVEN) console.log(`  ${d.name.padEnd(18)} ${d.why}`);

  // ---- the second copy, and the thing that watches it ----
  const mine = new Set(DEVICE_SHAPES.map((s) => `${s.w}x${s.h}@${s.d}`));
  const theirs = shapesInMobilefit();
  const missing = theirs.filter((s) => !mine.has(s));
  console.log(`\nPOPULATION 3 — shapes · ${DEVICE_SHAPES.length} typed here, ${theirs.length} read out of tools/mobilefit.mjs`);
  if (missing.length) {
    console.error(`\naxisfit: mobilefit.mjs ships ${missing.length} shape(s) this file does not: ${missing.join(', ')}.`);
    console.error('These two lists are a second copy of one fact. That is tolerable only while something');
    console.error('checks they agree, and they no longer do. Add the shape here, or move both to one home.');
    process.exit(1);
  }
  console.log(`  agree: every shape in mobilefit.mjs is measured here`);
  console.log(`  SCOPE IS NOT THIS LIST — a shape is asserted iff the app renders data-layout="narrow" there.`);

  // ---- serve ----
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`axisfit: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8263, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`\naxisfit — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}${textSize ? `  ·  Text size ${textSize}` : '  ·  Text size: the shipping default'}`);

  const profile = mkdtempSync(join(tmpdir(), 'axisfit-'));
  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);
  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const done = (code) => { cdp.close(); child.kill(); if (server) server.close(); process.exit(code); };

  // `?shotSettings` keys are the app's own. textSize is looked up CASE-SENSITIVE
  // in balance.ui.textSize (S/M/L/XL) while uiScale is lowercased first — so a
  // tool passing "xl" for text size silently gets M and reports a sweep it never
  // ran. Cost me one probe run tonight; named here so it costs nobody else one.
  const settingsQ = textSize ? `&shotSettings=${encodeURIComponent(JSON.stringify({ textSize }))}` : '';
  const settingsQ1 = textSize ? `?shotSettings=${encodeURIComponent(JSON.stringify({ textSize }))}` : '';
  // The mode cell's door: the SAME shotSettings channel, carrying the mode
  // beside any text size, so a --text run sweeps the mode axis in that cell too.
  const modeQ = (mode) => `&shotSettings=${encodeURIComponent(JSON.stringify({ ...(textSize ? { textSize } : {}), handLayout: mode }))}`;

  if (SELFTEST) { await selftest(evalIn, cdp, S, base, settingsQ); return done(fails.length ? 1 : 0); }

  // ------------------------------------------------------------------ the sweep
  const rows = [];
  let asserted = 0, narrowCells = 0, matchedOnly = false;

  const measure = async (label, url, driver) => {
    await cdp.send('Page.navigate', { url }, S);
    await wait(1500);
    if (driver) {
      let opened;
      try { opened = await evalIn(driver); } catch (e) { opened = `threw: ${e.message.slice(0, 90)}`; }
      if (opened !== true) {
        // A surface that never opened is `unknown`, and unknown blocks. It is
        // NOT a skip: a skip here reads identically to a clean sweep.
        ok(false, `${label}: the surface never opened (${opened}) — unknown, not a pass`);
        return null;
      }
      await wait(400);
    }
    let r;
    try { r = await evalIn(SCAN); } catch (e) { ok(false, `${label}: the surface would not mount (${e.message.slice(0, 90)})`); return null; }
    return r;
  };

  for (const vp of DEVICE_SHAPES) {
    const shapeName = `${vp.w}x${vp.h}`;
    console.log(`\n  ${shapeName} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);

    const jobs = [
      ...surfaces.flatMap((s) => (MODE_SURFACES.includes(s)
        ? handModes.map((m) => ({ label: `${s}[${m}]`, base: s, mode: m, url: `${base}?shot=${s}${modeQ(m)}`, driver: null }))
        : [{ label: s, base: s, url: `${base}?shot=${s}${settingsQ}`, driver: null }])),
      ...DRIVEN.map((d) => ({ label: d.name, base: d.name, url: `${base}${d.from ? d.from + settingsQ : settingsQ1}`, driver: d.open })),
    ];
    let shapeReported = false;
    for (const job of jobs) {
      if (only && only !== job.label && only !== job.base) continue;
      matchedOnly = true;
      const r = await measure(`${shapeName} ${job.label}`, job.url, job.driver);
      if (!r) continue;
      // A mode cell whose door failed is `unknown`, not a measurement of the
      // default — the same contract as a driven overlay that never opened.
      if (job.mode && r.mode !== job.mode) {
        ok(false, `${shapeName} ${job.label}: asked mode '${job.mode}' through the settings door, the page rendered '${r.mode}' — the door failed, cell unmeasured`);
        continue;
      }
      const narrow = r.layout === 'narrow';
      if (!shapeReported) {
        console.log(`    data-layout=${r.layout} · zoom ${r.zoom} · html font ${r.htmlFont} · viewport ${r.vw}x${r.vh}` +
          `  ->  ${narrow ? 'IN SCOPE (asserted)' : 'out of scope (measured, reported, not asserted)'}`);
        // The number mobilefit asserts, printed next to the ones that matter.
        console.log(`    documentElement: ${Math.round(r.doc.hx)}px horizontal (overflow-x: ${r.doc.overflowX})` +
          `${r.doc.hx <= 0 ? '  <-- zero by construction under a fullscreen overflow:hidden app. NOT COVERAGE.' : ''}`);
        shapeReported = true;
      }
      if (narrow) narrowCells++;
      const hs = r.containers.filter((c) => c.hx > 0);
      if (!r.containers.length) { console.log(`    ${job.label.padEnd(17)} no scroll container`); continue; }
      for (const c of r.containers) {
        const j = judge(c, r.mode);
        // THE SHAPE IS PART OF THE ADDRESS. Without it a finding names a surface
        // and a selector and not the cell it was found in, and the closing digest
        // is a list of refusals nobody can navigate to — a counted refusal is not
        // a located one. OBSERVED, not argued: at Text XL on this tree `.hand` is
        // 326px at BOTH 390x844 and 412x915, `.reward-row` 181px at both, and the
        // event screen 22px at both, so 43 findings printed 34 distinct lines and
        // NINE were byte-identical duplicates. At the default Text M every number
        // happens to differ and the digest looks fine — the defect is invisible in
        // the cell that is run by default and real in one a player can select.
        const line = `${shapeName} · ${job.label} · ${c.path} · H ${Math.round(c.hx)}px / V ${Math.round(c.hy)}px`;
        if (!narrow) {
          console.log(`    ${job.label.padEnd(17)} ${c.hx > 0 ? 'H' : ' '}${c.hy > 0 ? 'V' : ' '} ${String(Math.round(c.hx)).padStart(4)}/${String(Math.round(c.hy)).padStart(4)}  ${c.path}   (not asserted — wide layout)`);
          continue;
        }
        asserted++;
        if (j.verdict === 'EXCUSED') { console.log(`    \u2713 [EXEMPT] ${line} — ${j.why}`); notes.push(line); continue; }
        ok(j.verdict === 'PASS', `${line} — ${j.why}`);
      }
      rows.push({ shape: shapeName, surface: job.label, narrow, worst: hs.length ? Math.max(...hs.map((c) => Math.round(c.hx))) : 0,
        who: hs.length ? hs.sort((a, b) => b.hx - a.hx)[0].path.split(' > ').pop() : '' });
    }
  }

  // ---- every way this run is `unknown` rather than a result, in one call ----
  // The house's own `verify-shipped: OK — 0 checks passed` fixture lives in the
  // `asserted` arm; this repo had reproduced it in three tools before this one
  // reproduced it a fourth time. The floors run BEFORE the summary, so a run
  // that judged nothing never reaches the line that would call it a pass.
  const floor = floorVerdict({
    derived: derived.length, narrowCells, asserted, only, matchedOnly,
    surfaces: [...surfaces, ...DRIVEN.map((d) => d.name)],
  });
  if (floor) { console.error(''); for (const l of floor.lines) console.error(l); return done(floor.code); }

  // ------------------------------------------------------------------- summary
  const narrowRows = rows.filter((r) => r.narrow);
  const bad = narrowRows.filter((r) => r.worst > 0).sort((a, b) => b.worst - a.worst);
  console.log(`\n  NARROW CELLS — ${bad.length} of ${narrowRows.length} (shape x surface) scroll sideways`);
  for (const r of bad) console.log(`    ${String(r.worst).padStart(4)}px  ${r.shape.padEnd(9)} ${r.surface.padEnd(17)} ${r.who}`);

  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) ONE CELL OF THE TEXT AXIS. This run is Text ${textSize || 'M (shipping default)'}; text size
      moves these numbers (390x844 .hand 200px at M, 326px at XL; the event
      screen 18 -> 22). --text S|M|L|XL reaches the others; nothing sweeps them.
  (b) SCROLLING, NOT WRAPPING. A strip that answers a narrow shape by wrapping
      to two rows spends VERTICAL and reads 0 here. Law 5 clause 4 governs that
      and this tool is silent on it — the settings tab strip at Text L/XL is
      exactly that case.
  (c) NOT BLEED. An element painted past the viewport edge inside a clipping
      box is not scroll travel; tools/mobilefit.mjs owns bleed and this owns
      travel. The Map-zoom chip row's 424.6px was the first kind.
  (d) THE FRAME AFTER IT SETTLES, on Linux headless Chromium, one machine, no
      thumb and no OS gesture layer. Nothing here says a scroller is REACHABLE
      or usable — only which way it moves.
  (e) DRIVEN SURFACES ARE A TYPED LIST OF ${DRIVEN.length}. Anything reachable only by a
      click that is not in it was not looked at. Specifically: the in-run overlay
      has SIX tabs (MENU_TABS, src/ui/uiContent.js) and this reaches TWO — the
      default and Settings. relics · stats · save · controls are UNSWEPT.
  (f) EVERY SURFACE IS POSED BY ?shot=, at ONE point in a run. ?shot=map and
      ?shot=combat run a real seeded climb, so these are the app's own numbers,
      not a fixture's — but they are the numbers at the ENTRANCE with a starting
      deck. A late-run hand, a full relic shelf or a deeper act is more content
      in the same box and this sweeps none of them. The map is exempt from that
      worry BY CONSTRUCTION now, and it was measured, not assumed: its
      horizontal extent is the viewport itself (mapboard.js viewBox camera), so
      no seed, walk depth or column count can widen it — 0px on 72 cells
      (12 seeds x entrance/walk3/walk6 x 390x844 + 320x640) at the change that
      landed it. (Rune, 2026-08-14, replacing Vira's 2026-08-08 boundary note,
      which described the ink-grow camera this change removed.)
  (g) THE MODE AXIS IS TWO SURFACES. balance.ui.handLayoutModes (${handModes.join('/')}) is
      swept both ways on ${MODE_SURFACES.map((s) => `'?shot=${s}'`).join(' and ')} — combat because it reads
      the word, coop because its hand renderer does NOT (its unscoped declaration
      claims mode-inertness; the overlap cells are the wake that fails A4 the day
      that stops being true). Any FURTHER reader or renderer of the hand on
      another surface is NOT swept in its other mode until MODE_SURFACES grows
      with it, and the driven overlays open OVER combat at the boot default only.`);

  if (notes.length) {
    console.log(`\n  EXEMPT — ${notes.length} container(s) declared themselves a horizontal run under Law 5 clause 2.`);
    console.log(`  Each is re-checked every run and goes RED the moment its travel reaches zero.`);
  }
  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} assertion(s)` : 'PASS — every assertion held'} over ${asserted} asserted container(s) in ${narrowCells} narrow cell(s).`);
  for (const f of fails) console.log(`    - ${f}`);
  return done(fails.length ? 1 : 0);
}

// -------------------------------------------------------------------- selftest
//
// EIGHT MECHANISMS, PLANTED. Two of them must go GREEN and six must go RED, and
// the greens are the half usually left out: a check that can only ever be red
// passes for rigour and blocks nothing, because the first person to see it
// permanently red turns it off.
async function selftest(evalIn, cdp, S, base, settingsQ) {
  console.log('\n  SELFTEST — planting each mechanism against the known-bad (390x844, ?shot=map)\n');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, S);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
  await cdp.send('Page.navigate', { url: `${base}?shot=map${settingsQ}` }, S);
  await wait(1600);

  const plant = async (attrs) => {
    const set = attrs === null
      ? `e.removeAttribute('data-scroll-axis'); e.removeAttribute('data-scroll-axis-why');`
      : Object.entries(attrs).map(([k, v]) => `e.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join(' ');
    await evalIn(`(() => { const e = document.querySelector('.map-scroll'); if (!e) throw new Error('no .map-scroll'); ${set} return true; })()`);
    const r = await evalIn(SCAN);
    return mapScrollFrom(r);
  };
  const expect = (label, got, want) => {
    const good = got === want;
    console.log(`    ${good ? '\u2713' : '\u2717'} ${label} -> ${got}${good ? '' : ` (expected ${want})`}`);
    if (!good) fails.push(`selftest: ${label} gave ${got}, expected ${want}`);
  };

  // THE TRAVEL IS PLANTED NOW, NOT INHERITED — Rune, 2026-08-14. Mechanisms 1
  // and 2 used the map's own shipped defect (65..835px of horizontal travel,
  // seed-dependent) as their travel fixture. The camera owns the horizontal
  // axis through the viewBox since rune/the-map-fits-the-phone (mapboard.js:
  // the content box IS the viewport, scrollLeft has no extent), so shipped
  // travel is 0 on every seed and a fixture leaning on the defect went blind
  // the day the defect died. The travel enters BY THE SAME DOOR a real layout
  // regression would (development.md, the same-door clause): a wide child
  // appended to the real scroller in the real page, collected by SCAN — never
  // a synthetic object handed to judge().
  await evalIn(`(() => { const e = document.querySelector('.map-scroll'); if (!e) throw new Error('no .map-scroll');
    const p = document.createElement('div'); p.id = 'axisfit-planted-travel';
    p.style.cssText = 'width:2000px;height:1px;flex:none;'; e.appendChild(p); return true; })()`);
  await wait(250);

  // 1 — remove the shipped map declaration in memory. Real travel must still
  // fail, so the scoped contract cannot turn into an allow-list in this tool.
  let c = await plant(null);
  console.log(`    (declaration removed, travel planted: .map-scroll H ${Math.round(c.hx)}px / V ${Math.round(c.hy)}px)`);
  expect('A1  travel, declaration removed', judge(c).verdict, 'FAIL');

  // 2 — the exemption honoured. This is the GREEN half.
  c = await plant({ 'data-scroll-axis': 'x', 'data-scroll-axis-why': 'the act map is a horizontal run (planted)' });
  expect('A3  declared + travel  (must go GREEN)', judge(c).verdict, 'EXCUSED');

  // The planted travel leaves before the mechanisms that do not want it; the
  // declaration planted for A3 is cleaned by the next plant() call.
  await evalIn(`(() => { const p = document.getElementById('axisfit-planted-travel'); if (p) p.remove(); return true; })()`);
  await wait(150);

  // 3 — a declaration with no reason.
  c = await plant({ 'data-scroll-axis': 'x', 'data-scroll-axis-why': '   ' });
  expect('A2  declared, blank reason', judge(c).verdict, 'FAIL');
  await evalIn(`document.querySelector('.map-scroll').removeAttribute('data-scroll-axis-why')`);
  c = mapScrollFrom(await evalIn(SCAN));
  expect('A2  declared, reason absent', judge(c).verdict, 'FAIL');

  // 4 — a word outside the closed vocabulary.
  c = await plant({ 'data-scroll-axis': 'both', 'data-scroll-axis-why': 'we need both (planted)' });
  expect('A2  data-scroll-axis="both"', judge(c).verdict, 'FAIL');

  // 5 — THE RATCHET. Declared, and the travel is gone.
  expect('A4  declared, zero travel (RATCHET)',
    judge({ hx: 0, hy: 200, axis: 'x', why: 'a card hand', path: '.hand' }).verdict, 'FAIL');

  // 5b — THE RATCHET, THROUGH SCAN RATHER THAN AROUND IT (Vira, 2026-08-08).
  // 5 hands judge() a synthetic object and proves only that judge() is right.
  // The run never calls judge() on anything SCAN did not hand it, so this plants
  // the whole path: declare the exemption while it travels, then kill the reason
  // the way clause 3 authorises, and require the finding to SURVIVE THE SCAN.
  // Before the fix in SCAN above, the element vanished here and A4 never fired.
  await plant({ 'data-scroll-axis': 'x', 'data-scroll-axis-why': 'the act map is a horizontal run (planted)' });
  await evalIn(`(() => { const e = document.querySelector('.map-scroll');
    e.style.overflow = 'visible'; e.style.width = '100%';
    for (const k of e.querySelectorAll('*')) k.style.minWidth = '0';
    const c = e.firstElementChild; if (c) { c.style.width = 'auto'; c.style.minWidth = '0'; c.style.transform = 'none'; }
    return true; })()`);
  await wait(300);
  const dead = mapScrollFrom(await evalIn(SCAN));
  expect('A4  the reason died and SCAN still collected it', dead ? 'COLLECTED' : 'VANISHED', 'COLLECTED');
  expect('A4  ...and the ratchet fired on it', dead ? judge(dead).verdict : 'NEVER JUDGED', 'FAIL');
  await cdp.send('Page.navigate', { url: `${base}?shot=map${settingsQ}` }, S);
  await wait(1600);

  // 6 — the other GREEN half: a plain vertical scroller must not be a finding.
  expect('A0  no travel, no declaration (must go GREEN)',
    judge({ hx: 0, hy: 510, axis: null, why: null, path: '.cp-scroll' }).verdict, 'PASS');

  // 7 — the surface denominator's floor, exercised on a string rather than by
  // editing src/main.js: the regex, run over a source that no longer matches,
  // and then FED TO THE FLOOR main() CALLS rather than eyeballed.
  const blinded = [...new Set([...'if (shotState===\'map\') {}'.matchAll(/shotState === '([a-z]+)'/g)].map((m) => m[1]))];
  expect('P1  a reformatted src/main.js blinds the reader', blinded.length ? 'SAW' : 'ZERO', 'ZERO');
  expect('P1  ...and floorVerdict() refuses it',
    String(floorVerdict({ derived: blinded.length, narrowCells: 68, asserted: 61 })?.code), '1');

  // 8 — the shape second-copy guard, planted by removing a row.
  const mineShort = new Set(DEVICE_SHAPES.slice(1).map((s) => `${s.w}x${s.h}@${s.d}`));
  const missed = shapesInMobilefit().filter((s) => !mineShort.has(s));
  expect('P3  a shape dropped here but shipped in mobilefit', missed.length ? 'CAUGHT' : 'MISSED', 'CAUGHT');

  // ---------------------------------------------------------------------------
  // 9-13 — VIRA'S FLOORS, 2026-08-08. Four red and one GREEN, and they call the
  // same floorVerdict() main() calls, so a floor cannot drift green here while
  // the run is blind. Mechanism 9 is the defect this repair exists for.

  // 9 — THE MISSING FLOOR. Scope cleared, nothing judged. Was a PASS at exit 0.
  expect('P4  68 narrow cells, ZERO containers judged (the defect)',
    String(floorVerdict({ derived: 14, narrowCells: 68, asserted: 0 })?.code), '1');
  console.log('        (observed at dd11e38: `--only death` printed PASS/exit 0 over 0 asserted containers,');
  console.log('         and ONE line changed in SCAN\'s overflow filter turned the whole 41-failure sweep green)');

  // 10 — the scope floor, unchanged, now through the shared function.
  expect('P5  no shape rendered narrow',
    String(floorVerdict({ derived: 14, narrowCells: 0, asserted: 0 })?.code), '1');

  // 11 — an --only that matched nothing is usage-red, not a pass.
  expect('P6  --only matched no surface',
    String(floorVerdict({ derived: 14, narrowCells: 0, asserted: 0, only: 'nosuch', matchedOnly: false })?.code), '2');

  // 12 — THE GREEN HALF, and it is the half that matters: a healthy population
  // must pass the floors untouched, or the floors block every real run and the
  // first person to meet them deletes them.
  expect('P7  a real population passes the floors  (must go GREEN)',
    String(floorVerdict({ derived: 14, narrowCells: 68, asserted: 61 })), 'null');

  // 13 — the text cell is the app's closed set, read from the app's own home.
  // `xl` is the exact value that silently became M and printed "Text size xl".
  const known = appTextSizes();
  expect('P8  balance.ui.textSize is readable and closed',
    known.includes('XL') && known.includes('M') && !known.includes('xl') ? 'CLOSED' : `READ ${known.join('|') || 'NOTHING'}`, 'CLOSED');

  // ---------------------------------------------------------------------------
  // 14-18 — THE MODE AXIS (Vega, 2026-08-14; the ruling is Marina's, the words
  // his — D17 msg 3 refused the hand an exemption, D19 grants it to paging,
  // scoped). Both plants enter BY THE REAL DOOR: the mode through ?shotSettings
  // into the app's own resolution, the container collected by SCAN off the
  // rendered combat DOM, judge() ruling on what SCAN handed it — nothing
  // synthetic between the door and the verdict.
  const handFrom = (scan) => scan.containers.find((c) => c.path.split(' > ').pop().split('.').includes('hand'));
  const DECL = `(() => { const e = document.querySelector('.hand'); if (!e) throw new Error('no .hand');
    e.setAttribute('data-scroll-axis', 'x');
    e.setAttribute('data-scroll-axis-mode', 'paging');
    e.setAttribute('data-scroll-axis-why', 'planted: the pager strip is the mode (selftest)');
    return true; })()`;
  const UNDECL = `(() => { const e = document.querySelector('.hand'); if (!e) throw new Error('no .hand');
    e.removeAttribute('data-scroll-axis'); e.removeAttribute('data-scroll-axis-mode');
    e.removeAttribute('data-scroll-axis-why'); return true; })()`;

  // 14 — the overlap door, then THE FIRST PLANT: the declaration typed
  // unconditionally, so it sits in an overlap DOM. The sweep must refuse it
  // whatever the container measures — the exemption may never outlive its mode.
  await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${encodeURIComponent('{"handLayout":"overlap"}')}` }, S);
  await wait(1600);
  await evalIn(DECL);
  const scanO = await evalIn(SCAN);
  expect('M0  the settings door renders overlap  (must go GREEN)', scanO.mode, 'overlap');
  const handO = handFrom(scanO);
  expect('M1  declaration planted unconditionally, judged under overlap',
    handO ? judge(handO, scanO.mode).verdict : 'NEVER COLLECTED', 'FAIL');

  // 15-16 — the paging door: the scoped declaration over the strip's real
  // travel is the GREEN half; THE SECOND PLANT removes it and the same travel
  // goes red undeclared (A1) — the ratchet lane, from the other side.
  await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSettings=${encodeURIComponent('{"handLayout":"paging"}')}` }, S);
  await wait(1600);
  await evalIn(DECL);
  let scanP = await evalIn(SCAN);
  expect('M0  the settings door renders paging  (must go GREEN)', scanP.mode, 'paging');
  let handP = handFrom(scanP);
  console.log(`    (.hand under paging: H ${handP ? Math.round(handP.hx) : '?'}px at 390x844)`);
  expect('M2  scoped declaration + the strip\'s own travel  (must go GREEN)',
    handP ? judge(handP, scanP.mode).verdict : 'NEVER COLLECTED', 'EXCUSED');
  await evalIn(UNDECL);
  scanP = await evalIn(SCAN);
  handP = handFrom(scanP);
  expect('M3  declaration removed under paging — the strip travels undeclared',
    handP ? judge(handP, scanP.mode).verdict : 'NEVER COLLECTED', 'FAIL');

  // ---------------------------------------------------------------------------
  // 19-22 — THE SECOND RENDERER (Vega, 2026-08-14; the finding is Bjorn's gate:
  // coop.js renders its own .hand and combat's exemption never travelled to it —
  // one fact, two renderers, one home). coop's hand implements ONLY the paging
  // strip — no overlap arm, no reader of the word — so its lawful declaration is
  // UNSCOPED (src/ui/handAxis.js): true in every mode. These plants prove both
  // traps by the real doors: the copied scoped string dies under overlap (CM1),
  // and the unscoped truth stands exactly where the copy falls (CM2).
  const SCOPED_COPY = `(() => { const e = document.querySelector('.hand'); if (!e) throw new Error('no .hand');
    e.setAttribute('data-scroll-axis', 'x');
    e.setAttribute('data-scroll-axis-mode', 'paging');
    e.setAttribute('data-scroll-axis-why', 'planted: the scoped combat string, copied onto the coop hand (selftest)');
    return true; })()`;
  const UNSCOPED = `(() => { const e = document.querySelector('.hand'); if (!e) throw new Error('no .hand');
    e.setAttribute('data-scroll-axis', 'x'); e.removeAttribute('data-scroll-axis-mode');
    e.setAttribute('data-scroll-axis-why', 'planted: this renderer implements only the pager (selftest)');
    return true; })()`;

  // 19 — the overlap door on the coop surface (the app's own resolution).
  await cdp.send('Page.navigate', { url: `${base}?shot=coop&shotSettings=${encodeURIComponent('{"handLayout":"overlap"}')}` }, S);
  await wait(1600);
  const scanCO = await evalIn(SCAN);
  expect('CM0 the settings door renders overlap on coop  (must go GREEN)', scanCO.mode, 'overlap');

  // 20 — THE COPY TRAP: combat's mode-scoped declaration pasted onto the coop
  // hand. coop has no overlap arm, so the strip still travels under overlap and
  // the scoped copy sits in a DOM whose word it contradicts — A5 must refuse it.
  await evalIn(SCOPED_COPY);
  const coopO = handFrom(await evalIn(SCAN));
  console.log(`    (coop .hand under overlap: H ${coopO ? Math.round(coopO.hx) : '?'}px at 390x844 — no overlap arm in coop.js)`);
  expect('CM1 combat\'s scoped string copied onto the coop hand, judged under overlap',
    coopO ? judge(coopO, scanCO.mode).verdict : 'NEVER COLLECTED', 'FAIL');

  // 21 — the shape that ships: UNSCOPED, judged in the mode where the copy just
  // died. Renderer-scoped truth must be EXCUSED wherever the strip travels.
  await evalIn(UNSCOPED);
  const coopO2 = handFrom(await evalIn(SCAN));
  expect('CM2 unscoped declaration + the strip\'s travel under overlap  (must go GREEN)',
    coopO2 ? judge(coopO2, scanCO.mode).verdict : 'NEVER COLLECTED', 'EXCUSED');

  // 22 — the head's own defect, planted: no declaration at all, boot default.
  await cdp.send('Page.navigate', { url: `${base}?shot=coop${settingsQ}` }, S);
  await wait(1600);
  const scanCP = await evalIn(SCAN);
  await evalIn(UNDECL);
  const coopP = handFrom(await evalIn(SCAN));
  expect('CM3 coop hand undeclared under paging — travels undeclared',
    coopP ? judge(coopP, scanCP.mode).verdict : 'NEVER COLLECTED', 'FAIL');

  console.log(`\n  ${fails.length ? `SELFTEST FAIL — ${fails.length} mechanism(s) did not behave` : 'SELFTEST PASS — 24 mechanisms, 8 green and 16 red, each observed'}`);
  for (const f of fails) console.log(`    - ${f}`);
}

main().catch((e) => { console.error(`axisfit: ${e.message}`); process.exit(2); });
