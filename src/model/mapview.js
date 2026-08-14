// src/model/mapview.js — the act map's VIEW GEOMETRY, and the one place that
// turns it into an answer about whether a knob is satisfiable.
//
// WHY THIS FILE EXISTS. Constantine asked the map to open "zoomed in close
// enough that the current node and its connecting nodes fit." That is not a
// preference, it is arithmetic: how wide is the thing we must show, how wide is
// the space we have, what zoom relates them. Until now the two halves of that
// arithmetic lived in different worlds — the column pitch and the zoom ladder in
// `ui/components/mapboard.js`, the `columns` knob in `content/mapconfig.js`, and nothing
// anywhere that could answer "does this act's width fit on a phone?".
//
// So the numbers move here, once, and get three readers (Law 0 clause 4, one
// home per fact):
//
//   ui/components/mapboard.js draws with them, and computes the opening zoom from them
//   model/validate.js   REFUSES a `columns` value that makes the ask impossible
//   tools/mapfit.mjs    measures the shipped screen against them
//
// THE MEASUREMENT THAT DECIDES ALL OF IT, and it is re-runnable rather than
// remembered:
//
//   node tools/mapplan.mjs --spans --seeds 300
//
// prints, per `columns`, the widest framing the generator can ask the camera to
// draw. At 300 seeds x 8 column counts, the widest fan-out from a single node is
// exactly `floor(columns / 2) + 1` columns at every width measured — which is
// `maxFanoutSpan` below. It is an OBSERVED maximum, so it is a floor under the
// true worst case and never a ceiling: a `columns` value this file accepts can
// still produce a wider frame on an unlucky seat. That is why the refusal below
// is not the only guard — the running screen reports a frame it could not fit
// (`.map-scroll[data-framing="clipped"]`), so the optimistic half is watched by
// the pessimistic half.

import { balance } from '../content/balance.js';

/** Column pitch of the SVG, in SVG units. Floor pitch is derived below.
 *
 * 75, DOWN FROM 95 — Constantine's rendered read of the map on his phone
 * (D17 message 4/4b, 2026-08-08): "the width of the nodes are too wide. it
 * should be more narrow for mobile … the edges need to be longer and more in
 * the verticle axis instead of the horizontal." At 95 a diagonal edge ran
 * dy 65 / dx 95 — horizontal-dominant, |dy|/len 0.565 measured as the MEDIAN
 * edge across 12 seeds x 3 shapes at 86564e6. At 75 against the derived
 * ROW_H of 79 the same edge is dy 79 / dx 75 — vertical-dominant, 0.725 —
 * and the climb narrows by a fifth. Both gated floors stay clear and say so:
 * the live-pair air drops 52.4 -> 32.4 SVG (27.6 device px at 320x640,
 * floor 2) and the fan-out margin IMPROVES (7 columns: slack 1 -> 2).
 * BOUNDARY, named: Sunna's cleared live-door reading of 54.23 device px at
 * 390 becomes ~33.5 — above every coded floor, but the re-read is hers. */
export const COL_X = 75;

/**
 * The zoom ladder — the manual control, and the bounds the computed zoom is
 * allowed to sit between. Two consumers beyond the map itself: the Map zoom
 * setting DERIVES its choices from this array (it used to carry its own list of
 * four, which was a second copy of the ladder missing two of its six steps), and
 * the refusal below reads its floor.
 */
export const ZOOM_STEPS = Object.freeze([1, 1.15, 1.3, 1.5, 1.75, 2]);
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/**
 * WHAT THE MAP OPENS AT WHEN THE PLAYER HAS NOT CHOSEN — the settings row's `def`
 * and the map screen's fallback read this one const, so they cannot disagree.
 *
 * `'115'` (a percentage) or `'Fit'` (the computed frame). It says `'115'` because
 * SUNNA HELD #107 on exactly this token: the computed frame is correct arithmetic
 * and, arriving on its own, reads as a map that has been cropped — 43 of 48
 * mid-climb cells land at 1.968-2.000x, which shows 8-9 of 13 floors and never
 * the boss, against 13 of 13 and the boss on every cell at 115%. The dark that
 * makes a close frame read as intended (fog, parchment) is not on this branch.
 *
 * FLIPPING IT IS THE WHOLE CHANGE: `'Fit'` here makes the computed frame the
 * default everywhere, and nothing else moves. Do it when the fog lands, or on
 * Constantine's word — it is his A/B and nobody's first run is the experiment.
 */
export const MAP_ZOOM_DEFAULT = '115';

/**
 * THE REFERENCE UI ZOOM — `--ui-zoom` at the shape that decides, measured, not
 * assumed. 390x844 resolves to 0.90; 320x640 to 0.74. Mobile decides, so 0.90 is
 * the number the geometry below is solved at, and the smaller phone's shortfall
 * is a thing the screen SAYS rather than a thing this file pretends away.
 */
export const PHONE_UI_ZOOM = 0.9;

