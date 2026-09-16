// Opt-in revision while the three-build gate is evaluated. Ordinary/legacy
// combats remain on their current rules until the run migration is activated.
export const combatRules = {
  id: 'combat-foundations-v1',
  damageTypes: {
    slashing: { tag: 'damage:slashing', physical: true },
    piercing: { tag: 'damage:piercing', physical: true },
    blunt: { tag: 'damage:blunt', physical: true },
    fire: { tag: 'damage:fire', physical: false },
    frost: { tag: 'damage:frost', physical: false },
    lightning: { tag: 'damage:lightning', physical: false },
    arcane: { tag: 'damage:arcane', physical: false },
    sacred: { tag: 'damage:sacred', physical: false },
    decay: { tag: 'damage:decay', physical: false },
  },
  armor: { scale: 100, cap: 0.60 },
  resistanceCap: 0.75,
  vulnerabilityCap: 3,
  impact: {
    family: { blade: 0.5, hammer: 0.7, bow: 0.35, focus: 0.5, natural: 0.5 },
    grip: { oneHand: 1, twoHand: 1.2 },
    delivery: { physical: 1, magical: 0.2 },
    minimum: 1, protectionTurns: 1,
  },
  fallbackSource: { id: 'unarmed', family: 'natural', weight: 1, grip: 'oneHand', damageType: 'blunt', tags: [], buildup: [] },
  // Weight stays on the equipped item; these rows only declare impact family.
  // Grip and item-instance upgrades are handled by the subsequent equipment slice.
  equipmentSources: {
    profileFamilies: { bladeAttack: 'blade', daggerPierceAttack: 'blade', bowPierceAttack: 'bow', shieldAttack: 'hammer', staffMagicAttack: 'focus', sceptreArcaneAttack: 'focus' },
    itemFamilies: { warhammer: 'hammer' },
  },
  dodge: { stamina: { light: 1, medium: 2, heavy: 3 }, actions: 0, charges: 1, usesPerTurn: 1 },
  recovery: { staminaPerTurn: 1, manaPerTurn: 0 },
  triggers: { maxEvents: 2048, maxDepth: 16, limitPerAction: 32, chance: 1, rollScope: 'play' },
  stacking: { cap: 99 },
};
