#!/usr/bin/env node
// tools/hintstrip.mjs — THE COMBAT ACTION ROW SITS UNDER THE CARDS, WHOLE, AND
// STAYS THERE WHEN A KEY LABEL GETS WIDER. The rendered check on the row that
// carries combat's controls and their key labels.
//
// ── THE SUBJECT MOVED, AND THIS GATE FOLLOWED IT (#527, 2026-09-02) ─────────
// The contextual hint strip this tool was written for is RETIRED on the combat
// screen: 82adffc6 (2026-08-30, the five-cell command rail) made
// `.hand-area > .hint-bar.hint-combat { display: none }` because the action row
// (`.combat-action-row`, UI.combatActionRail) carries its own direct controls
// and key labels — END TURN prints its binding as `<kbd class="et-key">`. The
// element is still in the DOM, hidden by that rule, on purpose. The gate kept
// asking for the strip and, the first time it ran hosted (run 297), reported an
// EMPTY population at every wide cell and two of its six plants patched CSS
// that no longer existed. Everything below now measures the ROW: the invariant
// is the same sentence — under every card, whole, on screen, touching no other
// combat furniture, surviving a wide rebound label — said of the element that
// ships. The retired strip is treated as furniture: if it ever renders again on
// combat, the row must not touch it, and that is measured rather than assumed.
//
// WHY IT EXISTS. His words, 2026-08-17, with a screenshot of the strip:
//   "this should be at the bottom under the cards, not over lapped by the cards.
//    perhaps shift the cards up a bit to make space for this tool tip."
//
// ⚠ HIS PREMISE WAS HALF WRONG AND THE MEASUREMENT IS KEPT HERE RATHER THAN
// SMOOTHED AWAY. Before the fix, at dev = db09846, over eight wide shapes
// (1200x730, 1200x600, 1366x768, 1440x900, 1920x1080, 1024x640, 900x560,
// 800x600) the strip touched **0 of 5 cards at every one** — and was **100% of
// its own area inside the TOPBAR at every one**, a bar the old CSS comment
// called "the 5.2rem topbar" and which measures 141 local px. What the pill
// really sat on was the POISE track. On both narrow shapes it was
// `display: none` and occluded nothing because it did not exist.
// So: the element he pointed at was right, the direction was right, and the
// occluder was not the one he named. Recorded because a check written to his
// sentence would assert a card overlap that never happened, and pass forever.
//
// AND THE DEFECT THE ASK UNCOVERED, which is the one that was costing a player
// ink: the hand's fan pushed its OUTER cards down by |i-mid| * 6 px, so the
// outermost card's box ended **5.65 local px BELOW .hand and below the viewport**
// — identical to two decimals on all eight wide shapes, so a constant and not
// one window's accident. The cards were clipped at the bottom of the screen
// before the strip ever moved.
//
// WHAT IT CHECKS, per shape, per text size (the "row" is `.combat-action-row`;
// the history below says "strip" where it records what was measured then):
//   H1 BELOW      every card's rendered box is entirely ABOVE the row's top.
//                 Stated as containment, not as a gap: a number the row could
//                 be nudged by is a number the next hand change re-tunes.
//   H2 CLEAR      the row touches NO other combat furniture — the topbar, the
//                 battlefield, and the retired hint strip should it ever render
//                 again. The count is ZERO, not a budget.
//   H3 WHOLE      no control is clipped and nothing overflows: every direct
//                 child of the row (orb, DRAW, END TURN, DISCARD, EXHAUSTED) is
//                 inside the row's box, END TURN's key label is inside END TURN,
//                 and the row's scrollWidth/Height do not exceed its client box.
//   H4 WIDER      H1-H3 again with a REBOUND WIDE LABEL on END TURN. The label
//                 is written through the game's own rebind door — localStorage
//                 keybinds, read by input.js keyLabel() — never by poking the
//                 DOM, so what is measured is a layout under a real binding.
//   H5 ONSCREEN   the row is inside the viewport on every axis, and its own
//                 height is REAL: a row that reserves nothing is how "at the
//                 bottom" becomes "over whatever is at the bottom".
//
// THE NARROW LAYOUT IS MEASURED NOW. The strip was `display: none` there
// (styles/ui.css, #29 slice 0 — keys for hardware a phone has not got) and every
// H-check was `unknown` on narrow by design. The row renders on narrow
// (`:root[data-layout='narrow'] .combat-action-row`, styles/combat.css), so the
// eight declared cells are all measured and nothing is `unknown` by design.
//
// AND THE CARD THAT WAS OWED IS PAID: AN `unknown` BLOCKS. verdict.mjs's rule
// for every other instrument — unknown is never a pass — is this tool's rule
// too: a cell that resolves to `unknown` (the column-overflow branch of H5, or a
// missing subject at a shape this tool did not declare exempt) exits 2. The
// pre-existing column debt that branch was built to refuse to score is
// measured at zero cells today (run 297 and locally), so nothing is painted
// red by this rule that is not a live off-screen control.
//
// THE POPULATION IS DECLARED AND A MISSED CELL IS RED, NOT SILENT. This is my
// own B3 hole from this morning, watched here on purpose: flaskbox printed a
// confident green over "3 expected, 2 reached". Every cell below is counted, the
// expected count is stated, and a shortfall is a finding with its own plant.
//
// THE DOOR: the SOURCE TREE over http in headless Chromium (tools/serve.mjs),
// every box divided back through --ui-zoom into LOCAL px ONCE before anything is
// compared (Law 2's one coordinate space). The text size is set through the
// game's own settings door, not by writing font-size. `--selftest` plants its
// known-bads as file bytes in a copied real tree (tools/doorplant.mjs) and runs
// this whole tool from the copy — same door as every number above.
//
// Sunna Falk, 2026-08-18.
//
// ── THE WAIVER, added 2026-08-21 by Bjorn (#295) ────────────────────────────
//   node tools/hintstrip.mjs
//   node tools/hintstrip.mjs --selftest
//   node tools/hintstrip.mjs --waive "H2 <cell>,H2 <cell>" --waive-card 295
//
// The third form lands this gate in REPORTING mode for findings that are already
// known and already carded, so a NEW gate can enter a list without a live defect
// blocking every other lane while its fix is designed. Everything is still
// measured and printed; only these exact findings stop failing the job.
//
// IT IS NOT `|| true`, AND THE DIFFERENCE IS ONE MACHINE-CHECKED SENTENCE:
// **a waiver fails when its defect disappears.** Waive something that is no
// longer there and this exits 1 telling you to delete the waiver. So the excuse
// cannot outlive the defect — which is precisely how `axisfit`'s "reported,
// never asserted" went quiet over a live bug (Law 5's enforcement note). The
// full reasoning, the four outcomes, and why this does not breach ci.yml's
// own "nothing here is to be relaxed" are at the waiver's code, near the bottom.
// Exit: 0 waived exactly · 1 a new finding OR a stale waiver · 2 unknown.

