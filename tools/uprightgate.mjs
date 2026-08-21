#!/usr/bin/env node
// tools/uprightgate.mjs — R-32's machine check. A SHAPE THE BOARD DOES NOT FIT
// IS A SHAPE THE GAME REFUSES OUT LOUD — AND A SHAPE IT DOES FIT IS A SHAPE IT
// NEVER REFUSES. Both edges, because only one of them can rot quietly.
//
// CURRENT AFTER #27: 844x340..464 are complete short-wide boards and therefore
// must have no gate; 844x339 is the first still-walled cell and must have a
// readable one. The historical derivation narrative below describes the former
// all-below-465 refusal, while the executable clauses and SHAPES table carry the
// current bounded composition contract.
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
//       nothing. So something has to check that the refusal STOPS: THE GATE MUST
//       BE ABSENT ON EVERY SHAPE WHERE NOTHING WALLS. A suite that only asserts
//       the refusal re-proves it forever and watches the premise never.
//
//       IT ASKED ABOUT `whole` UNTIL 2026-08-16 AND MARINA RULED THAT WRONG
//       (MR-142): the refusal answers to the WALL. So the trip is still the wide
//       set — all five required controls whole (WHOLE_SET below), which is the
//       cheap question this run already has an answer to — but a trip is now a
//       QUESTION, not a finding, and it is resolved after every shape is read:
//         · the shape walls at ANOTHER TEXT SIZE   -> justified. The wall arrives
//           ~100 px higher at XL than at S and the gate is one number for all four.
//         · nothing walls here, but something walls ABOVE here -> the price of one
//           downward-closed threshold over a wall set with a hole in it. Counted
//           in `--ladder`'s COST table, printed per shape, not a finding.
//         · nothing walls here and nothing walls above -> THE FINDING. The refusal
//           has outlived its premise: `gateBelowH` comes down or
//           components/upright.js is deleted. The day a landscape composition
//           ships, every trip lands here.
//
//       WHY THE TRIP IS STILL `whole` AND NOT THE PREMISE. It is a filter, not the
//       verdict: it is free (already measured), it never misses a dead premise (a
//       shape with no wall anywhere and a gate standing is whole at some text size
//       or it is a layout defect clause W already owns), and it keeps the
//       expensive four-text-size re-read to the handful of shapes that could be
//       findings. The VERDICT reads the wall, every time.
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
//     WALKED AT 1 PX ACROSS 460..470 where the constant lives). The ladder is
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
//   TEXT SIZE — one cell (the M default) unless `--text S|M|L|XL`, EXCEPT in
//     clause K's resolution, which re-reads a tripped shape at all four because
//     the question it asks is about the other three. Stated in the boundary
//     rather than left to be found: text size changes content height, so a shape
//     that fits at M can wall at XL. THE CONSTANT IS DECIDED AT XL: the last
//     walled height is 367/394/423/464 across S/M/L/XL, the constant is one past
//     the largest (MR-143), and a default `M` run cannot see it move. `--ladder`
//     is the mode that walks all four and checks the number against them;
//     `--selftest` carries the XL cell that sets it and the Text S cell that
//     shows what it costs, so the check does not depend on which flag a person
//     happened to type.
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
// KNOWN OPEN — WHAT THE RE-DERIVATION CLOSED, AND THE ONE THING NO HEIGHT CAN.
//
// Measured 2026-08-16 (Sunna) on this branch — dev = aafa3e2 + this branch +
// vira/two-predicates — headless Chromium, source tree, width 800 for the sweeps.
//
// CLOSED, AND BY A RULING RATHER THAN BY LAYOUT WORK. Moving the constant
// 432 -> 465 puts the gate on every wall this house has measured at width 800:
// the Text XL band h 390..450 AND the one-pixel wall at 464 that sits 14 px
// above the top of the interval everyone was counting. `--predicates` was RED at
// e5cb619 with "A WALL WITH NO GATE — text XL, h 432..464" and is GREEN here.
// Marina's XL card is not re-carded — IT CLOSES. A predicate ruling closed a
// layout card, which is the strongest practical argument for MR-142 and neither
// of us could see it from one predicate alone.
//
//   the wall, per text size, at width 800 (`--ladder --ladder-from 360`, 964
//   cells, exhaustive 1 px):
//     text            S     M     L     XL
//     last WALL h   367   394   423   464      -> constant = max+1 = 465
//     all 5 whole   432   495   533   571      <- the COST column, not the number
//
// STILL OPEN, AND IT IS THE PRICE OF THE RULING, NOT A BUG IN IT. One
// downward-closed threshold over four text sizes must refuse heights that wall
// nobody, and `--ladder` counts them on every run rather than leaving them to be
// discovered: at Text S, h 368..464 are refused and NOT ONE of them is a wall —
// 33 of those (432..464) are FULLY WHOLE, a perfect screen refused. At M, 70
// heights; at L, 41. And h 451..463 refuses nobody at any text size, because
// that is the gap the XL wall jumps and a threshold cannot jump with it. THE
// DIRECTION OF THE COST FLIPPED WITH THE PREDICATE: under `whole` it fell on
// large-text players (walls left uncovered); under the wall it falls on
// small-text players (working heights refused). A per-text-size TABLE
// {368, 395, 424, 465} would pay neither — measured, filed, and not installed,
// because the SHAPE of the threshold is a ruling and MR-142 ruled the predicate.
//
// STILL OPEN, AND NO HEIGHT CLOSES IT: at Text XL, 360x640 is walled — END TURN
// at top 659.25..720.91 in a 640 px viewport. A PORTRAIT phone, at the largest
// accessibility text. A threshold that covered it would have to exceed 640,
// refusing every window shorter than that including desktop ones, and neither
// piece of advice this gate can give is even true there (turning 360x640 gives
// 640x360, which is worse). `--text XL` is therefore still RED on this branch,
// with the finding on 360x640 alone instead of on 23 shapes. THE BOARD MUST FIT
// ITSELF at every text size, or `.combat` must offer a real scroll path. Both
// are layout work; neither is a refusal, and a refusal that grew with the
// accessibility setting would take screens away as a player turns it up.
//
// THE COMBAT BOARD DOES NOT FIT ITSELF AT LARGE TEXT, and that is the cause of
// all of it. % of each control on screen, width 800:
//   Text L : the hand is cut below h 533 (68.83% at 464, 47.8% at 420); END TURN
//            is UNREACHABLE at every h <= 423.
//   Text XL: the hand is cut below h 571 (54.19% at 463); END TURN is
//            UNREACHABLE at every h <= 450 and again at 464.
//   Text S : the hand is cut below h 432 — 67.3% at h 390, CLIPPED WITH NO
//            SCROLL PATH, which is the number Marina's ruling left open as mine.
//   Not only short windows — at Text XL, 1024x600 shows 68% of the hand and
//   960x540 shows 66% of END TURN. Identical at 1ab9777: PRE-EXISTING, all of it.
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
//   node tools/uprightgate.mjs --ladder        DERIVE shortWideMinH from the board
//        --ladder-text S      one text size instead of all four
//        --ladder-width 800   comma list; the wall is a rect, not a height
//        --ladder-from 390    floor of the exhaustive 1 px sweep (free — a cell
//                             below the maximum cannot raise it)
//        --ladder-to 600      ceiling of the same sweep, and NOT free: a top cell
//                             that is still a wall is a finding, not a number
//   node tools/uprightgate.mjs --predicates    THE PREDICATE AGAINST THE PREMISE
//        --predicate-text S   comma list; default all four
//        --predicate-width 800
//        --predicate-from 360 / --predicate-to 480   the exhaustive 1 px sweep
//   CHROME=/path/to/chrome node tools/uprightgate.mjs
//
// Exit codes
//   0  every walled shape is gated with true advice, and no shape where nothing
//      walls is refused; under --ladder, shortWideMinH is exactly max(wall h)+1 over
//      the measured text sizes; under --predicates, every wall in the sweep has
//      the gate standing
//   1  a finding
//   2  usage / no browser / NOTHING MEASURED — never a pass
//
// `--predicates` WAS EXPECTED RED ON THIS TREE AND IS NOW GREEN — the paragraph
// is kept and corrected in place rather than deleted, because what closed it is
// the point. VIRA WROTE, at e5cb619: "At Text XL the wall runs to h 450 and
// gateBelowH is 432, so h 432..450 is a wall with no gate — Marina's card, with
// those coordinates, filed deliberately rather than left inside the phrase 'a
// layout backlog'." THAT CARD IS CLOSED, NOT RE-CARDED (Sunna, 2026-08-16):
// re-deriving the constant against the premise put it at 465, which covers
// 432..450 AND the one-pixel wall at 464 that neither of us could see until she
// read `ctl.reach`. A ruling on WHICH PREDICATE closed a layout card. That is
// the strongest practical evidence for MR-142 and none of it was visible from
// either predicate alone.
//
// NOTHING RUNS THIS TOOL BUT A PERSON: `grep -rn uprightgate` outside this file
// returns nothing, in .github/workflows/ci.yml included, so no mode here blocks
// a merge. Verified at e5cb619 (Vira), re-verified 2026-08-16 (Sunna). The day
// that stops being true, this paragraph is the warning.
//
// REMOVAL CONDITION: deleted the day src/ui/components/upright.js is deleted —
// this file has no subject without it, and clause K is what will tell you.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

