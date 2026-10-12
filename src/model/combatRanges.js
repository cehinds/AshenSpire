// The one home of the combat range vocabulary (owner, 2026-10-12): every card
// profile, weapon, tag and tuning table names a range as melee, reach or
// ranged. Runs frozen before the rename stored contact, near and far; they read
// through LEGACY_RANGE, so an old save validates and plays identically.

export const RANGES = Object.freeze(['melee', 'reach', 'ranged']);

/** Pre-rename value → current value. Read-only alias; saves are never rewritten here. */
export const LEGACY_RANGE = Object.freeze({ contact: 'melee', near: 'reach', far: 'ranged' });

/** A range value in either vocabulary → the current one; anything else is returned unchanged. */
export function normalizeRange(value) {
  return Object.prototype.hasOwnProperty.call(LEGACY_RANGE, value) ? LEGACY_RANGE[value] : value;
}

export function isRange(value) {
  return RANGES.includes(value);
}
