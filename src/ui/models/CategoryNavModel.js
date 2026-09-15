// src/ui/models/CategoryNavModel.js — W1 category navigation, decided without a DOM.
//
// FRONTEND-WIREFRAMES rule 11: every menu with several categories is W1 — a
// left rail beside the pane on wide hosts, and the same navigation above the
// pane on compact ones as ONE `[Category ▾]` selector that opens the list.
// Never a horizontal strip of tabs, never an accordion. Every categorized W1
// surface asks this file the same questions (the kit's categoryNav wires the
// answers to the page):
//
//   1. RAIL OR SELECTOR, from numbers the caller measured and the budget in
//      `wireframeUi.categoryNav`. A rail needs the host to be wide enough for
//      rail plus pane, and every category to fit at the tap floor inside the
//      W1 body band. When either fails, the selector is used. A small
//      hysteresis keeps a host near the edge from flapping.
//   2. WHAT A KEY DOES while the navigation has focus. The input router owns
//      the arrows and Enter; this answers only Home / End and Escape, and
//      Escape only while the compact list is open (it closes the list, never
//      the door the list is in).
//   3. WHERE THE CURSOR BELONGS: the selector on compact hosts, the selected
//      rail item on wide ones.
//
// Nothing here reads the document.

import { wireframeUi } from '../../content/wireframeUi.js';

export const CATEGORY_NAV_MODES = Object.freeze(['rail', 'selector']);

const positive = (value) => Number.isFinite(value) && value > 0;

/**
 * categoryNavPlan(measure, config) → { mode, measured, … }
 *
 * `measure` is in the host's own CSS px (after dividing out --ui-zoom):
 *   hostWidthPx       width of the element the rail and pane share
 *   viewportHeightPx  visible viewport height
 *   rootFontPx        one rem
 *   itemMinHeightPx   a category control's resolved min-height (the tap floor)
 *   categoryCount     categories that will draw
 *   current           the mode now on screen, for hysteresis (optional)
 *
 * An unmeasured host (not laid out yet) keeps `current`, or starts as a rail,
 * and reports `measured: false`; the caller measures again once it has a box.
 */
export function categoryNavPlan(measure = {}, config = wireframeUi.categoryNav) {
  const {
    hostWidthPx, viewportHeightPx, rootFontPx, itemMinHeightPx,
    categoryCount = 0, current = null,
  } = measure;
  const kept = CATEGORY_NAV_MODES.includes(current) ? current : 'rail';
  if (!positive(hostWidthPx) || !positive(viewportHeightPx) || !positive(rootFontPx)) {
    return Object.freeze({ mode: kept, measured: false });
  }
  const count = Math.max(0, Math.floor(categoryCount));
  const rem = rootFontPx;
  const item = positive(itemMinHeightPx) ? itemMinHeightPx : 0;
  const railHeightPx = count * item
    + Math.max(0, count - 1) * config.railGapRem * rem
    + 2 * config.railInsetRem * rem;
  const bodyHeightPx = viewportHeightPx * config.bodyHeightFraction;
  const minWidthPx = config.railMinHostWidthRem * rem;
  // Leaving the selector for a rail needs a clear margin; staying a rail does not.
  const margin = kept === 'selector' ? config.hysteresisRem * rem : 0;
  const fitsWidth = hostWidthPx >= minWidthPx + margin;
  const fitsHeight = bodyHeightPx >= railHeightPx + margin;
  return Object.freeze({
    mode: fitsWidth && fitsHeight ? 'rail' : 'selector',
    measured: true,
    fitsWidth,
    fitsHeight,
    minWidthPx,
    railHeightPx,
    bodyHeightPx,
  });
}

/**
 * categoryNavKey(key, { mode, open }) → 'close' | 'first' | 'last' | null
 *
 * The keys the navigation answers itself. Arrows, Enter and the pad belong to
 * the input router, so they are null here. Escape is 'close' only while the
 * compact list is open; otherwise it belongs to the door.
 */
export function categoryNavKey(key, { mode = 'rail', open = false } = {}) {
  if (key === 'Escape') return mode === 'selector' && open ? 'close' : null;
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}

/**
 * categoryNavLanding({ mode, open }) → 'selector' | 'selected'
 *
 * Where the cursor belongs: on a compact host the selector, unless its list is
 * open (then the selected category in it); on a wide host the selected rail
 * item. Used for a door's first focus and when the mode changes under focus.
 */
export function categoryNavLanding({ mode = 'rail', open = false } = {}) {
  return mode === 'selector' && !open ? 'selector' : 'selected';
}

/**
 * categoryNavAfterPick({ mode, open }) → { close, focus }
 *
 * A pick from the open compact list closes it and hands focus back to the
 * selector, which now names the pick. A rail pick changes nothing else.
 */
export function categoryNavAfterPick({ mode = 'rail', open = false } = {}) {
  const compact = mode === 'selector' && open;
  return Object.freeze({ close: compact, focus: compact ? 'selector' : null });
}

/**
 * categoryNavFace(parts) → the selector's face: the selected category's label
 * and, when it carries one, its {Status} (a count), one space apart.
 */
export function categoryNavFace(parts = []) {
  return (Array.isArray(parts) ? parts : [parts])
    .map((part) => String(part ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}
