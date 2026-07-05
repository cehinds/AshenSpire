// src/content/cards/colorless.js — statuses/curses (injected) + neutral
// colorless cards any class can pick up (SPEC §5.2, §1).
//
// The status/curse cards (rarity 'special') are injected by enemies and events;
// unplayability is keyword-driven (SPEC §4.3 note). The playable colorless cards
// (common/uncommon/rare) are class-agnostic utility, sold at Merchants —
// StS-faithful: colorless comes from shops, not standard combat rewards
// (rollShopCards in engine/encounters.js appends them to every class's stock).

export const colorlessCards = [
  // ---- Neutral playable colorless (Merchant stock, SPEC §1) ------------------
  {
    id: 'honedEdge', name: 'Honed Edge', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🔩',
    effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
    textTemplate: 'Gain {strength} Strength. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }] },
  },
  {
    id: 'ironSkin', name: 'Iron Skin', class: 'colorless', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 8 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 11 }] },
  },
  {
    id: 'fieldDressing', name: 'Field Dressing', class: 'colorless', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🩹',
    effects: [{ op: 'heal', target: 'self', amount: 8 }],
    textTemplate: 'Heal {heal} HP. Exhaust.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 12 }] },
  },
  {
    id: 'hex', name: 'Hex', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
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
    keywords: [], icon: '🗡',
    effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6, hits: 2 }] },
  },
  {
    id: 'blindingSand', name: 'Blinding Sand', class: 'colorless', rarity: 'common', cost: 0, type: 'skill',
    keywords: ['exhaust'], icon: '🌪',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstring', name: 'Hamstring', class: 'colorless', rarity: 'uncommon', cost: 0, type: 'skill',
    keywords: ['exhaust'], icon: '🦵',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 }] },
  },
  {
    id: 'masterOfStrategy', name: 'Master of Strategy', class: 'colorless', rarity: 'rare', cost: 0, type: 'skill',
    keywords: ['exhaust'], icon: '📜',
    effects: [{ op: 'draw', amount: 3 }],
    textTemplate: 'Draw {draw} cards. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }] },
  },

  // ---- Statuses (the card kind) + curses (enemy/event injected) --------------
  {
    id: 'wound', name: 'Wound', class: 'colorless', rarity: 'special', cost: 0, type: 'status',
    keywords: ['unplayable'], icon: '💢',
    effects: [],
    textTemplate: 'Unplayable.',
    flavor: 'The flesh remembers.',
  },
  {
    id: 'dazed', name: 'Dazed', class: 'colorless', rarity: 'special', cost: 0, type: 'status',
    keywords: ['unplayable', 'ethereal'], icon: '💫',
    effects: [],
    textTemplate: 'Unplayable. Ethereal.',
    flavor: 'The grave-light lingers behind the eyes.',
  },
  {
    id: 'slimed', name: 'Slimed', class: 'colorless', rarity: 'special', cost: 1, type: 'status',
    keywords: ['exhaust'], icon: '🫠',
    effects: [],
    textTemplate: 'Exhaust.',
    flavor: 'It clings.',
  },
  {
    id: 'guilt', name: 'Guilt', class: 'colorless', rarity: 'special', cost: 0, type: 'curse',
    keywords: ['unplayable'], icon: '⛓',
    effects: [],
    textTemplate: 'Unplayable.',
    flavor: 'Some prayers are better left unanswered.',
  },
];
