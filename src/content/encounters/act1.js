// src/content/encounters/act1.js — Act 1 encounter pools + the M1 gauntlet

export const act1Encounters = [
  { id: 'loneSoldier', enemies: ['wanderingSoldier'], weight: 20, pool: 'normal' },
  { id: 'patrol', enemies: ['wanderingSoldier', 'rotHound'], weight: 25, pool: 'normal' },
  { id: 'packHunt', enemies: ['rotHound', 'rotHound', 'graveWisp'], weight: 25, pool: 'normal' },
  { id: 'twinPatrol', enemies: ['wanderingSoldier', 'wanderingSoldier'], weight: 15, pool: 'normal' },
  { id: 'bruiser', enemies: ['demiBrute', 'graveWisp'], weight: 15, pool: 'normal' },
  { id: 'eliteCrucible', enemies: ['crucibleAspirant'], weight: 1, pool: 'elite' },
  { id: 'bossOmen', enemies: ['watchfulOmen'], weight: 1, pool: 'boss' },
];

// M1 acceptance gauntlet (SPEC §9 M1): 2 monsters → elite → boss.
export const M1_GAUNTLET = ['patrol', 'packHunt', 'eliteCrucible', 'bossOmen'];
