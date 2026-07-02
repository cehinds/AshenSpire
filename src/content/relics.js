// src/content/relics.js — the M2 relic set (SPEC §5.4)
//
// Combat behavior uses the trigger DSL (SPEC §3.6); run-system behavior
// (rewards, shops, shrines, map, costs) uses the closed passive-key set.
// One deliberate retune vs. the SPEC table: Bloodied Talisman deals a flat
// +5 on Bleed bursts instead of +25% (the burst amount isn't visible to a
// trigger; flat rider keeps it pure data — revisit in the M3 balance pass).

export const relics = [
  // ---- starter ---------------------------------------------------------------
  {
    id: 'tarnishedMedallion',
    name: 'Tarnished Medallion',
    rarity: 'starter',
    icon: '🏅',
    triggers: [
      {
        on: 'damageDealt',
        once: true,
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'poiseDamage', amount: 4 }],
      },
    ],
    textTemplate: 'Your first attack each combat also deals {poiseDamage} Poise damage.',
    flavor: 'Its face is worn smooth, but it still remembers being gold.',
  },

  {
    // SPEC §5.1 said "first Power each combat costs 1 less"; passives are
    // unconditional, so the shipped design leans into the class identity
    // instead: open every combat with the combo already primed.
    id: 'glintstoneShard',
    name: 'Glintstone Shard',
    rarity: 'starter',
    icon: '💠',
    triggers: [
      { on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'glintstoneCharge', stacks: { f: 'add', args: [1] } }] },
    ],
    textTemplate: 'Begin each combat with Glintstone Charge (your first spell counts as a combo).',
    flavor: 'A chip of someone else’s genius. It still hums.',
  },
  {
    // SPEC §5.1's overheal-to-block needs overflow math no trigger can see;
    // the shipped design keeps the fantasy: every heal armors you — including
    // "wasted" heals at full HP, which become pure Block.
    id: 'goldFigurine',
    name: 'Gold Figurine',
    rarity: 'starter',
    icon: '🗿',
    triggers: [
      {
        on: 'healed',
        if: { p: 'eventTargetIsOwner' },
        do: [{ op: 'block', target: 'owner', amount: 2 }],
      },
    ],
    textTemplate: 'Whenever you heal, gain {block} Block (even at full HP).',
    flavor: 'It is very small and very heavy and it loves you.',
  },

  // ---- commons ---------------------------------------------------------------
  {
    id: 'goldenSeed',
    name: 'Golden Seed',
    rarity: 'common',
    icon: '🌰',
    triggers: [{ on: 'combatStart', do: [{ op: 'heal', target: 'owner', amount: 3 }] }],
    textTemplate: 'At the start of each combat, heal {heal} HP.',
    flavor: 'A sapling waits inside, patient as grief.',
  },
  {
    id: 'whetstoneFragment',
    name: 'Whetstone Fragment',
    rarity: 'common',
    icon: '🪨',
    triggers: [
      {
        on: 'damageDealt',
        once: true,
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'damage', amount: 4 }],
      },
    ],
    textTemplate: 'Your first attack each combat deals {damage} extra damage.',
  },
  {
    id: 'kindlingCharm',
    name: 'Kindling Charm',
    rarity: 'common',
    icon: '🕯',
    triggers: [{ on: 'combatStart', do: [{ op: 'draw', amount: 1 }] }],
    textTemplate: 'At the start of each combat, draw {draw} extra card.',
  },
  {
    id: 'runePouch',
    name: 'Rune Pouch',
    rarity: 'common',
    icon: '👝',
    triggers: [],
    passives: { runeGainMult: 1.25 },
    textTemplate: 'Gain 25% more Runes from combats.',
  },
  {
    id: 'beastEye',
    name: 'Beast Eye',
    rarity: 'common',
    icon: '👁',
    triggers: [],
    passives: { eliteExtraCardReward: true },
    textTemplate: 'Elites offer an extra card reward choice.',
  },

  // ---- uncommons -------------------------------------------------------------
  {
    id: 'crackedTear',
    name: 'Cracked Tear',
    rarity: 'uncommon',
    icon: '💧',
    triggers: [],
    passives: { flaskPowerMult: 1.5 },
    textTemplate: 'Flasks are 50% stronger (rounded up).',
  },
  {
    id: 'stoneswordKey',
    name: 'Stonesword Key',
    rarity: 'uncommon',
    icon: '🗝',
    triggers: [],
    passives: { revealUnknown: true },
    textTemplate: 'Unknown (?) locations on the map are revealed.',
  },
  {
    id: 'fellOmenBrand',
    name: 'Fell Omen Brand',
    rarity: 'uncommon',
    icon: '🔱',
    triggers: [{ on: 'enemyStaggered', do: [{ op: 'draw', amount: 2 }] }],
    textTemplate: 'Whenever an enemy Staggers, draw {draw} cards.',
  },
  {
    id: 'bloodiedTalisman',
    name: 'Bloodied Talisman',
    rarity: 'uncommon',
    icon: '🩸',
    triggers: [
      {
        on: 'meterFilled',
        if: { p: 'eventStatusIs', status: 'bleed' },
        do: [{ op: 'loseHp', amount: 5 }],
      },
    ],
    textTemplate: 'Whenever Bleed bursts, the victim loses {loseHp} additional HP.',
  },
  {
    id: 'graceFragment',
    name: 'Grace Fragment',
    rarity: 'uncommon',
    icon: '✨',
    triggers: [],
    passives: { shrineHealMult: 1.15 },
    textTemplate: 'Resting at Shrines heals 15% more.',
  },
  {
    id: 'twinnedArmor',
    name: 'Twinned Armor',
    rarity: 'uncommon',
    icon: '👥',
    triggers: [
      {
        on: 'cardPlayed',
        if: { p: 'everyNthCardThisCombat', n: 10 },
        do: [{ op: 'block', target: 'owner', amount: 6 }],
      },
    ],
    textTemplate: 'Every 10th card you play each combat: gain {block} Block.',
  },

  // ---- rares -----------------------------------------------------------------
  {
    id: 'erdtreeSapling',
    name: 'Erdtree Sapling',
    rarity: 'rare',
    icon: '🌱',
    triggers: [
      {
        on: 'playerTurnStart',
        if: { p: 'not', pred: { p: 'hasBlock', of: 'owner' } },
        do: [{ op: 'block', target: 'owner', amount: 4 }],
      },
    ],
    textTemplate: 'At the start of your turn, if you have no Block: gain {block} Block.',
  },
  {
    id: 'dragonHeart',
    name: 'Dragon Heart',
    rarity: 'rare',
    icon: '🫀',
    triggers: [{ on: 'playerTurnStart', do: [{ op: 'gainEnergy', amount: 1 }] }],
    passives: { shrineNoRest: true },
    textTemplate: 'Gain {gainEnergy} extra Energy each turn. Shrines no longer offer Rest.',
    flavor: 'It still beats. It expects something of you.',
  },
  {
    id: 'ancestralHorn',
    name: 'Ancestral Horn',
    rarity: 'rare',
    icon: '📯',
    triggers: [],
    passives: { powerCostReduction: 1 },
    textTemplate: 'Power cards cost 1 less.',
  },

  // ---- boss (one per act boss — a Faustian trade each, GDD §5) ----------------
  {
    id: 'crownOfGrafting',
    name: 'Crown of Grafting',
    rarity: 'boss',
    icon: '👑',
    triggers: [
      { on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 2 }] },
      { on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'frail', stacks: 1 }] },
    ],
    textTemplate: 'Begin each combat with {strength} Strength — and {frail} Frail. New limbs are heavy.',
    flavor: 'It fits. That is the worst part.',
  },
  {
    id: 'omenHorn',
    name: 'Omen Horn',
    rarity: 'boss',
    icon: '📯',
    triggers: [
      { on: 'playerTurnStart', do: [{ op: 'draw', amount: 1 }] },
      { on: 'combatStart', do: [{ op: 'loseHp', target: 'owner', amount: 2 }] },
    ],
    textTemplate: 'Draw {draw} extra card each turn. At the start of each combat, lose {loseHp} HP.',
    flavor: 'It sounds without being blown. Something is answering.',
  },
  {
    id: 'ashOfRemembrance',
    name: 'Ash of Remembrance',
    rarity: 'boss',
    icon: '⚱',
    triggers: [
      { on: 'playerTurnStart', do: [{ op: 'gainEnergy', amount: 1 }] },
      { on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'madness', stacks: 1 }] },
    ],
    textTemplate: 'Gain {gainEnergy} extra Energy each turn. At the start of each combat, gain {madness} Madness.',
    flavor: 'The dead lend strength. They are not gentle about it.',
  },
];
