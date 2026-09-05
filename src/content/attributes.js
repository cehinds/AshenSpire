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
    id: 'tuned',
    label: 'Tuned',
    baseline: 10,
    bonusPool: 3,
    minimum: 8,
    maximum: 15,
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
    equipmentProfiles: {
      unarmedAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bladeAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      daggerPierceAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      bowPierceAttack: { baseValue: -6, scalingStat: 'strength', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffMagicAttack: { baseValue: -6, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreArcaneAttack: { baseValue: -6, scalingStat: 'wisdom', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      unarmedGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      weaponGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      shieldGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      staffGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
      sceptreGuard: { baseValue: -6, scalingStat: 'dexterity', pointsPerTier: 1, rounding: 'floor', gainPerTier: 1 },
    },
  },
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
  // E5 (#250) — Constantine's own numbers, verbatim from the card: "10 points,
  // configurable; points come back out when a stat is dropped; floor 8, ceiling
  // 15 at creation, both customizable; the floor is the reclaim limit; 15 caps
  // CREATION, not the character."
  //   bonusPool 10        the ten points ("configurable" = it is content, here)
  //   minimum 8 + allow   the floor IS the reclaim limit: a stat may be dropped
  //                       below its baseline down to 8, and fixedTotal hands
  //                       the difference back to the pool by construction
  //   maximum 15          caps creation only — allocationProblems already
  //                       raises the ceiling by levelled points, which is his
  //                       "not the character" clause, shipped before this mode
  // A SECOND MODE, NOT AN EDIT TO `standard`: standard's fixedTotal of 55 is
  // what every existing save is validated against at the load door, and
  // save.js ARCHIVES what fails there. Changing standard's pool would refuse
  // every in-flight run the first boot after update.
  {
    id: 'pointbuy',
    label: 'Assign points',
    baseline: 10,
    bonusPool: 10,
    minimum: 8,
    maximum: 15,
    belowBaseline: 'allow',
    redistribution: 'fixedTotal',
  },
];

// Complete mode × class × attribute product. No Origins are enabled in Phase 1.
// The pointbuy presets are the load-door refill value when a run arrives
// without an explicit allocation — a legal allocation (sum 60, cells 8..15),
// thematically the standard preset with the five extra points laid along each
// class's grain. The editor itself opens from the mode baseline with the whole
// bonus pool unspent; nothing here is an opening recommendation.
export const attributeRules = {
  defaultMode: 'tuned',
  presets: {
    tuned: {
      reaver: { strength: 13, dexterity: 11, constitution: 11, wisdom: 8, intelligence: 10 },
      starseer: { strength: 11, dexterity: 11, constitution: 8, wisdom: 13, intelligence: 10 },
      herald: { strength: 12, dexterity: 11, constitution: 8, wisdom: 12, intelligence: 10 },
      rogue: { strength: 11, dexterity: 13, constitution: 10, wisdom: 9, intelligence: 10 },
    },
    standard: {
      reaver: { strength: 13, dexterity: 10, constitution: 12, wisdom: 10, intelligence: 10 },
      starseer: { strength: 10, dexterity: 11, constitution: 10, wisdom: 10, intelligence: 14 },
      herald: { strength: 10, dexterity: 10, constitution: 12, wisdom: 13, intelligence: 10 },
      rogue: { strength: 10, dexterity: 15, constitution: 10, wisdom: 10, intelligence: 10 },
    },
    pointbuy: {
      reaver: { strength: 14, dexterity: 10, constitution: 14, wisdom: 11, intelligence: 11 },
      starseer: { strength: 10, dexterity: 12, constitution: 11, wisdom: 12, intelligence: 15 },
      herald: { strength: 10, dexterity: 10, constitution: 13, wisdom: 15, intelligence: 12 },
      rogue: { strength: 10, dexterity: 15, constitution: 12, wisdom: 10, intelligence: 13 },
    },
  },
};
