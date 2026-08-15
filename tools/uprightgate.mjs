#!/usr/bin/env node
// tools/uprightgate.mjs — R-32's machine check. A SHAPE THE BOARD DOES NOT FIT
// IS A SHAPE THE GAME REFUSES OUT LOUD — AND A SHAPE IT DOES FIT IS A SHAPE IT
// NEVER REFUSES. Both edges, because only one of them can rot quietly.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS WAS BUILT ON, AND IT WAS OBSERVED BEFORE ANYTHING WAS FIXED
//
// Bjorn, 2026-08-15, on the preview bundle at 844x390 in combat:
//
//   "END TURN sits at top 395, bottom 419, in a 390 px viewport — entirely below
//    the fold — inside DIV.combat, which is overflow-y: hidden with scrollHeight
//    758 against clientHeight 629. document.scrollHeight == innerHeight == 390.
//    There is not one scrollable ancestor. No swipe, no wheel, no scrollbar
//    reaches it."
//
// AND HIS RULE, WHICH IS THIS FILE'S CENTRAL MECHANIC: `overflow: hidden`
// SCROLLS PROGRAMMATICALLY AND NEVER BY HAND. He nearly filed the button as
// reachable because `scrollIntoView` moved it and a hit-test then found it —
// the page had not moved at all. So this tool NEVER positions its own target.
// It measures the rect where the screen put it, and it decides "reachable" by
// walking for an ancestor a THUMB could scroll: `overflow-y|x` in auto|scroll
// AND real travel. `hidden` is not a scroll path, whatever a script can do to it.
//
// ---------------------------------------------------------------------------
// THE THREE CLAUSES
//
//   W — THE WALL. On ?shot=combat, where is `.end-turn` and can a THUMB get to
//       it? Four words, and the fourth is the one I nearly got wrong:
//         onscreen    whole inside the viewport
//         scrollable  not whole, but a real scroller (auto|scroll + travel) exists
//         clipped     part of it is on screen and tappable, no scroll path
//         unreachable not one pixel of it is on screen, no scroll path — A WALL
//       Only `unreachable` is a wall. 915x412 puts 17 of END TURN's 24 px on
//       screen and Bjorn's mobilefit reads 25/45 finger positions on it there:
//       calling that a wall would be describing a measurement in a word stronger
//       than the measurement, which is exactly the error he caught in himself.
//       `clipped` is REPORTED AND NOT LEGISLATED — neither required to gate nor
//       forbidden from gating — because drawing a line inside that band would be
//       a threshold fitted by whoever ran the tool last.
//   G — THE GATE. Every WALLED shape has the orientation gate standing; every
//       standing gate covers the viewport, has its words on screen, does not
//       scroll sideways (Law 5), and stands on BOTH surfaces or neither — the
//       gate is global, because gating at the trap instead of at the door is not
//       mercy. And ITS ADVICE IS TRUE: when it says "turn your phone", the tool
//       emulates the turned viewport and requires the wall to be gone there. A
//       gate that tells a desktop player to rotate their monitor is worse than
//       no gate.
//   K — THE WAKE (development.md, *The wake condition*). The gate is a refusal,
//       and a refusal's correct state and its expired state print the same
//       nothing. So: THE GATE MUST BE ABSENT ON EVERY SHAPE WHERE ALL FIVE
//       REQUIRED CONTROLS ARE WHOLE (WHOLE_SET below — mobilefit's four, plus
//       the hand). The day a composition fits a short shape, all five come whole
//       and this clause goes red; then `gateBelowH` comes down, or
//       components/upright.js is deleted, instead of the refusal quietly
//       outliving its reason. A suite that only asserts the refusal re-proves it
//       forever and watches the premise never.
//
//       IT USED TO ASK ABOUT END TURN ALONE AND THAT WAS WRONG. At Text S the
//       landscape phone has END TURN whole while two thirds of the hand is off
//       screen — so the narrow question called 844x390 "a shape that fits" and
//       failed the gate for refusing it. Cards you cannot see are not a working
//       screen. The set is wide because the claim is wide.
//
// K is the clause that makes this an instrument rather than a victory lap. W and
// G would both stay green under a gate that stands at every shape on earth.
//
// ---------------------------------------------------------------------------
// THE POPULATION, AND WHO DREW EACH EDGE
//
//   SHAPES — typed, and chosen to contain the DISAGREEMENTS rather than to be
//     long. Two landscape phones (the subject), two portrait phones including
//     the smallest this house tests, the iPad-portrait shape that caused #24,
//     A TABLET IN LANDSCAPE (1024x768 — landscape and perfectly fine, which is
//     the whole reason the predicate is not an orientation), the desktop
//     baseline, and A LADDER ACROSS THE THRESHOLD ITSELF (800x410 .. 800x500,
//     WALKED AT 1 PX ACROSS 430..440 where the constant lives). The ladder is
//     here because the FIRST version of this list had none of it and let a
//     predicate ship that refused a working window; the 1 px band is here
//     because the SECOND version spaced it at 10 px and let the constant sit in
//     the hole, three pixels above the measurement, while this file printed
//     PASS. Same rule, same site, twice: A POPULATION WITH NO CELL EITHER SIDE
//     OF ITS OWN BOUNDARY CANNOT TELL YOU THE BOUNDARY IS WRONG — and a
//     boundary written in integers has to be sampled in integers. Full note at
//     `LADDER_H`. If this file ever gates 1024x768 the check has become an
//     orientation sniffer, and clause K says so.
//   DEVICE OR WINDOW — stated per shape (WINDOWS below), not inferred from the
//     dimensions. It decides touch emulation, and through that the app's
//     `(pointer: coarse)` wording query. Inferring it from `min(w,h) < 700` made
//     an 800x410 browser window emulate a touchscreen and be told to turn its
//     phone.
//   SURFACES — two, named: combat (where the wall is) and title (where the
//     player arrives). Not derived from main.js's ?shot= states, and that is a
//     real boundary rather than an oversight: clause W needs a NAMED required
//     control per surface, and only combat has one written down. Widening the
//     surface set without widening the control set would count screens it never
//     actually checked.
//   TEXT SIZE — one cell (the M default) unless `--text S|M|L|XL`. Stated in the
//     boundary rather than left to be found: text size changes content height,
//     so a shape that fits at M can wall at XL, and the default run is silent
//     about that. IT IS ALSO SILENT ABOUT THE CONSTANT, and that is the sharper
//     half: the whole-fit height is 432/495/533/571 across S/M/L/XL, so the
//     threshold is decided ENTIRELY by Text S and a default run cannot see it
//     move. `--ladder` is the mode that walks all four and checks the number
//     against them; `--selftest` carries a Text S cell so the check does not
//     depend on which flag a person happened to type.
//   NO TOLERANCE ON REACHABILITY. Half a pixel of slack on the viewport edges
//     for device-pixel rounding, and nothing else. "Mostly on screen" is a
//     button a thumb misses.
//
// ---------------------------------------------------------------------------
// DOOR (the instrument rule's same-door clause, commons/development.md)
//
// The real input is the rendered app in a real browser: the tool navigates to
// the same URLs a player's browser loads, at emulated device metrics, and reads
// rects off the frame the screen actually painted. Nothing is handed to an
// inner function. `--selftest` plants each known-bad AS FILE BYTES in a copied
// real tree — the same files the real defect would ship in — and re-runs this
// whole tool from that copy, so the planted bytes are what boots.
//
// OBSERVED RED, before any fix existed, on the tree at 1ab9777
// (train/preview-2026-08-15 — the bytes Constantine is holding):
//   CHROME=/usr/bin/chromium node tools/uprightgate.mjs   ->  exit 1
//   FAIL — 4 finding(s) over 14 shape(s):
//     844x390 combat + title: WALL: .end-turn lies at top 394.95..419.33
//       outside a 390 px viewport with NO scrollable ancestor (nearest clipper
//       DIV.combat, overflow-y hidden, scrollHeight 758 > clientHeight 629) —
//       and NO GATE STANDS
//     400x400 combat + title: the same, top 407.95..432.33, scrollHeight 779 >
//       clientHeight 645
//   Bjorn measured "top 395, bottom 419 … scrollHeight 758 against clientHeight
//   629" by hand on the same bundle. This instrument reproduces his numbers to
//   two decimals, independently, which is the only reason it is allowed to
//   speak for them.
//
// ---------------------------------------------------------------------------
// KNOWN OPEN — `--text XL` IS RED, THE REDS ARE REAL, AND NONE OF THEM IS THE
// GATE'S. `--text S`, the default `M`, and `--text L` are all GREEN 23/23
// (2026-08-15, dev = aafa3e2 + this branch, headless Chromium).
//
//   --text XL  ->  FAIL, 22 finding(s) over 23 shapes, all of them WALL/no-gate,
//   each counted twice (combat and title):
//     360x640                .end-turn top 659.25..720.91 in a 640 px viewport
//     800x432 .. 800x440     .end-turn top 450.95..479.83, 0% on screen
//     800x450                the same rect, still 0% on screen
//   It was 6 findings over 14 shapes before this branch widened the ladder to
//   1 px. THE COUNT GREW; THE DEFECT DID NOT. The nine new rungs all sit between
//   430 and 440; eight of them are red (431 is below the constant, still gated,
//   still quiet) and every one reads the SAME rect as 800x440 already did — one
//   wall, sampled more finely.
//
// SIX OF THE SIXTEEN NEW FINDINGS ARE MINE, AND I AM NAMING THE COST RATHER THAN
// LETTING THE COUNT CARRY IT. Lowering the constant 435 -> 432 hands three
// heights (432/433/434, two surfaces each) back
// to Text S players, and at Text XL those same three heights lose the gate
// they used to get. That is a real loss and it is three pixels of ACCIDENT: the
// XL wall runs from below 390 up to h 450 (END TURN's top edge is 450.95, so it
// is off screen entirely at every h <= 450), and the gate at 435 was covering
// 45 of those 61 pixels and never the rest. A refusal that covers three quarters
// of a wall is not the thing keeping XL players safe, and pinning the constant to
// XL instead would refuse every Text S player everything under 571. One number
// cannot answer both; it answers the one where a WORKING screen is at stake, and
// the wall is layout's to close.
//
// THE COMBAT BOARD DOES NOT FIT ITSELF AT LARGE TEXT, and that is the cause.
// Re-derive the whole set with `--ladder`; measured at width 800, % of each
// control on screen:
//
//   Text L : the hand is cut below h 533 (92.5% at 520, 54% at 430); END TURN is
//            whole from 460 and 24.7% at 430.
//   Text XL: the hand is cut below h 571 (94.2% at 560, 37.8% at 430); END TURN
//            is 0% at every h <= 450, 70.8% at 500, whole from 520.
//   Not only short windows — at Text XL, 1024x600 shows 68% of the hand and
//   960x540 shows 66% of END TURN. Identical at 1ab9777: PRE-EXISTING, all of it.
//   360x640 is the one that should worry a person: a real phone, in PORTRAIT,
//   at the largest accessibility text, with END TURN unreachable.
//
// THE GATE DOES NOT AND MUST NOT COVER THIS. A threshold that grew with the
// accessibility setting would refuse more and more of a large-text player's
// screens, which is the opposite of what that setting is for — and on a phone
// in portrait neither piece of advice the gate can give is even true. The fix is
// that the board must fit its own baseline at every text size, or `.combat` must
// offer a real scroll path. Both are layout work; neither is a refusal.
//
// NOTHING SHIPPED SWEEPS THAT CELL, which is why it surfaced only now:
// mobilefit's s/m/l/xl matrix varies UI SIZE, not Text size, and actionreach
// sweeps Text size on the `customize` screen only. Combat x Text size x shape
// had no instrument. Filed to the board rather than fixed here.
//
// Usage
//   node tools/uprightgate.mjs                 source tree via tools/serve.mjs
//   node tools/uprightgate.mjs --dist          dist/AshenSpire.html over file://
//   node tools/uprightgate.mjs --only 844x390
//   node tools/uprightgate.mjs --text XL
//   node tools/uprightgate.mjs --selftest      the same-door known-bad corpus
//   node tools/uprightgate.mjs --ladder        DERIVE gateBelowH from the board
//        --ladder-text S      one text size instead of all four
//        --ladder-width 800   comma list; the fit is not purely a height
//        --ladder-from 390    bottom of the exhaustive 1 px sweep
//        --ladder-to 700      top of the reported bracket
//   CHROME=/path/to/chrome node tools/uprightgate.mjs
//
// Exit codes
//   0  every walled shape is gated with true advice, and no fitting shape is;
//      under --ladder, gateBelowH is exactly the minimum whole-fit height
//   1  a finding
//   2  usage / no browser / NOTHING MEASURED — never a pass
//
// REMOVAL CONDITION: deleted the day src/ui/components/upright.js is deleted —
// this file has no subject without it, and clause K is what will tell you.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

