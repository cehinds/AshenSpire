// tools/score-studio/customDecks.js — pure helpers for custom decks, custom classes, and JSON list export/import.
//
// Keeps custom decks, custom classes, and rebalanced/generated card & item lists cleanly structured,
// serializable to/from JSON, and safe to persist in Score Studio's draft or save to the repo.

export const STUDIO_BUNDLE_SCHEMA = 'ashenspire.studio.bundle.v1';
export const DEFAULT_CUSTOM_DECKS_PATH = 'content/source/studioDecks.json';

const slugify = (s, fallback = 'custom') => {
  const clean = String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || fallback;
};

/** Create a normalized custom class definition. */
export function createCustomClass({ id, name, description = '', tint = '#7aa2f7', maxHp = 76, deckId = null } = {}, existingIds = new Set()) {
  const label = String(name || '').trim() || 'Custom Class';
  let cid = id ? slugify(id, 'class') : `custom_${slugify(label, 'class')}`;
  let n = 2;
  while (existingIds.has(cid)) cid = `${slugify(id || `custom_${label}`, 'class')}_${n++}`;
  return {
    id: cid,
    name: label,
    description: String(description || ''),
    tint: /^#[0-9a-f]{3,8}$/i.test(String(tint || '')) ? tint : '#7aa2f7',
    maxHp: Math.max(20, Math.min(300, Math.round(Number(maxHp) || 76))),
    deckId: deckId || null,
    _custom: true,
  };
}

/** Create a normalized custom deck definition (can hold card IDs, item keys, or both). */
export function createCustomDeck({ id, name, assignedClassId = null, isActiveDeckList = false, cardIds = [], itemKeys = [], notes = '' } = {}, existingIds = new Set()) {
  const label = String(name || '').trim() || 'Custom Deck';
  let did = id ? slugify(id, 'deck') : `deck_${slugify(label, 'deck')}`;
  let n = 2;
  while (existingIds.has(did)) did = `${slugify(id || `deck_${label}`, 'deck')}_${n++}`;
  return {
    id: did,
    name: label,
    assignedClassId: assignedClassId || null,
    isActiveDeckList: !!isActiveDeckList,
    cardIds: [...new Set((cardIds || []).map(String).filter(Boolean))],
    itemKeys: [...new Set((itemKeys || []).map(String).filter(Boolean))],
    notes: String(notes || ''),
  };
}

/**
 * Serialize cards, items, custom classes, and/or custom decks into a versioned JSON-ready bundle.
 */
export function buildStudioBundle({ name = 'Score Studio Bundle', cards = null, items = null, customClasses = [], customDecks = [] } = {}) {
  return {
    schema: STUDIO_BUNDLE_SCHEMA,
    name: String(name || 'Score Studio Bundle'),
    exportedAt: new Date().toISOString(),
    ...(Array.isArray(cards) ? { cards } : {}),
    ...(Array.isArray(items) ? { items } : {}),
    customClasses: Array.isArray(customClasses) ? customClasses : [],
    customDecks: Array.isArray(customDecks) ? customDecks : [],
  };
}

/**
 * Parse and validate an imported JSON bundle (accepts full studio bundle, raw card array, or raw item array).
 */
export function parseStudioBundle(rawTextOrObj) {
  const data = typeof rawTextOrObj === 'string' ? JSON.parse(rawTextOrObj) : rawTextOrObj;
  if (!data || typeof data !== 'object') throw new Error('Imported JSON must be an object or array.');
  if (Array.isArray(data)) {
    const looksLikeItems = data.some((row) => row && ['weapon', 'armour', 'relic'].includes(row.kind));
    return {
      schema: STUDIO_BUNDLE_SCHEMA,
      name: 'Imported List',
      cards: looksLikeItems ? null : data,
      items: looksLikeItems ? data : null,
      customClasses: [],
      customDecks: [],
    };
  }
  const cards = Array.isArray(data.cards) ? data.cards : null;
  const items = Array.isArray(data.items) ? data.items : null;
  const customClasses = Array.isArray(data.customClasses) ? data.customClasses : [];
  const customDecks = Array.isArray(data.customDecks) ? data.customDecks : [];
  if (!cards && !items && !customClasses.length && !customDecks.length) {
    throw new Error('JSON contains no cards, items, customClasses, or customDecks.');
  }
  return {
    schema: data.schema || STUDIO_BUNDLE_SCHEMA,
    name: String(data.name || 'Imported Bundle'),
    cards,
    items,
    customClasses,
    customDecks,
  };
}

/** Set one deck as the active deck list (or clear active deck list when deckId is null). */
export function setActiveDeckList(decks, deckId) {
  return (decks || []).map((d) => ({ ...d, isActiveDeckList: !!deckId && d.id === deckId }));
}

/** Assign a deck to a class (optionally syncing class.deckId if it is a custom class). */
export function assignDeckToClass(decks, classes, deckId, classId) {
  const nextDecks = (decks || []).map((d) => (d.id === deckId ? { ...d, assignedClassId: classId || null } : d));
  const nextClasses = (classes || []).map((c) => {
    if (c.id === classId) return { ...c, deckId: deckId || null };
    if (c.deckId === deckId) return { ...c, deckId: null };
    return c;
  });
  return { customDecks: nextDecks, customClasses: nextClasses };
}
