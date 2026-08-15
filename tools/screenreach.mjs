// tools/screenreach.mjs — is every control on every screen reachable by a
// finger, at the shapes we claim to support?
//
// WHY THIS EXISTS, and it is not a hypothetical. tools/mobilefit.mjs measures
// the combat board in detail and says nothing about the rest of the game. The
// portrait work (EldenSpire#23) changes --ui-zoom for EVERY screen — from 0.62
// to ~0.90 on a phone, which is less local space, not more — while only combat
// gets a narrow layout. Combat came out at 45/45 and I would have shipped it,
// and this sweep found three controls that were reachable on dev at 390x844
// and were NOT on my branch:
//
//   COVERED  ⚒ (#combat-armoury)  <- div.pile.draw   my repositioned piles
//   COVERED  a map node           <- button.zbtn     the map's floating zoom stack (x2)
//
// Fixing a lockout in the fight and putting a different one in the top bar is
// not a fix. Both are fixed; this is the check that has to stay.
//
// WHAT IT DOES. Boots each ?shot= state at each shape, collects everything a
// player can press, and hit-tests it with elementFromPoint — at its centre, and
// then at four points half a tap floor out from that centre.
//
// WHY TWO TESTS, and the second one is a defect this file shipped. The centre
// test is structurally blind to a control eaten from ONE SIDE: it keeps its
// centre, so it passes. At dev 7e67de8, 390x844, the flask action bar reads
// `Inspect [213,808 97x36]` under `DRAW [266,797 38x32]` — 23% of the button,
// all of it right of centre. Bjorn put a real touch tap at (285,819) and got
// the draw-pile modal (his log, 2026-08-15). This tool was green on that screen
// for two full gates. The THUMB-STOLEN pass samples where a thumb aimed at the
// centre actually lands, and reports it at (284,826) — one pixel from where his
// finger was. Both passes are red; neither is advisory.
//
// THE ONE DISTINCTION THAT MAKES THE NUMBER MEAN ANYTHING — and the first two
// versions of this file got it wrong in opposite directions. A control that
// fails the hit-test is either:
//   - SCROLLED OUT: its centre is outside its scroll ancestor's visible box.
//     The player reaches it by scrolling. Not a defect. The act map is a
//     pannable canvas with 60+ nodes and most of them are off-screen at any
//     moment; counting those called the map 23-unreachable and the desktop
//     4-unreachable, all of it noise.
//   - COVERED: its centre IS inside the scrollport and something else answers
//     the hit-test. That is EldenSpire#21's mechanism, wherever it appears.
// Only COVERED is counted. Getting this wrong in the loud direction buries the
// real finding in false positives; getting it wrong in the quiet direction
// reports zero forever.
//
// Usage
//   node tools/screenreach.mjs                    source tree via tools/serve.mjs
//   node tools/screenreach.mjs --dist             dist/AshenSpire.html over file://
//   node tools/screenreach.mjs --only 390x844
//   node tools/screenreach.mjs --tap-floor 24    the smallest Accessibility tap size
//   CHROME=/path/to/chrome node tools/screenreach.mjs
//
// Exit codes
//   0  no control is covered and no thumb is stolen, at any shape
//   1  a covered control, or a foreign control winning a thumb point
//   2  usage / no browser / a screen that would not mount — never a pass
//
// BOUNDARY, printed again at the end: Linux headless Chromium only, and CDP
// emulation is not a phone. It reaches only the screens that have a ?shot=
// state, plus the transient surfaces named on those screens' entries. It does
// not judge legibility. ~~and cannot see a control that only appears
// mid-interaction~~ — STRUCK, not softened: that sentence was true when it was
// written and became the hiding place for a photographed defect, and an excuse
// that outlives its defect is how a suite goes green over a bug. Transient
// surfaces are opened by their real gesture and swept with the same probe; the
// ones that are NOT yet listed are named below, positively.
//
// TWO THINGS THE THUMB PASS DELIBERATELY DOES NOT COUNT, each for a reason:
//   - an ANCESTOR answering (a round button's own corner, a padded row). The
//     tap dies rather than doing the wrong thing; that is a tap-floor question
//     and tools/tapsize.mjs owns it.
//   - the hand's cards. Their fan overlaps BY DESIGN on the wide layout, and
//     handlayout.mjs / overlapreader.mjs already own that surface.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is the
// RENDERED PAGE: this tool serves the real tree, boots each ?shot= state in a
// real browser, and hit-tests real rects with elementFromPoint. That is the
// right door and always was. What it lacked was a re-runnable known-bad: its
// only observation was "this branch before the two fixes" — a ref nobody can
// check out now, which under SOP 2's drift clause is `unknown`, not coverage.
// Vira's audit (2026-08-14) rated it OBSERVED-ONCE for exactly that.
// `--selftest` puts the ORIGINAL defect back as CSS BYTES in a copy of the
// tree — the map's zoom stack floating over the canvas again, which is the
// literal shape of the covered map node — and re-runs this whole tool against
// the copy: same serve.mjs, same browser, same hit-test.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'screenreach.mjs',
    args: ['--only', '390x844'],
    timeoutMs: 600000,
    plants: [
      {
        // #28 moved the bar BELOW the map, so re-floating it is not one
        // property any more: `position: fixed` over the map's own bottom band
        // is the same geometry the pre-#28 tree shipped — a floating stack
        // answering the hit-test in a node's place.
        name: 'the zoom stack floats over the map canvas again (the #21-shaped covered node)',
        file: 'styles/map.css',
        // It floats over the TOP band, where the map's own controls actually
        // sit at this shape — the bottom band is a pannable canvas whose nodes
        // are mostly SCROLLED OUT, which this tool correctly does not count, so
        // a bottom-floating plant reproduces nothing. Measured, not assumed:
        // bottom => 0 COVERED, top => 3 COVERED.
        append: '.map-zoom { position: fixed; left: 0; right: 0; top: 0; height: 14vh; z-index: 60; }',
        // `map` by name, because the boss screen legitimately reports 10
        // COVERED by design (its splash) — a bare `N COVERED` regex matches
        // that expected line and would have called a green run a catch.
        expectRed: /^\s*map\s.*[1-9]\d* COVERED/m,
      },
      {
        name: 'a full-bleed veil is laid over every screen — nothing can answer its own hit-test',
        file: 'styles/ui.css',
        append: '.screen::after { content: ""; position: fixed; inset: 0; z-index: 9000; background: transparent; }',
        expectRed: /^\s*title\s.*[1-9]\d* COVERED/m,
      },
      {
        // THE THUMB PASS'S OWN KNOWN-BAD, and it has to be a PARTIAL cover or
        // it proves nothing new — a plant the centre test also catches would
        // just re-prove the pass that was never in doubt. So the draw pile is
        // slid left until it eats END TURN's right side and stops short of its
        // centre: measured at 390x844, END TURN is [67,785 190x50], centre
        // (162,810), right thumb point (184,810). At `right: 21rem` the pile's
        // count glyph owns that pixel and nothing owns the centre.
        //
        // Observed, in the real tree, before this was written: combat went
        // `0 COVERED · 0 THUMB-STOLEN` -> `0 COVERED · 1 THUMB-STOLEN`, red
        // named `END TURN EHOLD .end-turn <- 5 .n at (184,810)`; reverted with
        // `git checkout styles/combat.css` and the finding went away. Same
        // door, CSS bytes, whole tool, real browser.
        //
        // AND IT CANNOT RUN GREEN TODAY, which is stated here rather than
        // discovered: doorplant re-runs the unplanted copy and requires exit 0,
        // and this tool is NOT green at dev 7e67de8 — 390x844 carries two real
        // findings (below). So `--selftest` will correctly report
        // `clean copy exited 1 — the baseline is not green, so no plant above
        // proves anything`. That verdict is right and the plant stays wired: it
        // becomes usable the day the findings are fixed, which is the same day
        // it is needed, because that is when the free real red disappears.
        name: 'the draw pile eats END TURN\'s right side without reaching its centre (a PARTIAL cover — invisible to the centre test)',
        file: 'styles/combat.css',
        append: ":root[data-layout='narrow'] .pile.draw { right: 21rem; }",
        expectRed: /^\s*combat\s.*[1-9]\d* THUMB-STOLEN/m,
      },
    ],
  }));
}

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