// THE CORPUS RUNS IN THREE GROUPS, BECAUSE A CORPUS IS A POPULATION TOO.
//
// doorplant hands the SAME argv to every plant in a group, and these plants do
// not live at the same cell. The gate's own defects show at Text M on the phone
// shapes; THE CONSTANT'S defect shows only at Text S in a three-pixel window,
// because Text S is the text size that sets the constant. Running the whole
// corpus at S would make plant 1 report NOT CAUGHT for want of a wall (at Text S
// END TURN is whole on the landscape phone — the very reason clause K's set is
// the wide one), and running it all at M makes the constant's plant invisible.
// So: group 1 is the gate, group 2 is the constant's guard IN THE MAIN RUN, and
// group 3 is the derivation. One number, checked at the cell where it is decided
// rather than at the cell that is convenient.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  let rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    args: ['--only', '844x390,1200x730,400x400,800x500'],
    timeoutMs: 900000,
    plants: [
      {
        // THE ORIGINAL DEFECT, put back at its source: no gate at all. This is
        // the state of the tree at 1ab9777, reproduced without needing that
        // bundle — the ref-pinned red above rots under SOP 2's drift clause the
        // moment the tree moves, and this does not.
        name: 'the gate never mounts — the 1ab9777 wall, back',
        file: 'src/ui/components/upright.js',
        find: '  if (!short) {',
        replace: '  short = false;\n  if (!short) {',
        expectRed: /WALL: .end-turn lies at/,
      },
      {
        // CLAUSE K's PLANT, and it is the one that matters: a gate that stands
        // everywhere is the refusal that outlived its premise. Green on W and G,
        // red only because something checks that the refusal STOPS.
        name: 'the gate stands on every shape — a refusal with a dead premise',
        file: 'src/main.js',
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse });',
        replace: '  updateUprightGate({ short: true, offerRotate: !turned.short && coarse });',
        expectRed: /GATE STANDS ON A SHAPE THAT FITS/,
      },
      {
        // THE ADVICE PLANT. The wording is a claim about a screen the code has
        // not seen; force it to the wrong one and the tool must catch the lie by
        // going and looking at the turned viewport.
        name: 'the advice stops being derived — it always says "turn your phone"',
        file: 'src/main.js',
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse });',
        replace: '  updateUprightGate({ short, offerRotate: true });',
        expectRed: /(ADVICE IS FALSE|says 'rotate')/,
      },
      {
        // The gate exists, mounts, and cannot be read — the failure mode a
        // presence check cannot see. `.end-turn` is still walled, the veil is
        // still in the DOM, and the player gets a black screen.
        name: 'the gate mounts with its words off screen',
        file: 'styles/ui.css',
        append: '.upright-card { position: fixed; top: -4000px; }',
        expectRed: /GATE IS UNREADABLE/,
      },
      {
        // GATING AT THE TRAP INSTEAD OF AT THE DOOR. The most tempting wrong
        // build of this feature is a combat-only gate — it fixes the screenshot
        // and lets the player start a run they cannot finish.
        name: 'the gate is combat-only — the player is let in at the door',
        file: 'src/main.js',
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse });',
        replace: '  updateUprightGate({ short: short && !!document.querySelector(\'.combat\'), offerRotate: !turned.short && coarse });',
        expectRed: /THE GATE IS NOT GLOBAL/,
      },
      {
        // Law 5 on the refusal itself. Untested, this clause is decoration.
        name: 'the gate scrolls sideways (Law 5, on the screen that exists to help)',
        file: 'styles/ui.css',
        append: '.upright-veil { justify-content: flex-start; } .upright-card { min-width: 3000px; }',
        expectRed: /scrolls sideways/,
      },
      {
        // MY OWN MISTAKE, PLANTED. The first predicate on this branch refused
        // 800x450, where END TURN is whole — a working window taken away. It was
        // caught by widening the shape list, which is luck dressed as method, so
        // the corpus now carries it. This is also the CONTENT door: the threshold
        // is a data value (Law 1), and a bad data value must fail loud and by
        // name (clause 5) rather than quietly refuse somebody's screen.
        name: 'the threshold creeps up and refuses a working window (the branch\'s own first bug)',
        file: 'src/content/balance.js',
        find: '      gateBelowH: 432,',
        replace: '      gateBelowH: 520,',
        expectRed: /GATE STANDS ON A SHAPE THAT FITS/,
      },
    ],
  });

  // GROUP 2 — THE BRANCH'S OWN SECOND BUG, AT THE CELL THAT CAN SEE IT.
  //
  // The plant above moves the threshold 85 px and any ladder catches it. This
  // one moves it THREE, which is the size the real defect was, and it is
  // invisible to every cell this file used to have: 800x433 at Text S did not
  // exist, so `gateBelowH: 435` printed PASS 14/14 through every run this branch
  // made while it refused three working screens. The cell and the text size are
  // BOTH part of the catch — this is the ladder half and the number half as one
  // thing, because a corrected constant under an uncorrected ladder is the same
  // defect waiting at a different offset.
  rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    args: ['--text', 'S', '--only', '800x433'],
    timeoutMs: 900000,
    plants: [
      {
        name: 'the threshold sits three pixels above the measurement (the branch\'s own SECOND bug, at Text S)',
        file: 'src/content/balance.js',
        find: '      gateBelowH: 432,',
        replace: '      gateBelowH: 435,',
        expectRed: /GATE STANDS ON A SHAPE THAT FITS/,
      },
    ],
  }) || rc;

  // GROUP 3 — THE DERIVATION, BOTH DIRECTIONS.
  //
  // `--ladder` is what makes the number re-derivable instead of remembered, and
  // an unfalsifiable derivation is a comment with a browser attached. Both edges
  // of the equality it asserts get a plant: three pixels too HIGH (refuses
  // working screens — the real defect) and twelve too LOW (a refusal that stopped
  // covering anything and still claims to be the largest safe value). The range
  // starts at 415 so both plants have a legal phase A; the tool prints the range
  // it walked, so a shortened sweep cannot pass itself off as the full one.
  rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    args: ['--ladder', '--ladder-text', 'S', '--ladder-from', '415'],
    timeoutMs: 900000,
    plants: [
      {
        name: '--ladder: the constant sits above the measurement',
        file: 'src/content/balance.js',
        find: '      gateBelowH: 432,',
        replace: '      gateBelowH: 435,',
        expectRed: /THE CONSTANT REFUSES A WORKING SCREEN/,
      },
      {
        name: '--ladder: the constant sits below the measurement (a refusal left behind by a board that moved)',
        file: 'src/content/balance.js',
        find: '      gateBelowH: 432,',
        replace: '      gateBelowH: 420,',
        expectRed: /THE CONSTANT IS BELOW ITS OWN MEASUREMENT/,
      },
    ],
  }) || rc;

  process.exit(rc);
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
import { printArtifactProvenance } from './artifact-provenance.mjs';