import { resolve, dirname, join } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The property name is READ OUT OF hand.js, never typed here — a rename there
// must not leave this asserting a property nobody writes. Same rule
// placement.mjs uses for --place-gap.
const FAN_LIFT_PROP = (() => {
  const src = readFileSync(join(ROOT, 'src/ui/components/hand.js'), 'utf8');
  const m = src.match(/FAN_LIFT_PROP\s*=\s*'([^']+)'/);
  if (!m) throw new Error('hintstrip: could not read FAN_LIFT_PROP out of src/ui/components/hand.js');
  return m[1];
})();

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // THE WAIVER THREADING IS GONE, AND SO IS THE REASON FOR IT. It used to
  // forward --waive into the corpus because doorplant finishes on an UNPLANTED
  // copy that must come back green, and the tree carried #295's two findings —
  // so without it the clean edge was red for the TREE's state rather than the
  // corpus's. #295's layout half has landed: the clean copy is green on its own
  // merits now, which is the stronger state and needs no excuse. Every plant is
  // still red by its own named finding.
  const SELFTEST = {
    tool: 'hintstrip.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // THE ROW GOES ON THE TOPBAR — the state he complained about for the
        // strip, said of the row. H1 is GREEN under this plant (the cards are
        // nowhere near the topbar), which is exactly why H1 alone is not enough.
        name: 'the row is pinned over the topbar',
        edits: [{
          file: 'styles/combat.css',
          find: '  position: absolute; inset-inline: 1.6rem; bottom: calc(-1 * var(--action-row-drop)); z-index: 30;',
          replace: '  position: fixed; inset-inline: 1.6rem; top: 0; bottom: auto; z-index: 30;',
        }],
        expectRed: /BAD\s+H2 /,
      },
      {
        // THE ROW RISES INTO THE HAND. `--action-row-drop` is the ONE home for
        // how far the row hangs BELOW the hand and for the band the column
        // reserves under it (styles/combat.css, #295) — the base rule's
        // `bottom` is re-declared later against the safe-area insets, so the
        // token, not the declaration, is where the plant points. A negative
        // drop lifts the row into the hand-area and the controls sit under the
        // fanned cards.
        name: 'the row rises into the hand-area and the cards lie on it',
        edits: [{
          file: 'styles/combat.css',
          find: '.combat { --action-row-drop: 6.4rem; }',
          replace: '.combat { --action-row-drop: -5rem; }',
        }],
        expectRed: /BAD\s+H1 /,
      },
      {
        // THE FAN GOES BACK TO PUSHING ITS OUTER CARDS DOWN. The exact
        // expression that shipped, restored — the outermost cards reach past
        // the hand and onto the row's band.
        // The magnitude is the plant's: the shipped 6 px step, hanging downward,
        // put 5.65 px of card onto the old full-width strip; against a row whose
        // controls sit under specific columns the outer cards must drop far
        // enough to reach the piles, so the step is 40 px — the same defect
        // class (the fan pushing cards down), sized to be seen.
        name: 'the fan hangs downward from its centre again and the outer cards reach the piles',
        edits: [{
          file: 'src/ui/components/hand.js',
          find: 'translateY(${(Math.abs(i - mid) - mid) * 6}px)',
          replace: 'translateY(${Math.abs(i - mid) * 40}px)',
        }],
        expectRed: /BAD\s+H1 /,
      },
      {
        // THE SILENT CLIP. END TURN is squeezed to a width its key label cannot
        // fit and told to hide the overflow, so a wide rebound label draws
        // outside its control without a mark. H3 catches it ONLY under the wide
        // label, which is why H4 is not a courtesy.
        name: 'END TURN clips its key label, so a wide rebound label disappears',
        edits: [{
          file: 'styles/combat.css',
          append: '.combat-action-row > .end-turn { width: 4rem; max-width: 4rem; justify-self: center; overflow: hidden; white-space: nowrap; }',
        }],
        expectRed: /BAD\s+H3 /,
      },
      {
        // THE LIFT STOPS BEING RESERVED. hand.js still lifts the fan; the
        // stylesheet forgets to make room. This is Law 0 clause 5 as a plant —
        // the fallback is 0px, so the defect is VISIBLE, and this proves the
        // check can see it rather than trusting the fallback.
        name: 'the stylesheets stop reserving the fan lift hand.js publishes',
        edits: [{
          file: 'styles/combat.css',
          find: 'padding-bottom: 1rem; padding-top: var(--fan-lift, 0px); }',
          replace: 'padding-bottom: 1rem; }',
        }],
        expectRed: /BAD\s+H6 /,
      },
      {
        // A CONTROL GOES QUIET. A stylesheet hides the DRAW pile; the row still
        // renders, four controls are still whole, and a gate that measured
        // "every rendered control" would stay green over a missing action. H3
        // asserts the declared five, so this is red by name.
        name: 'a stylesheet hides the DRAW pile and the row measures four controls where five are declared',
        edits: [{
          file: 'styles/combat.css',
          append: '.combat-action-row > .pile.draw { display: none; }',
        }],
        expectRed: /BAD\s+H3 /,
      },
      {
        // THE SAME CONTROL GOES QUIET WITHOUT display:none. visibility:hidden
        // keeps the pile's box and class; only "rendered" as the player sees it
        // can tell. Red by name on H3, like the display:none plant.
        name: 'a stylesheet makes the DISCARD pile visibility:hidden and the row still measures five boxes',
        edits: [{
          file: 'styles/combat.css',
          append: '.combat-action-row > .pile.discard { visibility: hidden; }',
        }],
        expectRed: /BAD\s+H3 /,
      },
      {
        // THE THIRD WAY A CONTROL GOES QUIET: opacity:0 keeps display,
        // visibility and geometry. Only the ancestor-walking opacity read in
        // rendered() can tell. Red by name on H3.
        name: 'a stylesheet makes the DISCARD pile opacity:0 and the row still measures five boxes',
        edits: [{
          file: 'styles/combat.css',
          append: '.combat-action-row > .pile.discard { opacity: 0; }',
        }],
        expectRed: /BAD\s+H3 /,
      },
      {
        // THE ROW IS CLIPPED BY THE BOX IT HANGS BELOW. On the wide layout the
        // row is absolutely positioned under .hand-area; overflow:hidden there
        // cuts it off while every box and style stays intact. Red by name on
        // H3 at the desk cells (the phone row is in flow and not clipped).
        name: 'the hand-area clips its overflow and the row hangs invisible below it on the wide layout',
        edits: [{
          file: 'styles/combat.css',
          find: '.hand-area {\n  height: 23rem; flex-shrink: 0; position: relative;',
          replace: '.hand-area {\n  height: 23rem; flex-shrink: 0; position: relative; overflow: hidden;',
        }],
        expectRed: /BAD\s+H3 1200x730/,
      },
      {
        // THE LABEL IS CUT OFF INSIDE ITS OWN BOX: a width cap with
        // overflow:hidden keeps .et-key's box inside END TURN while most of
        // "Backspace" is gone — the clipping H4 exists to catch, said of the
        // label's scroll box. Red by name on H3 at the desk WIDE cell.
        name: 'END TURN\'s key label is width-capped with overflow:hidden and the wide rebound label is cut off inside it',
        edits: [{
          file: 'styles/kit.css',
          find: '.as-btnrow > button.tall > .as-keycap { font-size: 0.9rem; }',
          replace: '.as-btnrow > button.tall > .as-keycap { font-size: 0.9rem; max-width: 1rem; overflow: hidden; }',
        }],
        expectRed: /BAD\s+H3 1200x730 WIDE/,
      },
      {
        // An OPAQUE LAYER OVER THE RAIL THAT THE POINTER PASSES THROUGH: the
        // effects layer made fixed, full-viewport and black. Every control
        // keeps its box, its styles and its hit-test (pointer-events:none
        // hands elementFromPoint the control underneath), and the eye sees
        // black. Red by name on H3 from the paint probe, not the hit-test.
        name: 'the effects layer paints an opaque sheet over the whole viewport with pointer-events:none, and every control still hit-tests as itself',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: fixed; inset: 0; background: #000; pointer-events: none; z-index: 300; overflow: hidden; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // A TRANSLUCENT SHEET: the same layer over the whole viewport at 90%
        // opacity. Every covered pixel still changes a little when the control
        // is hidden, so a yes/no-per-pixel read would count all of it as seen;
        // by magnitude nine tenths of the control's paint is gone (Codex, #540).
        name: 'the effects layer paints a 90%-opaque sheet over the whole viewport, and every covered pixel still changes a little',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.9); pointer-events: none; z-index: 300; overflow: hidden; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // AN ANCESTOR'S OWN PAINT: the row's ::after as an opaque band over the
        // bottom third of the row, above its controls (z-index inside the
        // row's own stacking context). The hit-test lists the ROW above its
        // controls there; a probe that skipped every ancestor would keep the
        // band in both uncovered captures and read nothing lost (Codex, #540).
        name: 'the row\'s ::after paints an opaque band over the bottom third of its own controls',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }\n.combat-action-row::after { content: ""; position: absolute; inset: auto 0 0 0; height: 34%; background: #000; z-index: 50; pointer-events: none; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // AN ANCESTOR THAT PAINTS ON BOTH SIDES: the row's ::before as a dark
        // sheet BELOW its controls (the background they read against) and its
        // ::after as a 90%-opaque sheet ABOVE them. Hiding both pseudo-elements
        // for the uncovered captures would swap the background under the
        // reference pair and could read nothing lost; hiding only the ::after
        // reads nine tenths lost (Codex, #540).
        name: 'the row\'s ::before is the background under its controls and its ::after a 90%-opaque sheet over them',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }\n.combat-action-row::before { content: ""; position: absolute; inset: 0; background: #0b0d12; z-index: 0; pointer-events: none; }\n.combat-action-row::after { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.9); z-index: 50; pointer-events: none; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // A SHEET THAT REFUSES THE HIT-TEST BY ITS OWN RULE: the band again,
        // with "pointer-events: none !important" under a selector more
        // specific than any * rule. An injected * rule would lose the
        // cascade and the band would never be listed (Codex, #540).
        name: 'an opaque band over the rail declares pointer-events: none !important under a specific selector',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: fixed; inset: auto 0 0 0; height: 3vh; background: #000; z-index: 300; overflow: hidden; }\n.combat .battlefield ~ .fx-layer, .combat .fx-layer { pointer-events: none !important; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // THE CONTROL'S OWN PAINT OVER ITS TEXT: the DRAW pile's ::after as an
        // opaque sheet over its own box. No element is before the pile in the
        // stack (the sheet hit-tests as the pile), the pile still hit-tests as
        // itself, and hiding the pile hides the sheet too, so the whole-
        // control read counts the sheet as the pile's own paint; the read of
        // its text does not (Codex, #540).
        name: "the DRAW pile's own ::after paints an opaque sheet over its count and label",
        edits: [{
          file: 'styles/combat.css',
          find: '.combat-action-row > .pile.draw { grid-area: draw; }',
          replace: ".combat-action-row > .pile.draw { grid-area: draw; position: relative; }\n.combat-action-row > .pile.draw::after { content: ''; position: absolute; inset: 0; background: #000; border-radius: 8px; }",
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // A FLEX ITEM WITH A z-index OVER THE COUNT: the DRAW pile is a flex
        // column, and its label — an in-flow item, positioned nowhere — is
        // pulled up over the count with a negative margin, an opaque
        // background and z-index: 1, which makes it a stacking context that
        // paints in z-order above the count's in-flow text (Codex, #550).
        name: "the DRAW pile's label, a flex item given z-index: 1, paints an opaque block over its count",
        edits: [{
          file: 'styles/combat.css',
          find: '.combat-action-row > .pile.draw { grid-area: draw; }',
          replace: ".combat-action-row > .pile.draw { grid-area: draw; }\n.combat-action-row > .pile.draw > small { z-index: 1; background: #000; color: #000; margin-top: -2.6rem; padding-top: 2.6rem; width: 100%; text-align: center; }",
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // AN INDIVIDUAL TRANSFORM ON THE LABEL: the same block over the count,
        // but a stacking context by `scale: 1` alone — the transform
        // shorthand stays "none" and the item has no z-index (Codex, #550).
        name: "the DRAW pile's label, given scale: 1 and nothing else, paints an opaque block over its count",
        edits: [{
          file: 'styles/combat.css',
          find: '.combat-action-row > .pile.draw { grid-area: draw; }',
          replace: ".combat-action-row > .pile.draw { grid-area: draw; }\n.combat-action-row > .pile.draw > small { scale: 1; background: #000; color: #000; margin-top: -2.6rem; padding-top: 2.6rem; width: 100%; text-align: center; }",
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // AN IN-FLOW BOX OVER THE TEXT: the label pulled up over the count by a
        // negative margin alone — positioned nowhere, no z-index, no transform,
        // no stacking context; a later box in tree order that paints above the
        // count's text where it overlaps it (Codex, #550).
        name: "the DRAW pile's label, pulled over its count by a negative margin and nothing else, paints an opaque block over it",
        edits: [{
          file: 'styles/combat.css',
          find: '.combat-action-row > .pile.draw { grid-area: draw; }',
          replace: ".combat-action-row > .pile.draw { grid-area: draw; }\n.combat-action-row > .pile.draw > small { background: #000; color: #000; margin-top: -2.6rem; padding-top: 2.6rem; width: 100%; text-align: center; }",
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // A PARTIAL SHEET: the same layer as a thin black band (3vh) along the
        // bottom of the viewport, over the lower edge of every control. Most
        // of each control still reaches the eye, its centre hit-tests as
        // itself, and an absolute "enough paint remains" floor would green;
        // the LOST share of its own paint does not (Codex, #538).
        name: 'the effects layer paints a thin opaque band over the bottom edge of the rail, most of every control still showing',
        edits: [{
          file: 'styles/combat.css',
          find: '.fx-layer { position: absolute; inset: 0; pointer-events: none; z-index: 300; overflow: hidden; }',
          replace: '.fx-layer { position: fixed; inset: auto 0 0 0; height: 3vh; background: #000; pointer-events: none; z-index: 300; overflow: hidden; }',
        }],
        expectRed: /BAD\s+H3 .*painted over/,
      },
      {
        // THE WHOLE GAME GOES TRANSPARENT AT THE ROOT. Descendants keep a
        // nonzero computed opacity, so only a walk that reaches html can tell.
        name: 'a stylesheet makes the root element opacity:0 and every control keeps its box',
        edits: [{
          file: 'styles/combat.css',
          find: '.combat { --action-row-drop: 6.4rem; }',
          replace: '.combat { --action-row-drop: 6.4rem; }\nhtml { opacity: 0; }',
        }],
        expectRed: /BAD\s+H3 /,
      },
      {
        // THE COARSE-POINTER PROMISE STOPS APPLYING: the phone rule that
        // withholds END TURN's key label loses its selector, and a thumb sees
        // a key it cannot press. Red by name on H3 at the phone cell — and
        // only a phone cell measured AS a phone (touch + coarse pointer
        // emulated) can see it; under a fine pointer this plant is invisible.
        name: 'the coarse-pointer rule stops withholding END TURN\'s key label and the phone draws a key it cannot press',
        edits: [{
          file: 'styles/kit.css',
          find: '@media (pointer: coarse) { .as-slot > .as-keycap, .as-btn > .as-keycap, .as-keycap.float { display: none; } }',
          replace: '@media (pointer: coarse) { .as-slot > .as-keycap, .as-keycap.float { display: none; } }',
        }],
        expectRed: /BAD\s+H3 390x844/,
      },
      {
        // THE KEY LABEL GOES QUIET THE SAME WAY. .et-key keeps its text and
        // box under visibility:hidden, so H4 still reads the rebind and the
        // containment still holds — only rendered() can say the player sees
        // no key. Red by name on H3.
        name: 'a stylesheet makes END TURN\'s key label visibility:hidden and the row still reads the binding',
        edits: [{
          file: 'styles/kit.css',
          find: '.as-btnrow > button.tall > .as-keycap { font-size: 0.9rem; }',
          replace: '.as-btnrow > button.tall > .as-keycap { visibility: hidden; font-size: 0.9rem; }',
        }],
        expectRed: /BAD\s+H3 1200x730/,
      },
      {
        // A DECLARED CELL STOPS BEING REACHED. The row never renders, and every
        // H-check has nothing to measure. A green here would be the same
        // confident nothing this gate printed over the retired strip.
        name: 'the row stops rendering and no H check may green on the empty population',
        edits: [{
          file: 'src/ui/screens/combat.js',
          find: '<div class="combat-action-row as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)}',
          replace: '<div class="combat-action-row-planted-away as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)}',
        }],
        expectRed: /BAD\s+H0 /,
      },
    ],
  };
  const selftestCode = await doorSelftest(SELFTEST);
  // THE COUNT IS THE CORPUS'S, not a literal: a literal said 8 over nine plants.
  // THE TERMINAL LINE IS IN A FORM tools/verdict.mjs ACCEPTS ("label: OK — N <words>, N caught"): the
  // previous wording was refused as SILENCE on the hosted board (run 299) and the whole
  // browser-guard job read red for a selftest that had caught every plant.
  if (selftestCode === 0) console.log(`hintstrip-selftest: OK — ${SELFTEST.plants.length} plants, ${SELFTEST.plants.length} caught`);
  process.exit(selftestCode);
}

// POINTER MODE IS PART OF THE SHAPE. styles/combat.css hides `.combat .et-key`
// under `@media (pointer: coarse)` — a phone's thumb has no key to press — so
// the phone cell is measured as a phone (touch + coarse pointer emulated) and
// the desk cell as a desk. Without the emulation the 390x844 cell ran under a
// fine pointer, the coarse rule never applied, and H3 asserted a key label
// "on both layouts" that a real phone never draws (Codex, #532).
const SHAPES = [
  { tag: '390x844', w: 390, h: 844, d: 2, mobile: true, pointer: 'coarse' },
  { tag: '1200x730', w: 1200, h: 730, d: 1, mobile: false, pointer: 'fine' },
];

// Text sizes walked through the game's own settings door. Law 4's subject: the
// strip is chrome, the labels are glyphs, and the fan's 6 px step answers
// NEITHER control — so S and XL are where a box sized in text units bites.
const TEXTS = ['S', 'M', 'XL'];

// The wide label for H4. Nine characters against `E`'s one, and it is a real
// key name a player can actually bind, not a stress string.
const WIDE_KEY = { action: 'endTurn', code: 'Backspace', label: 'Backspace' };

// THE ROW'S CONTROLS ARE DECLARED HERE, BY IDENTITY, not read off the template
// under test: the five persistent combat action destinations — the energy
// orb, DRAW, END TURN, DISCARD, EXHAUSTED. A list derived from combat.js's
// own template shrank with it: delete DISCARD from the row and the expected
// set lost DISCARD too, every H3 cell stayed green, and the workflow still
// claimed the piles were covered (Codex, #532). So the identities are typed
// once here, and the template is CROSS-CHECKED against them: a control the
// row no longer names, or one it names that this list does not, throws by
// name before a single cell is measured — the change and this list move in
// the same commit, or the gate refuses to run.
const DECLARED_CONTROLS = Object.freeze(['energy-orb', 'pile draw', 'end-turn', 'pile discard', 'pile exhaust']);
const EXPECTED_CONTROLS = (() => {
  const src = readFileSync(join(ROOT, 'src/ui/screens/combat.js'), 'utf8');
  // The row is found by its class PREFIX so the H0 plant (which renames the
  // class to make the row vanish) still parses: that plant must reach H0's
  // empty-population red, not a thrown "could not read the template".
  const row = src.match(/<div class="combat-action-row[^"]*"[\s\S]*?<\/div>\s*<!-- Context hints/);
  if (!row) throw new Error('hintstrip: could not read the action row out of src/ui/screens/combat.js');
  // THE KIT SWEEP (2026-09-04): the row's controls are kit builders, so the
  // hook classes are read off the builder calls — the StatPair's `class:`,
  // `pileButton('<kind>')`, End Turn's `className:` — the same names the
  // rendered elements carry.
  const named = [
    ...[...row[0].matchAll(/class: '([^']+)'/g)].map((m) => m[1].split(/\s+/).filter((k) => k === 'energy-orb').join(' ')),
    ...[...row[0].matchAll(/pileButton\('([a-z]+)'/g)].map((m) => `pile ${m[1]}`),
    ...[...row[0].matchAll(/className: '([^']+)'/g)].map((m) => m[1].split(/\s+/).filter((k) => k === 'end-turn').join(' ')),
  ].filter(Boolean);
  const sameSet = (x) => x.split(/\s+/).sort().join(' ');
  const missing = DECLARED_CONTROLS.filter((d) => !named.some((n) => sameSet(n) === sameSet(d)));
  const extra = named.filter((n) => !DECLARED_CONTROLS.some((d) => sameSet(n) === sameSet(d)));
  if (missing.length || extra.length) {
    throw new Error(`hintstrip: the action row in src/ui/screens/combat.js and DECLARED_CONTROLS disagree — `
      + `${missing.length ? `the row no longer names ${missing.map((m) => `"${m}"`).join(', ')}` : ''}`
      + `${missing.length && extra.length ? '; ' : ''}`
      + `${extra.length ? `the row names ${extra.map((m) => `"${m}"`).join(', ')} that this gate does not declare` : ''}`
      + `. Change both in one commit, or the gate measures a population that shrank with the template.`);
  }
  return DECLARED_CONTROLS;
})();

// The furniture the row may not touch. Named, so a fix that moves the row onto
// something else is red instead of quiet. The retired hint strip is listed so
// that if it ever renders on combat again the overlap is measured, not assumed
// away; while it is `display: none` it has no box and is skipped.
const FURNITURE = [
  ['topbar', '.combat .topbar'],
  ['battlefield', '.combat .field'],
  ['retired hint strip', '.combat .hand-area > .hint-bar.hint-combat'],
];

const findings = [];
// EVERY CELL WHERE THE COLUMN DID NOT FIT, so the number cannot go quiet just
// because the verdict is `unknown`. Printed unconditionally at the end.
const columnOverflows = [];
let checks = 0;
const ok = (id, cell, msg) => { checks++; console.log(`  ok   ${id} ${cell} — ${msg}`); };
const bad = (id, cell, msg) => { checks++; findings.push(`${id} ${cell}`); console.log(`  BAD  ${id} ${cell} — ${msg}`); };
let unknowns = 0;
const unk = (id, cell, msg) => { unknowns++; console.log(`  unk  ${id} ${cell} — ${msg}`); };

const READ = (prop) => `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const Lr = (r) => ({ left: +(r.left/z).toFixed(2), top: +(r.top/z).toFixed(2), right: +(r.right/z).toFixed(2),
             bottom: +(r.bottom/z).toFixed(2), w: +(r.width/z).toFixed(2), h: +(r.height/z).toFixed(2) });
  const L = (el) => Lr(el.getBoundingClientRect());
  // A furniture box counts only when the element renders: a display:none
  // element has an empty rect at 0,0 and would otherwise overlap nothing or
  // everything by accident.
  const one = (s) => { const el = document.querySelector(s); if (!el) return null;
    if (getComputedStyle(el).display === 'none') return null; return L(el); };
  // Effective opacity walks the ancestors: opacity:0 on the control or on any
  // box above it leaves display, visibility and geometry intact and the
  // player sees nothing — the third way a control goes quiet.
  // ROOT INCLUDED: opacity:0 on html itself leaves every descendant's computed
  // opacity nonzero while the whole game is transparent (Codex, #532).
  const clear = (c) => { for (let n = c; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0') return false; return true; };
  // CLIPPED BY AN ANCESTOR: an overflow:hidden/clip box above the control
  // (the wide layout's .hand-area, which the row hangs below) can cut it off
  // while every computed style and box stays intact — so the box is
  // intersected with every clipping ancestor's. COVERED: the topmost element
  // at the control's centre must be the control (or a descendant); a card, a
  // veil or a sibling drawn over it is a control the player cannot reach.
  // Both are the geometry the eye sees, not the geometry the DOM reports
  // (Codex, #532).
  // clipOf judges any rect against the clipping boxes from "from" upward, so
  // the same walk serves a control (from its parent) and a label's TEXT (from
  // the label itself, whose own overflow:hidden is the first box that can cut
  // its text).
  const clipOf = (r, from) => {
    for (let n = from; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const clips = (v) => v !== 'visible';
      if (!clips(cs.overflowX) && !clips(cs.overflowY)) continue;
      const a = n.getBoundingClientRect();
      const x1 = clips(cs.overflowX) ? Math.max(r.left, a.left) : r.left, x2 = clips(cs.overflowX) ? Math.min(r.right, a.right) : r.right;
      const y1 = clips(cs.overflowY) ? Math.max(r.top, a.top) : r.top, y2 = clips(cs.overflowY) ? Math.min(r.bottom, a.bottom) : r.bottom;
      if (x2 - x1 < r.width - 1 || y2 - y1 < r.height - 1) return (String(n.className).split(' ')[0] || n.tagName.toLowerCase()) + ' clips it to ' + Math.max(0, x2 - x1).toFixed(0) + 'x' + Math.max(0, y2 - y1).toFixed(0) + ' of ' + r.width.toFixed(0) + 'x' + r.height.toFixed(0);
    }
    return null; };
  const clippedBy = (c) => clipOf(c.getBoundingClientRect(), c.parentElement);
  // The rect the TEXT paints, not the box its element reports: a Range over
  // the element's contents. scrollWidth > clientWidth said only that the text
  // is wider than its box, which under overflow:visible spills in full view
  // and is no clipping at all (Codex, #538).
  const textRect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
  const coveredBy = (c, within = c) => { const r = c.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return 'nothing hit-tests at its centre';
    if (within.contains(hit)) return null;
    return (String(hit.className).split(' ')[0] || hit.tagName.toLowerCase()) + ' is drawn over its centre'; };
  const hiddenWhy = (c, within = c) => { const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
    return cs.display === 'none' ? 'display:none' : cs.visibility !== 'visible' ? 'visibility:' + cs.visibility
      : !clear(c) ? 'opacity:0' : !(r.width > 0 && r.height > 0) ? 'no box'
      : clippedBy(c) ? ('clipped: ' + clippedBy(c)) : coveredBy(c, within) ? ('covered: ' + coveredBy(c, within)) : 'rendered'; };
  const rendered = (c, within = c) => hiddenWhy(c, within) === 'rendered';
  const strip = document.querySelector('.combat-action-row');
  const hand = document.querySelector('.hand');
  const endTurn = strip ? strip.querySelector('.end-turn') : null;
  const key = endTurn ? endTurn.querySelector('.et-key') : null;
  return {
    layout: document.documentElement.dataset.layout || null,
    // The pointer mode the STYLESHEET sees, so a cell asserts against what the
    // page rendered under and H0 can say whether the emulation took.
    coarse: window.matchMedia('(pointer: coarse)').matches,
    vw: window.innerWidth / z, vh: window.innerHeight / z,
    present: !!strip,
    display: strip ? getComputedStyle(strip).display : null,
    strip: strip ? L(strip) : null,
    stripFlow: strip ? { pos: getComputedStyle(strip).position, overflow: getComputedStyle(strip).overflow,
      scrollW: strip.scrollWidth, clientW: strip.clientWidth, scrollH: strip.scrollHeight, clientH: strip.clientHeight } : null,
    // The row's controls, each a "chip" for H3: its rendered box and its text.
    // RENDERED means the player can see it: display, visibility and a real
    // box. A pile hidden with visibility:hidden keeps its geometry and class
    // and would otherwise satisfy every check below.
    chips: strip ? [...strip.children].filter((c) => rendered(c))
      .map((c) => ({ text: c.textContent.replace(/\s+/g, ' ').trim(), cls: c.className, box: L(c) })) : [],
    hiddenControls: strip ? [...strip.children].filter((c) => !rendered(c))
      .map((c) => c.className + ' (' + hiddenWhy(c) + ')') : [],
    // END TURN's key label, for H3 (inside its control) and H4 (the rebind took).
    endTurn: endTurn ? L(endTurn) : null,
    // The label goes through the same rendered() door as the controls: a
    // visibility:hidden .et-key keeps its text and box and would otherwise
    // satisfy H3's containment and H4's rebind read while the player sees no
    // key at all.
    // The label's hit-test is answered by END TURN (a kbd inside a button is
    // the button's to the pointer). Whether the TEXT is whole is read from the
    // rect the text paints: cut off by a clipping box from the label itself
    // upward (a width-capped overflow:hidden label keeps a box inside END TURN
    // while most of "Backspace" is gone), or spilled outside END TURN under
    // overflow:visible. Text wider than its own box but drawn in full inside
    // END TURN is whole.
    key: key ? { text: key.textContent.trim(), box: L(key), rendered: rendered(key, endTurn), why: hiddenWhy(key, endTurn),
      textBox: Lr(textRect(key)), textClipped: clipOf(textRect(key), key) } : null,
    cards: [...document.querySelectorAll('.hand .card')].map(L),
    hand: one('.hand'),
    handBox: hand ? { clientH: hand.clientHeight, scrollH: hand.scrollHeight, padTop: getComputedStyle(hand).paddingTop } : null,
    lift: hand ? getComputedStyle(hand).getPropertyValue(${JSON.stringify(prop)}).trim() : null,
    furniture: ${JSON.stringify(FURNITURE)}.map(([name, sel]) => [name, one(sel)]),
    // The column itself, so a red can say whether the strip is misplaced or
    // merely the last passenger on a column that does not fit.
    column: (() => { const c = document.querySelector('.combat'); if (!c) return null;
      return { scrollH: c.scrollHeight, clientH: c.clientHeight,
        parts: [...c.children].filter((k) => { const p = getComputedStyle(k).position; return p === 'static' || p === 'relative'; })
          .map((k) => [String(k.className).split(' ')[0] || k.tagName.toLowerCase(), +(k.getBoundingClientRect().height / z).toFixed(2)]) }; })(),
  };
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const overlap = (a, b) => (!a || !b) ? 0
  : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const area = (b) => Math.max(0, b.w) * Math.max(0, b.h);

// One cell: measure and judge. `label` says which binding the chips are under.
// PAINT COVERAGE, independent of the hit-test. elementFromPoint skips a layer
// with pointer-events:none (.fx-layer in styles/combat.css is one), so an
// opaque effect painted over the rail leaves the hit-test answering "the
// control" while the eye sees the effect; and one centre sample says nothing
// about the rest of the box (Codex, #538). So each control is photographed,
// hidden (visibility:hidden — no layout moves), photographed again and
// restored: the pixels that CHANGE are the pixels the control paints that
// reach the eye. A control whose box changes in almost none of its pixels is
// painted over, whatever is drawn over it and whatever hit-tests there.
// PAINT_FLOOR is the least share of a control's own box its paint must reach
// against its own in-situ background; the shipped controls measure well above
// it (printed in every H3 ok line).
const PAINT_FLOOR = 0.25;
// The most of a control's own paint that may fail to reach the eye in situ.
// The floor above says the control paints; this says nothing is drawn over
// it. With nothing drawn over a control its two capture pairs are the same
// captures, so the shipped controls read 0-4% lost (END TURN's pulse and the
// orb's glow move a little between captures; printed in every H3 ok line);
// the tolerance is 10%, so a sheet over an eighth of a control, or a sheet at
// an eighth of opacity over all of it, is red.
const PAINT_LOST = 0.1;
const decodePng = (buf) => {
  let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8); const d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12] !== 0) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; p += 12 + len; }
  if (bd !== 8 || !(ct === 6 || ct === 2)) throw new Error(`png bit depth ${bd} colour type ${ct} — the probe reads 8-bit RGB(A) only`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const ft = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) { const a = x >= bpp ? out[dst + x - bpp] : 0, b = y > 0 ? out[dst - stride + x] : 0, c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255; } }
  return { w, h, bpp, px: out };
};
// SIX CAPTURES PER CONTROL, ALL IN SITU, read as MAGNITUDES, not as a
// yes/no per pixel (a translucent sheet still changes every covered pixel a
// little, so a binary "did it change" mask would read it as fully seen):
//   inSitu       — the page as shipped;
//   inSituHidden — the control hidden in place (visibility:hidden, no layout
//                  moves), everything else as shipped;
//   uncovered    — the page as shipped with every element painted ABOVE the
//                  control hidden: the control over its own in-situ
//                  background, which is the reference an overlay cannot touch;
//   uncoveredBg  — the same with the control hidden too: the in-situ
//                  background itself;
//   inSituText, uncoveredText — the first and third with the control's text
//                  made transparent: the text's own paint, in situ and
//                  uncovered, read by the same arithmetic (a cover the
//                  control itself draws over its text — Codex, #540).
// WHAT IS ABOVE THE CONTROL is found by geometry, not by guessing:
// document.elementsFromPoint at a grid of points over the control's box,
// with pointer-events forced to auto on every element for the read (so a
// pointer-events:none sheet is listed too), lists the paint order topmost
// first — everything before the control (or a descendant) and not an
// ancestor of it is drawn over it. Hiding a cover that paints nothing (the
// shipped .fx-layer, an empty positioned wrapper) changes no pixel, so the
// list needs no judgement of what paints.
// `own` is the share of the box where uncovered differs from uncoveredBg: the
// pixels the control paints against its own background. Over those pixels
// the control's UNOBSCURED contribution is |uncovered - uncoveredBg| and it
// DELIVERS |inSitu - inSituHidden| — the same background on both sides, so
// background contrast can neither hide nor invent attenuation (Codex, #540).
// The LOST share is what it fails to deliver, summed by magnitude: a sheet
// at 90% opacity that leaves a tenth of every covered pixel's change loses
// nine tenths, a sheet over a fifth of the control loses a fifth, and with
// nothing painted over the control the two pairs are the same captures and
// nothing is lost.
const decode4 = (...bufs) => { const P = bufs.map(decodePng);
  if (P.some((p) => p.w !== P[0].w || p.h !== P[0].h)) throw new Error('the captures differ in size');
  return P; };
const mag = (P, Q, o) => Math.abs(P.px[o] - Q.px[o]) + Math.abs(P.px[o + 1] - Q.px[o + 1]) + Math.abs(P.px[o + 2] - Q.px[o + 2]);
// The text's paint in one pair: the summed change, by magnitude, between a
// capture and the same capture with the text made transparent.
const textPaint = (withText, without) => { const [A, B] = decode4(withText, without); let sum = 0;
  for (let i = 0, n = A.w * A.h; i < n; i++) { const d = mag(A, B, i * A.bpp); if (d > 12) sum += d; } return sum; };
const paintOfCaptures = (inSitu, inSituHidden, uncovered, uncoveredBg) => {
  const [A, B, C, G] = decode4(inSitu, inSituHidden, uncovered, uncoveredBg);
  const n = A.w * A.h; let ownPx = 0, owed = 0, delivered = 0;
  for (let i = 0; i < n; i++) { const o = i * A.bpp;
    const need = mag(C, G, o);
    if (need <= 12) continue; // not a pixel the control paints (4 levels per channel of noise allowed)
    ownPx++; const got = mag(A, B, o);
    owed += need; delivered += Math.min(got, need); }
  return { own: n ? ownPx / n : 0, lost: owed ? 1 - delivered / owed : 0 }; };
const PAINT_TARGETS = `(() => { const row = document.querySelector('.combat-action-row'); if (!row) return [];
  const list = [...row.children].map((c, i) => ({ sel: '.combat-action-row > :nth-child(' + (i + 1) + ')', name: (c.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24) || c.className }));
  if (document.querySelector('.combat-action-row .et-key')) list.push({ sel: '.combat-action-row .et-key', name: 'END TURN key label' });
  return list.map((t) => { const el = document.querySelector(t.sel); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { ...t, x: r.left, y: r.top, w: r.width, h: r.height, shown: cs.display !== 'none' && cs.visibility === 'visible' && r.width >= 1 && r.height >= 1 }; }); })()`;
// Marks every element drawn above the control and returns their names (paint
// order, topmost first, deduplicated). Two kinds: a SIBLING cover (any
// element that is not an ancestor) is hidden whole for the uncovered
// captures; an ANCESTOR that the hit-test lists ABOVE the control paints
// something over it from its own box — a ::before/::after with a z-index, a
// background in a higher layer — and cannot be hidden whole without hiding
// the control, so THE pseudo-element responsible is hidden instead for those
// captures (an ancestor's own background paints below its descendants, so
// what an ancestor can draw over a control is a ::before/::after; which one
// is found by hiding each alone and looking again, so the other — perhaps
// the control's background — stays in both capture pairs — Codex, #540). An
// ancestor whose paint lies below the control is listed after it and is
// nothing to hide. Pseudo-elements are hit-testable for the read too.
const COVERS_OF = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect();
  // EVERY ELEMENT IS HIT-TESTABLE FOR THE READ, by an inline !important that
  // no stylesheet rule can outrank (a sheet's own "pointer-events: none
  // !important" under a specific selector beats an injected * rule, and an
  // element the hit-test cannot see is a cover the probe never hides —
  // Codex, #540); the prior inline value and priority are put back after.
  // Pseudo-elements take no inline style, so their rule is given a
  // specificity (four ids) no shipped selector reaches.
  const prior = new Map();
  for (const n of document.querySelectorAll('*')) { prior.set(n, [n.style.getPropertyValue('pointer-events'), n.style.getPropertyPriority('pointer-events')]); n.style.setProperty('pointer-events', 'auto', 'important'); }
  const style = document.createElement('style'); style.textContent = 'html :not(#hs1):not(#hs2):not(#hs3):not(#hs4)::before, html :not(#hs1):not(#hs2):not(#hs3):not(#hs4)::after { pointer-events: auto !important; }'; document.head.appendChild(style);
  const found = [], above = new Map(), texts = [], ownPseudo = new Map(), inflow = []; // ancestor -> the points it was above the control at; the control's text rects; a text ancestor -> its pseudo-element hits; in-flow descendants hit at a text point, for the paint read
  const overAt = (x, y) => { const stack = document.elementsFromPoint(x, y); const at = stack.findIndex((n) => n === el || el.contains(n)); return at < 0 ? null : stack.slice(0, at); };
  try {
    // THE GRID IS DENSE ENOUGH THAT NO COVER WORTH THE TOLERANCE SLIPS
    // BETWEEN ITS POINTS: with a spacing of half the control's shorter side
    // times PAINT_LOST, any band whose thickness reaches the spacing meets a
    // sample, and a band thinner than that covers less than half the
    // tolerance of the shorter side — under the loss that is red (Codex,
    // #540). A 44px-tall control is scanned every 2px.
    const step = Math.max(1, Math.floor(Math.min(r.width, r.height) * ${PAINT_LOST} / 2));
    for (let y = r.top + 1; y < r.bottom; y += step) for (let x = r.left + 1; x < r.right; x += step) {
      // Only a point the control itself is hit at says anything about what is
      // over it: at a point of its box it does not paint (an orb's corner) the
      // stack is its ancestors alone, none of them "above" anything.
      const over = overAt(x, y);
      if (!over) continue;
      for (const n of over) {
        if (n.contains(el)) { if (!above.has(n)) above.set(n, []); above.get(n).push([x, y]); continue; }
        if (!found.includes(n)) found.push(n);
      }
    }
    // THE CONTROL'S OWN PAINT OVER ITS TEXT. A cover the hit-test reports as
    // the control itself — its own ::after with a background over its label,
    // a positioned child drawn over the count — is no element before the
    // control in the stack, and hiding the control hides it too, so the
    // whole-control read counts it as the control's paint (Codex, #540). So
    // the control's TEXT is read on its own: at a grid over each text node's
    // rects, with the boxes of the text's own ancestors inside the control
    // made non-hit-testable (their pseudo-elements stay hit-testable, so a
    // hit reported as one of them IS one of its pseudo-elements), whatever
    // the stack lists inside the control is a candidate, and it is a cover
    // of the text when CSS paint order puts it above in-flow inline content
    // (CSS 2.1 Appendix E): positioned with z-index auto or >= 0, a flex or
    // grid item with a z-index >= 0 (which forms a stacking context and
    // paints in z-order as a positioned box does — Codex, #550), or a
    // stacking context of its own (transform — the shorthand or an
    // individual translate/rotate/scale, which leave the shorthand "none" —
    // opacity, filter, backdrop-filter, clip-path, mask, perspective,
    // isolation, blend mode, contain, will-change naming one of these). An
    // in-flow box with none of these —
    // the pile's label under its count, an inline ::after — is laid out
    // beside the text, not over it; a z-index:-1 glow or item paints below
    // the text; both stay in both capture pairs.
    { const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t; (t = walker.nextNode());) { if (!t.data.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const b of rg.getClientRects()) if (b.width >= 1 && b.height >= 1 && b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom) texts.push({ t, b }); } }
    const stacks = (cs) => cs.transform !== 'none' || (cs.translate || 'none') !== 'none' || (cs.rotate || 'none') !== 'none' || (cs.scale || 'none') !== 'none'
      || cs.opacity !== '1' || cs.filter !== 'none' || (cs.backdropFilter || 'none') !== 'none'
      || cs.clipPath !== 'none' || (cs.maskImage || cs.webkitMaskImage || 'none') !== 'none' || cs.perspective !== 'none'
      || cs.isolation === 'isolate' || cs.mixBlendMode !== 'normal' || /paint|layout|strict|content/.test(cs.contain || '')
      || /transform|opacity|filter|perspective/.test(cs.willChange || '');
    const flexOrGridItem = (n, which) => { const host = which ? n : n.parentElement; if (!host) return false; const d = getComputedStyle(host).display; return /flex|grid/.test(d); };
    const aboveText = (n, which) => { const cs = getComputedStyle(n, which ? '::' + which : null);
      if (cs.position !== 'static') return cs.zIndex === 'auto' || Number(cs.zIndex) >= 0;
      if (cs.zIndex !== 'auto' && flexOrGridItem(n, which)) return Number(cs.zIndex) >= 0;
      return stacks(cs); };
    for (const { t, b } of texts) {
      const chain = []; for (let n = t.parentElement; n && (n === el || el.contains(n)); n = n.parentElement) chain.push(n);
      const ts = Math.max(1, Math.floor(Math.min(b.width, b.height) * ${PAINT_LOST} / 2));
      const pts = []; for (let y = b.top + 0.5; y < b.bottom; y += ts) for (let x = b.left + 0.5; x < b.right; x += ts) pts.push([x, y]);
      // OUTSIDE THE CONTROL, only what the paint stack lists ABOVE it at the
      // text point is a cover — the same boundary the box read keeps — so a
      // sibling painted beneath a translucent control (an underlay) stays in
      // both capture pairs and cannot move the text's background (Codex,
      // #550). Read before the text's ancestors are made non-hit-testable,
      // which would drop that boundary from the stack.
      for (const [x, y] of pts) for (const n of (overAt(x, y) || [])) { if (n.contains(el)) { if (!above.has(n)) above.set(n, []); above.get(n).push([x, y]); } else if (!found.includes(n)) found.push(n); }
      for (const n of chain) n.style.setProperty('pointer-events', 'none', 'important');
      try {
        for (const [x, y] of pts) {
          for (const n of document.elementsFromPoint(x, y)) {
            if (!(n === el || el.contains(n))) continue; // outside the control: judged above, by the paint stack
            if (chain.includes(n)) { if (!ownPseudo.has(n)) ownPseudo.set(n, { t, pts: [] }); ownPseudo.get(n).pts.push([x, y]); }
            else if (!n.contains(t) && aboveText(n, null)) { if (!found.includes(n)) found.push(n); }
            // AN IN-FLOW DESCENDANT hit at a text point — positioned nowhere, no
            // stacking context — paints above the text only where it overlaps
            // it as a later box (a negative margin), which no rule of the
            // computed style says; it is listed for the PAINT read in paintOf,
            // which hides it alone and asks whether the text came back
            // (Codex, #550).
            else if (!n.contains(t) && !inflow.includes(n)) inflow.push(n);
          }
        }
      } finally { for (const n of chain) n.style.setProperty('pointer-events', 'auto', 'important'); }
    }
    // WHICH PSEUDO-ELEMENT of an ancestor is the one above — read after BOTH
    // scans, since the text scan lists ancestors the box grid did not meet
    // (Codex, #550) — is the one above: hide ::after alone
    // and look again at the points it was above at; if it is no longer above
    // there, ::after was the paint; else ::before; else both. Only that one is
    // hidden for the uncovered captures, so an ancestor whose OTHER pseudo-
    // element is the control's background keeps that background in both
    // capture pairs (Codex, #540).
    for (const [n, pts] of above) {
      const stillAbove = (which) => { const st = document.createElement('style'); st.textContent = '[data-hintstrip-probe]::' + which + ' { visibility: hidden !important; }';
        n.setAttribute('data-hintstrip-probe', ''); document.head.appendChild(st);
        try { return pts.some(([x, y]) => (overAt(x, y) || []).includes(n)); } finally { st.remove(); n.removeAttribute('data-hintstrip-probe'); } };
      n.setAttribute('data-hintstrip-cover-anc', !stillAbove('after') ? 'after' : !stillAbove('before') ? 'before' : 'both');
    }
    for (const [n, { pts }] of ownPseudo) {
      // WHICH of its pseudo-elements was hit (hide ::after alone, look again),
      // and is it above the text by paint order: only that one is hidden.
      const hitStill = (which) => { const st = document.createElement('style'); st.textContent = '[data-hintstrip-probe]::' + which + ' { visibility: hidden !important; }';
        n.setAttribute('data-hintstrip-probe', ''); document.head.appendChild(st); n.style.setProperty('pointer-events', 'none', 'important');
        try { return pts.some(([x, y]) => document.elementsFromPoint(x, y).includes(n)); } finally { st.remove(); n.removeAttribute('data-hintstrip-probe'); n.style.setProperty('pointer-events', 'auto', 'important'); } };
      const which = !hitStill('after') ? ['after'] : !hitStill('before') ? ['before'] : ['after', 'before'];
      const hide = which.filter((w) => aboveText(n, w));
      if (hide.length) { n.setAttribute('data-hintstrip-cover-anc', hide.length === 2 ? 'both' : hide[0]); n.setAttribute('data-hintstrip-cover-own', hide.map((w) => '::' + w).join(' and ')); }
    }
  } finally { style.remove(); for (const [n, [v, p]] of prior) { if (v) n.style.setProperty('pointer-events', v, p); else n.style.removeProperty('pointer-events'); } }
  const name = (n) => (String(n.className).split(' ')[0] || n.tagName.toLowerCase());
  found.forEach((n, i) => n.setAttribute('data-hintstrip-cover', String(i)));
  inflow.forEach((n, i) => n.setAttribute('data-hintstrip-inflow', String(i)));
  return { text: texts.length, inflow: inflow.map(name), names: found.map((n) => (el.contains(n) ? 'its ' + name(n) + ' over its text' : name(n)))
    .concat([...above.keys()].map((n) => 'ancestor ' + name(n) + ' (its ::' + n.getAttribute('data-hintstrip-cover-anc') + ' above the control)'))
    .concat([...ownPseudo.keys()].filter((n) => n.hasAttribute('data-hintstrip-cover-own')).map((n) => (n === el ? 'its own ' : 'its ' + name(n) + ' ') + n.getAttribute('data-hintstrip-cover-own') + ' over its text')) }; })()`;
const COVERS_HIDE = `(() => {
  for (const n of document.querySelectorAll('[data-hintstrip-cover]')) { n.setAttribute('data-hintstrip-cover-vis', n.style.getPropertyValue('visibility') || ''); n.style.setProperty('visibility', 'hidden', 'important'); }
  const st = document.createElement('style'); st.id = 'hintstrip-cover-style';
  st.textContent = '[data-hintstrip-cover-anc="after"]::after, [data-hintstrip-cover-anc="both"]::after, [data-hintstrip-cover-anc="before"]::before, [data-hintstrip-cover-anc="both"]::before { visibility: hidden !important; }';
  document.head.appendChild(st); return 1; })()`;
const COVERS_RESTORE = `(() => {
  for (const n of document.querySelectorAll('[data-hintstrip-cover]')) { const v = n.getAttribute('data-hintstrip-cover-vis'); if (v) n.style.setProperty('visibility', v); else n.style.removeProperty('visibility'); n.removeAttribute('data-hintstrip-cover'); n.removeAttribute('data-hintstrip-cover-vis'); }
  for (const n of document.querySelectorAll('[data-hintstrip-cover-anc]')) { n.removeAttribute('data-hintstrip-cover-anc'); n.removeAttribute('data-hintstrip-cover-own'); }
  for (const n of document.querySelectorAll('[data-hintstrip-inflow]')) n.removeAttribute('data-hintstrip-inflow');
  const st = document.getElementById('hintstrip-cover-style'); if (st) st.remove(); return 1; })()`;
// THE TEXT MADE TRANSPARENT, in place: the fill, the shadow and the stroke of
// every element in the control (inline, !important; priors put back), so the
// captures with and without it differ in the text's paint alone — a
// currentColor border is not the text and keeps its colour.
const TEXT_PROPS = ['-webkit-text-fill-color', 'text-shadow', '-webkit-text-stroke-color'];
const TEXT_HIDE = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); const props = ${JSON.stringify(TEXT_PROPS)};
  for (const n of [el, ...el.querySelectorAll('*')]) { n.setAttribute('data-hintstrip-text', JSON.stringify(props.map((p) => [n.style.getPropertyValue(p), n.style.getPropertyPriority(p)])));
    n.style.setProperty(props[0], 'transparent', 'important'); n.style.setProperty(props[1], 'none', 'important'); n.style.setProperty(props[2], 'transparent', 'important'); }
  return 1; })()`;
const TEXT_RESTORE = `(() => { const props = ${JSON.stringify(TEXT_PROPS)};
  for (const n of document.querySelectorAll('[data-hintstrip-text]')) { const prior = JSON.parse(n.getAttribute('data-hintstrip-text'));
    props.forEach((p, i) => { const [v, pr] = prior[i]; if (v) n.style.setProperty(p, v, pr); else n.style.removeProperty(p); }); n.removeAttribute('data-hintstrip-text'); }
  return 1; })()`;
// ANIMATION IS FROZEN FOR THE READ (play-state paused, transitions off, in
// place): END TURN's pulse moving between two captures is a change of the
// background under its text, not paint over it, and the six captures of a
// control must be of the same frame. Restored after the last control.
const FREEZE = `(() => { const st = document.createElement('style'); st.id = 'hintstrip-freeze';
  st.textContent = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }'; document.head.appendChild(st); return 1; })()`;
const THAW = `(() => { const st = document.getElementById('hintstrip-freeze'); if (st) st.remove(); return 1; })()`;
async function paintOf(ev, shot) {
  await ev(FREEZE);
  try { return await paintOfFrozen(ev, shot); } finally { await ev(THAW).catch(() => {}); }
}
async function paintOfFrozen(ev, shot) {
  const out = [];
  for (const t of await ev(PAINT_TARGETS)) {
    if (!t.shown) { out.push({ name: t.name }); continue; }
    const clip = { x: Math.floor(t.x), y: Math.floor(t.y), width: Math.ceil(t.w), height: Math.ceil(t.h), scale: 1 };
    const vis = (v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(t.sel)}); el.style.setProperty('visibility', ${JSON.stringify(v)}, 'important'); return 1; })()`);
    const restore = async () => { await ev(`(() => { const el = document.querySelector(${JSON.stringify(t.sel)}); el.style.removeProperty('visibility'); return 1; })()`); await ev(TEXT_RESTORE); await ev(COVERS_RESTORE); };
    try {
      const inSitu = await shot(clip);
      await vis('hidden');
      const inSituHidden = await shot(clip);
      await vis('visible');
      await ev(TEXT_HIDE(t.sel));
      const inSituText = await shot(clip);
      await ev(TEXT_RESTORE);
      const { text, names: covers, inflow } = await ev(COVERS_OF(t.sel));
      // AN IN-FLOW DESCENDANT OVER THE TEXT is found by paint, not by rule:
      // hidden alone (in place), does the text deliver more than it delivers
      // in situ? A later box pulled over the text by a negative margin paints
      // above it in tree order (CSS 2.1 Appendix E) and gives it back when
      // hidden; the label laid out beside its count changes nothing of the
      // count's paint. One that gives back more than PAINT_LOST is a cover,
      // hidden for the uncovered captures like any other (Codex, #550).
      for (let i = 0; i < (inflow || []).length; i++) {
        const sel = '[data-hintstrip-inflow="' + i + '"]';
        await ev(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); n.setAttribute('data-hintstrip-inflow-vis', n.style.getPropertyValue('visibility') || ''); n.style.setProperty('visibility', 'hidden', 'important'); return 1; })()`);
        const alone = await shot(clip);
        await ev(TEXT_HIDE(t.sel));
        const aloneText = await shot(clip);
        await ev(TEXT_RESTORE);
        await ev(`(() => { const n = document.querySelector(${JSON.stringify(sel)}); const v = n.getAttribute('data-hintstrip-inflow-vis'); if (v) n.style.setProperty('visibility', v); else n.style.removeProperty('visibility'); n.removeAttribute('data-hintstrip-inflow-vis'); return 1; })()`);
        const given = textPaint(alone, aloneText), had = textPaint(inSitu, inSituText);
        if (given > had * (1 + PAINT_LOST) + 12 * 4) { await ev(`(() => { document.querySelector(${JSON.stringify(sel)}).setAttribute('data-hintstrip-cover', 'inflow-' + ${i}); return 1; })()`); covers.push('its ' + inflow[i] + ' over its text (an in-flow box, by paint)'); }
      }
      await ev(COVERS_HIDE);
      const uncovered = await shot(clip);
      await ev(TEXT_HIDE(t.sel));
      const uncoveredText = await shot(clip);
      await ev(TEXT_RESTORE);
      await vis('hidden');
      const uncoveredBg = await shot(clip);
      await restore();
      // THE TEXT'S OWN READ, the same arithmetic over the same pixels: what
      // the text contributes with the covers hidden against what it delivers
      // in situ; text that contributes nothing even uncovered is wholly lost.
      const textRead = text ? paintOfCaptures(inSitu, inSituText, uncovered, uncoveredText) : null;
      if (process.env.HINTSTRIP_DUMP) { const d = process.env.HINTSTRIP_DUMP; mkdirSync(d, { recursive: true }); const tag = (t.name + '-' + clip.width + 'x' + clip.height).replace(/[^A-Za-z0-9]+/g, '_'); [['inSitu', inSitu], ['inSituHidden', inSituHidden], ['inSituText', inSituText], ['uncovered', uncovered], ['uncoveredText', uncoveredText], ['uncoveredBg', uncoveredBg]].forEach(([k, b]) => writeFileSync(join(d, tag + '-' + k + '.png'), b)); }
      out.push({ name: t.name, covers, ...paintOfCaptures(inSitu, inSituHidden, uncovered, uncoveredBg), ...(textRead ? { textLost: textRead.own > 0 ? textRead.lost : 1 } : {}) });
    } catch (e) { await restore().catch(() => {}); throw e; }
  }
  return out;
}

