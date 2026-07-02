// src/content/classes.js — class definitions (SPEC §5.1)
//
// Only the Vagabond registers in M1 (the schema is strict; locked classes are
// UI display data, exported separately below and NOT part of the bundle).

export const classes = [
  {
    id: 'vagabond',
    name: 'Vagabond',
    maxHp: 78,
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
      // Uncommons
      'stomp', 'rallyingStandard', 'warSurgeon', 'hemorrhage', 'twinbladeFlurry',
      'shieldwall', 'kickOff',
      // Rares
      'executioner', 'lordsBlood', 'unbreakable', 'graftedArms', 'lastStand', 'warriorsVow',
    ],
    description:
      'Weapon-arts duelist: stance dancing between Bloodflame offense and Bulwark defense, with Bleed and Poise as twin payoff meters.',
  },
];

// M3 classes — UI display only (SPEC §5.1 identities are contractual).
export const LOCKED_CLASSES = [
  { id: 'astrologer', name: 'Astrologer', milestone: 'M3', description: 'Sorcery combos: the second spell each turn is empowered.' },
  { id: 'prophet', name: 'Prophet', milestone: 'M3', description: 'HP as a resource: Scarlet Rot and healing synergies.' },
];
