// src/content/encounters/act2.js — Act II encounter pools (The Grafted Court)

export const act2Encounters = [
  { id: 'a2_knight', enemies: ['gildedKnight'], weight: 20, pool: 'normal', act: 2 },
  { id: 'a2_surgery', enemies: ['courtSurgeon', 'courtMarionette'], weight: 25, pool: 'normal', act: 2 },
  { id: 'a2_kennel', enemies: ['graftedHound', 'graftedHound'], weight: 20, pool: 'normal', act: 2 },
  { id: 'a2_procession', enemies: ['gildedKnight', 'courtMarionette'], weight: 20, pool: 'normal', act: 2 },
  { id: 'a2_vault', enemies: ['livingArmor', 'courtSurgeon'], weight: 15, pool: 'normal', act: 2 },
  { id: 'a2_eliteDuelist', enemies: ['courtDuelist'], weight: 1, pool: 'elite', act: 2 },
  { id: 'a2_bossGraftedKing', enemies: ['graftedKing'], weight: 1, pool: 'boss', act: 2 },
];
