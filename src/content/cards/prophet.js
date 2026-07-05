// src/content/cards/prophet.js — the Prophet pool (SPEC §5.1: M3)
//
// Class identity: HP AS A RESOURCE — pay life for tempo (loseHp riders),
// spread Scarlet Rot, and claw the blood back through heals that the Gold
// Figurine converts into armor. Mistakes compound: HP is one pool (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the blood/Rot identity — Rot spread & payoff
// (Contagion, Scourge, Cull the Weak, Rot Nova, Reclamation), HP-for-value
// (Bloodletting, Exsanguinate, Blood Harvest), and blood-fed powers (Stigmata
// heals on HP loss, Zealotry retaliates on HP loss).

const one = { f: 'add', args: [1] };

export const prophetCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'urgentHeal', name: 'Urgent Heal', class: 'prophet', rarity: 'starter', cost: 1, type: 'skill',
    keywords: [], icon: '✚',
    effects: [{ op: 'heal', target: 'self', amount: 4 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 6 }] },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'bloodPact', name: 'Blood Pact', class: 'prophet', rarity: 'common', cost: 0, type: 'skill',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'gainEnergy', amount: 1 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 1 },
        { op: 'gainEnergy', amount: 1 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'rotTouch', name: 'Rot Touch', class: 'prophet', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {scarletRot} Scarlet Rot.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 3 },
      ],
    },
  },
  {
    id: 'flagellation', name: 'Flagellation', class: 'prophet', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '⛓',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'damage', target: 'enemy', amount: 9 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 2 },
        { op: 'damage', target: 'enemy', amount: 12 },
      ],
    },
  },
  {
    id: 'penance', name: 'Penance', class: 'prophet', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🙏',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'heal', target: 'self', amount: 2 },
    ],
    textTemplate: 'Gain {block} Block. Heal {heal} HP.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'heal', target: 'self', amount: 3 },
      ],
    },
  },
  {
    id: 'litany', name: 'Litany', class: 'prophet', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '📿',
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'graveOffering', name: 'Grave Offering', class: 'prophet', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🪦',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'damage', target: 'allEnemies', amount: 7 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage to ALL enemies.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'damage', target: 'allEnemies', amount: 10 },
      ],
    },
  },
  {
    id: 'bloodletting', name: 'Bloodletting', class: 'prophet', rarity: 'common', cost: 0, type: 'skill',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'block', target: 'self', amount: 8 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {block} Block.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'block', target: 'self', amount: 11 },
      ],
    },
  },
  {
    id: 'contagion', name: 'Contagion', class: 'prophet', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '☣',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 2 }],
    textTemplate: 'Apply {scarletRot} Scarlet Rot to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 3 }] },
  },
  {
    id: 'cullTheWeak', name: 'Cull the Weak', class: 'prophet', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 4, if: { p: 'hasStatus', of: 'target', status: 'scarletRot' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Scarlet Rot: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'damage', target: 'enemy', amount: 6, if: { p: 'hasStatus', of: 'target', status: 'scarletRot' } },
      ],
    },
  },
  {
    id: 'transfusion', name: 'Transfusion', class: 'prophet', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '➕',
    effects: [{ op: 'heal', target: 'self', amount: 6 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 9 }] },
  },
  {
    id: 'rotward', name: 'Rotward', class: 'prophet', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'block', target: 'self', amount: 4, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
    ],
    textTemplate: 'Gain {block} Block. If below half HP: gain {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'block', target: 'self', amount: 4, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
      ],
    },
  },

  // ---- Uncommons -----------------------------------------------------------------
  {
    id: 'martyrBlood', name: "Martyr's Blood", class: 'prophet', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🥀',
    effects: [
      { op: 'loseHp', target: 'self', amount: 5 },
      { op: 'gainEnergy', amount: 2 },
      { op: 'draw', amount: 2 },
    ],
    textTemplate: 'Lose {loseHp} HP. Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'gainEnergy', amount: 2 },
        { op: 'draw', amount: 2 },
      ],
    },
  },
  {
    id: 'rotBloom', name: 'Rot Bloom', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🌺',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: { f: 'stacks', status: 'scarletRot', of: 'target' } },
    ],
    textTemplate: "Double the target's Scarlet Rot. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Scarlet Rot." },
  },
  {
    id: 'sacredHarvest', name: 'Sacred Harvest', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '🌾',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'heal', target: 'self', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Heal {heal} HP.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'heal', target: 'self', amount: 4 },
      ],
    },
  },
  {
    id: 'thornHaloCard', name: 'Thorn Halo', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌿',
    effects: [{ op: 'applyStatus', target: 'self', status: 'thornHalo', stacks: one }],
    textTemplate: 'At the start of your turn, apply 1 Scarlet Rot to ALL enemies.',
    upgrade: { cost: 0 },
  },
  {
    id: 'communionCard', name: 'Communion', class: 'prophet', rarity: 'uncommon', cost: 2, type: 'power',
    keywords: [], icon: '🕊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'communion', stacks: one }],
    textTemplate: 'At the start of your turn, heal 3 HP.',
    upgrade: { cost: 1 },
  },
  {
    id: 'goldenVow', name: 'Golden Vow', class: 'prophet', rarity: 'uncommon', cost: 2, type: 'skill',
    keywords: [], icon: '🌞',
    effects: [
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
      { op: 'applyStatus', target: 'self', status: 'dexterity', stacks: 2 },
    ],
    textTemplate: 'Gain {strength} Strength and {dexterity} Dexterity.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 },
        { op: 'applyStatus', target: 'self', status: 'dexterity', stacks: 3 },
      ],
    },
  },
  {
    id: 'plagueBearer', name: 'Plague Bearer', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '🐀',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 2 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {scarletRot} Scarlet Rot. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 3 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'exsanguinate', name: 'Exsanguinate', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '🔻',
    effects: [
      { op: 'loseHp', target: 'self', amount: 3 },
      { op: 'damage', target: 'enemy', amount: 14 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 3 },
        { op: 'damage', target: 'enemy', amount: 18 },
      ],
    },
  },
  {
    id: 'stigmataCard', name: 'Stigmata', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🩹',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stigmata', stacks: one }],
    textTemplate: 'Whenever you lose HP, heal 2 HP.',
    upgrade: { cost: 0 },
  },
  {
    id: 'scourge', name: 'Scourge', class: 'prophet', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🌊',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 6 },
      { op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Apply {scarletRot} Scarlet Rot to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 8 },
        { op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 2 },
      ],
    },
  },
  {
    id: 'reclamation', name: 'Reclamation', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🍂',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'scarletRot', of: 'allEnemies', per: 2 } },
    ],
    textTemplate: 'Heal 1 HP for every 2 Scarlet Rot on all enemies. Exhaust.',
    upgrade: {
      keywords: ['exhaust'],
      effects: [
        { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'scarletRot', of: 'allEnemies' } },
      ],
      textTemplate: 'Heal 1 HP for every Scarlet Rot on all enemies. Exhaust.',
    },
  },

  // ---- Rares -----------------------------------------------------------------------
  {
    id: 'secondBloom', name: 'Second Bloom', class: 'prophet', rarity: 'rare', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '🌸',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'mul', args: [0.5, { f: 'missingHp', of: 'self' }] } },
    ],
    textTemplate: 'Heal half of your missing HP. Exhaust.',
    upgrade: { cost: 1 },
  },
  {
    id: 'butterflyPlague', name: 'Plague of Butterflies', class: 'prophet', rarity: 'rare', cost: 3, type: 'skill',
    keywords: [], icon: '🦋',
    effects: [
      { op: 'loseHp', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 6 },
    ],
    textTemplate: 'Lose {loseHp} HP. Apply {scarletRot} Scarlet Rot to ALL enemies.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 4 },
        { op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 8 },
      ],
    },
  },
  {
    id: 'lifeTitheCard', name: 'Life Tithe', class: 'prophet', rarity: 'rare', cost: 1, type: 'power',
    keywords: [], icon: '⚰',
    effects: [{ op: 'applyStatus', target: 'self', status: 'lifeTithe', stacks: one }],
    textTemplate: 'Whenever an enemy dies, heal 8 HP.',
    upgrade: { cost: 0 },
  },
  {
    id: 'crimsonRite', name: 'Crimson Rite', class: 'prophet', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '🔺',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5, hits: { f: 'energySpent' } },
      { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 2 } },
    ],
    textTemplate: 'Deal {damage} damage once per Energy spent, then heal 2 per Energy.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7, hits: { f: 'energySpent' } },
        { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
      ],
      textTemplate: 'Deal {damage} damage once per Energy spent, then heal 3 per Energy.',
    },
  },
  {
    id: 'rotNova', name: 'Rot Nova', class: 'prophet', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '💥',
    effects: [
      { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'scarletRot', of: 'target' }] } },
    ],
    textTemplate: "Deal damage equal to twice the target's Scarlet Rot.",
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [3, { f: 'stacks', status: 'scarletRot', of: 'target' }] } },
      ],
      textTemplate: "Deal damage equal to three times the target's Scarlet Rot.",
    },
  },
  {
    id: 'lastRites', name: 'Last Rites', class: 'prophet', rarity: 'rare', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '🕯',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'percentMaxHp', of: 'self', pct: 20 } },
      { op: 'draw', amount: 2 },
    ],
    textTemplate: 'Heal 20% of your max HP. Draw {draw} cards. Exhaust.',
    upgrade: {
      keywords: [],
      textTemplate: 'Heal 20% of your max HP. Draw {draw} cards.',
    },
  },
  {
    id: 'zealotryCard', name: 'Zealotry', class: 'prophet', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '⚡',
    effects: [{ op: 'applyStatus', target: 'self', status: 'zealotry', stacks: one }],
    textTemplate: 'Whenever you lose HP, deal 3 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'bloodHarvest', name: 'Blood Harvest', class: 'prophet', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '🌾',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 4, hits: { f: 'energySpent' } },
      { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies once per Energy spent. Then heal 3 per Energy.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 6, hits: { f: 'energySpent' } },
        { op: 'heal', target: 'self', amount: { f: 'energySpent', per: 3 } },
      ],
    },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (a cheap blood-payment attack and a Rot poke), two
  // uncommons (an HP-gated finisher and a heal-fed power), two rares (a heavy
  // HP-for-damage attack and a Rot-fed power) — rounding the pool to 36.
  {
    id: 'painOffering', name: 'Pain Offering', class: 'prophet', rarity: 'common', cost: 0, type: 'attack',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'loseHp', target: 'self', amount: 2 },
      { op: 'damage', target: 'enemy', amount: 7 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 2 },
        { op: 'damage', target: 'enemy', amount: 10 },
      ],
    },
  },
  {
    id: 'witheringTouch', name: 'Withering Touch', class: 'prophet', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {scarletRot} Scarlet Rot.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'scarletRot', stacks: 4 },
      ],
    },
  },
  {
    id: 'desperateRite', name: 'Desperate Rite', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '🔺',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9, if: { p: 'not', pred: { p: 'hpBelowPct', of: 'self', pct: 50 } } },
      { op: 'damage', target: 'enemy', amount: 16, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
    ],
    textTemplate: 'Deal {damage} damage. If below half HP: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12, if: { p: 'not', pred: { p: 'hpBelowPct', of: 'self', pct: 50 } } },
        { op: 'damage', target: 'enemy', amount: 20, if: { p: 'hpBelowPct', of: 'self', pct: 50 } },
      ],
    },
  },
  {
    id: 'graceTideCard', name: 'Grace Tide', class: 'prophet', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'graceTide', stacks: one }],
    textTemplate: 'Whenever you heal, gain 1 Strength.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodOfferingRite', name: 'Blood Offering', class: 'prophet', rarity: 'rare', cost: 1, type: 'attack',
    keywords: [], icon: '⚰',
    effects: [
      { op: 'loseHp', target: 'self', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 24 },
    ],
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 6 },
        { op: 'damage', target: 'enemy', amount: 30 },
      ],
    },
  },
  {
    id: 'harbingerOfRotCard', name: 'Harbinger of Rot', class: 'prophet', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '❀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'harbingerOfRot', stacks: one }],
    textTemplate: 'Whenever Scarlet Rot is applied to an enemy, heal 1 HP.',
    upgrade: { cost: 1 },
  },
];
