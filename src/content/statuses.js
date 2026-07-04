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
    // Sanguine Pact power: Bleed bursts feed Strength — the Vagabond's answer to
    // Thorn Halo / Constellation. Same meterFilled + eventStatusIs shape.
    id: 'sanguinePact',
    name: 'Sanguine Pact',
    icon: '🩸',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'meterFilled',
        if: { p: 'eventStatusIs', status: 'bleed' },
        do: [
          {
            op: 'applyStatus',
            target: 'owner',
            status: 'strength',
            stacks: { f: 'mul', args: [2, { f: 'stacks', status: 'sanguinePact', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever Bleed bursts on an enemy, gain 2 Strength per stack.',
  },
  // ---- Astrologer: the Glintstone combo engine (SPEC §5.1 identity) ---------
  {
    // Set by every spell after its own effects resolve; spells check it FIRST,
    // so the 2nd+ spell each turn gets its "Glintstone:" bonus. Unique + turn-
    // end decay = a clean per-turn combo flag, zero engine involvement.
    id: 'glintstoneCharge',
    name: 'Glintstone Charge',
    icon: '✦',
    stackMode: 'unique',
    decay: 'perTurnEnd',
    tooltip: 'A spell was cast this turn: your next Glintstone bonus is live. Fades at end of turn.',
  },
  {
    id: 'stargazer',
    name: 'Stargazer',
    icon: '🔭',
    stackMode: 'unique',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [{ op: 'applyStatus', target: 'owner', status: 'glintstoneCharge', stacks: 1 }],
      },
    ],
    tooltip: 'At the start of your turn, gain Glintstone Charge.',
  },
  {
    id: 'astralArmor',
    name: 'Astral Armor',
    icon: '🌌',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnEnd',
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [4, { f: 'stacks', status: 'astralArmor', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'At the end of your turn, gain 4 Block per stack.',
  },
  {
    id: 'constellation',
    name: 'Constellation',
    icon: '💫',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'statusApplied',
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'glintstoneCharge' }, { p: 'eventTargetIsOwner' }] },
        do: [
          {
            op: 'damage',
            target: 'randomEnemy',
            amount: { f: 'mul', args: [4, { f: 'stacks', status: 'constellation', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you gain Glintstone Charge, deal 4 damage per stack to a random enemy.',
  },
  {
    // Cerulean Coil power: turns each Skill into a trickle of Block. Same
    // cardPlayed + cardTypeIs shape the Twinned Armor relic uses, as a power.
    id: 'ceruleanCoil',
    name: 'Cerulean Coil',
    icon: '🌀',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'cardPlayed',
        if: { p: 'cardTypeIs', type: 'skill' },
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [2, { f: 'stacks', status: 'ceruleanCoil', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you play a Skill, gain 2 Block per stack.',
  },
  {
    // Waxing Moon power: scaling Vulnerable spread — the Astrologer's answer to
    // Thorn Halo (Rot). Same ownerTurnStart + allEnemies shape.
    id: 'waxingMoon',
    name: 'Waxing Moon',
    icon: '🌕',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'applyStatus',
            target: 'allEnemies',
            status: 'vulnerable',
            stacks: { f: 'mul', args: [2, { f: 'stacks', status: 'waxingMoon', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn, apply 2 Vulnerable to ALL enemies per stack.',
  },

  {
    // Moonlit Shield power: every Glintstone Charge gained also hardens into
    // Block. Same statusApplied + eventStatusIs/eventTargetIsOwner shape as
    // Constellation, but pays out Block on the owner instead of damage.
    id: 'moonlitShield',
    name: 'Moonlit Shield',
    icon: '🔷',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'statusApplied',
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'glintstoneCharge' }, { p: 'eventTargetIsOwner' }] },
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [3, { f: 'stacks', status: 'moonlitShield', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you gain Glintstone Charge, gain 3 Block per stack.',
  },
  {
    // Astromancer power: opens every turn already combo-primed and card-fed —
    // the Astrologer's answer to Stargazer, with a draw riding along.
    id: 'astromancer',
    name: 'Astromancer',
    icon: '📚',
    stackMode: 'unique',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          { op: 'applyStatus', target: 'owner', status: 'glintstoneCharge', stacks: 1 },
          { op: 'draw', target: 'owner', amount: 1 },
        ],
      },
    ],
    tooltip: 'At the start of your turn, gain Glintstone Charge and draw a card.',
  },

  // ---- Prophet: blood economy powers (SPEC §5.1 identity) -------------------
  {
    id: 'thornHalo',
    name: 'Thorn Halo',
    icon: '🌿',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'applyStatus',
            target: 'allEnemies',
            status: 'scarletRot',
            stacks: { f: 'stacks', status: 'thornHalo', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn, apply 1 Scarlet Rot per stack to ALL enemies.',
  },
  {
    id: 'communion',
    name: 'Communion',
    icon: '🕊',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'mul', args: [3, { f: 'stacks', status: 'communion', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn, heal 3 HP per stack.',
  },
  {
    id: 'lifeTithe',
    name: 'Life Tithe',
    icon: '⚰',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'enemyDied',
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'mul', args: [8, { f: 'stacks', status: 'lifeTithe', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever an enemy dies, heal 8 HP per stack.',
  },
  {
    // Stigmata power: holy wounds that mend — every point of HP you spend heals
    // a little back (and, with Gold Figurine, becomes Block). Gated to the
    // owner's own HP loss; heal emits 'healed', not 'hpLost', so no loop.
    id: 'stigmata',
    name: 'Stigmata',
    icon: '🩹',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'hpLost',
        if: { p: 'eventTargetIsOwner' },
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'mul', args: [2, { f: 'stacks', status: 'stigmata', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you lose HP, heal 2 HP per stack.',
  },
  {
    // Zealotry power: pain answered with fury — each HP loss lashes a random
    // enemy. damage emits 'damageDealt' on the enemy (not the owner's 'hpLost'),
    // so it cannot re-trigger itself.
    id: 'zealotry',
    name: 'Zealotry',
    icon: '⚡',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'hpLost',
        if: { p: 'eventTargetIsOwner' },
        do: [
          {
            op: 'damage',
            target: 'randomEnemy',
            amount: { f: 'mul', args: [3, { f: 'stacks', status: 'zealotry', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you lose HP, deal 3 damage to a random enemy per stack.',
  },
  {
    // Grace Tide power: every heal (self-cast or Gold Figurine's Block-on-heal
    // notwithstanding) hardens into Strength. Same healed + eventTargetIsOwner
    // shape as Gold Figurine's relic trigger, but as a power that scales.
    id: 'graceTide',
    name: 'Grace Tide',
    icon: '🌊',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'healed',
        if: { p: 'eventTargetIsOwner' },
        do: [
          {
            op: 'applyStatus',
            target: 'owner',
            status: 'strength',
            stacks: { f: 'stacks', status: 'graceTide', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'Whenever you heal, gain 1 Strength per stack.',
  },
  {
    // Harbinger of Rot power: every Rot you spread mends you a little — gated
    // to the owner's own applications via eventSourceIsOwner (the target is
    // the enemy, not the owner, so eventTargetIsOwner would never fire here).
    id: 'harbingerOfRot',
    name: 'Harbinger of Rot',
    icon: '❀',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'statusApplied',
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'scarletRot' }, { p: 'eventSourceIsOwner' }] },
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'stacks', status: 'harbingerOfRot', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'Whenever you apply Scarlet Rot to an enemy, heal 1 HP per stack.',
  },
  {
    // Blood Grease flask: this turn, attacks apply +2 Bleed per hit
    // (same hook shape as Bloodflame Stance; expires at turn end).
    id: 'bloodGrease',
    name: 'Blood Grease',
    icon: '🫗',
    stackMode: 'refresh',
    decay: 'perTurnEnd',
    hooks: [
      {
        on: 'damageDealt',
        if: { p: 'all', preds: [{ p: 'eventSourceIsOwner' }, { p: 'eventIsAttack' }] },
        do: [{ op: 'applyStatus', status: 'bleed', stacks: 2 }],
      },
    ],
    tooltip: 'Your attacks apply 2 extra Bleed per hit this turn.',
  },
  {
    // Iron Vow power: pain hardens into guard — same hpLost + eventTargetIsOwner
    // shape as Stigmata/Zealotry, but pays out Block instead of a heal/lash.
    id: 'ironVow',
    name: 'Iron Vow',
    icon: '⛓',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'hpLost',
        if: { p: 'eventTargetIsOwner' },
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [3, { f: 'stacks', status: 'ironVow', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you lose HP, gain 3 Block per stack.',
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
  {
    // Custom Climb "Glass Cannon" modifier — applied to the player at combat
    // start (both directions at once). Pure data over existing modifier keys.
    id: 'glassCannon',
    name: 'Glass Cannon',
    icon: '💥',
    stackMode: 'unique',
    decay: 'none',
    modifiers: { damageDealtMult: 1.25, damageTakenMult: 1.25 },
    tooltip: 'Deal 25% more attack damage, and take 25% more.',
  },
];
