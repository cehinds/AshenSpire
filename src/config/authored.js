// src/config/authored.js — hand a config table to a module in the SHAPE that
// module used to hand it out.
//
// uiConfig is deep-frozen, and most of the tables that moved into
// content/config were deep-frozen before they moved, so most shims serve the
// compiled value straight and this file is not involved.
//
// Some were not. `Object.freeze` is shallow, so `Object.freeze({ levels: [...] })`
// froze the wrapper and left the array inside writable, and several tables —
// NODE_TYPES, MENU_TABS, PAD_BUTTONS — were plain literals with no freeze at
// all. Deep-freezing those on the way through would have been a quiet change to
// what a consumer is allowed to do with what it is given, and one consumer does
// exactly the thing that would have broken: tools/surfaces.mjs's known-bad
// corpus plants each defect by mutating ONE table in memory, "exactly the way an
// author would by hand", and a frozen MENU_TABS turns that plant into a
// TypeError instead of the red it is supposed to produce.
//
// So the shims reproduce the old freeze depth exactly. The JSON stays the one
// authority; what changes hands is a copy, which is strictly safer than the old
// arrangement — a consumer that scribbles on its table can no longer reach the
// config through it.

/**
 * A deep, fully mutable copy of a compiled config value.
 *
 * Plain data only, which is all content/config can hold: objects, arrays,
 * strings, numbers, booleans and null. Key order is preserved, because these
 * tables are iterated (legendEntries walks NODE_TYPES, menuRows walks bands).
 */
export function thaw(value) {
  if (Array.isArray(value)) return value.map(thaw);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = thaw(v);
    return out;
  }
  return value;
}

/**
 * A copy whose OUTER object is frozen and whose contents are not — what
 * `Object.freeze({ … })` around a literal actually produced.
 */
export function shallowFrozen(value) {
  return Object.freeze(thaw(value));
}
