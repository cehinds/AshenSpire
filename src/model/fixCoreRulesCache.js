// Memoised front for fixCoreMechanics.fixCoreRules.
//
// Combat asks for the effective FixCore rules thousands of times a fight (every
// hit-% preview, every evasion and precision read). Each call re-validated the
// raw rules, rebuilt the attachment rows, keyed and fetched the compiled
// bindings and queried five families, about 80 microseconds on a desktop and a
// fifth of the engine's time on a throttled phone. The answer is a pure
// function of the raw rules and the attachment rows, so the repeat call is
// keyed on exactly those two inputs as JSON, never on object identity: a
// status gained, a mount swapped or a rules edit changes the key and misses.
// A failing call is never stored; a key that cannot round-trip through JSON
// (a null, which also stands for NaN/Infinity there) is not cached at all.
//
// This lives beside fixCoreMechanics.js rather than inside it because that
// file is part of the mechanics runtime hash (tools/game-config.mjs), and a
// cache must not move the save-compatibility pin.
import { fixCoreRules as computeFixCoreRules, fixCoreAttachments } from './fixCoreMechanics.js';

const CACHE_MAX = 512;
const cache = new Map();

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

// The uncached answer aliases the raw rules for every field that is not a rule
// family (range, protectionParameters, ...). Stored as is, an entry would keep
// pointing into the first caller's rules object and show that caller's later
// edits to a second caller whose rules merely read the same when it was stored.
// The key is JSON of exactly those rules, so an owned frozen copy is the same
// answer. The family values are already frozen compiled queries.
function detach(result) {
  const out = {};
  for (const [name, value] of Object.entries(result)) {
    out[name] = value && typeof value === 'object' && !Object.isFrozen(value) ? deepFreeze(structuredClone(value)) : value;
  }
  return out;
}

export function keyFor(ctx, entity, carrier) {
  try {
    const raw = ctx?.fixCoreRules || ctx?.gameProfile?.fixCoreRules;
    const key = JSON.stringify([raw === undefined ? 0 : raw, fixCoreAttachments(ctx, entity, carrier)]);
    return key === undefined || key.includes('null') ? null : key;
  } catch { return null; }
}

/** Same contract as fixCoreMechanics.fixCoreRules: a fresh top-level object per call. */
export function fixCoreRules(ctx, entity = null, carrier = null) {
  const key = keyFor(ctx, entity, carrier);
  if (key === null) return computeFixCoreRules(ctx, entity, carrier);
  let hit = cache.get(key);
  if (!hit) {
    hit = detach(computeFixCoreRules(ctx, entity, carrier));
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, hit);
  }
  // Every nested value in an entry is frozen and owned by the cache, so a caller
  // cannot corrupt the next caller's answer. Hand out a fresh top level so a
  // caller assigning to its copy cannot reach the next caller's either.
  return { ...hit };
}

/** Test seam: the number of distinct stored answers. */
export const fixCoreRulesCacheSize = () => cache.size;
export const clearFixCoreRulesCache = () => cache.clear();
