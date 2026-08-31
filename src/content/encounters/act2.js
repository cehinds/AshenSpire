// src/content/encounters/act2.js — Act II encounter pools (The Stitched Court)

export const act2Encounters = [
  { id: 'a2_knight', enemies: ['gildedKnight'], weight: 20, pool: 'normal', act: 2, floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_surgery', enemies: ['courtSurgeon', 'courtMarionette'], weight: 25, pool: 'normal', act: 2, floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_kennel', enemies: ['stitchedHound', 'stitchedHound'], weight: 20, pool: 'normal', act: 2, floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_procession', enemies: ['gildedKnight', 'courtMarionette'], weight: 20, pool: 'normal', act: 2, floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_vault', enemies: ['livingArmor', 'courtSurgeon'], weight: 15, pool: 'normal', act: 2, floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_eliteDuelist', enemies: ['courtDuelist'], weight: 1, pool: 'elite', act: 2, floorBand: { min: 5, max: 5 }, targetBand: { min: 10, max: 11 } },
  { id: 'a2_bossStitchedKing', enemies: ['stitchedKing'], weight: 1, pool: 'boss', act: 2, floorBand: { min: 6, max: 6 }, targetBand: { min: 11, max: 12 } },
];
