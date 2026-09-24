// Defaults for the optional hand-management rules, snapshotted per combat.
//
// HOW MANY cards — the opening hand, the per-turn draw, the hand size — are
// not here since ruleset 7: they are the `openingHand`, `draw` and `handSize`
// rows of the derived-stat table (content/derivedStats.js), edited and priced
// like every other stat. What stays is how a hand BEHAVES, which no attribute
// decides.
export const handRulesDefaults = {
  retain: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'discard',
  reshuffle: true,
  drawMode: 'fixed',
};
