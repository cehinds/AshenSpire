// src/content/encounters/act1.js — Act 1 encounter pools

export const act1Encounters = [
  { id: 'loneSoldier', enemies: ['wanderingSoldier'], weight: 20, pool: 'normal', act: 1, floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'patrol', enemies: ['wanderingSoldier', 'blightHound'], weight: 25, pool: 'normal', act: 1, floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'packHunt', enemies: ['blightHound', 'blightHound', 'graveWisp'], weight: 25, pool: 'normal', act: 1, floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'twinPatrol', enemies: ['wanderingSoldier', 'wanderingSoldier'], weight: 15, pool: 'normal', act: 1, floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'bruiser', enemies: ['huskBrute', 'graveWisp'], weight: 15, pool: 'normal', act: 1, floorBand: { min: 1, max: 4 }, targetBand: { min: 1, max: 4 } },
  { id: 'eliteWyrm', enemies: ['wyrmAspirant'], weight: 1, pool: 'elite', act: 1, floorBand: { min: 5, max: 5 }, targetBand: { min: 4, max: 6 } },
  { id: 'bossOmen', enemies: ['fellWarden'], weight: 1, pool: 'boss', act: 1, floorBand: { min: 6, max: 6 }, targetBand: { min: 5, max: 7 } },
];

// (`M1_GAUNTLET = ['patrol','packHunt','eliteWyrm','bossOmen']` — the M1
// acceptance walk, SPEC §9 M1 — stood here and in the content barrel with no
// reader anywhere in the tree, found by tools/closedsets.mjs. Deleted: the map
// flow has been the real thing since M2, the headless bot test runs off
// `balance.gauntlet`, and four ids nothing resolves are four ids that rot when
// an encounter is renamed. SPEC §9 M1's prose is the record of that acceptance.)
