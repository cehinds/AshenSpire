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
import { readFileSync } from 'node:fs';
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
          find: '  box-sizing: border-box; width: var(--action-end-size); max-width: 100%; min-width: 0;',
          replace: '  box-sizing: border-box; width: 4rem; max-width: 4rem; min-width: 0; overflow: hidden; white-space: nowrap;',
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
          find: '.combat-action-row > .pile.draw { grid-area: draw; }',
          replace: '.combat-action-row > .pile.draw { grid-area: draw; display: none; }',
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
          find: '.combat-action-row > .pile.discard { grid-area: discard; }',
          replace: '.combat-action-row > .pile.discard { grid-area: discard; visibility: hidden; }',
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
          find: '.combat-action-row > .pile.discard { grid-area: discard; }',
          replace: '.combat-action-row > .pile.discard { grid-area: discard; opacity: 0; }',
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
          file: 'styles/combat.css',
          find: '  .combat .et-key,\n  .combat .flask-key,',
          replace: '  .combat .flask-key,',
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
          file: 'styles/combat.css',
          find: '.end-turn .et-key {\n  display: block; width: max-content;',
          replace: '.end-turn .et-key {\n  visibility: hidden; display: block; width: max-content;',
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
          find: '<div class="combat-action-row" ${uiComponentAttrs(UI.combatActionRail)}',
          replace: '<div class="combat-action-row-planted-away" ${uiComponentAttrs(UI.combatActionRail)}',
        }],
        expectRed: /BAD\s+H0 /,
      },
    ],
  };
  const selftestCode = await doorSelftest(SELFTEST);
  // THE COUNT IS THE CORPUS'S, not a literal: a literal said 8 over nine plants.
  if (selftestCode === 0) console.log(`hintstrip-selftest: OK — ${SELFTEST.plants.length} plant(s) CAUGHT by their own red, clean copy green`);
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

// THE ROW'S CONTROLS ARE DECLARED, not discovered: the five persistent combat
// action destinations combat.js's template puts in the row (orb, DRAW, END
// TURN, DISCARD, EXHAUSTED). H3 asserts every one of them is present AND
// rendered, so a stylesheet that hides a pile does not shrink the population
// into a smaller green — the same B3 hole H0 watches for cells, watched here
// for controls. Read out of the template rather than typed: a control added
// to or removed from the row changes this list in the same commit.
const EXPECTED_CONTROLS = (() => {
  const src = readFileSync(join(ROOT, 'src/ui/screens/combat.js'), 'utf8');
  // The row is found by its class PREFIX so the H0 plant (which renames the
  // class to make the row vanish) still parses: that plant must reach H0's
  // empty-population red, not a thrown "could not read the template".
  const row = src.match(/<div class="combat-action-row[^"]*"[\s\S]*?<\/div>\s*<!-- Context hints/);
  if (!row) throw new Error('hintstrip: could not read the action row out of src/ui/screens/combat.js');
  const classes = [...row[0].matchAll(/<(?:div|button) class="([^"]+)"/g)].map((m) => m[1])
    .filter((cls) => cls !== 'combat-action-row');
  if (classes.length < 2) throw new Error('hintstrip: the action row template names fewer than two controls');
  return classes;
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
  const L = (el) => { const r = el.getBoundingClientRect();
    return { left: +(r.left/z).toFixed(2), top: +(r.top/z).toFixed(2), right: +(r.right/z).toFixed(2),
             bottom: +(r.bottom/z).toFixed(2), w: +(r.width/z).toFixed(2), h: +(r.height/z).toFixed(2) }; };
  // A furniture box counts only when the element renders: a display:none
  // element has an empty rect at 0,0 and would otherwise overlap nothing or
  // everything by accident.
  const one = (s) => { const el = document.querySelector(s); if (!el) return null;
    if (getComputedStyle(el).display === 'none') return null; return L(el); };
  // Effective opacity walks the ancestors: opacity:0 on the control or on any
  // box above it leaves display, visibility and geometry intact and the
  // player sees nothing — the third way a control goes quiet.
  const clear = (c) => { for (let n = c; n && n !== document.documentElement; n = n.parentElement) if (getComputedStyle(n).opacity === '0') return false; return true; };
  const hiddenWhy = (c) => { const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
    return cs.display === 'none' ? 'display:none' : cs.visibility !== 'visible' ? 'visibility:' + cs.visibility
      : !clear(c) ? 'opacity:0' : !(r.width > 0 && r.height > 0) ? 'no box' : 'rendered'; };
  const rendered = (c) => hiddenWhy(c) === 'rendered';
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
    key: key ? { text: key.textContent.trim(), box: L(key), rendered: rendered(key), why: hiddenWhy(key) } : null,
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
  const keyOut = !r.coarse && r.key && r.endTurn ? !inside(r.key.box, r.endTurn) : false;
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
  } else if (outside.length || keyOut || over) {
    bad('H3', cell, `${outside.length} of ${r.chips.length} control(s) drawn outside the row`
      + (keyOut ? ` and END TURN's key label "${r.key.text}" is drawn outside END TURN (${JSON.stringify(r.key.box)} vs ${JSON.stringify(r.endTurn)})` : '')
      + (over ? ` and the row overflows its own box (scroll ${r.stripFlow.scrollW}x${r.stripFlow.scrollH} vs client ${r.stripFlow.clientW}x${r.stripFlow.clientH})` : '')
      + (outside.length ? ` — first: "${outside[0].text}" at ${JSON.stringify(outside[0].box)}` : '')
      + ` [${wide ? 'WIDE rebound label' : 'shipped labels'}]`);
  } else {
    ok('H3', cell, `all ${EXPECTED_CONTROLS.length} declared controls rendered, whole and inside the row (${r.chips.map((c) => c.text).join(' / ')}), `
      + (r.coarse ? `key label "${r.key.text}" withheld under the coarse pointer (${r.key.why}) as the stylesheet promises`
        : `key label "${r.key.text}" inside END TURN`)
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
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'hintstrip-', browser: browserPath, timeoutMs: 15000,
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
