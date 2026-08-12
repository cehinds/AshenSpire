// src/model/mapview.js — the act map's VIEW GEOMETRY, and the one place that
// turns it into an answer about whether a knob is satisfiable.
//
// WHY THIS FILE EXISTS. Constantine asked the map to open "zoomed in close
// enough that the current node and its connecting nodes fit." That is not a
// preference, it is arithmetic: how wide is the thing we must show, how wide is
// the space we have, what zoom relates them. Until now the two halves of that
// arithmetic lived in different worlds — the column pitch and the zoom ladder in
// `ui/screens/map.js`, the `columns` knob in `content/mapconfig.js`, and nothing
// anywhere that could answer "does this act's width fit on a phone?".
//
// So the numbers move here, once, and get three readers (Law 0 clause 4, one
// home per fact):
//
//   ui/screens/map.js   draws with them, and computes the opening zoom from them
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

/** Column pitch of the SVG, in SVG units. Floor pitch is derived below. */
export const COL_X = 95;

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
 */
export const NODE_PITCH_MIN_PX = 48;

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
 * THE ZOOM THE GEOMETRY IS SOLVED AT — one home, because the radius and both
 * margins below all need it and three copies of `Number(MAP_ZOOM_DEFAULT) / 100`
 * is the second-copy defect in miniature.
 *
 * IT CAN BE NaN, AND NAMING THAT IS PART OF THIS COMMIT. `MAP_ZOOM_DEFAULT`
 * legally holds `'Fit'`, and its own comment says flipping the token "is the
 * whole change" and "nothing else moves". `Number('Fit')` is NaN — so on that
 * flip the node radius, the boss radius, both margins and every circle on the
 * screen go NaN today. That sentence is true-looking prose over code that does
 * something else, which is the shape of three of tonight's defects.
 *
 * I did NOT repair the flip: what zoom the geometry should be solved at when the
 * default IS the computed frame is a design call (Sunna holds #107 on that
 * token), not arithmetic I get to pick at 4am. What I did is make it impossible
 * for it to arrive quietly — `nodeAir` refuses BY NAME on a reference zoom that
 * is not a number, and `mapplan --selftest` carries the row that watches it.
 */
export const REF_ZOOM = Number(MAP_ZOOM_DEFAULT) / 100;

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
 *
 * A VERDICT HAS NO DERIVATIVE; A MARGIN DOES. Both axes compute one below, both
 * refusals print it, and each margin has a floor that can go red. The floors sit
 * BELOW today's values on purpose: today is legal, and the whole point is that
 * the next change to NODE_R, ROW_H, COL_X or `balance.ui.tapSize.def` cannot
 * quietly eat what is left.
 *
 * Scaling every geometric term together is a no-op under Fit: multiply COL_X,
 * ROW_H and NODE_R by k and Fit divides zoom by k. The floor pitch is therefore
 * derived from DEVICE space while COL_X and NODE_R keep their own jobs.
 * `tools/mapspacing.mjs` reads the rendered result at both phone shapes and both
 * zoom modes; source constants are not allowed to grade themselves.
 *
 * DIVISION OF LABOUR BETWEEN THE TWO FLOORS, since neither watches everything:
 * the vertical floor is what binds NODE_R and ROW_H tightly; the horizontal
 * floor is what binds COL_X tightly. Each axis watches the constant that lives
 * on it, and both print the next value that would take them red.
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
 * FLOOR 2, VERTICAL — the air between two adjacent floors' node circles, in
 * DEVICE px, at the smallest shape this game claims (320x640).
 *
 * TWO, and the whole reason, because a threshold is a judgement and should read
 * as one:
 *
 *   · It is BELOW both numbers Sunna measured (2.9 px at 390, 2.75 at 320), so
 *     today is legal and the floor was not fitted to the reading I liked.
 *   · It is not ONE: the chain SVG unit -> local px -> device px rounds at the
 *     top of one circle and the bottom of the next, and a 1 px claim of air
 *     cannot survive two roundings. Two is the smallest air still air afterwards.
 *   · It is a floor on AIR, never on target size. The target size question was
 *     answered by `nodeRadiusFor` and is not re-asked here.
 *
 * THE DERIVATION IS THE OPTIMISTIC HALF AND SAYS SO. At 08e184a it predicted
 * 3.52 device px at 390 while the screen delivered 2.9. A floor cleared here is
 * not a floor cleared on glass; `tools/mapspacing.mjs` now owns that reading.
 *
 * What this floor buys — the largest tap default and the smallest row pitch that
 * still clear it — is DERIVED by `nodeAir` and printed, never typed here, so this
 * comment cannot rot into a number that stopped being true.
 *
 * Sunna owns whether the air needs a mercy control at all. This is the
 * engineering floor beneath her question, not an answer to it.
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
 * nodeAir(tapPx, refZoom) -> the VERTICAL margin: the air between two adjacent
 * floors' node circles, in the space the constants live in and in the device px a
 * thumb meets, at both reference shapes.
 *
 * It takes its inputs rather than reading the module's consts so the corpus can
 * ask it about a tap default the game does not ship. `why` names WHICH input made
 * it unanswerable, because "the geometry is NaN" and "the nodes touch" are two
 * different failures and a reader must not have to guess which one they have.
 */
