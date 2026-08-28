// src/content/statuses.js — ALL combat statuses as data (SPEC §3.7, §4.4)
//
// The engine interprets these through the generic status model; nothing in
// src/engine names any of these ids. The Elden Ring layer (Bleed, Crimson Blight,
// Stagger, Madness) lives here as data, exactly like the StS layer.

export const statuses = [
  // ---- StS layer (SPEC §4.4 table) ----------------------------------------
  {
    id: 'strength',
    tint: 'var(--gold)',
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
    tint: 'var(--muted)',
    name: 'Weak',
    icon: '↓',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { damageDealtMult: 0.75 },
    tooltip: 'Deals 25% less attack damage. 1 stack expires each turn.',
  },
  {
    id: 'vulnerable',
    tint: 'var(--grace)',
    name: 'Vulnerable',
    icon: 'V',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { damageTakenMult: 1.5 },
    tooltip: 'Takes 50% more attack damage. 1 stack expires each turn.',
  },
  {
    id: 'frail',
    tint: 'var(--muted)',
    name: 'Frail',
    icon: '✂',
    stackMode: 'add',
    decay: 'perTurnEnd',
    modifiers: { blockGainedMult: 0.75 },
    tooltip: 'Gains 25% less Block from cards. 1 stack expires each turn.',
  },

  // ---- Elden Ring layer: threshold-proc rows (SPEC §4.4, #61 direction) ----
  // Constantine's words, 2026-08-06: build-up to a threshold → percent-based
  // damage as ITS OWN PROC → the build-up resets to zero → tag-gated
  // resistance for a period. EVERY number below is PROVISIONAL — a first pick
  // made against the sim (falsifier: --policy=reaverkit n=1000), marked so
  // his hands can reach it. Readings stated where a word allowed more than
  // one: burstPercent is percent of the PROC TARGET'S max HP (the reading the
  // old meter already shipped); poiseDamage is a fixed amount PER PROC (the
  // per-application alternative is a knob away if his intent differs).
  //
  // DELTA vs the shipped meter, stated: the old bleed carried overflow and
  // escalated its threshold ×1.5 per burst; the proc vocabulary resets the
  // build-up to zero (overflow dropped) at a CONSTANT threshold — "then the
  // threshold resets to zero", his words.
  {
    id: 'bleed',
    tint: 'var(--ember)',
    name: 'Bleed',
    icon: '💧',
    stackMode: 'add',
    decay: 'none',
    proc: {
      threshold: 7, // PROVISIONAL — Rune's sim pick at Constantine's word ("let rune pick the threshold against the sim"): smallest value whose reaverkit n=1000 CI fully clears the [1.4, 3.2] datum band; sweep table in tools/results/sweep-bleed-threshold.md. Was 12 (carried from the shipped meter) — his hands stay free.
      burstPercent: 15, // PROVISIONAL — % of target max HP (carried)
      burstMin: 8, // PROVISIONAL (carried)
      burstMax: 35, // PROVISIONAL (carried)
      poiseDamage: 3, // PROVISIONAL — fixed poise damage per proc (new, his direction)
      resistance: {
        status: 'bleedResist',
        tags: ['beast', 'humanoid'], // PROVISIONAL — flesh clots; undead/construct/spirit don't
      },
    },
    tooltip:
      'Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, plus {proc.poiseDamage} Poise damage — then the build-up resets to zero. Fleshy targets briefly resist further Bleed after a burst.',
  },
  {
    id: 'frost',
    tint: '#7fa8c9', // the frost swatch already in balance.palette
    name: 'Frost',
    icon: '❄',
    stackMode: 'add',
    decay: 'none',
    proc: {
      threshold: 10, // PROVISIONAL
      burstPercent: 8, // PROVISIONAL — smaller than bleed, his direction
      burstMin: 4, // PROVISIONAL
      burstMax: 20, // PROVISIONAL
      effects: [
        // His direction: damage debuff + vulnerability/weakness to tagged
        // (non-physical) attacks. Weak is the shipped damage debuff; the
        // exposure row carries the tag-scoped vulnerability.
        { op: 'applyStatus', target: 'self', status: 'weak', stacks: 1 },
        { op: 'applyStatus', target: 'self', status: 'frostExposed', stacks: 1 },
      ],
      resistance: {
        status: 'frostResist',
        tags: ['beast', 'humanoid'], // PROVISIONAL — warm-blooded shake it off
      },
    },
    tooltip:
      'Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, and the target is left Weak and Frost-Exposed — then the build-up resets to zero.',
  },
  {
    // 'insanity' is NOT 'madness' (below): madness is a player economy
    // drawback (relic cost — lose HP, gain Energy, clears); insanity is an
    // enemy-affliction threshold proc. Two words, two mechanics, on purpose —
    // binding them would break the madness relics. Flagged for the collapse
    // check at review.
    id: 'insanity',
    // Deliberately NOT var(--gold): the poise bar is gold, and an insanity
    // meter sitting beside it read as a second poise bar (Sunna's PX flag).
    tint: '#a06bd0',
    name: 'Insanity',
    icon: '🌀',
    stackMode: 'add',
    decay: 'none',
    proc: {
      threshold: 14, // PROVISIONAL — hardest to fill of the three
      burstPercent: 18, // PROVISIONAL — highest percent, his direction
      burstMin: 10, // PROVISIONAL
      burstMax: 40, // PROVISIONAL
      poiseDamage: 8, // PROVISIONAL — highest poise damage, his direction
      stagger: true, // direct stagger on proc — guaranteed, bypasses the bar
      effects: [
        { op: 'applyStatus', target: 'self', status: 'insanityExposed', stacks: 1 },
      ],
      resistance: {
        status: 'insanityResist',
        tags: ['humanoid', 'spirit'], // PROVISIONAL — minds harden; beasts/constructs have none to break
      },
    },
    tooltip:
      'Build-up: points do not decay. At {proc.threshold}, burst for {proc.burstPercent}% of max HP (min {proc.burstMin}, max {proc.burstMax}), ignoring Block, with {proc.poiseDamage} Poise damage and a guaranteed Stagger — then the build-up resets to zero.',
  },

  // ---- Proc resistance rows (#61): strength here, duration in decay --------
  {
    id: 'bleedResist',
    tint: 'var(--muted)',
    name: 'Clotted',
    icon: '🩹',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL — turns of resistance
    resists: { status: 'bleed', percent: 50 }, // PROVISIONAL — blocks half of incoming points
    tooltip: 'Just burst — hardened against Bleed: incoming build-up reduced {resists.percent}% for {decay.duration} turns.',
  },
  {
    id: 'frostResist',
    tint: 'var(--muted)',
    name: 'Weathered',
    icon: '🧣',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL
    resists: { status: 'frost', percent: 50 }, // PROVISIONAL
    tooltip: 'Just burst — hardened against Frost: incoming build-up reduced {resists.percent}% for {decay.duration} turns.',
  },
  {
    id: 'insanityResist',
    tint: 'var(--muted)',
    name: 'Resolute',
    icon: '🛡',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL
    resists: { status: 'insanity', percent: 50 }, // PROVISIONAL
    tooltip: 'Just burst — hardened against Insanity: incoming build-up reduced {resists.percent}% for {decay.duration} turns.',
  },

  // ---- Exposure rows (#61): tag-scoped vulnerability the procs leave -------
  {
    id: 'frostExposed',
    tint: '#7fa8c9',
    name: 'Frost-Exposed',
    icon: '🫧',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL
    taggedVulnerability: {
      tags: ['starstone'], // PROVISIONAL — the frost-adjacent magic school
      mult: 1.25, // PROVISIONAL
      stacking: 'multiplicative', // declared, validated — composes like every shipped *Mult
    },
    tooltip: 'Takes {tv.pct}% more damage from starstone attacks. Stacks with Vulnerable. {decay.duration} turns.',
  },
  {
    id: 'insanityExposed',
    tint: '#a06bd0', // matches its parent proc row, and stays off the poise gold
    name: 'Unraveled',
    icon: '🕳',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL
    taggedVulnerability: {
      tags: ['ritual', 'blight'], // PROVISIONAL — the mind-adjacent schools
      mult: 1.3, // PROVISIONAL
      stacking: 'multiplicative',
    },
    tooltip: 'Takes {tv.pct}% more damage from ritual and blight attacks. Stacks with Vulnerable. {decay.duration} turns.',
  },
  {
    id: 'crimsonBlight',
    tint: 'var(--rot)',
    name: 'Crimson Blight',
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
            amount: { f: 'stacks', status: 'crimsonBlight', of: 'owner' },
          },
        ],
      },
    ],
    tooltip:
      'At the start of its turn, loses HP equal to Blight stacks (ignores Block). Stacks do not tick down; the Blight expires entirely after 3 turns. Re-applying adds stacks and refreshes the duration.',
  },
  // Burn and Regen exist for equipment to point at: a torch has to be able to
  // set something alight, and a warm habit has to be able to give a little
  // back. Both are ordinary content statuses — nothing in the engine knows
  // they are the ones armaments reach for (content/source/equipMods.csv does).
  {
    id: 'burn',
    tint: 'var(--ember)',
    name: 'Burn',
    icon: '🔥',
    stackMode: 'add',
    decay: 'perTurnEnd',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'loseHp',
            target: 'owner',
            amount: { f: 'stacks', status: 'burn', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of its turn, loses HP equal to Burn stacks (ignores Block). One stack burns out each turn.',
  },
  {
    id: 'regen',
    tint: 'var(--grace)',
    name: 'Regen',
    icon: '🌿',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'stacks', status: 'regen', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of its turn, heals HP equal to Regen stacks. Lasts the whole fight.',
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
    tint: 'var(--gold)',
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
    id: 'goreblood',
    name: "Goreblood",
    icon: '♛',
    stackMode: 'unique',
    decay: 'none',
    modifiers: { meterMaxGrowthDisabled: true },
    // #61: bleed thresholds are now CONSTANT by design, so this freeze binds
    // only Poise — prose updated to match; the modifier is untouched.
    tooltip: 'Poise thresholds no longer increase after filling.',
  },
  {
    // Sanguine Pact power: Bleed bursts feed Strength — the Reaver's answer to
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
  // ---- Starseer: the Starstone combo engine (SPEC §5.1 identity) ---------
  {
    // Set by every spell after its own effects resolve; spells check it FIRST,
    // so the 2nd+ spell each turn gets its "Starstone:" bonus. Unique + turn-
    // end decay = a clean per-turn combo flag, zero engine involvement.
    id: 'starstoneCharge',
    name: 'Starstone Charge',
    icon: '✦',
    stackMode: 'unique',
    decay: 'perTurnEnd',
    tooltip: 'A spell was cast this turn: your next Starstone bonus is live. Fades at end of turn.',
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
        do: [{ op: 'applyStatus', target: 'owner', status: 'starstoneCharge', stacks: 1 }],
      },
    ],
    tooltip: 'At the start of your turn, gain Starstone Charge.',
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
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'starstoneCharge' }, { p: 'eventTargetIsOwner' }] },
        do: [
          {
            op: 'damage',
            target: 'randomEnemy',
            amount: { f: 'mul', args: [4, { f: 'stacks', status: 'constellation', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you gain Starstone Charge, deal 4 damage per stack to a random enemy.',
  },
  {
    // Azure Coil power: turns each Skill into a trickle of Block. Same
    // cardPlayed + cardTypeIs shape the Twinned Armor relic uses, as a power.
    id: 'azureCoil',
    name: 'Azure Coil',
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
            amount: { f: 'mul', args: [2, { f: 'stacks', status: 'azureCoil', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you play a Skill, gain 2 Block per stack.',
  },
  {
    // Waxing Moon power: scaling Vulnerable spread — the Starseer's answer to
    // Thorn Halo (Blight). Same ownerTurnStart + allEnemies shape.
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
    // Moonlit Shield power: every Starstone Charge gained also hardens into
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
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'starstoneCharge' }, { p: 'eventTargetIsOwner' }] },
        do: [
          {
            op: 'block',
            target: 'owner',
            amount: { f: 'mul', args: [3, { f: 'stacks', status: 'moonlitShield', of: 'owner' }] },
          },
        ],
      },
    ],
    tooltip: 'Whenever you gain Starstone Charge, gain 3 Block per stack.',
  },
  {
    // Astromancer power: opens every turn already combo-primed and card-fed —
    // the Starseer's answer to Stargazer, with a draw riding along.
    id: 'astromancer',
    name: 'Astromancer',
    icon: '📚',
    stackMode: 'unique',
    decay: 'none',
    hooks: [
      {
        on: 'ownerTurnStart',
        do: [
          { op: 'applyStatus', target: 'owner', status: 'starstoneCharge', stacks: 1 },
          { op: 'draw', target: 'owner', amount: 1 },
        ],
      },
    ],
    tooltip: 'At the start of your turn, gain Starstone Charge and draw a card.',
  },

  // ---- Herald: blood economy powers (SPEC §5.1 identity) -------------------
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
            status: 'crimsonBlight',
            stacks: { f: 'stacks', status: 'thornHalo', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'At the start of your turn, apply 1 Crimson Blight per stack to ALL enemies.',
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
    // Ember Tide power: every heal (self-cast or Gold Figurine's Block-on-heal
    // notwithstanding) hardens into Strength. Same healed + eventTargetIsOwner
    // shape as Gold Figurine's relic trigger, but as a power that scales.
    id: 'emberTide',
    name: 'Ember Tide',
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
            stacks: { f: 'stacks', status: 'emberTide', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'Whenever you heal, gain 1 Strength per stack.',
  },
  {
    // Harbinger of Blight power: every Blight you spread mends you a little — gated
    // to the owner's own applications via eventSourceIsOwner (the target is
    // the enemy, not the owner, so eventTargetIsOwner would never fire here).
    id: 'harbingerOfBlight',
    name: 'Harbinger of Blight',
    icon: '❀',
    stackMode: 'add',
    decay: 'none',
    hooks: [
      {
        on: 'statusApplied',
        if: { p: 'all', preds: [{ p: 'eventStatusIs', status: 'crimsonBlight' }, { p: 'eventSourceIsOwner' }] },
        do: [
          {
            op: 'heal',
            target: 'owner',
            amount: { f: 'stacks', status: 'harbingerOfBlight', of: 'owner' },
          },
        ],
      },
    ],
    tooltip: 'Whenever you apply Crimson Blight to an enemy, heal 1 HP per stack.',
  },
  {
    // Blood Unction flask: this turn, attacks apply +2 Bleed per hit
    // (same hook shape as Gorefire Stance; expires at turn end).
    id: 'bloodUnction',
    name: 'Blood Unction',
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
  {
    // Registered break payload for Arcane Exposure. The engine applies this
    // only to explicit magic-school HP packets, never tags or buildup.
    id: 'magicVulnerable',
    name: 'Magic Vulnerable',
    icon: '✧',
    tint: '#8b7cd6',
    stackMode: 'refresh',
    decay: { duration: 2 }, // PROVISIONAL
    instancePresentation: { valueToken: 'percent', durationToken: 'turns' },
    schoolDamageVulnerability: { school: 'magic' },
    tooltip: 'Magic-school HP damage is increased while this lasts. Arcane Exposure buildup is locked.',
  },
];
