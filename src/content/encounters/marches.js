// src/content/encounters/marches.js — The Pale Marches encounter pool (SPEC §13.2).
// The seat's numbers are authored at baseTier 2 (content/seats.js); a climb
// at another tier scales them by balance.seatTiers (§13.3). Rows are the act-2
// rows they always were, re-homed: `act: 2` became `seat: 'marches'`.

export const marchesEncounters = [
  { id: 'a2_knight', enemies: ['gildedKnight'], weight: 20, pool: 'normal', seat: 'marches', floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_surgery', enemies: ['courtSurgeon', 'courtMarionette'], weight: 25, pool: 'normal', seat: 'marches', floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_kennel', enemies: ['stitchedHound', 'stitchedHound'], weight: 20, pool: 'normal', seat: 'marches', floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_procession', enemies: ['gildedKnight', 'courtMarionette'], weight: 20, pool: 'normal', seat: 'marches', floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_vault', enemies: ['livingArmor', 'courtSurgeon'], weight: 15, pool: 'normal', seat: 'marches', floorBand: { min: 1, max: 4 }, targetBand: { min: 6, max: 9 } },
  { id: 'a2_eliteDuelist', enemies: ['courtDuelist'], weight: 1, pool: 'elite', seat: 'marches', floorBand: { min: 5, max: 5 }, targetBand: { min: 10, max: 11 } },
  { id: 'a2_bossStitchedKing', enemies: ['stitchedKing'], weight: 1, pool: 'boss', seat: 'marches', floorBand: { min: 6, max: 6 }, targetBand: { min: 11, max: 12 } },
  {"id":"a2_mirrorArchive","enemies":["mirrorScribe"],"weight":15,"pool":"normal","seat":"marches","floorBand":{"min":1,"max":4},"targetBand":{"min":7,"max":10}},
  {"id":"a2_stitchDrain","enemies":["stitchCrab"],"weight":15,"pool":"normal","seat":"marches","floorBand":{"min":2,"max":4},"targetBand":{"min":7,"max":10}},
  {"id":"a2_bossGlassRegent","enemies":["glassRegent"],"weight":1,"pool":"boss","seat":"marches","floorBand":{"min":6,"max":6},"targetBand":{"min":11,"max":12}},
  {"id":"a2_bossMarrowOrganist","enemies":["marrowOrganist"],"weight":1,"pool":"boss","seat":"marches","floorBand":{"min":6,"max":6},"targetBand":{"min":11,"max":12}},
];
