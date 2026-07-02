// src/content/enemies/act3.js — Act III: The Ashen Crown (GDD §2)
//
// The burnt canopy. Act III judges: self-reforming revenants, heavy hits,
// and the Rot Valkyrie — the one enemy in the game that inverts a player
// mechanic (she heals off landing hits on YOU, and her blades Bleed you).
// Both behaviors are plain data: a persistent damageDealt phase trigger and
// move effects on the entity-agnostic status model (SPEC §10 seams).

export const act3Enemies = [
  {
    id: 'ashRevenant',
    name: 'Ash Revenant',
    hp: [34, 38],
    poiseMax: 10,
    art: '🌋',
    moves: {
      cinderSlash: { intent: 'attack', damage: 12, weight: 55, maxConsecutive: 2 },
      reform: {
        intent: 'buff', weight: 45, maxConsecutive: 1,
        effects: [
          { op: 'heal', target: 'self', amount: 6 },
          { op: 'block', target: 'self', amount: 6 },
        ],
      },
    },
  },
  {
    id: 'graceStarvedPilgrim',
    name: 'Grace-Starved Pilgrim',
    hp: [28, 32],
    poiseMax: 8,
    art: '🧎',
    moves: {
      desperateClaw: { intent: 'attack', damage: 9, weight: 60 },
      wail: {
        intent: 'debuff', weight: 40, maxConsecutive: 1,
        effects: [
          { op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 },
          { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
        ],
      },
    },
  },
  {
    id: 'valkyrieShade',
    name: 'Valkyrie Shade',
    hp: [40, 44],
    poiseMax: 14,
    art: '🪶',
    moves: {
      spiralLance: { intent: 'attack', damage: 6, hits: 2, weight: 50 },
      bloodFeather: {
        intent: 'attack', damage: 5, weight: 50,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 3 }],
      },
    },
  },
  {
    id: 'charredColossus',
    name: 'Charred Colossus',
    hp: [55, 60],
    poiseMax: 30,
    art: '🗿',
    moves: {
      smash: { intent: 'attack', damage: 16, weight: 50, maxConsecutive: 2 },
      ashCloud: {
        intent: 'debuff', weight: 25, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'weak', stacks: 2 }],
      },
      harden: { intent: 'block', block: 14, weight: 25, maxConsecutive: 1 },
    },
  },

  // ---- Elite ------------------------------------------------------------------
  {
    id: 'crucibleLord',
    name: 'Crucible Lord',
    hp: [130, 140],
    poiseMax: 30,
    art: '🐉',
    firstMove: 'consecration',
    moves: {
      consecration: {
        intent: 'buff', weight: 10, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'self', status: 'strength', stacks: 4 }],
      },
      halberdReign: { intent: 'attack', damage: 15, weight: 45, maxConsecutive: 2 },
      tailSweep: {
        intent: 'attack', damage: 8, weight: 30,
        effects: [{ op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 }],
      },
      goldenBulwark: {
        intent: 'block', block: 16, weight: 25, maxConsecutive: 1,
        effects: [{ op: 'heal', target: 'self', amount: 6 }],
      },
    },
  },

  // ---- Final boss: The Rot Valkyrie (GDD §2, SPEC §5.3/§10) ---------------------
  {
    id: 'rotValkyrie',
    name: 'The Rot Valkyrie',
    hp: [280, 280],
    poiseMax: 36,
    art: '🦋',
    firstMove: 'spiralThrust',
    moves: {
      spiralThrust: {
        intent: 'attack', damage: 14, weight: 35, maxConsecutive: 2,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 2 }],
      },
      waterfowl: {
        intent: 'attack', damage: 4, hits: 5, weight: 30, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 2 }],
      },
      rotWings: {
        intent: 'block', block: 10, weight: 20, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'scarletRot', stacks: 3 }],
      },
      scarletDance: { intent: 'attack', damage: 5, hits: 5, weight: 35, locked: true },
    },
    phases: [
      {
        // Signature inversion (SPEC §10): she heals 3 whenever SHE lands a hit.
        // A persistent (once:false) trigger on her own damageDealt events.
        on: 'damageDealt', once: false,
        if: { p: 'eventSourceIsOwner' },
        do: [{ op: 'heal', target: 'self', amount: 3 }],
      },
      {
        // ≤50% HP: the scarlet bloom. One-way door.
        on: 'hpBelowPct', pct: 50,
        do: [
          { op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 },
          { op: 'applyStatus', target: 'player', status: 'scarletRot', stacks: 4 },
        ],
        unlockMoves: ['scarletDance'],
      },
    ],
  },
];
