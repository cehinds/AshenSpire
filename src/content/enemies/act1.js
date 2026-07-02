// src/content/enemies/act1.js — Act 1 roster (SPEC §5.3, exact numbers)

export const act1Enemies = [
  {
    id: 'wanderingSoldier',
    name: 'Wandering Soldier',
    hp: [22, 26],
    poiseMax: 10,
    art: '⚔',
    moves: {
      slash: { intent: 'attack', damage: 7, weight: 45, maxConsecutive: 2 },
      guard: { intent: 'block', block: 6, weight: 30, maxConsecutive: 1 },
      warcry: {
        intent: 'buff', weight: 25, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
      },
    },
  },
  {
    id: 'rotHound',
    name: 'Rot Hound',
    hp: [12, 15],
    poiseMax: 6,
    art: '🐕',
    moves: {
      bite: { intent: 'attack', damage: 6, weight: 60 },
      lunge: { intent: 'attack', damage: 3, hits: 2, weight: 40 },
    },
  },
  {
    id: 'demiBrute',
    name: 'Demi-Brute',
    hp: [30, 34],
    poiseMax: 16,
    art: '🪨',
    moves: {
      club: { intent: 'attack', damage: 9, weight: 50 },
      bellow: {
        intent: 'debuff', weight: 25, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 }],
      },
      brace: { intent: 'block', block: 8, weight: 25, maxConsecutive: 1 },
    },
  },
  {
    id: 'graveWisp',
    name: 'Grave Wisp',
    hp: [10, 12],
    poiseMax: 4,
    art: '👻',
    moves: {
      curse: {
        intent: 'debuff', weight: 50, maxConsecutive: 2,
        effects: [{ op: 'addCard', card: 'dazed', pile: 'draw', position: 'random' }],
      },
      drain: {
        intent: 'attack', damage: 4, weight: 50,
        effects: [{ op: 'heal', target: 'self', amount: 4 }],
      },
    },
  },

  // ---- Elite (SPEC §5.3) ----------------------------------------------------
  {
    id: 'crucibleAspirant',
    name: 'Crucible Aspirant',
    hp: [68, 72],
    poiseMax: 24,
    art: '🐲',
    firstMove: 'consecrate',
    moves: {
      consecrate: {
        intent: 'buff', weight: 10, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }],
      },
      halberdSweep: { intent: 'attack', damage: 11, weight: 50, maxConsecutive: 2 },
      tailSlam: {
        intent: 'attack', damage: 7, weight: 30,
        effects: [{ op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 }],
      },
      goldenGuard: {
        intent: 'block', block: 12, weight: 20, maxConsecutive: 1,
        effects: [{ op: 'heal', target: 'self', amount: 4 }],
      },
    },
  },

  // ---- Boss: The Watchful Omen (SPEC §5.3 — Margit-inspired) -----------------
  {
    id: 'watchfulOmen',
    name: 'The Watchful Omen',
    hp: [140, 140],
    poiseMax: 30,
    art: '👁',
    firstMove: 'caneStrike',
    moves: {
      caneStrike: { intent: 'attack', damage: 9, weight: 40, maxConsecutive: 2 },
      hammerToss: { intent: 'attack', damage: 6, hits: 2, weight: 30, maxConsecutive: 2 },
      heldBlade: {
        // Signature delayed attack: telegraphs 16, holds (gaining 8 Block),
        // lands the following turn regardless of newly rolled intents.
        // Staggering him cancels it (engine-generic delayed-move rule).
        intent: 'attack', damage: 16, weight: 30, maxConsecutive: 1,
        delay: { turns: 1, whileCharging: { block: 8 } },
      },
      twinDaggers: { intent: 'attack', damage: 4, hits: 4, weight: 35, locked: true },
    },
    phases: [
      {
        // Phase 2 at ≤50% HP: roar — Frail + Weak on the player, +2 Strength,
        // unlock Twin Daggers. One-way door (phases default to once).
        on: 'hpBelowPct', pct: 50,
        do: [
          { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
          { op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 },
          { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
        ],
        unlockMoves: ['twinDaggers'],
      },
    ],
  },
];
