#!/usr/bin/env node
// tools/hintstrip.mjs — THE CONTROL-HINT STRIP SITS UNDER THE CARDS, WHOLE, AND
// STAYS THERE WHEN A LABEL GETS WIDER. The rendered check on combat's hint bar.
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
// WHAT IT CHECKS, per shape, per text size:
//   H1 BELOW      every card's rendered box is entirely ABOVE the strip's top.
//                 Stated as containment, not as a gap: a number the strip could
//                 be nudged by is a number the next hand change re-tunes.
//   H2 CLEAR      the strip touches NO other combat furniture — the topbar, END
//                 TURN, the energy orb, the DRAW/DISCARD piles. This is the check
//                 that was red before the fix (topbar, 100%), and it is the one
//                 that stops "fixed the cards" from meaning "sat on something
//                 else". The count is ZERO, not a budget.
//   H3 WHOLE      no chip is clipped and nothing overflows: every `.hint` box is
//                 inside the strip's box, and the strip's scrollWidth/Height do
//                 not exceed its client box. The base rule is `white-space:
//                 nowrap; overflow: hidden`, so a chip wider than the strip used
//                 to disappear SILENTLY.
//   H4 WIDER      H1-H3 again with a REBOUND WIDE LABEL. This is the seam with
//                 Sten's lane (item 1(b) — the chips derive their labels from the
//                 live binding and the active device, so their WIDTH is his to
//                 change and my layout has to survive it). The label is written
//                 through the game's own rebind door — localStorage keybinds,
//                 read by input.js keyLabel() — never by poking the DOM, so what
//                 is measured is a layout under a real binding.
//   H5 ONSCREEN   the strip is inside the viewport on every axis, and its own
//                 height is REAL: a strip that reserves nothing is how "at the
//                 bottom" becomes "over whatever is at the bottom".
//
// AND ONE THING IT REPORTS AND REFUSES TO ASSERT, because it is a design call
// somebody already made and not this tool's to re-decide: on the NARROW layout
// the strip is `display: none` (styles/ui.css, EldenSpire#29 slice 0 — keys for
// hardware a phone does not have). So "under the cards" has NO narrow answer at
// all, and every H-check below is `unknown` there rather than green. It is
// printed as a STATE with its reason, and it counts toward nothing. ⚠ THAT
// BECOMES A LIVE QUESTION THE MOMENT STEN'S HALF LANDS: chips that are BUTTONS
// are useful to a thumb, and the rule that hides them was written when they were
// only key names. Not resolved here — named, and it belongs to whoever owns the
// strip's interactivity.
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
  process.exit(await doorSelftest({
    tool: 'hintstrip.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // THE PILL GOES BACK ON THE TOPBAR — the state he complained about, and
        // the one H2 exists for. H1 is GREEN under this plant (the cards are
        // nowhere near the topbar), which is exactly why H1 alone is not enough.
        name: 'the strip is pinned back over the topbar, where he found it',
        edits: [{
          file: 'styles/ui.css',
          find: '  position: static; top: auto; bottom: auto; transform: none;',
          replace: '  position: fixed; top: 5.8rem; bottom: auto; transform: translateX(-50%);',
        }],
        expectRed: /BAD\s+H2 /,
      },
      {
        // THE CARDS ARE ON THE STRIP. Same defect class as before — "at the
        // bottom" satisfied while "not overlapped" is not, caught by H1 — but
        // AIMED AT A DIFFERENT RULE, and the move is recorded rather than
        // silently re-pointed.
        //
        // ⚠ THIS PLANT'S PREMISE MOVED WHEN #295's LAYOUT HALF LANDED, AND THE
        // HARNESS SAID SO BEFORE I DID. It used to pin the strip to the viewport
        // bottom so it reserved no height and the hand did not move. The strip no
        // longer reserves that band at all — `--action-row-drop` does — so the
        // old edit stopped producing H1 and produced H2 instead: the harness
        // returned RED-FOR-WRONG-REASON, which is not a catch (SOP 14 §3). A red
        // for the wrong reason would have read as a pass to anyone counting
        // colours.
        //
        // What now decides whether a card lands on the strip is the strip's own
        // block padding: with it, the strip is the tallest item in a
        // bottom-anchored row and the row grows UPWARD into the hand. That is
        // the live causal path, so that is where the plant points. 93.2 px2 of
        // card on the strip at Text S.
        name: 'the strip pads itself back into a pill and the row grows up into the hand, so a card lies on it',
        edits: [{
          file: 'styles/combat.css',
          find: '  margin: 0; max-width: 100%; padding-block: 0;',
          replace: '  margin: 0; max-width: 100%;',
        }],
        expectRed: /BAD\s+H1 /,
      },
      {
        // THE FAN GOES BACK TO PUSHING ITS OUTER CARDS DOWN. The exact
        // expression that shipped, restored. 5.65 px of card onto the strip.
        name: 'the fan hangs downward from its centre again and the outer cards reach past the hand',
        edits: [{
          file: 'src/ui/components/hand.js',
          find: 'translateY(${(Math.abs(i - mid) - mid) * 6}px)',
          replace: 'translateY(${Math.abs(i - mid) * 6}px)',
        }],
        expectRed: /BAD\s+H1 /,
      },
      {
        // THE SILENT CLIP COMES BACK. nowrap + overflow:hidden, which is how a
        // label wider than `E` used to vanish without a mark. H3 catches it
        // ONLY under the wide label, which is why H4 is not a courtesy.
        //
        // ⚠ RE-AIMED FOR THE SAME REASON AS THE PLANT ABOVE, and it went UNCAUGHT
        // first — the harness's word, not a guess. It used to edit ui.css's
        // `.hint-bar.hint-combat`. #295's layout half added
        // `.combat-action-row > .hint-bar.hint-combat`, which is one class more
        // specific and re-declares `max-width`, so the planted narrow width was
        // simply overridden and nothing clipped. The plant still armed, still
        // ran, and tested a causal path the code no longer had.
        //
        // THIS IS MY OWN #314 LESSON ARRIVING A SECOND TIME, FROM THE OTHER SIDE:
        // there I blinded a plant by adding a BRANCH around the line it watched;
        // here I blinded one by adding a more specific RULE over the declaration
        // it watched. Both are ways to make a check stop being exercised without
        // touching the check. It does not fail — it goes quiet.
        name: 'the strip clips instead of wrapping, so a wide rebound label disappears',
        edits: [{
          file: 'styles/combat.css',
          find: '  margin: 0; max-width: 100%; padding-block: 0;',
          replace: '  margin: 0; max-width: 20rem; padding-block: 0; flex-wrap: nowrap !important; white-space: nowrap !important; overflow: hidden !important;',
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
        // A DECLARED CELL STOPS BEING REACHED. My own B3 hole, aimed at this
        // tool: the strip never renders, and every H-check has nothing to
        // measure. A green here would be the same confident nothing.
        name: 'the strip stops rendering and no H check may green on the empty population',
        edits: [{
          file: 'src/ui/components/hints.js',
          find: "  return `<div class=\"hint-bar hint-${context}",
          replace: "  return `<div class=\"hint-bar-planted-away hint-${context}",
        }],
        expectRed: /BAD\s+H0 /,
      },
    ],
  }));
}

