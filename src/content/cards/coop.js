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
    flavor: "A rag on a pole, planted where climbers who meet on the road can find each other. The Forsaken never had banners, a banner being a thing with a name on it, so the rags are left blank on purpose. The corrupted come toward them too. The climbers have decided that is a risk worth taking.\n\nA rag on a pole. Find it. Stand by it.\n— cairn-scratch",
  },
  {
    id: 'sharedFlame', name: 'Shared Flame', class: 'colorless', rarity: 'special', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '✚',
    effects: [{ op: 'heal', target: 'ally', amount: 7 }],
    textTemplate: 'An ally heals {heal} HP. Exhaust.',
    upgrade: { effects: [{ op: 'heal', target: 'ally', amount: 11 }] },
    flavor: "Warmth passed between two climbers without a hearth or a ledger: hands over the same coal, breath under the same coat. The Chapel would have called it theft. The hamlets say it is the only warmth on the ring owed to no one, and that it keeps longer than it should.\n\nWarmth passed between two outlives the fire.\n— hamlet saying",
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
    flavor: "An oath sworn between climbers in ash rather than blood, with no witness and no name: a smear on each other's wrist, where the mark would have been. The hamlets say it binds twice, once for each. The Court held that an oath without a witness binds no one. The Court is sewn to its oaths now, and the hamlets consider the argument settled.\n\n— hamlet saying",
  },
];

export const COOP_CARD_IDS = coopCards.map((c) => c.id);
