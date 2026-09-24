// Defaults for the optional hand-management rules, snapshotted per combat.
export const handRulesDefaults = {
  retain: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'discard',
  reshuffle: true,
  drawMode: 'fixed',
  starting: { base: 4, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 2, minimum: 3, maximum: 15 },
  turn: { base: 2, statEnabled: true, stat: 'intelligence', baseline: 4, pointsPerCard: 5, minimum: 2, maximum: 10 },
  capacity: { base: 7, statEnabled: true, stat: 'intelligence', baseline: 1, pointsPerCard: 5, minimum: 1, maximum: 30 },
};