/**
 * AND THE SMALLEST SHAPE THIS GAME CLAIMS — `--ui-zoom` at 320x640, measured at
 * dev, 0.74. It was a number inside the sentence above and nothing could execute
 * it, which is exactly why the vertical margin below went unwatched at the shape
 * where it is tightest. Promoted from prose to a const so the arithmetic reads
 * the same fact the comment states, once (Law 0 clause 4).
 */
export const PHONE_UI_ZOOM_MIN = 0.74;

/**
 * The minimum centre-to-centre pitch between adjacent map floors, measured in
 * device-space CSS pixels at the smallest phone the game claims.
 *
 * This is deliberately a delivered value, not another SVG-unit guess. `Fit`
 * is allowed to change the camera zoom, and `--ui-zoom` changes with the phone;
 * both used to make a larger ROW_H look unchanged on glass. ROW_H is derived
 * from this floor, PHONE_UI_ZOOM_MIN and the map zoom ladder's floor below, so
 * none of those three multipliers can quietly absorb the requested spacing.
 *
 * 48 is the first whole-pixel floor above every rejected 08e184a reading (the
 * largest was 47.61 px at 390x844/115%). It is a conservative lower bound, not
 * a claim that 48 is the visual ideal. Remove it if the map stops using adjacent
 * floor rows; change it on Constantine's rendered read, never to fit a test.
 *
 * 58, UP FROM 48, and the door is the one the sentence above names: his
 * rendered read. D17 message 4 (2026-08-08, phone, this screen): "the
 * veritical space between nodes are way too close" — and 4b asks the edges to
 * be LONGER as well as more vertical, which a narrower COL_X alone would have
 * broken (edge length shrinks as columns narrow). 58 derives ROW_H 79: the
 * delivered floor pitch at 390x844/115% goes 47.61 -> 81.8 device px, the
 * diagonal edge is 109 SVG units (longer than the 105.6 he complained at, at
 * 46/95), and dy exceeds dx. Not fitted to a test: every floor this file
 * gates was re-run and stays green with margin printed.
 */
export const NODE_PITCH_MIN_PX = 58;

/**
 * Floor pitch of the SVG, derived from the device-space floor at the two
 * multipliers that can make it smallest: the map zoom ladder's floor and the
 * smallest phone UI scale. `Math.ceil` spends at most one SVG unit and makes
 * the lower bound survive fractional layout rounding.
 */
export const ROW_H = Math.ceil(NODE_PITCH_MIN_PX / (ZOOM_MIN * PHONE_UI_ZOOM_MIN));

/**
 * nodeRadiusFor(tapPx, zoom, uiZoom) -> the SVG radius that DELIVERS `tapPx`.
 * deliveredNodePx(r, zoom, uiZoom) -> what a radius actually delivers.
 *
 * One equation, both directions, and every consumer asks it rather than carrying
 * a number: `2 * r * zoom * uiZoom` device px. The map node is the smallest
 * thing this game asks a player to hit and a mis-tap on it starts a fight nobody
 * chose, so the size is solved from the floor instead of drawn and hoped for.
 */
export function nodeRadiusFor(tapPx, zoom, uiZoom) {
  return tapPx / (2 * zoom * uiZoom);
}
export function deliveredNodePx(r, zoom, uiZoom) {
  return 2 * r * zoom * uiZoom;
}

/**
 * NODE RADII, DERIVED — `15` and `20` were drawn-and-hoped-for, and what they
 * delivered was 25.5 device px at 320x640 and 22.2 at the ladder's floor: under
 * `balance.ui.tapSize`'s SMALLEST offering of 24, on the screen where a mis-tap
 * starts a fight nobody chose. Nothing measured it because the tap floor and the
 * map's geometry had never been in the same file.
 *
 * Solved at the default tap target, the shipping map zoom and the deciding
 * phone: 44 / (2 x 1.15 x 0.90) = 21.3. Turn the ladder, the reference shape or
 * `balance.ui.tapSize.def` and this number MOVES — that is the point of deriving
 * it, and it is why the boss keeps its proportion by ratio instead of by a
 * second literal that would drift the first time this one changed.
 *
 * It is not a promise at every shape and the screen says so rather than this
 * comment: at 320x640 the same radius delivers 36 px, and `mountMap` states that
 * where the player is, silent whenever the floor is met.
 */
/**
 * THE TAP TARGET THIS SOLVES FOR, read from content and never retyped —
 * `balance.ui.tapSize.def`, the same datum `applyTapSize()` writes into
 * `--tap-target` and `resolveTapSize()` resolves the setting against. Adding a
 * fifth size there is still a row and nothing else; this file asks for the
 * default rather than restating one of the four.
 */
export const TAP_TARGET_DEFAULT = balance.ui.tapSize.def;