// Every screen that can be reached without playing the game. `boss` holds a
// splash deliberately covering the board, so its controls ARE covered by
// design and it is listed with `overlay: true` rather than left out — a screen
// missing from a sweep is invisible, and a screen present with a reason is not.
const SCREENS = [
  { name: 'title', q: '', ready: `!!document.querySelector('#app button')` },
  { name: 'map', q: '?shot=map', ready: `!!document.querySelector('.map-node')` },
  {
    name: 'combat',
    q: '?shot=combat',
    ready: `!!document.querySelector('.combat .hand .card')`,
    // TRANSIENT SURFACES — the hole this file's own boundary named for weeks.
    // The old boundary ended "a control that appears only mid-interaction
    // cannot be seen", and a photographed defect lived in exactly that
    // sentence: Bjorn drove a real thumb onto Inspect in the flask action bar
    // and opened the draw pile instead (his log, 2026-08-15, the sentinel that
    // could not see its own discharge). Two full gates of instruments were
    // green over it because nothing on this screen exists until a flask is
    // tapped. An excuse that outlives its defect is how a suite goes green
    // over a bug, so the sentence is DELETED, not softened, and the surface is
    // opened and swept with the same probe as everything else.
    transients: [
      {
        name: 'flask actions',
        // The real door: the click listener the topbar flask button carries
        // (combat.js renderTopbar → openCombatFlaskMenu). Nothing is
        // synthesised here — the menu that appears is the one a thumb gets.
        open: `(() => { const b = document.querySelector('.combat .flask-slot'); if (!b) return false; b.click(); return true; })()`,
        ready: `!!document.querySelector('.flask-action-menu .flask-action')`,
      },
    ],
  },
  { name: 'death', q: '?shot=death', ready: `!!document.querySelector('#app button')` },
  // EldenSpire#29 slice 1. Added the day the state existed. This file's own
  // boundary has said since it was written that customize/shop/rest/rewards
  // have no ?shot= and are therefore covered by nothing — and that is exactly
  // why customize went unexamined for the week combat was measured three times
  // over. One of the four is now swept; the boundary still names the other three.
  { name: 'customize', q: '?shot=customize', ready: `!!document.querySelector('.cz-portrait')` },
  { name: 'boss', q: '?shot=boss', ready: `!!document.querySelector('.boss-intro')`, overlay: 'the boss splash covers the board on purpose and is dismissed on a timer' },
  // The Compendium (Freja). Twenty-four buttons in a scrolling grid on a phone
  // is what this sweep is FOR, and a new screen that skips it is the eight
  // screens Rune's census counts as owned by no instrument. It is added in the
  // act that creates the screen for the same reason customize was added late
  // and cost a week.
  { name: 'compendium', q: '?shot=compendium', ready: `!!document.querySelector('.cp-cell')` },
  // THE SHRINE AND THE MERCHANT. The boundary below said for weeks that REST
  // has no `?shot=` state — and it HAS had one since the Smith grid was fixed;
  // the sentence went stale the moment somebody added the state and did not add
  // the row. A boundary that lies about its own scope is worse than none (this
  // file's own words, about this file). Both screens now carry a second-beat
  // control apiece (Rest holds, the Smith confirms, the brazier confirms), and
  // a confirm panel that pushes a CANCEL button off a 360 px screen is exactly
  // the class this sweep exists to catch.
  { name: 'rest', q: '?shot=rest', ready: `!!document.querySelector('#rest-opt')` },
  { name: 'shop', q: '?shot=shop', ready: `!!document.querySelector('#leave-shop')` },
];

