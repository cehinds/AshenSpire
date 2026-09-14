// src/ui/models/SettingsWorkspaceModel.js — W1a Settings, decided without a DOM.
//
// Three presentation questions, each answered from numbers the caller measured
// and the budget in `wireframeUi.settings`:
//
//   1. RAIL OR SELECTOR. W1 puts categories in a left rail on wide hosts and a
//      single selector above the pane on compact ones. A rail needs the host to
//      be wide enough for rail plus pane, and needs every category to fit at the
//      tap floor inside the W1 body band. When either fails, the selector is
//      used. A small hysteresis keeps a host near the edge from flapping.
//   2. WHICH CATEGORY IS NEXT for the LB/RB and [ / ] ring: wrap at both ends.
//   3. WHICH ROWS SHOW HELP. W1a shows help only where a setting's effect is
//      not obvious. Live feedback (a condition note, a capability status) is
//      not help and is never hidden.
//
// Nothing here reads the document or changes a setting.

import { wireframeUi } from '../../content/wireframeUi.js';

export const SETTINGS_NAV_MODES = Object.freeze(['rail', 'selector']);

const positive = (value) => Number.isFinite(value) && value > 0;

/**
 * settingsNavigationPlan(measure, config) → { mode, measured, … }
 *
 * `measure` is in the host's own CSS px (after dividing out --ui-zoom):
 *   hostWidthPx       width of the container Settings is drawn into
 *   viewportHeightPx  visible viewport height
 *   rootFontPx        one rem
 *   itemMinHeightPx   a category control's resolved min-height (the tap floor)
 *   categoryCount     categories that will draw
 *   current           the mode now on screen, for hysteresis (optional)
 *
 * An unmeasured host (not laid out yet) keeps `current`, or starts as a rail,
 * and reports `measured: false`; the caller measures again once it has a box.
 */
export function settingsNavigationPlan(measure = {}, config = wireframeUi.settings) {
  const {
    hostWidthPx, viewportHeightPx, rootFontPx, itemMinHeightPx,
    categoryCount = 0, current = null,
  } = measure;
  const kept = SETTINGS_NAV_MODES.includes(current) ? current : 'rail';
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

/** stepCategory(categories, current, delta) → the next id, wrapping at both ends. */
export function stepCategory(categories, current, delta) {
  const list = Array.isArray(categories) ? categories : [];
  if (!list.length) return null;
  const at = Math.max(0, list.indexOf(current));
  const step = Math.trunc(delta) || 0;
  return list[(((at + step) % list.length) + list.length) % list.length];
}

/**
 * settingsRowShowsHelp(row) → should the row's note be drawn?
 *
 * A row marks itself `selfEvident` when its label already says what it does.
 * A note written as a function reports live state (Music's condition line), and
 * an `action` row carries capability status (Fullscreen), so both always show.
 */
export function settingsRowShowsHelp(row) {
  if (!row) return false;
  if (typeof row.note === 'function') return true;
  if (row.type === 'action') return true;
  if (!row.note) return false;
  return row.selfEvident !== true;
}
