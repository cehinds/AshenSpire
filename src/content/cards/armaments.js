// Item-lent shield Arts and Guardian's combat-only skill. Existing effect DSL.
export const armamentCards = [
  {
    id: 'shieldGuardian', name: 'Guardian', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "A kite shield of the kind the Court issued its knights, with the strap cut down to fit someone smaller. Such shields are easy to come by on the marches road, where the knights who carried them were stitched to their posts and left standing. Climbers take the shields and leave the knights. The knights, as far as anyone can tell, have not objected.\n\n— marches road talk",
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }],
    textTemplate: 'Gain {block} Block. Add a temporary Enter: Bulwark to your hand. It costs 1 Energy and Exhausts. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'addCard', card: 'guardianBulwark', pile: 'hand', position: 'bottom' }] },
  },
  {
    id: 'guardianBulwark', name: 'Enter: Bulwark', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "The holding stance of the Wardens, which climbers learn from the shields they carry rather than from any Warden. A shield that stood in the Bastion's line keeps the habit, the elders say, and pulls the arm into place. They call this a superstition in the same breath as they tell climbers to carry Bastion shields and not Court ones.\n\n— Marl's Hollow elders",
    keywords: ['exhaust'], icon: '🛡', effects: [{ op: 'enterStance', stance: 'bulwark' }],
    textTemplate: 'Enter Bulwark Stance. Exhaust.',
    upgrade: { effects: [{ op: 'enterStance', stance: 'bulwark' }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Enter Bulwark Stance. Gain {block} extra Block. Exhaust.' },
  },
  {
    id: 'shieldBastion', name: 'Bastion', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    flavor: "A tower shield from the Bastion's walls, heavy as a door and nearly as tall. The Wardens set them in the embrasures to be fought from, not carried. Climbers carry them anyway, reasoning that a wall that moves beats one that does not. The weight bends the carrier forward, which the Wardens used to call the proper posture before the Bastion.\n\n— climbers' talk",
    keywords: ['exhaust'], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 12 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Gain {weak} Weak. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 16 }, { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'spikedReprisal', name: 'Spiked Reprisal', class: 'colorless', rarity: 'special', cost: 1, type: 'attack',
    flavor: "A shield with nails driven through the boss from behind, the work of someone who wanted each blow against it to cost something. The nails came from the Bastion's own gates. The hamlets say a sellsword made it on the night of the Burning, from the gate he had been hired to hold. His name is not known. The shield has passed through many hands since, and none of them has drawn the nails.\n\n— told at the Grave of the Nameless",
    keywords: [], icon: '🛡', damageSchool: 'physical', exposureBuildupPerHit: 0,
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  },
  {
    id: 'rimeThrust',
    flavor: "A spear from the Pale Marches, its point reforged from the broken blade of a Court knight. Marches steel keeps its frost long after it leaves the cold. The ice-fishers who made it say the knight gave them the blade freely, before the Decree, for a winter's worth of fish. The ice-fishers keep no records, so the knight's side of the bargain is not known.\n\n— ice-fishers' talk",
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
    flavor: "An axe from the Dead Foundry of the Cinder Reach, where the fires went out with the Crown Flame and the forges have stayed warm ever since without being lit. Corran, a foundryman, broke it out of a cold mould at dawn and carried it up the Basalt Stair. It is hot along the spine. He says it came out of the mould finished, though nobody had poured it.\n\n— reach mine-camp talk",
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
    flavor: "A ward carried by the Chapel's evening bell-ringers, who rang a chime at vespers to close the day. The bell was taken out of it long ago, leaving only the frame and the ward. Climbers who carry it say it rings at dusk anyway. The Chapel remnant would call that a miracle, if anyone told them.\n\nA Chapel ward, rung at vespers. The bell is gone.\n— cairn-scratch",
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
