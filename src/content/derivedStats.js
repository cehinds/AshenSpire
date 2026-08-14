// src/content/derivedStats.js — shipping authority for derived-stat rules.
//
// The content registry validates this table, and run creation snapshots its
// resolved rules so saves, sessions, and co-op keep the same derived values.

export const derivedStatRules = {
  rulesetVersion: 2,
  defaults: {
    pointsPerTier: 5,
    rounding: 'floor',
    cap: null,
  },
  rules: {
    energy: {
      base: 1,
      sourceStat: 'dexterity',
      gainPerTier: 1,
      cap: null,
    },
    draw: {
      base: 3,
      sourceStat: 'intelligence',
      gainPerTier: 1,
      cap: null,
    },
    hp: {
      base: { strategy: 'classField', field: 'maxHp' },
      sourceStat: 'vigour',
      // "vigour shoudl be 1 hp point per" — Constantine, D17 (verbatim,
      // commons/decisions/directions.md): HP pays per POINT, so this row
      // overrides the 5-point tier default. Every other row keeps the tier —
      // strength's "+1 damange per every 5 points" is per-5 by the same
      // sentence, and the mock's "1 per 5 points" lines he left standing.
      pointsPerTier: 1,
      gainPerTier: 1,
    },
    stamina: {
      base: 0,
      sourceStat: 'vigour',
      gainPerTier: 1,
    },
    mana: {
      // Small-unit pool: WIS is the only authored Mana authority. Classes do
      // not carry a second base pool that can drift from this row.
      base: 0,
      sourceStat: 'wisdom',
      gainPerTier: 1,
      cap: null,
    },
  },
};
