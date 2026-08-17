// tools/placement.mjs — ANCHORED PLACEMENT HAS ONE HOME, AND THE GAP HAS ONE
// HOME TOO. The check on src/ui/fx.js placeAnchored(), measured on the real
// screens through the real gestures.
//
// WHY IT EXISTS. Until 2026-08-17 "put this element next to that one" was
// written out twice — tooltip.js place() and quicknav.js position() — with a
// private gap constant in each (`pad = 14`, `gap = 6`). Two homes for one length
// and two homes for one shape, so a placement fix had two files to land in and
// landed in neither. Sunna refused to collapse them twice and was right both
// times; the second of her reasons is the one this tool exists to keep honest:
// A SHARED PLACEMENT FUNCTION THAT HARD-CODES A GAP RE-COMMITS THE SECOND-COPY
// DEFECT AT THE MOMENT IT CLAIMS TO REMOVE ONE (Law 0 clause 4). The gap now
// lives in CSS as `--place-gap` on the placed element, and this tool measures
// the RENDERED distance against the DECLARED one. If the code ever grows its own
// copy again, the two disagree here and this goes red.
//
// WHAT IT CHECKS, per shape, on the real boot:
//   P1 DECLARED   every placed surface declares --place-gap, and it is > 0.
//                 A missing declaration resolves to 0 in placeAnchored (Law 0
//                 clause 5: fail visible, never plausible) — the panel welds
//                 itself to its anchor. That is a defect and this names it,
//                 rather than P2 passing because both sides agree on nothing.
//   P2 ONE HOME   the distance the browser actually rendered, on whichever axis
//                 separates the two boxes, equals the number the stylesheet
//                 declares. THIS IS THE LAW 0 CHECK. Tolerance 0.5 local px, and
//                 that is a float-noise tolerance, NOT a verdict threshold —
//                 see the neighbourhood note below.
//   P3 CLEAR      a tooltip does not sit on its anchor's SIBLINGS. `beside` was
//                 true and not enough: a hand card is one of five in a row, so
//                 "right of it" is on the next card. Measured before the fix, on
//                 ?shot=combat with a completed hold: 2 of 5 cards touched at
//                 390x844 (52.4% of one) and 3 of 5 at 1200x730, where the worst
//                 hold buried two at 96.2% and 71.0%.
//   P4 UNDER      the quick-nav panel's top is at or below its button's bottom,
//                 and its right edge is on the button's. That is the OTHER
//                 intent — `under`, not `beside` — and the reason the intent is
//                 named by the caller instead of guessed from the geometry.
//   P5 FLASK      the flask action menu opens under the SLOT THE PLAYER TAPPED,
//                 and its box touches none of the combat furniture a thumb aims
//                 at — the DRAW and DISCARD piles, END TURN, the hand cards, the
//                 sibling flask slots, the topbar buttons. Asserted twice: as it
//                 first opens, and again with Inspect expanded, because the
//                 description un-hides INSIDE the panel and placement is a
//                 one-shot. Before (b968e28, measured through this same door):
//                 1200x730 the menu (0,689)-(1200,730) — 567 local px below its
//                 own slot, DRAW and DISCARD 72.5% buried each; 390x844
//                 (0,897.8)-(433.3,937.8) — 726.9 px below its slot, piles 66.7%
//                 and 66.5%, the Inspect row's right 39% under the DRAW pile so
//                 a tap there opened the draw modal. THE COUNT IS ZERO, NOT A
//                 BUDGET: it is a count of touched controls, not a threshold.
//
// THE DOOR, AND IT IS NARROWER THAN THIS HEADER CLAIMED UNTIL 2026-08-17. Every
// number is read off a real boot: served over http, loaded in headless Chromium,
// `getBoundingClientRect` converted to local px once (fx.js's rule) before
// anything is compared. The declared gap is read with
// `getComputedStyle(el).getPropertyValue(PLACE_GAP_PROP)` — the same call
// placeAnchored makes, off the same cascade, and the property NAME is read out
// of src/ui/fx.js rather than typed here (see PROP below). `--selftest` plants
// its known-bads as file bytes in a copied real tree (tools/doorplant.mjs) and
// runs this whole tool from the copy.
//
// WHAT THE GESTURE ACTUALLY IS. This header said "the real hover / the real
// click" and that was wider than its predicate (Bjorn, gating d705b66). The
// hover is `el.dispatchEvent(new PointerEvent('pointerenter'))` and the open is
// `button.click()` — SYNTHESIZED DOM EVENTS dispatched inside the page, not CDP
// `Input.dispatchMouseEvent`. Placement is computed from the element's own rect
// either way, so every geometry number below is sound. What this door CANNOT
// see is REACHABILITY: a control covered by another element, scrolled out of the
// hit-test, or behind a full-screen layer answers a dispatched pointerenter
// exactly as a reachable one does. A green P3 is a claim about where the tooltip
// LANDS, never about whether a thumb can summon it. Reachability has its own
// tools — actionreach.mjs, screenreach.mjs — and this one points at them rather
// than implying it covered them.
//
// THE NEIGHBOURHOOD, stated because the Gate asks (CHARTER 2b). P2's 0.5 is not
// a verdict threshold — it separates float noise from a real disagreement, and
// nothing about the design sits near it. It is still given a cell either side by
// the same door: plant A moves the stylesheet by ONE local px while the code
// keeps its own copy (measured 14, declared 15 → 1.0, red) and the clean run
// measures ~0.0 (green). One step of the check's own unit flips the verdict, and
// both cells arrive as a CSS edit in a copied tree. P1, P3, P4 and P5 are not
// thresholds at all: P1 is "declared or not", P3 and P5's collision half are
// counts that must be zero, P4 and P5's under half are sign tests. P5 adds no
// new number to this file — it reuses P2's tolerance through gapChecks.
//
// BOUNDARIES, and they are real.
//   · THREE SURFACES, NOT EVERY PLACED THING — and this bullet said TWO until
//     2026-08-17, when the flask menu became placeAnchored's third caller. The
//     tooltip, the quick-nav panel and the flask action menu are its callers
//     today; all three are measured here. tutorial.js still places its own bubble
//     in the veil's local space with its own clamp, and main.js's ?shot=fx points
//     are a third hand-rolled site. Neither is measured here and neither is
//     converted — `unknown`, named rather than implied.
//   · AND THE FLASK MENU HAS A MOUNT SITE THIS TOOL CANNOT REACH. flask.js is
//     mounted from combat.js, map.js and coop.js. `?shot=combat` is what P5
//     drives; `?shot=map` renders no `.mh-flask` at either shape, so the MAP
//     surface is unphotographed — `unknown`. Co-op was measured by hand
//     (`?shot=coop`, last slot, both shapes: under, on screen, left-aligned) and
//     is not in P5, because a by-hand receipt is not coverage.
//   · P3 IS THE HAND AND NOTHING ELSE, AND THE REST IS NOW MEASURED ELSEWHERE.
//     Every other attachTooltip caller passes `clear: el.parentElement` too and
//     none is sampled HERE. It is no longer unknown: 160 tooltip-bearing controls
//     over EIGHT ?shot= surfaces (customize, combat, map, compendium, coop, shop,
//     profile, event) at both shapes, 8c34bc0 against d705b66, same synthesized
//     door as P3. 158 matched by key — 84 placements moved, 74 unchanged, ZERO
//     regressions (not one control where the sibling count or the worst sibling
//     coverage rose); worst coverage IMPROVED on 79 and went from >=99.9% to
//     exactly 0 on TWENTY-ONE, including the settings tab strip (`.set-tabs`,
//     5 siblings at 100% — a Law 3 surface), `.cp-grid` (96.3%), `.disc-faces`
//     (6 siblings at 100%), `.mh-actions` and `.coop-flasks`. The 2 unmatched
//     rows each side are the same hovered map node, whose own rect differs by
//     ~2 px under its hover scale. That sweep is a scratch probe, not a shipped
//     check: P3 stays the hand because the hand is where the corpus can plant,
//     and a one-off measurement is a receipt, not coverage.
//   · A RED P1 TAKES P2 WITH IT AND THE DENOMINATOR MOVES SILENTLY. gapChecks
//     returns after a P1 finding, so a run with an undeclared gap prints 5
//     checks where the clean run prints 7. It cannot hide a VERDICT — P1 is
//     already red and the exit is 1 — but "N check(s)" in the summary is not a
//     constant and must not be read as a coverage number.
//   · P3 IS VACUOUS ON A HAND OF ONE. It counts SIBLINGS touched; with a single
//     card there are none, so `0 sibling cards touched` is green about nothing.
//     Named rather than asserted — an unwatched floor is decoration, and no
//     plant in this corpus renders a short hand.
//   · THE FLASK ACTION MENU IS MEASURED SINCE 2026-08-17 — P5, and this bullet
//     used to say the opposite. It is a third placeAnchored caller now. Two
//     things P5 does NOT claim. (a) IT DOES NOT ASSERT THE ENEMY ROW. At 1200
//     the menu grazes the leftmost `.combatant` by 1.0% of its box; that is
//     reported, not asserted, because the menu and targeting are never on
//     screen together (choosing Use closes it before an enemy is aimed at) and
//     because any menu anchored to a HUD that sits above the field must land on
//     the field. Turning that graze into a number to stay under would be a
//     budget nobody derived. (b) IT DOES NOT EXERCISE THE HEIGHT CAP.
//     flask.js caps the panel at the room below the slot; with today's flask
//     texts the expanded panel is 156.9 local px against 761 of room at 390x844,
//     so the cap is computed and never binding here. Measured binding once, by
//     hand, with an injected 4000-character description — the panel stayed on
//     screen and scrolled inside itself — but that is a receipt, not coverage:
//     no plant in this corpus renders a long flask.
//   · LINUX HEADLESS CHROMIUM, two shapes. TEXT SIZE IS NOW MEASURED, UI SIZE IS
//     NOT. Law 4 clause 3 says the gap must not answer the Text-size dial;
//     measured at 1200x730 with ?shotSettings textSize S/M/L/XL, html font-size
//     9/10/11/12 px, the declared gap stays "14px" and the rendered separation
//     stays 14.01 local px at S, M and L. At XL the tooltip is tall enough that
//     the `left` candidate stops fitting and it flips to `above` — the GAP is
//     still 14, the SIDE is not the same, and no check watches the side at XL.
//     UI size is untouched: the gap is local px under `body { zoom }`, so it
//     scales with UI size by construction (Law 4 clause 2 wants exactly that),
//     which is an argument and not a measurement.
//   · P2 SAYS THE RENDERED GAP MATCHES THE DECLARED ONE. It says nothing about
//     whether 14 px is the right number for a human — that is Sunna's read.
//
// Usage
//   node tools/placement.mjs                  source tree via serve.mjs
//   node tools/placement.mjs --only 390x844
//   node tools/placement.mjs --selftest       the same-door known-bad corpus
//   node tools/placement.mjs --browser PATH
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// REMOVAL: deleted the day placeAnchored has no callers, or the day the gap
// stops being a length a stylesheet owns.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'placement.mjs',
    args: ['--only', '1200x730'],
    timeoutMs: 900000,
    plants: [
      {
        // THE LAW 0 PLANT, and the whole reason this tool exists. The code takes
        // its gap back as a private constant while the stylesheet says something
        // else. ONE LOCAL PX of disagreement, deliberately — if the smallest
        // possible second copy is caught, every larger one is, and it gives P2's
        // tolerance a cell on the far side of itself by the same door.
        name: 'the gap grows a SECOND HOME — placeAnchored keeps its own 14 while ui.css says 15',
        edits: [
          {
            file: 'src/ui/fx.js',
            find: '  const gap = placeGap(el);',
            replace: '  const gap = 14; // planted: the private constant, back where it was',
          },
          {
            file: 'styles/ui.css',
            find: '  --place-gap: 14px;',
            replace: '  --place-gap: 15px;',
          },
        ],
        expectRed: /P2 .*tooltip.*rendered .* declared|P2 ONE HOME/,
      },
      {
        // The gap loses its home entirely. placeAnchored resolves it to 0 and
        // welds the tooltip to the card — VISIBLY wrong rather than plausibly
        // wrong (Law 0 clause 5). P2 alone would pass this, because measured 0
        // and declared 0 agree; P1 is the assertion that catches it, and this
        // plant is why P1 is not redundant.
        name: 'the gap has NO home — #tooltip stops declaring --place-gap',
        file: 'styles/ui.css',
        find: '  --place-gap: 14px;\n',
        replace: '',
        expectRed: /P1 /,
      },
      {
        // The clear preference cut. This is the payoff half: without it the
        // tooltip goes back to sitting on the cards either side of the one it
        // explains.
        name: 'the tooltip stops keeping off its anchor\'s group (the clear pass cut)',
        file: 'src/ui/fx.js',
        find: '    if (clear && usable.length > 1) {',
        replace: '    if (false && clear && usable.length > 1) { // planted: no group preference',
        expectRed: /P3 /,
      },
      {
        // The intent misnamed at the call site. `beside` is a legal intent and a
        // wrong answer here: at 1200 there is room to the right of ☰, so the
        // list opens BESIDE the button instead of under it. This is the check on
        // Marina's rule that the intent is named by the caller — a name that
        // nothing verifies is a comment.
        name: 'quicknav asks for the WRONG INTENT — beside its button instead of under it',
        file: 'src/ui/components/quicknav.js',
        // The comment is a BLOCK comment on purpose: a `//` here swallows the
        // call's own `);` and the plant becomes a SyntaxError, which boots
        // nothing and exits 2. doorplant refused to score that as a catch —
        // correctly, and it is the difference between an instrument that is
        // silent and one that is broken.
        find: "{ intent: 'under', align: 'end', view }",
        replace: "{ intent: 'beside', view } /* planted: the wrong intent, named at the call site */",
        expectRed: /P4 /,
      },
      {
        // THE CLASS CONSTANTINE REPORTED, PUT BACK: A MENU THAT PLACES NOTHING.
        // It is not a byte-for-byte replay of the shipped defect and the
        // difference is worth stating — the original had no stylesheet rule at
        // all, so it was `position: static` and rendered as a full-width strip on
        // the bottom edge; strip only the call and the rule stays, so the menu is
        // `fixed` with `left/top: auto` and lands at (0,0). Measured, not
        // assumed. Either way it is nowhere near its slot, which is the whole
        // point: no search for placement code can find a surface whose defect is
        // that it places nothing, so the check has to be aimed at the ABSENCE.
        name: 'the flask menu goes back to being UNPLACED — flask.js stops calling place()',
        file: 'src/ui/components/flask.js',
        find: '.appendChild(root);\n  place();',
        replace: '.appendChild(root);\n  /* planted: the menu is never placed */',
        expectRed: /P5 .*NOT under its slot/,
      },
      {
        // The intent misnamed at the flask call site, the same shape as the
        // quicknav plant above and a different answer: at 1200 there is room to
        // the right of the slot, so `beside` opens the menu ON THE NEXT FLASK
        // SLOT. That is why `under` is the design call and not a preference.
        name: 'the flask menu asks for the WRONG INTENT — beside its slot instead of under it',
        file: 'src/ui/components/flask.js',
        find: "{ intent: 'under', align: 'start', view, pad: PAD }",
        replace: "{ intent: 'beside', view, pad: PAD } /* planted: the wrong intent, named at the call site */",
        expectRed: /P5 /,
      },
      {
        // The gap loses its home on THIS surface. A second site for the P1
        // assertion, and the find-string carries the end of the comment above it
        // because `  --place-gap: 6px;` alone also matches `.qn-panel` — a plant
        // aimed at a neighbourhood instead of a defect is the drift Sten was
        // bitten by on quicknav-reach's R1 the same night.
        name: 'the flask menu\'s gap has NO home — .flask-action-menu stops declaring --place-gap',
        file: 'styles/ui.css',
        find: 'invented to remove. */\n  --place-gap: 6px;\n',
        replace: 'invented to remove. */\n',
        expectRed: /P1 .*flask menu/,
      },
    ],
  }));
}

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
if (!browserPath) { console.error('placement: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPES = [{ w: 390, h: 844, d: 3, mobile: true }, { w: 1200, h: 730, d: 1, mobile: false }];
const GAP_TOL = 0.5; // local px — float noise, not a verdict threshold (see header)

// THE PROPERTY NAME HAS ONE HOME TOO, AND IT IS NOT THIS FILE. fx.js exports
// PLACE_GAP_PROP with the docstring "so the stylesheet, the code and any
// instrument agree" — and until 2026-08-17 this instrument typed the literal
// instead, which is the same second-copy shape the tool exists to catch, one
// level up on the NAME rather than the value (Bjorn, gating d705b66). Its
// failure mode was a FALSE RED: rename the property in fx.js and ui.css together
// — a correct change — and this tool reported "--place-gap is UNDECLARED" and
// accused the code of a defect it did not have. Read out of the source instead,
// so there is nothing to disagree with. A missing export is exit 2 (NOTHING
// RAN), never a default: a guessed name would measure the wrong cascade and
// call it green.
const PROP = (/export const PLACE_GAP_PROP = '([^']+)'/.exec(readFileSync(join(ROOT, 'src/ui/fx.js'), 'utf8')) || [])[1];
if (!PROP) {
  console.error('placement: src/ui/fx.js no longer exports PLACE_GAP_PROP — the gap property name has no home to read, and guessing it would measure the wrong cascade');
  process.exit(2);
}

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

// ONE READING, shared by every check below: two boxes in LOCAL px, the gap the
// placed element declares, and which axis actually separates them.
//
// WHY "whichever axis separates". placeAnchored pins only the SEPARATING axis —
// a tooltip below a control has to be below it, and its horizontal position is
// free to slide so the vertical room can be used at all. So the declared gap is
// carried by exactly one axis and the other is whatever the slide chose. Both
// axes are reported; the check asks that ONE of them is the declared number, and
// names the axis it found it on. Neither separating (the boxes overlap) means
// the bound answered instead of a side — reported as `on it`, which is a
// finding, not a measurement.
const READ = (anchorSel, placedSel) => `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const a0 = document.querySelector(${JSON.stringify(anchorSel)});
  const p0 = document.querySelector(${JSON.stringify(placedSel)});
  if (!a0 || !p0) return { missing: !a0 ? ${JSON.stringify(anchorSel)} : ${JSON.stringify(placedSel)} };
  const L = (el) => { const r = el.getBoundingClientRect();
    return { left: r.left/z, top: r.top/z, right: r.right/z, bottom: r.bottom/z, w: r.width/z, h: r.height/z }; };
  const a = L(a0), p = L(p0);
  const raw = getComputedStyle(p0).getPropertyValue(${JSON.stringify(PROP)}).trim();
  const declared = parseFloat(raw);
  const axes = [];
  if (p.left  >= a.right)  axes.push({ side: 'right', gap: p.left - a.right });
  if (p.right <= a.left)   axes.push({ side: 'left',  gap: a.left - p.right });
  if (p.top   >= a.bottom) axes.push({ side: 'below', gap: p.top - a.bottom });
  if (p.bottom<= a.top)    axes.push({ side: 'above', gap: a.top - p.bottom });
  return { a, p, zoom: z, raw, declared: Number.isFinite(declared) ? declared : null, axes };
})()`;

// Every hand card, and how much of each one the tooltip is sitting on.
const COVER = `(() => {
  const t = document.getElementById('tooltip');
  if (!t || getComputedStyle(t).display === 'none') return { shown: false };
  const tr = t.getBoundingClientRect();
  const ov = (x, y) => Math.max(0, Math.min(x.right,y.right)-Math.max(x.left,y.left))
                     * Math.max(0, Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
  const cards = [...document.querySelectorAll('.hand .card')];
  const hit = cards.map((c, i) => { const r = c.getBoundingClientRect(); const area = ov(tr, r);
    return { i, pct: r.width*r.height ? +(100*area/(r.width*r.height)).toFixed(1) : 0 }; })
    .filter((c) => c.pct > 0);
  return { shown: true, n: cards.length, hit };
})()`;

// THE FURNITURE A THUMB AIMS AT WHILE A FLASK MENU IS OPEN, and the list is the
// assertion. Everything here is a control that is ALREADY ON SCREEN and stays
// there: the two pile counters, END TURN, the hand, the other flask slots, the
// topbar buttons. A menu that lands on any of them steals a tap — which is
// exactly what the unplaced menu did (the Inspect row's right 39% sat under the
// DRAW pile, and the pile's z-index 20 beat it, so the draw modal opened).
// `.combatant` is DELIBERATELY ABSENT — see the boundaries in the header.
const FURNITURE = ['.pile.draw', '.pile.discard', '.end-turn', '.hand .card', '.flask-charge', '.topbar-btn'];

// What the flask menu is sitting on, per control, in local px. Reported whole:
// the assertion is over FURNITURE, and `field` is printed beside it so a reader
// can see where the menu went rather than only that it left.
const FLASK_COVER = `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const m = document.querySelector('.flask-action-menu');
  if (!m) return { missing: true };
  const L = (el) => { const r = el.getBoundingClientRect();
    return { left: r.left/z, top: r.top/z, right: r.right/z, bottom: r.bottom/z, w: r.width/z, h: r.height/z }; };
  const ov = (x, y) => Math.max(0, Math.min(x.right,y.right)-Math.max(x.left,y.left))
                     * Math.max(0, Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
  const mb = L(m);
  const anchor = document.querySelectorAll('.flask-charge')[0];
  const hits = [];
  for (const sel of ${JSON.stringify(FURNITURE)}) {
    for (const el of document.querySelectorAll(sel)) {
      if (el === anchor) continue; // the slot it hangs off is not furniture it stole
      const r = L(el); const area = ov(mb, r);
      if (area > 0) hits.push({ sel, pct: +(100*area/((r.w*r.h)||1)).toFixed(1) });
    }
  }
  const soft = [];
  for (const el of document.querySelectorAll('.combatant')) {
    const r = L(el); const area = ov(mb, r);
    if (area > 0) soft.push(+(100*area/((r.w*r.h)||1)).toFixed(1));
  }
  return { menu: mb, hits, soft, expanded: !document.querySelector('.flask-action-detail')?.hidden };
})()`;

const findings = [];
let checks = 0;
const ok = (id, where, msg) => { checks++; console.log(`    PASS ${id}  ${where} — ${msg}`); };
const bad = (id, where, msg) => { checks++; findings.push(`${id}  ${where} — ${msg}`); console.log(`    FAIL ${id}  ${where} — ${msg}`); };

/** P1 + P2 on one surface: the gap is declared, and the render agrees with it. */
function gapChecks(where, surface, r) {
  if (r.missing) { bad('P1', where, `${surface}: ${r.missing} is not on the screen — nothing measured`); return; }
  if (r.declared == null || !(r.declared > 0)) {
    bad('P1', where, `${surface}: ${PROP} is ${r.raw ? `"${r.raw}"` : 'UNDECLARED'} — placeAnchored resolves that to 0 and welds the panel to its anchor`);
    return;
  }
  ok('P1', where, `${surface}: ${PROP} declared "${r.raw}" (${r.declared} local px)`);
  if (!r.axes.length) {
    bad('P2', where, `${surface}: the panel overlaps its anchor on BOTH axes — the bound answered, not a side, so there is no rendered gap to compare`);
    return;
  }
  const near = r.axes.find((x) => Math.abs(x.gap - r.declared) <= GAP_TOL);
  const seen = r.axes.map((x) => `${x.side} ${x.gap.toFixed(2)}`).join(', ');
  if (near) ok('P2', where, `${surface}: rendered ${near.gap.toFixed(2)} = declared ${r.declared} local px, on the ${near.side} axis (all separations: ${seen})`);
  else bad('P2', where, `${surface}: rendered ${seen} — declared ${r.declared}. The gap the browser drew is not the gap the stylesheet owns: the code is carrying a second copy`);
}

// THE PROFILE IS THE LAUNCHER'S — tools/browser.mjs — AND THAT IS THE LANE THIS
// FILE'S OWN NOTES ASKED FOR TWICE. Both are Bjorn's, both kept in his words
// because they are the evidence the collapse was owed and the diagnosis I built
// against:
//
//   "THIS IS A PATCH, SAID OUT LOUD — the collapse is one shared launcher, not a
//    thirteenth copy of the removal" (gating d705b66), and then, after measuring
//    his own fix at 06b18f3:
//   "A FULL `--selftest` STILL LEAVES 3 PARTIAL PROFILES OF 6 INVOCATIONS —
//    3.3 MB where it was ~66 MB, and non-deterministic. Cause: `child.kill()`
//    signals the DIRECT child only, and Chromium's helper processes can outlive
//    it and re-create entries under the profile after rmSync has run. The honest
//    fix is a process-group kill (`detached: true` plus `process.kill(-pid)`) in
//    ONE SHARED LAUNCHER, which is the lane."
//
// That is exactly what the launcher does, and I reached the same mechanism from
// the other end before reading this: 9 of 10 concurrent runs clean, and the tenth
// left a profile holding a fresh `Default/` while `close()` reported success —
// an orphaned RENDERER recreating a tree whose absence had already been verified.
// Group kill, real join with no short ceiling, and a re-check after a settle:
// 36/36 at 12-way concurrency.
//
// HIS SECOND NAMED REMAINDER CLOSES TOO, AND IT IS NOT A SEPARATE LANE. He wrote
// that Chromium "also makes a `.org.chromium.Chromium.<rand>` scratch dir directly
// in $TMPDIR, OUTSIDE --user-data-dir, which nothing here can reach." It is
// reachable: the launcher points the child's TMPDIR INSIDE the profile, so that
// scratch dir lands where the profile's removal takes it. Measured three ways in
// browser.mjs's header, and watched as a plant either side of the pin (P7).

async function main() {
  const { serve } = await import(join(ROOT, 'tools/serve.mjs'));
  const s = await serve({ root: ROOT, port: 8294, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`placement — ${base} (root ${ROOT})`);
  console.log('DOOR: real boot over http in headless Chromium; every box converted to LOCAL px');
  console.log('      once before anything is compared; the declared gap');
  console.log(`      read with the same getComputedStyle('${PROP}') placeAnchored uses — the name`);
  console.log(`      out of src/ui/fx.js PLACE_GAP_PROP, not typed here. The hover and the open are`);
  console.log('      DISPATCHED DOM events, not CDP input: placement is measured, reachability is not.');
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'placement-', browser: browserPath,
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let ran = 0;

  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    console.log(`\n  ${shape}`);

    // ---- the tooltip, on the hand ------------------------------------------
    await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat');
    await wait(500);
    const n = await ev(`document.querySelectorAll('.hand .card').length`);
    if (!n) { bad('P3', shape, 'no hand cards rendered — nothing to measure'); continue; }

    // Every card in the hand, hovered in turn. The tooltip is a HOVER here, not
    // a hold: the hold is tooltippersist's subject and place() is the same call
    // either way, so this samples the whole row for the price of one gesture
    // each.
    let worst = null; let touchedCards = 0;
    for (let i = 0; i < n; i++) {
      await ev(`(() => { const c = document.querySelectorAll('.hand .card')[${i}];
        c.scrollIntoView({ inline: 'center', block: 'nearest' });
        c.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false })); return true; })()`);
      await wait(260);
      const cov = await ev(COVER);
      if (!cov.shown) { bad('P3', shape, `card #${i}: hovering it showed no tooltip — nothing measured`); continue; }
      const others = cov.hit.filter((h) => h.i !== i);
      if (others.length) {
        touchedCards += others.length;
        const w = others.reduce((m, h) => (h.pct > (m?.pct || 0) ? h : m), null);
        if (!worst || w.pct > worst.pct) worst = { ...w, from: i };
      }
      if (i === 0) gapChecks(shape, 'tooltip vs hand card #0', await ev(READ('.hand .card', '#tooltip')));
      await ev(`document.querySelectorAll('.hand .card')[${i}].dispatchEvent(new PointerEvent('pointerleave', { bubbles: false })); true`);
      await wait(80);
    }
    if (touchedCards === 0) ok('P3', shape, `the tooltip clears its neighbours on all ${n} hand cards (0 sibling cards touched)`);
    else bad('P3', shape, `the tooltip sits on ${touchedCards} sibling card(s) across ${n} hovers — worst ${worst.pct}% of card #${worst.i}, from card #${worst.from}. A tooltip may not cover the hand it is explaining`);

    // ---- the flask action menu, on the slot the player tapped ---------------
    // Same page, same boot as P3 above: the hand is already rendered, so this
    // costs one click. The gesture is `.flask-charge[0].click()` — the same
    // synthesized-event door as the hover above, with the same boundary (it
    // measures where the menu LANDS, never whether a thumb can reach the slot).
    const nf = await ev(`document.querySelectorAll('.flask-charge').length`);
    if (!nf) bad('P5', shape, 'no flask slots on ?shot=combat — nothing measured');
    else {
      await ev(`document.querySelectorAll('.flask-charge')[0].click(); true`);
      const up = await until(`!!document.querySelector('.flask-action-menu')`, 'flask menu', 4000)
        .then(() => true).catch(() => false);
      if (!up) bad('P5', shape, 'tapping the first flask slot opened no menu — nothing measured');
      else {
        await wait(250);
        // TWO STATES, because Inspect grows the panel INSIDE itself and
        // placement is a one-shot. The second reading is the one that catches a
        // menu re-placed as if it were still collapsed.
        for (const state of ['as it opens', 'with Inspect expanded']) {
          if (state !== 'as it opens') {
            const clicked = await ev(`(() => { const b = [...document.querySelectorAll('.flask-action')]
              .find((x) => /Inspect/i.test(x.textContent)); if (!b) return false; b.click(); return true; })()`);
            if (!clicked) { bad('P5', shape, 'the menu has no Inspect row — the expanded state was not measured'); break; }
            await wait(250);
          }
          const at = `flask menu (${state})`;
          gapChecks(shape, at, await ev(READ('.flask-charge', '.flask-action-menu')));
          const c = await ev(FLASK_COVER);
          if (c.missing) { bad('P5', shape, `${at}: the menu left the DOM before it was measured`); break; }
          const a = await ev(`(() => { const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
            const r = document.querySelectorAll('.flask-charge')[0].getBoundingClientRect();
            return { left: r.left/z, bottom: r.bottom/z }; })()`);
          if (c.menu.top >= a.bottom - 0.5) {
            ok('P5', shape, `${at}: opens UNDER its slot (menu top ${c.menu.top.toFixed(1)} ≥ slot bottom ${a.bottom.toFixed(1)} local px)`);
          } else {
            bad('P5', shape, `${at}: NOT under its slot — menu (${c.menu.left.toFixed(1)},${c.menu.top.toFixed(1)})-(${c.menu.right.toFixed(1)},${c.menu.bottom.toFixed(1)}) against slot bottom ${a.bottom.toFixed(1)}. A context menu that opens away from the control that summoned it is the defect Constantine reported`);
          }
          const softest = c.soft.length ? ` (over the field: ${c.soft.map((p) => `${p}% of a combatant`).join(', ')} — reported, not asserted)` : '';
          if (!c.hits.length) ok('P5', shape, `${at}: touches none of ${FURNITURE.length} combat controls${softest}`);
          else bad('P5', shape, `${at}: sits on ${c.hits.map((h) => `${h.sel} ${h.pct}%`).join(', ')}. A flask menu may not cover a control the player still has to tap${softest}`);
        }
        await ev(`document.querySelector('.flask-action-menu')?.remove(); true`);
      }
    }

    // ---- the quick-nav panel, the OTHER intent ------------------------------
    // The list is behind a setting, so it is turned on the way the game turns it
    // on (?shotSettings), and opened by clicking the real ☰ button.
    const q = encodeURIComponent(JSON.stringify({ quickNav: 'mirror' }));
    await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSettings=${q}` }, S);
    await until(`!!document.querySelector('.map-node')`, 'map');
    await wait(600);
    await ev(`document.getElementById('open-menu').click(); true`);
    const opened = await ev(`!!document.querySelector('.qn-panel')`).catch(() => false)
      || await until(`!!document.querySelector('.qn-panel')`, 'qn-panel', 4000).then(() => true).catch(() => false);
    if (!opened) { bad('P4', shape, 'the quick-nav list did not open — nothing measured'); }
    else {
      await wait(250);
      const r = await ev(READ('#open-menu', '.qn-panel'));
      gapChecks(shape, 'quick-nav panel vs ☰', r);
      if (r.missing) { /* already reported by gapChecks */ }
      else {
        // UNDER, not beside — the intent the caller named. Two claims, because
        // `under` is two: the separating axis is the vertical one, and the free
        // axis is END-aligned (the panel's right edge on the button's). The
        // right-edge claim is waived when the bound moved it, which on a phone
        // it does: the topbar wraps and puts ☰ at the LEFT edge, so a panel
        // right-aligned to it would start off-screen. Naming the waiver is the
        // point — an assertion that quietly excuses itself is the thing this
        // house calls green-that-was-not-clearance.
        const under = r.p.top >= r.a.bottom - 0.5;
        if (under) ok('P4', shape, `the panel opens UNDER ☰ (panel top ${r.p.top.toFixed(1)} ≥ button bottom ${r.a.bottom.toFixed(1)} local px)`);
        else bad('P4', shape, `the panel is NOT under ☰ — panel (${r.p.left.toFixed(1)},${r.p.top.toFixed(1)})-(${r.p.right.toFixed(1)},${r.p.bottom.toFixed(1)}) against button bottom ${r.a.bottom.toFixed(1)}. 'under' is the intent this call site names`);
        const clamped = r.p.left <= 4.5;
        if (Math.abs(r.p.right - r.a.right) <= 0.5) ok('P4', shape, `right-aligned to ☰ (${r.p.right.toFixed(1)} = ${r.a.right.toFixed(1)} local px)`);
        else if (clamped) ok('P4', shape, `right-alignment WAIVED — the bound moved it (panel left ${r.p.left.toFixed(1)} is on the screen margin); align: 'end' is a preference the clamp outranks`);
        else bad('P4', shape, `align: 'end' did not hold — panel right ${r.p.right.toFixed(1)} vs button right ${r.a.right.toFixed(1)} local px, and the panel is not against the bound`);
      }
    }
    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); await s.close?.();
  await dropBrowser();
  if (!ran) { console.error('placement: NOTHING RAN'); process.exit(2); }
  console.log(findings.length ? `\nplacement: ${findings.length} FINDING(S) over ${checks} check(s)` : `\nplacement: all green — ${checks} check(s)`);
  process.exit(findings.length ? 1 : 0);
}

// HIS CATCH USED TO CALL dropBrowser AND NO LONGER HAS TO, WHICH IS THE POINT OF
// THE LANE. He hoisted PROFILE/CHILD to module scope precisely so `main().catch()`
// could reach them — his own words: without it, ANY throw orphaned a headless
// Chromium. The launcher's guard covers that path from inside browser.mjs, on
// `exit` and on SIGINT/SIGTERM/SIGHUP/SIGQUIT, and it is watched red as P1 and
// P2 of `node tools/browser.mjs --selftest`. So the hoist is gone rather than
// kept as a second copy, and what replaced it has a plant behind it.
main().catch((e) => { console.error('placement: UNKNOWN — ' + (e.stack || e.message)); process.exit(2); });
