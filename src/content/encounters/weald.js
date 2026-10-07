// src/content/encounters/weald.js — The Hollow Weald encounter pool (SPEC §13.2).
// The seat's numbers are authored at baseTier 1 (content/seats.js); a climb
// at another tier scales them by balance.seatTiers (§13.3). Rows are the act-1
// rows they always were, re-homed: `act: 1` became `seat: 'weald'`.

export const wealdEncounters = [
  { id: 'loneSoldier', enemies: ['wanderingSoldier'], weight: 20, pool: 'normal', seat: 'weald', floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'patrol', enemies: ['wanderingSoldier', 'blightHound'], weight: 25, pool: 'normal', seat: 'weald', floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'packHunt', enemies: ['blightHound', 'blightHound', 'graveWisp'], weight: 25, pool: 'normal', seat: 'weald', floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'twinPatrol', enemies: ['wanderingSoldier', 'wanderingSoldier'], weight: 15, pool: 'normal', seat: 'weald', floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'bruiser', enemies: ['huskBrute', 'graveWisp'], weight: 15, pool: 'normal', seat: 'weald', floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'eliteWyrm', enemies: ['wyrmAspirant'], weight: 1, pool: 'elite', seat: 'weald', floorBand: { min: 5, max: 5 }, targetBand: { min: 4, max: 6 } },
  { id: 'bossOmen', enemies: ['fellWarden'], weight: 1, pool: 'boss', seat: 'weald', floorBand: { min: 6, max: 6 }, targetBand: { min: 5, max: 7 } },
  {"id":"lanternFlight","enemies":["lanternMoth","lanternMoth"],"weight":15,"pool":"normal","seat":"weald","floorBand":{"min":1,"max":3},"targetBand":{"min":2,"max":5}},
  {"id":"briarRefuge","enemies":["briarHermit"],"weight":15,"pool":"normal","seat":"weald","floorBand":{"min":2,"max":4},"targetBand":{"min":2,"max":5}},
  {"id":"chainAmbush","enemies":["chainScavenger"],"weight":15,"pool":"normal","seat":"weald","floorBand":{"min":2,"max":4},"targetBand":{"min":2,"max":5}},
  {"id":"bossBellKeeper","enemies":["bellKeeper"],"weight":1,"pool":"boss","seat":"weald","floorBand":{"min":6,"max":6},"targetBand":{"min":5,"max":7}},
  {"id":"bossThornMatriarch","enemies":["thornMatriarch"],"weight":1,"pool":"boss","seat":"weald","floorBand":{"min":6,"max":6},"targetBand":{"min":5,"max":7}},
];

// (`M1_GAUNTLET = ['patrol','packHunt','eliteWyrm','bossOmen']` — the M1
// acceptance walk, SPEC §9 M1 — stood here and in the content barrel with no
// reader anywhere in the tree, found by tools/closedsets.mjs. Deleted: the map
// flow has been the real thing since M2, the headless bot test runs off
// `balance.gauntlet`, and four ids nothing resolves are four ids that rot when
// an encounter is renamed. SPEC §9 M1's prose is the record of that acceptance.)
