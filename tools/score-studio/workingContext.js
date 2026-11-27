// One active card, one active item and the designer's place in the library (SS-002).
// Headless helpers: the composition root (studio.js) owns the DOM and wires these in.

// View state only, kept apart from the draft, snapshots and Studio bundles.
export const WORKING_CONTEXT_KEY = 'ashenspire:scoreStudioWorkingContext:v1';
export const GALLERIES = ['cards', 'items'];

const FIELDS = { cards: 'selectedCardId', items: 'selectedItemKey' };
const EXISTS = {
  cards: (state, id) => (state.cards || []).some(card => card.id === id),
  items: (state, key) => (state.items || []).some(item => item.key === key),
};

/** The one writer of state.selectedCardId and state.selectedItemKey. An id that no
 * longer exists becomes null (the empty state), never the first card or item.
 * onChange runs once per real change, so open edit bursts end before the next edit. */
export function createActiveEntities({ state, onChange } = {}) {
  const committed = { cards: undefined, items: undefined };
  function set(kind, id) {
    if (!FIELDS[kind]) throw new Error(`Unknown entity kind '${kind}'`);
    const next = id !== null && id !== undefined && EXISTS[kind](state, id) ? id : null;
    const changed = next !== committed[kind];
    state[FIELDS[kind]] = next;
    committed[kind] = next;
    if (changed) onChange?.(kind, next);
    return { id: next, changed };
  }
  // Content changes (undo, revert, import, removal) call this: a still-valid entity
  // is kept, a removed one clears to the empty state.
  const reconcile = () => GALLERIES.map(kind => set(kind, state[FIELDS[kind]]));
  return { set, reconcile, get: kind => state[FIELDS[kind]] ?? null };
}

/** Delete selects the next entity in displayed order, else the one before it. A
 * removed entity hidden by filters falls back to the full list order. */
export function nextInDisplayedOrder(displayedIds, removedId, fullOrder = displayedIds) {
  const list = (displayedIds || []).includes(removedId) ? displayedIds : (fullOrder || []);
  const at = list.indexOf(removedId);
  if (at < 0) return null;
  return list[at + 1] ?? list[at - 1] ?? null;
}

/** One undo step per typing burst. Every burst registers here so a change of the
 * active entity can end them all: one Undo never spans two cards. */
export function createEditBursts({ pushHistory, delayMs = 1000, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const open = new Set();
  function create() {
    let timer = null;
    const burst = {
      begin() {
        if (!open.has(burst)) { pushHistory?.(); open.add(burst); }
        clearTimer(timer);
        timer = setTimer(() => open.delete(burst), delayMs);
      },
      end() { open.delete(burst); clearTimer(timer); },
      isOpen: () => open.has(burst),
    };
    return burst;
  }
  return { create, endAll: () => { for (const burst of [...open]) burst.end(); }, openCount: () => open.size };
}

export function readWorkingContext(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(WORKING_CONTEXT_KEY) || 'null');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null;
  } catch { return null; }
}

export function writeWorkingContext(storage, { gallery, cardId, itemKey }) {
  try { storage?.setItem(WORKING_CONTEXT_KEY, JSON.stringify({ gallery, cardId: cardId ?? null, itemKey: itemKey ?? null })); } catch { /* Optional persistence. */ }
}

/** Reload restore: a stored id that is gone falls back to the existing default. */
export function resolveWorkingContext(saved, state, defaults = {}) {
  const pick = (kind, stored, fallback) => {
    if (stored !== null && stored !== undefined && EXISTS[kind](state, stored)) return stored;
    return fallback !== null && fallback !== undefined && EXISTS[kind](state, fallback) ? fallback : null;
  };
  return {
    gallery: GALLERIES.includes(saved?.gallery) ? saved.gallery : (GALLERIES.includes(defaults.gallery) ? defaults.gallery : 'cards'),
    cardId: pick('cards', saved?.cardId, defaults.cardId),
    itemKey: pick('items', saved?.itemKey, defaults.itemKey),
  };
}

/** Before a gallery re-render: which tile (by stable id) and which part of it had focus. */
export function captureTileFocus(grid, attribute, doc = globalThis.document) {
  const active = doc?.activeElement;
  if (!grid || !active || active === grid || !grid.contains(active)) return null;
  const tile = active.closest?.(`[data-${attribute}]`);
  if (!tile || !grid.contains(tile)) return null;
  const id = tile.getAttribute(`data-${attribute}`);
  const firstClass = active === tile ? '' : String(active.className || '').split(/\s+/).filter(Boolean)[0] || '';
  return { id, part: active === tile ? null : firstClass ? `.${firstClass}` : active.tagName.toLowerCase() };
}

/** After the rebuild: focus the same-id tile (or the same part of it), or a named
 * gallery control when that tile is gone. Never leaves focus on the page body. */
export function restoreTileFocus(grid, attribute, captured, fallback, doc = globalThis.document) {
  if (!captured || !grid) return null;
  if (doc?.activeElement && doc.activeElement !== doc.body && grid.contains(doc.activeElement)) return doc.activeElement;
  const tile = [...grid.querySelectorAll(`[data-${attribute}]`)].find(node => node.getAttribute(`data-${attribute}`) === captured.id);
  const target = (tile && captured.part ? tile.querySelector(captured.part) : null) || (tile && (tile.tabIndex >= 0 || tile.getAttribute('tabindex') !== null) ? tile : null)
    || tile?.querySelector('button, [tabindex]') || fallback || null;
  target?.focus?.({ preventScroll: true });
  return target;
}
