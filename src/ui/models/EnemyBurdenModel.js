import { proposalIntentRevealUntil } from '../../model/proposalIntentReveal.js';

// Only the owner's active explicit read may disclose this enemy's private
// piles. Return no card identities or counts to another owner or after expiry.
export function projectEnemyBurdenHand(enemy, { turn, registries, ownerId = 'player', legacySolo = false } = {}) {
  const until = proposalIntentRevealUntil(enemy, ownerId, turn, { legacySolo });
  if (until === null) return null;
  const piles = enemy.burdenPiles || {};
  const cards = new Map();
  for (const instance of piles.hand || []) {
    const registry = registries?.cards;
    const def = registry?.has(instance.cardId) ? registry.get(instance.cardId) : null;
    const key = instance.cardId;
    const prior = cards.get(key);
    if (prior) prior.count += 1;
    else cards.set(key, { name: def?.name || 'Unknown card', type: def?.type || 'Unknown', count: 1 });
  }
  return { visible: true, until, cards: [...cards.values()],
    counts: Object.fromEntries(['draw', 'hand', 'discard', 'exhaust'].map(zone => [zone, piles[zone]?.length || 0])) };
}
