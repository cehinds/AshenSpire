// Opt-in revision while the three-build gate is evaluated. Ordinary/legacy
// combats remain on their current rules until the run migration is activated.
export const combatRules = {
  id: 'combat-foundations-v1',
  // magicShare: the share of a hit of this type that is MAGIC (Barrier, then
  // Ward) rather than PHYSICAL (Block). 0 is all physical, 1 all magic, and
  // arcane (force) is the hybrid. A card or weapon may override it; the
  // Advanced settings rows read these as their defaults (combatRatings.js).
  damageTypes: {
    slashing: { tag: 'damage:slashing', physical: true, magicShare: 0 },
    piercing: { tag: 'damage:piercing', physical: true, magicShare: 0 },
    blunt: { tag: 'damage:blunt', physical: true, magicShare: 0 },
    fire: { tag: 'damage:fire', physical: false, magicShare: 1 },
    frost: { tag: 'damage:frost', physical: false, magicShare: 1 },
    lightning: { tag: 'damage:lightning', physical: false, magicShare: 1 },
    arcane: { tag: 'damage:arcane', physical: false, magicShare: 0.5 },
    sacred: { tag: 'damage:sacred', physical: false, magicShare: 1 },
    decay: { tag: 'damage:decay', physical: false, magicShare: 1 },
  },
  // The magic share of a MAGIC SCHOOL (a school:<id> tag or a Spell's school).
  // A school whose share is strictly between 0 and 1 splits: its physical part is
  // the physicalType. A school not listed here (illusion) is all magic of its
  // damage type. magicType is the Ward/Barrier type the school's magic part deals.
  schools: {
    force: { magicShare: 0.5, magicType: 'arcane', physicalType: 'blunt' },
    alteration: { magicShare: 0.5, magicType: 'arcane', physicalType: 'blunt' },
    lightning: { magicShare: 1, magicType: 'lightning' },
    fire: { magicShare: 1, magicType: 'fire' },
    frost: { magicShare: 1, magicType: 'frost' },
    divine: { magicShare: 1, magicType: 'sacred' },
    decay: { magicShare: 1, magicType: 'decay' },
  },
  // Melee spell (reach contact or melee, with physical damage) and martial
  // technique (a physical-camp maneuver with spell effects) splits. The shares
  // are the magic part of the card's own damage; the rest is physical.
  magicSplit: { meleeSpell: 0.7, technique: 0.3 },
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