// NO EXEMPTION LIST, AND THAT WAS A DECISION. This file's first draft carried a
// KNOWN_DEBT table — named findings, named shapes, a close condition, and a
// wake that went red the day one stopped reproducing. It was deleted before it
// ever shipped an entry, for two reasons worth keeping written down:
//   1. Every finding it would have held belongs to a surface someone else owns
//      (the flask row is Sunna's, the Compendium is Freja's). A seat writing an
//      instrument does not get to license other seats' defects into silence.
//   2. It was protecting a green that does not exist. This tool is ALREADY red
//      at dev 7e67de8 — 844x390, combat, 6 COVERED, on the pristine file, no
//      edit of mine involved — so there was no working gate to keep working.
// A covered control and a stolen thumb are the same verdict here: red, named,
// and discharged by fixing it.
const SHAPES = [
  { w: 1200, h: 730, d: 1, mobile: false, tag: 'desktop' }, // NON-REGRESSION EDGE
  { w: 390, h: 844, d: 3, mobile: true, tag: 'portrait' },
  { w: 360, h: 640, d: 2, mobile: true, tag: 'portrait' },
  { w: 844, h: 390, d: 3, mobile: true, tag: 'landscape' },
];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --tap-floor N — BJORN 2026-08-16, and this axis is VIKI'S OWN HANDOVER, not
// my idea. She transferred this file with five conditions and the fifth was an
// unchecked edge named rather than left to be found: *the thumb pass has only
// ever run at tap floor 44; at 24 it gets LESS sensitive and may be blind to
// its own defect.* Handing over a known gap in the thing you built is the
// seam the Charter asks for, and the answer to a named gap is a flag, not a
// paragraph — a boundary a machine can close beats one a reader must remember.
//
// It enters by the PLAYER'S OWN DOOR: ?shotSettings writes into the same
// settings blob Settings → Accessibility → Tap size writes, and main.js
// validates it against balance.ui.tapSize.sizes [44, 36, 30, 24] and refuses
// anything else out loud. Nothing here pokes --tap-floor directly; the probe
// still MEASURES the floor off a rendered element rather than trusting this
// number, so a value the app rejected shows up as an unchanged floor in the
// printed line instead of a silent lie.
const tapFloorArg = argOf('--tap-floor');
const withSettings = (q) => {
  if (!tapFloorArg) return q;
  const s = encodeURIComponent(JSON.stringify({ tapFloor: Number(tapFloorArg) }));
  return q ? `${q}&shotSettings=${s}` : `?shotSettings=${s}`;
};

