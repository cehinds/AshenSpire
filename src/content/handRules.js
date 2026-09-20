// Defaults for the optional hand-management rules, snapshotted per combat.
export const handRulesDefaults = {
  retain: true,
  promptDiscard: false,
  discardLimit: 10,
  replaceDiscards: false,
  overflow: 'keep',
  reshuffle: true,
  drawMode: 'fill',
  starting: { base: 3, statEnabled: true, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
  turn: { base: 2, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 0, maximum: 10 },
  capacity: { base: 10, statEnabled: false, stat: 'intelligence', baseline: 10, pointsPerCard: 10, minimum: 1, maximum: 30 },
};
