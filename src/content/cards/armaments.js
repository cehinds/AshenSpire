// Item-lent shield Arts and Guardian's combat-only skill. Existing effect DSL.
export const armamentCards = [
  {
    id: 'shieldGuardian', name: 'Guardian', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }],
    textTemplate: 'Gain {block} Block. Add a temporary Enter: Bulwark to your hand. It costs 1 Energy and Exhausts. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }] },
  },
  {
    id: 'guardianBulwark', name: 'Enter: Bulwark', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🛡', effects: [{ op: 'enterStance', stance: 'bulwark' }],
    textTemplate: 'Enter Bulwark Stance. Exhaust.',
    upgrade: { effects: [{ op: 'enterStance', stance: 'bulwark' }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Enter Bulwark Stance. Gain {block} extra Block. Exhaust.' },
  },
  {
    id: 'shieldBastion', name: 'Bastion', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 12 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Gain {weak} Weak. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 16 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'spikedReprisal', name: 'Spiked Reprisal', class: 'colorless', rarity: 'special', cost: 1, type: 'attack',
    keywords: [], icon: '🛡', damageSchool: 'physical', exposureBuildupPerHit: 0,
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  },
];
