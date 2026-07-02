// src/content/statuses.js — ALL combat statuses as data (SPEC §3.7, §4.4)
//
// The engine interprets these through the generic status model; nothing in
// src/engine names any of these ids. The Elden Ring layer (Bleed, Scarlet Rot,
// Stagger, Madness) lives here as data, exactly like the StS layer.

export const statuses = [
  // ---- StS layer (SPEC §4.4 table) ----------------------------------------
  {
    id: 'strength',
    name: 'Strength',
    icon: '↑',
    stackMode: 'add',
    decay: 'none',
    modifiers: { attackDamageAdd: 1 },
    tooltip: 'Attacks deal +1 damage per stack.',
  },
  {
    id: 'dexterity',
    name: 'Dexterity',
    icon: '◇',
    stackMode: 'add',
    decay: 'none',
    modifiers: { blockAdd: 1 },
    tooltip: 'Cards grant +1 Block per stack.',
  },
  {
    id: 'weak',
    name: 'Weak',
    icon: '↓',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { damageDealtMult: 0.75 },
    tooltip: 'Deals 25% less attack damage. 1 stack expires each turn.',
  },
  {
    id: 'vulnerable',
    name: 'Vulnerable',
    icon: 'V',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { damageTakenMult: 1.5 },
    tooltip: 'Takes 50% more attack damage. 1 stack expires each turn.',
  },
  {
    id: 'frail',
    name: 'Frail',
    icon: '✂',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { blockGainedMult: 0.75 },
    tooltip: 'Gains 25% less Block from cards. 1 stack expires each turn.',
  },

  // ---- Elden Ring layer (SPEC §4.4 — build-up, not spam) -------------------
  {
    id: 'bleed',
    name: 'Bleed',
    icon: '💧',
    stackMode: 'add',
    decay: 'none',
    meter: {
      max: 12,
      growthMult: 1.5,
      onFill: [
        {
          op: 'loseHp',
          target: 'self',
          amount: { f: 'percentMaxHp', of: 'owner', pct: 15, min: 8, max: 35 },
        },
      ],
    },
    tooltip:
      'Build-up: points do not decay. At the threshold, burst for 15% of max HP (min 8, max 35), ignoring Block. Each burst raises the threshold ×1.5.',
  },
  {
    id: 'scarletRot',
    name: 'Scarlet Rot',
    icon: '❀',
    stackMode: 'add',
    decay: { duration: 3 },
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'loseHp',
            target: 'owner',
            amount: { f: 'stacks', status: 'scarletRot', of: 'owner' },
          },
        ],
      },
    ],
    tooltip:
      'At the start of its turn, loses HP equal to Rot stacks (ignores Block). Stacks do not tick down; the Rot expires entirely after 3 turns. Re-applying adds stacks and refreshes the duration.',
  },
  {
    id: 'madness',
    name: 'Madness',
    icon: '☀',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'loseHp',
            target: 'owner',
            amount: { f: 'mul', args: [2, { f: 'stacks', status: 'madness', of: 'owner' }] },
          },
          { op: 'gainEnergy', amount: { f: 'stacks', status: 'madness', of: 'owner' } },
          { op: 'removeStatus', target: 'owner', status: 'madness' },
        ],
      },
    ],
    tooltip: 'At the start of your turn: lose 2 HP per stack, gain 1 Energy per stack, then Madness clears.',
  },
  {
    id: 'staggered',
    name: 'Staggered',
    icon: '✦',
    stackMode: 'refresh',
    decay: 'perTurnEnd',
    modifiers: { damageTakenMult: 1.5 },
    tooltip: 'Poise broken: skips its next turn and takes 50% more attack damage until the end of your next turn.',
  },

  // ---- Power-granted player statuses (cards apply these) -------------------
  {
    id: 'rallyingStandard',
    name: 'Rallying Standard',
    icon: '⚑',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'applyStatus',
            target: 'owner',
            status: 'strength',
            stacks: { f: 'stacks', status: 'rallyingStandard', of: 'owner' },
          },
          {
            op: 'loseHp',
            target: 'owner',
            amount: { f: 'stacks', status: 'rallyingStandard', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn: gain 1 Strength and take 1 damage (per stack).',
  },
  {
    id: 'rallyingStandardUp',
    name: 'Rallying Standard+',
    icon: '⚑',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'applyStatus',
            target: 'owner',
            status: 'strength',
            stacks: { f: 'stacks', status: 'rallyingStandardUp', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn: gain 1 Strength (per stack).',
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    icon: '⬟',
    stackMode: 'unique',
    decay: 'none',
    modifiers: { retainBlock: true, blockCap: 30 },
    tooltip: 'Block no longer expires at the start of your turn. Block is capped at 30.',
  },
  {
    id: 'unbreakableUp',
    name: 'Unbreakable+',
    icon: '⬟',
    stackMode: 'unique',
    decay: 'none',
    modifiers: { retainBlock: true, blockCap: 40 },
    tooltip: 'Block no longer expires at the start of your turn. Block is capped at 40.',
  },
  {
    id: 'lordsBlood',
    name: "Lord's Blood",
    icon: '♛',
    stackMode: 'unique',
    decay: 'none',
    modifiers: { meterMaxGrowthDisabled: true },
    tooltip: 'Build-up thresholds (Bleed and Poise) no longer increase after filling.',
  },
  {
    id: 'bulwarkEcho',
    name: 'Shieldwall Echo',
    icon: '⛨',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [4, { f: 'stacks', status: 'bulwarkEcho', of: 'owner' }] },
          },
          { op: 'removeStatus', target: 'owner', status: 'bulwarkEcho' },
        ],
      },
    ],
    tooltip: 'At the start of your next turn: gain 4 Block per stack.',
  },
];
