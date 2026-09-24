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
    flavor: "One cut from the scabbard, the way they do it past the marches. These blades came in during the Trade years, carried by foreign lords who paid well to be warm on the ring. They burned with the rest of the marked, a long way from home, and left their swords where they dropped. You'll want to know whose that one was. That costs extra.\n\n— the merchant",
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 9 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 12 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  },
  {
    id: 'greatswordSunderingHew', name: 'Sundering Hew', class: 'colorless', rarity: 'uncommon', cost: 2, staminaCost: 1, type: 'attack',
    flavor: "A two-handed hew with a blade too heavy to carry far. Climbers carry it anyway: the greatswords were forged for the Court's knights, and a Forsaken holding one is a thing the corrupted knights stop to look at. Hamlet folk say the knights hesitate because they cannot believe an unmarked hand is holding their steel, and that the moment of disbelief is worth the weight.\n\n— hamlet saying",
    keywords: [], icon: '⚒',
    effects: [{ op: 'damage', target: 'enemy', amount: 16 }, { op: 'poiseDamage', target: 'enemy', amount: 3 }],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 20 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }] },
  },
  // ---- Neutral playable colorless (Merchant stock, SPEC §1) ------------------
  {
    id: 'honedEdge', name: 'Honed Edge', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    flavor: "A whetstone left on the cairn at the Grave of the Nameless, where the custom is to take one and leave one. The stones are of every sort: weald sandstone, marches slate, black glass from the reach. One is starstone. Climbers take it in turn, and within the year someone always carries it back to the cairn.\n\nWhetstone left on the cairn. Take it, and leave one.\n— cairn-scratch",
    keywords: ['exhaust'], icon: '🔩',
    effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
    textTemplate: 'Gain {strength} Strength. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }] },
  },
  {
    id: 'ironSkin', name: 'Iron Skin', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    flavor: "A plate of cold iron worn under the shirt, over the place a flame-mark would have been. The habit began among the ice-fishers of the Pale Marches, who wore the plates against the Court's brand-men in the year of the Decree. Climbers took it up later. The plates are left at the Grave of the Nameless for whoever comes next, and most have been worn thin by more than one owner.\n\n— told at the Grave of the Nameless",
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 8 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 11 }] },
  },
  {
    id: 'fieldDressing', name: 'Field Dressing', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "A clean rag tied to the cairn, boiled by someone who expected to need it and did not come back for it. The custom of boiling rags reached the hamlets with Chapel refugees after the Burning, and the hamlets kept the custom and dropped the prayer that went with it. Some of the rags arrive embroidered with names. The hamlets consider that bad luck, and unpick them.\n\n— told at the Grave of the Nameless",
    keywords: ['exhaust'], icon: '🩹',
    effects: [{ op: 'heal', target: 'self', amount: 8 }],
    textTemplate: 'Heal {heal} HP. Exhaust.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 12 }] },
  },
  {
    id: 'hex', name: 'Hex', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
    flavor: "A sign scratched on a door to keep what lives inside from coming out. The hamlets use it on houses where someone marked is known to be burning slowly. They learned the sign from the Chapel, which used it in the years before the Decree to mark the houses of the unmarked. The hamlets consider it fair to use the Chapel's sign the other way round.\n\n— Marl's Hollow elders",
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
    flavor: "A cinder spent in the palm before it cools, and for a moment the hand that holds it does not shake. The hamlets hold that each cinder was someone once, and the Forsaken who spend them do not like to be reminded. There is a rule in the hamlets against spending a cinder you took yourself. Climbers who come back down from the ring have usually broken it.\n\n— hamlet council minute",
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
    flavor: "Two knives worn crosswise, one for the hound and one for its handler. The weald's blight-hounds belonged to the Wardens before the Burning, and they run with handlers still: kennelmen of the Bastion who turned with the pack and walk behind it. Hamlet folk say a handler can be reasoned with, briefly. They do not advise trying twice.\n\n— weald hamlet saying",
    keywords: [], icon: '🗡',
    effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6, hits: 2 }] },
  },
  {
    id: 'blindingSand', name: 'Blinding Sand', class: 'colorless', rarity: 'common', cost: 0, type: 'skill',
    flavor: "Ash thrown in the eyes, which works on the corrupted as it works on anyone. The hamlets learned this in the first winter, when they found that the things coming out of the weald flinched from ash as a living person would. Some hamlets took that as proof the corrupted could be saved. Marl's Hollow took it as proof they could be blinded, and is the larger hamlet for it.\n\n— Marl's Hollow elders",
    keywords: ['exhaust'], icon: '🌪',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstring', name: 'Hamstring', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
    flavor: "A cut at the back of the leg, taught on the road with a single instruction: the things of the ring all walk, so go for the legs. The saying is scratched on cairns from the weald to the coast in what looks like the same hand, though the cairns are weeks apart and nobody claims to have cut them all.\n\n— cairn-scratch",
    keywords: ['exhaust'], icon: '🦵',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 }] },
  },
  {
    id: 'masterOfStrategy', name: 'Master of Strategy', class: 'colorless', rarity: 'rare', cost: 0, type: 'skill',
    flavor: "Maps scratched on cairn stones by climbers who came back down, or meant to. Some of the maps are true. The hamlet councils copy the true ones and burn the rest, and argue each winter over which were which. The oldest map at the Grave of the Nameless shows a fourth road running off the ring toward the coast, and the councils have not yet decided whether to burn it.\n\n— Forsaken council minute",
    keywords: ['exhaust'], icon: '📜',
    effects: [{ op: 'draw', amount: 3 }],
    textTemplate: 'Draw {draw} cards. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }] },
  },

  // ---- Content-pass additions (round 5) --------------------------------------
  {
    id: 'bashingBlow', name: 'Bashing Blow', class: 'colorless', rarity: 'common', cost: 1, type: 'attack',
    flavor: "A blow with whatever is heavy: a cudgel, a mallet, a shovel from a mine camp. The reach's miners swing it at things in the lower galleries that were miners once. Foreman Coll says the trick is not to look at their hands, which remember the work. His camp has lost fewer to the galleries than any other in the reach, and he will not say what else he does differently.\n\n— reach mine-camp talk",
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
    flavor: "An arm raised quickly, the way a climber learns to walk the viaducts, buckler up and eyes on the road. The viaducts were built before the kingdom and have no rails. Climbers say the viaducts were built to carry heat, not people, and that the stone has never learned to expect feet.\n\n— climbers' talk",
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
    flavor: "A wide swing for the viaduct, where the corrupted come three abreast and the stone is narrow. The Forsaken councils teach that the viaducts were always built to funnel something, long before there were corrupted to funnel, and that the corrupted walk them now because the stone expects a crowd.\n\n— Forsaken council teaching",
    keywords: [], icon: '🌀',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 6 }],
    textTemplate: 'Deal {damage} damage to ALL enemies.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 8 }] },
  },
  {
    id: 'enfeeble', name: 'Enfeeble', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Salt rubbed into a wound to slow what runs from it. Gull-Bet's ship-breakers use sea salt and swear by it. They say salt is the one thing on the ring the fire has never touched, because nothing written survives the sea. They say it with the confidence of people who have not yet seen what the Tidebound Abbey keeps in its boathouse.\n\n— ship-breakers' talk",
    keywords: ['exhaust'], icon: '💀',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 }],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 4 }] },
  },
  {
    id: 'colossusSmash', name: 'Colossus Smash', class: 'colorless', rarity: 'rare', cost: 2, type: 'attack',
    flavor: "A blow at the joints of something far larger than oneself, learned against the Goldbough Avatar, the heraldic idol that kneels in a clearing of the weald with a sapling grown through it. The Avatar does not know the kingdom is gone. Climbers who have fought it say it is only carved stone and gilt, and that it flinches anyway.\n\n— climbers' talk",
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
    flavor: "A cut that has closed wrong, knitting into a hard ridge that aches before the weather turns. Climbers call it the road keeping its share. The hamlets have an older word for it that means owed, and they do not say to whom.\n\n— told at the Grave of the Nameless",
  },
  {
    id: 'dazed', name: 'Dazed', class: 'colorless', rarity: 'special', cost: 0, type: 'status',
    keywords: ['unplayable', 'ethereal'], icon: '💫',
    effects: [],
    textTemplate: 'Unplayable. Ethereal.',
    flavor: "A light behind the eyes that lingers after the Grave Wisps pass, like staring too long at a candle. Climbers who have seen a wisp up close say it looked at them as if reading. The hamlets tell them to close their eyes next time, and not to speak their names aloud until the light has gone.\n\n— hamlet saying",
  },
  {
    id: 'slimed', name: 'Slimed', class: 'colorless', rarity: 'special', cost: 1, type: 'status',
    keywords: ['exhaust'], icon: '🫠',
    effects: [],
    textTemplate: 'Exhaust.',
    flavor: "A film of grey muck from the drowned hamlet in the weald, which clings and will not wash out in cold water. The hamlet flooded before the Burning, in a flood the Wardens called natural. The muck is warmer than anything in the weald has a right to be. Climbers who have handled it prefer not to guess why.\n\n— weald hamlet saying",
  },
  {
    id: 'guilt', name: 'Guilt', class: 'colorless', rarity: 'special', cost: 0, type: 'curse',
    keywords: ['unplayable'], icon: '⛓',
    effects: [],
    textTemplate: 'Unplayable.',
    flavor: "What comes after taking from the dead at the Second Cairn. Climbers say the second time is easier, and that the ease is how they know the ring has started on them.\n\n— told at the Grave of the Nameless",
  },
];
