// src/ui/models/SettingsWorkspaceModel.js — W1a Settings, decided without a DOM.
//
// Three presentation questions:
//
//   1. RAIL OR SELECTOR. Every categorized W1 surface asks the same model,
//      models/CategoryNavModel.js (`categoryNavPlan`, budget in
//      `wireframeUi.categoryNav`), and the kit's categoryNav wires the answer.
//      `settingsNavigationPlan` is that one function under its W1a name.
//   2. WHICH CATEGORY IS NEXT for the LB/RB and [ / ] ring: wrap at both ends.
//   3. WHICH ROWS SHOW HELP. W1a shows help only where a setting's effect is
//      not obvious. Live feedback (a condition note, a capability status) is
//      not help and is never hidden.
//
// Nothing here reads the document or changes a setting.

import { CATEGORY_NAV_MODES, categoryNavPlan } from './CategoryNavModel.js';

export const SETTINGS_NAV_MODES = CATEGORY_NAV_MODES;

/** settingsNavigationPlan(measure, config) — see CategoryNavModel.categoryNavPlan. */
export const settingsNavigationPlan = categoryNavPlan;

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
