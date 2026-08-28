// src/content/attributes.js — authoritative Phase 1 creation-stat data.
//
// These values are inert run identity. Combat, checks, resource pools and
// derived formulas do not read them in Phase 1. `strength` and `dexterity`
// deliberately share display words with existing transient combat statuses;
// they remain separate namespaces until a later feature defines a bridge.

// Constitution is the authored HP and Stamina source. Vigour is the retired
// three-day save spelling; the load door migrates it through retiredNames.js.
//
// `sense` and `disclosure` are the D26 short form (model/disclosure.js).
//
//   sense       ONE player sentence, and it carries NO NUMBER. Every number in
//               a reveal is derived from the table that owns it — a figure
//               typed into prose is a copy nothing syncs (Law 1 clause 2,
//               which calls that a defect "even in tooltip prose"). So this
//               says what the attribute IS; what it FEEDS and what it UNLOCKS
//               are read off derivedStatRules and equipmentRequirements at
//               render time and can never go stale.
//   disclosure  'face' (in the short form) or 'reveal' (behind the tap). All
//               five are face-tier because he named them: "just the starting
//               stats". This is data, not a decision the screen makes.
export const attributes = [
  { id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'face', sense: 'Raw force. Heavy armaments ask for it before they will let you hold them.' },
  { id: 'dexterity', label: 'Dexterity', shortLabel: 'DEX', order: 2, disclosure: 'face', sense: 'Speed of hand — the quick armaments answer to it.' },
  { id: 'constitution', label: 'Constitution', shortLabel: 'CON', order: 3, disclosure: 'face', sense: 'What your body takes before the climb ends.' },
  { id: 'wisdom', label: 'Wisdom', shortLabel: 'WIS', order: 4, disclosure: 'face', sense: 'What you hold in mind, and can pour back out.' },
  { id: 'intelligence', label: 'Intelligence', shortLabel: 'INT', order: 5, disclosure: 'face', sense: 'How much of the Spire you read at once.' },
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
      reaver: { strength: 13, dexterity: 10, constitution: 12, wisdom: 10, intelligence: 10 },
      starseer: { strength: 10, dexterity: 11, constitution: 10, wisdom: 10, intelligence: 14 },
      herald: { strength: 10, dexterity: 10, constitution: 12, wisdom: 13, intelligence: 10 },
    },
  },
};
