// src/content/enemies/act2.js — Act II: The Stitched Court (GDD §2)
//
// The mid-spire palace — a court that stitched itself together to survive.
// Act II escalates: bigger numbers, self-healing, and the first enemies that
// turn YOUR mechanics against you (Bleed and Blight applied to the player —
// the status model is entity-agnostic, so player-side meters just work).

export const act2Enemies = [
  {
    id: 'gildedKnight',
    size: 'medium',
    tint: 'var(--gold)',
    name: 'Gilded Knight',
    hp: [42, 46],
    poiseMax: 18,
    art: '♞',
    moves: {
      thrust: { intent: 'attack', damage: 11, weight: 50, maxConsecutive: 2 },
      parry: { intent: 'block', block: 9, weight: 30, maxConsecutive: 1 },
      rally: {
        intent: 'buff', weight: 20, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
      },
    },
  },
  {
    id: 'courtSurgeon',
    size: 'medium',
    tint: 'var(--grace)',
    name: 'Court Surgeon',
    hp: [30, 34],
    poiseMax: 10,
    art: '⚕',
    moves: {
      scalpel: { intent: 'attack', damage: 7, weight: 40 },
      sedate: {
        intent: 'debuff', weight: 30, maxConsecutive: 1,
        effects: [
          { op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 },
          { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
        ],
      },
      stitch: {
        intent: 'buff', weight: 30, maxConsecutive: 1,
        effects: [{ op: 'heal', target: 'self', amount: 8 }],
      },
    },
  },
  {
    id: 'stitchedHound',
    size: 'small',
    tint: 'var(--blood)',
    name: 'Stitched Hound',
    hp: [24, 28],
    poiseMax: 8,
    art: '🐩',
    moves: {
      maul: { intent: 'attack', damage: 4, hits: 2, weight: 60 },
      rend: {
        // The player's own favorite trick, reflected: Bleed on YOU.
        intent: 'attack', damage: 6, weight: 40,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 2 }],
      },
    },
  },
  {
    id: 'courtMarionette',
    size: 'small',
    tint: 'var(--rot)',
    name: 'Court Marionette',
    hp: [16, 18],
    poiseMax: 6,
    art: '🪆',
    moves: {
      dart: { intent: 'attack', damage: 4, hits: 2, weight: 50 },
      blowdart: {
        intent: 'attack', damage: 3, weight: 50,
        effects: [{ op: 'applyStatus', target: 'player', status: 'crimsonBlight', stacks: 2 }],
      },
    },
  },
  {
    id: 'livingArmor',
    size: 'medium',
    tint: 'var(--frost)',
    name: 'Living Armor',
    hp: [36, 40],
    poiseMax: 22,
    art: '🛡',
    moves: {
      slam: { intent: 'attack', damage: 10, weight: 40 },
      fortify: { intent: 'block', block: 12, weight: 35, maxConsecutive: 1 },
      crush: { intent: 'attack', damage: 14, weight: 25, maxConsecutive: 1 },
    },
  },

  // ---- Elite ------------------------------------------------------------------
  {
    id: 'courtDuelist',
    size: 'large',
    tint: 'var(--frost)',
    name: 'Duelist of the Court',
    hp: [90, 96],
    poiseMax: 26,
    art: '🤺',
    firstMove: 'enGarde',
    moves: {
      enGarde: {
        intent: 'buff', weight: 10, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 }],
      },
      flurry: { intent: 'attack', damage: 5, hits: 3, weight: 40, maxConsecutive: 2 },
      lunge: { intent: 'attack', damage: 14, weight: 30, maxConsecutive: 1 },
      riposte: { intent: 'block', block: 10, weight: 20, maxConsecutive: 1 },
    },
  },

  // ---- Boss: The Stitched King (GDD §2 — phase 2 literally adds limbs) ----------
  {
    id: 'stitchedKing',
    size: 'large',
    tint: 'var(--gold)',
    name: 'The Stitched King',
    hp: [195, 195],
    poiseMax: 34,
    art: '👑',
    firstMove: 'courtlyDecree',
    moves: {
      scepterBlow: { intent: 'attack', damage: 11, weight: 40, maxConsecutive: 2 },
      graspingHands: { intent: 'attack', damage: 5, hits: 3, weight: 30, maxConsecutive: 2 },
      courtlyDecree: {
        intent: 'block', block: 15, weight: 30, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 }],
      },
      thousandHands: { intent: 'attack', damage: 3, hits: 6, weight: 40, locked: true },
    },
    phases: [
      {
        // ≤50% HP: new limbs are stitched on. The pattern changes; the rules don't.
        on: 'hpBelowPct', pct: 50,
        do: [
          { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
          { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
        ],
        unlockMoves: ['thousandHands'],
      },
    ],
  },
];
