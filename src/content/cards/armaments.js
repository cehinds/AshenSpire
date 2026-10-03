// Item-lent shield Arts and Guardian's combat-only skill. Existing effect DSL.
export const armamentCards = [
  {
    id: 'shieldGuardian', name: 'Guardian', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "Kite shield of the Court's knights, its strap cut short.\n\nSuch shields lie easily found upon the marches road, where the knights who bore them were stitched to their posts and left standing. Climbers take the shields and leave the knights.\n\nThe knights have not objected.",
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }],
    textTemplate: 'Gain {block} Block. Add a temporary Enter: Bulwark to your hand. It costs 1 Energy and Exhausts. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }] },
  },
  {
    id: 'guardianBulwark', name: 'Enter: Bulwark', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "The Wardens' holding stance, learned from the shield.\n\nA shield that stood in the Bastion's line keeps the habit, the elders say, and pulls the arm into place. They call it superstition.\n\nThey tell climbers to carry Bastion shields, and never Court ones.",
    keywords: ['exhaust'], icon: '🛡', effects: [{ op: 'enterStance', stance: 'bulwark' }],
    textTemplate: 'Enter Bulwark Stance. Exhaust.',
    upgrade: { effects: [{ op: 'enterStance', stance: 'bulwark' }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Enter Bulwark Stance. Gain {block} extra Block. Exhaust.' },
  },
  {
    id: 'shieldBastion', name: 'Bastion', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "Tower shield from the Bastion's walls.\n\nHeavy as a door, nearly as tall. The Wardens set such shields in the embrasures to fight from, never to carry. Climbers carry them regardless, for a moving wall is better than a still one.\n\nThe weight bows the bearer forward, as the Wardens once bowed before the Bastion.",
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 12 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Gain {weak} Weak. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 16 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'spikedReprisal', name: 'Spiked Reprisal', class: 'colorless', rarity: 'special', cost: 1, type: 'attack',
    flavor: "Shield with nails driven through the boss.\n\nThe nails are from the Bastion's own gates. It is said a sellsword made it on the night of the Burning, from the gate he was hired to hold. His name is not known.\n\nNo bearer since has drawn the nails.",
    keywords: [], icon: '🛡', damageSchool: 'physical', exposureBuildupPerHit: 0,
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  },
  {
    id: 'rimeThrust',
    flavor: "Frost spear of the Pale Marches.\n\nIts point was reforged from the broken blade of a Court knight, and marches steel keeps its frost long after leaving the cold. The ice-fishers who made it say the knight gave the blade freely, before the Decree, for a winter's fish.\n\nThe ice-fishers keep no records.",
    name: 'Rime Thrust',
    class: 'colorless',
    rarity: 'special',
    cost: 1,
    type: 'attack',
    keywords: [],
    icon: '❄',
    damageSchool: 'physical',
    exposureBuildupPerHit: 0,
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 3 }
    ],
    textTemplate: 'Deal {damage} damage. Apply {frost} Frost.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 4 }
      ]
    }
  },
  {
    id: 'kilnCleave',
    flavor: "Axe of the Dead Foundry.\n\nThe Foundry's fires went out with the Crown Flame, and its forges have been warm ever since, though none has lit them. Corran, a foundryman, broke this axe from a cold mould at dawn and carried it up the Basalt Stair.\n\nHe says no one poured it.",
    name: 'Kiln Cleave',
    class: 'colorless',
    rarity: 'special',
    cost: 2,
    type: 'attack',
    keywords: [],
    icon: '🔥',
    damageSchool: 'physical',
    exposureBuildupPerHit: 0,
    effects: [
      { op: 'damage', target: 'enemy', amount: 10 },
      { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 4 },
      { op: 'poiseDamage', target: 'enemy', amount: 3 }
    ],
    textTemplate: 'Deal {damage} damage. Apply {burn} Burn. Deal {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 13 },
        { op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 5 },
        { op: 'poiseDamage', target: 'enemy', amount: 4 }
      ]
    }
  },
  {
    id: 'vesperWard',
    flavor: "Ward of the Chapel's evening bell-ringers.\n\nA chime rung at vespers to close the day. Its bell was taken long ago; only the frame and the ward remain. Climbers who carry it say it rings at dusk regardless.\n\nA Chapel ward, rung at vespers. The bell is gone.",
    name: 'Vesper Ward',
    class: 'colorless',
    rarity: 'special',
    cost: 1,
    type: 'skill',
    keywords: [ 'exhaust' ],
    icon: '◈',
    effects: [
      { op: 'block', target: 'self', amount: 7 },
      { op: 'applyStatus', target: 'self', status: 'regen', stacks: 1 }
    ],
    textTemplate: 'Gain {block} Block. Gain {regen} Regen. Exhaust.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 10 },
        { op: 'applyStatus', target: 'self', status: 'regen', stacks: 1 }
      ]
    }
  },
];