export function nodeAir(tapPx = TAP_TARGET_DEFAULT, refZoom = REF_ZOOM) {
  const base = { tapPx, refZoom, pitch: ROW_H, floorPx: NODE_AIR_MIN_PX };
  const dead = { r: NaN, gap: NaN, px390: NaN, px320: NaN, minGap: NaN, minPitch: NaN, ok: false };
  if (!Number.isFinite(refZoom) || refZoom <= 0) return { ...base, ...dead, why: 'no-reference-zoom' };
  if (!Number.isFinite(tapPx) || tapPx <= 0) return { ...base, ...dead, why: 'no-tap-target' };
  const r = nodeRadiusFromTap(tapPx, refZoom);
  const gap = ROW_H - 2 * r;
  const px = (uiZoom) => gap * refZoom * uiZoom;
  // The SVG-unit gap that would deliver exactly the floor at the deciding shape.
  const minGap = NODE_AIR_MIN_PX / (refZoom * PHONE_UI_ZOOM_MIN);
  const px320 = px(PHONE_UI_ZOOM_MIN);
  return {
    ...base,
    r,
    gap,
    px390: px(PHONE_UI_ZOOM),
    px320,
    minGap,
    minPitch: 2 * r + minGap,
    ok: px320 >= NODE_AIR_MIN_PX,
    why: px320 >= NODE_AIR_MIN_PX ? null : 'air',
  };
}

/**
 * The largest `balance.ui.tapSize.def` that still clears the vertical floor —
 * derived by asking, so the day ROW_H or the reference zoom moves this answer
 * moves with them and nothing has to remember to edit a number.
 */
export function maxTapDefault(refZoom = REF_ZOOM) {
  let best = 0;
  for (let t = 1; t <= 400; t++) if (nodeAir(t, refZoom).ok) best = t;
  return best;
}

/**
 * geometryRefusals(balance) -> [{ key, msg }]
 *
 * THE VERTICAL AXIS'S REFUSAL, and it is a CONTENT refusal because it has exactly
 * one data input: `balance.ui.tapSize.def`, which is what the node radius is
 * solved from. Everything else it reads (ROW_H, the reference zoom, both measured
 * `--ui-zoom` values) is code — so this is the boot-time half of Law 1 clause 5
 * for the one entry an author can turn that silently closes the gap between two
 * irreversible taps.
 *
 * Separate from `viewRefusals` because it is not per-act: it is asked ONCE of the
 * bundle, not once per `mapConfigs` key, and three identical errors would be
 * three copies of one fact.
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
  // above it would otherwise die green at one particular state of the tree,
  // which is the hazard my own `--mutate` hit earlier tonight. `NODE_R` is
  // solved from this entry at module load with no fallback: delete it and every
  // radius on the map is NaN, while a refusal guarded on `tapSize != null` says
  // nothing at all. A bundle that carries a `balance` must be able to answer it.
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) || spec.def == null) {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `missing — the map node's radius is SOLVED from it (model/mapview.js NODE_R) with no fallback, `
        + `so its absence is not a default: every node circle, the boss circle and both map margins resolve to NaN. `
        + `A bundle with a 'balance' must carry it.`,
    });
    return out;
  }
  const air = nodeAir(spec.def);
  if (air.ok) return out;

  if (air.why === 'no-reference-zoom') {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `the map's node radius cannot be derived from this entry: model/mapview.js solves it at `
        + `MAP_ZOOM_DEFAULT = ${JSON.stringify(MAP_ZOOM_DEFAULT)}, which is not a percentage, so the reference zoom is `
        + `${air.refZoom} and every radius, every boss circle and both map margins are NaN. `
        + `The comment on that const says flipping it to 'Fit' is the whole change and nothing else moves — this is the part that moves.`,
    });
    return out;
  }
  if (air.why === 'no-tap-target') {
    out.push({
      key: 'balance.ui.tapSize.def',
      msg: `must be a positive number of device px — the map node radius is solved from it — got ${JSON.stringify(spec.def)}`,
    });
    return out;
  }
  out.push({
    key: 'balance.ui.tapSize.def',
    msg: `${spec.def} px map nodes leave ${air.gap.toFixed(1)} SVG units between two adjacent floors' circles: `
      + `${air.px320.toFixed(2)} device px of air at 320x640 and ${air.px390.toFixed(2)} at 390x844, `
      + `against a floor of ${NODE_AIR_MIN_PX} px of air between two adjacent, irreversible taps. `
      + `The node radius is DERIVED from this entry (${air.r} SVG units at ${(air.refZoom * 100).toFixed(0)}%), so raising it grows the target `
      + `and eats the space BETWEEN targets in the same stroke — the row pitch ROW_H is ${ROW_H} SVG units and does not move with it. `
      + `Largest default that still clears the floor: ${maxTapDefault()} px. `
      + `Smallest row pitch that would clear it at ${spec.def} px: ${air.minPitch.toFixed(2)} SVG units.`,
  });
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
