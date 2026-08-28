// tools/mapreach.mjs — can a player REACH every map node, and what can they see
// AT REST, at every shape, every text size, every map zoom, on more than one map?
//
// TWO QUESTIONS, AND THEY ARE NOT THE SAME QUESTION. This is the 2026-08-08
// widening and it is the whole point of it, so it goes first.
//
//   "can the player get to every node"    is REACH.    A node the map can bring
//                                                      wholly on screen at some
//                                                      pan offset is REACHED.
//   "is every node visible at rest"       is AT REST.  What the port holds at the
//                                                      offset the map lands on.
//
// A green on the first says NOTHING about the second. Chrome that grows and eats
// the scrollport pushes nodes out of the resting view while every one of them
// stays reachable by panning — a COST, not a defect — and a tool that reports one
// number cannot tell you which of the two just changed. So this file answers both,
// separately, prints both denominators, and floors both (see POPULATION GUARDS).
//
// WHY THIS IS NOT tools/screenreach.mjs. That sweep hit-tests controls AT REST,
// says so in its own boundary, and is right to: it covers six screens and a
// screen has one layout. The act map does not. It is a pannable canvas whose
// node positions are a function of FIVE things:
//
//   viewport shape x TEXT SIZE x the map's own zoom ladder (1 -> 2) x scroll offset x SEED
//
// and the defect that started this was a coincidence between one of those
// positions and a floating button. Sunna measured two map nodes at 412x915
// sitting under the map's own zoom stack — visible, and pressing one zoomed the
// map instead of travelling. Panning did not rescue them: the canvas slides, the
// buttons do not, so a different node takes the trap. #24 had already "fixed"
// this once, at 390x844, with `padding-bottom` on the canvas — which pads the
// CONTENT while the buttons were pinned to the SCROLLPORT, so it held at exactly
// the offset it was measured at. A check that reads one shape at one offset on
// one seed cannot tell that fix from a real one. Both are green.
//
// AND ONE MAP WAS NOT THE MAP. Until EldenSpire#28 the ?shot=map seed was a
// literal, so every reachability number this repo has ever printed about the act
// map described a single graph. `?shotSeed=` exists for this tool.
//
// AND THE TEXT AXIS DID NOT EXIST HERE AT ALL, WHICH IS WHY THIS FILE CHANGED.
// #117 made the map's zoom buttons meet the 44px tap floor. The taller bar took
// 17-35 CSS px of scrollport, and at four cells it took a node's standing room:
//
//   320x640 Text S  18 -> 17 nodes wholly inside at rest
//   320x640 Text M  18 -> 17
//   360x640 Text L  16 -> 15
//   360x640 Text XL 15 -> 14
//
// mapreach printed PASS over 918 readings at that ref and was RIGHT to: nothing
// was trapped and nothing became unreachable. It was also SILENT, because
// 320x640 was not in its shape list and it never varied text size. THE FOUR
// CELLS WERE EXACTLY THE CELLS THIS TOOL COULD NOT SEE. A green whose population
// excludes the cells where the defect lives is a green with a hole in it, and
// widening the population is the fix — not a new threshold.
//
// WHAT IT ASSERTS — four checks. The first is the one that closes the class:
//
//   STRUCTURE (per shape x text): the zoom bar is not inside the map scrollport's
//     subtree and is laid out in normal flow. Exact, structural, no geometry and
//     no threshold: an element outside the scrolled subtree, in the flow, cannot
//     be over the scrolled content at ANY offset, on ANY seed, at ANY zoom.
//
//   TRAPPED (per cell x pan offset): no map node that is WHOLLY inside the
//     scrollport's visible client box is answered by something else on a hit-test
//     at its centre.
//
//   REACH (per cell): every node can be brought wholly inside the visible port by
//     scrolling, AND is untrapped there. Feasible offsets are computed exactly
//     from each node's content-space box (no grid to step over a node), then the
//     tool SCROLLS THERE AND LOOKS. Analytic and empirical must agree; a
//     disagreement is red, not a rounding footnote.
//
//   AT REST (per cell): the resting view is reported as `n/N wholly inside`, and
//     two things about it are asserted — at least one node is wholly inside
//     (a resting map you can tap nothing on is a defect), and every node the
//     game marks `.reachable` — the ones it is inviting you to press right now —
//     is wholly inside and untrapped AT THE CAMERA THE GAME CHOSE. The COUNT is
//     reported, never asserted: a fixed floor on it would be a number fitted to
//     today's chrome, and the count legitimately falls as text grows. Read it as
//     the price tag. After a manual + or - the offset is a residue of the
//     player's own action, so an invited node off that screen is REPORTED with
//     its magnitude, not failed on — see the note at the check itself.
//
// Structure is what makes the trap impossible; trapped is the known-bad that
// proves structure is worth having; reach and at-rest are the two questions the
// player actually has. Keep all four: the invariant alone would pass a tree where
// somebody re-armed the overlay by a different mechanism, and the symptom alone
// is a property of whichever seed you happened to sweep.
//
// WHY "WHOLLY INSIDE" AND NOT "CENTRE INSIDE", and it is not a fitted number.
// Under a fractional --ui-zoom two abutting boxes share a seam that Chromium
// hit-tests to the lower one for up to ~0.8 CSS px: measured at 360x640, the
// scrollport ends at y=606.22 and elementFromPoint(x, 605.5) already answers
// .map-zoom. A node centre in that seam belongs to a node that is ~2% visible at
// the very bottom edge, which no player is aiming at and one pixel of scrolling
// reveals. Requiring the whole node box inside the port draws the line at
// "visible enough to invite a tap" rather than at a tolerance, and it is
// deliberately STRICTER than screenreach's centre test everywhere else: a node
// fully on screen and under a button is exactly the defect, at any offset.
//
// POPULATION GUARDS — a green is a claim about a population, so the population
// is checked before the green is printed. Each of these exits 2 (unknown), never
// 1 (red) and never 0: they say "this run did not test what it says it tested."
//
//   1. NODE COUNT AGREES ACROSS EVERY CELL OF A SEED. The graph is a function of
//      the seed alone. A cell that reads 6 nodes where its siblings read 44 half
//      mounted, and its clean sweep is meaningless. Derived from the run, never
//      typed: no constant to drift (Law 1 clause 2).
//   2. THE TEXT AXIS MUST BE OBSERVED TO MOVE. Four text sizes that render at one
//      root font-size are one reading printed four times. This guard exists
//      because the author's last two instruments both passed against a tree he
//      knew was broken — one pressed `+` then `-` on one board and reported that
//      the keys did nothing. A swept axis that does not move IS that bug.
//   3. THE AT-REST ASSERTION MUST HAVE A SUBJECT. Zero `.reachable` nodes means
//      the strongest at-rest check ruled on nothing (SOP 2's referent clause) —
//      unknown, not a pass.
//   4. CONTENT-SPACE BOXES MUST BE STABLE UNDER SCROLL — MEASURED AGAINST A
//      CONTROL. REACH is solved from the claim that a node's position in the
//      canvas does not depend on where the canvas is scrolled to. That claim is
//      measured per cell: read at rest, read AGAIN at rest, then read at
//      mid-travel. The standstill pair is the control, because the nodes are
//      ANIMATED (map.css:100, stroke-width 3 -> 5.5) and a stroked circle's box
//      breathes; without the control the animation reads as scroll drift, which
//      is what the first draft of this guard reported at 8.69 local px. Only the
//      EXCESS over the control is evidence about scroll. Both numbers are
//      printed, and the larger is spent as a solve margin.
//   5. Shapes, readings and structure checks must all be non-zero (the original
//      guard, kept).
//
// Usage
//   node tools/mapreach.mjs                       source tree via tools/serve.mjs
//   node tools/mapreach.mjs --dist                dist/AshenSpire.html over file://
//   node tools/mapreach.mjs --only 320x640
//   node tools/mapreach.mjs --texts S,XL          default S,M,L,XL
//   node tools/mapreach.mjs --seeds SHOWCASE,FOO  --steps 4  --quick
//   node tools/mapreach.mjs --mutate[=bar|chrome|clamp|text]   must go red
//   CHROME=/path/to/chrome node tools/mapreach.mjs
//
// Exit codes
//   0  nothing trapped, every node reachable, the structure holds
//   1  a trapped node, an unreachable node, a resting view with nothing in it,
//      a `.reachable` node off the resting screen, or the bar back over the canvas
//   2  usage / no browser / a screen that would not mount / a population guard
//      tripped / --mutate not caught  — never a pass

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// THIS IS THE THIRD SHAPE LIST IN tools/ AND IT IS A KNOWN DEFECT, NOT A DESIGN
// — AND IT IS, VERBATIM, A RE-OPEN TRIGGER ON EldenSpire#28.
//
// #28 says: "Re-opened if the shape leaves either list, if A THIRD INSTRUMENT
// LANDS WITH A FOURTH LIST, or if a control is found covered at any shape in
// either list." This file is that third instrument. I am not going to let that
// clause be discovered by someone else later: screenreach.mjs carries four
// shapes, mobilefit.mjs nine, this one seven, and #28's condition 3 — one fact,
// which shapes we support, must not have independent homes — is further from
// met than it was before I wrote this.
//
// It is written this way anyway, for one reason: screenreach.mjs is being
// rewritten on two unmerged branches at once (Sunna's 6f4a9bd, Rune's 7d784a2)
// and a third uncoordinated edit to it was the collision the family had already
// decided to avoid. So the choice was a fourth list or a fourth touch, and the
// fourth list is the one that is visible in a diff and cannot merge silently.
// The collapse — one module, three importers — belongs to the tools-only PR that
// already has to reconcile that file, and it should absorb this list with the
// other two rather than after them.
//   412x915 is the shape the defect was found at.
//   884x1326 is the tablet that takes data-layout=narrow at zoom 1.70 — the one
//     shape where the narrow rules fire in 520 local px instead of ~433.
//   320x640 was ADDED 2026-08-08 and it did not invent a shape: menufit.mjs,
//     actionreach.mjs and tapsize.mjs already carry it, so the house has
//     supported it for longer than this sweep has existed. It is the smallest
//     shape we claim, it is where #117's node loss was worst, and its absence
//     here is the reason this tool was silent about it. Adding it makes the
//     shape-list drift WORSE by one row and better by one cell; the collapse
//     above is now overdue by five lists, not three, and that is the honest
//     accounting rather than a reason to leave the hole open.
const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 412, h: 915, d: 2.6, mobile: true, tag: 'portrait' },
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 320, h: 640, d: 2, mobile: true, tag: 'portrait-smallest' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
  { w: 884, h: 1326, d: 2, mobile: true, tag: 'tablet-narrow' },
];

