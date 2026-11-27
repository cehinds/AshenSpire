// Headless helpers for the active card and item and the library view state; studio.js wires them in.

export const GalleryKind = Object.freeze({
  Cards: 'cards',
  Items: 'items',
});
export const GALLERIES = Object.freeze([GalleryKind.Cards, GalleryKind.Items]);

// View state only, kept apart from the draft, snapshots and Studio bundles.
export const WORKING_CONTEXT_KEY = 'ashenspire:scoreStudioWorkingContext:v1';

// Each gallery tile's id data attribute, without the data- prefix.
export const TileIdAttribute = Object.freeze({
  [GalleryKind.Cards]: 'card-id',
  [GalleryKind.Items]: 'item-key',
});

const SelectedField = Object.freeze({
  [GalleryKind.Cards]: 'selectedCardId',
  [GalleryKind.Items]: 'selectedItemKey',
});
const EntityExists = Object.freeze({
  [GalleryKind.Cards]: (state, id) => (state.cards || []).some(card => card.id === id),
  [GalleryKind.Items]: (state, key) => (state.items || []).some(item => item.key === key),
});

const DEFAULT_BURST_DELAY_MS = 1000;
const DATA_ATTRIBUTE_PREFIX = 'data-';
const CLASS_SELECTOR_PREFIX = '.';
const TABINDEX_ATTRIBUTE = 'tabindex';
const FOCUSABLE_DESCENDANT_SELECTOR = 'button, [tabindex]';
const CLASS_NAME_SEPARATOR = /\s+/;

function isKnownEntity(state, kind, id)
{
  return id !== null && id !== undefined && EntityExists[kind](state, id);
}

/** The one writer of the active card and item. A missing id gives null, never the first entity.
 * onChange runs once per real change. */
export function createActiveEntities({ state, onChange } = {})
{
  const committed = { [GalleryKind.Cards]: undefined, [GalleryKind.Items]: undefined };
  function set(kind, id)
  {
    const field = SelectedField[kind];
    if (!field)
    {
      throw new Error(`Unknown entity kind '${kind}'`);
    }
    const next = isKnownEntity(state, kind, id) ? id : null;
    const changed = next !== committed[kind];
    state[field] = next;
    committed[kind] = next;
    if (changed)
    {
      onChange?.(kind, next);
    }
    return { id: next, changed };
  }
  // After a content change: keep a still-valid entity, clear a removed one.
  function reconcile()
  {
    return GALLERIES.map(kind => set(kind, state[SelectedField[kind]]));
  }
  function get(kind)
  {
    return state[SelectedField[kind]] ?? null;
  }
  return { set, reconcile, get };
}

/** The next entity in displayed order, else the previous one. A hidden one uses the full order. */
export function nextInDisplayedOrder(displayedIds, removedId, fullOrder = displayedIds)
{
  const isDisplayed = (displayedIds || []).includes(removedId);
  const order = isDisplayed ? displayedIds : (fullOrder || []);
  const removedIndex = order.indexOf(removedId);
  if (removedIndex < 0)
  {
    return null;
  }
  return order[removedIndex + 1] ?? order[removedIndex - 1] ?? null;
}

