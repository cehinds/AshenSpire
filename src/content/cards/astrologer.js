// src/content/cards/astrologer.js — the Astrologer pool (SPEC §5.1: M3)
//
// Class identity: GLINTSTONE COMBOS — the 2nd+ spell each turn is empowered.
// Mechanically pure data: each spell checks glintstoneCharge FIRST (its
// "Glintstone:" bonus), then applies the charge for the next spell. The
// charge is unique + turn-end decay (content/statuses.js). Weak early block
// is the designed weakness (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the Glintstone identity — multi-hit (Star
// Slicer), AoE combos (Meteor Swarm, Radiant Spray, Starfall Beam), control
// (Frost Nova, Gravity Well), and scaling powers (Cerulean Coil, Waxing Moon).

const one = { f: 'add', args: [1] };
const CHARGED = { p: 'hasStatus', of: 'self', status: 'glintstoneCharge' };
const GAIN_CHARGE = { op: 'applyStatus', target: 'self', status: 'glintstoneCharge', stacks: one };

export const astrologerCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'glintstonePebble', name: 'Glintstone Pebble', class: 'astrologer', rarity: 'starter', cost: 1, type: 'attack',
    keywords: [], icon: '💎',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'cometFragment', name: 'Comet Fragment', class: 'astrologer', rarity: 'common', cost: 0, type: 'attack',
    keywords: [], icon: '☄',
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, GAIN_CHARGE] },
  },
  {
    id: 'glintbladePhalanx', name: 'Glintblade Phalanx', class: 'astrologer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: deal {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'damage', target: 'enemy', amount: 6, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'crystalBarrier', name: 'Crystal Barrier', class: 'astrologer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🔷',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'block', target: 'self', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Glintstone: {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'block', target: 'self', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starShower', name: 'Star Shower', class: 'astrologer', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 3, hits: 3 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Glintstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 4, hits: 3 },
        { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'scholarsInsight', name: "Scholar's Insight", class: 'astrologer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '📖',
    effects: [{ op: 'draw', amount: 2 }, GAIN_CHARGE],
    textTemplate: 'Draw {draw} cards.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, GAIN_CHARGE] },
  },
  {
    id: 'frostVeil', name: 'Frost Veil', class: 'astrologer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🌫',
    effects: [
      { op: 'block', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starSlicer', name: 'Star Slicer', class: 'astrologer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4, hits: 2 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Glintstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5, hits: 2 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'glintstoneWard', name: 'Glintstone Ward', class: 'astrologer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🔰',
    effects: [
      { op: 'block', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Glintstone: apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starlance', name: 'Starlance', class: 'astrologer', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🏹',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 13, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 17, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'twinkling', name: 'Twinkling', class: 'astrologer', rarity: 'common', cost: 0, type: 'skill',
    keywords: [], icon: '✨',
    effects: [
      { op: 'draw', amount: 1 },
      { op: 'gainEnergy', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Draw {draw} card. Glintstone: gain {gainEnergy} Energy.',
    upgrade: {
      effects: [
        { op: 'draw', amount: 2 },
        { op: 'gainEnergy', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'frostNova', name: 'Frost Nova', class: 'astrologer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '❄',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Apply {weak} Weak. Glintstone: apply {vulnerable} Vulnerable.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Uncommons -----------------------------------------------------------------
  {
    id: 'glintstoneArc', name: 'Glintstone Arc', class: 'astrologer', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '⚡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: apply {vulnerable} Vulnerable.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'lucidity', name: 'Lucidity', class: 'astrologer', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🌙',
    effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: { effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 2 }, GAIN_CHARGE] },
  },
  {
    id: 'stargazerCard', name: 'Stargazer', class: 'astrologer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🔭',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stargazer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Glintstone Charge.',
    upgrade: { cost: 0 },
  },
  {
    id: 'astralArmorCard', name: 'Astral Armor', class: 'astrologer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌌',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: one }],
    textTemplate: 'At the end of your turn, gain 4 Block.',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: { f: 'add', args: [2] } }],
      textTemplate: 'At the end of your turn, gain 8 Block.',
    },
  },
  {
    id: 'moonveilCut', name: 'Moonveil Cut', class: 'astrologer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🌒',
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'poiseDamage', target: 'enemy', amount: 6 },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 11 },
        { op: 'poiseDamage', target: 'enemy', amount: 8 },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'meteorite', name: 'Meteorite', class: 'astrologer', rarity: 'uncommon', cost: 3, type: 'attack',
    keywords: [], icon: '🪨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 18, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 24, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 22, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 30, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'meteorSwarm', name: 'Meteor Swarm', class: 'astrologer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '☄',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 5 },
      { op: 'damage', target: 'allEnemies', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Glintstone: {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 7 },
        { op: 'damage', target: 'allEnemies', amount: 7, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'gravityWell', name: 'Gravity Well', class: 'astrologer', rarity: 'uncommon', cost: 2, type: 'skill',
    keywords: [], icon: '🕳',
    effects: [
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 },
      { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Glintstone: apply {weak} Weak to ALL.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 },
        { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'ceruleanCoilCard', name: 'Cerulean Coil', class: 'astrologer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'ceruleanCoil', stacks: one }],
    textTemplate: 'Whenever you play a Skill, gain 2 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'astralCleave', name: 'Astral Cleave', class: 'astrologer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '⚔',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10 },
      { op: 'poiseDamage', target: 'enemy', amount: 8 },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Glintstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 13 },
        { op: 'poiseDamage', target: 'enemy', amount: 10 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'radiantSpray', name: 'Radiant Spray', class: 'astrologer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🎇',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 },
      { op: 'damage', target: 'allEnemies', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} to ALL enemies. Apply {vulnerable} Vulnerable to ALL. Glintstone: deal {damage.2} to ALL again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 6 },
        { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 },
        { op: 'damage', target: 'allEnemies', amount: 6, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Rares -----------------------------------------------------------------------
  {
    id: 'supernova', name: 'Supernova', class: 'astrologer', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '💥',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 8, hits: { f: 'energySpent' } }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage to ALL enemies once per Energy spent.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 10, hits: { f: 'energySpent' } }, GAIN_CHARGE] },
  },
  {
    id: 'timeDilation', name: 'Time Dilation', class: 'astrologer', rarity: 'rare', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '⏳',
    effects: [{ op: 'gainEnergy', amount: 2 }, { op: 'draw', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: { keywords: [], textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards.' },
  },
  {
    id: 'glintstoneKris', name: 'Glintstone Kris', class: 'astrologer', rarity: 'rare', cost: 1, type: 'attack',
    keywords: [], icon: '🔪',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'draw', amount: 1, if: CHARGED },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Glintstone: draw {draw} card and deal {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'draw', amount: 1, if: CHARGED },
        { op: 'damage', target: 'enemy', amount: 7, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'constellationCard', name: 'Constellation', class: 'astrologer', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '💫',
    effects: [{ op: 'applyStatus', target: 'self', status: 'constellation', stacks: one }],
    textTemplate: 'Whenever you gain Glintstone Charge, deal 4 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'starfallBeam', name: 'Starfall Beam', class: 'astrologer', rarity: 'rare', cost: 3, type: 'attack',
    keywords: [], icon: '🔆',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 12, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'allEnemies', amount: 20, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Glintstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 16, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'allEnemies', amount: 26, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starcaller', name: 'Starcaller', class: 'astrologer', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '⭐',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6, hits: { f: 'energySpent' } },
      { op: 'damage', target: 'enemy', amount: 8, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage once per Energy spent. Glintstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8, hits: { f: 'energySpent' } },
        { op: 'damage', target: 'enemy', amount: 10, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'umbralWard', name: 'Umbral Ward', class: 'astrologer', rarity: 'rare', cost: 2, type: 'skill',
    keywords: [], icon: '🌑',
    effects: [
      { op: 'block', target: 'self', amount: 20, if: { p: 'not', pred: CHARGED } },
      { op: 'block', target: 'self', amount: 30, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Glintstone: {block.2} instead.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 26, if: { p: 'not', pred: CHARGED } },
        { op: 'block', target: 'self', amount: 38, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'waxingMoonCard', name: 'Waxing Moon', class: 'astrologer', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '🌕',
    effects: [{ op: 'applyStatus', target: 'self', status: 'waxingMoon', stacks: one }],
    textTemplate: 'At the start of your turn, apply 2 Vulnerable to ALL enemies.',
    upgrade: { cost: 1 },
  },
];