// The accessibility text control, S/M/L/XL. NO PERCENTAGES ARE TYPED HERE — the
// four percentages live in content/balance.js (balance.ui.textSize) and three
// other tools in this directory each keep their own copy of them, which is a
// Law 1 clause 2 defect I am not adding a fifth instance of. These are the
// setting's own VALUES, handed to the game through ?shotSettings= so that what
// gets measured is applyDisplaySettings() resolving them, never this file's idea
// of what S means. Guard 2 then checks the game actually moved.
const TEXTS = ['S', 'M', 'L', 'XL'];

// More than one map, because one map is an anecdote. SHOWCASE is the literal
// every other tool and every screenshot in this repo uses, kept first so this
// sweep and those agree about at least one graph.
//
// THE HYPHENS ARE GONE AND THEY WERE NOT COSMETIC. These two read `MAPREACH-B`
// and `MAPREACH-C` from the day this tool was written until 2026-08-08, and
// NEITHER OF THEM WAS A SEED. src/engine/rng.js:137 defines the seed alphabet as
// 35 characters — digits and A-Z with no O — and `seedFromString` THROWS on any
// character outside it. `-` is outside it. main.js:561 catches that throw and
// substitutes `seedFromString(randomSeedString())`, which is `Math.random()`.
// So every boot of `?shotSeed=MAPREACH-B` built A DIFFERENT MAP, silently:
// measured at one shape, six boots of one URL returned 39, 38, 36, 29, 35 and 35
// nodes with six different graphs, while `SHOWCASE` returned 44 nodes and one
// fingerprint six times out of six — and passing NO shotSeed at all returned
// that same fingerprint, which is the tell that the parameter was doing nothing.
//
// What that costs, stated plainly: this tool's "three seeds" was one seed and
// two unrepeatable random maps. Its sweep was WIDER than advertised and its
// evidence was NOT RE-RUNNABLE — a red found on seed B could not be reproduced
// by anyone, including the run that found it. Quality Gate check 1, failed by
// the instrument rather than by the thing measured. The node-count guard below
// caught it and exited 2; that is the only reason this paragraph exists.
//
// `MAPREACHB` and `MAPREACHC` are inside the alphabet, verified by the two-boot
// preflight below rather than by me re-implementing the parser here.
const SEEDS = ['SHOWCASE', 'MAPREACHB', 'MAPREACHC'];

