import { createRng } from '../engine/rng.js';
import { rarityUnlockedAt, skillLevel } from './skills.js';

/** Pure reward projection. Only a successful read advances bookReadRevision.
 * Four fixed draws isolate each read from UI previews and all other RNG streams
 * (the last two are spare, so a read's card roll never moves).
 */
export function classBookBonuses(registries, run, def) {
  if (!def.learnClass) return { card: null };
  const rng = createRng((run.seed ^ 0x426f6f6b) >>> 0, { cardRewards: (run.bookReadRevision || 0) * 4 });
  const cardRoll = rng.float('cardRewards') * 100;
  const cardPick = rng.float('cardRewards');
  const rarities = new Set(rarityUnlockedAt(registries, Math.max(1, skillLevel(run, def.skill))));
  const pool = registries.classes.get(def.learnClass).cardPool.filter((id) => rarities.has(registries.cards.get(id)?.rarity));
  const cardId = cardRoll < (def.combatCardChance || 0) && pool.length ? pool[Math.floor(cardPick * pool.length)] : null;
  return {
    card: cardId ? { kind: 'card', id: cardId, name: registries.cards.get(cardId).name } : null,
  };
}