const PROBE = `(() => {
  const app = document.getElementById('app');
  const de = document.documentElement;
  const z = parseFloat(getComputedStyle(de).getPropertyValue('--ui-zoom')) || 1;
  // Everything a player can press. .map-node is an SVG <g>, so className is an
  // SVGAnimatedString and must never be string-formatted blindly.
  // WIDENED FOR #29 slice 1, and the widening is the point. Adding customize to
  // SCREENS without this reported "2 controls · 0 COVERED" and PASSED — the
  // screen has 25, and the three that were unreachable (the name field, the
  // seed field and a class card) were none of the two it looked at. A sweep
  // that opens a screen and inspects 8% of it is the '0 checks passed' shape
  // wearing a screen name.
  const sel = 'button,[role=button],input,.pile,.map-node,.card,.choice,.opt,.zbtn,.topbar-btn,.cz-opt,.class-pick,.cz-keepsake';
  const name = (e) => {
    if (!e) return 'null';
    const t = (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 22);
    const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/)[0] : '';
    return (t || '') + (c ? ' .' + c : ' ' + e.tagName);
  };
  const scrollport = (e) => {
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)) return p;
    }
    return null;
  };
  const covered = [], scrolledOut = [], partly = [];
  const all = [...app.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden';
  });

  // ---- THUMB REACH: the centre test is structurally blind to a partial cover.
  //
  // THIS IS A FALSE-NEGATIVE THIS FILE SHIPPED, not a new class of defect. The
  // sweep above asks one question — who owns the CENTRE — and a control eaten
  // from one side keeps its centre and passes. Measured at dev 7e67de8,
  // 390x844, the flask action bar:
  //
  //   Inspect  [213,808 97x36]   centre (261.5, 826)  -> Inspect  (PASSES)
  //   DRAW     [266,797 38x32]   z-index 30, absolute, over the same band
  //
  // Bjorn drove a REAL TOUCH TAP at (285, 819) and got the draw-pile modal
  // (his log, 2026-08-15). The overlap is 38x21 px, 23% of the button, all of
  // it to the right of the centre — so a centre probe and a thumb disagree,
  // and the centre probe is the one that is wrong about the player.
  //
  // What a thumb actually does: it lands somewhere within about half a tap
  // floor of where it aimed. So sample the four points half a tap-floor from
  // the centre, clamped inside the control's own rect, and require the control
  // to own them. The floor is MEASURED, never parsed — the --tap-floor var is a
  // calc() and parseFloat on the token is NaN, which prints as 0 and looks
  // like a measurement (tools/tapsize.mjs found that one first).
  const fp = document.createElement('div');
  fp.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:var(--tap-floor,44px);';
  document.body.appendChild(fp);
  const floor = fp.getBoundingClientRect().height || 44;
  fp.remove();
  // The hand's fan overlaps BY DESIGN on the wide layout (negative margins,
  // styles/combat.css) and is the one surface in the tree where a neighbour
  // owning your edge is the intended look. It has its own instruments —
  // handlayout.mjs, overlapreader.mjs — so it is named out here rather than
  // reported as noise that trains a reader to skip this section.
  const thumbable = (e) => !(e.classList && e.classList.contains('card'));

  // BJORN, inheriting this file 2026-08-16 — THE THUMB POINTS ARE NOW CLIPPED
  // THE WAY THE CENTRE ALREADY WAS, and this had to happen before any of this
  // tool's reds could be disposed of.
  //
  // The centre pass below always asked a second question after the hit test:
  // is that point even INSIDE the control's scrollport? A half-scrolled row
  // has a rect that runs past its scroller, and past the scroller the control
  // is CLIPPED — not painted at all — so whatever IS painted there owns the
  // pixel honestly. The thumb pass filtered its four points to the control's
  // own rect and to the viewport and skipped that question, so it reported a
  // foreign control stealing a pixel the control never had.
  //
  // SEVEN of this tool's eleven standing reds at dev 7e67de8 were that — one
  // instrument defect wearing two screen names — and I photographed both
  // before ruling either:
  //   compendium  .cp-cell <- BACK, 3 shapes. The cell's rect ends at y 848;
  //     .cp-scroll (overflow auto) clips at 773.8; the thumb point is y 796.
  //     BACK is painted BELOW the scroller, never over the grid.
  //   customize   .cz-keepsake <- .cz-actions, 3 shapes. The keepsake row runs
  //     to y 395.6; .cz-scroll clips at 349.4; the thumb point is y 381. The
  //     actions bar ABUTS the scroller; it does not cover it.
  //
  // ONE HOME for the clipping, not two: visBox is the box the centre pass's
  // own clip box was already computing, lifted so both passes read the same
  // answer. A second copy of "where is this control actually visible" is the
  // defect I exist to catch, and this file was one commit from having one.
  const visBox = (e) => {
    const r = e.getBoundingClientRect();
    const sp = scrollport(e);
    const b = sp ? sp.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const l = Math.max(r.left, b.left, 0), t = Math.max(r.top, b.top, 0);
    const ri = Math.min(r.right, b.right, innerWidth), bo = Math.min(r.bottom, b.bottom, innerHeight);
    return (ri > l && bo > t) ? { left: l, top: t, right: ri, bottom: bo } : null;
  };

  for (const c of all.filter(thumbable)) {
    const r = c.getBoundingClientRect();
    const vb = visBox(c);
    if (!vb) continue;   // painted nowhere at all — the centre pass owns that verdict
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const half = floor / 2;
    // NO CLAMPING, and this is the line that decides what the tool means. A
    // point pushed back onto the rect's own edge asks a different question —
    // "does anything overlap my border by a pixel" — which every abutting
    // neighbour answers yes to, and the first run of this probe reported eight
    // findings on that basis with only one of them real. A point that falls
    // OUTSIDE the control is not a thumb this control could have won; it is a
    // control smaller than the floor, and how big a control is belongs to
    // tools/tapsize.mjs, not here. One question, asked once: within half a tap
    // floor of the centre AND inside your own rect, do you own the pixel?
    // ...AND INSIDE THE PART OF IT THAT IS ACTUALLY PAINTED (vb). The
    // viewport bound below is now redundant — visBox already carries it — and
    // it stays, because a reader of this line should not have to open visBox
    // to know a point off the screen is not a thumb.
    const pts = [[cx + half, cy], [cx - half, cy], [cx, cy + half], [cx, cy - half]]
      .filter(([x, y]) => x > r.left && x < r.right && y > r.top && y < r.bottom
        && x > vb.left && x < vb.right && y > vb.top && y < vb.bottom
        && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight);
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      // An ANCESTOR answering is not a theft. A round button's own corner, a
      // padded row, a rect wider than its painted shape — the container wins
      // the pixel and NOTHING takes the tap. That is a dead pixel, not a wrong
      // action, and it is what four of this probe's first five findings were
      // (.topbar-btn <- .hud-top, .zbtn <- .map-zoom: parents, every one).
      // The defect this file exists for is #21's: a FOREIGN control answering
      // where a player aimed at this one. Named in the boundary, not silently
      // dropped — a dead pixel on a control is a real if smaller thing, and it
      // belongs to whoever owns tap floors, not to a cover sweep.
      if (!hit || hit === c || c.contains(hit) || hit.contains(c)) continue;
      partly.push(name(c) + '  <-  ' + name(hit) + '  at (' + Math.round(x) + ',' + Math.round(y) + '), '
        + Math.round(half) + ' px from its own centre; the centre test passes this control');
      break; // one report per control — the first stolen thumb point is the finding
    }
  }

  for (const c of all) {
    const r = c.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = (x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight) ? document.elementFromPoint(x, y) : null;
    if (hit && (hit === c || c.contains(hit))) continue;
    // Inside its own scrollport, or scrolled past the edge of it?
    const sp = scrollport(c);
    const box = sp ? sp.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const outX = x < box.left - 0.5 || x > box.right + 0.5;
    const outY = y < box.top - 0.5 || y > box.bottom + 0.5;
    if (outX || outY) {
      // SCROLLED-OUT IS ONLY FINE IF SCROLLING CAN ACTUALLY GET THERE.
      //
      // The first version of this classifier stopped at "outside its
      // scrollport" and called that recoverable. Run against the customize
      // screen before #29 slice 1 fixed it, with the preview pane, the name
      // field and the seed field sitting at x = -139.8 and no horizontal
      // scroll anywhere on the page, it reported 0 COVERED and exited 0. The
      // sweep could not see the defect it had just been added for.
      //
      // A container whose computed overflow is auto is not necessarily a
      // container that scrolls: '.screen' sets overflow-y:auto, which makes
      // overflow-x compute to auto too, so every horizontally-absent control
      // on that screen looked recoverable. Ask the port for real travel on the
      // axis that is actually short.
      const port = sp || document.scrollingElement || document.documentElement;
      // DIRECTION MATTERS, and the first version of this test missed it. It
      // asked only whether the port had travel, and the customize screen HAD
      // travel — the class row overflowed ~71px to the RIGHT — so a preview
      // pane sitting 139px off the LEFT was called recoverable. You cannot
      // scroll to a negative offset: in LTR, content laid out before the
      // origin is unreachable no matter how wide the content is. Ask whether
      // the port can move THE WAY THIS CONTROL IS.
      const canGoLeft = port.scrollLeft > 1;
      const canGoRight = port.scrollWidth - port.clientWidth - port.scrollLeft > 1;
      const canGoUp = port.scrollTop > 1;
      const canGoDown = port.scrollHeight - port.clientHeight - port.scrollTop > 1;
      const offLeft = x < box.left - 0.5, offRight = x > box.right + 0.5;
      const offTop = y < box.top - 0.5, offBottom = y > box.bottom + 0.5;
      const recoverable =
        (!offLeft || canGoLeft) && (!offRight || canGoRight)
        && (!offTop || canGoUp) && (!offBottom || canGoDown);
      const travelX = port.scrollWidth - port.clientWidth;
      const travelY = port.scrollHeight - port.clientHeight;
      if (recoverable) { scrolledOut.push(name(c)); continue; }
      const dir = [offLeft && 'left', offRight && 'right', offTop && 'above', offBottom && 'below'].filter(Boolean).join('+');
      // BJORN 2026-08-16 — HOW MUCH OF IT IS STILL ON THE GLASS, because
      // "UNREACHABLE" was one word for two different player experiences and
      // the difference decides how a fix gets prioritised. At 844x390 combat
      // this line separates END TURN (0% — the primary verb of the game, not
      // on the screen at all) from five hand cards at 41%, whose tops are
      // visible and tappable and whose text is not. Same verdict, same red,
      // and now the card written off it can say which is which. The VERDICT is
      // unchanged: a control whose centre cannot be scrolled to is red at any
      // percentage.
      const vb2 = visBox(c);
      const seen = vb2 ? ((vb2.right - vb2.left) * (vb2.bottom - vb2.top)) / (r.width * r.height) : 0;
      covered.push(name(c) + '  <-  UNREACHABLE: ' + dir + ' of its scrollport, which cannot scroll that way'
        + ' (travel ' + Math.round(travelX) + 'x' + Math.round(travelY) + ', at ' + Math.round(port.scrollLeft) + ',' + Math.round(port.scrollTop) + ')'
        + ' — ' + Math.round(seen * 100) + '% of its rect is on the glass');
      continue;
    }
    covered.push(name(c) + '  <-  ' + name(hit));
  }
  return { z, local: app.clientWidth + 'x' + app.clientHeight, total: all.length, floor: Math.round(floor),
           covered, partly, scrolledOut: scrolledOut.length };
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

async function main() {
  if (!browserPath) { console.error('screenreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'screenreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`screenreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8264, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`screenreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);
  console.log(`  TAP FLOOR: ${tapFloorArg ? `asked for ${tapFloorArg} px via ?shotSettings (the player's own Accessibility row)` : 'the app default — the ONLY floor this pass ran at until 2026-08-16'}`);
  console.log('  Every line below prints the floor it actually MEASURED off a rendered element.');
  console.log('  If those two numbers disagree, the app refused the ask and the sweep is about the default.');

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

  const fails = [];
  let shapesRun = 0;
  // One home for the thumb-reach verdict, at rest and mid-interaction alike.
  const report = (shape, screen, sc, transient, partly) => {
    for (const p of partly) {
      if (sc.overlay) { console.log(`               · ${p}  (overlay screen — not counted)`); continue; }
      console.log(`               ✗ ${p}`);
      fails.push(`${shape} ${screen}${transient ? '/' + transient : ''}: THUMB-STOLEN — ${p}`);
    }
  };
  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    shapesRun++;
    console.log(`\n  ${shape} @ dSF ${vp.d}  (${vp.tag})`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile, maxTouchPoints: 5 }, S);
    for (const sc of SCREENS) {
      await cdp.send('Page.navigate', { url: `${base}${withSettings(sc.q)}` }, S);
      const t0 = Date.now();
      let up = false;
      while (Date.now() - t0 < 12000) { if (await evalIn(sc.ready).catch(() => false)) { up = true; break; } await wait(150); }
      if (!up) { console.log(`    ${sc.name.padEnd(8)} DID NOT MOUNT — never a pass`); fails.push(`${shape} ${sc.name}: screen would not mount`); continue; }
      await wait(900); // auto-zoom re-flexes on a 150ms debounce plus a boot re-apply
      const r = await evalIn(PROBE);
      const tail = sc.overlay ? `  (overlay screen: ${sc.overlay})` : '';
      console.log(`    ${sc.name.padEnd(8)} zoom ${String(r.z).padEnd(5)} local ${r.local.padEnd(10)} ${String(r.total).padStart(3)} controls · ${r.scrolledOut} scrolled-out (fine) · ${r.covered.length} COVERED · ${r.partly.length} THUMB-STOLEN (floor ${r.floor})${tail}`);
      for (const c of r.covered) console.log(`               ✗ ${c}`);
      if (r.covered.length && !sc.overlay) fails.push(`${shape} ${sc.name}: ${r.covered.length} covered control(s) — ${r.covered[0]}`);
      report(shape, sc.name, sc, null, r.partly);

      // ---- transient surfaces: the same probe, after the gesture that makes
      // the surface exist. Each one re-navigates first so the screen is back at
      // rest and one transient cannot leave state for the next.
      for (const tr of sc.transients || []) {
        const label = `${sc.name}/${tr.name}`;
        const opened = await evalIn(tr.open).catch(() => false);
        if (!opened) { console.log(`      ${label.padEnd(22)} WOULD NOT OPEN — never a pass`); fails.push(`${shape} ${label}: the surface would not open`); continue; }
        const t1 = Date.now();
        let shown = false;
        while (Date.now() - t1 < 4000) { if (await evalIn(tr.ready).catch(() => false)) { shown = true; break; } await wait(100); }
        if (!shown) { console.log(`      ${label.padEnd(22)} DID NOT MOUNT — never a pass`); fails.push(`${shape} ${label}: the surface would not mount`); continue; }
        await wait(200);
        const tres = await evalIn(PROBE);
        console.log(`      ${label.padEnd(22)} ${String(tres.total).padStart(3)} controls · ${tres.scrolledOut} scrolled-out (fine) · ${tres.covered.length} COVERED · ${tres.partly.length} THUMB-STOLEN`);
        for (const c of tres.covered) { console.log(`               ✗ ${c}`); fails.push(`${shape} ${label}: ${c}`); }
        report(shape, sc.name, sc, tr.name, tres.partly);
        // Put the screen back at rest before the next transient / screen.
        await cdp.send('Page.navigate', { url: `${base}${withSettings(sc.q)}` }, S);
        await wait(300);
      }
    }
  }


  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS. This exact command —
  // `--only 412x915` — printed "PASS — no covered controls" and exited 0 at the
  // one shape where Sunna had measured a covered map node. It is
  // development.md's `verify-shipped: OK - 0 checks passed` fixture, reproduced
  // in a tool whose own header cites that discipline. She found it despite this
  // tool rather than with it.
  if (shapesRun === 0) {
    console.error(`\nscreenreach: --only ${only} matched no shape. Nothing was tested, so this is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map((v) => `${v.w}x${v.h}`).join(', ')}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }

  // The list of swept screens is DERIVED from SCREENS rather than retyped. It
  // was a hand-written sentence, and a boundary that has to be edited by hand
  // when the list grows is a second copy of the list — it had already stopped
  // naming customize in its first clause while sweeping it in the next. A
  // boundary that lies about its own scope is worse than none.
  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone. Only the
  screens with a ?shot= state are reached: ${SCREENS.map((s) => s.name).join(', ')}.
  REWARDS, the DRAFT and every overlay still have NO ?shot= and are covered
  here or anywhere by nothing. Neither is a second-beat surface today
  (rewardPick and draftPick are declared 'none' in src/model/secondbeat.js), so
  what is unmeasured there is their reach, not a confirm step.
  Legibility is not judged. Reachability is measured at rest AND on the
  transient surfaces declared per screen — today exactly one, combat's flask
  action bar. Every other mid-interaction surface (the quick-nav overlay, the
  pile modals, the armoury drawer, targeting mode, the reward pick) is still
  seen by nothing here, and that list is the ask, not a footnote.

  THE THUMB PASS reports a FOREIGN control winning a point half a tap floor
  from the centre — the partial cover the centre test cannot see. It does not
  count an ancestor winning that point (a dead pixel, not a wrong action:
  tools/tapsize.mjs owns control size), and it skips .card, whose fan overlaps
  by design. A stolen thumb is a hit-test fact on one headless engine; it is
  not a claim that a human finger misses, though on the one finding a human
  finger was driven at, it did.

  BOTH PASSES ARE NOW CLIPPED TO WHERE THE CONTROL IS ACTUALLY PAINTED — its
  scrollport and the viewport, one home (visBox). Before 2026-08-16 the thumb
  pass was not, and SEVEN of this tool's eleven standing reds were points in a
  region the control had been clipped out of: compendium .cp-cell <- BACK on
  three shapes, customize .cz-keepsake <- .cz-actions on three. Both were
  photographed before being ruled artifacts, and neither was suppressed — the
  measurement was wrong, and no allow-list was added to make it right.

  AND THE TAP FLOOR IS AN AXIS NOW, not an assumption. Viki handed this file
  over naming the gap: until 2026-08-16 the thumb pass had only ever run at
  floor 44, and at 24 it samples CLOSER to the centre and is therefore LESS
  sensitive. Measured since: at --tap-floor 24, 390x844, the Inspect/DRAW
  finding still fires, at (274,826) instead of (284,826). That bounds the gap
  on the one defect we have; it is NOT a claim that the pass is equally
  sensitive at 24 in general, and the other three shapes have not been swept
  at any floor but the default.

  AND THE SHAPE LIST IS NOT THE OTHER TOOL'S. This runs 1200x730, 390x844,
  360x640, 844x390; tools/mobilefit.mjs runs nine, and neither list is a
  superset. A defect can live in the gap, and one does: Sunna swept nine widths
  by hand and found a covered map node at 412x915 — a shape THIS TOOL DOES NOT
  TEST — that dev does not have. Closing the gap is a card, not a silent edit,
  because adding that shape turns this red on a finding she carried without
  blocking.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length}` : 'PASS — no covered controls'}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`screenreach: ${e.message}`); process.exit(2); });
