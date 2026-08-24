// src/content/cards/rogue.js — Rogue parity slice.
//
// Prepared is a content-owned one-hit opening: Rogue attacks read it before
// removing it. Venom is a normal status hook. No Rogue behavior needs a new
// opcode, predicate, formula, or script.

const one = { f: 'add', args: [1] };
const PREPARED = { p: 'hasStatus', of: 'self', status: 'prepared' };
const TARGET_WEAK = { p: 'hasStatus', of: 'target', status: 'weak' };
const TARGET_VULNERABLE = { p: 'hasStatus', of: 'target', status: 'vulnerable' };
const TARGET_BLEED = { p: 'hasStatus', of: 'target', status: 'bleed' };
const TARGET_VENOM = { p: 'hasStatus', of: 'target', status: 'venom' };
const prepare = () => ({ op: 'applyStatus', target: 'self', status: 'prepared', stacks: one });
const spendPrepared = () => ({ op: 'removeStatus', target: 'self', status: 'prepared' });

export const rogueCards = [
  // ---- Non-reward cards: signature + two generated tools -----------------
  {
    id: 'ambush', name: 'Ambush', class: 'rogue', rarity: 'starter', cost: 1, manaCost: 1, type: 'attack',
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'damage', target: 'enemy', amount: 8, if: PREPARED },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 },
      spendPrepared(),
    ],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Apply {vulnerable} Vulnerable. Consume Prepared.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'damage', target: 'enemy', amount: 10, if: PREPARED },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 },
        spendPrepared(),
      ],
    },
  },
  {
    id: 'rogueShiv', name: 'Shiv', class: 'rogue', rarity: 'special', cost: 0, type: 'attack',
    keywords: ['exhaust'], icon: '🔪',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }] },
  },
  {
    id: 'smokePellet', name: 'Smoke Pellet', class: 'rogue', rarity: 'special', cost: 0, type: 'skill',
    keywords: ['exhaust'], icon: '🌫',
    effects: [{ op: 'block', target: 'self', amount: 3 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, prepare()] },
  },

  // ---- Commons (13) -------------------------------------------------------
  {
    id: 'quickCut', name: 'Quick Cut', class: 'rogue', rarity: 'common', cost: 0, type: 'attack', keywords: [], icon: '╱',
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, { op: 'damage', target: 'enemy', amount: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'damage', target: 'enemy', amount: 4, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'feint', name: 'Feint', class: 'rogue', rarity: 'common', cost: 0, type: 'skill', keywords: [], icon: '↝',
    effects: [prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Become Prepared. Draw {draw} card.',
    upgrade: { effects: [prepare(), { op: 'draw', amount: 1 }, { op: 'block', target: 'self', amount: 3 }], textTemplate: 'Become Prepared. Draw {draw} card. Gain {block} Block.' },
  },
  {
    id: 'backstep', name: 'Backstep', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '👣',
    effects: [{ op: 'block', target: 'self', amount: 6 }, prepare()],
    textTemplate: 'Gain {block} Block. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, prepare()] },
  },
  {
    id: 'twinPrick', name: 'Twin Prick', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '†',
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 2 }, { op: 'damage', target: 'enemy', amount: 2, hits: 2, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pocketSand', name: 'Pocket Sand', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '✺',
    effects: [{ op: 'block', target: 'self', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }] },
  },
  {
    id: 'hamstringRogue', name: 'Hamstring', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🦵',
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {vulnerable} Vulnerable.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }] },
  },
  {
    id: 'serratedShiv', name: 'Serrated Shiv', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '🩸',
    effects: [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed. Prepared: apply {bleed.2} more. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 7 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'smokeVeil', name: 'Smoke Veil', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🌁',
    effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'ricochet', name: 'Ricochet', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '➶',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 4 }],
    textTemplate: 'Deal {damage} damage to ALL enemies.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }] },
  },
  {
    id: 'lowBlow', name: 'Low Blow', class: 'rogue', rarity: 'common', cost: 1, type: 'attack', keywords: [], icon: '↘',
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }, { op: 'poiseDamage', target: 'enemy', amount: 5, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Prepared: deal {poiseDamage.2} more Poise damage. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }, { op: 'poiseDamage', target: 'enemy', amount: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'pilfer', name: 'Pilfer', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: [], icon: '🖐',
    effects: [{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Draw {draw} cards. Discard 1 card at random.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'vanish', name: 'Vanish', class: 'rogue', rarity: 'common', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '◌',
    effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }],
    textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'block', target: 'self', amount: 8 }, prepare(), { op: 'addCard', card: 'smokePellet', pile: 'hand' }], textTemplate: 'Gain {block} Block. Become Prepared. Add a Smoke Pellet to your hand.' },
  },
  {
    id: 'cheapShot', name: 'Cheap Shot', class: 'rogue', rarity: 'common', cost: 2, type: 'attack', keywords: [], icon: '✹',
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 6, if: TARGET_WEAK }],
    textTemplate: 'Deal {damage} damage. If the target is Weak, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 8, if: TARGET_WEAK }] },
  },

  // ---- Uncommons (13) -----------------------------------------------------
  {
    id: 'bladeDanceRogue', name: 'Blade Dance', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '⚔',
    effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }, { op: 'damage', target: 'enemy', amount: 1, hits: 3, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'garrote', name: 'Garrote', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '➰',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }],
    textTemplate: 'Deal {damage} damage. Apply {bleed} Bleed and {weak} Weak.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'fanOfKnives', name: 'Fan of Knives', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '🗡',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 5 }, { op: 'draw', amount: 1 }],
    textTemplate: 'Deal {damage} damage to ALL enemies. Draw {draw} card.',
    upgrade: { effects: [{ op: 'damage', target: 'allEnemies', amount: 7 }, { op: 'draw', amount: 1 }] },
  },
  {
    id: 'setupRogue', name: 'Setup', class: 'rogue', rarity: 'uncommon', cost: 0, type: 'skill', keywords: ['exhaust'], icon: '⚙',
    effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }],
    textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Add a Shiv to your hand. Exhaust.',
    upgrade: { effects: [prepare(), { op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, { op: 'addCard', card: 'rogueShiv', pile: 'hand' }], textTemplate: 'Become Prepared. Gain {gainEnergy} Energy. Draw {draw} card. Add a Shiv to your hand. Exhaust.' },
  },
  {
    id: 'acrobaticsRogue', name: 'Acrobatics', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '🤸',
    effects: [{ op: 'block', target: 'self', amount: 7 }, { op: 'draw', amount: 2 }, { op: 'discard', amount: 1, random: true }],
    textTemplate: 'Gain {block} Block. Draw {draw} cards. Discard 1 at random.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'draw', amount: 3 }, { op: 'discard', amount: 1, random: true }] },
  },
  {
    id: 'disorient', name: 'Disorient', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '💫',
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }],
    textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable. Exhaust.',
    upgrade: { keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2 }], textTemplate: 'Apply {weak} Weak and {vulnerable} Vulnerable.' },
  },
  {
    id: 'coupDeGrace', name: 'Coup de Grace', class: 'rogue', rarity: 'uncommon', cost: 2, type: 'attack', keywords: [], icon: '☠',
    effects: [{ op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 10, if: TARGET_VULNERABLE }],
    textTemplate: 'Deal {damage} damage. If the target is Vulnerable, deal {damage.2} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 13 }, { op: 'damage', target: 'enemy', amount: 13, if: TARGET_VULNERABLE }] },
  },
  {
    id: 'sap', name: 'Sap', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'attack', keywords: [], icon: '♠',
    effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }],
    textTemplate: 'Deal {damage} damage. Apply {weak} Weak. Deal {poiseDamage} Poise damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 6 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 3 }, { op: 'poiseDamage', target: 'enemy', amount: 5 }] },
  },
  {
    id: 'shadowstep', name: 'Shadowstep', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '◐',
    effects: [{ op: 'block', target: 'self', amount: 5 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Gain {block} Block. Become Prepared. Draw {draw} card.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 7 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'afterimageCard', name: 'Afterimage', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'power', keywords: [], icon: '👤',
    effects: [{ op: 'applyStatus', target: 'self', status: 'afterimage', stacks: one }],
    textTemplate: 'Every third card you play grants 3 Block.',
    upgrade: { cost: 0 },
  },
  {
    id: 'bloodletterRogue', name: 'Bloodletter', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '🩸',
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: { f: 'stacks', status: 'bleed', of: 'target' } }],
    textTemplate: "Double the target's Bleed. Exhaust.",
    upgrade: { keywords: [], textTemplate: "Double the target's Bleed." },
  },
  {
    id: 'venomcoat', name: 'Venomcoat', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '🐍',
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 4 }, prepare()],
    textTemplate: 'Apply {venom} Venom. Become Prepared.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'venom', stacks: 6 }, prepare()] },
  },
  {
    id: 'misdirect', name: 'Misdirect', class: 'rogue', rarity: 'uncommon', cost: 1, type: 'skill', keywords: [], icon: '↪',
    effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Become Prepared.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 9 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }, prepare()] },
  },

  // ---- Rares (10) ---------------------------------------------------------
  {
    id: 'assassinate', name: 'Assassinate', class: 'rogue', rarity: 'rare', cost: 2, manaCost: 1, type: 'attack', keywords: ['exhaust'], icon: '🗡',
    effects: [{ op: 'damage', target: 'enemy', amount: 14 }, { op: 'damage', target: 'enemy', amount: 14, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage. Prepared: deal {damage.2} more. Consume Prepared. Exhaust.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 18 }, { op: 'damage', target: 'enemy', amount: 18, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'thousandCutsRogue', name: 'Thousand Cuts', class: 'rogue', rarity: 'rare', cost: 2, type: 'attack', keywords: [], icon: '✣',
    effects: [{ op: 'damage', target: 'enemy', amount: 2, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()],
    textTemplate: 'Deal {damage} damage {hits} times. Prepared: deal {damage.2} damage {hits.2} times. Consume Prepared.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 6 }, { op: 'damage', target: 'enemy', amount: 1, hits: 6, if: PREPARED }, spendPrepared()] },
  },
  {
    id: 'deadlyTempoCard', name: 'Deadly Tempo', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '⏱',
    effects: [{ op: 'applyStatus', target: 'self', status: 'deadlyTempo', stacks: one }],
    textTemplate: 'At the start of your turn, become Prepared and draw a card.',
    upgrade: { cost: 1 },
  },
  {
    id: 'opportunistCard', name: 'Opportunist', class: 'rogue', rarity: 'rare', cost: 1, type: 'power', keywords: [], icon: '◎',
    effects: [{ op: 'applyStatus', target: 'self', status: 'opportunist', stacks: one }],
    textTemplate: 'Whenever an enemy Staggers, become Prepared and draw a card.',
    upgrade: { cost: 0 },
  },
  {
    id: 'envenomCard', name: 'Envenom', class: 'rogue', rarity: 'rare', cost: 2, type: 'power', keywords: [], icon: '☣',
    effects: [{ op: 'applyStatus', target: 'self', status: 'envenom', stacks: one }],
    textTemplate: 'Your attacks apply 1 Venom per stack.',
    upgrade: { cost: 1 },
  },
  {
    id: 'toxicVolley', name: 'Toxic Volley', class: 'rogue', rarity: 'rare', cost: 2, type: 'skill', keywords: [], icon: '🏹',
    effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 5 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }],
    textTemplate: 'Apply {venom} Venom and {weak} Weak to ALL enemies.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'venom', stacks: 7 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] },
  },
  {
    id: 'smokeBomb', name: 'Smoke Bomb', class: 'rogue', rarity: 'rare', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '💨',
    effects: [{ op: 'block', target: 'self', amount: 8 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 3 }],
    textTemplate: 'Gain {block} Block. Apply {weak} Weak to ALL enemies. Exhaust.',
    upgrade: { effects: [{ op: 'block', target: 'self', amount: 10 }, { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 4 }] },
  },
  {
    id: 'executionWindow', name: 'Execution Window', class: 'rogue', rarity: 'rare', cost: 1, type: 'skill', keywords: ['exhaust'], icon: '⌛',
    effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 3 }, prepare(), { op: 'draw', amount: 1 }],
    textTemplate: 'Apply {vulnerable} Vulnerable. Become Prepared. Draw {draw} card. Exhaust.',
    upgrade: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 4 }, prepare(), { op: 'draw', amount: 1 }] },
  },
  {
    id: 'perfectHeist', name: 'Perfect Heist', class: 'rogue', rarity: 'rare', cost: 0, type: 'skill', keywords: ['exhaust'], icon: '💎',
    effects: [{ op: 'draw', amount: 3 }, { op: 'gainEnergy', amount: 1 }],
    textTemplate: 'Draw {draw} cards. Gain {gainEnergy} Energy. Exhaust.',
    upgrade: { effects: [{ op: 'draw', amount: 4 }, { op: 'gainEnergy', amount: 1 }] },
  },
  {
    id: 'deathblow', name: 'Deathblow', class: 'rogue', rarity: 'rare', cost: 3, type: 'attack', keywords: [], icon: '☠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 24 },
      { op: 'damage', target: 'enemy', amount: 10, if: TARGET_BLEED },
      { op: 'damage', target: 'enemy', amount: 10, if: TARGET_VENOM },
    ],
    textTemplate: 'Deal {damage} damage. If the target has Bleed, deal {damage.2} more. If it has Venom, deal {damage.3} more.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 30 }, { op: 'damage', target: 'enemy', amount: 12, if: TARGET_BLEED }, { op: 'damage', target: 'enemy', amount: 12, if: TARGET_VENOM }] },
  },
];
