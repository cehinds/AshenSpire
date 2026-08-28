// src/content/cards/coop.js — Forsaken Together co-op-only cards (SPEC §5.2).
//
// Support cards built around the 'ally' target (a chosen living teammate;
// resolves to self in solo, so every card here is engine-valid everywhere).
// Rarity 'special' keeps them out of class pools AND merchant stock — the
// co-op session injects one as an extra option into combat rewards whenever
// the party has 2+ living members (see tools/session.mjs rollRewardFor).
// Pure data: block / heal / applyStatus are the same generic opcodes solo uses.

export const coopCards = [
  {
    id: 'rallyingBanner', name: 'Rallying Banner', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: [], icon: '🚩',
    effects: [{ op: 'block', target: 'ally', amount: 10 }],
    textTemplate: 'An ally gains {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'ally', amount: 14 }] },
    flavor: 'Raised where the ember-given rally.',
  },
  {
    id: 'sharedFlame', name: 'Shared Flame', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '✚',
    effects: [{ op: 'heal', target: 'ally', amount: 7 }],
    textTemplate: 'An ally heals {heal} HP. Exhaust.',
    upgrade: { effects: [{ op: 'heal', target: 'ally', amount: 11 }] },
    flavor: 'Warmth passed hand to hand outlives the fire.',
  },
  {
    id: 'ashOath', name: "Oath of Ash", class: 'colorless', rarity: 'special', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '🤝',
    effects: [
      { op: 'applyStatus', target: 'ally', status: 'strength', stacks: 2 },
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 },
    ],
    textTemplate: 'An ally gains {strength} Strength; you gain {strength.2}. Exhaust.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'ally', status: 'strength', stacks: 3 },
        { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 },
      ],
    },
    flavor: 'Sworn once, kept twice.',
  },
];

export const COOP_CARD_IDS = coopCards.map((c) => c.id);