// Clicks on the map's own zoom control before reading. 0 is where the player
// lands; +4 walks the ladder to its 2x ceiling, which is what makes the canvas
// overflow the port horizontally and puts nodes against the right edge where a
// bottom-right stack lives. -1 is the other end.
const ZOOMS = [0, 4, -1];

// HOW THE FIVE AXES ARE CROSSED, stated because a sampling scheme nobody wrote
// down is a sampling scheme nobody can audit. Full cross is 7 x 4 x 3 x 3 cells
// and roughly an hour. So: every text size is crossed with every shape and every
// map zoom on the FIRST seed, and every extra seed is crossed with every shape
// and every map zoom at the DEFAULT text size. The text x extra-seed corner is
// therefore UNSWEPT — named in the boundary, not silently dropped. It is the
// right corner to leave: text size changes the CHROME (how much port is left),
// the seed changes the GRAPH (where nodes are), and #117's loss lived in the
// first at the first seed. A defect that needs both a rare seed and a non-default
// text size to appear would be missed by this run.
const TEXT_DEFAULT = 'M';

// GUARD 4 HAS NO TYPED TOLERANCE, AND THE FIRST DRAFT OF IT DID — that is worth
// the paragraph, because the number looked measured and was fitted.
//
// REACH is solved from each node's CONTENT-SPACE box: where it sits in the
// canvas, independent of where the canvas is scrolled. That is a claim, so the
// tool measures it — read every node, scroll to the middle of the travel, read
// again, and take the worst disagreement. On the shipped tree it is sub-pixel at
// map zoom 0 (0.97 local px at 320x640, 0.82 at 360x640): the conversion from
// visual px (getBoundingClientRect) to local px (scrollLeft) runs through a
// fractional --ui-zoom, so a rect rounding lands here divided by the zoom.
//
// The first draft turned those two readings into `DRIFT_CEILING = 2.0` and
// voided any cell above it. Then the map-zoom +4 cells came in at 2.13, 2.32 and
// 2.93 — the same artefact on a canvas scaled twice as big — and the guard
// declared four healthy cells unknown. A ceiling drawn around the cells I had
// already looked at is the identical mistake as a shape list drawn around them,
// which is the mistake this whole file is being widened to fix.
//
// So the drift is no longer a threshold. It is a MARGIN, measured per cell and
// carried into the solve: a window is only called empty when it is empty by more
// than the drift observed in that very cell, and a node whose window is thinner
// than the drift is reported UNKNOWN rather than counted either way. The verdict
// that matters stays empirical — the tool scrolls to the solved offset and looks.
// The only thing left that can void a cell is derived from the frame, not typed:
// drift as large as the smallest node's own box means content space is not
// invariant in any useful sense, and nothing here can be believed.

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const quick = args.includes('--quick');
const mutateArg = args.find((a) => a === '--mutate' || a.startsWith('--mutate='));
const mutate = mutateArg ? (mutateArg.split('=')[1] || 'bar') : null;
const seeds = (argOf('--seeds') || (quick ? 'SHOWCASE' : SEEDS.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const texts = (argOf('--texts') || (quick ? TEXT_DEFAULT : TEXTS.join(','))).split(',').map((s) => s.trim()).filter(Boolean);
const zooms = quick ? [0] : ZOOMS;
const steps = Number(argOf('--steps') || (quick ? 3 : 4));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A FILTER THAT MATCHES NOTHING IS A USAGE ERROR, NOT A PASS. Checked against
// the table before a browser is launched, so the message names the typo and the
// legal values. This is the house's `verify-shipped: OK — 0 checks passed`
// shape, and it has been shipped four times; screenreach printed
// `PASS — no covered controls` for `--only 412x915` on the very shape carrying
// this defect.
if (only && !SHAPES.some((v) => `${v.w}x${v.h}` === only)) {
  console.error(`mapreach: --only ${only} matched no shape. Nothing would be tested, so this is unknown, not a pass.`);
  console.error(`  shapes: ${SHAPES.map((v) => `${v.w}x${v.h}`).join(', ')}`);
  process.exit(2);
}
// Same rule one axis over: --texts XXL would sweep a setting the game ignores and
// print four identical cells as four. Guard 2 would catch it after the fact;
// this catches it before a browser starts.
const badText = texts.find((t) => !TEXTS.includes(t));
if (badText) {
  console.error(`mapreach: --texts ${badText} is not a text size. Nothing would vary, so this is unknown, not a pass.`);
  console.error(`  sizes: ${TEXTS.join(', ')}`);
  process.exit(2);
}
const MUTATIONS = ['bar', 'chrome', 'clamp', 'text'];
if (mutate && !MUTATIONS.includes(mutate)) {
  console.error(`mapreach: --mutate=${mutate} is not a known-bad. Known-bads: ${MUTATIONS.join(', ')}`);
  process.exit(2);
}

// FOUR KNOWN-BADS, ONE PER ASSERTION, because a check whose failing case nobody
// has watched fail is `unknown`, not green (development.md, The instrument rule)
// — and one mutation that only proves TRAPPED can go red says nothing about the
// three checks added beside it. Nothing on disk is touched; dev is a moving
// target, so each known-bad travels inside the tool rather than living at a ref
// that ages out.
const MUTATE = {
  // TRAPPED's known-bad, unchanged: put the bar back inside the scrollport,
  // absolutely positioned bottom-right, which is byte-for-byte the geometry dev
  // shipped before #28.
  bar: `(() => {
    const sc = document.querySelector('.map-scroll'), bar = document.querySelector('.map-zoom');
    if (!sc || !bar) return 'no map';
    sc.style.position = 'relative';
    sc.appendChild(bar);
    bar.style.position = 'absolute';
    bar.style.right = '1.4rem'; bar.style.bottom = '1.4rem';
    bar.style.left = 'auto'; bar.style.top = 'auto';
    bar.style.flexDirection = 'row'; bar.style.zIndex = '5';
    bar.style.borderTop = 'none'; bar.style.padding = '0';
    return 'armed';
  })()`,
  // AT REST's known-bad, and it is #117's defect taken to its limit rather than a
  // different bug: chrome in the flow growing until the resting port holds
  // nothing. #117 cost one node at four cells; this costs all of them. Same
  // mechanism, past the point where "cost" stops being the honest word.
  chrome: `(() => {
    const bar = document.querySelector('.map-zoom');
    if (!bar) return 'no bar';
    bar.style.minHeight = '3000px';
    return 'armed';
  })()`,
  // REACH's known-bad: a map that cannot pan. Every node outside the resting port
  // becomes unreachable while remaining perfectly untrapped, which is exactly the
  // failure TRAPPED and STRUCTURE are both blind to.
  clamp: `(() => {
    const sc = document.querySelector('.map-scroll');
    if (!sc) return 'no scrollport';
    sc.style.overflow = 'hidden';
    sc.scrollLeft = 0; sc.scrollTop = 0;
    Object.defineProperty(sc, 'scrollLeft', { get: () => 0, set: () => {} });
    Object.defineProperty(sc, 'scrollTop', { get: () => 0, set: () => {} });
    return 'armed';
  })()`,
  // POPULATION GUARD 2's known-bad, and the reason this list has four entries.
  // Pin the root font-size so the text setting renders identically at S, M, L and
  // XL. Every other check stays green — correctly — and the run must still refuse
  // to pass, because it swept one cell four times and called it four.
  text: `(() => {
    document.documentElement.style.setProperty('font-size', '10px', 'important');
    return 'armed';
  })()`,
};

const STRUCTURE = `(() => {
  const sc = document.querySelector('.map-scroll'), bar = document.querySelector('.map-zoom');
  if (!sc || !bar) return { ok: false, why: 'map scrollport or zoom bar missing' };
  if (sc.contains(bar)) return { ok: false, why: 'the zoom bar is INSIDE the map scrollport subtree' };
  const pos = getComputedStyle(bar).position;
  if (pos !== 'static' && pos !== 'relative') return { ok: false, why: 'the zoom bar is out of flow (position: ' + pos + ')' };
  return { ok: true, why: 'bar is a flow sibling of the scrollport' };
})()`;

// One reading at whatever offset the map currently holds. Returns BOTH the
// visual-px verdict (trapped) and the LOCAL-px content-space geometry that REACH
// is computed from, so the two questions come off one observation of one frame
// and cannot disagree about what they were looking at.
const READ = `(() => {
  const de = document.documentElement, app = document.getElementById('app');
  const sc = document.querySelector('.map-scroll');
  const p = sc.getBoundingClientRect();
  // THE CLIENT BOX, AND IN THE ROOM THE RECTS ARE STANDING IN.
  // getBoundingClientRect is VISUAL px; clientLeft/clientWidth/clientHeight and
  // scrollLeft/scrollTop are LOCAL px, and the app is under a CSS zoom. Adding
  // one to the other put the port's bottom edge 116px below where it was and made
  // the FIXED tree measure worse than the defective one. The ratio is derived
  // from this element, not read from --ui-zoom, so it cannot disagree with the
  // box it is converting. clientWidth also excludes the scrollbar gutter, which
  // the rect includes — without that, ten nodes under a working desktop scrollbar
  // read as trapped.
  const zr = p.width / (sc.offsetWidth || p.width);
  const cl = p.left + sc.clientLeft * zr, ct = p.top + sc.clientTop * zr;
  const b = {
    left: Math.max(cl, 0),
    top: Math.max(ct, 0),
    right: Math.min(cl + sc.clientWidth * zr, innerWidth),
    bottom: Math.min(ct + sc.clientHeight * zr, innerHeight),
  };
  // The same visible slice expressed in LOCAL px as an offset inside the client
  // box. A port hanging off the bottom of the viewport is a smaller port, and
  // REACH has to solve against the part a player can actually see.
  const eff = {
    l: Math.max(0, (0 - cl) / zr),
    t: Math.max(0, (0 - ct) / zr),
    r: Math.min(sc.clientWidth, (innerWidth - cl) / zr),
    b: Math.min(sc.clientHeight, (innerHeight - ct) / zr),
  };
  const nodes = [...document.querySelectorAll('.map-node')];
  const out = []; const trapped = []; let inPlay = 0;
  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i];
    const r = c.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { out.push(null); continue; }
    const cls = c.getAttribute('class') || '';
    const rec = {
      i,
      label: (c.textContent || '?').trim(),
      reachableClass: /(^|\\s)reachable(\\s|$)/.test(cls),
      currentClass: /(^|\\s)current(\\s|$)/.test(cls),
      // content space: where this node sits in the canvas, independent of scroll
      cx0: (r.left - cl) / zr + sc.scrollLeft, cx1: (r.right - cl) / zr + sc.scrollLeft,
      cy0: (r.top - ct) / zr + sc.scrollTop, cy1: (r.bottom - ct) / zr + sc.scrollTop,
      whole: false, trapped: false, hit: '',
    };
    // WHOLLY inside the port — see the header. A partly-clipped node at the edge
    // is the scroll's business, not a trap.
    if (!(r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom)) {
      rec.whole = true; inPlay++;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (!(hit && (hit === c || c.contains(hit)))) {
        rec.trapped = true;
        rec.hit = hit ? ((hit.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 10) + ' .' + (typeof hit.className === 'string' ? hit.className.trim().split(/\\s+/)[0] : hit.tagName)) : 'null';
        trapped.push(rec.label + ' at ' + Math.round(x) + ',' + Math.round(y) + '  <-  ' + rec.hit);
      }
    }
    out.push(rec);
  }
  return {
    rootFont: getComputedStyle(de).fontSize,
    zoom: getComputedStyle(de).getPropertyValue('--ui-zoom').trim(),
    layout: de.getAttribute('data-layout'),
    local: app.clientWidth + 'x' + app.clientHeight,
    port: { cw: sc.clientWidth, ch: sc.clientHeight, eff },
    travel: [sc.scrollWidth - sc.clientWidth, sc.scrollHeight - sc.clientHeight],
    at: [sc.scrollLeft, sc.scrollTop],
    nodes: nodes.length, inPlay, trapped, rows: out,
  };
})()`;

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
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

// The offsets at which a node can be seen whole, solved rather than sampled.
// A node spanning [cx0,cx1] is wholly inside the visible slice at scroll S iff
// S + eff.l <= cx0 and cx1 <= S + eff.r, i.e. S in [cx1-eff.r, cx0-eff.l], and
// the scrollport can only offer S in [0, travel]. Intersect and you have the
// exact answer, including "empty — no offset shows this node whole", which is
// what an unreachable node IS. A 4x4 grid can step straight over a node whose
// window is 30px wide and report it unreachable; this cannot.
// `slack` is the drift measured in this cell (guard 4), spent as a margin in the
// generous direction: a window counts as existing if it exists at all once the
// measurement's own error is allowed for. Windows thinner than the drift are
// neither reachable nor unreachable — they are `thin`, and the caller reports
// them as unknown rather than guessing.
function window1d(lo0, hi0, effLo, effHi, travel, slack) {
  const lo = Math.max(0, hi0 - effHi);
  const hi = Math.min(travel, lo0 - effLo);
  return { lo, hi, width: hi - lo, ok: lo <= hi + slack, thin: hi - lo < slack };
}
function feasible(rec, port, travel, slack) {
  const x = window1d(rec.cx0, rec.cx1, port.eff.l, port.eff.r, travel[0], slack);
  const y = window1d(rec.cy0, rec.cy1, port.eff.t, port.eff.b, travel[1], slack);
  return {
    x, y, ok: x.ok && y.ok, thin: (x.ok && y.ok) && (x.thin || y.thin),
    mid: [(x.lo + x.hi) / 2, (y.lo + y.hi) / 2],
  };
}

async function main() {
  if (!browserPath) { console.error('mapreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'mapreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`mapreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8266), open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`mapreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);
  console.log(`  seeds ${seeds.join(', ')} · text ${texts.join(',')} · map-zoom clicks ${zooms.join(', ')} · ${steps}x${steps} pan offsets + solved reach offsets${mutate ? `  ·  --MUTATE=${mutate}: a known-bad is armed and MUST be caught` : ''}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const evalIn = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  // ASK, THEN CHECK IT TOOK. An instrument that assumes its own action worked is
  // the bug the author shipped twice in one file the night before this was
  // written (a probe that pressed `+` then `-` and reported that the keys did
  // nothing). A scrollport that has stopped scrolling answers every subsequent
  // reading with the same frame, and REACH would report that as "solved an offset
  // and the node was not there" — true, and a lie about why.
  const setScroll = async (x, y) => {
    await evalIn(`(() => { const s = document.querySelector('.map-scroll'); s.scrollLeft = ${x}; s.scrollTop = ${y}; })()`);
    return evalIn(`(() => { const s = document.querySelector('.map-scroll'); return [s.scrollLeft, s.scrollTop, s.scrollWidth - s.clientWidth, s.scrollHeight - s.clientHeight]; })()`);
  };
  // Chromium clamps a requested offset to the travel and rounds it, so the test
  // is against the clamped target, not the raw ask.
  const scrollTook = (want, got) => {
    const [wx, wy] = want, [gx, gy, tx, ty] = got;
    const cx = Math.max(0, Math.min(tx, wx)), cy = Math.max(0, Math.min(ty, wy));
    return Math.abs(gx - cx) <= 1.5 && Math.abs(gy - cy) <= 1.5;
  };

  // The cells: text is crossed with the first seed, extra seeds ride at the
  // default text size. See the note on TEXT_DEFAULT.
  const cells = [];
  for (const t of texts) cells.push({ seed: seeds[0], text: t });
  for (const sd of seeds.slice(1)) if (!cells.some((c) => c.seed === sd && c.text === TEXT_DEFAULT)) cells.push({ seed: sd, text: TEXT_DEFAULT });

  // ---- PREFLIGHT: IS EACH SEED A SEED? Two boots of the same URL at the first
  // swept shape; same node count and same graph fingerprint, or the value is not
  // seeding anything and every cell under it is unrepeatable. This exists
  // because two of this file's own three seeds were not seeds for its whole life
  // (see SEEDS above). The node-count guard finds it too, but only once a seed
  // has two cells to disagree between — `--quick --seeds X` gives it one, and a
  // hole that closes only on the long run is a hole. Two boots, before anything
  // else runs, is the floor under the seed axis.
  //
  // It compares the ARTIFACT, not the parser: node count plus the node-type
  // string in DOM order. Re-implementing rng.js's alphabet here would be a
  // second copy of the rule (Law 1 clause 2) and would agree with itself.
  const FINGERPRINT = `(() => {
    const ns = [...document.querySelectorAll('.map-node')];
    const t = ns.map((n) => (n.getAttribute('class') || '').split(/\\s+/)[1] || '?').join(',');
    let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return ns.length + ':' + (h >>> 0).toString(16);
  })()`;
  {
    const vp0 = SHAPES.find((v) => !only || `${v.w}x${v.h}` === only) || SHAPES[0];
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp0.w, height: vp0.h, deviceScaleFactor: vp0.d, mobile: vp0.mobile }, S);
    const notSeeds = [];
    for (const sd of seeds) {
      const got = [];
      for (let k = 0; k < 2; k++) {
        await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSeed=${encodeURIComponent(sd)}&shotSettings=${encodeURIComponent(JSON.stringify({ textSize: TEXT_DEFAULT }))}` }, S);
        const t0 = Date.now(); let up = false;
        while (Date.now() - t0 < 12000) { if (await evalIn(`!!document.querySelector('.map-node')`).catch(() => false)) { up = true; break; } await wait(150); }
        if (!up) { got.push('did-not-mount'); continue; }
        await wait(700);
        got.push(await evalIn(FINGERPRINT));
      }
      const ok = got[0] === got[1] && got[0] !== 'did-not-mount';
      console.log(`  seed ${sd.padEnd(12)} two boots -> ${got.join('  ')}   ${ok ? 'repeatable' : 'NOT A SEED'}`);
      if (!ok) notSeeds.push(`seed '${sd}' is not repeatable: two boots of the same URL gave ${got.join(' and ')}. Every cell swept under it would be a different map, so nothing found there could be re-run.`);
    }
    if (notSeeds.length) {
      console.error(`\nmapreach: ${notSeeds.length} of ${seeds.length} seed value(s) do not seed anything. Refusing to sweep — an unrepeatable population is unknown, not a pass.`);
      for (const n of notSeeds) console.error(`    - ${n}`);
      cdp.close(); child.kill(); if (server) server.close();
      process.exit(2);
    }
  }

  const fails = [];
  const unknowns = [];
  // Observations that are neither a pass-breaker nor a doubt about the run:
  // measured, printed, and carried to whoever owns the surface. They never
  // change the exit code, and a note that nobody ever acts on is this list
  // becoming decoration — say so out loud rather than letting it grow.
  const notes = [];
  let shapesRun = 0, readings = 0, structureChecks = 0, restChecks = 0, reachChecks = 0;
  const nodeCountBySeed = new Map();   // guard 1
  const fontsByShape = new Map();      // guard 2
  let worstDrift = 0, worstDriftAt = '';

  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    shapesRun++;
    console.log(`\n  ${shape} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    for (const cell of cells) {
      const { seed, text } = cell;
      for (const zc of zooms) {
        // `?…`, never `#?…`, on file:// as well as http:// — the shot hook reads
        // location.search, so a hash puts every parameter somewhere nothing
        // looks. The first draft did that and --dist mounted no map at all: the
        // unknown-guard below exited 2 rather than printing a green over six
        // shapes it had not tested, which is the only reason this is a footnote.
        //
        // textSize rides ?shotSettings= so the GAME resolves it (main.js writes
        // it through saves.saveMeta and applyDisplaySettings picks it up). The
        // alternative — this file setting html{font-size} itself — would measure
        // the instrument's copy of the rule, which is the defect Vira caught in
        // contrast-audit.mjs and made a merge condition on #10.
        const st = encodeURIComponent(JSON.stringify({ textSize: text }));
        await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSeed=${encodeURIComponent(seed)}&shotSettings=${st}` }, S);
        const t0 = Date.now(); let up = false;
        while (Date.now() - t0 < 12000) { if (await evalIn(`!!document.querySelector('.map-node')`).catch(() => false)) { up = true; break; } await wait(150); }
        if (!up) { console.log(`    seed ${seed} text ${text} DID NOT MOUNT — never a pass`); fails.push(`${shape} seed ${seed} text ${text}: the map would not mount`); continue; }
        await wait(900); // auto-zoom re-flexes on a 150ms debounce plus a boot re-apply
        // Arming a known-bad CHANGES LAYOUT, and the map re-centres on a
        // ResizeObserver. Reading straight after the mutation caught the frame
        // mid-reflow and reported 16 nodes at rest where the settled frame holds
        // 17 — a spurious red on the at-rest check, in the tool written to stop
        // exactly that. The settle is the same debt the boot wait above pays.
        if (mutate) { await evalIn(MUTATE[mutate]); await wait(500); }
        // 1200ms, NOT 300 — and the number was bought with a wrong answer.
        // At 300 this sweep reported the invited node ON screen at 1200x730 Text
        // S after one `-` press and OFF at M, L and XL. A direct probe with a
        // 1500ms settle finds it off at ALL FOUR, by 7.8/9.8/11.9/13.8 px. The
        // S cell was not a passing cell, it was an unfinished reflow: the map
        // rescales, re-clamps the scroll and re-flexes on its own debounce, and
        // reading at 410ms total caught the frame before the clamp landed. A
        // check whose verdict depends on how fast the machine is is not a check.
        if (zc) { for (let k = 0; k < Math.abs(zc); k++) { await evalIn(`document.querySelector('#${zc > 0 ? 'zoom-in' : 'zoom-out'}').click()`); await wait(140); } await wait(1200); }

        // Structure is a property of the shape, not of the seed or the offset.
        if (seed === cells[0].seed && text === cells[0].text && zc === zooms[0]) {
          structureChecks++;
          const st2 = await evalIn(STRUCTURE);
          console.log(`    STRUCTURE  ${st2.ok ? 'ok' : 'FAIL'} — ${st2.why}`);
          if (!st2.ok) fails.push(`${shape}: STRUCTURE — ${st2.why}`);
        }

        const rest = await evalIn(READ); readings++;
        const cellName = `${shape} seed ${seed} text ${text} mapzoom ${zc}`;

        // ---- guard 1: the graph is the seed's, so every cell must agree on it
        const seen = nodeCountBySeed.get(seed);
        if (seen == null) nodeCountBySeed.set(seed, { n: rest.nodes, where: cellName });
        else if (seen.n !== rest.nodes) unknowns.push(`node count disagrees for seed ${seed}: ${seen.n} at ${seen.where} vs ${rest.nodes} at ${cellName}. The graph is supposed to be a function of the seed alone, so either a map did not finish mounting or the seed is not being honoured — both make this seed's cells unreadable.`);

        // ---- guard 2: did the text setting actually render differently?
        if (seed === cells[0].seed && zc === zooms[0]) {
          if (!fontsByShape.has(shape)) fontsByShape.set(shape, new Map());
          fontsByShape.get(shape).set(text, rest.rootFont);
        }

        // ---- AT REST
        restChecks++;
        const restRows = rest.rows.filter(Boolean);
        const restWhole = restRows.filter((r) => r.whole);
        const invited = restRows.filter((r) => r.reachableClass || r.currentClass);
        if (invited.length === 0) unknowns.push(`${cellName}: the map marked NO node .reachable or .current, so the at-rest check ruled on nothing`);
        const invitedOut = invited.filter((r) => !r.whole);
        const invitedTrapped = invited.filter((r) => r.whole && r.trapped);
        if (restWhole.length === 0) fails.push(`${cellName}: AT REST the port holds no whole node at all — nothing to tap without panning`);
        for (const r of invitedTrapped) fails.push(`${cellName}: AT REST the invited node '${r.label}' is covered by ${r.hit}`);
        // WHICH CAMERA CHOSE THIS OFFSET decides whether an invited node off the
        // screen is a broken promise or a player's own pan, and the two are not
        // the same claim.
        //   zc === 0  — the offset is the GAME'S: centerAndFocus() ran at boot and
        //     put the camera where the game wanted it. A node the game marks
        //     .reachable and its own camera does not show whole is the game
        //     failing its own promise. RED.
        //   zc !== 0  — the offset is a RESIDUE: the player pressed + or -, the
        //     canvas rescaled and the scroll re-clamped, and nothing re-centred.
        //     Nobody chose this frame, and the game already ships the remedy as
        //     the ⊙ button beside the one that caused it. Asserting here would be
        //     asserting a design decision no one made, so it is REPORTED with its
        //     magnitude and left to the seats who own the camera.
        // Written this way because the check went red at five cells first and the
        // scoping came after: the measurement is in the log either way, and the
        // number is printed at every cell so nobody has to take this on trust.
        for (const r of invitedOut) {
          const line = `${cellName}: the game invites '${r.label}' (${r.reachableClass ? 'reachable' : 'current'}) and it is not wholly on screen`;
          if (zc === 0) fails.push(`AT REST ${line}`);
          else notes.push(`AFTER ${zc > 0 ? '+' : '−'}${Math.abs(zc)} ${line}`);
        }

        // ---- guard 4: is content space actually invariant under scroll?
        //
        // WITH A CONTROL, AND THE FIRST DRAFT HAD NONE. It read once at rest,
        // scrolled to mid-travel, read again, and called the difference "drift
        // under scroll". At 1200x730 that printed 8.69 local px and I believed it
        // for about a minute. THE NODES ARE ANIMATED: styles/map.css:100
        // `@keyframes nodePulse { stroke-width: 3 -> 5.5 }` on .map-node.current
        // and `reachStroke` on .map-node.reachable, and an SVG circle's bounding
        // box grows with its stroke. The box breathes on a 1.5s cycle, so two
        // readings taken a moment apart differ WHEREVER THEY ARE TAKEN, and I was
        // attributing all of it to the scroll.
        //
        // So: read at rest, read AGAIN AT REST (the control), then read at
        // mid-travel. `noise` is what two readings of the same frame disagree by;
        // `moved` is what two readings across a scroll disagree by. Only the
        // excess is evidence about scroll at all. Both are printed, because a
        // tool that hides which half of its error is its own subject's motion is
        // the tool I was about to ship.
        const [tx, ty] = rest.travel;
        let drift = 0, noise = 0;
        {
          const ctl = await evalIn(READ); readings++;
          for (const a of restRows) {
            const c = ctl.rows[a.i]; if (!c) continue;
            noise = Math.max(noise, Math.abs(a.cx0 - c.cx0), Math.abs(a.cy0 - c.cy0));
          }
        }
        if (tx > 4 || ty > 4) {
          await setScroll(Math.round(tx / 2), Math.round(ty / 2)); await wait(60);
          const probe = await evalIn(READ); readings++;
          for (const a of restRows) {
            const bb = probe.rows[a.i]; if (!bb) continue;
            drift = Math.max(drift, Math.abs(a.cx0 - bb.cx0), Math.abs(a.cy0 - bb.cy0));
          }
          if (drift > worstDrift) { worstDrift = drift; worstDriftAt = cellName; }
        }
        // The margin spent on the solve stays the LARGER of the two: it is the
        // total uncertainty in a box's position between two readings, whatever
        // its cause, and a margin is the one place to be generous.
        const margin = Math.max(drift, noise);
        // The only void condition, and it is derived from this frame: if the
        // apparent movement is as large as the smallest node's own box, content
        // space is not invariant in any sense that lets a window be solved.
        const smallestNode = Math.min(...restRows.map((r) => Math.min(r.cx1 - r.cx0, r.cy1 - r.cy0)));
        if (drift - noise >= smallestNode) unknowns.push(`${cellName}: node content-space boxes moved ${drift.toFixed(2)} local px across a scroll against ${noise.toFixed(2)} at a standstill — the excess is the whole of the smallest node (${smallestNode.toFixed(2)}), so content space is not invariant here and REACH cannot be solved`);

        // ---- REACH: solve, then go and look
        reachChecks++;
        const feas = restRows.map((r) => ({ r, f: feasible(r, rest.port, rest.travel, margin) }));
        const noWindow = feas.filter((e) => !e.f.ok);
        const covered = new Set();     // seen whole AND clean at some offset
        const seenWhole = new Set();   // seen whole at some offset, clean or not
        let probes = 0, stuck = null;
        for (const e of feas) {
          if (!e.f.ok || covered.has(e.r.i)) continue;
          const x = Math.round(Math.max(0, Math.min(tx, e.f.mid[0])));
          const y = Math.round(Math.max(0, Math.min(ty, e.f.mid[1])));
          const got = await setScroll(x, y); await wait(45);
          if (!stuck && !scrollTook([x, y], got)) stuck = `asked for scroll ${x},${y} and the port answered ${Math.round(got[0])},${Math.round(got[1])} (travel ${Math.round(got[2])}x${Math.round(got[3])})`;
          const look = await evalIn(READ); readings++; probes++;
          for (const row of look.rows) {
            if (!row || !row.whole) continue;
            seenWhole.add(row.i);
            if (!row.trapped) covered.add(row.i);
          }
        }
        // FIVE outcomes for a node that did not come up clean, reported apart,
        // because one word for all of them is how a red gets read as the wrong
        // bug. They are ordered, and only the node's FIRST matching outcome is
        // reported — a node has one story.
        //   NO WINDOW   — the map's fault: no offset exists that shows it whole.
        //   COVERED     — it comes whole, and something is on top of it there.
        //   STUCK       — the scrollport did not go where it was told; every
        //                 "not there" is about the port, not the node.
        //   THIN        — its whole window is narrower than the drift measured in
        //                 this very cell, so the tool cannot tell. UNKNOWN, not
        //                 red and not green. Only ever reported for a node the
        //                 empirical probe failed to cover: a thin window that the
        //                 probe walked into anyway has nothing ambiguous about it,
        //                 and reporting those was this guard's first draft
        //                 flooding healthy landscape cells (travel x = 0 makes
        //                 every window exactly 0 wide and perfectly decidable).
        //   DISAGREE    — a window was solved for, the port went there, the node
        //                 came neither whole nor covered. One of the two methods
        //                 is wrong and that is worth a red on its own.
        if (stuck) fails.push(`${cellName}: REACH — the scrollport did not move: ${stuck}. Every reach reading in this cell is about the port, not the nodes.`);
        for (const e of noWindow) fails.push(`${cellName}: REACH — no scroll offset shows '${e.r.label}' whole (window x[${e.f.x.lo.toFixed(0)},${e.f.x.hi.toFixed(0)}] y[${e.f.y.lo.toFixed(0)},${e.f.y.hi.toFixed(0)}], travel ${tx.toFixed(0)}x${ty.toFixed(0)})`);
        for (const e of feas) {
          if (!e.f.ok || covered.has(e.r.i)) continue;
          if (seenWhole.has(e.r.i)) fails.push(`${cellName}: REACH — '${e.r.label}' comes wholly on screen and is COVERED at every offset solved for it`);
          else if (stuck) continue;
          else if (e.f.thin) unknowns.push(`${cellName}: '${e.r.label}' never came up whole and its scroll window (x ${e.f.x.width.toFixed(1)}, y ${e.f.y.width.toFixed(1)} local px) is thinner than this cell's measured position error (${margin.toFixed(2)} local px: ${drift.toFixed(2)} across a scroll, ${noise.toFixed(2)} at a standstill) — undecidable at this precision, not a pass`);
          else fails.push(`${cellName}: REACH — solved an offset for '${e.r.label}' and it came neither whole nor covered there (analytic and empirical disagree)`);
        }

        // ---- TRAPPED: the blind grid, kept. It samples offsets the solver has
        // no reason to visit, which is the point of a sweep beside a proof.
        const worst = { n: rest.trapped.length, at: rest.at, list: rest.trapped };
        let offsets = 1;
        for (let i = 0; i < steps; i++) {
          for (let j = 0; j < steps; j++) {
            const x = steps === 1 ? 0 : Math.round((tx * i) / (steps - 1));
            const y = steps === 1 ? 0 : Math.round((ty * j) / (steps - 1));
            await setScroll(x, y); await wait(45);
            const r = await evalIn(READ); readings++; offsets++;
            if (r.trapped.length > worst.n) { worst.n = r.trapped.length; worst.at = r.at; worst.list = r.trapped; }
          }
        }
        const zl = zc === 0 ? 'rest ' : (zc > 0 ? `+${zc}   ` : `${zc}   `);
        console.log(`    ${seed.padEnd(11)} T${text.padEnd(2)} font ${String(rest.rootFont).padEnd(5)} z${zl} ui ${String(rest.zoom).padEnd(5)} ${String(rest.layout).padEnd(6)} port ${(rest.port.cw.toFixed(0) + 'x' + rest.port.ch.toFixed(0)).padEnd(9)} travel ${String(rest.travel.map((v) => Math.round(v))).padEnd(9)} · AT REST ${String(restWhole.length).padStart(2)}/${rest.nodes} whole, invited ${invited.length - invitedOut.length}/${invited.length} on screen · REACH ${covered.size}/${feas.length} in ${probes} solved offsets · ${offsets} grid offsets · worst ${worst.n} TRAPPED · drift ${drift.toFixed(2)}/noise ${noise.toFixed(2)}`);
        for (const t of worst.list) console.log(`               ✗ at scroll ${worst.at.map((v) => Math.round(v))}: ${t}`);
        if (worst.n) fails.push(`${cellName}: ${worst.n} trapped at scroll ${worst.at.map((v) => Math.round(v))} — ${worst.list[0]}`);
      }
    }
  }

  // ---- guard 2, evaluated at the end because it is a claim about a SET of cells
  for (const [shape, m] of fontsByShape) {
    if (m.size < 2) continue; // one text size swept: nothing to compare, and --texts said so
    const distinct = new Set(m.values());
    if (distinct.size !== m.size) {
      unknowns.push(`${shape}: ${m.size} text sizes rendered at ${distinct.size} distinct root font-size(s) [${[...m].map(([k, v]) => k + '=' + v).join(' ')}] — the text axis did not move, so those cells are one reading counted ${m.size} times`);
    }
  }

  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS. The second lock, after
  // the --only guard above, for the day the loop skips for a reason that is not
  // --only.
  if (shapesRun === 0 || readings === 0 || structureChecks === 0 || restChecks === 0 || reachChecks === 0) {
    unknowns.push(`${shapesRun} shapes, ${structureChecks} structure checks, ${restChecks} at-rest checks, ${reachChecks} reach checks, ${readings} readings — nothing was asserted`);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; CDP emulation is not a phone. Only
  the ACT MAP is swept: this says nothing about combat, customize, shop, rest,
  rewards or any overlay, and nothing about legibility, feel or whether the map
  tells you where to pan. Reachability is a hit-test at a node's centre: no tap
  is dispatched, so this proves the point is not covered, never that pressing it
  travels. Nodes only partly inside the port are not counted whole (header).
  ${seeds.length} seed(s) is more than one map and is not every map, and the sweep is a sample
  of a generator. THE TEXT x EXTRA-SEED CORNER IS UNSWEPT: text sizes ride seed
  '${seeds[0]}', extra seeds ride text ${TEXT_DEFAULT}. A shape/text/zoom/offset/seed the grid
  steps over is unswept, not clean. AT REST reports a COUNT and asserts only that
  the resting view holds something and that what the game invites you to press is
  on it — a smaller count at a bigger text size is a price, not a failure, and
  this tool will not tell you whether the price is worth paying. The STRUCTURE
  check is the part that does not depend on the sample.
  Content-space drift observed at worst ${worstDrift.toFixed(2)} local px${worstDriftAt ? ` (${worstDriftAt})` : ''}; it is spent as a
  per-cell margin on every solved window, not compared to a typed ceiling.`);

  if (notes.length) {
    console.log(`\n  NOTED — ${notes.length} measured observation(s) that this tool does not gate on:`);
    for (const n of notes) console.log(`    · ${n}`);
  }

  const caught = fails.length > 0 || unknowns.length > 0;
  if (mutate) {
    console.log(`\n  --MUTATE=${mutate}: ${caught ? `CAUGHT — ${fails.length} finding(s), ${unknowns.length} unknown(s). The check can go red.` : 'NOT CAUGHT. The known-bad was armed and this tool reported clean, so it is decoration, not evidence.'}`);
    for (const f of [...unknowns, ...fails].slice(0, 8)) console.log(`    - ${f}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(caught ? 0 : 2);
  }

  if (unknowns.length) {
    console.error(`\n  UNKNOWN — ${unknowns.length} population guard(s) tripped. This run did not test what it says it tested, so it is not a pass and it is not a red.`);
    for (const u of unknowns) console.error(`    - ${u}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length}` : `PASS — ${readings} readings, ${structureChecks} structure checks, ${restChecks} at-rest checks, ${reachChecks} reach checks, nothing trapped and nothing unreachable`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`mapreach: ${e.message}`); process.exit(2); });