const SHAPES = [
  { tag: '390x844', w: 390, h: 844, d: 2, mobile: true },
  { tag: '1200x730', w: 1200, h: 730, d: 1, mobile: false },
];

// Text sizes walked through the game's own settings door. Law 4's subject: the
// strip is chrome, the labels are glyphs, and the fan's 6 px step answers
// NEITHER control — so S and XL are where a box sized in text units bites.
const TEXTS = ['S', 'M', 'XL'];

// The wide label for H4. Nine characters against `E`'s one, and it is a real
// key name a player can actually bind, not a stress string.
const WIDE_KEY = { action: 'endTurn', code: 'Backspace', label: 'Backspace' };

// The furniture the strip may not touch. Named, so a fix that moves the strip
// onto something else is red instead of quiet.
const FURNITURE = [
  ['topbar', '.combat .topbar'],
  ['END TURN', '.combat .end-turn'],
  ['energy orb', '.combat .energy-orb'],
  ['DRAW pile', '.combat .pile.draw'],
  ['DISCARD pile', '.combat .pile.discard'],
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
  const one = (s) => { const el = document.querySelector(s); return el ? L(el) : null; };
  const strip = document.querySelector('.hint-bar.hint-combat');
  const hand = document.querySelector('.hand');
  return {
    layout: document.documentElement.dataset.layout || null,
    vw: window.innerWidth / z, vh: window.innerHeight / z,
    present: !!strip,
    display: strip ? getComputedStyle(strip).display : null,
    strip: strip ? L(strip) : null,
    stripFlow: strip ? { pos: getComputedStyle(strip).position, overflow: getComputedStyle(strip).overflow,
      scrollW: strip.scrollWidth, clientW: strip.clientWidth, scrollH: strip.scrollHeight, clientH: strip.clientHeight } : null,
    chips: strip ? [...strip.querySelectorAll('.hint')].map((c) => ({ text: c.textContent.trim(), box: L(c) })) : [],
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
function judge(r, cell, wide) {
  if (!r.present || r.display === 'none') {
    // NOT A PASS AND NOT A FAILURE — a state, with its reason, counting nothing.
    if (r.layout === 'narrow') {
      unk('H*', cell, 'the strip is display:none on the narrow layout (styles/ui.css, #29 slice 0 — '
        + 'keys for hardware a phone has not got). "Under the cards" has NO narrow answer, so nothing '
        + 'here is measured. ⚠ this becomes a real question the moment the chips are buttons.');
      return { counted: false };
    }
    bad('H0', cell, `no .hint-bar.hint-combat rendered on a ${r.layout} layout — the population is EMPTY and `
      + 'an empty population is not a pass; every check below would have had nothing to compare');
    return { counted: true };
  }
  if (!r.cards.length) {
    bad('H0', cell, 'the strip rendered but the hand did not — nothing to be below, so H1 cannot mean anything here');
    return { counted: true };
  }

  // H1 BELOW — containment, no gap constant.
  const on = r.cards.map((c, i) => [i, overlap(r.strip, c)]).filter(([, o]) => o > 0);
  const lowest = Math.max(...r.cards.map((c) => c.bottom));
  if (on.length) {
    const worst = Math.max(...on.map(([, o]) => o));
    bad('H1', cell, `${on.length} of ${r.cards.length} cards lie ON the strip — worst ${worst.toFixed(1)} px2, `
      + `${(100 * worst / area(r.strip)).toFixed(1)}% of the strip; lowest card bottom ${lowest} vs strip top ${r.strip.top}`);
  } else {
    ok('H1', cell, `all ${r.cards.length} cards are above the strip — lowest card bottom ${lowest}, `
      + `strip top ${r.strip.top}, clear by ${(r.strip.top - lowest).toFixed(2)} px`);
  }

  // H2 CLEAR — zero, not a budget.
  const touched = r.furniture.filter(([, b]) => b && overlap(r.strip, b) > 0);
  if (touched.length) {
    bad('H2', cell, `the strip touches ${touched.length} control(s) it must not: `
      + touched.map(([n, b]) => `${n} ${overlap(r.strip, b).toFixed(1)} px2 (${(100 * overlap(r.strip, b) / area(r.strip)).toFixed(1)}% of the strip)`).join(' · '));
  } else {
    const seen = r.furniture.filter(([, b]) => b).length;
    ok('H2', cell, `the strip touches none of the ${seen} combat controls measured (${r.furniture.filter(([, b]) => b).map(([n]) => n).join(', ')})`);
  }

  // H3 WHOLE — no chip clipped, nothing overflowing.
  const outside = r.chips.filter((c) => c.box.left < r.strip.left - 0.5 || c.box.right > r.strip.right + 0.5
    || c.box.top < r.strip.top - 0.5 || c.box.bottom > r.strip.bottom + 0.5);
  const over = r.stripFlow.scrollW > r.stripFlow.clientW + 1 || r.stripFlow.scrollH > r.stripFlow.clientH + 1;
  if (!r.chips.length) {
    bad('H3', cell, 'the strip rendered with ZERO chips — nothing was measured for clipping');
  } else if (outside.length || over) {
    bad('H3', cell, `${outside.length} of ${r.chips.length} chip(s) drawn outside the strip`
      + (over ? ` and the strip overflows its own box (scroll ${r.stripFlow.scrollW}x${r.stripFlow.scrollH} vs client ${r.stripFlow.clientW}x${r.stripFlow.clientH})` : '')
      + (outside.length ? ` — first: "${outside[0].text}" at ${JSON.stringify(outside[0].box)}` : '')
      + ` [${wide ? 'WIDE rebound label' : 'shipped labels'}]`);
  } else {
    ok('H3', cell, `all ${r.chips.length} chips whole and inside the strip (${r.chips.map((c) => c.text).join(' / ')}) `
      + `[${wide ? 'WIDE rebound label' : 'shipped labels'}]`);
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
    unk('H5', cell, `the strip is off the viewport because THE WHOLE COLUMN does not fit: .combat overflows by `
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
    bad('H5', cell, `the strip is not wholly inside the viewport and the column DOES fit — this one is the strip's own `
      + `placement: ${JSON.stringify(r.strip)} vs ${r.vw.toFixed(2)}x${r.vh.toFixed(2)}`);
  } else if (!(r.strip.h > 0)) {
    bad('H5', cell, 'the strip has no height, so it reserves nothing and "under the cards" is a coincidence');
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
      + `no card above .hand, no vertical travel in the strip`);
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
      judge(r, `${vp.tag} Text ${text}`, false);
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
    const took = rw.chips.some((c) => c.text.includes(WIDE_KEY.label));
    if (rw.present && rw.display !== 'none' && !took) {
      bad('H4', `${vp.tag} WIDE`, `the rebind to "${WIDE_KEY.label}" did NOT reach the strip — chips read `
        + `${JSON.stringify(rw.chips.map((c) => c.text))}. Nothing below is a measurement of a wider label, `
        + `so this cell asserts nothing about one.`);
    } else if (rw.present && rw.display !== 'none') {
      const w0 = rw.chips[0] ? rw.chips[0].box.w : 0;
      ok('H4', `${vp.tag} WIDE`, `the strip is under a real rebind (${WIDE_KEY.action} -> ${WIDE_KEY.code}) — `
        + `chips ${JSON.stringify(rw.chips.map((c) => c.text))}, first chip ${w0} px wide, strip ${rw.strip.w}x${rw.strip.h}`);
    }
    judge(rw, `${vp.tag} WIDE`, true);
    await cdp.send('Target.closeTarget', { targetId });
  }

  if (reached !== expected) {
    bad('H0', 'population', `${reached} of ${expected} declared cells were reached — a check that quietly measures `
      + 'fewer cells than it declares prints a confident green over a smaller world (my own B3 hole, watched here)');
  } else {
    ok('H0', 'population', `all ${expected} declared cells reached (${SHAPES.length} shapes x ${TEXTS.length} text sizes, plus one WIDE-label cell per shape)`);
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

  // ⚠ WHAT THE EXIT STATUS ITSELF REFUSES TO CLAIM. UNCONDITIONAL, green or
  // red, on the same ground as everything else this tool prints unprompted: a
  // narrowed claim that is only narrow in a PR body is a general claim in
  // practice (Marina, D104, applied to myself here rather than waiting to be
  // told twice).
  //
  // FOUND BY MY OWN PLANT, AND REPRODUCED BY VIKI NON-AUTHOR. Remove the
  // `--action-row-drop` reservation and the strip goes off the viewport at all
  // four wide cells; H5 degrades from `ok` to `unknown`; the check count falls
  // 22 -> 18; and THIS TOOL PRINTS `OK` AND EXITS 0. H0 asserts the cells it
  // REACHED, which is still 8 of 8 — nothing asserts the number of checks
  // actually MADE, so four assertions can become four non-assertions with no
  // effect on `$?`. A regression that converts greens to unknowns is invisible
  // to anyone reading the exit code, which is what a gate list reads.
  //
  // NOT CLOSED HERE, AND THE REASON IS A REAL CONFLICT RATHER THAN BUDGET. The
  // obvious fix — a floor on `checks`, or making `unknown` block the way the
  // no-browser path already does (exit 2) — would turn this gate RED on Law 4
  // clause 4's pre-existing column debt, which is exactly what H5's `unknown`
  // branch was built to refuse to score, and which is not this lane's to pay.
  // Choosing between "an unknown blocks" and "an unknown is not this tool's
  // verdict" is a design call with an owner, not a tidy-up. Stated instead, so
  // the number is in front of a reader every run.
  console.log(`⚠ ${unknowns} verdict(s) resolved to \`unknown\` this run and are counted in NEITHER`);
  console.log(`  \`${checks} check(s)\` NOR the findings — so a cell that DEGRADES from a green to an`);
  console.log('  `unknown` shrinks this tool\'s denominator and leaves its EXIT STATUS UNCHANGED.');
  console.log('  4 of them are the narrow layout, where the strip does not render and nothing is');
  console.log('  measurable by design. THE REST ARE NOT BY DESIGN. A check that stops being');
  console.log('  EXERCISED does not fail — it goes quiet, and this tool cannot presently say so.');
  console.log('  A card is OWED: does an `unknown` block, or is it not this tool\'s verdict?');
  console.log('');
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
    console.log('          gamepad, the co-op board, or the map strip, and it is silent about whether any chip');
    console.log('          DOES anything when pressed — that is the strip\'s interactivity, not its layout.');
    process.exit(0);
  }

  if (findings.length) {
    console.log(`hintstrip: ${findings.length} finding(s) over ${checks} check(s) — ${findings.join(', ')}`);
    console.log('BOUNDARY: measured on the SOURCE tree at two shapes and three text sizes. It has not seen a');
    console.log('          gamepad, the co-op board, or the map strip, and it is silent about whether any chip');
    console.log('          DOES anything when pressed — that is the strip\'s interactivity, not its layout.');
    process.exit(1);
  }
  console.log(`hintstrip: OK — ${checks} check(s), 0 findings.`);
  console.log('BOUNDARY, and it is narrower than a green looks: measured on the SOURCE tree, two shapes x three');
  console.log('          text sizes plus a rebound-wide-label cell per shape. NOT measured: a real gamepad (pad');
  console.log('          glyphs go through padLabel and were not driven), the co-op board, the map strip, the');
  console.log('          targeting chip swap, and whether any chip DOES anything when pressed — the strip is');
  console.log('          still aria-hidden and pointer-events:none, and its interactivity is not this tool\'s');
  console.log('          subject. On the NARROW layout the strip does not render at all and every check above');
  console.log('          is `unknown` there, printed as a state and counted as nothing.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
