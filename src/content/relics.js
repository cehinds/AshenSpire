// src/content/relics.js — the relic pool (SPEC §5.4 base set + M3 growth to 40)
//
// Combat behavior uses the trigger DSL (SPEC §3.6); run-system behavior
// (rewards, shops, shrines, map, costs) uses the closed passive-key set.
// One deliberate retune vs. the SPEC table: Bloodied Talisman deals a flat
// +5 on Bleed bursts instead of +25% (the burst amount isn't visible to a
// trigger; flat rider keeps it pure data — revisit in the M3 balance pass).
//
// M3 content pass: 20 → 40. New relics reuse only shipped statuses/opcodes and
// proven trigger shapes. One design note worth keeping: relics that GRANT BLOCK
// on turn 1 fire on `playerTurnStart` (once), never `combatStart` — combat-start
// block is wiped by the turn-1 block-expiry (SPEC §4.1). See Erdleaf Charm.

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
  {
    id: 'erdleafCharm',
    name: 'Erdleaf Charm',
    rarity: 'common',
    icon: '🍂',
    // playerTurnStart (once), NOT combatStart: block gained at combat start is
    // wiped by the turn-1 block-expiry (SPEC §4.1). Fire after expiry so it lasts.
    triggers: [{ on: 'playerTurnStart', once: true, do: [{ op: 'block', target: 'owner', amount: 4 }] }],
    textTemplate: 'At the start of your first turn, gain {block} Block.',
    flavor: 'A single leaf, pressed flat, still gold. It keeps the wind off you.',
  },
  {
    id: 'crackedLantern',
    name: 'Cracked Lantern',
    rarity: 'common',
    icon: '🏮',
    triggers: [{ on: 'playerTurnStart', once: true, do: [{ op: 'gainEnergy', amount: 1 }] }],
    textTemplate: 'On your first turn each combat, gain {gainEnergy} Energy.',
    flavor: 'The glass is broken but the flame refuses to notice.',
  },
  {
    id: 'sacrificialKnife',
    name: 'Sacrificial Knife',
    rarity: 'common',
    icon: '🔪',
    triggers: [
      {
        on: 'damageDealt',
        once: true,
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'applyStatus', status: 'bleed', stacks: 2 }],
      },
    ],
    textTemplate: 'Your first attack each combat applies {bleed} Bleed.',
    flavor: 'It was made to open things that were meant to stay closed.',
  },
  {
    id: 'curedHide',
    name: 'Cured Hide',
    rarity: 'common',
    icon: '🛡',
    triggers: [
      {
        on: 'hpLost',
        once: true,
        if: { p: 'eventTargetIsOwner' },
        do: [{ op: 'block', target: 'owner', amount: 5 }],
      },
    ],
    textTemplate: 'The first time you lose HP each combat, gain {block} Block.',
    flavor: 'The beast learned its lesson too late to keep it.',
  },
  {
    id: 'ivoryComb',
    name: 'Ivory Comb',
    rarity: 'common',
    icon: '🪮',
    triggers: [
      {
        on: 'cardPlayed',
        if: { p: 'everyNthCardThisCombat', n: 8 },
        do: [{ op: 'draw', amount: 1 }],
      },
    ],
    textTemplate: 'Every 8th card you play each combat: draw {draw} card.',
    flavor: 'Someone kept themselves tidy right up until the end.',
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
  {
    id: 'rotTouchedIdol',
    name: 'Rot-Touched Idol',
    rarity: 'uncommon',
    icon: '☣',
    triggers: [
      {
        on: 'damageDealt',
        once: true,
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'applyStatus', status: 'scarletRot', stacks: 3 }],
      },
    ],
    textTemplate: 'Your first attack each combat applies {scarletRot} Scarlet Rot.',
    flavor: 'The carving was of a saint. The rot made it a saint of something else.',
  },
  {
    id: 'warhorn',
    name: 'Warhorn',
    rarity: 'uncommon',
    icon: '📣',
    triggers: [{ on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }],
    textTemplate: 'At the start of each combat, gain {strength} Strength.',
    flavor: 'One long note, and the old anger answers.',
  },
  {
    id: 'vowOfVengeance',
    name: 'Vow of Vengeance',
    rarity: 'uncommon',
    icon: '⚔',
    triggers: [{ on: 'enemyDied', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 2 }] }],
    textTemplate: 'Whenever an enemy dies, gain {strength} Strength.',
    flavor: 'Every name you take is a name you carry.',
  },
  {
    id: 'pearlOfSagacity',
    name: 'Pearl of Sagacity',
    rarity: 'uncommon',
    icon: '🔮',
    triggers: [
      {
        on: 'cardPlayed',
        if: { p: 'everyNthCardThisCombat', n: 6 },
        do: [{ op: 'gainEnergy', amount: 1 }],
      },
    ],
    textTemplate: 'Every 6th card you play each combat: gain {gainEnergy} Energy.',
    flavor: 'It clouds when you are foolish. It has been cloudy for some time.',
  },
  {
    id: 'blessedDew',
    name: 'Blessed Dew',
    rarity: 'uncommon',
    icon: '💧',
    triggers: [{ on: 'playerTurnStart', do: [{ op: 'heal', target: 'owner', amount: 2 }] }],
    textTemplate: 'At the start of each turn, heal {heal} HP.',
    flavor: 'It gathers on the vial overnight, from nowhere, for no one.',
  },
  {
    id: 'ceruleanSigil',
    name: 'Cerulean Sigil',
    rarity: 'uncommon',
    icon: '🔵',
    triggers: [
      {
        on: 'cardPlayed',
        once: true,
        if: { p: 'cardTypeIs', type: 'skill' },
        do: [{ op: 'gainEnergy', amount: 1 }],
      },
    ],
    textTemplate: 'The first Skill you play each combat: gain {gainEnergy} Energy.',
    flavor: 'Painted in a hand that trembled, by someone who steadied at the last stroke.',
  },
  {
    id: 'bloodstainedChalice',
    name: 'Bloodstained Chalice',
    rarity: 'uncommon',
    icon: '🍷',
    triggers: [
      {
        on: 'meterFilled',
        if: { p: 'eventStatusIs', status: 'bleed' },
        do: [{ op: 'block', target: 'owner', amount: 2 }],
      },
    ],
    textTemplate: 'Whenever Bleed bursts on an enemy, gain {block} Block.',
    flavor: 'It fills a little more each time. You have stopped asking with what.',
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
  {
    id: 'titansRune',
    name: "Titan's Rune",
    rarity: 'rare',
    icon: '🌟',
    triggers: [{ on: 'playerTurnStart', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }],
    textTemplate: 'At the start of each turn, gain {strength} Strength.',
    flavor: 'A giant died to make this. It is still furious about it.',
  },
  {
    id: 'radiantAegis',
    name: 'Radiant Aegis',
    rarity: 'rare',
    icon: '🛡',
    triggers: [
      {
        on: 'playerTurnStart',
        if: { p: 'hasBlock', of: 'owner' },
        do: [{ op: 'block', target: 'owner', amount: 4 }],
      },
    ],
    textTemplate: 'At the start of each turn, if you have Block: gain {block} Block.',
    flavor: 'It rewards the guarded. It has nothing to say to the reckless.',
  },
  {
    id: 'flayersCenser',
    name: "Flayer's Censer",
    rarity: 'rare',
    icon: '🔥',
    triggers: [
      { on: 'playerTurnStart', do: [{ op: 'applyStatus', target: 'allEnemies', status: 'scarletRot', stacks: 1 }] },
    ],
    textTemplate: 'At the start of each turn, apply {scarletRot} Scarlet Rot to ALL enemies.',
    flavor: 'The smoke seeks out lungs. It is not particular about whose.',
  },
  {
    id: 'vigilantHalo',
    name: 'Vigilant Halo',
    rarity: 'rare',
    icon: '🌸',
    triggers: [{ on: 'enemyStaggered', do: [{ op: 'heal', target: 'owner', amount: 6 }] }],
    textTemplate: 'Whenever an enemy Staggers, heal {heal} HP.',
    flavor: 'It hovers a hand above your head, waiting for you to earn it.',
  },
  {
    id: 'carrionTalon',
    name: 'Carrion Talon',
    rarity: 'rare',
    icon: '🦅',
    triggers: [{ on: 'enemyDied', do: [{ op: 'damage', target: 'randomEnemy', amount: 6 }] }],
    textTemplate: 'Whenever an enemy dies, deal {damage} damage to a random enemy.',
    flavor: 'The flock does not mourn. The flock moves to the next warm thing.',
  },
  {
    id: 'emberIdol',
    name: 'Ember Idol',
    rarity: 'rare',
    icon: '🌋',
    triggers: [{ on: 'playerTurnStart', do: [{ op: 'damage', target: 'allEnemies', amount: 3 }] }],
    textTemplate: 'At the start of each turn, deal {damage} damage to ALL enemies.',
    flavor: 'It has been warm to the touch for a thousand years. It is patient about it.',
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
  {
    id: 'runeOfTheFallen',
    name: 'Rune of the Fallen',
    rarity: 'boss',
    icon: '☠',
    triggers: [
      { on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'madness', stacks: 1 }] },
      { on: 'enemyDied', do: [{ op: 'gainEnergy', amount: 1 }] },
    ],
    textTemplate: 'Whenever an enemy dies, gain {gainEnergy} Energy. At the start of each combat, gain {madness} Madness.',
    flavor: 'It pays out in the coin of endings. It expects you to make more of them.',
  },
  {
    id: 'crimsonCovenant',
    name: 'Crimson Covenant',
    rarity: 'boss',
    icon: '🩸',
    triggers: [
      { on: 'combatStart', do: [{ op: 'loseHp', target: 'owner', amount: 5 }] },
      {
        on: 'damageDealt',
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'applyStatus', status: 'bleed', stacks: 2 }],
      },
    ],
    textTemplate: 'Your attacks apply {bleed} Bleed. At the start of each combat, lose {loseHp} HP.',
    flavor: 'The pact is simple: your blood answers for theirs. It is not a fair trade, but it is fast.',
  },

  // ---- Content-pass additions (round 2: 40 -> 48) ------------------------------
  {
    id: 'travelersWhetstone',
    name: "Traveler's Whetstone",
    rarity: 'common',
    icon: '🔪',
    triggers: [{ on: 'combatStart', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }],
    textTemplate: 'At the start of each combat, gain {strength} Strength.',
    flavor: 'It was sharpened by hands that are no longer here to use it.',
  },
  {
    id: 'moonlitVial',
    name: 'Moonlit Vial',
    rarity: 'common',
    icon: '🧪',
    triggers: [{ on: 'combatStart', do: [{ op: 'block', target: 'owner', amount: 3 }] }],
    textTemplate: 'At the start of each combat, gain {block} Block.',
    flavor: 'It never empties. It never fills, either.',
  },
  {
    id: 'wardensLantern',
    name: "Warden's Lantern",
    rarity: 'common',
    icon: '🏮',
    triggers: [
      {
        on: 'hpLost',
        once: true,
        if: { p: 'eventTargetIsOwner' },
        do: [{ op: 'draw', amount: 1 }],
      },
    ],
    textTemplate: 'The first time you lose HP each combat, draw {draw} card.',
    flavor: 'The flame gutters when you are hurt, then burns a little brighter.',
  },
  {
    id: 'saltedRelic',
    name: 'Salted Relic',
    rarity: 'uncommon',
    icon: '🧂',
    triggers: [],
    passives: { runeGainMult: 1.2 },
    textTemplate: 'Gain 20% more Runes from combats.',
    flavor: 'It was buried to keep something in, or something out. No one remembers which.',
  },
  {
    id: 'hollowedHorn',
    name: 'Hollowed Horn',
    rarity: 'uncommon',
    icon: '📯',
    triggers: [{ on: 'enemyStaggered', do: [{ op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 }] }],
    textTemplate: 'Whenever an enemy Staggers, apply {vulnerable} Vulnerable to ALL enemies.',
    flavor: 'It sounds only once. Everything still standing flinches.',
  },
  {
    id: 'gildedTear',
    name: 'Gilded Tear',
    rarity: 'uncommon',
    icon: '💛',
    triggers: [{ on: 'playerTurnStart', once: true, do: [{ op: 'heal', target: 'owner', amount: 3 }] }],
    textTemplate: 'On your first turn each combat, heal {heal} HP.',
    flavor: 'A single drop, hardened gold, wept for someone who never asked for it.',
  },
  {
    id: 'watchmansBadge',
    name: "Watchman's Badge",
    rarity: 'rare',
    icon: '🎖',
    triggers: [
      {
        on: 'playerTurnStart',
        if: { p: 'not', pred: { p: 'hasStatus', of: 'owner', status: 'weak' } },
        do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }],
      },
    ],
    textTemplate: 'At the start of each turn, if you are not Weak: gain {strength} Strength.',
    flavor: 'It is pinned to a coat that has seen more watches than the man wearing it.',
  },
  {
    id: 'howlingStandard',
    name: 'Howling Standard',
    rarity: 'rare',
    icon: '🚩',
    triggers: [{ on: 'enemyStaggered', do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }] }],
    textTemplate: 'Whenever an enemy Staggers, gain {strength} Strength.',
    flavor: 'It has not fallen in a hundred routs. It does not intend to start with yours.',
  },

  // ---- Content-pass additions (round 3: 48 -> 54) ------------------------------
  {
    id: 'emberwickCharm',
    name: 'Emberwick Charm',
    rarity: 'common',
    icon: '🕯',
    triggers: [
      {
        on: 'hpLost',
        once: true,
        if: { p: 'eventTargetIsOwner' },
        do: [{ op: 'gainEnergy', amount: 1 }],
      },
    ],
    textTemplate: 'The first time you lose HP each combat, gain {gainEnergy} Energy.',
    flavor: 'It burns brightest at the moment you can least afford to slow down.',
  },
  {
    id: 'carrionMorsel',
    name: 'Carrion Morsel',
    rarity: 'common',
    icon: '🍖',
    triggers: [{ on: 'enemyDied', do: [{ op: 'heal', target: 'owner', amount: 2 }] }],
    textTemplate: 'Whenever an enemy dies, heal {heal} HP.',
    flavor: 'The spire feeds those who feed it. It is not fussy about the manners of the exchange.',
  },
  {
    id: 'gravetendersBell',
    name: "Gravetender's Bell",
    rarity: 'uncommon',
    icon: '🔔',
    triggers: [{ on: 'enemyDied', do: [{ op: 'draw', amount: 1 }] }],
    textTemplate: 'Whenever an enemy dies, draw {draw} card.',
    flavor: 'One toll for each name laid down. The tending is in the counting.',
  },
  {
    id: 'sentinelsOath',
    name: "Sentinel's Oath",
    rarity: 'uncommon',
    icon: '🛡',
    triggers: [
      {
        on: 'cardPlayed',
        if: { p: 'everyNthCardThisCombat', n: 12 },
        do: [{ op: 'applyStatus', target: 'owner', status: 'strength', stacks: 1 }],
      },
    ],
    textTemplate: 'Every 12th card you play each combat: gain {strength} Strength.',
    flavor: 'The oath is long and the watch is longer. Endurance is its own kind of edge.',
  },
  {
    id: 'tarnishedWarflag',
    name: 'Tarnished Warflag',
    rarity: 'rare',
    icon: '🏴',
    triggers: [{ on: 'playerTurnStart', do: [{ op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1 }] }],
    textTemplate: 'At the start of each turn, apply {weak} Weak to ALL enemies.',
    flavor: 'The colors are all but rotted away. What it musters now answers to no banner but yours.',
  },
  {
    id: 'wrathCoil',
    name: 'Wrath Coil',
    rarity: 'rare',
    icon: '⚡',
    triggers: [
      {
        on: 'hpLost',
        if: { p: 'eventTargetIsOwner' },
        do: [{ op: 'damage', target: 'randomEnemy', amount: 3 }],
      },
    ],
    textTemplate: 'Whenever you lose HP, deal {damage} damage to a random enemy.',
    flavor: 'It winds tighter with every wound and lets go all at once, at someone else.',
  },
];