/**
 * THE ZOOM THE GEOMETRY IS SOLVED AT — a reference, and its OWN fact.
 *
 * IT IS NOT `Number(MAP_ZOOM_DEFAULT) / 100`, AND THAT IS SUNNA'S RULING, NOT MY
 * PREFERENCE. I wrote it as that expression, found that `MAP_ZOOM_DEFAULT`
 * legally holds `'Fit'` — `Number('Fit')` is NaN, so every radius, every circle
 * and every margin goes NaN on the flip its own comment calls "the whole change"
 * — and refused it by name rather than repairing it, because what the geometry
 * solves at when the default IS the computed frame looked like a design call.
 * She ruled the union splits instead, and her line is the whole reason:
 *
 *   "They were never one fact. The reference only LOOKS like the default
 *    because today they happen to be equal."
 *
 * `MAP_ZOOM_DEFAULT` keeps one job — what the setting opens at, and it may
 * legally say `Fit`. The geometry keeps its own reference, here, beside
 * `PHONE_UI_ZOOM` and `PHONE_VIEW_W`, and the arithmetic MUST NOT LEARN THE WORD:
 * she checked, and `Fit` is a RANGE — solved at the floor of that range the node
 * circles overlap by 2.80 SVG units. A reference zoom has to be one rung, and
 * `mapplan --selftest` asserts it is a rung the ladder actually has.
 *
 * Today `REF_ZOOM` and `MAP_ZOOM_DEFAULT` still agree at 1.15, so nothing about
 * this split moves a pixel. The refusal-by-name stays and is not decoration: the
 * parameterised path below still refuses a non-finite reference zoom, which is
 * what makes the split checkable rather than merely written down.
 */
export const REF_ZOOM = 1.15;

/**
 * Is `MAP_ZOOM_DEFAULT` a legal token? `'Fit'`, or a percentage naming a rung the
 * ladder actually has. Its own consumers already fall back on an unreadable
 * value; this is the half that says so out loud instead of falling back quietly.
 */
export function mapZoomDefaultIsLegal(token = MAP_ZOOM_DEFAULT) {
  if (token === 'Fit') return true;
  const z = Number(token) / 100;
  return Number.isFinite(z) && ZOOM_STEPS.includes(z);
}

/**
 * The radius that delivers `tapPx`, rounded to the 0.1 the SVG is authored in.
 * A FUNCTION and not an inline expression because the margin corpus has to ask
 * it about tap targets the game does not ship — a fixture that can only ask
 * about today's value is a fixture that cannot go red tomorrow.
 */
export function nodeRadiusFromTap(tapPx, refZoom = REF_ZOOM) {
  return Math.round(nodeRadiusFor(tapPx, refZoom, PHONE_UI_ZOOM) * 10) / 10;
}

export const BOSS_RATIO = 20 / 15;
export const NODE_R = nodeRadiusFromTap(TAP_TARGET_DEFAULT);
export const BOSS_R = Math.round(NODE_R * BOSS_RATIO * 10) / 10;


/**
 * THE REFERENCE PHONE VIEWPORT, in LOCAL px, measured off `.map-scroll` — never
 * inferred from device width, because `--ui-zoom` sits between the two and the
 * map lives on its far side. Measured at dev: 390x844 -> 433, 320x640 -> 432.
 * The narrower of the two is the one worth refusing against.
 */
export const PHONE_VIEW_W = 432;

export function nodeRadius(type) {
  return type === 'boss' ? BOSS_R : NODE_R;
}

/** The SVG's own box, from the graph. */
export function svgWidth(columns) {
  return columns * COL_X + 60;
}
export function svgHeight(maxFloor) {
  return (maxFloor + 1) * ROW_H + 30;
}

/** Where a node sits in SVG units. Floor 0 is the bottom; y grows downward. */
export function nodeX(col) {
  return 60 + col * COL_X;
}
export function nodeY(floor, height) {
  return height - floor * ROW_H;
}

/** Keep a zoom inside the ladder's own range. One home for the bounds. */
export function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * framingBox(nodes, height) -> { x0, y0, x1, y1, w, h } in SVG units, or null.
 *
 * The box that must be visible for the player to see their decision: every node
 * passed in, to the edge of its circle. THE HALO IS NOT IN IT, deliberately —
 * the promise is "the node is on screen", which is what the sweep measures and
 * what a thumb needs; a halo clipped by a pixel is decoration losing a pixel.
 */
