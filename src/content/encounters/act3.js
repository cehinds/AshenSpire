// src/content/encounters/act3.js — Act III encounter pools (The Ashen Crown)

export const act3Encounters = [
  { id: 'a3_revenant', enemies: ['ashRevenant'], weight: 20, pool: 'normal', act: 3 },
  { id: 'a3_pilgrims', enemies: ['emberStarvedPilgrim', 'emberStarvedPilgrim'], weight: 20, pool: 'normal', act: 3 },
  { id: 'a3_shades', enemies: ['valkyrieShade', 'emberStarvedPilgrim'], weight: 25, pool: 'normal', act: 3 },
  { id: 'a3_colossus', enemies: ['charredColossus'], weight: 15, pool: 'normal', act: 3 },
  { id: 'a3_ashChoir', enemies: ['ashRevenant', 'valkyrieShade'], weight: 20, pool: 'normal', act: 3 },
  { id: 'a3_eliteWyrmLord', enemies: ['wyrmLord'], weight: 1, pool: 'elite', act: 3 },
  { id: 'a3_bossRotValkyrie', enemies: ['blightedValkyrie'], weight: 1, pool: 'boss', act: 3 },
];
