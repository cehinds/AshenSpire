// Defaults for the optional hand-management rules, snapshotted per combat.
//
// THE DEFAULT HAND IS THE DRAW STAT (plan A4, owner ruling 2026-09-24). Each
// turn draws the character's Draw / turn row (derivedStatRules.rules.draw) and
// unplayed cards are discarded at turn end, as in Slay the Spire. The old
// default kept every unplayed card and refilled to capacity: an 11-card deck
// sat ~10 in hand, the Draw row went unread, and draw cards and draw relics
// did nothing. That mode stays selectable (drawMode 'fill', retain on), and
// the Retain keyword still keeps a card whatever these say.
export const handRulesDefaults = {
  retain: false,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'keep',
  reshuffle: true,
  // 'derived' draws the Draw / turn row, opening hand included; 'fill' refills
  // to capacity; 'fixed' draws `turn` below. `starting` is read by fill and
  // fixed, `turn` by fixed only.
  drawMode: 'derived',
  starting: { base: 3, statEnabled: true, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
  turn: { base: 2, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
  capacity: { base: 10, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 1, maximum: 30 },
};

// A run whose derived-stat snapshot predates this ruleset was dealt its Draw
// row for a retained, refilled hand (a base-3 row). Where the profile states no
// choice of its own, such a run keeps the defaults it was played under.
export const derivedHandSinceRuleset = 7;
export const legacyHandRulesDefaults = { retain: true, drawMode: 'fill' };
