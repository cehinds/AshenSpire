// src/content/cards/starseer.js — the Starseer pool (SPEC §5.1: M3)
//
// Class identity: STARSTONE COMBOS — the 2nd+ spell each turn is empowered.
// Mechanically pure data: each spell checks starstoneCharge FIRST (its
// "Starstone:" bonus), then applies the charge for the next spell. The
// charge is unique + turn-end decay (content/statuses.js). Weak early block
// is the designed weakness (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the Starstone identity — multi-hit (Star
// Slicer), AoE combos (Meteor Swarm, Radiant Spray, Starfall Beam), control
// (Frost Nova, Gravity Well), and scaling powers (Azure Coil, Waxing Moon).

const one = { f: 'add', args: [1] };
const CHARGED = { p: 'hasStatus', of: 'self', status: 'starstoneCharge' };
const GAIN_CHARGE = { op: 'applyStatus', target: 'self', status: 'starstoneCharge', stacks: one };

export const starseerCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'starstonePebble', name: 'Starstone Pebble', class: 'starseer', rarity: 'starter', cost: 1, type: 'attack',
    keywords: [], icon: '💎',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} more.',
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
    id: 'cometFragment', name: 'Comet Fragment', class: 'starseer', rarity: 'common', cost: 0, type: 'attack',
    keywords: [], icon: '☄',
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, GAIN_CHARGE] },
  },
  {
    id: 'starbladePhalanx', name: 'Starblade Phalanx', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'damage', target: 'enemy', amount: 6, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'crystalBarrier', name: 'Crystal Barrier', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🔷',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'block', target: 'self', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'block', target: 'self', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starShower', name: 'Star Shower', class: 'starseer', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 3, hits: 3 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Starstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 4, hits: 3 },
        { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'scholarsInsight', name: "Scholar's Insight", class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '📖',
    effects: [{ op: 'draw', amount: 2 }, GAIN_CHARGE],
    textTemplate: 'Draw {draw} cards.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, GAIN_CHARGE] },
  },
  {
    id: 'frostVeil', name: 'Frost Veil', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
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
    id: 'starSlicer', name: 'Star Slicer', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4, hits: 2 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Starstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5, hits: 2 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starstoneWard', name: 'Starstone Ward', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🔰',
    effects: [
      { op: 'block', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starlance', name: 'Starlance', class: 'starseer', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🏹',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 13, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 17, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'twinkling', name: 'Twinkling', class: 'starseer', rarity: 'common', cost: 0, type: 'skill',
    keywords: [], icon: '✨',
    effects: [
      { op: 'draw', amount: 1 },
      { op: 'gainEnergy', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Draw {draw} card. Starstone: gain {gainEnergy} Energy.',
    upgrade: {
      effects: [
        { op: 'draw', amount: 2 },
        { op: 'gainEnergy', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'frostNova', name: 'Frost Nova', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '❄',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Apply {weak} Weak. Starstone: apply {vulnerable} Vulnerable.',
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
    id: 'starstoneArc', name: 'Starstone Arc', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '⚡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: apply {vulnerable} Vulnerable.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'lucidity', name: 'Lucidity', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🌙',
    effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: { effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 2 }, GAIN_CHARGE] },
  },
  {
    id: 'stargazerCard', name: 'Stargazer', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🔭',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stargazer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge.',
    upgrade: { cost: 0 },
  },
  {
    id: 'astralArmorCard', name: 'Astral Armor', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌌',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: one }],
    textTemplate: 'At the end of your turn, gain 4 Block.',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: { f: 'add', args: [2] } }],
      textTemplate: 'At the end of your turn, gain 8 Block.',
    },
  },
  {
    id: 'moonrendCut', name: 'Moonrend Cut', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'attack',
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
    id: 'meteorite', name: 'Meteorite', class: 'starseer', rarity: 'uncommon', cost: 3, type: 'attack',
    keywords: [], icon: '🪨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 18, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 24, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 22, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 30, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'meteorSwarm', name: 'Meteor Swarm', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '☄',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 5 },
      { op: 'damage', target: 'allEnemies', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Starstone: {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 7 },
        { op: 'damage', target: 'allEnemies', amount: 7, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'gravityWell', name: 'Gravity Well', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'skill',
    keywords: [], icon: '🕳',
    effects: [
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 },
      { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Starstone: apply {weak} Weak to ALL.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 },
        { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'azureCoilCard', name: 'Azure Coil', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🌀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'azureCoil', stacks: one }],
    textTemplate: 'Whenever you play a Skill, gain 2 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'astralCleave', name: 'Astral Cleave', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '⚔',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10 },
      { op: 'poiseDamage', target: 'enemy', amount: 8 },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Starstone: deal {damage.2} more.',
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
    id: 'radiantSpray', name: 'Radiant Spray', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🎇',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 },
      { op: 'damage', target: 'allEnemies', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} to ALL enemies. Apply {vulnerable} Vulnerable to ALL. Starstone: deal {damage.2} to ALL again.',
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
    id: 'supernova', name: 'Supernova', class: 'starseer', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '💥',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 8, hits: { f: 'energySpent' } }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage to ALL enemies once per Energy spent.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 10, hits: { f: 'energySpent' } }, GAIN_CHARGE] },
  },
  {
    id: 'timeDilation', name: 'Time Dilation', class: 'starseer', rarity: 'rare', cost: 2, type: 'skill',
    keywords: ['exhaust'], icon: '⏳',
    effects: [{ op: 'gainEnergy', amount: 2 }, { op: 'draw', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: { keywords: [], textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards.' },
  },
  {
    id: 'starstoneKris', name: 'Starstone Kris', class: 'starseer', rarity: 'rare', cost: 1, type: 'attack',
    keywords: [], icon: '🔪',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'draw', amount: 1, if: CHARGED },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: draw {draw} card and deal {damage.2} again.',
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
    id: 'constellationCard', name: 'Constellation', class: 'starseer', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '💫',
    effects: [{ op: 'applyStatus', target: 'self', status: 'constellation', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, deal 4 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'starfallBeam', name: 'Starfall Beam', class: 'starseer', rarity: 'rare', cost: 3, type: 'attack',
    keywords: [], icon: '🔆',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 12, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'allEnemies', amount: 20, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 16, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'allEnemies', amount: 26, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starcaller', name: 'Starcaller', class: 'starseer', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '⭐',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6, hits: { f: 'energySpent' } },
      { op: 'damage', target: 'enemy', amount: 8, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage once per Energy spent. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8, hits: { f: 'energySpent' } },
        { op: 'damage', target: 'enemy', amount: 10, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'umbralWard', name: 'Umbral Ward', class: 'starseer', rarity: 'rare', cost: 2, type: 'skill',
    keywords: [], icon: '🌑',
    effects: [
      { op: 'block', target: 'self', amount: 20, if: { p: 'not', pred: CHARGED } },
      { op: 'block', target: 'self', amount: 30, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: {block.2} instead.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 26, if: { p: 'not', pred: CHARGED } },
        { op: 'block', target: 'self', amount: 38, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'waxingMoonCard', name: 'Waxing Moon', class: 'starseer', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '🌕',
    effects: [{ op: 'applyStatus', target: 'self', status: 'waxingMoon', stacks: one }],
    textTemplate: 'At the start of your turn, apply 2 Vulnerable to ALL enemies.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (a cheap combo-piece and a defensive combo-piece), two
  // uncommons (a card-draw combo skill and a scaling shield power), two rares
  // (a heavy Starstone-gated attack and a combo-fed draw power) — rounding
  // the pool to 36. All follow the same "check charge first, then GAIN_CHARGE
  // last" shape as the rest of the pool.
  {
    id: 'shootingShard', name: 'Shooting Shard', class: 'starseer', rarity: 'common', cost: 0, type: 'attack',
    keywords: [], icon: '💫',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'wardingStar', name: 'Warding Star', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '⭐',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starPath', name: 'Star Path', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🌌',
    effects: [
      { op: 'draw', amount: 1 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Draw {draw} card. Starstone: draw {draw.2} more.',
    upgrade: {
      effects: [
        { op: 'draw', amount: 2 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'moonlitShieldCard', name: 'Moonlit Shield', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '🔷',
    effects: [{ op: 'applyStatus', target: 'self', status: 'moonlitShield', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, gain 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'celestialLance', name: 'Celestial Lance', class: 'starseer', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '🔱',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 22, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 13, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 28, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'astromancerCard', name: 'Astromancer', class: 'starseer', rarity: 'rare', cost: 1, type: 'power',
    keywords: [], icon: '📚',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astromancer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge and draw a card.',
    upgrade: { cost: 0 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'starSpark', name: 'Star Spark', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '✨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'astralInsight', name: 'Astral Insight', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🌠',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'draw', amount: 1 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Draw {draw} card. Starstone: draw {draw.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'draw', amount: 1 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
];
