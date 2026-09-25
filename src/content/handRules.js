// Defaults for the optional hand-management rules, snapshotted per combat.
export const handRulesDefaults = {
  retain: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'discard',
  reshuffle: true,
  drawMode: 'fixed',
  // THE OPENING HAND IS FOUR TO SIX CARDS (owner, 2026-09-24: "start with
  // 4-6 cards depending on the base (3-5)"): the floor of 4 lifts a base-3
  // class that put nothing in its attribute, the cap of 6 stops a big one.
  // `base` and `stat` here are the
  // fallback for a fight whose class has no row in `startingByClass` below —
  // a headless fixture or a preview with no class; every shipped class has one.
  starting: { base: 4, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 2, minimum: 4, maximum: 6 },
  // PER-CLASS OPENING HAND (owner, 2026-09-24: "Class base 3–5, +1 from
  // stats"). Each row replaces `starting.base` and `starting.stat` for that
  // class; baseline, points per card and the 4–6 limits stay shared, so the
  // opening hand is clamp(base + floor(max(0, primary − 1) / 2), 4, 6): the
  // Standard presets (primary 3) open 4/5/5/6, all 1s opens 4/4/4/5.
  // Resolved into the fight's hand-rules snapshot (handRulesForClass), so a
  // saved fight keeps the hand it was born with.
  startingByClass: {
    reaver: { base: 3, stat: 'strength' },
    rogue: { base: 4, stat: 'dexterity' },
    herald: { base: 4, stat: 'wisdom' },
    starseer: { base: 5, stat: 'intelligence' },
  },
  turn: { base: 2, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 5, minimum: 2, maximum: 10 },
  capacity: { base: 7, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 5, minimum: 1, maximum: 30 },
};
