import { deckCopyLimit as configuredCopyLimit, characterSettings } from '../../engine/kernel/gameConfig.js';
import { deckRules } from '../content/deckRules.js';

// Leaf shared by acquisition and the deck editor without importing loadout.
export function configuredDeckCopyLimit(run, cardId) {
  const profile = run?.gameProfile;
  if (profile?.modules?.['deck-training']?.mode !== 'configured') return null;
  const row = profile.content.characters?.find(row => row.id === run.class) || { id: run.class, tags: [] };
  const owned = {};
  for (const card of [...(run.deck || []), ...(run.sideboard || [])]) owned[card.cardId] = (owned[card.cardId] || 0) + 1;
  return configuredCopyLimit(cardId, row, profile.content, characterSettings(profile.modules), profile.modules.gear, owned);
}

export function deckCopyLimit(registries, cardId, settings, classId) {
  if (classId && typeof classId === 'object') {
    const configured = configuredDeckCopyLimit(classId, cardId);
    if (configured !== null) return configured;
    classId = classId.class;
  }
  const def = registries?.cards?.has(cardId) ? registries.cards.get(cardId) : null;
  if (!def || !def.class || def.class === 'colorless') return Infinity;
  if (classId && def.class !== classId) return Infinity;
  const rule = deckRules.singleCopy;
  if (!rule.types.includes(def.type) && !(def.tags || []).some((tag) => rule.tags.includes(tag))) return Infinity;
  const limit = settings?.classSpellPowerCopies ?? deckRules.defaults.classSpellPowerCopies;
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`classSpellPowerCopies must be a whole number of at least 1 (got ${JSON.stringify(limit)})`);
  return limit;
}