export function framingBox(nodes, height) {
  if (!nodes || !nodes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of nodes) {
    const r = nodeRadius(n.type);
    const cx = nodeX(n.col);
    const cy = nodeY(n.floor, height);
    if (cx - r < x0) x0 = cx - r;
    if (cx + r > x1) x1 = cx + r;
    if (cy - r < y0) y0 = cy - r;
    if (cy + r > y1) y1 = cy + r;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/**
 * fitZoom(box, viewW, viewH) -> the RAW zoom at which the box exactly fills the
 * viewport's tighter axis. Unclamped on purpose: the caller decides what the
 * bounds are, and a caller that wants to know "how far outside the ladder is
 * this?" needs the raw number to say so.
 */
export function fitZoom(box, viewW, viewH) {
  if (!box || box.w <= 0 || box.h <= 0) return ZOOM_MAX;
  return Math.min(viewW / box.w, viewH / box.h);
}

/** The SVG width of a framing that spans `cols` columns, circle to circle. */
export function spanWidth(cols) {
  return (cols - 1) * COL_X + 2 * NODE_R;
}

/**
 * The widest fan-out one node can present, in columns, for a given ACT.
 *
 * MEASURED, not reasoned: `node tools/mapplan.mjs --spans`. See the header for
 * why an observed maximum is a floor under the worst case and never a ceiling.
 *
 * IT TAKES THE ACT AND NOT A NUMBER, and that is the fix rather than the style —
 * Vira, #107. The closed form is in `columns` alone, but the QUANTITY depends on
 * three knobs: `columns` bounds the spread, `pathCount` decides how many walkers
 * can merge into one node, and `floors` decides how many chances the walk has to
 * do it. A signature taking a bare number let every caller forget the other two
 * existed, and `--spans` swept only the first — so the formula was validated on
 * one line through a three-dimensional space and nothing said so. The sweep is
 * the grid now, and this signature is why a caller cannot hand it less than the
 * act it is asking about.
 */
export function maxFanoutSpan(config) {
  const columns = config && typeof config === 'object' ? config.columns : config;
  if (!Number.isInteger(columns) || columns < 1) return 1;
  return Math.floor(columns / 2) + 1;
}

/**
 * The largest `columns` whose widest fan-out still fits the reference phone at
 * the ladder's floor. DERIVED by asking, never typed — turn any number above
 * and this answer moves with it.
 */
export function maxFittingColumns() {
  let best = 1;
  for (let c = 1; c <= 64; c++) {
    if (PHONE_VIEW_W / spanWidth(maxFanoutSpan({ columns: c })) >= ZOOM_MIN) best = c;
  }
  return best;
}

/* ----------------------------------------------------------------- MARGINS --
 *
 * A DERIVED REFUSAL THAT PRINTS A VERDICT AND NOT A MARGIN CANNOT BE WATCHED.
 * Marina's collapse, 2026-08-08, of two findings that arrived hours apart from
 * two seats neither of whom had seen the other:
 *
 *   VIRA, horizontal. `columns: 9` is accepted, and it now wants 1.02x where it
 *   wanted 1.05x — the last accepted width sits 2% off the cliff and nothing was
 *   watching that number. The refusal said `accepted`. It never said `by 2%`.
 *
 *   SUNNA, vertical. The node that grew to meet the tap floor ate the space
 *   BETWEEN nodes in the same stroke: at 08e184a she measured 44.09 px of node
 *   against a 47.0 px row pitch at 390x844, and 36.25 against 39.0 at 320x640 —
 *   under 3 px of air between two adjacent, irreversible taps. Correctly and
 *   silently. Constantine's next rendered read was simpler: too close.
 *   SUNNA, vertical. The circles that grew to meet the tap floor ate the space
 *   BETWEEN circles in the same stroke, correctly and silently. Nothing read a
 *   gap on this screen — which is a sentence she had already written about the
 *   event screen's choice bars, in `content/balance.js`, weeks before tonight.
 *
 * A VERDICT HAS NO DERIVATIVE; A MARGIN DOES. Both axes compute one below, both
 * refusals print it, and each margin has a floor that can go red. The floors sit
 * BELOW today's values on purpose: today is legal, and the whole point is that
 * the next change to NODE_R, ROW_H, COL_X, BOSS_RATIO or
 * `balance.ui.tapSize.def` cannot quietly eat what is left.
 *
 * AND THE VERTICAL HALF CAME BACK CORRECTED, TWICE, BOTH FROM SUNNA AND BOTH
 * AGAINST ME — the record matters more than the tidy version:
 *
 *   1. THE PREMISE WAS WRONG. I wrote the floor to protect "two adjacent,
 *      irreversible taps". Adjacent-floor nodes are never both live: only
 *      reachable nodes get a handler and every edge runs floor -> floor+1, so a
 *      reachable set is one floor. 987 live pairs over 2,601 decision moments,
 *      all of them on one floor; the closest two LIVE doors are 54.23 px at 390.
 *      She drove real touch events too — slide off, lift over a neighbour, tap
 *      between: nothing fires, and the abort has shipped since the first commit.
 *      Her verdict on a mercy hold: NO, and the reason is hers to keep — it would
 *      charge the most-repeated tap in the game 600 ms against a survivable miss.
 *   2. THE SHAPE WAS WRONG, AND THAT ONE IS THE FINDING. My first margin computed
 *      `ROW_H - 2 * NODE_R`: two IDENTICAL circles. The boss carries a different
 *      radius, so the one pair on this screen that is ACTUALLY COLLIDING is the
 *      pair my invariant could not express. `pairAir` ranges over the pairs that
 *      exist now — see it, and the boss/shrine overlap it finds, below.
 *
 * Scaling every geometric term together is a no-op under Fit: multiply COL_X,
 * ROW_H and NODE_R by k and Fit divides zoom by k. The floor pitch is therefore
 * derived from DEVICE space while COL_X and NODE_R keep their own jobs.
 * `tools/mapspacing.mjs` reads the rendered result at both phone shapes and both
 * zoom modes; source constants are not allowed to grade themselves.
 * WHAT THIS IS NOT — and it is the first thing to say, because the obvious next
 * move is the wrong one. This is NOT an attempt to reach 44 device px on the map.
 * Two node centres are 34 px apart at 320x640, so that target cannot exist there
 * at any radius; and SCALING THE GEOMETRY IS A NO-OP — multiply COL_X, ROW_H and
 * NODE_R by k and the fit zoom divides by k, delivering the same device px. The
 * margins are made WATCHABLE here, not big. Whether an overlap READS as broken is
 * Freja's call and whether the surface needs mercy is Sunna's; this file is the
 * number under both, never the answer to either.
 *
 * DIVISION OF LABOUR BETWEEN THE TWO FLOORS, since neither watches everything:
 * the collision floor is what binds NODE_R, ROW_H and BOSS_RATIO tightly; the
 * fan-out floor is what binds COL_X tightly. Each watches the constants that
 * live on it, and both print the next value that would take them red.
 */

/**
 * FLOOR 1, HORIZONTAL — how many columns WIDER than the measured maximum fan-out
 * an act width must still survive.
 *
 * ONE, and the reason is this file's own confession. `maxFanoutSpan` is an
 * OBSERVED maximum — the header calls it "a floor under the true worst case and
 * never a ceiling". The slack is the premium on that admission, and one column
 * is the size of the failure being admitted to: `mapplan --spans` sweeps a
 * three-knob grid and the formula has never been exceeded, so what is insured
 * against is off-by-one, not off-by-two.
 *
 * IT IS A JUDGEMENT, IT COSTS SOMETHING, AND THE COST IS STATED RATHER THAN
 * BURIED: at the constants as they stand tonight, `columns` 8 and 9 were accepted
 * before this commit and are refused after it. Both sat at 1.02x with zero spare
 * columns. Nothing ships at either — acts 1, 2 and 3 all ship 7 — and 7 clears
 * this floor with exactly one spare column. Two spare columns would refuse every
 * width above 5, which IS a design change about which acts may exist and is not
 * mine to make. Revisable on Vira's or Constantine's word.
 */
export const FANOUT_SLACK_MIN = 1;

/**
 * FLOOR 2 — the air between two node circles that are drawn NEXT TO EACH OTHER,
 * in DEVICE px, at the smallest shape this game claims (320x640).
 *
 * THE REASON I FIRST GAVE FOR THIS FLOOR WAS WRONG, AND SUNNA FALSIFIED IT WITH
 * RENDERED EVIDENCE RATHER THAN ARGUMENT. I wrote "a dead zone between two
 * adjacent, irreversible taps". There is no such pair on the vertical axis:
 * only reachable nodes get a click handler (`ui/components/mapboard.js`) and every edge
 * runs floor -> floor+1, so A REACHABLE SET IS ALWAYS ONE FLOOR. She measured 72
 * graphs, 2,601 decision moments, 987 live pairs — all 987 on one floor, and the
 * closest two LIVE doors are 54.23 px at 390 and 44.59 at 320. She then drove it
 * with real touch events: slide off, lift over a neighbour, tap the air between —
 * nothing fires. Her verdict on a hold: no, and she is right.
 *
 * SO THE FLOOR SURVIVES WITH A DIFFERENT JOB: LEGIBILITY, NOT MERCY. Two circles
 * that touch or overlap read as one shape, and the overlap the census below finds
 * is real and rendered. That is Freja's and Sunna's ground to judge; keeping the
 * circles visibly separate is the engineering floor under it.
 *
 * TWO, and the whole reason, because a threshold is a judgement and should read
 * as one:
 *
 *   · It is BELOW every rendered air on this map today except the one that is
 *     already negative, so it was not fitted to a reading I liked.
 *   · It is not ONE: the chain SVG unit -> local px -> device px rounds at the
 *     edge of one circle and the edge of the next, and a 1 px claim of air cannot
 *     survive two roundings. Two is the smallest air still air afterwards.
 *   · It is a floor on AIR, never on target size. The target size question was
 *     answered by `nodeRadiusFor` and is not re-asked here.
 *
 * THE DERIVATION IS THE OPTIMISTIC HALF AND SAYS SO. At 08e184a it predicted
 * 3.52 device px at 390 while the screen delivered 2.9. A floor cleared here is
 * not a floor cleared on glass; `tools/mapspacing.mjs` now owns that reading.
 * AND MY STATED BOUNDARY WAS WRONG IN THE OTHER DIRECTION TOO — struck rather
 * than edited away. I wrote that "derivation is the optimistic half" because her
 * relayed 2.9 sat below my derived 3.52. Her 2.9 was a rounding of a pitch read
 * as 47.0; the pitch is 47.61 and the rendered air is 3.52 at 390 and 2.89 at
 * 320. THIS ARITHMETIC MATCHED THE PAINT TO THE HUNDREDTH, on all three pairs
 * below. I had written a caveat against my own numbers on a rounding error.
 *
 * What the floor buys — the largest tap default, the smallest row pitch — is
 * DERIVED and printed, never typed here, so this comment cannot rot into a
 * number that stopped being true.
 */
export const NODE_AIR_MIN_PX = 2;

/**
 * fanoutMargin(config) -> the HORIZONTAL margin, or null when `columns` is not a
 * width at all (shape stays the schema's job).
 *
 *   span      the widest fan-out MEASURED at this width, in columns
 *   need      what that spans in local px, circle edge to circle edge
 *   fit       the zoom it wants
 *   headroom  fit / ZOOM_MIN - 1, the fraction of zoom above the ladder floor
 *   slack     how many columns WIDER than `span` the frame still survives
 *   nextFit   the zoom the first surviving-plus-one column would need
 *   maxColX   the largest COL_X that would still leave FANOUT_SLACK_MIN columns
 *
 * `slack` is the half with the derivative in it. `headroom` alone says the frame
 * fits and says nothing at all about whether one surprise column takes it away —
 * which is precisely the thing `columns: 9` was hiding.
 */
export function fanoutMargin(config) {
  const columns = config && typeof config === 'object' ? config.columns : config;
  if (!Number.isInteger(columns) || columns < 1) return null;
  const span = maxFanoutSpan({ columns });
  const need = spanWidth(span);
  const fit = PHONE_VIEW_W / need;
  // How many columns wider than the measured maximum the frame still survives.
  // Bounded rather than open, so a broken `spanWidth` cannot spin here.
  let slack = 0;
  while (slack < 64 && PHONE_VIEW_W / spanWidth(span + slack + 1) >= ZOOM_MIN) slack++;
  // The widest COL_X that would still leave the floor's worth of spare columns:
  // (span + FANOUT_SLACK_MIN - 1) * COL_X + 2 * NODE_R <= PHONE_VIEW_W / ZOOM_MIN.
  const pitches = span + FANOUT_SLACK_MIN - 1;
  const maxColX = pitches > 0 ? (PHONE_VIEW_W / ZOOM_MIN - 2 * NODE_R) / pitches : Infinity;
  return {
    columns,
    span,
    need,
    fit,
    floor: ZOOM_MIN,
    headroom: fit / ZOOM_MIN - 1,
    slack,
    slackFloor: FANOUT_SLACK_MIN,
    nextNeed: spanWidth(span + slack + 1),
    nextFit: PHONE_VIEW_W / spanWidth(span + slack + 1),
    maxColX,
    ok: fit >= ZOOM_MIN && slack >= FANOUT_SLACK_MIN,
  };
}

/**
 * The largest `columns` that clears the horizontal floor — the derived edge the
 * refusal now keys on. `maxFittingColumns()` above is kept and still means what
 * it always meant: the largest width that fits AT ALL, with no room to be wrong.
 * Two names because they are two facts, and the refusal prints both so a reader
 * can see the size of the gap between "fits" and "fits with a margin".
 */
export function maxSafeColumns() {
  let best = 0;
  for (let c = 1; c <= 64; c++) {
    const m = fanoutMargin({ columns: c });
    if (m && m.ok) best = c;
  }
  return best;
}

/**
 * pairAir(opts) -> EVERY PAIR OF CIRCLES THIS MAP DRAWS NEXT TO EACH OTHER, with
 * the air between them in SVG units and in the device px a player sees.
 *
 * IT RANGES OVER THE PAIRS THAT EXIST, NOT THE PAIR THE FORMULA ASSUMED — and
 * that correction is Sunna's, arriving from outside as rendered evidence against
 * my own seam. My first version computed `ROW_H - 2 * NODE_R`: TWO NODE_R
 * CIRCLES. The boss carries a different radius — I derived it by ratio on
 * purpose, "never a second literal" — so THE ONE PAIR THAT IS ACTUALLY RED WAS
 * THE ONE PAIR MY INVARIANT COULD NOT EXPRESS. A margin over a uniform pair, on
 * a screen with a non-uniform pair in it.
 *
 * The three pairs, and each is a fact about geometry the generator guarantees:
 *
 *   live       same floor, adjacent columns — `COL_X - 2 * NODE_R`. THE ONLY
 *              PAIR THAT CAN BOTH BE LIVE AT ONCE (every edge runs floor ->
 *              floor+1, so a reachable set is one floor). Sunna measured 987 live
 *              pairs across 2,601 decision moments and the closest was 54.23 px
 *              at 390 / 44.59 at 320 — which is this expression, to the hundredth.
 *   floor-node adjacent floors, two ordinary nodes — `ROW_H - 2 * NODE_R`.
 *              Never both live. Legibility only.
 *   floor-boss adjacent floors, the boss above the lone top shrine
 *              (`engine/mapgen.js` puts it there in every act) —
 *              `ROW_H - BOSS_R - NODE_R`. Never both live. RED TODAY.
 *
 * Every input is a parameter with the module's const as its default, so the
 * corpus can plant both faces of every pair — a red the fixtures cannot reach is
 * a check nobody has watched fail (the instrument rule).
 *
 * `why` names WHICH input made it unanswerable, because "the geometry is NaN" and
 * "the circles collide" are two different failures and a reader must not have to
 * guess which one they are holding.
 */
export function pairAir(opts = {}) {
  const {
    tapPx = TAP_TARGET_DEFAULT,
    refZoom = REF_ZOOM,
    rowH = ROW_H,
    colX = COL_X,
    bossRatio = BOSS_RATIO,
  } = opts;
  const base = { tapPx, refZoom, rowH, colX, bossRatio, floorPx: NODE_AIR_MIN_PX };
  if (!Number.isFinite(refZoom) || refZoom <= 0) return { ...base, why: 'no-reference-zoom', pairs: [], worst: null };
  if (!Number.isFinite(tapPx) || tapPx <= 0) return { ...base, why: 'no-tap-target', pairs: [], worst: null };

  const r = nodeRadiusFromTap(tapPx, refZoom);
  const bossR = Math.round(r * bossRatio * 10) / 10;
  const pair = (id, label, axis, centres, r1, r2) => {
    const gap = centres - r1 - r2;
    const px = (uiZoom) => gap * refZoom * uiZoom;
    const px320 = px(PHONE_UI_ZOOM_MIN);
    return {
      id,
      label,
      axis,
      centres,
      r1,
      r2,
      gap,
      px390: px(PHONE_UI_ZOOM),
      px320,
      floorPx: NODE_AIR_MIN_PX,
      ok: px320 >= NODE_AIR_MIN_PX,
      // The centre-to-centre pitch that would put this pair exactly on the floor.
      minCentres: r1 + r2 + NODE_AIR_MIN_PX / (refZoom * PHONE_UI_ZOOM_MIN),
    };
  };
  const pairs = [
    pair('live', 'two LIVE doors — same floor, adjacent columns', 'horizontal', colX, r, r),
    pair('floor-node', 'two ordinary nodes on adjacent floors', 'vertical', rowH, r, r),
    pair('floor-boss', 'the boss above the top shrine', 'vertical', rowH, bossR, r),
  ];
  const worst = pairs.reduce((a, b) => (b.px320 < a.px320 ? b : a));
  return { ...base, why: worst.ok ? null : 'collision', r, bossR, pairs, worst };
}

/** Every rendered neighbour pair is gated. The wider floor pitch repaired the
 * old boss/shrine collision, so its former boot exemption has been removed. */
export const BOOT_GATED_PAIRS = Object.freeze(['live', 'floor-node', 'floor-boss']);

/**
 * The largest `balance.ui.tapSize.def` that still clears every BOOT-GATED pair —
 * derived by asking, so the day ROW_H, COL_X or the reference zoom moves this
 * answer moves with them and nothing has to remember to edit a number.
 */
export function maxTapDefault(opts = {}) {
  let best = 0;
  for (let t = 1; t <= 400; t++) {
    const a = pairAir({ ...opts, tapPx: t });
    if (a.pairs.length && a.pairs.filter((p) => BOOT_GATED_PAIRS.includes(p.id)).every((p) => p.ok)) best = t;
  }
  return best;
}

/**
 * geometryRefusals(balance) -> [{ key, msg }]
 *
 * THE COLLISION REFUSAL, and it is a CONTENT refusal because it has exactly one
 * data input: `balance.ui.tapSize.def`, which is what every radius on this map is
 * solved from. Everything else it reads (ROW_H, COL_X, the boss ratio, the
 * reference zoom, both measured `--ui-zoom` values) is code — so this is the
 * boot-time half of Law 1 clause 5 for the one entry an author can turn that
 * closes the space between two circles.
 *
 * Separate from `viewRefusals` because it is not per-act: it is asked ONCE of the
 * bundle, not once per `mapConfigs` key, and three identical errors would be
 * three copies of one fact.
 *
 * It rules on every pair in `BOOT_GATED_PAIRS`. The wider floor pitch now keeps
 * the boss/shrine pair green too, so no stale exemption survives the geometry
 * that originally required it.
 *
 * The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the same
 * corpus validate.js already points at, with rows for this refusal in it, so this
 * pointer is not a second dangling one.
 */
export function geometryRefusals(balance) {
  const out = [];
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) return out;
  const spec = balance.ui && balance.ui.tapSize;
  // ABSENCE IS THE FAILURE, NOT AN EXEMPTION — and it is here because the check
  // below it would otherwise die green at one particular state of the tree,
  // which is the hazard my own `--mutate` hit earlier tonight. `NODE_R` is
  // solved from this entry at module load with no fallback: delete it and every
  // radius on the map is NaN, while a refusal guarded on `tapSize != null` says
  // nothing at all. A bundle that carries a `balance` must be able to answer it.
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || spec.def == null) {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `missing — every map circle's radius is SOLVED from it (model/mapview.js NODE_R) with no fallback, `
        + `so its absence is not a default: every node, the boss circle and every margin resolve to NaN. `
        + `A bundle with a 'balance' must carry it.`,
    });
    return out;
  }

  const air = pairAir({ tapPx: spec.def });
  if (air.why === 'no-reference-zoom') {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `no radius can be solved from this entry: model/mapview.js REF_ZOOM is ${air.refZoom}, which is not a zoom, `
        + `so every node circle, the boss circle and every margin are NaN. `
        + `REF_ZOOM is the geometry's own reference and must be one rung of the ladder — it is deliberately NOT the map-zoom default, which may legally say 'Fit'.`,
    });
    return out;
  }
  if (air.why === 'no-tap-target') {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `must be a positive number of device px — every map circle's radius is solved from it — got ${JSON.stringify(spec.def)}`,
    });
    return out;
  }

  for (const p of air.pairs) {
    if (!BOOT_GATED_PAIRS.includes(p.id) || p.ok) continue;
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `${spec.def} px circles collide on the map: ${p.label} sit ${p.centres} SVG units apart centre to centre `
        + `and leave ${p.gap.toFixed(1)} — ${p.px320.toFixed(2)} device px of air at 320x640, ${p.px390.toFixed(2)} at 390x844 — `
        + `against a floor of ${NODE_AIR_MIN_PX} px. Two circles that touch read as one shape. `
        + `Every radius is DERIVED from this entry (node ${air.r}, boss ${air.bossR} SVG units at ${(air.refZoom * 100).toFixed(0)}%), `
        + `so raising it grows every circle while the pitch it is measured against does not move. `
        + `Largest default that still clears every gated pair: ${maxTapDefault()} px. `
        + `Smallest pitch that would clear this pair at ${spec.def} px: ${p.minCentres.toFixed(2)} SVG units.`,
    });
  }
  return out;
}

