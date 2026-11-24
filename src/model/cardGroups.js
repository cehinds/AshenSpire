// Group equivalent rendered versions while retaining the original card references.
import { OwnCardRank } from './cardRank.js';
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
export function cardVariantKey(card) {
  const { instanceId, equipmentAttackSlotId, ...variant } = card;
  variant.upgraded = !!variant.upgraded;
  variant.rank = OwnCardRank(variant); // 0 unranked: a Rank 1 copy is its own variant (owner, 2026-11-23)
  if (!variant.mods?.length) delete variant.mods;
  return JSON.stringify(stable(variant));
}
export function groupCardVariants(cards) {
  const groups = new Map();
  for (const card of cards || []) {
    const key = cardVariantKey(card), group = groups.get(key);
    if (group) { group.count += 1; group.cards.push(card); }
    else groups.set(key, { key, card, count: 1, cards: [card] });
  }
  return [...groups.values()];
}
