// src/content/cards/starseer.js — the Starseer pool (SPEC §5.1: M3)
//
// Class identity: STARSTONE COMBOS — the 2nd+ spell each turn is empowered.
// Mechanically pure data: each spell checks starstoneCharge FIRST (its
// "Starstone:" bonus), then applies the charge for the next spell. The
// charge is unique + turn-end decay (content/statuses.js). Weak early block
// is the designed weakness (GDD §4.3).
//
// M3 note: pool grown to 30 rewardable cards in the M3 content pass (toward
// SPEC's ~50). New cards deepen the Starstone identity — multi-hit (Star
// Slicer), AoE combos (Meteor Swarm, Radiant Spray, Starfall Beam), control
// (Frost Nova, Gravity Well), and scaling powers (Azure Coil, Waxing Moon).

const one = { f: 'add', args: [1] };
const CHARGED = { p: 'hasStatus', of: 'self', status: 'starstoneCharge' };
const GAIN_CHARGE = { op: 'applyStatus', target: 'self', status: 'starstoneCharge', stacks: one };

// A2 Starseer starvation: the starter and common attacks (Starstone Pebble,
// Comet Fragment, Starblade Phalanx, Starlance, Frost Nova) cost actions only —
// no Mana, no Stamina — so a Starseer whose Mana carries between fights can
// still fight; their cardExposure.csv rows drop to the action-only 1 (SPEC:
// "action-only spells keep 1"). Measured with the Arcane Ward, Starstone Shard,
// flask and Lodestar rows: `node tools/runsim.mjs 60` Starseer 1/60 -> 21/60
// (82/200 alone; 78/200 with these rows left at 5, i.e. the buildup is noise).
export const starseerCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'starstonePebble', name: 'Starstone Pebble', class: 'starseer', rarity: 'starter', cost: 1, type: 'attack',
    flavor: "Chip of catalogued starstone.\n\nSuch stones were weighed and numbered by the Observatory's apprentices in their first winter. The Astronomer held them inert once cooled, and wrote as much throughout his catalogue.\n\nYet frost formed upon their labels by night. Never upon the stones.",
    keywords: [], icon: '💎',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Commons ----------------------------------------------------------------
  {
    id: 'cometFragment', name: 'Comet Fragment', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Sorcery of the Starwatch, the first permitted beyond the lens gallery.\n\nFragments came up the Basalt Stair in miners' sacks, sold by weight, and the Astronomer catalogued every one. Chart 41 records a fall. Chart 42 records a hearth.\n\nOf what lay between, the catalogue is silent.",
    keywords: [], icon: '☄',
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, GAIN_CHARGE] },
  },
  {
    id: 'starbladePhalanx', name: 'Starblade Phalanx', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Blades ground from a single stone.\n\nThe apprentices found that blades from one stone answered one another in sequence, the second truer than the first. The Chapel's censor struck \"answered\" from the record and wrote \"rang\".\n\nThe apprentices kept the first word.",
    keywords: [], icon: '🗡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'damage', target: 'enemy', amount: 6, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'crystalBarrier', name: 'Crystal Barrier', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Pane of starstone, cut as the great lens was cut.\n\nThe great lens cracked in the frost of the eclipse, yet held the light. The Astronomer credited his grinding.\n\nMaud Vell, who ground it, said the crack had closed a little by morning. She would not grind another.",
    keywords: [], icon: '🔷',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'block', target: 'self', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: {block.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'block', target: 'self', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starShower', name: 'Star Shower', class: 'starseer', rarity: 'common', cost: 2, type: 'attack',
    flavor: "Sorcery of the Starwatch, called in sequence.\n\nThe log of one autumn vigil counts forty small falls in a single night, none of which reached the ground warm. An apprentice asked in the margin whence forty falls could come.\n\nThe answer, in the Astronomer's hand, was cut from the page.",
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 3, hits: 3 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Starstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 4, hits: 3 },
        { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'scholarsInsight', name: "Scholar's Insight", class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Discipline of the double copy.\n\nApprentices copied each chart twice, for the second copy is the true one. The two copies of chart 9 differ in a single figure: the distance from the three hearths to a point upon the coast.\n\nBoth copies left the Observatory with the apprentice who took the charts.",
    keywords: [], icon: '📖',
    effects: [{ op: 'draw', amount: 2 }, GAIN_CHARGE],
    textTemplate: 'Draw {draw} cards.',
    upgrade: { effects: [{ op: 'draw', amount: 3 }, GAIN_CHARGE] },
  },
  {
    // FROST, not Weak (#127-adjacent, Rune 2026-08-08). The Frost row's own
    // proc LEAVES Weak — so a frost card that also applied Weak directly paid
    // the same debuff twice and made the build-up pointless. The card seeds the
    // build-up; the proc pays the Weak. Numbers PROVISIONAL, like the row's.
    id: 'frostVeil', name: 'Frost Veil', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Rime drawn over the body.\n\nFirst seen upon the Observatory's upper terrace on the night of the eclipse, when the terrace froze in the space of a breath and every instrument stopped. The apprentice Hollis logged the hour, and wrote that he did not trust it.\n\nThe hour has since been corrected, in an unknown hand.",
    keywords: [], icon: '🌫',
    effects: [
      { op: 'block', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 3 },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Apply {frost} Frost.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 4 },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starSlicer', name: 'Star Slicer', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Starstone, split along its grain.\n\nThe stone parts cleanly along lines the lens-grinders could see and the miners could not. The grinders held that it had been worked before it fell. The Astronomer called this sentimental.\n\nHe kept a split fragment upon his desk, its grain turned to the window.",
    keywords: [], icon: '🌠',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4, hits: 2 },
      { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage {hits} times. Starstone: one more hit of {damage.2}.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5, hits: 2 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starstoneWard', name: 'Starstone Ward', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Slab of starstone, raised as a shield.\n\nAfter the fashion of the Observatory's doors, cut by builders whose name the Chapel did not keep. Starstone stays cold where all else warms.\n\nThe apprentices believed those doors were not made to open from within.",
    keywords: [], icon: '🔰',
    effects: [
      { op: 'block', target: 'self', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starlance', name: 'Starlance', class: 'starseer', rarity: 'common', cost: 2, type: 'attack',
    flavor: "Light forced through a starstone lens.\n\nDiscovered when the great lens scorched a line across the chart-room table. The Astronomer had the table kept as it was, and recorded that the line ran true to the south-west.\n\nThe line has lengthened since.",
    keywords: [], icon: '🏹',
    effects: [
      { op: 'damage', target: 'enemy', amount: 9, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 13, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 12, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 17, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'twinkling', name: 'Twinkling', class: 'starseer', rarity: 'common', cost: 0, type: 'skill',
    flavor: "Light drawn from a varying star.\n\nThe Astronomer recorded its variation nightly for many years, and drew no conclusion, as was his rule. In the last spring before the Burning, he spent three nights upon it alone.\n\nThe charts of those nights are not in the series.",
    keywords: [], icon: '✨',
    effects: [
      { op: 'draw', amount: 1 },
      { op: 'gainEnergy', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Draw {draw} card. Starstone: gain {gainEnergy} Energy.',
    upgrade: {
      effects: [
        { op: 'draw', amount: 2 },
        { op: 'gainEnergy', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    // THE CARD NAMED FROST NOVA NOW APPLIES FROST (Rune, 2026-08-08). It
    // applied `weak` + `vulnerable` and nothing in the game applied `frost` at
    // all — a complete threshold-proc row (threshold, burst, Frost-Exposed, a
    // resist row and its own SFX row) that no player could reach. Weak and
    // Vulnerable are what the Frost PROC leaves behind; this is the card that
    // fills the meter, and it is the Starseer's because frostExposed raises
    // `starstone`-tagged damage. Numbers PROVISIONAL, like the row's.
    id: 'frostNova', name: 'Frost Nova', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Ring of cold, after the frozen ash of the caldera.\n\nMiners found such rings about fresh falls upon the caldera floor. Coll, a foreman, told the apprentices the ash froze before the stone landed. The Astronomer named miners unreliable witnesses.\n\nHe bought Coll's next fragment at double the price.",
    keywords: [], icon: '❄',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 4 },
      { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Apply {frost} Frost. Starstone: apply {frost.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 6 },
        { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 5 },
        { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Uncommons -----------------------------------------------------------------
  {
    id: 'starstoneArc', name: 'Starstone Arc', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Arc of force, used to measure the stone's reach.\n\nMeasured three times, the stone was found to have moved between readings. The Starwatch recorded an error of the apparatus, and replaced it.\n\nThe same error is recorded each month, until the eclipse.",
    keywords: [], icon: '⚡',
    effects: [
      { op: 'damage', target: 'enemy', amount: 7 },
      { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: apply {vulnerable} Vulnerable.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 9 },
        { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 2, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'lucidity', name: 'Lucidity', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Clarity for the work.\n\nPractised on the one clear night in forty the reach allowed. The Astronomer worked such nights without sleep, and bade his apprentices do the same.\n\nThey believed he saw more than the charts show, and wrote it elsewhere.",
    keywords: [], icon: '🌙',
    effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: { effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 2 }, GAIN_CHARGE] },
  },
  {
    id: 'stargazerCard', name: 'Stargazer', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "The long watch at the eyepiece.\n\nThe Astronomer kept it a hundred years by his own count, recording the coal's dimming and never its meaning. The Chapel admired his restraint.\n\nHis apprentices believed he watched something he had already resolved not to describe.",
    keywords: [], icon: '🔭',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stargazer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'astralArmorCard', name: 'Astral Armor', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Mantle of cold light, after Starwatch Terrace.\n\nThe terrace upon the Drowned Coast was paved in starstone, that the apprentices might measure the new tower's draw. The paving never warmed, and the salt spray never dried upon it.\n\nA Saint was sent to bless the stones. She asked to be posted elsewhere.",
    keywords: [], icon: '🌌',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: one }],
    textTemplate: 'At the end of your turn, gain 4 Block.',
    upgrade: {
      effects: [{ op: 'applyStatus', target: 'self', status: 'astralArmor', stacks: { f: 'add', args: [2] } }],
      textTemplate: 'At the end of your turn, gain 8 Block.',
    },
  },
  {
    id: 'moonrendCut', name: 'Moonrend Cut', class: 'starseer', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Crescent stroke of the Observatory's night-porters.\n\nThe porters walked the Basalt Stair with lanterns and curved blades, and claimed the moon's passage over the caldera showed them where to cut. The Starwatch called it folklore, and employed them regardless.\n\nTheir blades are found in the lower galleries, in hands no longer quite their own.",
    keywords: [], icon: '🌒',
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'poiseDamage', target: 'enemy', amount: 6 },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 11 },
        { op: 'poiseDamage', target: 'enemy', amount: 8 },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'meteorite', name: 'Meteorite', class: 'starseer', rarity: 'uncommon', cost: 3, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Heavy fall, called upon one enemy.\n\nThe largest fragment the Starwatch recovered weighed more than its size allowed. The miners who carried it said it weighed more atop the stair than at its foot.\n\nThe Astronomer had it weighed at both ends, and recorded the results in cipher.",
    keywords: [], icon: '🪨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 18, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 24, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 22, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 30, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'meteorSwarm', name: 'Meteor Swarm', class: 'starseer', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Many falls, called as one.\n\nChart 43 records two falls in a single night. Miners were sent to both sites and found no crater at either. The Astronomer entered both regardless, for his lens could not err.\n\nA third mark on chart 43, in another ink, is nowhere explained.",
    keywords: [], icon: '☄',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 5 },
      { op: 'damage', target: 'allEnemies', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Starstone: {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 7 },
        { op: 'damage', target: 'allEnemies', amount: 7, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'gravityWell', name: 'Gravity Well', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'skill',
    flavor: "Pull of the Observatory's great pendulum.\n\nThe pendulum swung true for most of the Starwatch's history. In the years the Spire was built, it leaned toward the coast, and did not recover.\n\nThe Astronomer ordered the foundations inspected. The report is blank.",
    keywords: [], icon: '🕳',
    effects: [
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 2 },
      { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Apply {vulnerable} Vulnerable to ALL enemies. Starstone: apply {weak} Weak to ALL.',
    upgrade: {
      effects: [
        { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 3 },
        { op: 'applyStatus', target: 'allEnemies', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'azureCoilCard', name: 'Azure Coil', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Blue light that gathers about the working.\n\nFirst seen around apprentices reciting the star tables aloud in rhythm. The Chapel's censor ruled the tables were written in an old script, and forbade their recitation.\n\nThe coil returned the following night.",
    keywords: [], icon: '🌀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'azureCoil', stacks: one }],
    textTemplate: 'Whenever you play a Skill, gain 2 Block.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'astralCleave', name: 'Astral Cleave', class: 'starseer', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Cut of cold force.\n\nFirst seen when a falling fragment passed through the lens gallery and sheared the telescope in two before cooling upon the floor. The Astronomer recorded a fall. Maud Vell, at the eyepiece, called it a throw.\n\nShe was dismissed at the season's end.",
    keywords: [], icon: '⚔',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10 },
      { op: 'poiseDamage', target: 'enemy', amount: 8 },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage and {poiseDamage} Poise damage. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 13 },
        { op: 'poiseDamage', target: 'enemy', amount: 10 },
        { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'radiantSpray', name: 'Radiant Spray', class: 'starseer', rarity: 'uncommon', cost: 2, type: 'attack',
    flavor: "Flare cast wide.\n\nIn the years the Spire was built, a flare lit every terrace of the Observatory at once, and the apprentices on watch lost their sight for days. The log gives no source.\n\nWhen their sight returned, they were asked not to speak of it.",
    keywords: [], icon: '🎇',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 4 },
      { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 },
      { op: 'damage', target: 'allEnemies', amount: 4, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} to ALL enemies. Apply {vulnerable} Vulnerable to ALL. Starstone: deal {damage.2} to ALL again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 6 },
        { op: 'applyStatus', target: 'allEnemies', status: 'vulnerable', stacks: 1 },
        { op: 'damage', target: 'allEnemies', amount: 6, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },

  // ---- Rares -----------------------------------------------------------------------
  {
    id: 'supernova', name: 'Supernova', class: 'starseer', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Brightest working in the charts.\n\nThe final predictive chart forecasts a light great enough to burn the paper it is drawn upon. The Starwatch took it for the fate of a star.\n\nThe chart is unsigned and undated. The apprentices swore it was not among the sheets they left upon his desk.",
    keywords: [], icon: '💥',
    effects: [{ op: 'damage', target: 'allEnemies', amount: 8, hits: { f: 'energySpent' } }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage to ALL enemies, scaling with Energy spent.',
    upgrade: {
      effects: [{ op: 'damage', target: 'allEnemies', amount: 10, hits: { f: 'energySpent' } }, GAIN_CHARGE],
      textTemplate: 'Deal {damage} damage to ALL enemies, scaling with Energy spent.',
    },
  },
  {
    id: 'timeDilation', name: 'Time Dilation', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Slowing of the moment, after the eclipse.\n\nBy the Starwatch's reckoning the eclipse lasted a single night. By the Observatory clock, it has not ended. Anselm, keeper of the clock, refused to reset it.\n\nHe was found beside it, standing as he stood when the light went.",
    keywords: ['exhaust'], icon: '⏳',
    effects: [{ op: 'gainEnergy', amount: 2 }, { op: 'draw', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: { keywords: [], textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards.' },
  },
  {
    id: 'starstoneKris', name: 'Starstone Kris', class: 'starseer', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Wavy dagger of starstone.\n\nCarried by apprentices for rough work in the lower galleries. Its first owner wrapped it in cloth and found the cloth frosted by morning. The kris keeps its cold whether carried or not.\n\nIt was coldest, the apprentice noted, in the Astronomer's presence.",
    keywords: [], icon: '🔪',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'draw', amount: 1, if: CHARGED },
      { op: 'damage', target: 'enemy', amount: 5, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: draw {draw} card and deal {damage.2} again.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'draw', amount: 1, if: CHARGED },
        { op: 'damage', target: 'enemy', amount: 7, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'constellationCard', name: 'Constellation', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Sorcery of three stars, after the Goldbough crest.\n\nThree flames upon three twigs. The Chapel taught that the crest came first, and the stars were named for it.\n\nThe Starwatch's oldest plate, cut before the kingdom, shows the same three stars, and a faint fourth. The Chapel's copy omits it.",
    keywords: [], icon: '💫',
    effects: [{ op: 'applyStatus', target: 'self', status: 'constellation', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, deal 4 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'starfallBeam', name: 'Starfall Beam', class: 'starseer', rarity: 'rare', cost: 3, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Column of falling light.\n\nModelled upon a fall the Astronomer charted in advance. He foresaw where it would strike upon the caldera rim, and sent no warning to the mine camps there, for they were unmarked, and absent from the Court's maps.\n\nHis margin gives the fall's weight to the grain. Of the camps, nothing.",
    keywords: [], icon: '🔆',
    effects: [
      { op: 'damage', target: 'allEnemies', amount: 12, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'allEnemies', amount: 20, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage to ALL enemies. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'allEnemies', amount: 16, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'allEnemies', amount: 26, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starcaller', name: 'Starcaller', class: 'starseer', rarity: 'rare', cost: 'X', staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Many falls, called in rhythm.\n\nThe apprentices chanted the star tables while practising it in the lens gallery, and on the night it was first attempted, eleven falls were recorded. The Astronomer entered chant and falls upon the same line.\n\nHe drew no connection between them. He drew none between anything.",
    keywords: [], icon: '⭐',
    effects: [
      { op: 'damage', target: 'enemy', amount: 6, hits: { f: 'energySpent' } },
      { op: 'damage', target: 'enemy', amount: 8, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage, scaling with Energy spent. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 8, hits: { f: 'energySpent' } },
        { op: 'damage', target: 'enemy', amount: 10, if: CHARGED },
        GAIN_CHARGE,
      ],
      textTemplate: 'Deal {damage} damage, scaling with Energy spent. Starstone: deal {damage.2} more.',
    },
  },
  {
    id: 'umbralWard', name: 'Umbral Ward', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'skill',
    flavor: "Ward of shadow, after the eclipse.\n\nDuring the eclipse the Observatory cast no shadow, which the Starwatch recorded as a curiosity of the light. The apprentices upon the terrace cast shadows as ever.\n\nTheirs fell toward the Observatory, not away.",
    keywords: [], icon: '🌑',
    effects: [
      { op: 'block', target: 'self', amount: 20, if: { p: 'not', pred: CHARGED } },
      { op: 'block', target: 'self', amount: 30, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: {block.2} instead.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 26, if: { p: 'not', pred: CHARGED } },
        { op: 'block', target: 'self', amount: 38, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'waxingMoonCard', name: 'Waxing Moon', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Sorcery of the Starwatch, drawn from the moon-table.\n\nIn the last years before the Burning, the Astronomer observed that as the moon waxed, the coal in the Crown dimmed in equal measure. He named it coincidence, and kept the moon-table no longer.\n\nWhat he would not record, his apprentices remembered.",
    keywords: [], icon: '🌕',
    effects: [{ op: 'applyStatus', target: 'self', status: 'waxingMoon', stacks: one }],
    textTemplate: 'At the start of your turn, apply 2 Vulnerable to ALL enemies.',
    upgrade: { cost: 1 },
  },

  // ---- Content-pass additions (round 2) ---------------------------------------
  // Two more commons (a cheap combo-piece and a defensive combo-piece), two
  // uncommons (a card-draw combo skill and a scaling shield power), two rares
  // (a heavy Starstone-gated attack and a combo-fed draw power) — rounding
  // the pool to 36. All follow the same "check charge first, then GAIN_CHARGE
  // last" shape as the rest of the pool.
  {
    id: 'shootingShard', name: 'Shooting Shard', class: 'starseer', rarity: 'common', cost: 0, type: 'attack',
    flavor: "Small fall, too faint for the charts.\n\nThe Starwatch left such falls unrecorded, a star too faint to mark the lens being unworthy of ink. The reach miners kept their own tally, scratched upon the walls of the lower galleries.\n\nTheir count runs far higher.",
    keywords: [], icon: '💫',
    effects: [
      { op: 'damage', target: 'enemy', amount: 4 },
      { op: 'damage', target: 'enemy', amount: 3, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: deal {damage.2} more.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 5 },
        { op: 'damage', target: 'enemy', amount: 4, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'wardingStar', name: 'Warding Star', class: 'starseer', rarity: 'common', cost: 1, type: 'skill',
    flavor: "Guarding light, after the Fixed Lamp.\n\nA star above the coast that did not move with the others. The Starwatch took it for a flaw of the lens and reground the lens twice. The star remained.\n\nAfter the Spire was finished, the log names it only \"the error\".",
    keywords: [], icon: '⭐',
    effects: [
      { op: 'block', target: 'self', amount: 6 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Starstone: draw {draw} card.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 8 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'starPath', name: 'Star Path', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Step along a line of light.\n\nThe fourth viaduct spur appears upon the Starwatch's charts years before the Court commissioned it, drawn in the Astronomer's hand from the ring to the coast. The Court later claimed the Spire as its own design.\n\nWho showed the Astronomer where to draw, the charts do not tell.",
    keywords: [], icon: '🌌',
    effects: [
      { op: 'draw', amount: 1 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Draw {draw} card. Starstone: draw {draw.2} more.',
    upgrade: {
      effects: [
        { op: 'draw', amount: 2 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'moonlitShieldCard', name: 'Moonlit Shield', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "Frost raised by moonlight upon starstone.\n\nIt rises along the rails of Starwatch Terrace on clear nights, where the apprentices once judged the cold by it. From the Tidebound Chapel across the water, the salt-priests have watched it form the shape of a word.\n\nThey have not written it down.",
    keywords: [], icon: '🔷',
    effects: [{ op: 'applyStatus', target: 'self', status: 'moonlitShield', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, gain 3 Block.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'celestialLance', name: 'Celestial Lance', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "Spear of light, horizon to zenith.\n\nChart 58 records such a line, lasting a single breath, sourced to a star upon no other chart. The Astronomer entered it as a fault of optics, then spent a week grinding a new lens he was never seen to use.\n\nChart 58 is the last he signed.",
    keywords: [], icon: '🔱',
    effects: [
      { op: 'damage', target: 'enemy', amount: 10, if: { p: 'not', pred: CHARGED } },
      { op: 'damage', target: 'enemy', amount: 22, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: {damage.2} instead.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 13, if: { p: 'not', pred: CHARGED } },
        { op: 'damage', target: 'enemy', amount: 28, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'astromancerCard', name: 'Astromancer', class: 'starseer', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "The Starwatch's discipline, carried away.\n\nAn apprentice took the charts and left the Observatory before the eclipse. The Starwatch recorded it as theft. The apprentice's line in the roll has been scraped away.\n\nNot so thoroughly that the name cannot be guessed.",
    keywords: [], icon: '📚',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astromancer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge and draw a card.',
    upgrade: { manaCost: 0 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'starSpark', name: 'Star Spark', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "Spark struck from a starstone flint.\n\nThe chart room kept such a flint for its lamps, for the Astronomer would not suffer the Chapel's flame in that room. Its sparks died before they landed.\n\nMaud Vell said the stone was being careful.",
    keywords: [], icon: '✨',
    effects: [
      { op: 'damage', target: 'enemy', amount: 5 },
      { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Deal {damage} damage. Starstone: apply {weak} Weak.',
    upgrade: {
      effects: [
        { op: 'damage', target: 'enemy', amount: 7 },
        { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  {
    id: 'astralInsight', name: 'Astral Insight', class: 'starseer', rarity: 'uncommon', cost: 1, type: 'skill',
    flavor: "Clear sight into the charts.\n\nThe apprentices believed the Starwatch's ledgers were meant to end where the charts of the fourth hearth began. There the Astronomer once underlined a line, and later struck through his own mark.\n\nThe charts of the fourth hearth were not among those carried away.",
    keywords: [], icon: '🌠',
    effects: [
      { op: 'block', target: 'self', amount: 5 },
      { op: 'draw', amount: 1 },
      { op: 'draw', amount: 1, if: CHARGED },
      GAIN_CHARGE,
    ],
    textTemplate: 'Gain {block} Block. Draw {draw} card. Starstone: draw {draw.2} more.',
    upgrade: {
      effects: [
        { op: 'block', target: 'self', amount: 7 },
        { op: 'draw', amount: 1 },
        { op: 'draw', amount: 1, if: CHARGED },
        GAIN_CHARGE,
      ],
    },
  },
  // ---- The class ability card (plan phase 5a, proposal §4) -----------------
  // Attune: the Starseer's loop is stamina tension around scarce casts; one
  // card that buys the next cast.
  {
    id: 'attune', name: 'Attune', class: 'starseer', rarity: 'starter', cost: 1, staminaCost: 1, type: 'skill',
    flavor: "First exercise of the apprentice.\n\nHold the stone until pulse and rhythm match. The Starwatch taught that starstone answers rhythm, not force, and credited the principle to the Astronomer.\n\nThe standing stones upon the marches road hum in the same rhythm. They are older than he.",
    keywords: ['exhaust'], icon: '✴',
    effects: [{ op: 'restoreMana', target: 'self', amount: 1 }],
    textTemplate: 'Restore {restoreMana} Mana. Exhaust.',
    upgrade: {
      keywords: [],
      effects: [{ op: 'restoreMana', target: 'self', amount: 1 }],
      textTemplate: 'Restore {restoreMana} Mana.',
    },
  },
];
