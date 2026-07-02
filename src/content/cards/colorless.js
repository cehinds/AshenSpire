// src/content/cards/colorless.js — statuses (the card kind) + curses (SPEC §5.2)
//
// Enemies and events inject these into the player's deck. Unplayability is
// keyword-driven (SPEC §4.3 note). Guilt's end-of-turn HP loss requires an
// in-hand hook that lands with M2's event system (M1 deviation, see PR notes).

export const colorlessCards = [
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
