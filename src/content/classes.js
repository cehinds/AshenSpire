// src/content/classes.js — class definitions (SPEC §5.1)
//
// Only the Reaver registers in M1 (the schema is strict; locked classes are
// UI display data, exported separately below and NOT part of the bundle).

export const classes = [
  {
    id: 'reaver',
    cardTint: '#a8724a',
    glyph: '⚔',
    name: 'Reaver',
    maxHp: 84,
    startingFlaskAllocation: { hp: 2, mana: 1 },
    startingRelic: 'forsakenMedallion',
    startingSignatureCard: 'gorefireSlash',
    eligibleStartingKitIds: ['reaverBaseline', 'reaverGreatsword'],
    cardPool: [
      // Commons
      'crimsonCleave', 'shieldBash', 'quickstep', 'guardCounter', 'ironResolve',
      'serratedBlade', 'enterGorefire', 'enterBulwark',
      'riposte', 'rend', 'cleavingBlow', 'goreslash', 'bracingStance',
      // Uncommons
      'stomp', 'rallyingStandard', 'warSurgeon', 'hemorrhage', 'twinbladeFlurry',
      'shieldwall', 'kickOff',
      'wardingLunge', 'impale', 'warcry', 'flameToBlade', 'ironVowCard',
      // Rares
      'executioner', 'goreblood', 'unbreakable', 'stitchedArms', 'lastStand', 'warriorsVow',
      'ruinousBlow', 'bloodhuntersStrike', 'sanguinePactCard', 'bloodTithe', 'poiseBreaker',
    ],
    description:
      'Fights up close and switches footing mid-battle — one stance hits harder, the other holds the line. Wounds you land keep bleeding, and heavy blows stagger.',
  },
  {
    id: 'starseer',
    cardTint: '#8f86d8',
    glyph: '☄',
    name: 'Starseer',
    maxHp: 72,
    startingFlaskAllocation: { hp: 1, mana: 2 },
    startingRelic: 'starstoneShard',
    startingSignatureCard: 'starstonePebble',
    eligibleStartingKitIds: ['starseerBaseline', 'starseerStarstone'],
    cardPool: [
      // Commons
      'cometFragment', 'starbladePhalanx', 'crystalBarrier', 'starShower', 'scholarsInsight', 'frostVeil',
      'starSlicer', 'starstoneWard', 'starlance', 'twinkling', 'frostNova', 'shootingShard', 'wardingStar',
      // Uncommons
      'starstoneArc', 'lucidity', 'stargazerCard', 'astralArmorCard', 'moonrendCut', 'meteorite',
      'meteorSwarm', 'gravityWell', 'azureCoilCard', 'astralCleave', 'radiantSpray', 'starPath', 'moonlitShieldCard',
      // Rares
      'supernova', 'timeDilation', 'starstoneKris', 'constellationCard',
      'starfallBeam', 'starcaller', 'umbralWard', 'waxingMoonCard', 'celestialLance', 'astromancerCard',
    ],
    description:
      'Casts in sequence — the second spell each turn strikes harder than the first. Fragile early on, so the order you play cards matters more than their power.',
  },
  {
    id: 'herald',
    cardTint: '#c98a6a',
    glyph: '☀',
    name: 'Herald',
    maxHp: 78,
    startingFlaskAllocation: { hp: 2, mana: 1 },
    startingRelic: 'goldFigurine',
    startingSignatureCard: 'urgentHeal',
    eligibleStartingKitIds: ['heraldBaseline', 'heraldEmberlight'],
    cardPool: [
      // Commons
      'bloodPact', 'blightTouch', 'flagellation', 'penance', 'litany', 'graveOffering',
      'bloodletting', 'contagion', 'cullTheWeak', 'transfusion', 'blightward', 'painOffering', 'witheringTouch',
      // Uncommons
      'martyrBlood', 'blightBloom', 'sacredHarvest', 'thornHaloCard', 'communionCard', 'gildedOath',
      'plagueBearer', 'exsanguinate', 'stigmataCard', 'scourge', 'reclamation', 'desperateRite', 'emberTideCard',
      // Rares
      'secondBloom', 'butterflyPlague', 'lifeTitheCard', 'crimsonRite',
      'blightNova', 'lastRites', 'zealotryCard', 'bloodHarvest', 'bloodOfferingRite', 'harbingerOfBlightCard',
    ],
    description:
      'Spends its own health to act, then heals it back. Spreads a rot that damages enemies over time. One pool for everything, so mistakes stack up fast.',
  },
];

// All classes are playable as of M3 phase 1; kept for UI compatibility.
export const LOCKED_CLASSES = [];
