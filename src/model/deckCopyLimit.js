import { deckRules } from '../content/deckRules.js';

// Leaf shared by acquisition and the deck editor without importing loadout.
export function deckCopyLimit(registries, cardId, settings, classId) {
  const def = registries?.cards?.has(cardId) ? registries.cards.get(cardId) : null;
  if (!def || !def.class || def.class === 'colorless') return Infinity;
  if (classId && def.class !== classId) return Infinity;
  const rule = deckRules.singleCopy;
  if (!rule.types.includes(def.type) && !(def.tags || []).some((tag) => rule.tags.includes(tag))) return Infinity;
  const limit = settings?.classSpellPowerCopies ?? deckRules.defaults.classSpellPowerCopies;
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`classSpellPowerCopies must be a whole number of at least 1 (got ${JSON.stringify(limit)})`);
  return limit;
}
