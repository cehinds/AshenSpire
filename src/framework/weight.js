// src/framework/weight.js — Weight Class and Dodge Roll (framework contract:
// Weight Class and Dodge Roll). Thresholds, modifiers and costs are data rows
// in content/framework/mechanics.json, never constants here.

import { mechanics } from './data/mechanics.js';

export function carryCapacity({ constitution, strength, bonuses = 0 }) {
  return mechanics.weight.capacityBase
    + mechanics.weight.capacityPerConstitution * constitution
    + mechanics.weight.capacityPerStrength * strength
    + bonuses;
}

export function equipLoad({ mainHandWeight = 0, offHandWeight = 0, armorWeight = 0, otherCountedWeight = 0 }) {
  // Rounded to a tenth: scaled piece weights (itemWeightScale) are tenths.
  return Math.round((mainHandWeight + offHandWeight + armorWeight + otherCountedWeight) * 10) / 10;
}

export function loadPercent(load, capacity) {
  // Loads are tenths (itemWeightScale); work in whole tenths so 4.6 / 10 is
  // 46%, not the 45% that 100 * 4.6 = 459.99… floors to.
  return Math.floor((10 * Math.round(10 * load)) / Math.max(1, capacity));
}

export function weightClassFor(percent) {
  for (const cls of mechanics.weight.classes) {
    if (percent <= cls.maxLoadPercent) return cls;
  }
  return mechanics.weight.classes[mechanics.weight.classes.length - 1];
}

export function computeWeightClass({ constitution, strength, bonuses = 0, weights }) {
  const capacity = carryCapacity({ constitution, strength, bonuses });
  const load = equipLoad(weights);
  const percent = loadPercent(load, capacity);
  return { capacity, load, percent, weightClass: weightClassFor(percent) };
}

/**
 * attributeModifier(score, attributeMode) — the Dexterity term of the dodge:
 * floor((score − centre) / per). The centre is the run's creation mode's row
 * (mechanics.dodgeRoll `dexterityCentreByMode`, the lean scale's 3), or
 * `dexterityCentre` (the d20-scale 10) for a run made under an older mode,
 * so a save from an older scale keeps the dodge it was made with.
 */
export function attributeModifier(score, attributeMode = undefined) {
  const { dexterityCentre, dexterityCentreByMode = {}, dexterityPerModifier } = mechanics.dodgeRoll;
  // No sheet (a fixture, a foundation fight) reads as the centre: no term.
  if (!Number.isFinite(score)) return 0;
  const centre = Object.hasOwn(dexterityCentreByMode, attributeMode) ? dexterityCentreByMode[attributeMode] : dexterityCentre;
  return Math.floor((score - centre) / Math.max(1, dexterityPerModifier));
}

/**
 * dodgeRollCheck — d20 + DEX modifier + weight-class evasion + other evasion,
 * against base difficulty + source/attack property modifiers. `roll` is the
 * already-rolled d20 (the caller owns randomness; this stays deterministic).
 */
export function dodgeRollCheck({
  roll, dexterity, attributeMode = undefined, weightClass, otherEvasionModifiers = 0,
  baseDifficulty = mechanics.dodgeRoll.baseDifficulty,
  sourceCombatantModifier = 0, incomingAttackModifier = 0,
}) {
  if (!Number.isInteger(roll) || roll < 1 || roll > mechanics.dodgeRoll.die) {
    throw new Error(`dodge roll: roll ${roll} is not a d${mechanics.dodgeRoll.die} result`);
  }
  const check = roll + attributeModifier(dexterity, attributeMode) + weightClass.evasionModifier + otherEvasionModifiers;
  const difficulty = baseDifficulty + sourceCombatantModifier + incomingAttackModifier;
  const success = check > difficulty;
  return {
    check,
    difficulty,
    success,
    temporaryGuard: success
      ? mechanics.dodgeRoll.temporaryGuardBase + attributeModifier(dexterity, attributeMode) + weightClass.temporaryGuardModifier
      : 0,
    cost: { stamina: weightClass.dodgeStaminaCost, actions: weightClass.dodgeActionCost },
  };
}
