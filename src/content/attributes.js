// src/content/attributes.js — authoritative Phase 1 creation-stat data.
//
// These values are inert run identity. Combat, checks, resource pools and
// derived formulas do not read them in Phase 1. `strength` and `dexterity`
// deliberately share display words with existing transient combat statuses;
// they remain separate namespaces until a later feature defines a bridge.

// The HP seat is VIGOUR — his word (D17: "vigour shoudl be 1 hp point per"),
// renamed from 'constitution' 2026-08-14. The dead name is retired in
// retiredNames.js and may not return; saves from the three-day window heal at
// the load door.
export const attributes = [
  { id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1 },
  { id: 'dexterity', label: 'Dexterity', shortLabel: 'DEX', order: 2 },
  { id: 'vigour', label: 'Vigour', shortLabel: 'VIG', order: 3 },
  { id: 'wisdom', label: 'Wisdom', shortLabel: 'WIS', order: 4 },
  { id: 'intelligence', label: 'Intelligence', shortLabel: 'INT', order: 5 },
];

export const creationModes = [
  {
    id: 'standard',
    label: 'Standard',
    baseline: 10,
    bonusPool: 5,
    minimum: 10,
    maximum: 15,
    belowBaseline: 'forbid',
    redistribution: 'fixedTotal',
  },
];

// Complete mode × class × attribute product. No Origins are enabled in Phase 1.
export const attributeRules = {
  defaultMode: 'standard',
  presets: {
    standard: {
      reaver: { strength: 13, dexterity: 10, vigour: 12, wisdom: 10, intelligence: 10 },
      starseer: { strength: 10, dexterity: 11, vigour: 10, wisdom: 10, intelligence: 14 },
      herald: { strength: 10, dexterity: 10, vigour: 12, wisdom: 13, intelligence: 10 },
    },
  },
};
