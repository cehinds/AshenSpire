// Defaults for the optional hand-management rules, snapshotted per combat.
//
// HOW MANY cards — the opening hand, the per-turn draw, the hand size — are
// not here since ruleset 7: they are the `openingHand`, `draw` and `handSize`
// rows of the derived-stat table (content/derivedStats.js), edited and priced
// like every other stat. What stays is how a hand BEHAVES, which no attribute
// decides.
//
// Default (owner, 2026-10-03): shuffle unplayed non-Retain cards into the
// draw pile, keep Retain cards, then draw the full Draw stat up to capacity.
// Missing shuffleHand in an older saved fight keeps its discard behaviour.
export const handRulesDefaults = {
  retain: false,
  shuffleHand: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'discard',
  reshuffle: true,
  drawMode: 'fixed',
};
