// src/content/mapconfig.js — per-act map-generation knobs (SPEC §6)
// Consumed by M2's engine/mapgen.js; authored now as data (SPEC §3.8).

const ACT_SHAPE = {
  floors: 15,
  columns: 7,
  pathCount: 6,
  typeWeights: { monster: 45, event: 22, shrine: 12, elite: 8, merchant: 5 },
  floorRules: {
    fixed: { 1: 'monster', 9: 'treasure', 15: 'shrine' },
    noEliteOrShrineBefore: 6,
    noShrineOn: 14,
    minReachableElites: 2,
    minReachableMerchants: 1,
  },
};

// All three acts share the SPEC §6 shape; per-act difficulty lives in the
// encounter pools, not the map geometry. Distinct objects so future acts can
// diverge without surprises.
export const mapConfigs = {
  1: { ...ACT_SHAPE },
  2: { ...ACT_SHAPE },
  3: { ...ACT_SHAPE },
};
