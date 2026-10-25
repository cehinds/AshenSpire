// Explicit Core-only mobility content; no runtime card generation.
export function enemyAdvanceCard(enemyId) {
  return { id: `${enemyId}.advance`, name: 'Advance', class: 'colorless', rarity: 'special',
    cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', type: 'skill', icon: 'motion', keywords: [],
    effects: [{ op: 'moveEngagement', target: 'enemy', bands: -1 }],
    tags: ['camp:physical', 'classification.skill'], textTemplate: 'Close one band.' };
}

// A retreat costs the Advance price plus one (owner rule: an enemy increasing distance
// works like Advance but usually costs 1 more SP). It is only authored for enemies that
// start at reach or beyond; the engine offers it only while the fight is closer than that.
export const RETREAT_SP = 2, RETREAT_WEIGHT = 40;
export function enemyRetreatCard(enemyId) {
  return { id: `${enemyId}.retreat`, name: 'Retreat', class: 'colorless', rarity: 'special',
    cost: RETREAT_SP, staminaCost: RETREAT_SP, manaCost: 0, costRule: 'fixed', type: 'skill', icon: 'motion', keywords: [],
    effects: [{ op: 'moveEngagement', target: 'enemy', bands: 1 }],
    tags: ['camp:physical', 'classification.skill'], textTemplate: 'Fall back one band.' };
}
export const enemyPrefersDistance = range => range === 'reach' || range === 'ranged';

export function authorEnemyRange(row, gear) {
  const items = new Map(gear.map(item => [item.id, item]));
  const main = row.defaultGear?.find(entry => entry.key === 'mainHand');
  const off = row.defaultGear?.find(entry => entry.key === 'offHand');
  const range = row.startingRange || items.get(main?.id)?.range || items.get(off?.id)?.range || 'melee';
  if (!['melee', 'reach', 'ranged'].includes(range)) throw new Error(`Core enemy ${row.id}: invalid starting range '${range}'`);
  const id = `${row.id}.advance`;
  const retreat = `${row.id}.retreat`, retreats = enemyPrefersDistance(range);
  const cardHints = { ...row.cardHints, [id]: { aiWeight: 0, costSource: 'authored', legacyMove: 'advance' } };
  delete cardHints[retreat];
  if (retreats) cardHints[retreat] = { aiWeight: RETREAT_WEIGHT, maxConsecutive: 1, costSource: 'authored', legacyMove: 'retreat' };
  const { rangeRetreatMove, ...rest } = row;
  return { ...rest, startingRange: range, rangeClosingMove: 'advance', rangeRoutePolicy: 'advance', ...(retreats ? { rangeRetreatMove: 'retreat' } : {}),
    defaultDeck: [...row.defaultDeck.filter(card => card !== id && card !== retreat), id, ...(retreats ? [retreat] : [])],
    cardHints };
}
