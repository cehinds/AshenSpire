// src/content/mapconfig.js — per-act map-generation knobs (SPEC §6)
// Consumed by engine/mapgen.js through model/floorplan.js; authored as data
// (SPEC §3.8, Law 1).
//
// EVERY FLOOR IS AN ANCHOR, NOT AN INDEX. Constantine: "make this configurable
// by data driven tooling." An absolute floor number is not configurable — it is
// a constant whose MEANING moves when `floors` changes while the constant does
// not, which is SOP 2's drift clause applied to data. The four anchor kinds are
// a closed set and live in `model/floorplan.js`:
//
//     { at: 'first' }                 floor 1
//     { at: 'last' }                  the last ROLLABLE floor (floors - 1)
//     { at: 'floor',    index: 9 }    absolute; an error if outside 1..floors-1
//     { at: 'fraction', of: 0.64 }    64% of the way up the rollable band
//
// `node tools/mapplan.mjs` prints what each one resolves to at any act length.
// Turn a knob, read the number: that is the whole feature.
//
// WHAT CHANGED AND WHY, so the next reader does not restore the old numbers:
//
//   `9: 'treasure'`  ->  { at: 'fraction', of: 0.64 }
//       Absolute 9 is a cliff. Below 10 floors the rank simply does not exist
//       and the act ships with NO treasure — 4.0 nodes per act to 0.0, 24 of 24
//       seeds, in silence. 0.64 x 14 rounds to 9, so the 15-floor act is
//       unchanged, and a 10-floor act gets its treasure at floor 6.
//
//   `15: 'shrine'`   ->  DELETED, because it never fired.
//       The generator types the top floor as the lone Shrine and puts the Boss
//       above it BEFORE any rule runs, so floor 15 was never rollable. Deleting
//       it changes 0 of 24 seeds at 10, 12 and 15 floors (Freja, measured). It
//       is not a rule we are dropping; it is a rule that was never a rule, and
//       the schema now rejects it — an anchor outside 1..floors-1 is an error,
//       which is exactly the check that would have caught it.
//
//   `noEliteOrShrineBefore: 6`  ->  { at: 'fraction', of: 0.43 }
//       6 gates 36% of a 15-floor act and 56% of a 10-floor one. Same number,
//       different game. The fraction keeps the SHAPE: 36% at 15 floors, 36% at
//       12, 33% at 10.
//
//   `noShrineOn: 14`  ->  { at: 'last' }
//       14 always meant "the last floor a rule can reach". Now it says so.
//
//   `minReachableElites` -> `minElites` (and the same for merchants).
//       The old name promised reachability; mapgen counts the whole graph. It
//       never measured what it claimed. The count is unchanged and honestly
//       named; the reachability number is MEASURED AND PRINTED by
//       tools/mapplan.mjs on every run — deliberately not restated here,
//       because a sample restated in prose drifts (Bjorn caught three homes
//       carrying three different samples within a day).

const ACT_SHAPE = {
  floors: 12,
  columns: 7,
  pathCount: 6,
  // ONE MAP ENTRANCE — Constantine, 2026-08-08, verbatim and unqualified.
  //
  // `entries` and `pathCount` are two knobs and this line is why they had to be.
  // The act is entered from ONE column; six walkers still climb it, so the
  // routes behind that door are unchanged in number. Measured literally, "one
  // path" would have been a corridor — 13 nodes and zero choices in a whole act
  // (Viki, 300 seeds) — which is not what he described.
  //
  // WHAT IT COSTS AND WHAT IT BUYS, both measured at 300 seeds before it shipped:
  //   entrance row      5.92 columns wide  ->  1
  //   nodes per act     46.26              ->  35.88   (22% smaller)
  //   next step hidden  9 of 12 seeds      ->  0 of 12 at 390x844 (tools/mapfit.mjs)
  // The act is smaller. That is the trade he chose and it is the whole reason
  // the shrinkage is stated here rather than discovered later.
  //
  // EVERY SEED IN THE GAME IS A DIFFERENT MAP NOW. That is not a side effect of
  // this line, it IS this line: the walkers' first roll moved, so every graph
  // downstream of it moved. No save is invalidated (graphs are stored per run),
  // but a seed screenshotted before today no longer reproduces.
  entries: 1,
  typeWeights: { monster: 45, event: 22, shrine: 12, elite: 8, merchant: 5 },
  // What a `?` node resolves to. HERE, beside the geometry it belongs to, and
  // no longer in `balance.unknownNode` — a flat global could not differ per act
  // while the map it describes is per act, and nothing said so (Freja).
  unknownWeights: { event: 55, fight: 25, shrine: 12, treasure: 8 },
  floorRules: {
    fixed: [
      { at: 'first', type: 'monster' },
      { at: 'fraction', of: 0.64, type: 'treasure' },
    ],
    noEliteOrShrineBefore: { at: 'fraction', of: 0.43 },
    noShrineOn: { at: 'last' },
    minElites: 2,
    minMerchants: 1,
  },
};

// ---------------------------------------------------------------------------
// THE DEBUG RUN SHAPE — Constantine, 2026-08-08, verbatim:
//
//   "need to do a full run, but I only have the patience for 30 min runs.
//    perhaps add an advanced debug feature to limit the amount of max columns,
//    rows, and or columns with percent chance of certain nodes being more
//    likely"
//
// Three knobs, and the entry below is the ONLY thing this feature adds to
// content. Everything else about it is DERIVED (Law 0 clause 1):
//
//   floors cap    max = whatever THIS act authors above; min = the shortest act
//                 this act's own floorRules can describe, found by ASKING
//                 resolveFloorPlan (model/floorplan.js `minViableFloors`). Edit
//                 the anchors above and the slider's low end moves on its own.
//   columns cap   max = authored; min = the one number below, because "a
//                 corridor is not a map" is a design call and not arithmetic.
//   type weights  ONE SLIDER PER KEY OF `typeWeights` ABOVE. The Custom Climb
//                 screen reads that object and builds its controls from it, so
//                 adding a node type to the act adds a knob with zero UI edits.
//                 That is this feature's Law 0 falsifier and it is testable.
//
// A CAP, not a setting: the effective value is min(authored, cap), so a cap
// above the authored number does nothing — and the readout SAYS SO rather than
// letting it look like it did something (Law 0 clause 5).
export const MAP_SHAPE_LIMITS = Object.freeze({
  // Two columns is the floor because ONE column is a corridor: every walker
  // lands on the same node, the act has zero choices, and the shape is
  // identical every seed (Viki measured exactly this at pathCount 1 — 13 nodes,
  // no decisions, 300 seeds). A short run is the ask; a run with no map is not.
  minColumns: 2,
  // The largest weight a knob may set. Weights are RELATIVE — the odds a type
  // is rolled are its weight over the total — so this number is a slider end,
  // not a percentage. The screen prints the derived share beside each one.
  maxWeight: 100,
});

// All three acts share the SPEC §6 shape; per-act difficulty lives in the
// encounter pools, not the map geometry. Distinct objects so future acts can
// diverge without surprises — and now they genuinely can, because the anchors
// mean the same thing at any `floors` an act picks.
export const mapConfigs = {
  1: { ...ACT_SHAPE },
  2: { ...ACT_SHAPE },
  3: { ...ACT_SHAPE },
};
