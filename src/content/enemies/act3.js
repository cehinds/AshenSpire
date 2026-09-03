// src/content/enemies/act3.js — Act III: The Ashen Crown (GDD §2)
//
// The burnt canopy. Act III judges: self-reforming revenants, heavy hits,
// and the Blighted Valkyrie — the one enemy in the game that inverts a player
// mechanic (she heals off landing hits on YOU, and her blades Bleed you).
// Both behaviors are plain data: a persistent damageDealt phase trigger and
// move effects on the entity-agnostic status model (SPEC §10 seams).
//
// Creature tags (beast / humanoid / undead / construct / spirit) are NOT a field
// here any more. They are rows in content/source/tagging.csv, family `enemy`,
// against the one tag registry, and model/registries.js stamps them onto the
// def at boot — so `enemy.tags` still reads the same at runtime, and the proc
// resistance gate is unchanged. Retagging a creature is a spreadsheet row.

export const act3Enemies = [
  {
    id: 'ashRevenant',
    size: 'medium',
    tint: 'var(--ember)',
    name: 'Ash Revenant',
    hp: [34, 38],
    poiseMax: 10,
    levelProfile: { min: 13, max: 16 },
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
    id: 'emberStarvedPilgrim',
    size: 'small',
    tint: 'var(--grace)',
    name: 'Ember-Starved Pilgrim',
    hp: [28, 32],
    poiseMax: 8,
    levelProfile: { min: 13, max: 15 },
    art: '🧎',
    moves: {
      desperateClaw: { intent: 'attack', damage: 9, weight: 60 },
      // The player-side door into Insanity (Rune, 2026-08-08). An
      // ember-starved pilgrim wailing at you is the one move in the tree that
      // was already ABOUT the mind, and Insanity had no applier anywhere. The
      // pilgrim is `humanoid`, which IS in Insanity's resistance tags — it
      // resists what it inflicts, which is the joke and also the reason this
      // is the right row. Numbers PROVISIONAL, like the row's.
      wail: {
        intent: 'debuff', weight: 40, maxConsecutive: 1,
        effects: [
          { op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 },
          { op: 'applyStatus', target: 'player', status: 'frail', stacks: 1 },
          { op: 'applyStatus', target: 'player', status: 'insanity', stacks: 3 },
        ],
      },
    },
  },
  {
    id: 'valkyrieShade',
    size: 'medium',
    tint: 'var(--blood)',
    name: 'Valkyrie Shade',
    hp: [40, 44],
    poiseMax: 14,
    levelProfile: { min: 14, max: 17 },
    art: '🪶',
    moves: {
      spiralLance: { intent: 'attack', damage: 5, hits: 2, weight: 50 },
      bloodFeather: {
        intent: 'attack', damage: 5, weight: 50,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 3 }],
      },
    },
  },
  {
    id: 'charredColossus',
    size: 'large',
    tint: 'var(--ember)',
    name: 'Charred Colossus',
    hp: [55, 60],
    poiseMax: 30,
    levelProfile: { min: 15, max: 18 },
    arcaneExposure: { mode: 'immune' },
    damageResistanceBySchool: { magic: 10 }, // PROVISIONAL raw HP resistance
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
    id: 'wyrmLord',
    size: 'large',
    tint: 'var(--gold)',
    name: 'Wyrm Lord',
    hp: [130, 140],
    poiseMax: 30,
    levelProfile: { min: 18, max: 19 },
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

  // ---- Final boss: The Blighted Valkyrie (GDD §2, SPEC §5.3/§10) ---------------------
  {
    id: 'blightedValkyrie',
    size: 'large',
    tint: 'var(--rot)',
    name: 'The Blighted Valkyrie',
    hp: [250, 250],
    poiseMax: 36,
    levelProfile: { min: 19, max: 20 },
    art: '🦋',
    firstMove: 'spiralThrust',
    moves: {
      spiralThrust: {
        intent: 'attack', damage: 12, weight: 35, maxConsecutive: 2,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 2 }],
      },
      whirlwind: {
        intent: 'attack', damage: 4, hits: 5, weight: 30, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'bleed', stacks: 2 }],
      },
      rotWings: {
        intent: 'block', block: 10, weight: 20, maxConsecutive: 1,
        effects: [{ op: 'applyStatus', target: 'player', status: 'crimsonBlight', stacks: 3 }],
      },
      scarletDance: { intent: 'attack', damage: 5, hits: 5, weight: 35, locked: true },
    },
    phases: [
      {
        // Signature inversion (SPEC §10): she heals 2 whenever SHE lands a hit.
        // A persistent (once:false) trigger on her own damageDealt events.
        on: 'damageDealt', once: false,
        if: { p: 'eventSourceIsOwner' },
        do: [{ op: 'heal', target: 'self', amount: 2 }],
      },
      {
        // ≤50% HP: the scarlet bloom. One-way door.
        on: 'hpBelowPct', pct: 50,
        do: [
          { op: 'applyStatus', target: 'self', status: 'strength', stacks: 3 },
          { op: 'applyStatus', target: 'player', status: 'crimsonBlight', stacks: 4 },
        ],
        unlockMoves: ['scarletDance'],
      },
    ],
  },
];
