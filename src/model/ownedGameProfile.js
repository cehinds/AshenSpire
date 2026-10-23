import { turnStaminaAliasData } from './turnStamina.js';
// Private identity proof for exact, owned, deeply immutable profile copies.
// This is an immutability proof, never a digest/schema-validation cache.
const ownedProfiles = new WeakMap();

export function ownGameProfile(profile, freezeFallback) {
  return pinGameProfileCopy(structuredClone(profile), freezeFallback);
}

// Restore already owns a whole native-cloned snapshot graph. Pin its profile
// in place so profile aliases elsewhere in that private graph remain aliases.
export function pinGameProfileCopy(copy, freezeFallback) {
  if (!copy || typeof copy !== 'object') return freezeFallback(copy);
  const members = new WeakSet(), visiting = new WeakSet(), ordered = [];
  function collect(value) {
    if (value === null || ['string', 'boolean'].includes(typeof value)) return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (!value || typeof value !== 'object' || visiting.has(value)) return false;
    if (members.has(value)) return true;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
    visiting.add(value);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) continue;
      if (!('value' in descriptor) || !collect(descriptor.value)) return false;
    }
    visiting.delete(value);
    members.add(value); ordered.push(value);
    return true;
  }
  // Unsupported values retain the previous ownership boundary behavior rather
  // than introducing a new rejection rule for callers of create/restore.
  if (!collect(copy)) return freezeFallback(copy);
  for (const value of ordered) Object.freeze(value);
  ownedProfiles.set(copy, members);
  return copy;
}

/** Return a shareable profile only if removing it preserves the cloned graph.
 * Accessors and unsupported containers conservatively keep structuredClone's
 * original behavior, without evaluating an accessor a second time.
 */
export function shareableGameProfile(data) {
  const profile = data.gameProfile, members = ownedProfiles.get(profile);
  if (!members) return null;
  const visited = new WeakSet();
  function separate(value) {
    if (!value || typeof value !== 'object') return true;
    if (members.has(value)) return false;
    if (visited.has(value)) return true;
    const proto = Object.getPrototypeOf(value);
    if (proto === Map.prototype) {
      // Every live fight has a triggerState Map. Inspect native entries only;
      // structuredClone still owns its graph/alias/cycle reconstruction.
      let entries;
      try { entries = Map.prototype.entries.call(value); } catch { return false; }
      visited.add(value);
      for (const [key, item] of entries) if (!separate(key) || !separate(item)) return false;
      return true;
    }
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) return false;
    visited.add(value);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) continue;
      const data = 'value' in descriptor ? descriptor : turnStaminaAliasData(value, key, descriptor);
      if (!data || !separate(data.value)) return false;
    }
    return true;
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(data))) {
    if (key === 'gameProfile' || !descriptor.enumerable) continue;
    if (!('value' in descriptor) || !separate(descriptor.value)) return null;
  }
  return profile;
}