const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// See THE POPULATION in the header. `turnable` says whether this tool will also
// emulate the swapped viewport to check the advice — every phone/tablet shape
// can be turned; the desktop baseline is not a device and turning it is a
// question about a window, which clause G handles through the 'resize' wording.
// THE LADDER ACROSS THE THRESHOLD, at 1 px where the threshold actually sits.
//
// IT IS HERE BECAUSE MY OWN RULE HAS NOW CAUGHT ME TWICE AT THIS ONE SITE. The
// FIRST version of this list had no ladder at all and let me ship a predicate
// that refused 800x450, a working window. I fixed that with a neighbourhood —
// and then spaced the neighbourhood at 10 px and left `gateBelowH` sitting in
// the hole. At Text S every required control is whole from h 432 up, so
// h 432/433/434 were three screens the gate refused while this tool printed
// PASS 14/14, because it had a cell at 430 and a cell at 440 and nothing
// between. Bjorn found it by hand (2026-08-15) and it is the same sentence a
// second time: A POPULATION WITH NO CELL EITHER SIDE OF ITS OWN BOUNDARY CANNOT
// TELL YOU THE BOUNDARY IS WRONG — and "either side" means EITHER SIDE, at the
// resolution the boundary is written in. A threshold is an integer; so is its
// ladder.
//
// 430..440 is the band the constant lives in, so it is walked at 1 px. Outside
// that band the ladder stays coarse on purpose: those cells prove the gate keeps
// standing well below and keeps quiet well above, and neither claim needs
// resolution. If `gateBelowH` ever moves out of 430..440, THIS BAND MOVES WITH
// IT — the band is anchored to the constant, and a band left behind by a moved
// constant is exactly the defect above (Marina, 2026-08-15: when you move
// anything, ask what was anchored to its old position).
//
// AND THE BAND IS ONLY DIAGNOSTIC AT THE TEXT SIZE THAT SETS THE CONSTANT. The
// constant is the MINIMUM whole-fit height over the four text sizes, and that
// minimum is Text S (432; M is 495, L 533, XL 571 — `--ladder`). A default `M`
// run walks these nine cells and learns nothing about the number, because at M
// nothing fits down here at all. `--text S` is where this band speaks, and
// `--selftest` runs it at S for exactly that reason rather than trusting anyone
// to remember.
const LADDER_H = [410, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440, 450, 480, 500];
const SHAPES = [
  [390, 844], [360, 640], [834, 1194],   // portrait: must never gate
  [844, 390], [915, 412],                // landscape phone: the subject
  [400, 400],                            // short BOTH ways — the only cell that
                                         // renders the 'resize' wording at all.
                                         // Without it that half of the copy is
                                         // never drawn by any run and rots.
  ...LADDER_H.map((h) => [800, h]),
  [1024, 768],                           // tablet LANDSCAPE — must never gate
  [1200, 730],                           // the desktop baseline
];
// IS THIS CELL A DEVICE OR A WINDOW? It used to be `min(w,h) < 700`, which made
// the 800x4xx window ladder emulate a touchscreen and told the gate to say
// "turn your phone" to a browser window. The distinction is now stated per
// shape, because it is a fact about what the cell REPRESENTS and no arithmetic
// on its dimensions can recover it.
//
// DERIVED FROM `LADDER_H`, not restated (Law 0 clause 1). The hand-written twin
// of this list was a trap with a name: adding a ladder rung and forgetting its
// WINDOWS entry silently makes that rung a TOUCHSCREEN, which changes the gate's
// wording and the shape of the finding, and nothing would have said so.
const WINDOWS = new Set([...LADDER_H.map((h) => `800x${h}`), '1200x730']);
const isDevice = (shape) => !WINDOWS.has(shape);
// balance.ui.textSize. A second copy of a content value, so it is named here
// rather than hidden (Law 1 clause 2); it is the one drift risk in this file.
const TEXT = { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' };

// TWO CONTROL SETS, AND THEY ANSWER TWO DIFFERENT QUESTIONS.
//
//   `required` — ONE control, the way OUT of the turn. Its loss is what strands
//     a run, so it is the subject of the WALL clause.
//   `whole` — the four controls tools/mobilefit.mjs already names as required,
//     plus the hand. This set is the subject of the WAKE clause, and it has to
//     be the wider one: at Text S the landscape phone still has END TURN whole
//     while two thirds of the hand is cut, so "END TURN is fine" is NOT the same
//     claim as "this shape works", and a wake clause built on the narrow set
//     would have called that shape working and failed the gate for refusing it.
//     I know because it did.
const WHOLE_SET = ['.end-turn', '.hand-area', '.energy-orb', '.pile.draw', '.pile.discard'];
const SURFACES = [
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.end-turn')`, required: '.end-turn', whole: WHOLE_SET },
  { name: 'title', q: '', ready: `!!document.querySelector('#app *')`, required: null, whole: [] },
];

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
// A COMMA LIST, not one shape. --selftest needs three cells in one run — a
// walled one, a fitting one, and one short in both directions — because its
// three plants each die on a different cell and a single-shape corpus would
// report two of them NOT CAUGHT for want of a shape rather than for want of a
// check.
const only = argOf('--only');
const onlySet = only ? new Set(only.split(',').map((s) => s.trim()).filter(Boolean)) : null;
const textKey = argOf('--text') || 'M';
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// THE PROBE. Two readings off one frame, and neither of them moves anything.
//
// `required` is measured where the screen left it. The ancestor walk asks for a
// scroller a THUMB could use — auto|scroll with real travel — because that is
// the difference Bjorn's near-miss turned on. The document itself counts only
// if IT has travel; this app is `overflow: hidden` at the root, so it almost
// never does, and saying so per cell is cheaper than assuming it.
const probe = (required, wholeSet) => `(() => { const n=(v)=>+(+v).toFixed(2);
  const vw=innerWidth, vh=innerHeight;
  const zoom=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))||1;
  const layout=document.documentElement.getAttribute('data-layout');
  const scrollerName=(el)=>el.tagName+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).join('.'):'');
  let ctl=null;
  const sel=${JSON.stringify(required)};
  if (sel) {
    const el=document.querySelector(sel);
    if (!el) ctl={ present:false };
    else {
      const r=el.getBoundingClientRect();
      const inside = r.top>=-0.5 && r.bottom<=vh+0.5 && r.left>=-0.5 && r.right<=vw+0.5;
      let p=el.parentElement, scroller=null, clipper=null;
      while (p) {
        const cs=getComputedStyle(p);
        const yTravel=p.scrollHeight-p.clientHeight, xTravel=p.scrollWidth-p.clientWidth;
        const canY=(cs.overflowY==='auto'||cs.overflowY==='scroll')&&yTravel>1;
        const canX=(cs.overflowX==='auto'||cs.overflowX==='scroll')&&xTravel>1;
        if ((canY||canX)&&!scroller) scroller={ el:scrollerName(p), y:yTravel, x:xTravel };
        if (!clipper&&(cs.overflowY==='hidden'||cs.overflowX==='hidden')&&(yTravel>1||xTravel>1))
          clipper={ el:scrollerName(p), overflowY:cs.overflowY, scrollH:p.scrollHeight, clientH:p.clientHeight };
        p=p.parentElement;
      }
      const de=document.scrollingElement||document.documentElement;
      const docTravel=de.scrollHeight-de.clientHeight;
      if (!scroller && docTravel>1) scroller={ el:'document', y:docTravel, x:0 };
      // FOUR WORDS, NOT TWO, AND THE FOURTH IS THE ONE I NEARLY GOT WRONG.
      // At 915x412 END TURN lies 395..419 against a 412 px viewport: 17 of its
      // 24 px are on screen and a thumb CAN hit them (Bjorn's mobilefit reads
      // 25/45 finger positions there). Calling that a wall would be me doing
      // the thing he caught himself doing - describing a measurement in a word
      // stronger than the measurement. UNREACHABLE means NOT ONE PIXEL is on
      // screen and no gesture exists; CLIPPED means part of it is.
      // (No backticks below this line: it is inside a template literal.)
      const overlap = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0))
                    * Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      ctl={ present:true, top:n(r.top), bottom:n(r.bottom), left:n(r.left), right:n(r.right),
            inside, scroller, clipper, onScreenPct: r.width*r.height>0 ? n(100*overlap/(r.width*r.height)) : 0,
            reach: inside ? 'onscreen' : (scroller ? 'scrollable' : (overlap > 0 ? 'clipped' : 'unreachable')) };
    }
  }
  // THE WAKE SET: which of the required controls are WHOLE on screen. An absent
  // one counts as NOT whole — a control that is not in the DOM is not a control
  // the player can use, and treating absence as "fine" is how a wake clause goes
  // quiet (this file's own subject, one level up).
  const cut=[]; let wholeCount=0;
  for (const s of ${JSON.stringify(wholeSet || [])}) {
    const e=document.querySelector(s);
    if(!e){ cut.push(s+':absent'); continue; }
    const r=e.getBoundingClientRect();
    const ov=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0))*Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0));
    const pct = r.width*r.height>0 ? n(100*ov/(r.width*r.height)) : 0;
    if (pct>=99.9) wholeCount++; else cut.push(s+':'+pct+'%');
  }
  const g=document.querySelector('.upright-veil');
  let gate=null;
  if (g) {
    const gr=g.getBoundingClientRect();
    const card=g.querySelector('.upright-card');
    const cr=card?card.getBoundingClientRect():null;
    const text=(g.innerText||'').replace(/\\s+/g,' ').trim();
    const cs=getComputedStyle(g);
    gate={ advice:g.dataset.advice||null,
      covers: gr.top<=0.5 && gr.left<=0.5 && gr.right>=vw-0.5 && gr.bottom>=vh-0.5,
      box:{ top:n(gr.top), left:n(gr.left), w:n(gr.width), h:n(gr.height) },
      visible: cs.display!=='none' && cs.visibility!=='hidden' && parseFloat(cs.opacity||'1')>0.05,
      text, chars:text.length,
      cardOnScreen: !!cr && cr.top>=-0.5 && cr.bottom<=vh+0.5 && cr.left>=-0.5 && cr.right<=vw+0.5,
      cardBox: cr?{ top:n(cr.top), bottom:n(cr.bottom), left:n(cr.left), right:n(cr.right) }:null,
      controls: g.querySelectorAll('button,a[href],input,select,textarea').length,
      overflowX: n(g.scrollWidth-g.clientWidth) };
  }
  return { vw, vh, zoom, layout, localH:n(vh/zoom), ctl, gate, cut, wholeCount,
           wholeTotal: ${JSON.stringify((wholeSet || []).length)} }; })()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

// ---------------------------------------------------------------------------
// `--ladder` — WHERE THE CONSTANT COMES FROM. Derived on demand, not remembered.
//
// `balance.ui.uiScale.gateBelowH` is a MEASUREMENT, and until now it was a
// measurement taken by hand once and typed into a comment. That is a frozen
// snapshot of a thing that moves with the board, and the ladder table beside it
// pointed at `node tools/uprightgate.mjs` as the way to re-take it — a command
// that could not produce that table. A pointer to a re-measure that does not
// re-measure is how 435 survived: the number looked sourced.
//
// THIS IS THE SET THE CONSTANT IS A MINIMUM OF, ENUMERATED. For each text size
// it finds the SMALLEST viewport height at which all five required controls are
// whole, then checks the constant equals the smallest of those. Both edges of
// that equality are real defects and both are asserted:
//   · a constant ABOVE the minimum refuses screens that work — clause K's defect
//     at the source, and what 435 was;
//   · a constant BELOW it is a stale refusal that stopped covering anything —
//     it claims to be the largest safe value and is not.
//
// NO INTERPOLATION WHERE CORRECTNESS LIVES. Phase A walks [--ladder-from,
// gateBelowH] at 1 px, exhaustively, for every text size — that range is the
// entire span the gate refuses, so "no working screen is refused" is checked
// cell by cell and never inferred. It matters that this is exhaustive: the
// whole-fit percentage is NOT monotonic in height (at Text M it reads 97.13% at
// h 485 and 94.4% at 486 — the auto-zoom steps 0.66 -> 0.67 and the board gets
// bigger faster than the window), so a bisection here would be a guess wearing
// a measurement's clothes.
//
// PHASE B IS THE TABLE AND IT IS REPORTED, NOT ASSERTED — and the difference is
// stated rather than assumed. The other three text sizes fit far above the
// constant, so finding their exact height costs hundreds of cells; phase B
// brackets at 8 px and closes at 1 px, and a whole cell that appeared and
// vanished inside one 8 px bracket would be missed. NOTHING THE TOOL ASSERTS
// RESTS ON PHASE B: the constant is a minimum, phase B only ever reports values
// above it, and a value above the minimum cannot change the minimum.
//
// DOOR. Every measurement comes through the same door as the rest of this file —
// the rendered app in a real browser, read off the frame it painted. The one
// thing not read through the browser is the NUMBER BEING CHECKED: `gateBelowH`
// is read by importing src/content/balance.js in Node. Same bytes, different
// loader, and it is named here rather than left to be found. Whether the shipped
// bundle carries those same bytes is tools/verify-shipped.mjs's subject.
async function runLadder(read) {
  const { balance } = await import(pathToFileURL(resolve(ROOT, 'src/content/balance.js')).href);
  const constant = balance?.ui?.uiScale?.gateBelowH;
  if (constant == null) {
    console.error(`uprightgate --ladder: balance.ui.uiScale.gateBelowH is absent. There is no constant to check, and absent is not a pass.`);
    return 2;
  }
  const from = +(argOf('--ladder-from') ?? 390);
  const to = +(argOf('--ladder-to') ?? 700);
  const widths = (argOf('--ladder-width') ?? '800').split(',').map((s) => +s.trim());
  const texts = (argOf('--ladder-text') ?? Object.keys(TEXT).join(',')).split(',').map((s) => s.trim());
  for (const t of texts) if (!TEXT[t]) { console.error(`uprightgate --ladder: --ladder-text ${t} is not one of ${Object.keys(TEXT).join('/')}`); return 2; }
  if (!(from <= constant)) { console.error(`uprightgate --ladder: --ladder-from ${from} is above gateBelowH ${constant}; phase A would check nothing.`); return 2; }

  const surface = SURFACES[0];
  const fit = (r) => r.wholeCount === r.wholeTotal;
  const line = (w, h, t, r) => `    ${w}x${h} ${t.padEnd(2)} zoom=${r.zoom} layout=${r.layout} whole ${r.wholeCount}/${r.wholeTotal}`
    + (r.cut.length ? ` cut[${r.cut.join(' ')}]` : '');

  console.log(`\n  --ladder — deriving gateBelowH from the board, at width(s) ${widths.join(',')}, text ${texts.join(',')}`);
  console.log(`  gateBelowH as written in src/content/balance.js: ${constant}`);
  console.log(`\n  PHASE A — exhaustive 1 px over ${from}..${constant} (the whole span the gate refuses).`);
  const firstWhole = new Map();          // `${w}|${t}` -> h | null
  for (const w of widths) {
    for (const t of texts) {
      let found = null;
      for (let h = from; h <= constant && found === null; h++) {
        const r = await read(w, h, surface, false, t);
        if (fit(r)) { found = h; console.log(line(w, h, t, r)); }
        else if (h === from || h === constant || h % 10 === 0) console.log(line(w, h, t, r));
      }
      firstWhole.set(`${w}|${t}`, found);
      console.log(`    -> width ${w} text ${t}: ${found === null ? `NO whole cell at or below ${constant}` : `first whole h = ${found}`}`);
    }
  }

  console.log(`\n  PHASE B — the table. 8 px bracket, closed at 1 px. REPORTED, not asserted (see header).`);
  for (const w of widths) {
    for (const t of texts) {
      const key = `${w}|${t}`;
      if (firstWhole.get(key) !== null) { console.log(`    width ${w} text ${t}: settled in phase A at ${firstWhole.get(key)}`); continue; }
      let band = null;
      for (let h = constant + 1; h <= to && band === null; h += 8) {
        const r = await read(w, h, surface, false, t);
        console.log(line(w, h, t, r));
        if (fit(r)) band = h;
      }
      if (band === null) { firstWhole.set(key, 'unknown'); console.log(`    -> width ${w} text ${t}: unknown — no whole cell up to ${to}. Unknown, never a number.`); continue; }
      let first = band;
      for (let h = Math.max(constant + 1, band - 7); h < band; h++) {
        const r = await read(w, h, surface, false, t);
        console.log(line(w, h, t, r));
        if (fit(r)) { first = h; break; }
      }
      firstWhole.set(key, first);
      console.log(`    -> width ${w} text ${t}: first whole h = ${first}`);
    }
  }

  console.log(`\n  THE SET THE CONSTANT IS THE MINIMUM OF`);
  const known = [];
  for (const w of widths) for (const t of texts) {
    const v = firstWhole.get(`${w}|${t}`);
    console.log(`    width ${w}  text ${t.padEnd(2)}  first whole h = ${v === null ? 'unknown' : v}`);
    if (typeof v === 'number') known.push(v);
  }
  const bad = [];
  if (!known.length) {
    bad.push(`NO CELL FITS ANYWHERE IN ${from}..${to} at any text size measured. The minimum is UNKNOWN, and unknown is not a pass — widen --ladder-to or fix the board.`);
  } else {
    const trueValue = Math.min(...known);
    console.log(`\n    minimum over the set = ${trueValue}; gateBelowH = ${constant}`);
    if (trueValue < constant) {
      bad.push(`THE CONSTANT REFUSES A WORKING SCREEN — every required control is whole from h ${trueValue} up, `
        + `and gateBelowH is ${constant}. Heights ${trueValue}..${constant - 1} are refused and they WORK. `
        + `The true value is ${trueValue}. A gate that takes away a working screen is worse than no gate.`);
    } else if (trueValue > constant) {
      bad.push(`THE CONSTANT IS BELOW ITS OWN MEASUREMENT — nothing fits until h ${trueValue} and gateBelowH is ${constant}, `
        + `so it is not the largest value that never refuses a working screen. Either the board improved and the number `
        + `was left behind, or the number was never derived. Re-derive it: ${trueValue}.`);
    }
  }

  console.log(`\n  BOUNDARY — what this derivation does NOT cover, named rather than left to be found:
  (a) WIDTH IS NOT SWEPT BY DEFAULT. The constant is a HEIGHT and the fit is not
      purely one, so this ran at ${widths.join(',')}. Measured 2026-08-15 (Sunna) at Text S:
      432 at widths 600/800/844/1200/1440 — it SATURATES, wider buys nothing —
      and LATER at narrower ones (444 at 400 and 360, 453 at 300, where the
      narrow layout takes over). Narrower is never earlier, so the minimum over
      widths is the wide-and-saturated value. Re-check with --ladder-width if the
      composition changes.
  (b) UI SIZE. Every cell here is Auto fit. A player on a fixed UI-size setting
      is a different board, and mobilefit is the tool that sweeps that axis.
  (c) ONE SURFACE. ?shot=combat, because that is where the five required controls
      are named. A screen that fits combat and not the map is not this number's.
  (d) ONE BOX, headless Chromium, device-metric emulation, and EVERY CELL IS
      READ AS A WINDOW — no touch emulation, the same call the 800x… rungs make
      in the main run. A touchscreen of the same dimensions is a device cell and
      differs in the gate's WORDING, not in whether the board fits; the fit is
      what is measured here. Emulation is not a device either — see the main
      run's boundary (a).
  (e) THE LOWER EDGE OF THE BAND IS NOT LEGISLATED. This checks the constant is
      the largest value that refuses nothing working. It does NOT check the gate
      catches every broken screen, and at large text it cannot: the board does
      not fit itself until h 495/533/571 at M/L/XL, so between the constant and
      those heights a large-text player gets a cut board and no refusal. That is
      layout work, filed, and deliberately not the refusal's job — a threshold
      that grew with the accessibility setting would refuse more and more of a
      large-text player's screens, which is the opposite of what that setting is
      for.`);

  console.log(`\n  ${bad.length ? `FAIL — ${bad.length} finding(s)` : `PASS — gateBelowH ${constant} is exactly the minimum whole-fit height over the measured set`}`);
  for (const b of bad) console.log(`    - ${b}`);
  return bad.length ? 1 : 0;
}

async function main() {
  if (!browserPath) { console.error('uprightgate: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  if (!TEXT[textKey]) { console.error(`uprightgate: --text ${textKey} is not one of ${Object.keys(TEXT).join('/')}`); process.exit(2); }
  printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
  const profile = mkdtempSync(join(tmpdir(), 'uprightgate-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`uprightgate: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8291, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`uprightgate — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}  text=${textKey}`);
  console.log(`DOOR: the rendered app in a real browser at emulated device metrics — the same URL a`);
  console.log(`      player's browser loads, read off the frame the screen painted. NOTHING IS`);
  console.log(`      SCROLLED, FOCUSED OR scrollIntoView'd: 'overflow: hidden' scrolls`);
  console.log(`      programmatically and never by hand, so a probe that positions its own target`);
  console.log(`      has already left the door (Bjorn, 2026-08-15).`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw'); return r.result.value; };
  const until = async (x, w, ms = 20000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(150); }
    throw new Error(`timed out waiting for ${w}`); };

  async function read(w, h, surface, device = true, tKey = textKey) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: device }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: device, maxTouchPoints: device ? 5 : 1 }, S);
    await cdp.send('Page.navigate', { url: base + surface.q }, S);
    await until(surface.ready, `${surface.name} to mount at ${w}x${h}`);
    await ev(`document.documentElement.style.fontSize='${TEXT[tKey]}'; 'ok'`);
    // The auto-zoom re-flexes on a 150ms debounce and re-applies at +300ms from
    // boot; 800 clears both, and the gate is written by the same call.
    await wait(800);
    return ev(probe(surface.required, surface.whole));
  }

  if (args.includes('--ladder')) {
    const code = await runLadder(read);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(code);
  }

  const fails = []; let cells = 0;
  for (const [w, h] of SHAPES) {
    const shape = `${w}x${h}`;
    if (onlySet && !onlySet.has(shape)) continue;
    const rows = [];
    const device = isDevice(shape);
    for (const surface of SURFACES) rows.push([surface, await read(w, h, surface, device)]);
    const combat = rows.find(([s]) => s.name === 'combat')[1];
    const reach = combat.ctl && combat.ctl.present ? combat.ctl.reach : null;
    const walled = reach === 'unreachable';
    // "This shape works" is the WIDE set, not END TURN alone — see WHOLE_SET.
    const intact = combat.wholeTotal > 0 && combat.wholeCount === combat.wholeTotal;
    cells++;

    console.log(`\n  ${shape}  layout=${combat.layout} zoom=${combat.zoom} localH=${combat.localH} `
      + `${combat.ctl && combat.ctl.present ? `.end-turn ${combat.ctl.reach} (top ${combat.ctl.top}..${combat.ctl.bottom}, ${combat.ctl.onScreenPct}% on screen)` : '.end-turn ABSENT'}`
      + `  whole ${combat.wholeCount}/${combat.wholeTotal}${combat.cut.length ? ` cut[${combat.cut.join(' ')}]` : ''}`);
    for (const [surface, r] of rows) {
      console.log(`    ${surface.name.padEnd(7)} gate=${r.gate ? `STANDING advice='${r.gate.advice}' covers=${r.gate.covers} chars=${r.gate.chars} readable=${r.gate.cardOnScreen}` : 'absent'}`);
    }

    const bad = [];
    // --- clause W: the wall must be gated ------------------------------------
    if (!combat.ctl || !combat.ctl.present) {
      bad.push(`.end-turn is not in the DOM on ?shot=combat — the required control is UNKNOWN, and unknown is not a pass`);
    } else if (walled) {
      const c = combat.ctl.clipper;
      const where = `top ${combat.ctl.top}..${combat.ctl.bottom} outside a ${h} px viewport with NO scrollable ancestor`
        + (c ? ` (nearest clipper ${c.el}, overflow-y ${c.overflowY}, scrollHeight ${c.scrollH} > clientHeight ${c.clientH})` : '');
      for (const [surface, r] of rows) {
        if (!r.gate) bad.push(`WALL: .end-turn lies at ${where} — and NO GATE STANDS on ${surface.name}`);
      }
    } else if (reach === 'clipped') {
      // THE BAND, REPORTED AND NOT LEGISLATED. Neither required nor forbidden:
      // a control 70% on screen with no scroll path is not a wall and is not
      // fine either, and drawing the line inside this band would be a threshold
      // fitted by whoever ran the tool last. The gate's own predicate decides
      // these shapes; this line says what the player actually gets.
      console.log(`      (band) .end-turn is CLIPPED, not walled — ${combat.ctl.onScreenPct}% of it is on screen and tappable, `
        + `with no scroll path to the rest. Gate ${rows[0][1].gate ? `STANDS (advice '${rows[0][1].gate.advice}')` : 'is ABSENT'} here by the app's own predicate; this clause requires neither.`);
    }

    // --- clause G: a standing gate must be legible, whatever put it there -----
    for (const [surface, r] of rows) {
      if (!r.gate) continue;
      if (!r.gate.visible || !r.gate.covers) bad.push(`GATE DOES NOT COVER the ${surface.name} viewport — box ${JSON.stringify(r.gate.box)} against ${w}x${h}, visible=${r.gate.visible}`);
      if (!r.gate.cardOnScreen || r.gate.chars < 20) {
        bad.push(`GATE IS UNREADABLE on ${surface.name} — ${r.gate.chars} char(s) of text, card on screen=${r.gate.cardOnScreen} at ${JSON.stringify(r.gate.cardBox)}. A refusal the player cannot read is the wall with a lid on it.`);
      }
      if (r.gate.overflowX > 0) bad.push(`the gate itself scrolls sideways on ${surface.name} — ${r.gate.overflowX} px (Law 5)`);
    }
    // The gate is GLOBAL by design — gating at the trap instead of at the door
    // is not mercy — so a walled shape that gates combat and lets the player
    // into the title screen is a finding of its own.
    if (walled || reach === 'clipped') {
      const standing = rows.filter(([, r]) => !!r.gate).length;
      if (standing > 0 && standing < rows.length) {
        bad.push(`THE GATE IS NOT GLOBAL — it stands on ${rows.filter(([, r]) => r.gate).map(([s]) => s.name).join(', ')} `
          + `and not on ${rows.filter(([, r]) => !r.gate).map(([s]) => s.name).join(', ')}. A player let in at the door is stranded later.`);
      }
    }

    // --- clause K, the WAKE ---------------------------------------------------
    if (intact) {
      for (const [surface, r] of rows) {
        if (r.gate) {
          bad.push(`GATE STANDS ON A SHAPE THAT FITS — ${surface.name}, all ${combat.wholeTotal} required controls are `
            + `whole on screen (${WHOLE_SET.join(', ')}). This is the refusal outliving its premise: if a composition `
            + `now fits this shape, lower balance.ui.uiScale.gateBelowH or delete src/ui/components/upright.js — `
            + `do not leave it refusing a screen that works.`);
        }
      }
    }

    // --- clause G's advice half: GO AND LOOK AT THE TURNED VIEWPORT -----------
    //
    // ONE DIRECTION ONLY, AND THE ASYMMETRY IS DELIBERATE. 'rotate' is a pure
    // claim about geometry — "the turned shape works" — so it is asserted: the
    // tool emulates h x w and requires every required control to come back
    // whole. 'resize' is NOT its converse any more, because the app also weighs
    // `(pointer: coarse)` before it offers turning at all, so a 'resize' on a
    // shape that would survive turning is the CORRECT answer for a mouse. This
    // clause therefore proves the instruction the player is given is true, and
    // is deliberately silent on the instruction they are NOT given. Naming the
    // silence beats re-implementing the app's rule here and calling it a check.
    const gateNow = rows.find(([s]) => s.name === 'combat')[1].gate;
    if (gateNow && gateNow.advice === 'rotate') {
      const turned = await read(h, w, SURFACES[0], device);
      const turnedIntact = turned.wholeTotal > 0 && turned.wholeCount === turned.wholeTotal;
      if (!turnedIntact) {
        bad.push(`ADVICE IS FALSE — the gate says 'rotate' at ${shape}, but ${h}x${w} does not work either `
          + `(${turned.wholeCount}/${turned.wholeTotal} required controls whole; cut ${turned.cut.join(' ')}). `
          + `Turning the device would not help, and telling someone to do a thing that will not help is worse than saying nothing.`);
      }
    }

    for (const b of bad) fails.push(`${shape}: ${b}`);
    for (const b of bad) console.log(`      <-- ${b}`);
  }

  if (cells === 0) {
    console.error(`\nuprightgate: nothing was measured${only ? ` (--only ${only} matched no shape)` : ''}. That is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map(([w, h]) => `${w}x${h}`).join(', ')}`);
    cdp.close(); child.kill(); if (server) server.close(); process.exit(2);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium, device-metric emulation, one box. What this
  does NOT cover, named rather than left to be found:
  (a) A REAL PHONE. Emulation is not a device: no software keyboard, no rotation
      animation, no address bar. The gate rides window.innerHeight, so a browser
      that shrinks the LAYOUT viewport when the keyboard opens could raise it over
      a text field in portrait. Untested here and untestable here.
  (b) TEXT SIZE — this run measured ${textKey} only. Content height moves with the
      setting, so a shape that fits at M can wall at XL. \`--text XL\` is the other
      cell and it is not run by default.
  (c) SURFACES BEYOND combat AND title. The map at 844x390 is a maze rather than a
      wall (Bjorn: the ENTRANCE—BOSS strip is display:none above 700 px, 1074 px of
      the choice off screen) and the gate covers it by standing everywhere — but
      this tool names no required control there and therefore proves nothing there.
  (d) WHETHER THE REFUSAL IS THE RIGHT CALL. It measures that the game says no and
      says it legibly. Whether landscape should instead be SUPPORTED is a design
      decision (it was taken: components/upright.js, header) and no number here.
  (e) THE ROUNDING BAND. The predicate is the zoom CLAMP, not the fit, so shapes
      within the zoom-rounding quantum (~6 local px at the floor) can be clipped
      without gating. A clip is not a wall; clause W is what would catch it if it
      ever became one.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} finding(s) over ${cells} shape(s)` : `PASS — ${cells}/${cells} shapes: every walled shape refuses legibly with true advice, and no fitting shape refuses at all`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`uprightgate: ${e.message}`); process.exit(2); });
