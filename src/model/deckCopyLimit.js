import { deckCopyLimit as configuredCopyLimit, characterSettings, characterTags } from '../../engine/kernel/gameConfig.js';
import { deckRules } from '../content/deckRules.js';
import { gameContent } from './gameProfile.js';
import { hasCollectedCardPolicy, knownCollectedCardIds } from './collectedCards.js';

/** Display names share the stable saved class tags used by the copy rules. */
export function activeAdeptTraining(run) {
  if (!hasCollectedCardPolicy(run) || run.classUnequipped) return null;
  const row = gameContent(run, 'characters')?.find(row => row.id === run.class);
  const tags = row ? characterTags(row) : [];
  if (tags.includes('training.basic')) return { id: 'training.basic', label: 'Martial Adept', kind: 'Basic' };
  if (tags.includes('training.graduate')) return { id: 'training.graduate', label: 'Magic Adept', kind: 'Cantrip' };
  return null;
}

function eligibleAdeptDefinition(run, cardId) {
  const card = gameContent(run, 'cards')?.find(card => card.id === cardId), adept = activeAdeptTraining(run);
  if (!card || !adept || card.rank > 0 || card.abilityRank > 0 || ['power', 'status', 'curse', 'consumable'].includes(card.type)) return false;
  const tags = card.tags || [];
  if (tags.includes('extractable') || tags.includes('classification.weaponArt')) return false;
  // Exclude every class's special pool, including a foreign special whose
  // starter rarity would otherwise match the generic Basic training rule.
  const pools = gameContent(run, 'cardPools') || {};
  const ownedPools = run.gameProfile.modules['deck-training'].owned?.pools || [];
  const excluded = ownedPools.flatMap(id => [...Object.values(pools[id]?.byTag || {}),
    ...Object.values(pools[id]?.byClass || {}).flatMap(row => Object.values(row))]);
  if (excluded.includes(cardId) || (gameContent(run, 'classes') || []).some(row => row.specialCardId === cardId)) return false;
  const spell = tags.includes('source:spell') || tags.includes('camp:spell');
  return adept.id === 'training.graduate' ? spell && tags.includes('rank.cantrip') : !spell;
}

// Profiles are immutable snapshots. Compile the data-only training catalogue
// once per profile/class; ownership is still checked live for every edit.
const adeptDefinitionsByProfile = new WeakMap();
export function collectedAdeptCardIds(run) {
  if (!activeAdeptTraining(run)) return [];
  const profile = run.gameProfile;
  let classes = adeptDefinitionsByProfile.get(profile);
  if (!classes) { classes = new Map(); adeptDefinitionsByProfile.set(profile, classes); }
  let ids = classes.get(run.class);
  if (!ids) {
    const row = gameContent(run, 'characters').find(row => row.id === run.class);
    const settings = characterSettings(profile.modules);
    ids = (gameContent(run, 'cards') || []).filter(card => eligibleAdeptDefinition(run, card.id)
      && configuredCopyLimit(card.id, row, profile.content, settings, profile.modules.gear, {}) === Infinity).map(card => card.id);
    classes.set(run.class, ids);
  }
  const known = new Set(knownCollectedCardIds(run));
  return ids.filter(id => known.has(id));
}

// The same copy rule serves acquisition and the deck editor.
export function configuredDeckCopyLimit(run, cardId) {
  const profile = run?.gameProfile;
  if (profile?.modules?.['deck-training']?.mode !== 'configured') return null;
  const row = profile.content.characters?.find(row => row.id === run.class) || { id: run.class, tags: [] };
  const owned = {};
  for (const card of [...(run.deck || []), ...(run.sideboard || [])]) owned[card.cardId] = (owned[card.cardId] || 0) + 1;
  if (hasCollectedCardPolicy(run)) return collectedAdeptCardIds(run).includes(cardId) ? Infinity : owned[cardId] || 0;
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
