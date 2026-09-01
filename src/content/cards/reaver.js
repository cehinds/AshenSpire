// src/content/cards/reaver.js — the Reaver pool (SPEC §5.2; grown to 30
// rewardable cards to match the other classes).
//
// Pure data. Every card's numbers come from the SPEC §5.2 table; text tokens
// bind to effects per SPEC §3.13. Powers with invisible stack counts use
// formula-valued stacks ({f:'add',args:[1]}) — formula values are exempt from
// the literal-number token rule (documented in DEVELOPER.md).
//
// Content-pass additions deepen the stance / Bleed / Poise identity: Riposte &
// Cleaving Blow (Poise), Rend & Bloodhunter's Strike (Bleed), Warding Lunge
// (defense + Gorefire), Impale (Stagger→Bleed), and Sanguine Pact (a power
// that turns Bleed bursts into Strength).

const one = { f: 'add', args: [1] };

export const reaverCards = [
  // ---- Starters -------------------------------------------------------------
  {
    // Shared basic (all three classes start with Strikes/Defends — colorless).
    id: 'strike', name: 'Strike', class: 'colorless', rarity: 'starter', cost: 1, type: 'attack',
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }] },
  },
  {
    id: 'defend', name: 'Defend', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [{ op: 'block', target: 'self', amount: 5 }],
    textTemplate: 'Gain {block} Block.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }] },
  },
  {
    id: 'technique', name: 'Footwork', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    keywords: [], icon: '✧',
    effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {block} Block. Draw {draw} card.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'draw', amount: 1 }] },
  },
  // THE UNARMED PACKAGE (framework contract: Unarmed fallback — the entities
  // framework.evasiveGuard and framework.dodgeRoll, authored here as the base
  // cards the unarmed guard and technique profiles resolve to). Evasive Guard
  // is a guard that also dodges; Dodge Roll is the pure dodge, priced by the
  // Weight Class the player stands in (mechanics.json), not by this cost.
  {
    id: 'evasiveGuard', name: 'Evasive Guard', class: 'colorless', rarity: 'starter', cost: 1, type: 'skill',
    keywords: [], icon: '🌀',
    effects: [{ op: 'block', target: 'self', amount: 1 }, { op: 'dodgeRoll', target: 'self' }],
    textTemplate: 'Gain {block} Block, then roll to evade: on a success, gain Block equal to the dodge.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 3 }, { op: 'dodgeRoll', target: 'self' }] },
  },
  {
    id: 'dodgeRoll', name: 'Dodge Roll', class: 'colorless', rarity: 'starter', cost: 0, staminaCost: 1, type: 'skill',
    keywords: [], icon: '💨',
    effects: [{ op: 'dodgeRoll', target: 'self' }],
    textTemplate: 'Roll to evade: on a success, gain Block from the dodge. Light: 1 Stamina. Medium: 2 Stamina, 1 Energy. Heavy: 3 Stamina, 2 Energy.',
    upgrade: { effects: [{ op: 'dodgeRoll', target: 'self' }] },
  },
  {
    id: 'gorefireSlash', name: 'Gorefire Slash', class: 'reaver', rarity: 'starter', cost: 1, manaCost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 },
      ],
    },
  },

  // ---- Commons ---------------------------------------------------------------
  {
    id: 'crimsonCleave', name: 'Crimson Cleave', class: 'reaver', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🪓',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 8 },
      { op: 'applyStatus', target: 'allEnemies', status: 'bleed', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Apply {bleed} Bleed to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 11 },
        { op: 'applyStatus', target: 'allEnemies', status: 'bleed', stacks: 2 },
      ],
    },
  },
  {
    id: 'shieldBash', name: 'Shield Bash', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🛡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'poiseDamage', target: 'enemy', amount: 4 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'poiseDamage', target: 'enemy', amount: 5 },
      ],
    },
  },
  {
    id: 'quickstep', name: 'Quickstep', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '👣',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {block} Block. Draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'draw', amount: 1 },
      ],
    },
  },
  {
    id: 'guardCounter', name: 'Guard Counter', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '↩',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4, if: { p: 'not', pred: { p: 'hasBlock', of: 'self' } } },
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'hasBlock', of: 'self' } },
    ],
    textTemplate: 'Deal {damage} damage. If you have Block: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6, if: { p: 'not', pred: { p: 'hasBlock', of: 'self' } } },
        { op: 'damage', target: 'enemy', amount: 14, if: { p: 'hasBlock', of: 'self' } },
      ],
    },
  },
  {
    id: 'ironResolve', name: 'Iron Resolve', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '⛨',
    effects: [
      { op: 'block', target: 'self', amount: 5, if: { p: 'not', pred: { p: 'inStance', stance: 'bulwark' } } },
      { op: 'block', target: 'self', amount: 9, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain {block.2} instead.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7, if: { p: 'not', pred: { p: 'inStance', stance: 'bulwark' } } },
        { op: 'block', target: 'self', amount: 12, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'serratedBlade', name: 'Serrated Blade', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🪚',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: { p: 'hasStatus', of: 'target', status: 'bleed' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Bleed: apply {bleed} more Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4, if: { p: 'hasStatus', of: 'target', status: 'bleed' } },
      ],
    },
  },
  {
    id: 'enterGorefire', name: 'Enter: Gorefire', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🔥',
    effects: [
      { op: 'enterStance', stance: 'gorefire' },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Enter Gorefire Stance. Draw {draw} card.',
    upgrade: { cost: 0 },
  },
  {
    id: 'enterBulwark', name: 'Enter: Bulwark', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [{ op: 'enterStance', stance: 'bulwark' }],
    textTemplate: 'Enter Bulwark Stance.',
    upgrade: {
      effects: [
        { op: 'enterStance', stance: 'bulwark' },
        { op: 'block', target: 'self', amount: 3 },
      ],
      textTemplate: 'Enter Bulwark Stance. Gain {block} extra Block.',
    },
  },
  {
    id: 'riposte', name: 'Riposte', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '⚔',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'poiseDamage', target: 'enemy', amount: 4, if: { p: 'hasBlock', of: 'self' } },
    ],
    textTemplate: 'Deal {damage} damage. If you have Block: deal {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'poiseDamage', target: 'enemy', amount: 6, if: { p: 'hasBlock', of: 'self' } },
      ],
    },
  },
  {
    id: 'rend', name: 'Rend', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2, if: { p: 'inStance', stance: 'gorefire' } },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed. Gorefire: apply {bleed.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2, if: { p: 'inStance', stance: 'gorefire' } },
      ],
    },
  },
  {
    id: 'cleavingBlow', name: 'Cleaving Blow', class: 'reaver', rarity: 'common', cost: 2, type: 'attack',
    keywords: [], icon: '🪓',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 7 },
      { op: 'poiseDamage', target: 'allEnemies', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Deal {poiseDamage} Poise damage to ALL.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 9 },
        { op: 'poiseDamage', target: 'allEnemies', amount: 4 },
      ],
    },
  },

  // ---- Uncommons --------------------------------------------------------------
  {
    id: 'stomp', name: 'Stomp', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🦶',
    effects: [
      { op: 'damage', target: 'enemy', amount: 12 },
      { op: 'poiseDamage', target: 'enemy', amount: 8 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 16 },
        { op: 'poiseDamage', target: 'enemy', amount: 10 },
      ],
    },
  },
  {
    id: 'rallyingStandard', name: 'Rallying Standard', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '⚑',
    effects: [{ op: 'applyStatus', target: 'self', status: 'rallyingStandard', stacks: one }],
    textTemplate: 'At the start of your turn, gain 1 Strength and take 1 damage.',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'rallyingStandardUp', stacks: one }],
      textTemplate: 'At the start of your turn, gain 1 Strength.',
    },
  },
  {
    id: 'warSurgeon', name: 'War Surgeon', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '⚕',
    effects: [
      {
        op: 'heal', target: 'self',
        amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'allEnemies', per: 4 }] },
      },
    ],
    textTemplate: 'Heal 2 HP for every 4 Bleed on all enemies. Exhaust.',
    upgrade: {
      effects: [
        {
          op: 'heal', target: 'self',
          amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'allEnemies', per: 3 }] },
        },
      ],
      textTemplate: 'Heal 2 HP for every 3 Bleed on all enemies. Exhaust.',
    },
  },
  {
    id: 'hemorrhage', name: 'Hemorrhage', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: ['exhaust'], icon: '🩸',
    effects: [
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: { f: 'stacks', status: 'bleed', of: 'target' } },
    ],
    textTemplate: "Double the target's Bleed. Exhaust.",
    upgrade: {
      keywords: [],
      textTemplate: "Double the target's Bleed.",
    },
  },
  {
    id: 'twinbladeFlurry', name: 'Twinblade Flurry', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'attack',
    keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }],
    textTemplate: 'Deal {damage} damage {hits} times.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }] },
  },
  {
    id: 'shieldwall', name: 'Shieldwall', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'skill',
    keywords: [], icon: '🧱',
    effects: [
      { op: 'block', target: 'self', amount: 12 },
      { op: 'applyStatus', target: 'self', status: 'bulwarkEcho', stacks: one, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain 4 Block next turn.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 16 },
        { op: 'applyStatus', target: 'self', status: 'bulwarkEcho', stacks: one, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'kickOff', name: 'Kick Off', class: 'reaver', rarity: 'uncommon', cost: 0, type: 'attack',
    keywords: ['exhaust'], icon: '🥾',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'poiseDamage', target: 'enemy', amount: 3 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Exhaust.',
    upgrade: {
      keywords: [],
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'poiseDamage', target: 'enemy', amount: 3 },
      ],
      textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    },
  },
  {
    id: 'wardingLunge', name: 'Warding Lunge', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 8 },
      { op: 'enterStance', stance: 'gorefire' },
    ],
    textTemplate: 'Gain {block} Block. Enter Gorefire Stance.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 11 },
        { op: 'enterStance', stance: 'gorefire' },
      ],
    },
  },
  {
    id: 'impale', name: 'Impale', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 6, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target is Staggered: apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 8, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
  {
    id: 'warcry', name: 'Warcry', class: 'reaver', rarity: 'uncommon', cost: 0, type: 'skill',
    keywords: ['exhaust'], icon: '📣',
    effects: [
      { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 },
      { op: 'draw', amount: 1 },
    ],
    textTemplate: 'Gain {strength} Strength. Draw {draw} card. Exhaust.',
    upgrade: {
      keywords: [],
      textTemplate: 'Gain {strength} Strength. Draw {draw} card.',
    },
  },

  // ---- Rares -------------------------------------------------------------------
  {
    id: 'executioner', name: 'Executioner', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '⚰',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'not', pred: { p: 'hasStatus', of: 'target', status: 'staggered' } } },
      { op: 'damage', target: 'enemy', amount: 25, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage. If the target is Staggered: deal {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 14, if: { p: 'not', pred: { p: 'hasStatus', of: 'target', status: 'staggered' } } },
        { op: 'damage', target: 'enemy', amount: 32, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
  {
    id: 'goreblood', name: "Goreblood", class: 'reaver', rarity: 'rare', cost: 3, type: 'power',
    keywords: [], icon: '♛',
    effects: [{ op: 'applyStatus', target: 'self', status: 'goreblood', stacks: one }],
    textTemplate: 'Poise thresholds no longer increase after filling.',
    upgrade: { cost: 2 },
  },
  {
    id: 'unbreakable', name: 'Unbreakable', class: 'reaver', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '⬟',
    effects: [{ op: 'applyStatus', target: 'self', status: 'unbreakable', stacks: one }],
    textTemplate: 'Block no longer expires at the start of your turn. (Block capped at 30.)',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'unbreakableUp', stacks: one }],
      textTemplate: 'Block no longer expires at the start of your turn. (Block capped at 40.)',
    },
  },
  {
    id: 'stitchedArms', name: 'Stitched Arms', class: 'reaver', rarity: 'rare', cost: 'X', type: 'attack',
    keywords: [], icon: '🦾',
    effects: [{ op: 'damage', target: 'randomEnemy', amount: 6, hits: { f: 'energySpent' } }],
    textTemplate: 'Deal {damage} damage to a random enemy once per Energy spent.',
    upgrade: { effects: [{ op: 'damage', target: 'randomEnemy', amount: 8, hits: { f: 'energySpent' } }] },
  },
  {
    id: 'lastStand', name: 'Last Stand', class: 'reaver', rarity: 'rare', cost: 1, type: 'skill',
    keywords: ['ethereal'], icon: '🕯',
    effects: [{ op: 'block', target: 'self', amount: { f: 'missingHp', of: 'self', max: 20 } }],
    textTemplate: 'Ethereal. Gain Block equal to your missing HP (max 20).',
    upgrade: {
      effects: [{ op: 'block', target: 'self', amount: { f: 'missingHp', of: 'self', max: 30 } }],
      textTemplate: 'Ethereal. Gain Block equal to your missing HP (max 30).',
    },
  },
  {
    id: 'warriorsVow', name: "Warrior's Vow", class: 'reaver', rarity: 'rare', cost: 0, type: 'skill',
    keywords: ['innate', 'exhaust'], icon: '📜',
    effects: [{ op: 'enterStance', stance: 'gorefire' }],
    textTemplate: 'Innate. Enter Gorefire Stance. Exhaust.',
    upgrade: {
      effects: [
        { op: 'enterStance', stance: 'gorefire' },
        { op: 'draw', amount: 1 },
      ],
      textTemplate: 'Innate. Enter Gorefire Stance. Draw {draw} card. Exhaust.',
    },
  },
  {
    id: 'ruinousBlow', name: 'Ruinous Blow', class: 'reaver', rarity: 'rare', cost: 3, type: 'attack',
    keywords: [], icon: '🔨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 20 },
      { op: 'poiseDamage', target: 'enemy', amount: 12 },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 26 },
        { op: 'poiseDamage', target: 'enemy', amount: 14 },
      ],
    },
  },
  {
    id: 'bloodhuntersStrike', name: "Bloodhunter's Strike", class: 'reaver', rarity: 'rare', cost: 1, type: 'attack',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: { f: 'stacks', status: 'bleed', of: 'target' } },
    ],
    textTemplate: 'Deal {damage} damage, plus 1 for each Bleed on the target.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'damage', target: 'enemy', amount: { f: 'stacks', status: 'bleed', of: 'target' } },
      ],
    },
  },
  {
    id: 'sanguinePactCard', name: 'Sanguine Pact', class: 'reaver', rarity: 'rare', cost: 2, type: 'power',
    keywords: [], icon: '🩸',
    effects: [{ op: 'applyStatus', target: 'self', status: 'sanguinePact', stacks: one }],
    textTemplate: 'Whenever Bleed bursts on an enemy, gain 2 Strength.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (Bleed/Poise upkeep), two uncommons (a stance-flip attack
  // and a power that turns HP loss into Block), two rares (Bleed-scaling finisher
  // and a Poise-scaling finisher) — rounding the pool to 36.
  {
    id: 'goreslash', name: 'Goreslash', class: 'reaver', rarity: 'common', cost: 1, type: 'attack',
    keywords: [], icon: '🩸',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 },
      ],
    },
  },
  {
    id: 'bracingStance', name: 'Bracing Stance', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🛡',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'block', target: 'self', amount: 3, if: { p: 'inStance', stance: 'bulwark' } },
    ],
    textTemplate: 'Gain {block} Block. If in Bulwark Stance: gain {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'block', target: 'self', amount: 4, if: { p: 'inStance', stance: 'bulwark' } },
      ],
    },
  },
  {
    id: 'flameToBlade', name: 'Flame to Blade', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '🔥',
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'damage', target: 'enemy', amount: 6, if: { p: 'inStance', stance: 'gorefire' } },
      { op: 'enterStance', stance: 'gorefire' },
    ],
    textTemplate: 'Deal {damage} damage. If already in Gorefire Stance: deal {damage.2} more. Enter Gorefire Stance.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 10 },
        { op: 'damage', target: 'enemy', amount: 8, if: { p: 'inStance', stance: 'gorefire' } },
        { op: 'enterStance', stance: 'gorefire' },
      ],
    },
  },
  {
    id: 'ironVowCard', name: 'Iron Vow', class: 'reaver', rarity: 'uncommon', cost: 1, type: 'power',
    keywords: [], icon: '⛓',
    effects: [{ op: 'applyStatus', target: 'self', status: 'ironVow', stacks: one }],
    textTemplate: 'Whenever you lose HP, gain 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodTithe', name: 'Blood Tithe', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'target' }] } },
    ],
    textTemplate: 'Deal {damage} damage, plus double the Bleed on the target.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'damage', target: 'enemy', amount: { f: 'mul', args: [2, { f: 'stacks', status: 'bleed', of: 'target' }] } },
      ],
    },
  },
  {
    id: 'poiseBreaker', name: 'Poise Breaker', class: 'reaver', rarity: 'rare', cost: 2, type: 'attack',
    keywords: [], icon: '🔨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 11 },
      { op: 'poiseDamage', target: 'enemy', amount: 10 },
      { op: 'poiseDamage', target: 'enemy', amount: 8, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. If the target is Staggered: deal {poiseDamage.2} more Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 14 },
        { op: 'poiseDamage', target: 'enemy', amount: 12 },
        { op: 'poiseDamage', target: 'enemy', amount: 10, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'rondelParry', name: 'Rondel Parry', class: 'reaver', rarity: 'common', cost: 1, type: 'skill',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'poiseDamage', target: 'enemy', amount: 5 },
    ],
    textTemplate: 'Gain {block} Block and deal {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'poiseDamage', target: 'enemy', amount: 7 },
      ],
    },
  },
  {
    id: 'sunderplate', name: 'Sunderplate', class: 'reaver', rarity: 'uncommon', cost: 2, type: 'attack',
    keywords: [], icon: '⚒',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9 },
      { op: 'poiseDamage', target: 'enemy', amount: 10 },
      { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. If the target is Staggered: apply {bleed} Bleed.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12 },
        { op: 'poiseDamage', target: 'enemy', amount: 13 },
        { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4, if: { p: 'hasStatus', of: 'target', status: 'staggered' } },
      ],
    },
  },
];
