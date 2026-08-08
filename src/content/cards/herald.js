// src/content/cards/herald.js — the Herald pool (SPEC §5.1: M3)
//
// Class identity: HP AS A RESOURCE — pay life for tempo (loseHp riders),
// spread Crimson Blight, and claw the blood back through heals that the Gold
// Figurine converts into armor. Mistakes compound: HP is one pool (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the blood/Blight identity — Blight spread & payoff
// (Contagion, Scourge, Cull the Weak, Blight Nova, Reclamation), HP-for-value
// (Bloodletting, Exsanguinate, Blood Harvest), and blood-fed powers (Stigmata
// heals on HP loss, Zealotry retaliates on HP loss).

const one = { f: 'add', args: [1] };

export const heraldCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'urgentHeal', name: 'Urgent Heal', class: 'herald', rarity: 'starter', cost: 1, type: 'skill',
    keywords: [], icon: '✚',
    effects: [{ op: 'heal', target: 'self', amount: 4 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 6 }] },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'bloodPact', name: 'Blood Pact', class: 'herald', rarity: 'common', cost: 0, type: 'skill',
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
    id: 'blightTouch', name: 'Blight Touch', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
      ],
    },
  },
  {
    id: 'flagellation', name: 'Flagellation', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
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
    id: 'penance', name: 'Penance', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
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
    // THE HERALD IS WHERE INSANITY LIVES (Rune, 2026-08-08). The Insanity row
    // shipped complete — threshold 14, the biggest burst, +8 Poise, a
    // guaranteed Stagger, `insanityExposed` — and NOTHING in the game applied
    // it. It belongs to this class and not to the Reaver or the Starseer for a
    // reason already in the data: insanityExposed raises `ritual`- and
    // `blight`-tagged damage, and those two tags are the Herald's
    // (content/source/cardTagging.csv). A chant repeated until the mind gives
    // is the cheapest, slowest door in; 14 is deliberately the hardest
    // threshold to fill, so a common has to be able to start it.
    // Numbers PROVISIONAL, like the row's.
    id: 'litany', name: 'Litany', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '📿',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 },
      { op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 3 },
    ],
    textTemplate: 'Apply {weak} Weak and {insanity} Insanity.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 },
        { op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 4 },
      ],
    },
  },
  {
    id: 'graveOffering', name: 'Grave Offering', class: 'herald', rarity: 'common', cost: 2, type: 'attack',
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
    id: 'bloodletting', name: 'Bloodletting', class: 'herald', rarity: 'common', cost: 0, type: 'skill',
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
    id: 'contagion', name: 'Contagion', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '☣',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 }],
    textTemplate: 'Apply {crimsonBlight} Crimson Blight to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 3 }] },
  },
  {
    id: 'cullTheWeak', name: 'Cull the Weak', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 4, if: { p: 'hasStatus', of: 'target', status: 'crimsonBlight' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Crimson Blight: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'damage', target: 'enemy', amount: 6, if: { p: 'hasStatus', of: 'target', status: 'crimsonBlight' } },
      ],
    },
  },
  {
    id: 'transfusion', name: 'Transfusion', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '➕',
    effects: [{ op: 'heal', target: 'self', amount: 6 }],
    textTemplate: 'Heal {heal} HP.',
    upgrade: { effects: [{ op: 'heal', target: 'self', amount: 9 }] },
  },
  {
    id: 'blightward', name: 'Blightward', class: 'herald', rarity: 'common', cost: 1, type: 'skill',
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
    id: 'martyrBlood', name: "Martyr's Blood", class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
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
    id: 'blightBloom', name: 'Blight Bloom', class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🌺',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: { f: 'stacks', status: 'crimsonBlight', of: 'target' } },
    ],
    textTemplate: "Double the target's Crimson Blight. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Crimson Blight." },
  },
  {
    id: 'sacredHarvest', name: 'Sacred Harvest', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
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
    id: 'thornHaloCard', name: 'Thorn Halo', class: 'herald', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌿',
    effects: [{ op: 'applyStatus', target: 'self', status: 'thornHalo', stacks: one }],
    textTemplate: 'At the start of your turn, apply 1 Crimson Blight to ALL enemies.',
    upgrade: { cost: 0 },
  },
  {
    id: 'communionCard', name: 'Communion', class: 'herald', rarity: 'uncommon', cost: 2, type: 'power',
    keywords: [], icon: '🕊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'communion', stacks: one }],
    textTemplate: 'At the start of your turn, heal 3 HP.',
    upgrade: { cost: 1 },
  },
  {
    id: 'gildedOath', name: 'Gilded Oath', class: 'herald', rarity: 'uncommon', cost: 2, type: 'skill',
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
    id: 'plagueBearer', name: 'Plague Bearer', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '🐀',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'exsanguinate', name: 'Exsanguinate', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
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
    id: 'stigmataCard', name: 'Stigmata', class: 'herald', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🩹',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stigmata', stacks: one }],
    textTemplate: 'Whenever you lose HP, heal 2 HP.',
    upgrade: { cost: 0 },
  },
  {
    id: 'scourge', name: 'Scourge', class: 'herald', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🌊',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 6 },
      { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Apply {crimsonBlight} Crimson Blight to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 8 },
        { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 2 },
      ],
    },
  },
  {
    id: 'reclamation', name: 'Reclamation', class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🍂',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'crimsonBlight', of: 'allEnemies', per: 2 } },
    ],
    textTemplate: 'Heal 1 HP for every 2 Crimson Blight on all enemies. Exhaust.',
    upgrade: {
      keywords: ['exhaust'],
      effects: [
        { op: 'heal', target: 'self', amount: { f: 'stacks', status: 'crimsonBlight', of: 'allEnemies' } },
      ],
      textTemplate: 'Heal 1 HP for every Crimson Blight on all enemies. Exhaust.',
    },
  },

  // ---- Rares -----------------------------------------------------------------------
  {
    id: 'secondBloom', name: 'Second Bloom', class: 'herald', rarity: 'rare', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '🌸',
    effects: [
      { op: 'heal', target: 'self', amount: { f: 'mul', args: [0.5, { f: 'missingHp', of: 'self' }] } },
    ],
    textTemplate: 'Heal half of your missing HP. Exhaust.',
    upgrade: { cost: 1 },
  },
  {
    id: 'butterflyPlague', name: 'Plague of Butterflies', class: 'herald', rarity: 'rare', cost: 3, type: 'skill',
    keywords: [], icon: '🦋',
    effects: [
      { op: 'loseHp', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 6 },
    ],
    textTemplate: 'Lose {loseHp} HP. Apply {crimsonBlight} Crimson Blight to ALL enemies.',
    upgrade: {
      effects: [
        { op: 'loseHp', target: 'self', amount: 4 },
        { op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 8 },
      ],
    },
  },
  {
    id: 'lifeTitheCard', name: 'Life Tithe', class: 'herald', rarity: 'rare', cost: 1, type: 'power',
    keywords: [], icon: '⚰',
    effects: [{ op: 'applyStatus', target: 'self', status: 'lifeTithe', stacks: one }],
    textTemplate: 'Whenever an enemy dies, heal 8 HP.',
    upgrade: { cost: 0 },
  },
  {
    id: 'crimsonRite', name: 'Crimson Rite', class: 'herald', rarity: 'rare', cost: 'X', type: 'attack',
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
    id: 'blightNova', name: 'Blight Nova', class: 'herald', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '💥',
    effects: [
      { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'crimsonBlight', of: 'target' }] } },
    ],
    textTemplate: "Deal damage equal to twice the target's Crimson Blight.",
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [3, { f: 'stacks', status: 'crimsonBlight', of: 'target' }] } },
      ],
      textTemplate: "Deal damage equal to three times the target's Crimson Blight.",
    },
  },
  {
    id: 'lastRites', name: 'Last Rites', class: 'herald', rarity: 'rare', cost: 2, type: 'skill',
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
    id: 'zealotryCard', name: 'Zealotry', class: 'herald', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '⚡',
    effects: [{ op: 'applyStatus', target: 'self', status: 'zealotry', stacks: one }],
    textTemplate: 'Whenever you lose HP, deal 3 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'bloodHarvest', name: 'Blood Harvest', class: 'herald', rarity: 'rare', cost: 'X', type: 'attack',
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
  // Two more commons (a cheap blood-payment attack and a Blight poke), two
  // uncommons (an HP-gated finisher and a heal-fed power), two rares (a heavy
  // HP-for-damage attack and a Blight-fed power) — rounding the pool to 36.
  {
    id: 'painOffering', name: 'Pain Offering', class: 'herald', rarity: 'common', cost: 0, type: 'attack',
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
    id: 'witheringTouch', name: 'Withering Touch', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 4 },
      ],
    },
  },
  {
    id: 'desperateRite', name: 'Desperate Rite', class: 'herald', rarity: 'uncommon', cost: 1, type: 'attack',
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
    id: 'emberTideCard', name: 'Ember Tide', class: 'herald', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌊',
    effects: [{ op: 'applyStatus', target: 'self', status: 'emberTide', stacks: one }],
    textTemplate: 'Whenever you heal, gain 1 Strength.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodOfferingRite', name: 'Blood Offering', class: 'herald', rarity: 'rare', cost: 1, type: 'attack',
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
    id: 'harbingerOfBlightCard', name: 'Harbinger of Blight', class: 'herald', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '❀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'harbingerOfBlight', stacks: one }],
    textTemplate: 'Whenever Crimson Blight is applied to an enemy, heal 1 HP.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'blightwardLash', name: 'Blightward Lash', class: 'herald', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🦠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 },
      { op: 'loseHp', target: 'self', amount: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {crimsonBlight} Crimson Blight. Lose {loseHp} HP.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 3 },
        { op: 'loseHp', target: 'self', amount: 2 },
      ],
    },
  },
  {
    id: 'lastMercy', name: "Last Mercy", class: 'herald', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🙏',
    effects: [
      { op: 'heal', target: 'self', amount: 5 },
      { op: 'block', target: 'self', amount: 4 },
    ],
    textTemplate: 'Heal {heal} HP. Gain {block} Block.',
    upgrade: {
      effects: [
        { op: 'heal', target: 'self', amount: 7 },
        { op: 'block', target: 'self', amount: 6 },
      ],
    },
  },
];
