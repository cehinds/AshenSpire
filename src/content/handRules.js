// Defaults for the optional hand-management rules, snapshotted per combat.
//
// HOW MANY cards — the opening hand, the per-turn draw, the hand size — are
// not here since ruleset 7: they are the `openingHand`, `draw` and `handSize`
// rows of the derived-stat table (content/derivedStats.js), edited and priced
// like every other stat. What stays is how a hand BEHAVES, which no attribute
// decides.
//
// THE SOLO DEFAULT (FINISH D27, decided 2026-09-27 under the owner's
// delegation; SPEC §4.1):
// retain the hand; draw the Draw stat each turn, up to capacity. Fill mode
// (retain-and-fill) and `retain: false` (discard at turn end) stay selectable.
export const handRulesDefaults = {
  retain: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'discard',
  reshuffle: true,
  drawMode: 'fixed',
};
