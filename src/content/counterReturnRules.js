// Counter-return hit checks reuse Combat Rounds' approved accuracy/evasion math.
// Known starter materials are explicit; other worn pieces use their configured
// armorClass when no material is authored. Nothing is inferred from names.
export const counterReturnRules = {
  armorClassMaterials: { light: 'Leather', medium: 'Chain', heavy: 'Plated' },
  starterMaterials: {
    'reaver:default': 'Plated', 'rogue:default': 'Leather',
    'starseer:default': 'Cloth', 'herald:default': 'Cloth',
    wayfarerPlate: 'Plated', gutterLeathers: 'Leather',
    nightweave: 'Cloth', riteVestments: 'Cloth',
  },
  enemyBaseEvasion: { wanderingSoldier: 1, blightHound: 3, huskBrute: 0, fellWarden: 2 },
};
