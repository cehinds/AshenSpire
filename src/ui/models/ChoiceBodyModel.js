// src/ui/models/ChoiceBodyModel.js — the W1s / W1u choice body, DOM-free.
//
// Two screens compose the same body: choices beside what they cost or why they
// are closed (Rest), or authored narrative beside the responses (Event). The
// screens still own every mechanic; this file only projects facts they already
// computed into the header {Status} and the per-row state words, and turns the
// wireframe's viewport shares into CSS lengths.
import { wireframeUi } from '../../content/wireframeUi.js';

const finite = (value, name) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`choiceBody.${name} must be a finite number ≥ 0, got ${value}`);
  return value;
};

/**
 * choiceBodyFrameVars(config) → CSS custom properties for the frame.
 *
 * The body is zoomed (`--ui-zoom`), and a viewport unit under that zoom is
 * measured unzoomed but painted zoomed. Dividing by the zoom keeps each share a
 * share of the visible viewport at every text size.
 */
export function choiceBodyFrameVars(config = wireframeUi.choiceBody) {
  const vw = (name) => `calc(${finite(config[name], name)}vw / var(--ui-zoom, 1))`;
  const vh = (name) => `calc(${finite(config[name], name)}vh / var(--ui-zoom, 1))`;
  const width = finite(config.frameWidthVw, 'frameWidthVw');
  const height = finite(config.frameHeightVh, 'frameHeightVh');
  if (width > 100 || height > 100) throw new Error('choiceBody frame shares cannot exceed the viewport');
  return Object.freeze({
    '--choice-frame-width': vw('frameWidthVw'),
    '--choice-frame-height': vh('frameHeightVh'),
    '--choice-outer-x': `calc(${(100 - width) / 2}vw / var(--ui-zoom, 1))`,
    '--choice-outer-y': `calc(${(100 - height) / 2}vh / var(--ui-zoom, 1))`,
    '--choice-head-min': vh('headerMinVh'),
    '--choice-foot-min': vh('footerMinVh'),
    '--choice-inset-x': vw('sideInsetVw'),
    '--choice-inset-top': vh('topInsetVh'),
    '--choice-column-gap': vw('columnGapVw'),
    '--choice-row-gap': vh('rowGapVh'),
  });
}

/**
 * restChoiceStatus(options) → the W1s {Status} and availability column.
 *
 * `options` are the Shrine's offered choices in display order, each
 * `{ id, available, used }` as the screen already decided them. A used choice
 * (a rest already taken under Multi-use) is neither available nor closed.
 */
export function restChoiceStatus(options = []) {
  const rows = options.map((option) => Object.freeze({
    id: String(option.id),
    state: option.used ? 'used' : option.available ? 'available' : 'unavailable',
  }));
  const count = (state) => rows.filter((row) => row.state === state).length;
  return Object.freeze({
    total: rows.length,
    available: count('available'),
    unavailable: count('unavailable'),
    used: count('used'),
    rows: Object.freeze(rows),
  });
}

/**
 * eventResponseStatus(responses, { resolved }) → the W1u {Status}.
 *
 * `responses` are the visible choices, each `{ index, affordable, priced,
 * binding }`. Before a response is taken the phase is `choose` (every response
 * open) or `limited` (a price shuts one); once taken it is `resolved`, and
 * Continue is allowed.
 */
export function eventResponseStatus(responses = [], { resolved = false } = {}) {
  const rows = responses.map((response) => Object.freeze({
    index: response.index,
    state: response.affordable === false ? 'blocked' : 'available',
    priced: !!response.priced,
    binding: !!response.binding,
  }));
  const available = rows.filter((row) => row.state === 'available').length;
  return Object.freeze({
    total: rows.length,
    available,
    blocked: rows.length - available,
    binding: rows.filter((row) => row.binding).length,
    resolved: !!resolved,
    continueAllowed: !!resolved,
    phase: resolved ? 'resolved' : available < rows.length ? 'limited' : 'choose',
    rows: Object.freeze(rows),
  });
}
