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
      sourceStat: 'constitution',
      gainPerTier: 1,
    },
    stamina: {
      base: 0,
      sourceStat: 'constitution',
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
