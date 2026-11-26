// Read-only class views and persisted custom decks share one selector vocabulary.
const BUILTIN_CLASSES = [['reaver', 'Reaver'], ['rogue', 'Rogue'], ['starseer', 'Starseer'], ['herald', 'Herald'], ['colorless', 'Shared']];
const unique = values => [...new Set(values || [])];
const classesFor = state => {
  const rows = BUILTIN_CLASSES.map(([id, name]) => ({ id, name }));
  for (const row of state.customClasses || []) if (!rows.some(existing => existing.id === row.id)) rows.push({ id: row.id, name: row.name || row.id });
  return rows;
};
const itemClass = item => item.class || item.classId || item.assignedClassId || 'colorless';

export function resolveStudioDeck(state, id) {
  const cards = state.cards || [], items = state.items || [];
  let deck;
  if (id === 'all') deck = { id, name: 'All', kind: 'all', group: null, readOnly: true, virtual: true, cardIds: cards.map(card => card.id), itemKeys: items.map(item => item.key) };
  else if (typeof id === 'string' && id.startsWith('class:')) {
    const row = classesFor(state).find(entry => entry.id === id.slice(6));
    if (!row) return null;
    deck = { id, name: row.name, classId: row.id, assignedClassId: row.id, kind: 'class', group: 'Class decks', readOnly: true, virtual: true,
      cardIds: cards.filter(card => (card.class || 'colorless') === row.id).map(card => card.id), itemKeys: items.filter(item => itemClass(item) === row.id).map(item => item.key) };
  } else {
    const row = (state.customDecks || []).find(entry => entry.id === id);
    if (!row) return null;
    const classList = row.id.startsWith('subclass-list.');
    deck = { ...row, kind: classList ? 'class' : 'custom', group: classList ? 'Class decks' : 'Custom decks', readOnly: classList, virtual: false,
      cardIds: [...(row.cardIds || [])], itemKeys: [...(row.itemKeys || [])] };
  }
  const cardIds = unique(deck.cardIds), itemKeys = unique(deck.itemKeys);
  const knownCards = new Set(cards.map(card => card.id)), knownItems = new Set(items.map(item => item.key));
  return { ...deck, cardIds, itemKeys, missingCardIds: cardIds.filter(value => !knownCards.has(value)), missingItemKeys: itemKeys.filter(value => !knownItems.has(value)) };
}

export function deckCatalogOptions(state) {
  const ids = ['all', ...classesFor(state).map(row => `class:${row.id}`), ...(state.customDecks || []).map(row => row.id)];
  return unique(ids).map(id => resolveStudioDeck(state, id)).filter(Boolean).map(deck => ({ id: deck.id, value: deck.id, name: deck.name,
    label: deck.kind === 'all' ? 'All' : `${deck.name} · ${deck.kind === 'class' ? 'Class' : 'Custom'}${deck.isActiveDeckList ? ' ★ Active' : ''}`,
    group: deck.group, kind: deck.kind, readOnly: deck.readOnly, cardCount: deck.cardIds.length, itemCount: deck.itemKeys.length }));
}

/** null is the unfiltered All view; an invalid/deleted ID matches nothing. */
export function filterMembership(state, id, context = 'cards') {
  if (id === 'all') return null;
  const deck = resolveStudioDeck(state, id);
  return new Set(deck ? (context === 'items' ? deck.itemKeys : deck.cardIds) : []);
}
