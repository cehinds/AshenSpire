import { fixCoreStatusDefinition } from './fixCoreMechanics.js';
import { keyFor as fixCoreRulesKey } from './fixCoreRulesCache.js';

// UI wording is separate from the versioned mechanic source: changing a label
// must not invalidate saved rules. Keep all configured numeric prose intact.
function present(ctx, id, definition, holder) {
  const resolved = fixCoreStatusDefinition(ctx, id, definition, holder);
  if (id !== 'evade' || resolved === definition) return resolved;
  const display = text => typeof text === 'string' ? text.replace(/\bfixed Evasion\b/g, 'Evasion') : text;
  return { ...resolved, tooltip: display(resolved.tooltip), description: display(resolved.description) };
}

// Memoised front, same discipline as fixCoreRulesCache. The answer is a pure
// function of: whether FixCore is on (three ctx fields), the raw rules and the
// holder's attachment rows (the key fixCoreRulesCache already uses), the status
// id, and the base definition the row is spread from. All of it is keyed as
// JSON, never on object identity. A definition that cannot round-trip through
// JSON (a function, undefined, NaN, a class instance) is not cached at all, and
// neither is an answer that is the caller's own definition (FixCore off).
// Entries are deep-frozen copies; each call gets a fresh top-level object.
const CACHE_MAX = 256;
const cache = new Map();

function plain(value) {
  let ok = true;
  const text = JSON.stringify(value, (key, inner) => {
    if (inner === undefined || typeof inner === 'function' || typeof inner === 'symbol' || typeof inner === 'bigint') ok = false;
    else if (typeof inner === 'number' && !Number.isFinite(inner)) ok = false;
    else if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const proto = Object.getPrototypeOf(inner);
      if (proto !== Object.prototype && proto !== null) ok = false;
    }
    return inner;
  });
  return ok ? text : null;
}

function presentationKey(ctx, id, definition, holder) {
  try {
    const rules = fixCoreRulesKey(ctx, holder, null), base = plain(definition);
    if (rules === null || base === null) return null;
    return JSON.stringify([ctx?.combatExpansionVersion ?? 0, ctx?.fixCoreRules?.version ?? 0,
      ctx?.gameProfile?.modules?.effects?.fixCoreVersion ?? 0, rules, String(id), base]);
  } catch { return null; }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

export function statusPresentationDefinition(ctx, id, definition, holder = null) {
  const key = definition && typeof definition === 'object' ? presentationKey(ctx, id, definition, holder) : null;
  if (key === null) return present(ctx, id, definition, holder);
  let hit = cache.get(key);
  if (!hit) {
    const resolved = present(ctx, id, definition, holder);
    if (resolved === definition || !resolved || typeof resolved !== 'object') return resolved;
    hit = deepFreeze(structuredClone(resolved));
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(key, hit);
  }
  return { ...hit };
}

/** Test seam: the number of distinct stored answers. */
export const statusPresentationCacheSize = () => cache.size;
export const clearStatusPresentationCache = () => cache.clear();
