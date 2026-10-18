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

// Pre-rename key → current key, wherever a frozen rules table or a combat
// snapshot carried one. Values under these keys are range values too.
const LEGACY_KEYS = Object.freeze({
  reaches: 'ranges', strongReaches: 'strongRanges', weakReaches: 'weakRanges',
  nearChance: 'reachChance', farChance: 'rangedChance',
  contactPercent: 'meleePercent', nearEvade: 'reachEvade', farEvade: 'rangedEvade',
});
const legacy = value => typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_RANGE, value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const legacyTag = value => typeof value === 'string' && value.startsWith('reach:') && (legacy(value.slice(6)) || isRange(value.slice(6)));

/** Rename an object's keys in place, keeping their order. */
function renameKeys(object, rename) {
  const entries = Object.entries(object);
  if (!entries.some(([key, value]) => rename(key, value) !== key)) return false;
  for (const [key] of entries) delete object[key];
  for (const [key, value] of entries) object[rename(key, value)] = value;
  return true;
}

/**
 * Bring a frozen rules table or a combat snapshot saved before the range
 * rename forward, in memory: a `reach` field holding contact/near/far becomes
 * `range`, the old table keys (`reaches`, `strongReaches`, `nearChance`,
 * prone `contactPercent`...) take their new names, `areaDifficulty` is keyed
 * by the new values, and `reach:x` tags read `range:x`. The rules are
 * numerically identical, so play does not change. Anything not carrying a
 * legacy range (a numeric animation `reach`, the region id 'reach') is left
 * alone. Mutates `value`; returns true when anything changed.
 */
export function bringRangesForward(value) {
  const seen = new WeakSet();
  let changed = false;
  const walk = (node, parentKey) => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (node instanceof Map || node instanceof Set) { for (const item of node.values()) walk(item, null); return; }
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        if (legacyTag(item)) { node[index] = `range:${normalizeRange(item.slice(6))}`; changed = true; }
        else if (LEGACY_LISTS.has(parentKey) && legacy(item)) { node[index] = LEGACY_RANGE[item]; changed = true; }
        else walk(item, null);
      });
      return;
    }
    if (renameKeys(node, (key, item) => {
      if (key === 'reach' && legacy(item) && !Object.prototype.hasOwnProperty.call(node, 'range')) return 'range';
      if (parentKey === 'areaDifficulty' && legacy(key)) return LEGACY_RANGE[key];
      return Object.prototype.hasOwnProperty.call(LEGACY_KEYS, key) ? LEGACY_KEYS[key] : key;
    })) changed = true;
    for (const [key, item] of Object.entries(node)) {
      if (key === 'range' && legacy(item)) { node[key] = LEGACY_RANGE[item]; changed = true; }
      else walk(item, key);
    }
  };
  walk(value, null);
  return changed;
}
const LEGACY_LISTS = new Set(['ranges', 'strongRanges', 'weakRanges']);
