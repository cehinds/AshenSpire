// src/model/settingsDefaults.js — apply the owner's promoted defaults to a profile.
//
// Pure: settings in, changes out. `settingsDefaultsSeed` in the profile records
// the values the last promotion handed out, which is how a later promotion
// tells "still the default we gave" (follow the new one) from "the player
// chose this" (leave it alone) — the #1254 rule, "settings you have already
// chosen keep their values", made mechanical.

export const SEED_KEY = 'settingsDefaultsSeed';

/**
 * seedSettingsDefaults(settings, defaults) → changes ({} when nothing moves).
 * `defaults` is { version, values }; `values` are setting keys → values.
 */
export function seedSettingsDefaults(settings = {}, defaults = { version: 'none', values: {} }) {
  const values = defaults?.values || {};
  const record = settings[SEED_KEY] && typeof settings[SEED_KEY] === 'object' ? settings[SEED_KEY] : {};
  const changes = {};
  // Only a value this promotion actually gives (or an earlier one gave and the
  // player left alone) is recorded: a player's own value that happens to match
  // is theirs, and a later promotion must not move it.
  const nextRecord = {};
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);
  for (const [key, value] of Object.entries(values)) {
    const stored = settings[key];
    const untouched = stored === undefined || (Object.hasOwn(record, key) && same(stored, record[key]));
    if (!untouched) continue;
    nextRecord[key] = value;
    if (!same(stored, value)) changes[key] = value;
  }
  // A key a previous promotion set and this one dropped goes back to its code
  // default — but only if the player never moved it.
  for (const [key, given] of Object.entries(record)) {
    if (!Object.hasOwn(values, key) && same(settings[key], given)) changes[key] = undefined;
  }
  const recordChanged = JSON.stringify(Object.entries(record).sort()) !== JSON.stringify(Object.entries(nextRecord).sort());
  if (recordChanged) changes[SEED_KEY] = Object.keys(nextRecord).length ? nextRecord : undefined;
  return changes;
}
