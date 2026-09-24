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

export const starseerCards = [
  // ---- Starter ---------------------------------------------------------------
  {
    id: 'starstonePebble', name: 'Starstone Pebble', class: 'starseer', rarity: 'starter', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A chip of starstone of the kind the Observatory's apprentices were set to weigh and catalogue in their first winter. The Astronomer held that such stones were inert once cooled, and his catalogue says so throughout. The apprentices kept the drawers shut at night all the same. Their notes record frost forming on the labels, though never on the stones.\n\n— Starwatch catalogue, apprentice notes",
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
    id: 'cometFragment', name: 'Comet Fragment', class: 'starseer', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A broken piece of starstone thrown hard, the plainest working of the Starwatch and the first an apprentice was allowed to cast outside the lens gallery. The fragments came up the Basalt Stair in miners' sacks and were sold by weight. The Astronomer bought and catalogued each one. His catalogue passes from chart 41, which records a fall, to chart 42, which records a hearth, and does not account for the interval.\n\n— Starwatch catalogue",
    keywords: [], icon: '☄',
    effects: [{ op: 'damage', target: 'enemy', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Deal {damage} damage.',
    upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, GAIN_CHARGE] },
  },
  {
    id: 'starbladePhalanx', name: 'Starblade Phalanx', class: 'starseer', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A rank of blades ground from a single stone and cast one after another. The apprentices found that blades cut from the same stone answered one another in sequence, the second truer than the first. The Starwatch recorded this as a property of the stone. The Chapel's censor, reviewing the record, struck out \"answered\" and wrote \"rang\". The apprentices went on using the first word.\n\n— Starwatch log, censored copy",
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
    flavor: "A pane of starstone raised before the one who works it, cut on the same principle as the Observatory's great lens. The lens cracked in the frost of the eclipse and went on holding the light. The Astronomer put this down to the quality of his grinding. Maud Vell, who ground it, said the crack had closed a little by morning, and would not grind another.\n\n— Starwatch log",
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
    flavor: "A sheaf of small lights called down in sequence. The Starwatch log for one autumn vigil counts forty falls in a single night, none of which reached the ground warm. The log treats the count as ordinary. The apprentice who kept it wrote in the margin to ask where forty falls could come from in one night, and the answer beside it, in the Astronomer's hand, has been cut from the page.\n\n— Starwatch log",
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
    flavor: "The apprentices' habit of copying a chart twice, on the principle that the second copy is the true one. The Astronomer approved of it as discipline. The two copies of chart 9 differ in a single figure, and the Starwatch never settled which was right. The figure gives the distance from the three hearths to a point on the coast, and both copies left the Observatory with the apprentice who stole the charts.\n\n— apprentice's letter",
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
    flavor: "A veil of rime drawn over the one who works it, first recorded on the Observatory's upper terrace on the night of the eclipse, when the terrace froze in the space of a breath. The instruments stopped together. An apprentice named Hollis logged the hour from the stopped clock and wrote beside it that he did not trust it. Someone has since corrected the hour, in a hand that is not the Astronomer's, and given no reason.\n\n— Starwatch log, eclipse night",
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
    flavor: "A fragment split along its grain and thrown in pieces. Starstone splits cleanly along lines the lens-grinders could see and the miners could not. The grinders took this as a sign the stone had been worked before it ever fell, an idea the Astronomer called sentimental. He kept a split fragment on his desk nonetheless, turned so the grain faced the window.\n\n— lens-grinders' talk",
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
    flavor: "A slab of starstone stood upright as a shield, after the fashion of the Observatory's doors, which were cut long before the Starwatch by builders whose name the Chapel did not keep. Starstone stays cold when all else warms, and the apprentices trusted it for that. They also believed the doors had not been built to open from the inside. The Chapel's inventory lists the doors as ornamental.\n\n— Starwatch inventory",
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
    id: 'starlance', name: 'Starlance', class: 'starseer', rarity: 'common', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A beam of light forced through a starstone lens onto a single point. The Starwatch found it by accident, when the great lens scorched a line across the chart-room table. The Astronomer had the table kept as it was and recorded that the line ran true to the south-west. The table is kept as it was, and the line on it has lengthened since.\n\n— Starwatch log",
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
    flavor: "A small light drawn from a star that varies. The Astronomer recorded its variation nightly for many years and drew no conclusion from it, which he described as his rule. His apprentices said he broke the rule once, in the last spring before the Burning, when he spent three nights on that star alone. The charts for those nights are not in the series.\n\n— apprentice's letter",
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
    id: 'frostNova', name: 'Frost Nova', class: 'starseer', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A burst of cold that rings the one who works it, modelled on the rings of frozen ash the miners found around fresh falls on the caldera floor. Coll, a foreman who sold fragments to the Starwatch, told the apprentices the ash froze before the stone landed, not after. The Astronomer told him miners were unreliable witnesses, then bought his next fragment at double the price.\n\n— reach miners' talk",
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
    flavor: "An arc of force cast from starstone, the working the apprentices used to measure how far the stone would reach. The arc was measured three times and the stone found to have moved between readings. The log calls the movement an error in the apparatus. The apparatus was replaced, and the log records the same error each month until its entries end at the eclipse.\n\n— Starwatch log",
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
    flavor: "A clearing of the head for work, which the Starwatch practised on the one clear night in forty that the reach allowed. The Astronomer worked through such nights without sleep and required his apprentices to do the same. They believed he saw more on those nights than the charts show, and wrote it down somewhere else. The Starwatch holds only the charts.\n\n— apprentice's letter",
    keywords: [], icon: '🌙',
    effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 1 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} card.',
    upgrade: { effects: [{ op: 'gainEnergy', amount: 1 }, { op: 'draw', amount: 2 }, GAIN_CHARGE] },
  },
  {
    id: 'stargazerCard', name: 'Stargazer', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "The long watch at the eyepiece. The Astronomer kept it for a hundred years by his own count, and in that time wrote a great deal about the coal's dimming and nothing about what the dimming meant. The Chapel admired his restraint. I have written home before that the old man is watching something he has already decided not to describe. I will not write it again.\n\n— apprentice's letter",
    keywords: [], icon: '🔭',
    effects: [{ op: 'applyStatus', target: 'self', status: 'stargazer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'astralArmorCard', name: 'Astral Armor', class: 'starseer', rarity: 'uncommon', cost: 1, staminaCost: 1, manaCost: 1, type: 'power',
    flavor: "A mantle of cold light that settles over the one who works it, named for Starwatch Terrace on the Drowned Coast, which the Astronomer had paved in starstone so his apprentices could measure the new tower's draw. The paving never warmed in summer and the salt spray never dried on it. I was sent to bless the stones, and blessed them without incident. I ask to be posted elsewhere.\n\n— Chapel visitation report",
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
    flavor: "A crescent stroke from the curved blades of the Observatory's night-porters, who walked the Basalt Stair with lanterns. The porters claimed the moon's passage over the caldera showed them where to cut. The Starwatch called this folklore and employed them anyway. Their blades turn up now in the lower galleries, sometimes in the hands of porters who are no longer entirely themselves.\n\n— Starwatch log",
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
    flavor: "A heavy stone called down on a single enemy. The Starwatch recovered its largest fragment from below the Basalt Stair and recorded that it weighed more than its size allowed. The miners who carried it up said it weighed more at the top of the stair than at the bottom. The Astronomer had it weighed at both ends and entered the results in cipher.\n\n— Starwatch catalogue",
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
    flavor: "Many falls called at once. Chart 43 records two falls on a single night, and the Starwatch sent miners to both sites, who found no crater at either. The Astronomer entered both falls regardless, on the grounds that his lens could not be wrong. A third mark on chart 43, in another ink, is not explained anywhere in the catalogue.\n\n— Starwatch catalogue",
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
    flavor: "A pull that drags enemies off their footing, named for the Observatory's great pendulum. The pendulum swung true for most of the Starwatch's history. In the years the Spire was building, it began to lean toward the coast and did not recover. The Astronomer recorded the lean monthly, put it down to settling in the tower's foundations, and ordered an inspection. The inspection report is blank.\n\n— Starwatch log",
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
    flavor: "A coil of blue light that gathers around whoever is working it, first noticed around apprentices reciting the star tables aloud in rhythm. The Starwatch claims the rhythm draws it. This office holds that the recited tables are in an old script and should not be spoken, and has ordered the recitation stopped. The coil was observed around the same apprentices the following night.\n\n— Chapel censor's report",
    keywords: [], icon: '🌀',
    effects: [{ op: 'applyStatus', target: 'self', status: 'azureCoil', stacks: one }],
    textTemplate: 'Whenever you play a Skill, gain 2 Block.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'astralCleave', name: 'Astral Cleave', class: 'starseer', rarity: 'uncommon', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A cut of cold force, first seen when a falling fragment passed through the lens gallery and sheared the telescope cleanly in two before cooling on the floor. The Astronomer entered the event as a fall. His lens-grinder, Maud Vell, who had been standing at the eyepiece, described it as a throw. She was dismissed at the end of that season.\n\n— Starwatch log",
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
    flavor: "A flare of light thrown wide across the field. The Starwatch recorded one such flare in the years the Spire was building, bright enough to light all the Observatory's terraces at once, and noted that the apprentices on duty lost their sight for several days. The log gives no source for the flare. When their sight returned, the apprentices were asked not to discuss it.\n\n— Starwatch log",
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
    flavor: "The brightest working in the charts, and the last the Starwatch recorded. The Astronomer's final predictive chart forecasts a light strong enough to burn the paper it is drawn on. The Starwatch took it for a prediction about a star. The chart is unsigned and undated, and the apprentices who filed the series swore it was not among the sheets they left on his desk.\n\n— Starwatch catalogue",
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
    flavor: "A slowing of the moment, named for the night of the eclipse. By the Starwatch's reckoning the eclipse lasted one night. By the Observatory clock it has not ended. Anselm, who kept the clock, refused to reset it and was found beside it when the others came up, in the position he had held when the light went. The clock has not been reset.\n\n— Starwatch log",
    keywords: ['exhaust'], icon: '⏳',
    effects: [{ op: 'gainEnergy', amount: 2 }, { op: 'draw', amount: 3 }, GAIN_CHARGE],
    textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards. Exhaust.',
    upgrade: { keywords: [], textTemplate: 'Gain {gainEnergy} Energy. Draw {draw} cards.' },
  },
  {
    id: 'starstoneKris', name: 'Starstone Kris', class: 'starseer', rarity: 'rare', cost: 1, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A wavy dagger of starstone, carried by apprentices for rough work in the lower galleries. The apprentice who owned the first of them wrapped it in cloth and found the cloth frosted by morning. The Starwatch recorded that the kris held its cold whether carried or not. The apprentice noted, on a separate leaf, that it was coldest in the Astronomer's presence.\n\n— Starwatch log",
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
    flavor: "A working that draws on three stars at once, patterned on the constellation behind the Goldbough's crest: three flames on three twigs. The Chapel taught that the crest came first and the stars were named after it. The Starwatch's oldest star-plate, cut before the kingdom, shows the same three stars with a faint fourth beside them. The Chapel's copy of the plate leaves it out.\n\n— Starwatch catalogue, oldest plate",
    keywords: [], icon: '💫',
    effects: [{ op: 'applyStatus', target: 'self', status: 'constellation', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, deal 4 damage to a random enemy.',
    upgrade: { cost: 1 },
  },
  {
    id: 'starfallBeam', name: 'Starfall Beam', class: 'starseer', rarity: 'rare', cost: 3, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A column of falling light, modelled on a fall the Astronomer charted in advance. He predicted where it would strike on the caldera rim and sent no warning to the mine camps there. His margin notes that the camps were unmarked and absent from the Court's maps, and that he had therefore counted the ground as empty. The margin gives the fall's weight to the grain, and the camps' number not at all.\n\n— Astronomer's chart margin",
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
    flavor: "A working that calls falls in number, as the apprentices practised it in the lens gallery. The apprentices chanted the star tables in rhythm while practising it, and on the night it was first attempted the Starwatch recorded eleven falls. The Astronomer entered the chanting and the falls in the same line and drew no connection between them. He never drew connections, the apprentices said.\n\n— apprentice's letter",
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
    flavor: "A ward of shadow cast from starstone, named for the eclipse, during which the Observatory cast no shadow at all. The Starwatch recorded the absence as a curiosity of the light. The apprentices on the terrace that night reported that they cast shadows as usual, but that their shadows fell toward the Observatory rather than away from it.\n\n— Starwatch log",
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
    flavor: "A working that grows night by night, named for the moon-table the Starwatch kept alongside its ember-tables. In the last decade before the Burning the two tables moved in step: each night the moon grew, the coal in the Crown dimmed by the same measure. The Astronomer noted the correspondence, called it coincidence, and stopped keeping the moon-table.\n\n— Starwatch tables",
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
    flavor: "A small fall called down quickly, too small for the charts. The Starwatch left falls of this size unrecorded, holding that a star too faint to mark the lens was not worth the ink. The reach miners kept their own tally of small falls, scratched on the walls of the lower galleries. The log mentions the tally once, to dismiss it, and gives a figure far higher than its own.\n\n— Starwatch log",
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
    flavor: "A guarding light fixed above the one who works it, named for the star the apprentices called the Fixed Lamp, which hung over the coast and did not move with the others. The Starwatch took it for a flaw in the lens and reground the lens twice. The star stayed where it was. Once the Spire was finished, the log stops using the name and refers to it only as \"the error\".\n\n— Starwatch log",
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
    flavor: "A step taken along a line of light. The fourth viaduct spur appears on the Starwatch's charts some years before the Court commissioned it, drawn in the Astronomer's hand from the ring to the coast. The Court later claimed the Spire as its own idea. The charts suggest the Court was told where to build. Who told the Astronomer, they do not say.\n\n— Starwatch charts",
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
    flavor: "Frost raised on the air by moonlight crossing starstone. On clear nights we watch it rise along the rails of Starwatch Terrace, across the water, where the apprentices once judged the cold by it. We have seen it form on those rails in the shape of a word. We have not written it down, and we will not say it.\n\n— Tidebound Chapel register",
    keywords: [], icon: '🔷',
    effects: [{ op: 'applyStatus', target: 'self', status: 'moonlitShield', stacks: one }],
    textTemplate: 'Whenever you gain Starstone Charge, gain 3 Block.',
    upgrade: { manaCost: 0 },
  },
  {
    id: 'celestialLance', name: 'Celestial Lance', class: 'starseer', rarity: 'rare', cost: 2, staminaCost: 1, manaCost: 1, type: 'attack',
    flavor: "A long spear of light aimed at a single enemy. Chart 58 records a line of light from horizon to zenith lasting one breath, and gives its source as a star found on no other chart. The Astronomer entered it as an optical fault. He spent the following week grinding a new lens, which the apprentices never saw him use. Chart 58 is the last he signed.\n\n— Starwatch catalogue",
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
    flavor: "The Starwatch's discipline in the hands of one who left it. An apprentice took the charts and walked out of the Observatory before the eclipse, leaving the apprentice roll behind. The Starwatch recorded the departure as theft. The apprentice's line in the roll has been scraped out, though not so thoroughly that the name cannot be guessed.\n\n— Starwatch log",
    keywords: [], icon: '📚',
    effects: [{ op: 'applyStatus', target: 'self', status: 'astromancer', stacks: one }],
    textTemplate: 'At the start of your turn, gain Starstone Charge and draw a card.',
    upgrade: { manaCost: 0 },
  },

  // ---- Content-pass additions (round 4) --------------------------------------
  {
    id: 'starSpark', name: 'Star Spark', class: 'starseer', rarity: 'common', cost: 1, type: 'attack',
    flavor: "A spark struck from starstone and thrown. The chart room kept a starstone flint for its lamps, since the Astronomer would not have flame from the Chapel in the room. The flint gave sparks that went out before they landed. Maud Vell, the lens-grinder, said this was the stone being careful. The Astronomer entered her remark in the log so that it could be disagreed with.\n\n— Starwatch log",
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
    flavor: "A moment of clear sight into the charts. The apprentices believed the Starwatch's ledgers were meant to end where the charts of the fourth hearth began, and that the Astronomer once underlined a line in the margin there and later scored through his own underlining. The charts of the fourth hearth are not among those the apprentice carried away.\n\n— apprentice's letter",
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
    flavor: "The apprentice's first exercise: to hold a stone until one's pulse and the stone's rhythm matched. The Starwatch taught that starstone answers rhythm and not force, a principle it credited to the Astronomer. The standing stones on the marches road hum in the same rhythm and were raised long before he was born. The primer records this without comment.\n\n— Starwatch primer",
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