// THE CORPUS RUNS IN FOUR GROUPS, BECAUSE A CORPUS IS A POPULATION TOO.
//
// doorplant hands the SAME argv to every plant in a group, and these plants do
// not live at the same cell. The gate's own defects show at Text M on the phone
// shapes; THE CONSTANT'S defect shows in a three-pixel window and only at the
// text size that can see the number. Running the whole corpus at one cell would
// make plants report NOT CAUGHT for want of a shape rather than for want of a
// check. So: group 1 is the gate, group 2 is the constant's guard IN THE MAIN
// RUN, group 3 is the derivation, group 4 is the predicate against the premise.
// One number, checked at the cell where it is decided rather than at the cell
// that is convenient.
//
// THE CELLS MOVED WITH THE NUMBER, 2026-08-16. Under `whole` the constant was
// the MINIMUM over the text sizes, so Text S set it and both constant groups
// lived at S in the 430s. Under the premise it is the MAXIMUM (MR-142/MR-143),
// so Text XL sets it at 465 and group 3 derives there; group 2 stays at Text S
// because S is now where the constant's other edge shows — the heights just
// above it that work for everyone. A corpus anchored to a moved number is the
// same defect this branch was opened to fix.
// ─────────────────────────────────────────────────────────────────────────────
// THIS CORPUS EXITS 1, AND FIVE OF ITS PLANTS CANNOT BE CAUGHT HERE BY
// CONSTRUCTION. Read this before "fixing" them. (Bjorn, 2026-08-21, #299.)
//
// `--selftest` exited 1 before this pass and exits 1 after it. What changed is
// that its redness is now EXPLAINED instead of silent, which is the whole of
// what this pass could honestly deliver.
//
//   · 4 plants were DRIFTED — their find-strings died when #27 gave the gate an
//     `enabled` term. Re-aimed; all four now CAUGHT by their own named reds.
//   · 1 plant is new (the band contract, below) and is CAUGHT.
//   · 5 plants target the REFUSAL THRESHOLD and are UNCATCHABLE BY THIS TOOL.
//
// WHY, MEASURED — NOT ARGUED. `shortWideMinH` is not merely compared against
// the board; it DECIDES the composition the board renders, so the wall moves
// with it and every value is self-consistent. Same door, same width (800),
// same text size (XL):
//
//     shortWideMinH: 340 (as shipped)  ->  wall h 330..339  ->  max(wall)+1 = 340  PASS
//     shortWideMinH: 335 (planted)     ->  wall h 325..334  ->  max(wall)+1 = 335  PASS
//
// Lower it and the heights just under it stop being refused and start rendering
// the compact composition, so the wall shrinks to meet the new number. Raise it
// and those heights lose the compact composition, genuinely break, and the
// refusal is justified by the very change under test. THE CONSTANT MANUFACTURES
// ITS OWN PREMISE IN BOTH DIRECTIONS.
//
// This is NOT Charter 2b. 2b says a threshold with no cell adjacent to it cannot
// tell you it is wrong, and answers with sample density. Here density is no help
// whatever: there is no value of this constant that this derivation reports as
// wrong, so `--ladder`'s agreement is not evidence about the number. A check
// that cannot fail is decoration, and these five plants are what proves it.
//
// WHERE THE SOUND PREMISE LIVES. `balance.js` says this number is "the compact
// wide composition's rendered lower edge … derived at one-pixel resolution by
// tools/short-landscape-support.mjs before this value is consulted, so moving
// the number without moving the rendered premise goes red." A derivation that
// FORCES the compact composition and finds where its required controls stop
// being whole would not be self-referential. Whether that tool actually does
// this is UNMEASURED BY ME and outside my claimed path (#299) — routed as a
// card, deliberately not chased inside this diff.
//
// DISPOSITION IS A REVIEWER'S CALL, NOT THE MAKER'S. By our own rule a plant
// that provably cannot fail is decoration and should go; deleting five checks
// on the strength of my own measurement is exactly the act a maker does not
// clear for himself. They stay, labelled, until someone else rules.
// ─────────────────────────────────────────────────────────────────────────────
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
        // RE-AIMED 2026-08-21 (Bjorn). #27 gave the gate a settings term, so
        // the early return reads `if (!short || enabled === false)` and this
        // plant's find-string stopped existing. It had been a hard RED —
        // PLANT SITE DRIFTED — from that merge until now, which is doorplant
        // doing exactly its job: a corpus that silently stops running is the
        // defect. The plant's SUBJECT is unchanged (no gate at all); only its
        // aim moved.
        find: '  if (!short || enabled === false) {',
        replace: '  short = false;\n  if (!short || enabled === false) {',
        expectRed: /WALL: .end-turn lies at/,
      },
      {
        // CLAUSE K's PLANT, and it is the one that matters: a gate that stands
        // everywhere is the refusal that outlived its premise. Green on W and G,
        // red only because something checks that the refusal STOPS.
        name: 'the gate stands on every shape — a refusal with a dead premise',
        file: 'src/main.js',
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
        replace: '  updateUprightGate({ short: true, offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
        expectRed: /GATE STANDS WHERE NOTHING WALLS/,
      },
      {
        // THE ADVICE PLANT. The wording is a claim about a screen the code has
        // not seen; force it to the wrong one and the tool must catch the lie by
        // going and looking at the turned viewport.
        name: 'the advice stops being derived — it always says "turn your phone"',
        file: 'src/main.js',
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
        replace: '  updateUprightGate({ short, offerRotate: true, enabled: settings.uprightGate !== false });',
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
        find: '  updateUprightGate({ short, offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
        replace: '  updateUprightGate({ short: short && !!document.querySelector(\'.combat\'), offerRotate: !turned.short && coarse, enabled: settings.uprightGate !== false });',
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
        // RE-AIMED 2026-08-21 (Bjorn, AshenSpire#299) — AT THE CONSTANT THAT
        // ACTUALLY REFUSES. This plant moved `gateBelowH` and expected a
        // refusal; since #27 that constant is the compact band's upper edge, so
        // raising it moves shapes from wide into COMPACT and refuses nobody.
        // The plant still applied, still ran, and tested a causal path the code
        // no longer has — a stale PREMISE, not a stale string, which is why it
        // reported a silent green instead of announcing itself the way the four
        // drifted plants did. `shortWideMinH` is the edge with a wall under it
        // (measured: at 800 wide, Text XL, the wall runs h 330..339 and
        // max(wall)+1 = 340 = the written constant, exactly).
        //
        // IT MOVES BOTH HOMES, ON PURPOSE. The band-contract check added in this
        // same pass fires whenever the constants and the documented table
        // disagree — so a plant that moved only the constant tripped THAT red
        // instead of this one and came back RED-FOR-WRONG-REASON. That was a
        // defect I introduced, caught within the hour by the label I had just
        // added, which is the whole argument for the label. A developer creeping
        // this threshold moves both copies; the known-bad worth planting is the
        // number being WRONG in both homes, not merely inconsistent between them.
        name: 'the threshold creeps up and refuses a working window (the branch\'s own first bug)',
        edits: [
          { file: 'src/content/balance.js', find: '      shortWideMinH: 340,', replace: '      shortWideMinH: 395,' },
          { file: 'src/content/balance.js', find: '//   340 <= h < 465           compact wide composition (when width fits)', replace: '//   395 <= h < 465           compact wide composition (when width fits)' },
          { file: 'src/content/balance.js', find: '//   h < 340                  truthful upright/resize refusal', replace: '//   h < 395                  truthful upright/resize refusal' },
        ],
        expectRed: /GATE STANDS WHERE NOTHING WALLS/,
      },
      {
        // THE ONE `gateBelowH` PLANT THAT SURVIVES, RE-PURPOSED TO WHAT THAT
        // CONSTANT ACTUALLY DECIDES. It picks between two WORKING compositions,
        // so no rendered premise can contradict it and no refusal appears —
        // but it is written TWICE (constants + the documented band table in the
        // same file), and the copies must agree. This plant moves one copy.
        name: 'the band edge moves in the constants and not in its own documentation',
        file: 'src/content/balance.js',
        find: '      gateBelowH: 465,',
        replace: '      gateBelowH: 520,',
        expectRed: /THE BAND CONTRACT DISAGREES WITH ITS OWN DOCUMENTATION/,
      },
    ],
  });

  // GROUP 2 — THE BRANCH'S OWN SECOND BUG, AT THE CELL THAT CAN SEE IT.
  //
  // The plant above moves the threshold 55 px and any ladder catches it. This one
  // moves it THREE, which is the size the real defect was, and a three-pixel
  // creep is invisible to every cell that is not standing on the boundary: while
  // the constant was 432 and the ladder had a cell at 430 and a cell at 440 and
  // nothing between, `gateBelowH: 435` printed PASS 14/14 through every run this
  // branch made while it refused three working screens. The cell and the text
  // size are BOTH part of the catch, and BOTH MOVED WITH THE NUMBER on 2026-08-16:
  // 800x466 at Text S is the new boundary cell, three above the new constant 465.
  //
  // TEXT S IS STILL THE RIGHT TEXT SIZE AND THE REASON INVERTED. It used to be
  // the size that SET the constant (the minimum whole-fit). It is now the size
  // that can SEE ITS UPPER EDGE: at S the board is whole from h 432, so 466 is a
  // screen that works for everybody and walls nobody, and a constant that creeps
  // to 468 takes it away. At Text M/L/XL the same cell is not whole and clause K
  // never trips, so the plant would report NOT CAUGHT for want of a shape.
  rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    // `--only` SELECTS FROM THE DECLARED SHAPE LIST; IT DOES NOT INVENT A CELL.
    // My first re-anchor named `800x342`, which is not a rung in `LADDER_H`, so
    // the run matched no shape and exited 2 — and the corpus reported it as a
    // failure DISTINCT from a blind check, because `RED-FOR-WRONG-REASON` and
    // `UNCAUGHT` are now different words. Under the old single label this would
    // have read as "the tool is blind to a three-pixel creep" and I would have
    // gone looking for the wrong defect. `844x340` IS declared — it is the
    // compact composition's lower-edge cell, whole at Text XL by the rendered
    // premise balance.js cites for that number.
    args: ['--text', 'XL', '--only', '844x340'],
    timeoutMs: 900000,
    plants: [
      {
        // RE-ANCHORED 2026-08-21 (Bjorn, AshenSpire#299): same three-pixel
        // creep, moved onto the constant that refuses and a cell that can see
        // it. The cell and the text size are BOTH part of the catch and both
        // moved with the number — measured, not assumed: at Text XL the wall
        // runs to h 339 and 340 is the first whole cell, so 844x340 is a screen
        // that works and a constant creeping to 343 takes it away. Both homes
        // move, for the reason the group-1 plant above records.
        name: 'the threshold creeps three pixels above the last wall (the branch\'s own SECOND bug, re-anchored at Text XL)',
        edits: [
          { file: 'src/content/balance.js', find: '      shortWideMinH: 340,', replace: '      shortWideMinH: 343,' },
          { file: 'src/content/balance.js', find: '//   340 <= h < 465           compact wide composition (when width fits)', replace: '//   343 <= h < 465           compact wide composition (when width fits)' },
          { file: 'src/content/balance.js', find: '//   h < 340                  truthful upright/resize refusal', replace: '//   h < 343                  truthful upright/resize refusal' },
        ],
        expectRed: /GATE STANDS WHERE NOTHING WALLS/,
      },
    ],
  }) || rc;

  // GROUP 3 — THE DERIVATION, BOTH DIRECTIONS.
  //
  // `--ladder` is what makes the number re-derivable instead of remembered, and
  // an unfalsifiable derivation is a comment with a browser attached. Both edges
  // of the equality it asserts get a plant: five too LOW (a wall left with no
  // gate — WHICH IS WHAT 432 ACTUALLY WAS at Text XL, so this plant is the real
  // defect put back) and ten too HIGH (a refusal that has outgrown its premise).
  //
  // AT TEXT XL, 455..480, BECAUSE THAT IS WHERE THE NUMBER IS DECIDED NOW. The
  // constant is max(wall h)+1 over the four text sizes and XL is the maximum, so
  // XL alone re-derives 465 and the clean run comes back green on a partial set.
  // The window is deliberately narrow — 26 cells — and it contains the ONE-PIXEL
  // WALL AT 464 that sets the whole number (Vira, 2026-08-15). A sweep that
  // stepped over 464 would derive 451 and pass itself off as a measurement; this
  // group is the guard on exactly that, and the tool prints the range it walked.
  //
  // A NARROW SWEEP IS SOUND FOR THIS DERIVATION AND WAS NOT FOR THE OLD ONE. The
  // maximum needs only the TOP of the wall set: a cell below it cannot raise it,
  // so the floor of the sweep is free. The ceiling is not free, and it is
  // asserted — a sweep whose top cell is still a wall has not found the edge.
  rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    // SWEEP RE-AIMED 2026-08-21 (Bjorn, AshenSpire#299) with the constant it
    // checks. The window is still deliberately narrow and still contains the
    // one-pixel edge that sets the whole number — measured on this tree at
    // 800 wide, Text XL: the wall runs h 330..339, 340 is the first whole
    // cell, max(wall)+1 = 340 = `shortWideMinH` as written. The old window
    // (455..480) is the compact band's upper edge, where nothing walls at all,
    // which is why both plants below used to fail for the WRONG REASON rather
    // than going green: the sweep found no wall to reason about.
    args: ['--ladder', '--ladder-text', 'XL', '--ladder-from', '330', '--ladder-to', '352'],
    timeoutMs: 900000,
    plants: [
      {
        name: '--ladder: the constant sits below the last wall (what 432 was — a wall with no gate)',
        file: 'src/content/balance.js',
        find: '      shortWideMinH: 340,',
        replace: '      shortWideMinH: 335,',
        expectRed: /THE CONSTANT LEAVES A WALL UNGATED/,
      },
      {
        name: '--ladder: the constant refuses above the last wall (a refusal that outgrew its premise)',
        file: 'src/content/balance.js',
        find: '      shortWideMinH: 340,',
        replace: '      shortWideMinH: 348,',
        expectRed: /THE CONSTANT REFUSES ABOVE ITS OWN PREMISE/,
      },
    ],
  }) || rc;

  // GROUP 4 — THE PREDICATE AGAINST THE PREMISE (`--predicates`, Vira).
  //
  // A FOURTH GROUP FOR THE SAME REASON THERE WERE THREE: a corpus is a
  // population too, and this plant does not live where the others do. It is run
  // at TEXT M over h 385..400, and both halves of that cell are load-bearing:
  //   · at Text M the wall's top edge is h 394, so the clean run has TEN REAL
  //     WALL CELLS to rule on and comes back GREEN because every one of them is
  //     gated. A group whose clean run had no wall in it would report this plant
  //     CAUGHT for want of a referent, which is the empty-query defect wearing a
  //     corpus (SOP 2's ⚙ clause).
  //   · it is NOT run at Text XL, and that is the whole reason the group exists
  //     as its own cell. At XL the tree is ALREADY RED here — the wall runs to
  //     h 450 against a constant of 432 — and doorplant requires the clean run to
  //     come back green. Running this plant at XL would prove nothing about the
  //     check and would fail the harness for a defect that is Marina's card.
  //
  // The plant drops the constant BELOW the wall's top edge, which is the exact
  // shape of a refusal that stopped covering its own premise: the gate keeps
  // standing, keeps looking like a gate, and the wall walks out from under it.
  rc = await doorSelftest({
    tool: 'uprightgate.mjs',
    // WINDOW RE-AIMED 2026-08-21 (Bjorn, AshenSpire#299), and this group's own
    // reasoning above is what demanded it: the plant needs REAL WALL CELLS in
    // the clean run or it is reported caught for want of a referent. The old
    // window (385..400 at Text M) sits entirely ABOVE the wall — measured on
    // this tree, Text M walls h 315..339 and 340 is the first whole cell — so
    // the clean run ruled on no wall at all. Both halves stay load-bearing, at
    // heights the board actually has: 320..352 straddles the edge, with walled
    // cells below it and whole cells above.
    args: ['--predicates', '--predicate-text', 'M', '--predicate-from', '320', '--predicate-to', '352'],
    timeoutMs: 900000,
    plants: [
      {
        name: '--predicates: the constant drops below the wall\'s top edge — a wall the gate does not stand on',
        file: 'src/content/balance.js',
        find: '      shortWideMinH: 340,',
        replace: '      shortWideMinH: 335,',
        expectRed: /A WALL WITH NO GATE/,
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
// 460..470 is the band the constant lives in, so it is walked at 1 px. Outside
// that band the ladder stays coarse on purpose: those cells prove the gate keeps
// standing well below and keeps quiet well above, and neither claim needs
// resolution. If `gateBelowH` ever moves out of 460..470, THIS BAND MOVES WITH
// IT — the band is anchored to the constant, and a band left behind by a moved
// constant is exactly the defect above (Marina, 2026-08-15: when you move
// anything, ask what was anchored to its old position).
//
// AND IT MOVED, 2026-08-16, FOR EXACTLY THAT REASON. The band was 430..440 while
// the constant was 432. MR-142 changed the predicate the refusal answers to (the
// WALL, not `whole`) and MR-143 changed the derivation (`max(wall h)+1`, not
// `min(good h)`), so the constant went 432 -> 465 — and I moved the band the
// same hour, because the whole reason the old defect survived was a band left
// three pixels behind its own number. 464 IS INSIDE THIS BAND ON PURPOSE: it is
// the one-pixel Text XL wall that sits 14 px above the top of the interval
// everyone was counting (Vira, 2026-08-15), and it is the cell that sets the
// constant.
//
// AND THE BAND IS ONLY DIAGNOSTIC AT THE TEXT SIZE THAT CAN SEE THE NUMBER —
// WHICH IS NOW THE OTHER END OF THE DIAL. Under `whole` the constant was the
// MINIMUM over the text sizes, so Text S set it. Under the premise it is the
// MAXIMUM, so Text XL sets it (S 368, M 395, L 424, XL 465 — `--ladder`), and
// Text S is where its COST is visible instead: at S every one of these rungs is
// a screen that works and is refused anyway. Both readings matter and they are
// different runs. `--selftest` group 2 runs the band at S for the cost edge and
// group 3 derives at XL for the number, rather than trusting anyone to remember.
const LADDER_H = [410, 430, 450, 460, 461, 462, 463, 464, 465, 466, 467, 468, 469, 470, 480, 500];
const SHAPES = [
  [390, 844], [360, 640], [834, 1194],   // portrait: must never gate
  [844, 390], [844, 344],                // supported landscape and browser-chrome band
  [844, 340], [844, 339],                // compact lower edge and refusal one pixel below
  [915, 412],                            // second landscape phone control
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
// ⚠ THIS LIST WAS ONE `?shot=` LONG AND WE READ ITS GREEN AS WIDE.
//
// `grep "q: '?shot=" tools/uprightgate.mjs` returned exactly ONE match — combat
// — for as long as this file has existed. Then a confirm panel landed off the
// bottom of the Smith at y≈991 in an 844 px viewport, on a screen NO anchor gate
// we own had ever opened, and every gate in the tree stayed green through it
// (measured by Sten, re-measured here on `b30e624`).
//
// The green was HONEST AND NARROW; the reading was wide. That is this house's own
// rule broken on this house's own instrument, and the fix is a surface, not a
// sentence: a `?shot=` per screen where a run can be stranded by a control it
// cannot reach.
//
// `drive` IS WHY THE REST SCREEN COULD NOT BE ADDED BEFORE. Its dangerous control
// does not exist at mount: the Smith grid opens on a tap and the confirm panel
// only exists once a card is armed. A surface whose subject is two taps deep
// needs a way to take those taps, and `read()` now runs `drive` after `ready`
// and before it measures. Nothing here POSITIONS anything — Bjorn's rule holds,
// and it is why the drive clicks the controls a player clicks instead of calling
// scrollIntoView on the panel.
const SURFACES = [
  { name: 'combat', q: '?shot=combat', ready: `!!document.querySelector('.end-turn')`, required: '.end-turn', whole: WHOLE_SET },
  {
    // THE SMITH'S CONFIRM PANEL. `required` is the ACCEPT button, because losing
    // it is what strands the player: the upgrade cannot be taken and — the half
    // that makes it a wall rather than a nuisance — CANCEL is beside it and just
    // as gone, so the panel cannot be dismissed either. `?shot=rest` poses floor
    // 8 with twenty cards, which is the shape the grid actually reaches.
    name: 'rest-smith',
    q: '?shot=rest',
    ready: `!!document.querySelector('#smith-opt')`,
    drive: `(() => {
      const smith = document.querySelector('#smith-opt');
      if (!smith) return 'no smith panel';
      smith.click();
      const card = document.querySelector('#smith-grid .card');
      if (!card) return 'no candidate card in the grid';
      card.click();
      return document.querySelector('.beat-confirm .beat-yes') ? 'ok' : 'no confirm panel armed';
    })()`,
    required: '.beat-confirm .beat-yes',
    whole: ['.beat-confirm .beat-yes', '.beat-confirm .beat-no'],
  },
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
  // ONE MEASUREMENT FUNCTION, USED FOR BOTH SETS — it was written for the
  // REQUIRED control alone and the wake set got a bare percentage off a second,
  // shorter copy of the same arithmetic. Same probe, same frame, second half
  // discarded: that is how --ladder could read wholeCount for a whole branch
  // and never once read a reach word (Vira, 2026-08-15; MR-144). A cut control
  // now says WHICH KIND of cut it is, because "67.3% of the hand" and "67.3% of
  // the hand with no gesture to the rest" are two different screens for the
  // player and were one number for the tool.
  const measure=(el)=>{
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
    return { present:true, top:n(r.top), bottom:n(r.bottom), left:n(r.left), right:n(r.right),
             inside, scroller, clipper, onScreenPct: r.width*r.height>0 ? n(100*overlap/(r.width*r.height)) : 0,
             reach: inside ? 'onscreen' : (scroller ? 'scrollable' : (overlap > 0 ? 'clipped' : 'unreachable')) };
  };
  let ctl=null;
  const sel=${JSON.stringify(required)};
  if (sel) {
    const el=document.querySelector(sel);
    ctl = el ? measure(el) : { present:false };
  }
  // THE WAKE SET: which of the required controls are WHOLE on screen. An absent
  // one counts as NOT whole — a control that is not in the DOM is not a control
  // the player can use, and treating absence as "fine" is how a wake clause goes
  // quiet (this file's own subject, one level up).
  const cut=[]; let wholeCount=0; const reach={}, boxes={};
  for (const s of ${JSON.stringify(wholeSet || [])}) {
    const e=document.querySelector(s);
    if(!e){ cut.push(s+':absent'); reach[s]='absent'; continue; }
    const m=measure(e);
    reach[s]=m.reach;
    boxes[s]={ top:m.top, bottom:m.bottom, left:m.left, right:m.right, pct:m.onScreenPct, scroller:m.scroller?m.scroller.el:null };
    if (m.onScreenPct>=99.9) wholeCount++; else cut.push(s+':'+m.onScreenPct+'%:'+m.reach);
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
  return { vw, vh, zoom, layout, localH:n(vh/zoom), ctl, gate, cut, wholeCount, reach, boxes,
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
// ===========================================================================
// WHAT THIS DERIVES, AND IT CHANGED ON 2026-08-16 — TWICE, FOR TWO REASONS
// ===========================================================================
//
// IT USED TO READ `wholeCount` AND NEVER `ctl.reach`. Same probe, same frame,
// second half discarded (MR-144, Vira). So it derived the constant from ALL
// FIVE REQUIRED CONTROLS WHOLE — a QUALITY question, *is this screen good* —
// while the gate exists for a WALL: END TURN not one pixel on glass and no
// gesture to it, a SAFETY question, *can this player continue*.
//
// MARINA RULED THE PREDICATE (MR-142): THE REFUSAL ANSWERS TO THE WALL. Three
// reasons and the third decides it alone — the gate's cost is total, so it
// fires on a total condition; a refusal removes the player's choice while a
// degraded screen leaves it; and `whole` CAN BE SATISFIED BY THE VERY
// INTERACTION THAT STRANDS THE PLAYER (one flask gesture takes 844x390 from
// 2/5 + UNREACHABLE to 5/5 + onscreen — Vira, re-observed). A refusal predicate
// the trap itself satisfies is not conservative, it is the wrong question.
//
// AND THE DERIVATION ITSELF WAS UNSOUND, WHICH IS MINE (MR-143). It took
// `min(good h)` — the FIRST height that works. THE WALL SET IS NOT AN INTERVAL:
// at Text XL the ungated cells are h 432..450 AND 464, with 451..463 not walled
// at all (the auto-zoom steps 0.63 -> 0.64 and the board grows faster than the
// window; END TURN 13.37% at 460, 0% AT 464, 19.76% at 470). "The first h that
// stops being bad" is a monotonic idea and this ground is not monotonic — I
// MEASURED THE NON-MONOTONICITY MYSELF (97.13% at h 485, 94.4% at 486), used it
// to justify sweeping exhaustively, and then derived with `min(good)` anyway.
// THE SOUND DERIVATION IS `max(bad h) + 1`: one past the LAST wall, never the
// first non-wall. It is the only form that survives a hole.
//
//   THE DERIVATION, IN ONE LINE:  gateBelowH = max over the enumerated text
//   sizes of ( last h where `.end-turn` is UNREACHABLE ) + 1.
//
// MAXIMUM, NOT MINIMUM, AND THE DIRECTION FLIPPED WITH THE PREDICATE. Under
// `whole` the binding constraint was "refuse no working screen", so the
// constant was the SMALLEST of the four. Under the premise the binding
// constraint is COVERAGE — a wall the gate does not stand on is a player who
// cannot finish their turn — so it is the LARGEST. One number cannot do both
// jobs at once and this one now does the safety job, which is the ruling.
//
// BOTH EDGES ARE REAL DEFECTS AND BOTH ARE ASSERTED:
//   · a constant AT OR BELOW the last wall leaves a WALL WITH NO GATE — the
//     premise holds and the refusal is absent. That is what 432 was at Text XL.
//   · a constant ABOVE max(wall)+1 refuses heights where the player can reach
//     END TURN — a refusal that has outgrown its premise, which is clause K's
//     defect at the source.
//
// THE COST OF ONE NUMBER IS PRINTED, NOT HIDDEN. A single downward-closed
// threshold over a wall set that differs by text size (and is not even an
// interval) necessarily refuses heights that wall nobody. This mode counts them
// and names the worst of them, per text size, so the price is a number in the
// output rather than a sentence in a comment. It is my cost and I own it
// (MR-142's division: Marina rules what the mechanism is for; I derive the
// number and own the consequences).
//
// EXHAUSTIVE, 1 PX, NO BISECTION, AND NOW OVER THE WHOLE RANGE. Phase B used to
// bracket at 8 px above the constant and close at 1 px — that is exactly the
// hole-shaped assumption above, wearing a cheaper coat, and it is DELETED. Every
// cell from `--ladder-from` to `--ladder-to` is read. The floor of the sweep does
// not affect the derivation (a cell below the maximum cannot raise it); it
// decides only how much of the refused span the COST table can see. The ceiling
// does affect it, so the ceiling is asserted: a sweep whose top cell is still a
// wall has not found the top edge, and that is a finding, not a pass.
//
// THE `whole` COLUMN IS STILL REPORTED — AND NOW IT IS CHECKED THE SAME WAY.
// MR-143's third half: whether 432/495/533/571 were `min(whole)` or
// `max(not-whole)+1` was UNMEASURED, and inheriting a number from a monotonic
// assumption is the same defect at a new address. Both are computed and printed
// side by side, and a disagreement is named with the holes listed.
//
// DOOR. Every measurement comes through the same door as the rest of this file —
// the rendered app in a real browser, read off the frame it painted. The one
// thing not read through the browser is the NUMBER BEING CHECKED: `gateBelowH`
// is read by importing src/content/balance.js in Node. Same bytes, different
// loader, and it is named here rather than left to be found. Whether the shipped
// bundle carries those same bytes is tools/verify-shipped.mjs's subject.
async function runLadder(read) {
  const { balance } = await import(pathToFileURL(resolve(ROOT, 'src/content/balance.js')).href);
  // THE CONSTANT UNDER TEST IS THE REFUSAL THRESHOLD, AND SINCE #27 THAT IS
  // `shortWideMinH` — NOT `gateBelowH` (Bjorn, 2026-08-21, AshenSpire#299).
  //
  // This derivation compares a RENDERED wall edge to a written number, so it is
  // only sound if the written number is the one that decides refusals.
  // `main.js:376` computes `short = h < gateBelowH && !compact`, and `compact`
  // holds for any shape at or above `shortWideMinH` whose width still fits, so
  // the band contract balance.js states in its own words is:
  //
  //     h >= gateBelowH            standard wide composition
  //     shortWideMinH <= h < gateBelowH   compact wide composition
  //     h < shortWideMinH          the refusal
  //
  // `gateBelowH` is therefore the COMPACT BAND'S UPPER EDGE — a choice between
  // two working compositions, with no rendered premise to derive it against —
  // while `shortWideMinH` is the edge with a wall under it. Sweeping the wall
  // and comparing it to `gateBelowH` compared a measurement to an unrelated
  // number: it is why this mode's two corpus plants failed for the WRONG
  // REASON rather than going green, which is doorplant's new
  // RED-FOR-WRONG-REASON class and was invisible while every non-catch shared
  // one word.
  const constant = balance?.ui?.uiScale?.shortWideMinH;
  const bandTop = balance?.ui?.uiScale?.gateBelowH;
  if (constant == null) {
    console.error(`uprightgate --ladder: balance.ui.uiScale.shortWideMinH is absent. There is no refusal constant to check, and absent is not a pass.`);
    return 2;
  }
  const from = +(argOf('--ladder-from') ?? 390);
  const to = +(argOf('--ladder-to') ?? 600);
  const widths = (argOf('--ladder-width') ?? '800').split(',').map((s) => +s.trim());
  const texts = (argOf('--ladder-text') ?? Object.keys(TEXT).join(',')).split(',').map((s) => s.trim());
  for (const t of texts) if (!TEXT[t]) { console.error(`uprightgate --ladder: --ladder-text ${t} is not one of ${Object.keys(TEXT).join('/')}`); return 2; }
  if (!(from < to)) { console.error(`uprightgate --ladder: --ladder-from ${from} is not below --ladder-to ${to}; the sweep would measure nothing.`); return 2; }

  const surface = SURFACES[0];
  const isWhole = (r) => r.wholeTotal > 0 && r.wholeCount === r.wholeTotal;
  const isWall = (r) => !!(r.ctl && r.ctl.present) && r.ctl.reach === 'unreachable';
  // Contiguity is the whole point of this mode now, so heights are printed as
  // runs: `432..450, 464` says in one line what a list of 20 numbers hides.
  const ranges = (list) => {
    if (!list.length) return '(none)';
    const out = []; let a = list[0], b = list[0];
    for (const v of list.slice(1)) { if (v === b + 1) { b = v; continue; } out.push(a === b ? `${a}` : `${a}..${b}`); a = b = v; }
    out.push(a === b ? `${a}` : `${a}..${b}`);
    return out.join(', ');
  };
  const line = (w, h, t, r) => `    ${w}x${h} ${t.padEnd(2)} zoom=${r.zoom} `
    + `.end-turn ${(r.ctl && r.ctl.present ? r.ctl.reach : 'ABSENT').padEnd(11)} `
    + `${String(r.ctl && r.ctl.present ? r.ctl.onScreenPct : 0).padStart(6)}% `
    + `whole ${r.wholeCount}/${r.wholeTotal}${r.cut.length ? ` cut[${r.cut.join(' ')}]` : ''}`;

  console.log(`\n  --ladder — deriving shortWideMinH from the board, at width(s) ${widths.join(',')}, text ${texts.join(',')}`);
  console.log(`  THE PREDICATE IS THE WALL (MR-142): \`.end-turn\` UNREACHABLE — not one pixel on screen,`);
  console.log(`  no scroll path. THE DERIVATION IS max(wall h) + 1 (MR-143), never min(good h): the`);
  console.log(`  wall set is not an interval, and "the first h that stops being bad" cannot survive a hole.`);
  console.log(`  shortWideMinH as written in src/content/balance.js: ${constant}   (the REFUSAL threshold — h below it is refused)`);
  console.log(`  gateBelowH, for context only, NOT the subject of this derivation: ${bandTop} — the compact band's upper`);
  console.log(`  edge, a choice between two WORKING compositions with no wall under it. It was this mode's subject`);
  console.log(`  until 2026-08-21 and could not be derived from a board, because nothing renders differently at it.`);
  console.log(`\n  THE SWEEP — exhaustive 1 px over ${from}..${to}, every cell read, no bisection.`);
  if (constant > to) console.log(`  NOTE: shortWideMinH ${constant} is ABOVE the sweep's ceiling ${to}, so the COST table below sees only part of the refused span. The derivation is unaffected — it needs the wall's top edge, which is inside.`);
  if (constant < from) console.log(`  NOTE: shortWideMinH ${constant} is BELOW the sweep's floor ${from}, so the COST table below is empty by construction, not by measurement.`);

  const bad = [];
  const table = [];
  let cells = 0;
  for (const w of widths) {
    for (const t of texts) {
      const seen = new Map();                    // h -> probe result
      const walls = [], notWhole = [], absent = [];
      for (let h = from; h <= to; h++) {
        const r = await read(w, h, surface, false, t);
        cells++; seen.set(h, r);
        if (!r.ctl || !r.ctl.present) { absent.push(h); continue; }
        if (isWall(r)) walls.push(h);
        if (!isWhole(r)) notWhole.push(h);
      }
      const lastWall = walls.length ? walls[walls.length - 1] : null;
      const firstWhole = [...seen.keys()].find((h) => isWhole(seen.get(h))) ?? null;
      const lastNotWhole = notWhole.length ? notWhole[notWhole.length - 1] : null;
      // The interesting cells, printed: the ends of the sweep, every wall run's
      // edges, the two derivations' cells, the constant's neighbourhood, and a
      // coarse spine so a reader can see the ground between them.
      const marks = new Set([from, to, constant - 1, constant, constant + 1]);
      for (const h of [lastWall, lastWall === null ? null : lastWall + 1, firstWhole, lastNotWhole, lastNotWhole === null ? null : lastNotWhole + 1]) if (h != null) marks.add(h);
      for (const h of walls) { if (!walls.includes(h - 1) || !walls.includes(h + 1)) marks.add(h); }
      for (let h = from; h <= to; h++) if (h % 20 === 0) marks.add(h);
      for (const h of [...marks].sort((a, b) => a - b)) {
        if (!seen.has(h)) continue;
        const r = seen.get(h);
        console.log(line(w, h, t, r) + (isWall(r) ? '   <-- WALL' : ''));
      }

      // --- unknown is never green, three ways --------------------------------
      if (absent.length) {
        bad.push(`\`.end-turn\` IS NOT IN THE DOM at width ${w} text ${t}, h ${ranges(absent)} — the required control is UNKNOWN there, and unknown is not a pass`);
      }
      if (lastWall === to) {
        bad.push(`THE SWEEP'S TOP CELL IS STILL A WALL — width ${w} text ${t}, h ${to}. The wall's top edge is ABOVE this sweep, `
          + `so max(wall h) is UNKNOWN, not ${to}. Widen --ladder-to. A derivation whose maximum sits on the edge of its own range is a guess.`);
      }
      const premise = lastWall === null ? null : lastWall + 1;
      if (lastWall === null) {
        console.log(`    -> width ${w} text ${t}: NO WALL anywhere in ${from}..${to}. This text size has nothing to derive from — `
          + `reported, because an empty result and a clean result look identical and mean the opposite.`);
      } else {
        console.log(`    -> width ${w} text ${t}: WALL at ${walls.length} cell(s), h ${ranges(walls)}`);
        console.log(`       last wall h = ${lastWall}  ->  max(wall)+1 = ${premise}`
          + `${walls.length && walls[0] + walls.length - 1 !== lastWall ? '   (NOT AN INTERVAL — a hole inside the wall set)' : ''}`);
      }
      // --- MR-143's third half: the same question, asked of `whole` ----------
      const wholeMax = lastNotWhole === null ? null : lastNotWhole + 1;
      const agree = firstWhole !== null && wholeMax !== null && firstWhole === wholeMax;
      const holes = notWhole.filter((h) => firstWhole !== null && h > firstWhole);
      console.log(firstWhole === null
        ? `       whole: NOTHING is whole anywhere in ${from}..${to} — both min(whole) and max(not-whole)+1 are UNKNOWN here, not ${to + 1}`
        : `       whole: first whole h = ${firstWhole}, max(not-whole)+1 = ${wholeMax}`
          + `${agree ? '  — THEY AGREE (the whole set is contiguous above its first cell)'
            : `  — THEY DISAGREE: the whole set has ${holes.length} hole cell(s) at h ${ranges(holes)}, so min(whole) was unsound here too`}`);
      table.push({ w, t, walls, lastWall, premise, firstWhole, wholeMax, agree, holes, seen });
    }
  }

  // --- THE DERIVATION -------------------------------------------------------
  console.log(`\n  THE SET THE CONSTANT IS THE MAXIMUM OF (MR-143: max(wall h) + 1, per text size)`);
  const known = [];
  for (const row of table) {
    console.log(`    width ${row.w}  text ${row.t.padEnd(2)}  last wall h = ${String(row.lastWall ?? 'none').padStart(4)}  ->  max(wall)+1 = ${row.premise ?? 'nothing to derive'}`);
    if (row.premise !== null) known.push(row.premise);
  }
  if (!known.length) {
    bad.push(`NO WALL ANYWHERE IN ${from}..${to} AT ANY TEXT SIZE MEASURED. The gate's PREMISE has no referent in this sweep, `
      + `so the constant cannot be derived and is UNKNOWN — never a pass. Either the sweep is in the wrong place, or the board now `
      + `fits every height here and THE REFUSAL HAS OUTLIVED ITS PREMISE: delete src/ui/components/upright.js (this file's removal condition).`);
  } else {
    const trueValue = Math.max(...known);
    console.log(`\n    maximum over the set = ${trueValue}; gateBelowH = ${constant}`);
    if (constant <= trueValue - 1) {
      const ungated = table.map((row) => {
        const over = row.walls.filter((h) => h >= constant);
        return over.length ? `${row.t}: h ${ranges(over)} (${over.length} cell(s))` : null;
      }).filter(Boolean);
      bad.push(`THE CONSTANT LEAVES A WALL UNGATED — \`.end-turn\` is UNREACHABLE as high as h ${trueValue - 1} and gateBelowH is ${constant}, `
        + `so the gate stops standing while its own premise is still true. WALLED CELLS AT OR ABOVE THE CONSTANT — `
        + `${ungated.join(' · ') || '(none — widen the sweep)'}. `
        + `The true value is ${trueValue}. A player at one of those heights cannot end their turn and is not told why.`);
    } else if (constant > trueValue) {
      bad.push(`THE CONSTANT REFUSES ABOVE ITS OWN PREMISE — nothing is a wall at or above h ${trueValue} at any text size measured, `
        + `and gateBelowH is ${constant}. Heights ${trueValue}..${constant - 1} are refused and the player can reach END TURN in every `
        + `one of them. Either the board improved and the number was left behind, or the number was never derived. Re-derive it: ${trueValue}.`);
    }
  }

  // --- THE COST OF ONE NUMBER, COUNTED -------------------------------------
  //
  // This is not a defect and it is not free. A single downward-closed threshold
  // over four text sizes whose wall sets differ by ~100 px — and one of which
  // has a hole in it — must refuse heights that wall nobody. Under `whole` the
  // cost fell on large-text players (walls left uncovered); under the premise it
  // falls on small-text players (working heights refused). It is printed per
  // text size, with the worst cell named, because a cost nobody counts is a cost
  // somebody discovers.
  console.log(`\n  THE COST OF ONE NUMBER — heights below shortWideMinH ${constant} that are NOT a wall (the player`);
  console.log(`  could reach END TURN there and is refused anyway). Reported, never asserted: it is the`);
  console.log(`  price of a single downward-closed threshold, and the ruling bought it deliberately.`);
  const noWallAnywhere = [];
  for (let h = Math.max(from, 0); h < Math.min(constant, to + 1); h++) {
    if (table.every((row) => row.seen.has(h) && !isWall(row.seen.get(h)))) noWallAnywhere.push(h);
  }
  for (const row of table) {
    const refusedFine = [], refusedWhole = [];
    for (let h = Math.max(from, 0); h < Math.min(constant, to + 1); h++) {
      const r = row.seen.get(h); if (!r) continue;
      if (!isWall(r)) { refusedFine.push(h); if (isWhole(r)) refusedWhole.push(h); }
    }
    const worst = refusedFine.length ? row.seen.get(refusedFine[refusedFine.length - 1]) : null;
    console.log(`    width ${row.w} text ${row.t.padEnd(2)}: ${refusedFine.length} refused non-wall height(s) [${ranges(refusedFine)}]`
      + `, of which ${refusedWhole.length} are FULLY WHOLE [${ranges(refusedWhole)}]`);
    if (worst) console.log(`      top refused non-wall cell h ${refusedFine[refusedFine.length - 1]}: whole ${worst.wholeCount}/${worst.wholeTotal}`
      + `${worst.cut.length ? ` cut[${worst.cut.join(' ')}]` : ''}`);
  }
  console.log(`    REFUSED AND NOBODY WALLS at any text size measured: ${ranges(noWallAnywhere)}`);
  console.log(`      — these are the gap cells. They exist because the wall set has a hole in it and a`);
  console.log(`        threshold cannot: covering the top of the wall covers everything under it.`);

  console.log(`\n  BOUNDARY — what this derivation does NOT cover, named rather than left to be found:
  (a) WIDTH IS NOT SWEPT BY DEFAULT. The constant is a HEIGHT and the fit is not
      purely one, so this ran at ${widths.join(',')}. Measured 2026-08-15 (Sunna) at Text S
      under the OLD predicate: 432 at widths 600/800/844/1200/1440 — it SATURATES
      — and later at narrower ones (444 at 400 and 360, 453 at 300, where the
      narrow layout takes over). THAT WAS A \`whole\` MEASUREMENT AND IT DOES NOT
      TRANSFER: the wall's width behaviour is re-derived with --ladder-width, and
      the NARROW layout is a different composition with its own wall (at Text XL,
      360x640 is walled — a portrait phone, far above any height threshold, and
      no height can gate it without refusing every phone. That is layout work.)
  (b) UI SIZE. Every cell here is Auto fit. A player on a fixed UI-size setting
      is a different board, and mobilefit is the tool that sweeps that axis.
  (c) ONE SURFACE. ?shot=combat, because that is where the required control is
      named. A screen that fits combat and not the map is not this number's.
  (d) ONE BOX, headless Chromium, device-metric emulation, and EVERY CELL IS
      READ AS A WINDOW — no touch emulation, the same call the 800x… rungs make
      in the main run. A touchscreen of the same dimensions is a device cell and
      differs in the gate's WORDING, not in whether END TURN is reachable.
  (e) BOOT STATE ONLY, AND THIS IS THE SHARPEST ONE. Every cell is the board as
      it paints, before any interaction. One flask gesture at 844x390 scrolls
      \`.combat\` 162.9 px programmatically and takes END TURN from UNREACHABLE to
      onscreen while carrying the topbar off the top with no gesture back (Vira,
      2026-08-15, re-observing Bjorn). SO A WALL IS A PROPERTY OF THE SHAPE AND A
      SCROLL STATE. This mode derives from the state the player arrives in, which
      is the state the refusal has to decide in. Nothing here measures after an
      interaction, and that silence is a boundary, not a safety.
  (f) THE CLIPPED BAND IS NOT LEGISLATED. \`unreachable\` is the word the premise
      uses; a control 70% on screen with no scroll path is not a wall and is not
      fine either. Widening the refusal to cover it would hide a layout bug
      behind a wall — see THE COST above for what it actually costs a player.`);

  console.log(`\n  ${bad.length ? `FAIL — ${bad.length} finding(s) over ${cells} cell(s)` : `PASS — ${cells} cell(s): shortWideMinH ${constant} is exactly max(wall h)+1 over the measured set — every wall is covered and nothing above the last wall is refused`}`);
  for (const b of bad) console.log(`    - ${b}`);
  return bad.length ? 1 : 0;
}

// ---------------------------------------------------------------------------
// `--predicates` — THE GATE'S PREDICATE AGAINST THE GATE'S PREMISE.
//
// Vira, 2026-08-15, on Marina's question (packet e431613): Sunna's constant is
// derived from ALL FIVE REQUIRED CONTROLS WHOLE; this gate was built for a WALL
// — END TURN unreachable by any gesture. MARINA COULD NOT SETTLE FROM A SUMMARY
// WHETHER THOSE TWO NAME THE SAME SET OF SCREENS, and stopped rather than rule.
// They are different predicates and the whole argument turns on it, so it is a
// measurement and not an opinion. This mode is the measurement.
//
// WHY IT IS HERE AND NOT IN A NEW FILE. Both predicates are already this file's:
// clause W owns the wall, clause K owns the five. The question "are W's set and
// K's set the same set" is a question about THIS TOOL'S OWN TWO CLAUSES, and a
// second file would have meant a second copy of the door — the same browser
// boot, the same probe, the same serve — to ask about the instrument that
// already has one. It reuses read() and probe() untouched. IT CHANGES NOTHING
// ABOUT THE DEFAULT RUN OR `--ladder`: Sunna's derivation and its assertions are
// not forked, not restated and not touched.
//
// WHAT IT ASSERTS, AND IT IS ONE RELATION, NOT A NUMBER (the falsifier that
// fails for the right reason):
//
//   P1 — EVERY WALL IS GATED. At every cell where `.end-turn` is UNREACHABLE,
//        the gate must be STANDING. Not "h < gateBelowH" — that would be this
//        tool keeping a second copy of main.js's decision and then checking its
//        own copy. THE GATE IS READ OFF THE PAINTED FRAME, so what is checked is
//        the refusal the player actually meets.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT, because the house already owns it:
//   · that no working screen is refused — `--ladder` derives exactly that and is
//     its home (single-home rule); this mode reports the band and rules nothing.
//   · that a gate standing on a 5/5 shape is wrong — clause K, above.
//   · the CLIPPED band. Sunna refused to legislate inside it and she is right:
//     a threshold drawn inside a band nobody measured is fitted by whoever ran
//     the tool last. Widening a refusal to cover a layout defect hides a bug
//     behind a wall.
//
// EXHAUSTIVE, 1 PX, NO BISECTION — Sunna's rule and the reason for it hold here
// unchanged: the fit is NOT monotonic in height (97.13% at h 485, 94.4% at 486,
// the auto-zoom stepping 0.66 -> 0.67), and a boundary search that assumes
// monotonicity is a guess wearing a measurement's clothes. `wallTop` is
// therefore the LARGEST h in the sweep that is a wall, not the first h that
// stops being one — so a wall that reappears above a gap is caught rather than
// stepped over.
//
// UNKNOWN IS NEVER GREEN, TWICE OVER:
//   · a sweep whose TOP CELL IS STILL A WALL has not found the wall's top edge.
//     That is a finding, not a pass — widen --predicate-to.
//   · a text size with NO WALL ANYWHERE in the sweep is REPORTED AS HAVING HAD
//     NOTHING TO RULE ON (SOP 2's ⚙ clause: prove the query had a referent). An
//     empty result and a clean result look identical and mean the opposite.
//
// DOOR: the same one as the rest of this file — the rendered app in a real
// browser at emulated device metrics, read off the frame it painted, nothing
// scrolled or positioned by the probe. The known-bad enters as file bytes in
// `src/content/balance.js` in a copied real tree and the whole tool re-runs from
// that copy (`--selftest`, group 4).
//
// ---------------------------------------------------------------------------
// THE ANSWER, MEASURED. Width 800, ?shot=combat, wide layout, Auto fit, read as
// a window, 1 px exhaustive 360..480 (484 cells) and again 480..600 (484 cells),
// at e5cb619 + this mode, headless Chromium:
//
//   text   last WALL h   .end-turn whole from   all 5 whole from   they part over
//   S      367           390                    432                368..431  (64 px)
//   M      394           420                    495                395..494 (100 px)
//   L      423           451                    533                424..532 (109 px)
//   XL     464           510                    571                465..570 (106 px)
//
//   (the `all 5 whole` column is --ladder's, re-derived here at the same ref and
//   identical: 432/495/533/571, minimum 432, PASS. No wall anywhere in 480..600
//   at any text size, so `last WALL h` is a found edge and not a sweep artefact.)
//
// THEY DO NOT COINCIDE, AT ANY TEXT SIZE, AND THE GAP IS 64 TO 109 PX. Between
// the two columns the screen is NOT a wall and NOT whole: END TURN is on the
// glass, a thumb ends the turn, and the hand is cut. "All five whole" is a
// STRICT SUBSET of "not a wall" — necessarily, since `.end-turn` is one of the
// five — so an argument that holds for one does not transfer to the other.
// Which predicate the refusal should answer to is a ruling and is not here.
//
// THE WALL AT TEXT XL IS NOT AN INTERVAL, AND THIS IS THE PART NOTHING ELSE
// COULD HAVE FOUND. Ungated wall cells at XL: h 432..450 AND h 464 — with
// 451..463 not walled at all. At 464 the auto-zoom steps 0.63 -> 0.64 and the
// board grows faster than the window, so END TURN goes 13.37% on screen at 460,
// to 0% at 464, back to 19.76% at 470. Three runs, identical. IT IS ONE PIXEL
// TALL AND IT SITS 14 PX ABOVE THE TOP OF THE BAND EVERYONE HAS BEEN COUNTING.
// Sunna's rule — a bisection would be a guess in a measurement's clothes — was
// written about the FIT and it has now paid out on the WALL; and note that even
// her exhaustive 1 px ladder could not have found this, because `--ladder` reads
// `wholeCount` and never once reads `ctl.reach`. Same probe, same call, the
// second half discarded.
//
// OBSERVED RED — every one on this tree at e5cb619, command first:
//   node tools/uprightgate.mjs --predicates
//     -> exit 1, "A WALL WITH NO GATE — text XL, width 800, h 432..464
//        (20 cell(s) of 92)". THE REAL DEFECT, unplanted, and it is Marina's
//        card with its coordinates corrected in both directions: the card says
//        433–450; the measurement says 432..450 AND 464.
//   node tools/uprightgate.mjs --predicates --predicate-text M \
//        --predicate-from 385 --predicate-to 392
//     -> exit 1, "THE SWEEP'S TOP CELL IS STILL A WALL". The unknown-is-not-
//        green clause, watched firing. Its known-bad is a too-narrow sweep, which
//        is a usage defect and not a tree defect, so it has no file-bytes plant
//        and is observed directly instead of pretended into the corpus.
//   node tools/uprightgate.mjs --selftest   (group 4)
//     -> exit 1 on the plant, "A WALL WITH NO GATE — text M, width 800,
//        h 385..394 (10 cell(s) of 10)", and green on the clean copy.
async function runPredicates(read) {
  const surface = SURFACES[0];
  const from = +(argOf('--predicate-from') ?? 360);
  const to = +(argOf('--predicate-to') ?? 480);
  const width = +(argOf('--predicate-width') ?? 800);
  const texts = (argOf('--predicate-text') ?? Object.keys(TEXT).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  for (const t of texts) if (!TEXT[t]) { console.error(`uprightgate --predicates: --predicate-text ${t} is not one of ${Object.keys(TEXT).join('/')}`); return 2; }
  if (!(from < to)) { console.error(`uprightgate --predicates: --predicate-from ${from} is not below --predicate-to ${to}; the sweep would measure nothing.`); return 2; }

  console.log(`\n  --predicates — the gate's PREDICATE (all ${WHOLE_SET.length} required controls whole) against its`);
  console.log(`  PREMISE (\`.end-turn\` unreachable — a wall). Width ${width}, text ${texts.join(',')},`);
  console.log(`  heights ${from}..${to} EXHAUSTIVELY at 1 px (no bisection — the fit is not monotonic).`);
  console.log(`  The gate is read off the painted frame, never computed from gateBelowH.`);

  const bad = [];
  const table = [];
  let cells = 0;
  for (const t of texts) {
    let wallTop = null, firstAll = null, firstEndWhole = null, walls = 0, gatedWalls = 0;
    const ungated = [];
    let topCellIsWall = false;
    for (let h = from; h <= to; h++) {
      const r = await read(width, h, surface, false, t);
      cells++;
      if (!r.ctl || !r.ctl.present) {
        bad.push(`${width}x${h} text ${t}: \`.end-turn\` is not in the DOM on ?shot=combat — the required control is UNKNOWN, and unknown is not a pass`);
        continue;
      }
      const wall = r.ctl.reach === 'unreachable';
      const standing = !!r.gate;
      const whole = r.wholeTotal > 0 && r.wholeCount === r.wholeTotal;
      if (wall) {
        walls++; wallTop = h; if (h === to) topCellIsWall = true;
        if (standing) gatedWalls++; else ungated.push(h);
      }
      if (firstEndWhole === null && r.ctl.onScreenPct >= 99.9) firstEndWhole = h;
      if (firstAll === null && whole) firstAll = h;
      const notable = (wall && !standing) || h === from || h === to || h === firstAll || h === firstEndWhole || h % 20 === 0;
      if (notable) {
        console.log(`    ${width}x${h} ${t.padEnd(2)} zoom=${r.zoom} .end-turn ${r.ctl.reach.padEnd(11)} ${String(r.ctl.onScreenPct).padStart(6)}% `
          + `whole ${r.wholeCount}/${r.wholeTotal} gate=${standing ? `STANDING(${r.gate.advice})` : 'absent'}`
          + `${wall && !standing ? '   <-- WALL, NO GATE' : ''}`);
      }
    }
    table.push({ t, wallTop, firstAll, firstEndWhole, walls, gatedWalls, ungated });

    // --- P1, the asserted relation -----------------------------------------
    if (walls === 0) {
      console.log(`    -> text ${t}: NO WALL anywhere in ${from}..${to}. This clause had nothing to rule on here — `
        + `reported, because an empty result and a clean result look identical and mean the opposite.`);
    } else {
      if (ungated.length) {
        bad.push(`A WALL WITH NO GATE — text ${t}, width ${width}, h ${ungated[0]}..${ungated[ungated.length - 1]} `
          + `(${ungated.length} cell(s) of ${walls}): \`.end-turn\` is UNREACHABLE — not one pixel on screen and no scroll path — `
          + `and the gate is ABSENT. The gate's PREMISE holds at these heights and the gate does not stand. `
          + `Heights: ${ungated.join(',')}`);
      }
      if (topCellIsWall) {
        bad.push(`THE SWEEP'S TOP CELL IS STILL A WALL — text ${t}, width ${width}, h ${to}. The wall's top edge is `
          + `ABOVE this sweep, so \`wallTop\` is UNKNOWN, not ${to}. Widen --predicate-to. Unknown is not a pass.`);
      }
      console.log(`    -> text ${t}: wall at ${walls} cell(s), top wall h = ${wallTop}, gated ${gatedWalls}/${walls}.`);
    }
  }

  // --- P2, the two sets, side by side — REPORTED --------------------------
  console.log(`\n  THE TWO PREDICATES, SIDE BY SIDE (width ${width})`);
  console.log(`    text   last WALL h   .end-turn whole from   all ${WHOLE_SET.length} whole from   they part over`);
  let parted = 0, coincided = 0;
  for (const row of table) {
    const wallEnd = row.wallTop === null ? '(none)' : String(row.wallTop);
    const endW = row.firstEndWhole === null ? `>${to}` : String(row.firstEndWhole);
    const allW = row.firstAll === null ? `>${to}` : String(row.firstAll);
    // The divergence: heights that are NOT a wall (the premise is false — the
    // player can reach END TURN) and NOT whole (the predicate is false).
    const lo = row.wallTop === null ? from : row.wallTop + 1;
    const hi = row.firstAll === null ? null : row.firstAll - 1;
    const span = hi === null ? `${lo}..>${to} (at least ${to - lo + 1} px)` : (hi < lo ? 'nothing — they coincide here' : `${lo}..${hi} (${hi - lo + 1} px)`);
    if (hi !== null && hi < lo) coincided++; else parted++;
    console.log(`    ${row.t.padEnd(4)}   ${wallEnd.padEnd(11)}   ${endW.padEnd(20)}   ${allW.padEnd(18)}   ${span}`);
  }
  console.log(`\n  VERDICT ON THE PREDICATE QUESTION: ${parted === 0
    ? `THEY COINCIDE over every text size measured — every screen that is not a wall is whole, so "whole" and "not a wall" name the same set here and either may be reasoned from.`
    : `THEY PART at ${parted} of ${table.length} text size(s) measured. Between the two boundaries the screen is NOT A WALL — END TURN is on the glass and a thumb reaches it — and NOT WHOLE. "All five whole" is the STRICTLY NARROWER set: it is a subset of "not a wall" by construction, because \`.end-turn\` is one of the five. An argument that holds for one does not transfer to the other, and the direction matters: a threshold derived from WHOLE refuses MORE screens than the premise justifies at small text, and FEWER walls than the premise demands at large text.`}`);

  console.log(`\n  BOUNDARY — what this mode does NOT cover, named rather than left to be found:
  (a) ONE WIDTH (${width}) and one surface (?shot=combat). The wall is a rect and
      the rect moves with width; Sunna's --ladder boundary (a) is the width note
      and is not restated here.
  (b) EVERY CELL IS READ AS A WINDOW, no touch emulation — the same call --ladder
      makes. Touch changes the gate's WORDING, not whether the board fits.
  (c) THE CLIPPED BAND IS REPORTED AND NOT LEGISLATED. A control 70% on screen
      with no scroll path is not a wall and is not fine either. This mode counts
      only \`unreachable\`, which is the word the premise uses.
  (d) IT IS SILENT ON WHETHER 'not a wall' IS THE RIGHT PREDICATE TO SHIP. It
      measures that the two sets differ and where. Which one the refusal should
      answer to is a ruling, and rulings are not numbers.
  (e) IT DOES NOT TAP, AND THAT IS THIS MODE'S SHARPEST LIMIT — every cell above
      is the board at boot. Bjorn's flask finding, RE-OBSERVED by Vira at e5cb619
      rather than inherited (SOP 2's drift clause), 844x390 Text M, one real
      pointer gesture dispatched at the flask:
        before  .end-turn top 394.95..419.33, 0% on screen, UNREACHABLE,
                whole 2/5, \`.combat\` scrollTop 0, scrollH 758, clientH 629,
                overflow-y hidden, topbar top 0, gate STANDING
        after   .end-turn top 293.95..318.33, 100% on screen, ONSCREEN,
                WHOLE 5/5, \`.combat\` scrollTop 162.9, scrollH 792,
                topbar top -101, scroller STILL null
      Text S, same shape: 3/5 -> 5/5, scrollTop 0 -> 103.23, topbar to -64.
      SO "WHOLE" IS NOT A PROPERTY OF THE SHAPE. It is a property of the shape
      AND a scroll state, and the only motion that puts END TURN on the glass is
      the one that carries the topbar and its menu off it with no gesture back.
      THE CONSEQUENCE IS CLAUSE K'S, NOT THIS MODE'S: clause K's predicate is
      \`wholeCount === wholeTotal\`, so it reads 5/5 on 844x390 — the shape this
      gate was built for — in a state a player can enter and not leave. Nothing
      today measures after an interaction, so nothing fires; that is the reason
      it is silent, and it is not a reason it is safe. Filed, not fixed:
      widening clause K is Sunna's call on Sunna's clause.
      ANSWERED 2026-08-16 (Sunna), and not by widening the set. Clause K still
      TRIPS on \`wholeCount === wholeTotal\` — it is free and it never misses a
      dead premise — but A TRIP IS NO LONGER A VERDICT: the verdict re-reads the
      shape at all four text sizes and asks whether ANYTHING WALLS there. So a
      5/5 reading on 844x390, however it was arrived at, can no longer call that
      shape working on its own; the wall at Text M/L/XL answers first. The
      post-interaction state is still unmeasured and still a boundary — what
      changed is that it is no longer the thing deciding.`);

  console.log(`\n  ${bad.length ? `FAIL — ${bad.length} finding(s) over ${cells} cell(s)` : `PASS — ${cells} cell(s): every wall is gated, and the wall's top edge was found inside the sweep at every text size`}`);
  for (const b of bad) console.log(`    - ${b}`);
  return bad.length ? 1 : 0;
}

async function main() {
  if (!browserPath) { console.error('uprightgate: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  if (!TEXT[textKey]) { console.error(`uprightgate: --text ${textKey} is not one of ${Object.keys(TEXT).join('/')}`); process.exit(2); }
  printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
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

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'uprightgate-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
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
    // A SURFACE WHOSE SUBJECT IS TWO TAPS DEEP TAKES THE TAPS — after the text
    // size is applied, so the drive lays the panel out at the size being
    // measured. It NEVER positions the target; it clicks what a player clicks.
    // A drive that cannot reach its own subject is `unknown`, and unknown is not
    // a pass: it fails loudly here rather than measuring an absent element.
    if (surface.drive) {
      const drove = await ev(surface.drive);
      if (drove !== 'ok') {
        throw new Error(`uprightgate: ${surface.name} drive failed at ${w}x${h} (${drove}) — NOTHING WAS MEASURED`);
      }
      await wait(120);
    }
    // The auto-zoom re-flexes on a 150ms debounce and re-applies at +300ms from
    // boot; 800 clears both, and the gate is written by the same call.
    await wait(800);
    return ev(probe(surface.required, surface.whole));
  }

  if (args.includes('--ladder')) {
    const code = await runLadder(read);
    cdp.close(); await dropBrowser(); if (server) server.close();
    process.exit(code);
  }

  if (args.includes('--predicates')) {
    const code = await runPredicates(read);
    cdp.close(); await dropBrowser(); if (server) server.close();
    process.exit(code);
  }

  const fails = []; let cells = 0;
  // CLAUSE K IS RESOLVED AFTER THE LOOP, NOT INSIDE IT (MR-142). See the block
  // below THE SHAPES: whether a standing gate is justified is a question about
  // the OTHER text sizes and about the heights ABOVE this one, and neither is
  // known while this shape is being read.
  const pendingK = [];
  const wallAt = [];                       // { h, texts } — every wall this run saw
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
    // WHERE the cut is, not just how much of it. A control 67% on screen with
    // its BOTTOM third gone is a card whose text you cannot read; the same 67%
    // with a scroller is a swipe. The percentage cannot tell those apart and a
    // player lives in the difference, so the rect is printed next to it.
    for (const sel of Object.keys(combat.boxes || {})) {
      const b = combat.boxes[sel];
      if (b.pct >= 99.9) continue;
      console.log(`      (cut) ${sel.padEnd(14)} ${b.pct}% on screen, ${combat.reach[sel]}, rect top ${b.top} bottom ${b.bottom} left ${b.left} right ${b.right} in ${w}x${h}`
        + `${b.scroller ? ` — scroller ${b.scroller}` : ' — NO scroll path to the rest'}`);
    }

    const bad = [];

    // --- clause R: EVERY declared required control, on EVERY fitting shape ---
    //
    // ⚠ WHY THIS CLAUSE EXISTS, AND IT IS A SHARPER FINDING THAN THE ONE THAT
    // SENT ME HERE. The brief said this file held ONE `?shot=` and read its
    // green as wide. True — and not the whole defect. Three lines above,
    // clause W reads `rows.find(([s]) => s.name === 'combat')`: **THE SURFACE IS
    // HARDCODED IN THE CLAUSE.** This list could have held ten surfaces and
    // every one of them would have been measured, printed, and gated on
    // nothing. Adding a surface would have LOOKED like widening the gate.
    //
    // So clause R is a LOOP over `SURFACES`, not a second hardcoded name, and it
    // is ADDITIVE: clause W keeps combat's verdict and its wall/K bookkeeping
    // untouched, because 24 shapes' verdicts hang off it and flipping those
    // while chasing a panel would be two changes wearing one commit.
    //
    // WHAT IT GATES: a required control that is `unreachable` on a shape the
    // game does NOT refuse. On a shape the upright gate is standing over, the
    // player is being told to rotate and nothing behind the notice is a wall —
    // that is clause W's whole argument and it applies here unchanged.
    for (const [surface, r] of rows) {
      if (!surface.required || surface.name === 'combat') continue;
      if (r.gate) continue;                      // the game already refuses this shape
      if (!r.ctl || !r.ctl.present) {
        bad.push(`clause R: ${surface.required} is not in the DOM on ${surface.q || 'the title screen'} — UNKNOWN, and unknown is not a pass`);
        continue;
      }
      if (r.ctl.reach === 'unreachable') {
        const c = r.ctl.clipper;
        bad.push(`clause R: ${surface.name} — ${surface.required} is UNREACHABLE at ${shape}: `
          + `top ${r.ctl.top}..${r.ctl.bottom} in a ${h} px viewport, ${r.ctl.onScreenPct}% on screen, no scroll path`
          + (c ? ` (nearest clipper ${c.el}, overflow-y ${c.overflowY}, scrollHeight ${c.scrollH} > clientHeight ${c.clientH})` : '')
          + ` — and the shape is NOT refused, so the player is stranded on it`);
      }
      // The partner control is reported, never gated: CANCEL going with ACCEPT
      // is what turns a nuisance into a trap, and saying so is worth a line.
      for (const sel of Object.keys(r.boxes || {})) {
        const b = r.boxes[sel];
        if (b.pct >= 99.9) continue;
        console.log(`      (cut) ${surface.name}: ${sel.padEnd(24)} ${b.pct}% on screen, ${r.reach[sel]}, rect top ${b.top} bottom ${b.bottom} in ${shape}`
          + `${b.scroller ? ` — scroller ${b.scroller}` : ' — NO scroll path to the rest'}`);
      }
    }

    // --- clause W: the wall must be gated ------------------------------------
    if (!combat.ctl || !combat.ctl.present) {
      bad.push(`.end-turn is not in the DOM on ?shot=combat — the required control is UNKNOWN, and unknown is not a pass`);
    } else if (walled) {
      wallAt.push({ h, texts: [textKey] });
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

    // --- clause K, the WAKE — TRIPPED HERE, JUDGED BELOW ----------------------
    //
    // IT USED TO FIRE RIGHT HERE AND THAT IS NO LONGER SOUND (MR-142). "All five
    // whole at the text size this run happens to be in" is not the premise the
    // gate answers to; the premise is the WALL, and the wall arrives at a
    // different height for every text size. A gate standing on a screen that is
    // perfect at Text S can be the refusal a Text XL player needs at that exact
    // height — so this is a QUESTION now, not a finding, and the question is
    // answered after every shape has been read.
    if (intact && rows.some(([, r]) => !!r.gate)) {
      pendingK.push({ shape, w, h, device, cut: combat.cut, surfaces: rows.filter(([, r]) => r.gate).map(([s]) => s.name) });
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

  // -------------------------------------------------------------------------
  // CLAUSE K RESOLVED — THE WAKE ANSWERS TO THE WALL (MR-142)
  //
  // A standing gate on a shape that is whole at THIS run's text size is one of
  // three things, and only the third is a defect:
  //   1. THE PREMISE, AT ANOTHER PLAYER'S TEXT SIZE. Text XL walls ~100 px higher
  //      than Text S. The refusal is doing its job for someone this run is not.
  //      Each tripped shape is therefore re-read at all four text sizes — cheap,
  //      because only shapes that would have been findings are re-read at all.
  //   2. THE PRICE OF ONE NUMBER. `gateBelowH` is a single downward-closed
  //      threshold and the wall set is neither single nor contiguous (Text XL
  //      walls at 432..450 AND 464 — Vira, 2026-08-15). Covering the top of the
  //      wall covers every height beneath it, including heights that wall
  //      nobody. That is counted in `--ladder`'s COST table and it is not a
  //      finding here; it is the consequence of the ruling, which is mine to own.
  //   3. THE REFUSAL OUTLIVING ITS PREMISE — the gate stands where nothing walls
  //      at any text size AND nothing at or above this height walls either. That
  //      is the wake red, and it is the only one of the three that is a finding.
  //      The day a landscape composition ships, every tripped shape lands here.
  if (pendingK.length) {
    console.log(`\n  CLAUSE K — THE WAKE, RESOLVED AGAINST THE PREMISE (MR-142: the gate answers to the wall).`);
    console.log(`  ${pendingK.length} shape(s) are whole at Text ${textKey} with the gate standing. Re-reading each at all`);
    console.log(`  four text sizes, because the wall arrives ~100 px higher at XL than at S:`);
    for (const p of pendingK) {
      p.wallTexts = [];
      for (const t of Object.keys(TEXT)) {
        const r = await read(p.w, p.h, SURFACES[0], p.device, t);
        if (r.ctl && r.ctl.present && r.ctl.reach === 'unreachable') p.wallTexts.push(t);
      }
      if (p.wallTexts.length) wallAt.push({ h: p.h, texts: p.wallTexts });
      console.log(`    ${p.shape}  gate on ${p.surfaces.join('+')}  walls at text: ${p.wallTexts.join('/') || 'NONE of S/M/L/XL'}`);
    }
    const top = wallAt.length ? wallAt.reduce((a, b) => (b.h > a.h ? b : a)) : null;
    for (const p of pendingK) {
      if (p.wallTexts.length) {
        console.log(`      (justified) ${p.shape}: Text ${p.wallTexts.join('/')} has .end-turn UNREACHABLE at this exact height. `
          + `The refusal is the premise's — at a text size this run is not in.`);
        continue;
      }
      if (top && top.h >= p.h) {
        console.log(`      (cost) ${p.shape}: nothing walls here at any text size, and it is refused anyway because h ${top.h} `
          + `DOES wall (Text ${top.texts.join('/')}) and a single threshold is downward-closed — covering the top of the wall `
          + `covers everything under it. Counted in --ladder's COST table. The price of one number, not a defect of this one.`);
        continue;
      }
      for (const s of p.surfaces) {
        const f = `${p.shape}: GATE STANDS WHERE NOTHING WALLS — ${s}, all ${WHOLE_SET.length} required controls whole `
          + `(${WHOLE_SET.join(', ')}), NO text size of S/M/L/XL puts .end-turn out of reach at this shape, and no cell measured `
          + `in this run walls at any height at or above ${p.h}. THIS IS THE REFUSAL OUTLIVING ITS PREMISE: re-derive with `
          + `\`--ladder\` and lower balance.ui.uiScale.shortWideMinH, or delete src/ui/components/upright.js. Do not leave it `
          + `refusing a screen nobody is walled on.`;
        fails.push(f);
        console.log(`      <-- ${f}`);
      }
    }
  }

  if (cells === 0) {
    console.error(`\nuprightgate: nothing was measured${only ? ` (--only ${only} matched no shape)` : ''}. That is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map(([w, h]) => `${w}x${h}`).join(', ')}`);
    cdp.close(); await dropBrowser(); if (server) server.close(); process.exit(2);
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
  (c) SURFACES BEYOND THE DECLARED LIST. Clause W still reads combat and only
      combat; clause R covers every OTHER surface that declares a required
      control, and today that is the Smith's confirm panel. A screen with no
      entry in that list is still unmeasured, and the list is the honest
      statement of coverage: combat, rest-smith, title. The map at 844x390 is a maze rather than a
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

  // ---- THE BAND CONTRACT, AND ITS SECOND COPY -----------------------------
  //
  // `gateBelowH` is the compact band's UPPER edge — a choice between two
  // WORKING compositions, so unlike `shortWideMinH` it has no wall under it and
  // nothing rendered to derive it against. That is exactly why the old corpus
  // could not catch a plant on it: there was no premise for the plant to
  // contradict.
  //
  // What it does have is a SECOND COPY. balance.js states the whole band table
  // in prose, in its own comment, three lines with the numbers written out —
  // and until now nothing checked that the prose and the constants agree. One
  // fact, two homes, nothing comparing them: Law 1 clause 2, and the defect
  // this seat exists to find.
  //
  // SAY WHICH KIND OF CHECK THIS IS: it proves the two copies AGREE, never that
  // the surviving number is RIGHT. The rendered premise belongs to
  // `shortWideMinH` and is `--ladder`'s subject. A consistency check sold as a
  // correctness check is how a green stops meaning anything.
  const bandDoc = await (async () => {
    const src = readFileSync(resolve(ROOT, 'src/content/balance.js'), 'utf8');
    const { balance } = await import(pathToFileURL(resolve(ROOT, 'src/content/balance.js')).href + `?band=${Date.now()}`);
    const z = balance?.ui?.uiScale || {};
    const wide = /^\s*\/\/\s*h\s*>=\s*(\d+)\s/m.exec(src);
    const band = /^\s*\/\/\s*(\d+)\s*<=\s*h\s*<\s*(\d+)\s/m.exec(src);
    const refuse = /^\s*\/\/\s*h\s*<\s*(\d+)\s/m.exec(src);
    if (!wide || !band || !refuse) {
      return `THE BAND TABLE IS UNREADABLE in src/content/balance.js — the three documented lines (\`h >= N\`, \`N <= h < N\`, \`h < N\`) did not parse. `
        + `The table is the only second copy of these constants; if it moved or was reworded, this check has stopped checking and must be re-aimed, not deleted.`;
    }
    const docWide = +wide[1], docLo = +band[1], docHi = +band[2], docRefuse = +refuse[1];
    const bad = [];
    if (docWide !== z.gateBelowH || docHi !== z.gateBelowH) bad.push(`documented wide edge ${docWide}/${docHi} vs balance.ui.uiScale.gateBelowH ${z.gateBelowH}`);
    if (docLo !== z.shortWideMinH || docRefuse !== z.shortWideMinH) bad.push(`documented compact floor ${docLo}/${docRefuse} vs balance.ui.uiScale.shortWideMinH ${z.shortWideMinH}`);
    if (!bad.length) return null;
    return `THE BAND CONTRACT DISAGREES WITH ITS OWN DOCUMENTATION — ${bad.join('; ')}. `
      + `balance.js writes the band table twice: once as constants the game reads, once as prose a person reads. A number that moves in one home and not the other `
      + `ships a game whose documentation describes a different game. Move both, in the same act.`;
  })();
  if (bandDoc) { fails.push(bandDoc); console.log(`      <-- ${bandDoc}`); }
  else console.log(`\n  BAND CONTRACT: constants and the documented table agree (gateBelowH / shortWideMinH). CONSISTENCY ONLY — it proves the two copies match, never that either number is right; the rendered premise under shortWideMinH is \`--ladder\`'s.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} finding(s) over ${cells} shape(s)` : `PASS — ${cells}/${cells} shapes: every walled shape refuses legibly with true advice, and no fitting shape refuses at all`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); await dropBrowser(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`uprightgate: ${e.message}`); process.exit(2); });
