// src/content/flasks.js — the M2 flask set (SPEC §5.5)
//
// 3 slots; found from combats (decaying drop chance, balance.rewards),
// shops, and events. Wondrous Physick is the repo's first — and only —
// scripts.js user (see scripts.js for the justification).

export const flasks = [
  {
    id: 'crimsonFlask',
    name: 'Crimson Flask',
    rarity: 'common',
    icon: '🧪',
    effects: [{ op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 25 } }],
    textTemplate: 'Heal 25% of your max HP.',
  },
  {
    id: 'ceruleanFlask',
    name: 'Cerulean Flask',
    rarity: 'common',
    icon: '🫙',
    effects: [{ op: 'gainEnergy', amount: 2 }],
    textTemplate: 'Gain 2 Energy.',
  },
  {
    id: 'flaskOfFerocity',
    name: 'Flask of Ferocity',
    rarity: 'common',
    icon: '🍶',
    effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
    textTemplate: 'Gain 2 Strength this combat.',
  },
  {
    id: 'flaskOfStone',
    name: 'Flask of Stone',
    rarity: 'common',
    icon: '🏺',
    effects: [{ op: 'block', target: 'self', amount: 15 }],
    textTemplate: 'Gain 15 Block.',
  },
  {
    id: 'rotCoating',
    name: 'Rot Coating',
    rarity: 'uncommon',
    icon: '🦠',
    targeted: true,
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 4 }],
    textTemplate: 'Apply 4 Scarlet Rot to an enemy.',
  },
  {
    id: 'bloodGrease',
    name: 'Blood Grease',
    rarity: 'uncommon',
    icon: '🫗',
    effects: [{ op: 'applyStatus', target: 'self', status: 'bloodGrease', stacks: 1 }],
    textTemplate: 'This turn, your attacks apply 2 extra Bleed per hit.',
  },
  {
    id: 'wondrousPhysick',
    name: 'Wondrous Physick',
    rarity: 'rare',
    icon: '⚗',
    effects: [{ script: 'wondrousPhysick' }],
    textTemplate: 'Gain the effects of two different random flasks at once.',
  },
];