/**
 * viewRefusals(config) -> [{ key, msg }]
 *
 * The meaning layer for the two map knobs whose failure is a VIEW failure, in
 * the same shape `resolveFloorPlan` uses for the floor knobs, and read by the
 * same boot validator. Law 1 clause 5: a knob refuses at its edge, by name, with
 * the number that decided it — rather than handing him a climb whose choices are
 * off the side of the screen.
 *
 * Shape (is it an integer at all) stays the schema's job; this answers only
 * questions that need more than one field to ask.
 *
 * BOTH REFUSALS HERE CARRY A MARGIN, and only one of them needed new arithmetic
 * to do it: `entries` is a LID, not a cliff, and its margin is `lid - entries`,
 * which its message has always printed as "at most N distinct entrances exist".
 * `columns` was the one answering with a bare verdict. See MARGINS above.
 */
export function viewRefusals(config) {
  const out = [];
  if (!config || typeof config !== 'object') return out;
  const { columns, pathCount, entries } = config;

  // THE HORIZONTAL REFUSAL, AND IT PRINTS ITS MARGIN. It used to key on `z <
  // ZOOM_MIN` alone, which is a verdict with no derivative: `columns: 9` came
  // back `accepted` at 1.02x and nothing anywhere said "by 2%, with no spare
  // column". It keys on `fanoutMargin().ok` now — the cliff AND the floor above
  // it — and every message carries both numbers whichever face fired.
  const m = fanoutMargin(config);
  if (m && !m.ok) {
    const impossible = m.fit < ZOOM_MIN;
    out.push({
      key: 'columns',
      msg: `${columns} columns `
        + (impossible
          ? `cannot show a node and everything it connects to on a phone. `
          : `shows a node and everything it connects to with NO ROOM TO BE WRONG. `)
        + `The widest fan-out MEASURED at this width spans ${m.span} columns = ${Math.round(m.need)} local px, `
        + `against ${PHONE_VIEW_W} px of map viewport at 390x844 — that wants ${m.fit.toFixed(2)}x and the zoom ladder floors at ${ZOOM_MIN}x. `
        + `MARGIN: ${(m.headroom * 100).toFixed(1)}% of zoom above the floor, and ${m.slack} spare column(s) against a floor of ${FANOUT_SLACK_MIN}`
        + (impossible ? `. ` : ` — one more column needs ${m.nextFit.toFixed(2)}x. `)
        + `The measured maximum is a floor under the true worst case and never a ceiling, so a width with no spare column is one unlucky seed from broken. `
        + `Largest width that fits at all: ${maxFittingColumns()}. Largest with ${FANOUT_SLACK_MIN} spare column: ${maxSafeColumns()}.`,
    });
  }

  if (entries != null) {
    const lid = Math.min(
      Number.isInteger(pathCount) ? pathCount : Infinity,
      Number.isInteger(columns) ? columns : Infinity
    );
    if (!Number.isInteger(entries) || entries < 1) {
      out.push({ key: 'entries', msg: `must be a positive integer — the number of distinct columns the act may be entered from — got ${JSON.stringify(entries)}` });
    } else if (Number.isFinite(lid) && entries > lid) {
      out.push({
        key: 'entries',
        msg: `${entries} entrances is more than this act can open: ${pathCount} walkers across ${columns} columns, so at most ${lid} distinct entrances exist. `
          + `Lower 'entries', or raise whichever of pathCount/columns is the lid.`,
      });
    }
  }

  return out;
}
