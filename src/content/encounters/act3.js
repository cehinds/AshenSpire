// src/content/encounters/act3.js — Act III encounter pools (The Ashen Crown)

export const act3Encounters = [
  { id: 'a3_revenant', enemies: ['ashRevenant'], weight: 20, pool: 'normal', act: 3, floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 16 } },
  { id: 'a3_pilgrims', enemies: ['emberStarvedPilgrim', 'emberStarvedPilgrim'], weight: 20, pool: 'normal', act: 3, floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 16 } },
  { id: 'a3_shades', enemies: ['valkyrieShade', 'emberStarvedPilgrim'], weight: 25, pool: 'normal', act: 3, floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 17 } },
  { id: 'a3_colossus', enemies: ['charredColossus'], weight: 15, pool: 'normal', act: 3, floorBand: { min: 1, max: 4 }, targetBand: { min: 14, max: 18 } },
  { id: 'a3_ashChoir', enemies: ['ashRevenant', 'valkyrieShade'], weight: 20, pool: 'normal', act: 3, floorBand: { min: 1, max: 4 }, targetBand: { min: 13, max: 17 } },
  { id: 'a3_eliteWyrmLord', enemies: ['wyrmLord'], weight: 1, pool: 'elite', act: 3, floorBand: { min: 5, max: 5 }, targetBand: { min: 18, max: 19 } },
  { id: 'a3_bossRotValkyrie', enemies: ['blightedValkyrie'], weight: 1, pool: 'boss', act: 3, floorBand: { min: 6, max: 6 }, targetBand: { min: 19, max: 20 } },
];
