// src/content/encounters/act1.js — Act 1 encounter pools + the M1 gauntlet

export const act1Encounters = [
  { id: 'loneSoldier', enemies: ['wanderingSoldier'], weight: 20, pool: 'normal' },
  { id: 'patrol', enemies: ['wanderingSoldier', 'blightHound'], weight: 25, pool: 'normal' },
  { id: 'packHunt', enemies: ['blightHound', 'blightHound', 'graveWisp'], weight: 25, pool: 'normal' },
  { id: 'twinPatrol', enemies: ['wanderingSoldier', 'wanderingSoldier'], weight: 15, pool: 'normal' },
  { id: 'bruiser', enemies: ['huskBrute', 'graveWisp'], weight: 15, pool: 'normal' },
  { id: 'eliteWyrm', enemies: ['wyrmAspirant'], weight: 1, pool: 'elite' },
  { id: 'bossOmen', enemies: ['fellWarden'], weight: 1, pool: 'boss' },
];

// M1 acceptance gauntlet (SPEC §9 M1): 2 monsters → elite → boss.
export const M1_GAUNTLET = ['patrol', 'packHunt', 'eliteWyrm', 'bossOmen'];
