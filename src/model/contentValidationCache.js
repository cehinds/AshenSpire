// Repeated screen entry can validate the same authored projection. Cache only
// a private validation receipt: content, registries, and per-run mastery overlays
// are freshly constructed by the caller and never enter this cache.
function valueKey(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : null;
  if (!value || typeof value !== 'object' || ancestors.has(value)) return null;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return null;
  ancestors.add(value);
  const keys = Array.isArray(value) ? Array.from({ length: value.length }, (_, index) => index) : Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    const part = valueKey(value[key], ancestors);
    if (part === null) { ancestors.delete(value); return null; }
    parts.push(Array.isArray(value) ? part : `${JSON.stringify(key)}:${part}`);
  }
  ancestors.delete(value);
  return Array.isArray(value) ? `[${parts.join(',')}]` : `{${parts.join(',')}}`;
}

function freezePrivate(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezePrivate(child);
  return Object.freeze(value);
}

/** validate(profile, configuration, configured) returns { result, structuralProblems }. */
export function createContentValidationCache(validate) {
  let previousKey = null, previous = null;
  return (profile, configuration, configured) => {
    // Full values, including every profile lock and configuration key, define
    // identity. Unsupported/cyclic values are never allowed to hit the cache.
    const key = valueKey([profile, configuration]);
    if (key !== null && key === previousKey) return structuredClone(previous);
    const projected = validate(profile, configuration, configured);
    if (key !== null && projected.result.ok && !projected.structuralProblems.length) {
      previous = freezePrivate(structuredClone(projected));
      previousKey = key;
    }
    return projected;
  };
}

/**
 * sameContent(a, b) is true when two content bundles hold identical data
 * (functions by identity, Maps/Sets by entries, cycles tolerated). A validation
 * result for one is then the result for the other, so a configured bundle that
 * came out equal to the authored one need not be validated a second time.
 */
export function sameContent(a, b, seen = new Map()) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (seen.get(a) === b) return true;
  const proto = Object.getPrototypeOf(a);
  if (proto !== Object.getPrototypeOf(b)) return false;
  seen.set(a, b);
  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) if (!b.has(key) || !sameContent(value, b.get(key), seen)) return false;
    return true;
  }
  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) if (!sameContent(a[index], b[index], seen)) return false;
    return true;
  }
  const keys = Reflect.ownKeys(a);
  if (keys.length !== Reflect.ownKeys(b).length) return false;
  for (const key of keys) if (!Object.hasOwn(b, key) || !sameContent(a[key], b[key], seen)) return false;
  return true;
}
