// src/content/flasks.js — the M2 flask set (SPEC §5.5)
//
// 3 slots; found from combats (decaying drop chance, balance.rewards),
// shops, and events. Wondrous Draught is the repo's first — and only —
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
    id: 'azureFlask',
    name: 'Azure Flask',
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
    id: 'blightCoating',
    name: 'Blight Coating',
    rarity: 'uncommon',
    icon: '🦠',
    targeted: true,
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 4 }],
    textTemplate: 'Apply 4 Crimson Blight to an enemy.',
  },
  {
    id: 'bloodUnction',
    name: 'Blood Unction',
    rarity: 'uncommon',
    icon: '🫗',
    effects: [{ op: 'applyStatus', target: 'self', status: 'bloodUnction', stacks: 1 }],
    textTemplate: 'This turn, your attacks apply 2 extra Bleed per hit.',
  },
  {
    id: 'wondrousDraught',
    name: 'Wondrous Draught',
    rarity: 'rare',
    icon: '⚗',
    effects: [{ script: 'wondrousDraught' }],
    textTemplate: 'Gain the effects of two different random flasks at once.',
  },
];
