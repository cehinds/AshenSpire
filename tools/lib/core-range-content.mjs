// Explicit Core-only mobility content; no runtime card generation.
export function enemyAdvanceCard(enemyId) {
  return { id: `${enemyId}.advance`, name: 'Advance', class: 'colorless', rarity: 'special',
    cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', type: 'skill', icon: '◇', keywords: [],
    effects: [{ op: 'moveEngagement', target: 'enemy', bands: -1 }],
    tags: ['camp:physical', 'classification.skill'], textTemplate: 'Close one band.' };
}

export function authorEnemyRange(row, gear) {
  const items = new Map(gear.map(item => [item.id, item]));
  const main = row.defaultGear?.find(entry => entry.key === 'mainHand');
  const off = row.defaultGear?.find(entry => entry.key === 'offHand');
  const range = row.startingRange || items.get(main?.id)?.range || items.get(off?.id)?.range || 'melee';
  if (!['melee', 'reach', 'ranged'].includes(range)) throw new Error(`Core enemy ${row.id}: invalid starting range '${range}'`);
  const id = `${row.id}.advance`;
  return { ...row, startingRange: range, rangeClosingMove: 'advance', rangeRoutePolicy: 'advance',
    defaultDeck: [...row.defaultDeck.filter(card => card !== id), id],
    cardHints: { ...row.cardHints, [id]: { aiWeight: 0, costSource: 'authored', legacyMove: 'advance' } } };
}