/** One undo step per typing burst. endAll lets an entity change end every open burst. */
export function createEditBursts({
  pushHistory,
  delayMs = DEFAULT_BURST_DELAY_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {})
{
  const openBursts = new Set();
  function create()
  {
    let timer = null;
    const burst = {
      begin()
      {
        if (!openBursts.has(burst))
        {
          pushHistory?.();
          openBursts.add(burst);
        }
        clearTimer(timer);
        timer = setTimer(() => openBursts.delete(burst), delayMs);
      },
      end()
      {
        openBursts.delete(burst);
        clearTimer(timer);
      },
      isOpen: () => openBursts.has(burst),
    };
    return burst;
  }
  function endAll()
  {
    for (const burst of [...openBursts])
    {
      burst.end();
    }
  }
  function openCount()
  {
    return openBursts.size;
  }
  return { create, endAll, openCount };
}

export function readWorkingContext(storage)
{
  try
  {
    const raw = storage?.getItem(WORKING_CONTEXT_KEY);
    if (!raw)
    {
      return null;
    }
    const saved = JSON.parse(raw);
    const isRecord = saved && typeof saved === 'object' && !Array.isArray(saved);
    return isRecord ? saved : null;
  }
  catch
  {
    return null;
  }
}

export function writeWorkingContext(storage, { gallery, cardId, itemKey })
{
  const record = { gallery, cardId: cardId ?? null, itemKey: itemKey ?? null };
  try
  {
    storage?.setItem(WORKING_CONTEXT_KEY, JSON.stringify(record));
  }
  catch
  {
    // Storage is optional: blocked or full storage only loses the reload restore.
  }
}

/** Reload restore: a stored id that is gone falls back to the existing default. */
export function resolveWorkingContext(saved, state, defaults = {})
{
  function pick(kind, stored, fallback)
  {
    if (isKnownEntity(state, kind, stored))
    {
      return stored;
    }
    return isKnownEntity(state, kind, fallback) ? fallback : null;
  }
  const fallbackGallery = GALLERIES.includes(defaults.gallery) ? defaults.gallery : GalleryKind.Cards;
  return {
    gallery: GALLERIES.includes(saved?.gallery) ? saved.gallery : fallbackGallery,
    cardId: pick(GalleryKind.Cards, saved?.cardId, defaults.cardId),
    itemKey: pick(GalleryKind.Items, saved?.itemKey, defaults.itemKey),
  };
}

function tileIdAttributeName(attribute)
{
  return `${DATA_ATTRIBUTE_PREFIX}${attribute}`;
}

function tileIdSelector(attribute)
{
  return `[${tileIdAttributeName(attribute)}]`;
}

// A focused part is found again by its first class, else by its tag.
function focusedPart(element)
{
  const firstClass = String(element.className || '').split(CLASS_NAME_SEPARATOR).filter(Boolean)[0];
  return firstClass ? `${CLASS_SELECTOR_PREFIX}${firstClass}` : element.tagName.toLowerCase();
}

/** Before a gallery re-render: which tile (by stable id) and which part of it had focus. */
export function captureTileFocus(grid, attribute, doc = globalThis.document)
{
  const focused = doc?.activeElement;
  if (!grid || !focused || focused === grid || !grid.contains(focused))
  {
    return null;
  }
  const tile = focused.closest?.(tileIdSelector(attribute));
  if (!tile || !grid.contains(tile))
  {
    return null;
  }
  return {
    id: tile.getAttribute(tileIdAttributeName(attribute)),
    part: focused === tile ? null : focusedPart(focused),
  };
}

function isFocusableTile(tile)
{
  return tile.tabIndex >= 0 || tile.getAttribute(TABINDEX_ATTRIBUTE) !== null;
}

function focusTarget(tile, part, fallback)
{
  const partNode = tile && part ? tile.querySelector(part) : null;
  if (partNode)
  {
    return partNode;
  }
  if (tile && isFocusableTile(tile))
  {
    return tile;
  }
  return tile?.querySelector(FOCUSABLE_DESCENDANT_SELECTOR) || fallback || null;
}

/** After the rebuild: focus the same tile or part, else the fallback; never the page body. */
export function restoreTileFocus(
  grid,
  attribute,
  captured,
  fallback,
  doc = globalThis.document,
)
{
  if (!captured || !grid)
  {
    return null;
  }
  const focused = doc?.activeElement;
  if (focused && focused !== doc.body && grid.contains(focused))
  {
    return focused;
  }
  const idAttribute = tileIdAttributeName(attribute);
  const tiles = [...grid.querySelectorAll(tileIdSelector(attribute))];
  const tile = tiles.find(node => node.getAttribute(idAttribute) === captured.id);
  const target = focusTarget(tile, captured.part, fallback);
  target?.focus?.({ preventScroll: true });
  return target;
}
