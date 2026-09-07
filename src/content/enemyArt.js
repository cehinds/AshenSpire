// Painted frames imported unchanged from cehinds/AshenSpire-Unity at 130d7c5.
// Every current enemy has a matching idle / attack pair, built from art/enemy-poses.
export const ENEMY_POSES = Object.freeze(["wanderingSoldier","blightHound","huskBrute","graveWisp","wyrmAspirant","fellWarden","lanternMoth","briarHermit","chainScavenger","bellKeeper","thornMatriarch","gildedKnight","courtSurgeon","stitchedHound","courtMarionette","livingArmor","courtDuelist","stitchedKing","mirrorScribe","stitchCrab","glassRegent","marrowOrganist","ashRevenant","emberStarvedPilgrim","valkyrieShade","charredColossus","wyrmLord","blightedValkyrie","cinderMantis","eclipseCantor","furnaceSaint","hollowAstronomer","ashheartDragon"]);

// Each is 384 × 384, facing left, with its foot anchor at (192, 364).
export const PAINTED_ENEMIES = Object.freeze([
  'wanderingSoldier', 'blightHound', 'livingArmor', 'fellWarden',
  'courtDuelist', 'courtSurgeon', 'gildedKnight', 'stitchedKing',
  'graveWisp', 'wyrmAspirant', 'valkyrieShade', 'wyrmLord',
]);

// Expansion portraits share the Unity frames' size, facing and foot anchor.
export const EXPANSION_ENEMIES = Object.freeze([
  'lanternMoth', 'briarHermit', 'chainScavenger', 'bellKeeper', 'thornMatriarch',
  'mirrorScribe', 'stitchCrab', 'glassRegent', 'marrowOrganist',
  'cinderMantis', 'eclipseCantor', 'furnaceSaint', 'hollowAstronomer', 'ashheartDragon',
]);
