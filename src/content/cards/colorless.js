// src/content/cards/colorless.js — statuses/curses (injected) + neutral
// colorless cards any class can pick up (SPEC §5.2, §1).
//
// The status/curse cards (rarity 'special') are injected by enemies and events;
// unplayability is keyword-driven (SPEC §4.3 note). The playable colorless cards
// (common/uncommon/rare) are class-agnostic utility, sold at Merchants —
// StS-faithful: colorless comes from shops, not standard combat rewards
// (rollShopCards in engine/encounters.js appends them to every class's stock).

export const colorlessCards = [
  // Weapon arts are ordinary loose cards when purchased. Their source items
  // lend mounted copies; the smith uses the existing extractable tag rules.
  {
    id: 'katanaDrawCut', name: 'Draw Cut', class: 'colorless', rarity: 'uncommon', cost: 1, staminaCost: 1, type: 'attack',
    flavor: "Single cut from the scabbard, as it is done beyond the marches.\n\nThe curved blades reached the ring in the years of the Mark Trade, borne by foreign lords who paid to be warm there. They burned with the rest of the marked, far from home, and left their swords where they fell.\n\nThe merchant knows whose each one was. He sells that separately.",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 9 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 12 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  },
  {
    id: 'greatswordSunderingHew', name: 'Sundering Hew', class: 'colorless', rarity: 'uncommon', cost: 2, staminaCost: 1, type: 'attack',
    flavor: "Hew of a Court knight's greatsword.\n\nToo heavy to carry far, and too dear to leave. The corrupted knights pause at the sight of one in a Forsaken's hands, unable to believe an unmarked hand holds their steel.\n\nThat pause is worth the weight.",
    keywords: [], icon: '⚒',
    effects: [{ op: 'damage', target: 'enemy', amount: 16 }, { op: 'poiseDamage', target: 'enemy', amount: 3 }],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 20 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }] },
  },
  // ---- Neutral playable colorless (Merchant stock, SPEC §1) ------------------
  {
    id: 'honedEdge', name: 'Honed Edge', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Whetstone from the cairn.\n\nAt the Grave of the Nameless, the custom is to take one and leave one. The stones are weald sandstone, marches slate, black glass of the reach. One is starstone.\n\nWithin the year, someone always carries it back.",
    keywords: ['exhaust'], icon: '🔩',
    effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
    textTemplate: 'Gain {strength} Strength. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }] },
  },
  {
    id: 'ironSkin', name: 'Iron Skin', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Plate of cold iron, worn where a flame-mark would lie.\n\nFirst worn by the ice-fishers of the Pale Marches in the year of the Decree, when the Court's brand-men came for the unmarked. Such plates are left upon the Grave of the Nameless for those who climb after.\n\nMost have been worn thin by more than one wearer.",
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 8 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 11 }] },
  },
  {
    id: 'fieldDressing', name: 'Field Dressing', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Clean rag, tied to the cairn.\n\nBoiled by someone who expected to need it, and did not return for it. The custom reached the hamlets with Chapel refugees after the Burning; the hamlets kept the custom, and let the prayer go.\n\nSome rags arrive embroidered with names. The hamlets unpick them.",
    keywords: ['exhaust'], icon: '🩹',
    effects: [{ op: 'heal', target: 'self', amount: 8 }],
    textTemplate: 'Heal {heal} HP. Exhaust.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 12 }] },
  },
  {
    id: 'hex', name: 'Hex', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
    flavor: "Sign scratched upon a door.\n\nThe hamlets mark it on houses where someone marked burns slowly within, to keep it from coming out. They learned the sign from the Chapel, which set it upon the houses of the unmarked before the Decree.\n\nThe hamlets call it fair to use it the other way round.",
    keywords: ['exhaust'], icon: '🕯',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
    ],
    textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable. Exhaust.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 3 },
      ],
    },
  },
  {
    id: 'transmute', name: 'Transmute', class: 'colorless', rarity: 'rare', cost: 1, type: 'skill',
    flavor: "Cinder spent in the palm.\n\nFor a moment, the hand that holds it does not shake. The hamlets hold that each cinder was someone once, and forbid spending a cinder one took oneself.\n\nThose who return from the ring have mostly broken that rule.",
    keywords: ['exhaust'], icon: '⚗',
    effects: [
      { op: 'gainEnergy', amount: 2 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} card. Exhaust.',
    upgrade: {
      effects: [
        { op: 'gainEnergy', amount: 2 },
        { op: 'draw', amount: 2 },
      ],
    },
  },
  {
    // The pool's first colorless ATTACK — a neutral multi-hit that rides
    // Strength/Vulnerable well in any class.
    id: 'twinFang', name: 'Twin Fang', class: 'colorless', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Two knives, worn crosswise.\n\nOne for the hound, one for its handler. The weald's blight-hounds were the Wardens' before the Burning, and run yet with Bastion kennelmen who turned with the pack.\n\nA handler may be reasoned with, briefly. Never twice.",
    keywords: [], icon: '🗡',
    effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6, hits: 2 }] },
  },
  {
    id: 'blindingSand', name: 'Blinding Sand', class: 'colorless', rarity: 'common', cost: 0, type: 'skill',
    flavor: "Ash thrown in the eyes.\n\nThe hamlets learned in the first winter that what came out of the weald flinched from ash as the living do. Some took this as proof the corrupted could be saved.\n\nMarl's Hollow took it as proof they could be blinded. Marl's Hollow endures.",
    keywords: ['exhaust'], icon: '🌪',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstring', name: 'Hamstring', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
    flavor: "Cut at the back of the leg.\n\nTaught upon the road with a single instruction: all things of the ring walk, so go for the legs. The saying is scratched on cairns from the weald to the coast, weeks apart.\n\nIt is cut in the same hand on every one.",
    keywords: ['exhaust'], icon: '🦵',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 }] },
  },
  {
    id: 'masterOfStrategy', name: 'Master of Strategy', class: 'colorless', rarity: 'rare', cost: 0, type: 'skill',
    flavor: "Maps scratched upon cairn stones.\n\nLeft by climbers who came back down, or meant to. The hamlet councils copy the true ones and burn the rest, and each winter argue which were which.\n\nThe oldest shows a fourth road leading off the ring toward the coast. It has not been burned.",
    keywords: ['exhaust'], icon: '📜',
    effects: [{ op: 'draw', amount: 3 }],
    textTemplate: 'Draw {draw} cards. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }] },
  },

  // ---- Content-pass additions (round 5) --------------------------------------
  {
    id: 'bashingBlow', name: 'Bashing Blow', class: 'colorless', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Blow of whatever is heavy.\n\nA cudgel, a mallet, a shovel from a mine camp. The reach's miners swing it at things in the lower galleries that were miners once. Foreman Coll says not to look at their hands, which remember the work.\n\nHis camp has lost fewer than any other.",
    keywords: [], icon: '🔨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'poiseDamage', target: 'enemy', amount: 4 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'poiseDamage', target: 'enemy', amount: 6 },
      ],
    },
  },
  {
    id: 'quickGuard', name: 'Quick Guard', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Arm raised upon the viaduct.\n\nThe viaducts are older than the kingdom, and have no rails. Climbers say they were built to carry heat, not people. Those who cross learn to keep one arm raised against the wind.\n\nThe stone has never learned to expect feet.",
    keywords: ['exhaust'], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {block} Block. Draw {draw} card. Exhaust.',
    upgrade: {
      keywords: ['exhaust'],
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'sweepingBlow', name: 'Sweeping Blow', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'attack',
    flavor: "Wide swing for the viaduct.\n\nWhere the corrupted come three abreast and the stone is narrow. The Forsaken councils teach that the viaducts were always built to funnel something, long before there were corrupted to funnel.\n\nThe corrupted walk them because the stone expects a crowd.",
    keywords: [], icon: '🌀',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 6 }],
    textTemplate: 'Deal {damage} damage to ALL enemies.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 8 }] },
  },
  {
    id: 'enfeeble', name: 'Enfeeble', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Sea salt, rubbed into a wound.\n\nThe ship-breakers swear by it. Salt, they say, is the one thing upon the ring the fire has never touched, for nothing written survives the sea.\n\nThey have not seen what the Tidebound Abbey keeps in its boathouse.",
    keywords: ['exhaust'], icon: '💀',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 }],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 4 }] },
  },
  {
    id: 'colossusSmash', name: 'Colossus Smash', class: 'colorless', rarity: 'rare', cost: 2, type: 'attack',
    flavor: "Blow at the joints of something vast.\n\nLearned against the Goldbough Avatar, the heraldic idol kneeling in a clearing of the weald, a sapling grown through it. It does not know the kingdom is gone.\n\nIt is carved stone and gilt. It flinches all the same.",
    keywords: [], icon: '💥',
    effects: [
      { op: 'damage', target: 'enemy', amount: 18 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {vulnerable} Vulnerable.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 24 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
      ],
    },
  },

  // ---- Statuses (the card kind) + curses (enemy/event injected) --------------
  {
    id: 'wound', name: 'Wound', class: 'colorless', rarity: 'special', cost: 0, type: 'status',
    keywords: ['unplayable'], icon: '💢',
    effects: [],
    textTemplate: 'Unplayable.',
    flavor: "A cut that closed wrong.\n\nIt knits into a hard ridge that aches before the weather turns. Climbers call it the road keeping its share.\n\nThe hamlets' older word for it means owed.",
  },
  {
    id: 'dazed', name: 'Dazed', class: 'colorless', rarity: 'special', cost: 0, type: 'status',
    keywords: ['unplayable', 'ethereal'], icon: '💫',
    effects: [],
    textTemplate: 'Unplayable. Ethereal.',
    flavor: "Light behind the eyes, left by a Grave Wisp.\n\nThose who have seen a wisp up close say it looked at them as if reading.\n\nClose your eyes. Do not speak your name until the light is gone.",
  },
  {
    id: 'slimed', name: 'Slimed', class: 'colorless', rarity: 'special', cost: 1, type: 'status',
    keywords: ['exhaust'], icon: '🫠',
    effects: [],
    textTemplate: 'Exhaust.',
    flavor: "Grey muck from the drowned hamlet.\n\nIt clings, and will not wash out in cold water. The hamlet flooded before the Burning, in a flood the Wardens called natural.\n\nIt is warmer than anything in the weald has a right to be.",
  },
  {
    id: 'guilt', name: 'Guilt', class: 'colorless', rarity: 'special', cost: 0, type: 'curse',
    keywords: ['unplayable'], icon: '⛓',
    effects: [],
    onTurnEndInHand: [{ op: 'loseHp', target: 'self', amount: 1, cause: 'curse:guilt' }],
    textTemplate: 'Unplayable. At the end of your turn, if this is in your hand, lose 1 HP.',
    flavor: "What follows looting at the Second Cairn.\n\nThe second time is easier. That is how climbers know the ring has begun on them.",
  },
];
