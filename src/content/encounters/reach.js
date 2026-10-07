// src/content/encounters/reach.js — The Cinder Reach encounter pool (SPEC §13.2).
// The seat's numbers are authored at baseTier 3 (content/seats.js); a climb
// at another tier scales them by balance.seatTiers (§13.3). Rows are the act-3
// rows they always were, re-homed: `act: 3` became `seat: 'reach'`.

export const reachEncounters = [
  { id: 'a3_revenant', enemies: ['ashRevenant'], weight: 20, pool: 'normal', seat: 'reach', floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 16 } },
  { id: 'a3_pilgrims', enemies: ['emberStarvedPilgrim', 'emberStarvedPilgrim'], weight: 20, pool: 'normal', seat: 'reach', floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 16 } },
  { id: 'a3_shades', enemies: ['valkyrieShade', 'emberStarvedPilgrim'], weight: 25, pool: 'normal', seat: 'reach', floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 17 } },
  { id: 'a3_colossus', enemies: ['charredColossus'], weight: 15, pool: 'normal', seat: 'reach', floorBand: { min: 1, max: 4 }, targetBand: { min: 14, max: 18 } },
  { id: 'a3_ashChoir', enemies: ['ashRevenant', 'valkyrieShade'], weight: 20, pool: 'normal', seat: 'reach', floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 17 } },
  { id: 'a3_eliteWyrmLord', enemies: ['wyrmLord'], weight: 1, pool: 'elite', seat: 'reach', floorBand: { min: 5, max: 5 }, targetBand: { min: 18, max: 19 } },
  // THE ONE NULL SEAT (SPEC §13.5): the Blighted Valkyrie is the tier-3 act's
  // extra terminal whatever seat holds it, so she is in no seat's pool. She stays
  // in this file, in this position, because the boss pool is read in bundle
  // order and moving her would move which column each destination lands in.
  { id: 'a3_bossRotValkyrie', enemies: ['blightedValkyrie'], weight: 1, pool: 'boss', seat: null, floorBand: { min: 6, max: 6 }, targetBand: { min: 19, max: 20 } },
  {"id":"a3_cinderNest","enemies":["cinderMantis"],"weight":15,"pool":"normal","seat":"reach","floorBand":{"min":1,"max":4},"targetBand":{"min":14,"max":17}},
  {"id":"a3_eclipseChapel","enemies":["eclipseCantor"],"weight":15,"pool":"normal","seat":"reach","floorBand":{"min":2,"max":4},"targetBand":{"min":14,"max":17}},
  {"id":"a3_bossFurnaceSaint","enemies":["furnaceSaint"],"weight":1,"pool":"boss","seat":"reach","floorBand":{"min":6,"max":6},"targetBand":{"min":19,"max":20}},
  {"id":"a3_bossHollowAstronomer","enemies":["hollowAstronomer"],"weight":1,"pool":"boss","seat":"reach","floorBand":{"min":6,"max":6},"targetBand":{"min":19,"max":20}},
  {"id":"a3_bossAshheartDragon","enemies":["ashheartDragon"],"weight":1,"pool":"boss","seat":"reach","floorBand":{"min":6,"max":6},"targetBand":{"min":19,"max":20}},
];
