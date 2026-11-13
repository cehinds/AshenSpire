// Configurable stance defaults, shared by both combatants.
export const stanceRules = Object.freeze({
  evasionPerStack: 3, sweepPrecisionBase: -1, sweepPerAdditionalTarget: 1,
  roundStartDecay: Object.freeze({ evade: 1 }),
  fallbackPoise: 3,
  smashMultiplier: 1.5, counterMultiplier: 1.5, sweepCounterMultiplier: 2,
  spellSmashWardShare: 0.3, sweepReactionPoise: 3, sweepReactionWard: 3,
  sameStanceDiscount: 1, physicalMinimumSp: 1, magicalMinimumSp: 0,
  // Owner 2026-11-13: each consecutive offensive card (Attack, Smash, Sweep, Ranged) played in the same stance as the previous one
  // adds this much Precision to its hit per repeat: 1st +0, 2nd +1, 3rd +2. A stance change resets the streak.
  sameStancePrecisionPerRepeat: 1,
  offensiveRating: 1, offensivePrecision: 1, defensiveRating: 3,
  entryProtection: 3, defenseRestore: 5, evadeStacks: 1,
  spellStatusStacks: 1, spellBlockShare: 0.3,
  schoolBlockShares: Object.freeze({ frost: 0.5, force: 0.7, alteration: 0.7 }),
});
