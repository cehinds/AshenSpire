// Native corruption is an explicit play price, never an ailment or damage type.
export const corruptedCards = [
  {
    id: 'blightedTransmute', name: 'Blighted Transmute', class: 'colorless', rarity: 'rare', cost: 0, type: 'skill',
    minCombatExpansionVersion: 2, corrupted: true, ashenBlightCost: 12, keywords: ['exhaust'], icon: '⚗',
    effects: [{ op: 'gainEnergy', amount: 3 }, { op: 'draw', amount: 2 }],
    textTemplate: 'Gain {gainEnergy} Stamina. Draw {draw} cards. Pay 12 Ashen Blight. Exhaust.',
    flavor: 'An ember buys another breath. Its mark remains after the fire is spent.',
  },
  {
    id: 'blightedSecondBloom', name: 'Blighted Second Bloom', class: 'herald', rarity: 'rare', cost: 0, type: 'skill',
    minCombatExpansionVersion: 2, corrupted: true, ashenBlightCost: 15, keywords: ['exhaust'], icon: '🌸',
    effects: [{ op: 'heal', target: 'self', amount: 18 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Heal {heal} HP. Draw {draw} card. Pay 15 Ashen Blight. Exhaust.',
    flavor: 'A second flowering beneath black ash. The roots remember the price.',
  },
  {
    id: 'blightedBlightward', name: 'Blighted Blightward', class: 'herald', rarity: 'rare', cost: 0, type: 'skill',
    minCombatExpansionVersion: 2, corrupted: true, ashenBlightCost: 10, keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'gainBarrier', target: 'self', amount: 18 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {gainBarrier} temporary Barrier. Draw {draw} card. Pay 10 Ashen Blight. Exhaust.',
    flavor: 'The brand flares outward, sheltering the body while darkening what remains within.',
  },
];
export const CORRUPTED_CARD_IDS = Object.freeze(corruptedCards.map(card => card.id));
