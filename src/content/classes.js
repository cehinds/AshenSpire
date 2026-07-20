// src/content/classes.js — class definitions (SPEC §5.1)
//
// Only the Vagabond registers in M1 (the schema is strict; locked classes are
// UI display data, exported separately below and NOT part of the bundle).

export const classes = [
  {
    id: 'vagabond',
    glyph: '⚔',
    name: 'Vagabond',
    maxHp: 84,
    startingRelic: 'tarnishedMedallion',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'bloodflameSlash',
    ],
    cardPool: [
      // Commons
      'crimsonCleave', 'shieldBash', 'quickstep', 'guardCounter', 'ironResolve',
      'serratedBlade', 'enterBloodflame', 'enterBulwark',
      'riposte', 'rend', 'cleavingBlow', 'goreslash', 'bracingStance',
      // Uncommons
      'stomp', 'rallyingStandard', 'warSurgeon', 'hemorrhage', 'twinbladeFlurry',
      'shieldwall', 'kickOff',
      'wardingLunge', 'impale', 'warcry', 'flameToBlade', 'ironVowCard',
      // Rares
      'executioner', 'lordsBlood', 'unbreakable', 'graftedArms', 'lastStand', 'warriorsVow',
      'ruinousBlow', 'bloodhuntersStrike', 'sanguinePactCard', 'bloodTithe', 'poiseBreaker',
    ],
    description:
      'Weapon-arts duelist: stance dancing between Bloodflame offense and Bulwark defense, with Bleed and Poise as twin payoff meters.',
  },
  {
    id: 'astrologer',
    glyph: '☄',
    name: 'Astrologer',
    maxHp: 72,
    startingRelic: 'glintstoneShard',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'glintstonePebble',
    ],
    cardPool: [
      // Commons
      'cometFragment', 'glintbladePhalanx', 'crystalBarrier', 'starShower', 'scholarsInsight', 'frostVeil',
      'starSlicer', 'glintstoneWard', 'starlance', 'twinkling', 'frostNova', 'shootingShard', 'wardingStar',
      // Uncommons
      'glintstoneArc', 'lucidity', 'stargazerCard', 'astralArmorCard', 'moonveilCut', 'meteorite',
      'meteorSwarm', 'gravityWell', 'ceruleanCoilCard', 'astralCleave', 'radiantSpray', 'starPath', 'moonlitShieldCard',
      // Rares
      'supernova', 'timeDilation', 'glintstoneKris', 'constellationCard',
      'starfallBeam', 'starcaller', 'umbralWard', 'waxingMoonCard', 'celestialLance', 'astromancerCard',
    ],
    description:
      'Sorcery combos: the second spell each turn is empowered (Glintstone). Fragile early — sequencing is everything.',
  },
  {
    id: 'prophet',
    glyph: '☀',
    name: 'Prophet',
    maxHp: 78,
    startingRelic: 'goldFigurine',
    startingDeck: [
      'strike', 'strike', 'strike', 'strike', 'strike',
      'defend', 'defend', 'defend', 'defend',
      'urgentHeal',
    ],
    cardPool: [
      // Commons
      'bloodPact', 'rotTouch', 'flagellation', 'penance', 'litany', 'graveOffering',
      'bloodletting', 'contagion', 'cullTheWeak', 'transfusion', 'rotward', 'painOffering', 'witheringTouch',
      // Uncommons
      'martyrBlood', 'rotBloom', 'sacredHarvest', 'thornHaloCard', 'communionCard', 'goldenVow',
      'plagueBearer', 'exsanguinate', 'stigmataCard', 'scourge', 'reclamation', 'desperateRite', 'graceTideCard',
      // Rares
      'secondBloom', 'butterflyPlague', 'lifeTitheCard', 'crimsonRite',
      'rotNova', 'lastRites', 'zealotryCard', 'bloodHarvest', 'bloodOfferingRite', 'harbingerOfRotCard',
    ],
    description:
      'HP as a resource: pay blood for tempo, spread Scarlet Rot, and heal it all back. One pool — mistakes compound.',
  },
];

// All classes are playable as of M3 phase 1; kept for UI compatibility.
export const LOCKED_CLASSES = [];