function judge(r, cell, wide, pointer) {
  // THE PREMISE FIRST. A phone cell measured under a fine pointer is not a
  // phone cell: the coarse-pointer stylesheet rules never applied, and every
  // key-label sentence below would be about a device that does not exist.
  if (pointer && (r.coarse !== (pointer === 'coarse'))) {
    bad('H0', cell, `the page rendered under a ${r.coarse ? 'coarse' : 'fine'} pointer where this cell declares ${pointer} — `
      + 'the pointer emulation did not take, so nothing below is a measurement of this shape');
    return { counted: true };
  }
  if (!r.present || r.display === 'none') {
    // The row renders on BOTH layouts (styles/combat.css has a narrow rule for
    // it), so an absent row is an empty population everywhere: not a pass.
    bad('H0', cell, `no .combat-action-row rendered on the ${r.layout} layout — the population is EMPTY and `
      + 'an empty population is not a pass; every check below would have had nothing to compare');
    return { counted: true };
  }
  if (!r.cards.length) {
    bad('H0', cell, 'the row rendered but the hand did not — nothing to be below, so H1 cannot mean anything here');
    return { counted: true };
  }

  // H1 BELOW — no card lies on any CONTROL of the row. The row itself is a
  // full-width grid whose middle columns are empty gutters (`pointer-events:
  // none` on the row, `auto` on its children — styles/combat.css), so its
  // bounding box is not furniture: the outer fanned cards dip a few px into
  // that empty band by design at 1200x730 and touch nothing. What a player
  // must never see is a card drawn over the orb, a pile or END TURN, and that
  // is what is measured — per control, zero overlap, no gap constant.
  const lowest = Math.max(...r.cards.map((c) => c.bottom));
  const hits = [];
  r.cards.forEach((c, i) => r.chips.forEach((k) => { const o = overlap(k.box, c); if (o > 0) hits.push([i, k.text, o]); }));
  const intoRow = Math.max(0, lowest - r.strip.top);
  if (hits.length) {
    const worst = hits.reduce((a, b) => (b[2] > a[2] ? b : a));
    bad('H1', cell, `${new Set(hits.map(([i]) => i)).size} of ${r.cards.length} cards lie ON a control — worst card ${worst[0]} on `
      + `"${worst[1]}" ${worst[2].toFixed(1)} px2; lowest card bottom ${lowest} vs row top ${r.strip.top}`);
  } else {
    ok('H1', cell, `no card touches any of the ${r.chips.length} controls — lowest card bottom ${lowest}, row top ${r.strip.top}`
      + (intoRow > 0 ? ` (${intoRow.toFixed(2)} px into the row's empty gutter, touching nothing)` : `, clear by ${(r.strip.top - lowest).toFixed(2)} px`));
  }

  // H2 CLEAR — zero, not a budget.
  const touched = r.furniture.filter(([, b]) => b && overlap(r.strip, b) > 0);
  if (touched.length) {
    bad('H2', cell, `the row touches ${touched.length} piece(s) of furniture it must not: `
      + touched.map(([n, b]) => `${n} ${overlap(r.strip, b).toFixed(1)} px2 (${(100 * overlap(r.strip, b) / area(r.strip)).toFixed(1)}% of the row)`).join(' · '));
  } else {
    const seen = r.furniture.filter(([, b]) => b).length;
    ok('H2', cell, `the row touches none of the ${seen} furniture piece(s) measured (${r.furniture.filter(([, b]) => b).map(([n]) => n).join(', ')})`);
  }

  // H3 WHOLE — every declared control present and rendered, none clipped, the
  // key label inside its control, nothing overflowing. Containment is all four
  // edges: a child shifted up by a transform or a relative offset does not
  // grow the row's scroll box and would otherwise protrude into the battlefield
  // with H2 (which measures the row's box, not the child) still green.
  const inside = (c, box) => c.left >= box.left - 0.5 && c.right <= box.right + 0.5
    && c.top >= box.top - 0.5 && c.bottom <= box.bottom + 0.5;
  const outside = r.chips.filter((c) => !inside(c.box, r.strip));
  // THE KEY LABEL IS A FINE-POINTER PROMISE. Under a coarse pointer the
  // stylesheet withholds it on purpose (no key to press), so there the
  // assertion is the opposite: a drawn label is a coarse-pointer rule that
  // stopped applying. Under a fine pointer the label must be drawn, inside
  // END TURN, whole.
  const keyOut = !r.coarse && r.key && r.endTurn ? !(inside(r.key.box, r.endTurn) && inside(r.key.textBox, r.endTurn)) : false;
  const keyCut = !r.coarse && r.key ? r.key.textClipped : null;
  const paint = Array.isArray(r.paint) ? r.paint : [];
  const obscured = paint.filter((p) => p.own !== undefined && (p.own < PAINT_FLOOR || p.lost > PAINT_LOST || (p.textLost !== undefined && p.textLost > PAINT_LOST)));
  const textOf = (p) => (p.textLost !== undefined ? `, its text ${(p.textLost * 100).toFixed(0)}% lost` : '');
  const paintLine = paint.filter((p) => p.own !== undefined).map((p) => `${p.name} paints ${(p.own * 100).toFixed(0)}% of its box, ${(p.lost * 100).toFixed(0)}% lost${textOf(p)}${(p.covers && p.covers.length) ? ' (over it: ' + p.covers.join(', ') + ')' : ''}`).join('; ');
  const over = r.stripFlow.scrollW > r.stripFlow.clientW + 1 || r.stripFlow.scrollH > r.stripFlow.clientH + 1;
  // A control is matched by CONTAINING its declared classes (END TURN gains
  // `pulse` while it hints, the piles gain state classes), not by equality.
  const hasAll = (live, declared) => declared.split(/\s+/).every((k) => live.split(/\s+/).includes(k));
  const missing = EXPECTED_CONTROLS.filter((cls) => !r.chips.some((c) => hasAll(c.cls, cls)));
  if (!r.chips.length) {
    bad('H3', cell, 'the row rendered with ZERO controls — nothing was measured for clipping');
  } else if (missing.length) {
    bad('H3', cell, `${missing.length} of the ${EXPECTED_CONTROLS.length} declared controls did not render: `
      + missing.map((m) => `"${m}"`).join(', ')
      + (r.hiddenControls.length ? ` (not rendered: ${r.hiddenControls.map((m) => `"${m}"`).join(', ')})` : ' (absent from the row)'));
  } else if (!r.key) {
    bad('H3', cell, 'END TURN carries no key label (.et-key) — the label this gate measures the width of is gone');
  } else if (r.coarse && r.key.rendered) {
    bad('H3', cell, `END TURN draws its key label "${r.key.text}" under a COARSE pointer — styles/combat.css withholds it there `
      + '(no key to press on a thumb); the @media (pointer: coarse) rule stopped applying');
  } else if (!r.coarse && !r.key.rendered) {
    bad('H3', cell, `END TURN's key label "${r.key.text}" is not rendered (${r.key.why}) — the binding the row promises is invisible to the player`);
  } else if (!paint.length) {
    bad('H3', cell, 'no paint-coverage reading reached the judge — the probe that photographs each control did not run, so nothing says a control is not painted over');
  } else if (obscured.length) {
    bad('H3', cell, `${obscured.length} control(s) painted over — `
      + obscured.map((p) => `"${p.name}" paints ${(p.own * 100).toFixed(0)}% of its box against its background and ${(p.lost * 100).toFixed(0)}% of that paint does not reach the eye in situ${p.textLost !== undefined ? `, ${(p.textLost * 100).toFixed(0)}% of its text's paint does not` : ''} (drawn over it: ${(p.covers || []).join(', ') || 'nothing found by geometry'})`).join(', ')
      + ` (a control must paint at least ${PAINT_FLOOR * 100}% of its box and lose at most ${PAINT_LOST * 100}% of it, and of its text's paint; a layer over any part of the rail, pointer-events or not, or the control's own paint over its text, is measured here rather than by the hit-test)`);
  } else if (outside.length || keyOut || keyCut || over) {
    bad('H3', cell, `${outside.length} of ${r.chips.length} control(s) drawn outside the row`
      + (keyOut ? ` and END TURN's key label "${r.key.text}" is drawn outside END TURN (box ${JSON.stringify(r.key.box)}, text ${JSON.stringify(r.key.textBox)} vs ${JSON.stringify(r.endTurn)})` : '')
      + (keyCut ? ` and END TURN's key label "${r.key.text}" is cut off (its text: ${keyCut})` : '')
      + (over ? ` and the row overflows its own box (scroll ${r.stripFlow.scrollW}x${r.stripFlow.scrollH} vs client ${r.stripFlow.clientW}x${r.stripFlow.clientH})` : '')
      + (outside.length ? ` — first: "${outside[0].text}" at ${JSON.stringify(outside[0].box)}` : '')
      + ` [${wide ? 'WIDE rebound label' : 'shipped labels'}]`);
  } else {
    ok('H3', cell, `all ${EXPECTED_CONTROLS.length} declared controls rendered, whole and inside the row (${r.chips.map((c) => c.text).join(' / ')}), `
      + (r.coarse ? `key label "${r.key.text}" withheld under the coarse pointer (${r.key.why}) as the stylesheet promises`
        : `key label "${r.key.text}" inside END TURN`)
      + `; paint reaching the eye: ${paintLine}`
      + ` [${wide ? 'WIDE rebound label' : 'shipped labels'}]`);
  }

  // H5 ONSCREEN — and the height is real. WHEN THIS IS RED IT NAMES WHICH OF THE
  // TWO CAUSES IT IS, because they have different owners and different fixes: a
  // strip in the wrong place is mine, and a COLUMN that does not fit is the
  // Law 4 clause 4 rem-geometry debt and is not.
  const inView = r.strip.left >= -0.5 && r.strip.top >= -0.5 && r.strip.right <= r.vw + 0.5 && r.strip.bottom <= r.vh + 0.5;
  const colOver = Math.max(0, (r.column ? r.column.scrollH - r.column.clientH : 0));
  if (!inView && colOver > 0) {
    columnOverflows.push([cell, colOver]);
    // UNKNOWN, AND THE WORD IS CHOSEN. Not green: the strip really is off the
    // screen here and a player at Text XL does not see it. Not red either: the
    // cause is a column that does not fit, this tool has NOT distinguished the
    // strip's placement from that, and a red on somebody else's debt reads as a
    // verdict on this act. The house's own rule for a check that has not
    // distinguished its subject is `unknown`, and an unknown MAY NOT BE CITED AS
    // COVERAGE whatever it prints (Charter 2b clause 3).
    unk('H5', cell, `the row is off the viewport because THE WHOLE COLUMN does not fit: .combat overflows by `
      + `${colOver} px (scrollH ${r.column.scrollH} vs clientH ${r.column.clientH}) and the strip is its LAST row, so it is `
      + `the passenger, not the cause. Column parts: ${r.column.parts.map(([n, h]) => `${n} ${h}`).join(' + ')}. `
      + `NOT VERIFIED HERE, THEREFORE NOT COVERAGE. `
      + `⚠ PRE-EXISTING AND MEASURED: at dev db09846, before this act, .combat already overflowed 69 px at this `
      + `cell (Text XL 1200x730) and 6 px at Text M — the cards were clipped at the bottom of the screen with no `
      + `strip in the flow at all. This act removes the 6 px at Text M and inherits the 69. The driver is BOX `
      + `GEOMETRY IN TEXT UNITS: .hand-area height:23rem (230 -> 276 px) and .field's own min-content (328 -> 375.52), `
      + `i.e. Law 4 clause 4's named 400-of-548 debt, which no arrangement of a hint strip can pay. NOT this lane's `
      + `to fix and NOT painted green.`);
  } else if (!inView) {
    bad('H5', cell, `the row is not wholly inside the viewport and the column DOES fit — this one is the row's own `
      + `placement: ${JSON.stringify(r.strip)} vs ${r.vw.toFixed(2)}x${r.vh.toFixed(2)}`);
  } else if (!(r.strip.h > 0)) {
    bad('H5', cell, 'the row has no height, so it reserves nothing and "under the cards" is a coincidence');
  } else {
    ok('H5', cell, `inside the viewport, ${r.strip.h} px tall, position:${r.stripFlow.pos}, column overflow ${colOver} px`);
  }

  // H6 RESERVED — the lift hand.js publishes is actually reserved by the sheets.
  const lift = parseFloat(r.lift) || 0;
  const padTop = parseFloat(r.handBox.padTop) || 0;
  const clippedTop = r.cards.some((c) => c.top < r.hand.top - 0.5);
  const scrolls = r.handBox.scrollH > r.handBox.clientH + 1;
  if (lift > 0 && padTop + 0.5 < lift) {
    bad('H6', cell, `hand.js published ${r.lift} of fan lift and .hand reserves only ${r.handBox.padTop} of padding-top `
      + `— the ${FAN_LIFT_PROP} contract is not being read${clippedTop ? ', and a card is already above .hand' : ''}`);
  } else if (clippedTop || scrolls) {
    bad('H6', cell, `a card is drawn above .hand's own box (or the hand has gained vertical scroll: `
      + `${r.handBox.scrollH} vs ${r.handBox.clientH}) even though ${r.lift} is reserved as ${r.handBox.padTop}`);
  } else {
    ok('H6', cell, `${FAN_LIFT_PROP} = ${r.lift || '0px'} is reserved as padding-top ${r.handBox.padTop}; `
      + `no card above .hand, no vertical travel in the hand`);
  }
  return { counted: true };
}

async function main() {
  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')));
  const s = await serve({ root: ROOT, port: 8352, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`hintstrip — ${base} (root ${ROOT})`);
  console.log('DOOR: source tree over http in headless Chromium; every box divided back through --ui-zoom');
  console.log(`      into LOCAL px ONCE before comparison; text size set through the game's own settings`);
  console.log(`      door; the wide label written through the game's own rebind store, never into the DOM.`);
  console.log(`      ${FAN_LIFT_PROP} read out of src/ui/components/hand.js, not typed here.`);
  // BROWSER RESOLUTION THROUGH browser.mjs's SINGLE HOME, and an absent browser
  // is `unknown`, NOT a verdict.
  //
  // Both halves are required by the act that wired this tool into a gate list
  // (#295), and neither is a tidy-up. It used to read `process.env.CHROME ||
  // '/usr/bin/chromium'` — a second copy of the candidate list, one entry long.
  // On the runner this gate now lives on (ci.yml `browser-guard`, ubuntu-latest)
  // `/usr/bin/chromium` DOES NOT EXIST and `/usr/bin/google-chrome` does, so the
  // wired step would have thrown, exited 1, and reported "the hint strip is
  // broken" when the truth was "no browser was found". That is run 1 of this
  // workflow repeating itself one tool later — ci.yml's own `browser-guard`
  // header records it, and shotguard-probe's answer is the house rule: an
  // unavailable instrument resolves to exit 2 (`unknown`, which blocks), never
  // to a claim about the subject. This tool now does the same.
  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('hintstrip: UNKNOWN — no Chrome/Chromium found (tried $CHROME, $CHROME_PATH and the usual paths).');
    console.error('           Exit 2, not 1: nothing was measured, so this is not a verdict about the strip.');
    await s.close?.();
    process.exit(2);
  }
  console.log(`      browser: ${browserPath}`);
  // TEXT IS RASTERISED ONE WAY for the paint read: Chromium draws glyphs with
  // coloured subpixel (LCD) anti-aliasing on an opaque layer and grey on a
  // composited one, so hiding a layer over a control for the uncovered
  // captures changed the colour of its glyph edges — a fifth of a small
  // label's paint — with nothing painted over it. Grey everywhere.
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'hintstrip-', browser: browserPath, timeoutMs: 15000, args: ['--disable-lcd-text'],
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;

  // DECLARED POPULATION, so a cell that silently stops being reached is red.
  const expected = SHAPES.length * TEXTS.length + SHAPES.length; // + one WIDE cell per shape
  let reached = 0;

  for (const vp of SHAPES) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    // The pointer mode a device of this shape has, through the media-query
    // door the stylesheet reads (and touch on the phone, for the same reason).
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: vp.pointer === 'coarse' }, S);
    await cdp.send('Emulation.setEmulatedMedia', { features: [
      { name: 'pointer', value: vp.pointer }, { name: 'hover', value: vp.pointer === 'coarse' ? 'none' : 'hover' },
      { name: 'any-pointer', value: vp.pointer }, { name: 'any-hover', value: vp.pointer === 'coarse' ? 'none' : 'hover' },
    ] }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const shot = async (clip) => Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip }, S)).data, 'base64');
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };

    console.log(`\n  ${vp.tag}`);
    for (const text of TEXTS) {
      // Text size THROUGH THE GAME'S OWN DOOR: ?shotSettings is what the shot
      // harness uses, so the cascade is the shipped one.
      const q = `${base}?shot=combat&shotSettings=${encodeURIComponent(JSON.stringify({ textSize: text }))}`;
      await cdp.send('Page.navigate', { url: q }, S);
      await until(`!!document.querySelector('.combat')`, `combat ${vp.tag} ${text}`);
      await wait(700);
      const r = await ev(READ(FAN_LIFT_PROP));
      r.paint = await paintOf(ev, shot);
      reached++;
      judge(r, `${vp.tag} Text ${text}`, false, vp.pointer);
    }

    // H4 WIDER — THROUGH THE GAME'S OWN REBIND DOOR. `meta.settings.keyBindings`
    // is where the Controls tab writes and where main.js reads at boot
    // (src/main.js:615 -> setKeyBindings), and ?shotSettings is the harness's own
    // way into that store. So the label the strip prints is the label a player
    // who rebound End Turn would see, produced by keyLabel() off a real binding
    // and not written into the DOM by this tool.
    //
    // THE REBIND IS ASSERTED TO HAVE TAKEN before anything below is believed. A
    // rebind that silently did not land would make H4 a green about the SHIPPED
    // label wearing a different cell name — the same shape as a plant passing
    // because the test was bound to the helper instead of the control.
    const wq = `${base}?shot=combat&shotSettings=${encodeURIComponent(JSON.stringify({ keyBindings: { [WIDE_KEY.action]: WIDE_KEY.code } }))}`;
    await cdp.send('Page.navigate', { url: wq }, S);
    await until(`!!document.querySelector('.combat')`, `combat wide-label ${vp.tag}`);
    await wait(700);
    const rw = await ev(READ(FAN_LIFT_PROP));
    rw.paint = await paintOf(ev, shot);
    reached++;
    const took = !!(rw.key && rw.key.text.includes(WIDE_KEY.label));
    if (rw.present && rw.display !== 'none' && !took) {
      bad('H4', `${vp.tag} WIDE`, `the rebind to "${WIDE_KEY.label}" did NOT reach END TURN's key label — it reads `
        + `${JSON.stringify(rw.key ? rw.key.text : null)}. Nothing below is a measurement of a wider label, `
        + `so this cell asserts nothing about one.`);
    } else if (rw.present && rw.display !== 'none') {
      ok('H4', `${vp.tag} WIDE`, `the row is under a real rebind (${WIDE_KEY.action} -> ${WIDE_KEY.code}) — `
        + (rw.coarse ? `END TURN's key label carries "${rw.key.text}" (withheld from the eye under the coarse pointer, ${rw.key.why})`
          : `END TURN's key label "${rw.key.text}" is ${rw.key.box.w} px wide, END TURN ${rw.endTurn.w}x${rw.endTurn.h}, row ${rw.strip.w}x${rw.strip.h}`));
    }
    judge(rw, `${vp.tag} WIDE`, true, vp.pointer);
    await cdp.send('Target.closeTarget', { targetId });
  }

  // THE NUMBER OF CHECKS MADE IS ASSERTED, not only the cells reached: every
  // reached cell owes H1, H2, H3, H5 and H6 (H5 may resolve to unknown, which
  // blocks above), plus H4 once per WIDE cell. The count is taken HERE, before
  // the two H0 rows below add to it, so one silently omitted per-cell check
  // cannot hide behind an H0 row that was counted in its place.
  const cellChecks = checks;
  const owedChecks = expected * 5 + SHAPES.length;
  if (reached !== expected) {
    bad('H0', 'population', `${reached} of ${expected} declared cells were reached — a check that quietly measures `
      + 'fewer cells than it declares prints a confident green over a smaller world (my own B3 hole, watched here)');
  } else {
    ok('H0', 'population', `all ${expected} declared cells reached (${SHAPES.length} shapes x ${TEXTS.length} text sizes, plus one WIDE-label cell per shape)`);
  }
  if (cellChecks + unknowns < owedChecks) {
    bad('H0', 'checks', `${cellChecks} per-cell check(s) and ${unknowns} unknown(s) over ${expected} cells — ${owedChecks} were owed; `
      + 'a cell stopped being exercised without saying so');
  } else {
    ok('H0', 'checks', `${cellChecks} per-cell check(s) + ${unknowns} unknown(s) cover the ${owedChecks} owed (the two H0 rows are counted apart)`);
  }

  cdp.close(); await dropBrowser(); await s.close?.();

  console.log('');
  // ⚠ PRINTED EVERY RUN, GREEN OR RED, AND IT IS NOT AN EXCUSE — Law 5's own
  // lesson is that "reported, never asserted" is how a suite goes green over a
  // bug the day the design call it was waiting on gets made. So this carries its
  // REMOVAL CONDITION on its face: it becomes an ASSERTION the day .hand-area's
  // height leaves text units (Law 4 clause 4), or the day one run measures the
  // column fitting at every cell — whichever lands first. It is owed as a card
  // and I did not file one; this act was one act.
  if (columnOverflows.length) {
    console.log(`⚠ REPORTED, NOT ASSERTED — .combat does not fit the viewport in ${columnOverflows.length} cell(s): `
      + columnOverflows.map(([c, n]) => `${c} +${n} px`).join(' · '));
    console.log('  Baseline at dev db09846, BEFORE this act: +69 px at 1200x730 Text XL, +6 px at Text M.');
    console.log('  Driver: .hand-area height:23rem and .field min-content, both text-unit BOXES (Law 4 clause 4,');
    console.log('  the named 400-of-548 debt). A hint strip cannot pay it and this tool refuses to score it.');
    console.log('  BECOMES AN ASSERTION when .hand-area\'s height leaves text units, or when a run measures');
    console.log('  every cell fitting. A card is OWED for it and was not filed.');
    console.log('');
  }

  // AN `unknown` BLOCKS (#527 paid the card this tool used to print every run).
  // The old text is history worth one paragraph: H0 asserted the cells REACHED,
  // nothing asserted the number of checks MADE, so a regression that converted
  // greens to `unknown` — remove the `--action-row-drop` reservation and the
  // row goes off the viewport at every wide cell — shrank the denominator and
  // left `$?` at 0. That was stated rather than closed because closing it would
  // have painted Law 4 clause 4's column debt red. That debt is measured at zero
  // cells now, the narrow layout is measured instead of exempt, and verdict.mjs
  // already holds every other instrument to "unknown is never a pass". So: a
  // run with any `unknown` exits 2 after its findings are printed — a red is
  // still reported as red first — and an `unknown` is still not a finding,
  // because it is not a verdict about the row; it is a verdict about this tool.
  if (unknowns) {
    console.log(`⚠ ${unknowns} verdict(s) resolved to \`unknown\` this run. An unknown BLOCKS (exit 2) and is`);
    console.log('  never a pass: the cell was reached and the row was not distinguished from something');
    console.log('  else (a column that does not fit, above). It is not counted as a finding either, because');
    console.log('  it is not a verdict about the row.');
    console.log('');
  }
  // ── THE WAIVER ────────────────────────────────────────────────────────────
  // `--waive "<id>,<id>" --waive-card <n>` lands this gate in REPORTING mode for
  // findings that are already known and already carded. Every finding is still
  // measured, printed and named; what changes is only whether these exact ones
  // fail the job.
  //
  // ⚠ READ THIS BEFORE DECIDING IT IS THE THING ci.yml FORBIDS. That comment
  // forbids relaxing a check so a red goes away WHILE THE DEFECT STAYS. The
  // property that separates this from `|| true` is one line and it is machine-
  // checked in both directions:
  //
  //     A WAIVER FAILS WHEN ITS DEFECT DISAPPEARS.
  //
  // Waive a finding that is no longer there and this exits 1 and tells you to
  // delete the waiver. So the excuse CANNOT outlive the defect — which is
  // exactly how `axisfit`'s "reported, never asserted" went quiet over a live
  // bug (Law 5's enforcement note), and I wrote that one. `|| true` and
  // `continue-on-error` sever the verdict from the tree permanently and
  // silently; this stays welded to it, and the weld is what makes the carve-out
  // not a loophole.
  //
  // The four outcomes, and only the first is green:
  //   findings == waived           → 0, printed as WAIVED with its card
  //   a finding NOT waived         → 1, it is new and nobody has judged it
  //   a waived finding is GONE     → 1, DELETE THE WAIVER (the anti-decay edge)
  //   the instrument cannot run    → 2, unknown, unchanged and still blocking
  //
  // The waiver lives in the workflow step, beside the card number, so it appears
  // in the diff that introduces it and in the diff that removes it. It is not a
  // file, because a file is a second home for a fact with a two-week life.
  const waiveArg = (() => { const i = process.argv.indexOf('--waive'); return i >= 0 ? process.argv[i + 1] : null; })();
  const waiveCard = (() => { const i = process.argv.indexOf('--waive-card'); return i >= 0 ? process.argv[i + 1] : null; })();
  const waived = waiveArg ? waiveArg.split(',').map((x) => x.trim()).filter(Boolean) : [];

  if (waived.length) {
    const unwaived = findings.filter((f) => !waived.includes(f));
    const vanished = waived.filter((w) => !findings.includes(w));
    console.log('');
    console.log(`WAIVER: ${waived.length} known finding(s)${waiveCard ? `, carded as #${waiveCard}` : ' — NO CARD NAMED, which is a defect in the step, not in the strip'}`);
    for (const w of waived) console.log(`  waived   ${w}${findings.includes(w) ? '' : '   ← NOT PRESENT'}`);
    if (vanished.length) {
      console.log('');
      console.log(`hintstrip: WAIVER STALE — ${vanished.length} waived finding(s) are GONE: ${vanished.join(', ')}`);
      console.log('           The defect this step was allowed to report has been fixed. DELETE THE WAIVER from');
      console.log('           the workflow step and this gate goes blocking again. A waiver that outlives its');
      console.log('           defect is the silence this whole card exists to catch, so it fails rather than');
      console.log('           congratulating anyone.');
      process.exit(1);
    }
    if (unwaived.length) {
      console.log('');
      console.log(`hintstrip: ${unwaived.length} NEW finding(s) outside the waiver — ${unwaived.join(', ')}`);
      console.log('           These are not the known defect and nobody has judged them. BLOCKING.');
      process.exit(1);
    }
    console.log('');
    console.log(`hintstrip: REPORTING — ${findings.length} finding(s) over ${checks} check(s), all waived under #${waiveCard || '?'}`);
    console.log(`           ${findings.join(', ')}`);
    console.log('           THE DEFECT IS REAL AND IS NOT FIXED. This step is not blocking because the finding');
    console.log('           is known and carded, and it will start blocking again the moment the finding');
    console.log('           changes in either direction — a new one appears, or this one is fixed.');
    console.log('BOUNDARY: measured on the SOURCE tree at two shapes and three text sizes. It has not seen a');
    console.log('          gamepad, the co-op board, or the map strip, and it is silent about whether any control');
    console.log('          DOES anything when pressed — that is the row\'s interactivity, not its layout.');
    if (unknowns) { console.log(`hintstrip: UNKNOWN — ${unknowns} cell(s) could not be judged; exit 2, not a pass`); process.exit(2); }
    process.exit(0);
  }

  if (findings.length) {
    console.log(`hintstrip: ${findings.length} finding(s) over ${checks} check(s) — ${findings.join(', ')}`);
    console.log('BOUNDARY: measured on the SOURCE tree at two shapes and three text sizes. It has not seen a');
    console.log('          gamepad, the co-op board, or the map strip, and it is silent about whether any control');
    console.log('          DOES anything when pressed — that is the row\'s interactivity, not its layout.');
    process.exit(1);
  }
  if (unknowns) {
    console.log(`hintstrip: UNKNOWN — ${unknowns} cell(s) could not be judged over ${checks} check(s); exit 2, not a pass`);
    process.exit(2);
  }
  console.log(`hintstrip: OK — ${checks} checks passed`);
  console.log('BOUNDARY, and it is narrower than a green looks: measured on the SOURCE tree, two shapes x three');
  console.log('          text sizes plus a rebound-wide-label cell per shape, on BOTH layouts. NOT measured: a real');
  console.log('          gamepad (pad glyphs go through padLabel and were not driven), the co-op board, the map');
  console.log('          strip, and whether any control DOES anything when pressed — the row\'s interactivity is');
  console.log('          not this tool\'s subject. The retired combat hint strip is measured only as furniture the');
  console.log('          row must not touch; while it is display:none it has no box and is skipped.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
