// src/content/derivedStats.js — inert contract for post-Phase-1 derived stats.
//
// Nothing imports this from the shipping content bundle yet. Phase 1 owns the
// attribute allocation and its save/session shape; this table is exercised by
// tools/derivedstats.mjs but remains deliberately outside gameplay wiring.

export const derivedStatRules = {
  rulesetVersion: 1,
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
      // Keep every current class's authored Mana floor when this is eventually
      // wired; Wisdom adds to it instead of silently replacing 40/80/60.
      base: { strategy: 'classField', field: 'maxMana' },
      sourceStat: 'wisdom',
      gainPerTier: 1,
    },
  },
};
