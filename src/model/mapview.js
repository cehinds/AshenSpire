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

/** Column pitch and floor pitch of the SVG, in SVG units. */
export const COL_X = 95;
export const ROW_H = 46;

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

export const BOSS_RATIO = 20 / 15;
export const NODE_R = Math.round(
  nodeRadiusFor(TAP_TARGET_DEFAULT, Number(MAP_ZOOM_DEFAULT) / 100, PHONE_UI_ZOOM) * 10
) / 10;
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
 */
export function viewRefusals(config) {
  const out = [];
  if (!config || typeof config !== 'object') return out;
  const { columns, pathCount, entries } = config;

  if (Number.isInteger(columns) && columns > 0) {
    const span = maxFanoutSpan(config);
    const need = spanWidth(span);
    const z = PHONE_VIEW_W / need;
    if (z < ZOOM_MIN) {
      out.push({
        key: 'columns',
        msg: `${columns} columns cannot show a node and everything it connects to on a phone. `
          + `The widest fan-out measured at this width spans ${span} columns = ${Math.round(need)} local px, `
          + `against ${PHONE_VIEW_W} px of map viewport at 390x844 — that needs ${z.toFixed(2)}x and the zoom ladder floors at ${ZOOM_MIN}x. `
          + `Largest act width that still fits: ${maxFittingColumns()} columns.`,
      });
    }
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
