// Memoised front for fixCoreMechanics.fixCoreRules.
//
// Combat asks for the effective FixCore rules thousands of times a fight (every
// hit-% preview, every evasion and precision read). Each call re-validated the
// raw rules, rebuilt the attachment rows, keyed and fetched the compiled
// bindings and queried five families, about 80 microseconds on a desktop and a
// fifth of the engine's time on a throttled phone. The answer is a pure
// function of the raw rules and the attachment rows, so the repeat call is
// keyed on exactly those two inputs as JSON (the rules' text is memoised by
// identity only for a deeply frozen rules object, see rawText): a
// status gained, a mount swapped or a rules edit changes the key and misses.
// A failing call is never stored; a key that cannot round-trip through JSON
// (NaN, Infinity, or an undefined array slot, which all print as null there) is
// not cached at all. A real null is kept: `elements.burn.cap: null` means "no cap".
//
// This lives beside fixCoreMechanics.js rather than inside it because that
// file is part of the mechanics runtime hash (tools/game-config.mjs), and a
// cache must not move the save-compatibility pin.
import { fixCoreRules as computeFixCoreRules, fixCoreAttachments } from './fixCoreMechanics.js';
import { deepFreeze } from '../framework/compiler.js';

const CACHE_MAX = 512;
const cache = new Map();

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

// Throws for a value JSON would turn into null by accident, so the caller skips the cache.
function lossless(_key, value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('not round-trippable');
  if (value === undefined && Array.isArray(this)) throw new TypeError('not round-trippable');
  return value;
}

// The raw rules are by far the largest part of the key (about 4 KB of JSON) and
// are the same object for a whole fight, so their text is memoised per object,
// but only when the object can never change: a deeply frozen tree. A frozen
// object stays frozen for ever, so a positive verdict is permanent, and a
// frozen tree can only be replaced, never edited, so a new rules object is a new
// WeakMap key. An unfrozen (or partly frozen) tree may be edited in place, so it
// is stringified on every call exactly as before and never trusted by identity.
const frozenRawText = new WeakMap(); // deeply frozen rules object -> its key text (null: not JSON round-trippable)

function deepFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  for (const inner of Object.values(value)) if (!deepFrozen(inner)) return false;
  return true;
}

function rawText(raw) {
  if (raw === undefined) return '0';
  if (raw === null || typeof raw !== 'object') return JSON.stringify(raw, lossless) ?? null;
  if (frozenRawText.has(raw)) return frozenRawText.get(raw);
  let text;
  try { text = JSON.stringify(raw, lossless); } catch { text = null; }
  if (deepFrozen(raw)) frozenRawText.set(raw, text);
  return text;
}

export function keyFor(ctx, entity, carrier) {
  try {
    const raw = rawText(ctx?.fixCoreRules || ctx?.gameProfile?.fixCoreRules);
    if (raw === null || raw === undefined) return null;
    const attachments = JSON.stringify(fixCoreAttachments(ctx, entity, carrier), lossless);
    return attachments === undefined ? null : `${raw}|${attachments}`;
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
