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
    startingRelic: 'forsakenMedallion',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'gorefireSlash',
    ],
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
      'Weapon-arts duelist: stance dancing between Gorefire offense and Bulwark defense, with Bleed and Poise as twin payoff meters.',
  },
  {
    id: 'starseer',
    cardTint: '#8f86d8',
    glyph: '☄',
    name: 'Starseer',
    maxHp: 72,
    startingRelic: 'starstoneShard',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'starstonePebble',
    ],
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
      'Sorcery combos: the second spell each turn is empowered (Starstone). Fragile early — sequencing is everything.',
  },
  {
    id: 'herald',
    cardTint: '#c98a6a',
    glyph: '☀',
    name: 'Herald',
    maxHp: 78,
    startingRelic: 'goldFigurine',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'urgentHeal',
    ],
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
      'HP as a resource: pay blood for tempo, spread Crimson Blight, and heal it all back. One pool — mistakes compound.',
  },
];

// All classes are playable as of M3 phase 1; kept for UI compatibility.
export const LOCKED_CLASSES = [];
