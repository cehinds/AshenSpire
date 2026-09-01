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
  return mainHandWeight + offHandWeight + armorWeight + otherCountedWeight;
}

export function loadPercent(load, capacity) {
  return Math.floor((100 * load) / Math.max(1, capacity));
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

export function attributeModifier(score) {
  return Math.floor((score - 10) / 2);
}

/**
 * dodgeRollCheck — d20 + DEX modifier + weight-class evasion + other evasion,
 * against base difficulty + source/attack property modifiers. `roll` is the
 * already-rolled d20 (the caller owns randomness; this stays deterministic).
 */
export function dodgeRollCheck({
  roll, dexterity, weightClass, otherEvasionModifiers = 0,
  baseDifficulty = mechanics.dodgeRoll.baseDifficulty,
  sourceCombatantModifier = 0, incomingAttackModifier = 0,
}) {
  if (!Number.isInteger(roll) || roll < 1 || roll > mechanics.dodgeRoll.die) {
    throw new Error(`dodge roll: roll ${roll} is not a d${mechanics.dodgeRoll.die} result`);
  }
  const check = roll + attributeModifier(dexterity) + weightClass.evasionModifier + otherEvasionModifiers;
  const difficulty = baseDifficulty + sourceCombatantModifier + incomingAttackModifier;
  const success = check > difficulty;
  return {
    check,
    difficulty,
    success,
    temporaryGuard: success
      ? mechanics.dodgeRoll.temporaryGuardBase + attributeModifier(dexterity) + weightClass.temporaryGuardModifier
      : 0,
    cost: { stamina: weightClass.dodgeStaminaCost, actions: weightClass.dodgeActionCost },
  };
}
