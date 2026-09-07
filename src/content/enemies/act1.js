// src/content/enemies/act1.js — Act 1 roster (SPEC §5.3, exact numbers)
//
// Creature tags (beast / humanoid / undead / construct / spirit) are NOT a field
// here any more. They are rows in content/source/tagging.csv, family `enemy`,
// against the one tag registry, and model/registries.js stamps them onto the
// def at boot — so `enemy.tags` still reads the same at runtime, and the proc
// resistance gate is unchanged. Retagging a creature is a spreadsheet row.

export const act1Enemies = [
  {
    id: 'wanderingSoldier',
    size: 'medium',
    name: 'Wandering Soldier',
    hp: [22, 26],
    poiseMax: 10,
    levelProfile: { min: 1, max: 4 },
    arcaneExposure: {
      mode: 'configured',
      threshold: 8, // PROVISIONAL
      buildupMultiplier: 1, // PROVISIONAL
      resetMode: 'zero',
      overflowPolicy: 'discard',
      lockPolicy: 'whileMagicVulnerable',
      onBreak: { status: 'magicVulnerable', value: 25, duration: 2 }, // PROVISIONAL
    },
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
    id: 'blightHound',
    size: 'small',
    tint: 'var(--rot)',
    name: 'Blight Hound',
    hp: [12, 15],
    poiseMax: 6,
    levelProfile: { min: 1, max: 3 },
    art: '🐕',
    // Drawn in profile looking LEFT, which is where an enemy looks: the player's
    // zone is to its left (assets.js SIDE_FACES), so this one is NOT mirrored
    // and ships as painted. Read off the sprite, not assumed.
    artFaces: 'left',
    moves: {
      bite: { intent: 'attack', damage: 6, weight: 60 },
      lunge: { intent: 'attack', damage: 3, hits: 2, weight: 40 },
    },
  },
  {
    id: 'huskBrute',
    size: 'medium',
    name: 'Husk Brute',
    hp: [30, 34],
    poiseMax: 16,
    levelProfile: { min: 2, max: 5 },
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
    size: 'small',
    tint: 'var(--grace)',
    name: 'Grave Wisp',
    hp: [10, 12],
    poiseMax: 4,
    levelProfile: { min: 1, max: 4 },
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
    id: 'wyrmAspirant',
    size: 'large',
    tint: 'var(--gold)',
    name: 'Wyrm Aspirant',
    hp: [68, 72],
    poiseMax: 24,
    levelProfile: { min: 4, max: 6 },
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

  // ---- Boss: The Fell Warden (SPEC §5.3 — the Fell Warden-inspired) -----------------
  {
    id: 'fellWarden',
    size: 'large',
    tint: 'var(--blood)',
    name: 'The Fell Warden',
    hp: [120, 120],
    poiseMax: 30,
    levelProfile: { min: 5, max: 7 },
    art: '👁',
    firstMove: 'caneStrike',
    moves: {
      caneStrike: { intent: 'attack', damage: 8, weight: 40, maxConsecutive: 2 },
      hammerToss: { intent: 'attack', damage: 5, hits: 2, weight: 30, maxConsecutive: 2 },
      heldBlade: {
        // Signature delayed attack: telegraphs 16, holds (gaining 8 Block),
        // lands the following turn regardless of newly rolled intents.
        // Staggering him cancels it (engine-generic delayed-move rule).
        intent: 'attack', damage: 14, weight: 30, maxConsecutive: 1,
        delay: { turns: 1, whileCharging: { block: 8 } },
      },
      twinDaggers: { intent: 'attack', damage: 3, hits: 4, weight: 35, locked: true },
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

  // Expanded destinations: authored weighted moves use the existing phase and delay engine.
  {
    "id": "lanternMoth",
    "name": "Lantern Moth",
    "size": "small",
    "hp": [
      14,
      17
    ],
    "poiseMax": 5,
    "levelProfile": {
      "min": 2,
      "max": 5
    },
    "art": "◆",
    "artFaces": "left",
    "moves": {
      "lanternDust": {
        "intent": "debuff",
        "weight": 35,
        "maxConsecutive": 1,
        "effects": [
          {
            "op": "applyStatus",
            "target": "player",
            "status": "weak",
            "stacks": 1
          }
        ]
      },
      "wingSparks": {
        "intent": "attack",
        "damage": 2,
        "weight": 65,
        "hits": 3
      }
    }
  },
  {
    "id": "briarHermit",
    "name": "Briar Hermit",
    "size": "medium",
    "hp": [
      24,
      28
    ],
    "poiseMax": 9,
    "levelProfile": {
      "min": 2,
      "max": 5
    },
    "art": "◆",
    "artFaces": "left",
    "moves": {
      "rootShelter": {
        "intent": "block",
        "block": 7,
        "weight": 30,
        "maxConsecutive": 1
      },
      "briarCast": {
        "intent": "attack",
        "damage": 5,
        "weight": 45,
        "effects": [
          {
            "op": "applyStatus",
            "target": "player",
            "status": "bleed",
            "stacks": 1
          }
        ]
      },
      "sapMend": {
        "intent": "buff",
        "weight": 25,
        "maxConsecutive": 1,
        "effects": [
          {
            "op": "heal",
            "target": "self",
            "amount": 4
          }
        ]
      }
    },
    "firstMove": "rootShelter"
  },
  {
    "id": "chainScavenger",
    "name": "Chain Scavenger",
    "size": "medium",
    "hp": [
      20,
      24
    ],
    "poiseMax": 8,
    "levelProfile": {
      "min": 2,
      "max": 5
    },
    "art": "◆",
    "artFaces": "left",
    "moves": {
      "hookCast": {
        "intent": "attack",
        "damage": 6,
        "weight": 60
      },
      "chainSnare": {
        "intent": "debuff",
        "weight": 20,
        "maxConsecutive": 1,
        "effects": [
          {
            "op": "applyStatus",
            "target": "player",
            "status": "frail",
            "stacks": 1
          }
        ]
      },
      "draggingBlow": {
        "intent": "attack",
        "damage": 12,
        "weight": 20,
        "maxConsecutive": 1,
        "delay": {
          "turns": 1,
          "whileCharging": {
            "block": 3
          }
        }
      }
    }
  },
  {
    "id": "bellKeeper",
    "name": "The Bell Keeper",
    "size": "large",
    "hp": [
      116,
      116
    ],
    "poiseMax": 25,
    "levelProfile": {
      "min": 5,
      "max": 7
    },
    "art": "◆",
    "artFaces": "left",
    "moves": {
      "bronzeToll": {
        "intent": "attack",
        "damage": 19,
        "weight": 35,
        "maxConsecutive": 1,
        "delay": {
          "turns": 1,
          "whileCharging": {
            "block": 6
          }
        }
      },
      "clapperSwing": {
        "intent": "attack",
        "damage": 9,
        "weight": 45,
        "maxConsecutive": 2
      },
      "muffledPrayer": {
        "intent": "block",
        "block": 9,
        "weight": 20,
        "maxConsecutive": 1
      },
      "crackedPeal": {
        "intent": "attack",
        "damage": 6,
        "weight": 25,
        "hits": 3,
        "locked": true,
        "maxConsecutive": 1
      }
    },
    "firstMove": "bronzeToll",
    "phases": [
      {
        "on": "hpBelowPct",
        "pct": 45,
        "do": [],
        "unlockMoves": [
          "crackedPeal"
        ]
      }
    ]
  },
  {
    "id": "thornMatriarch",
    "name": "The Thorn Matriarch",
    "size": "large",
    "hp": [
      110,
      110
    ],
    "poiseMax": 22,
    "levelProfile": {
      "min": 5,
      "max": 7
    },
    "art": "◆",
    "artFaces": "left",
    "moves": {
      "rootCrown": {
        "intent": "block",
        "block": 8,
        "weight": 25,
        "maxConsecutive": 1
      },
      "thornNeedles": {
        "intent": "attack",
        "damage": 4,
        "weight": 45,
        "hits": 3,
        "maxConsecutive": 2
      },
      "entwiningRoots": {
        "intent": "attack",
        "damage": 15,
        "weight": 30,
        "maxConsecutive": 1,
        "delay": {
          "turns": 1,
          "whileCharging": {
            "block": 4
          }
        },
        "effects": [
          {
            "op": "applyStatus",
            "target": "player",
            "status": "bleed",
            "stacks": 2
          }
        ]
      }
    },
    "firstMove": "rootCrown",
    "phases": [
      {
        "on": "hpBelowPct",
        "pct": 40,
        "do": [
          {
            "op": "heal",
            "target": "self",
            "amount": 12
          },
          {
            "op": "applyStatus",
            "target": "self",
            "status": "strength",
            "stacks": 2
          }
        ]
      }
    ]
  },
];
