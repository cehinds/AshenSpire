// Headless helpers for the active card and item and the library view state; studio.js wires them in.

export const GalleryKind = Object.freeze({
  Cards: 'cards',
  Items: 'items',
});

export const Galleries = Object.freeze([
  GalleryKind.Cards,
  GalleryKind.Items,
]);

// View state only, kept apart from the draft, snapshots and Studio bundles.
export const WorkingContextKey = 'ashenspire:scoreStudioWorkingContext:v1';

// Each gallery tile's id data attribute, without the data- prefix.
export const TileIdAttribute = Object.freeze({
  [GalleryKind.Cards]: 'card-id',
  [GalleryKind.Items]: 'item-key',
});

// The dataset key for each tile id attribute.
export const TileIdDatasetKey = Object.freeze({
  [GalleryKind.Cards]: 'cardId',
  [GalleryKind.Items]: 'itemKey',
});

// How each gallery's entities are listed and identified.
export const GalleryEntity = Object.freeze({
  [GalleryKind.Cards]: Object.freeze({
    list: state => state.cards || [],
    idOf: card => card.id,
  }),
  [GalleryKind.Items]: Object.freeze({
    list: state => state.items || [],
    idOf: item => item.key,
  }),
});

export const DataAttributePrefix = 'data-';

const selectedField = Object.freeze({
  [GalleryKind.Cards]: 'selectedCardId',
  [GalleryKind.Items]: 'selectedItemKey',
});

const defaultBurstDelayMs = 1000;

const tileFocusSelectors = Object.freeze({
  classPrefix: '.',
  tabindexAttribute: 'tabindex',
  focusableDescendant: 'button, [tabindex]',
  classNameSeparator: /\s+/,
});

// One value per gallery kind, for per-gallery bookkeeping.
export function PerGallery(value)
{
  return Object.fromEntries(Galleries.map(kind => [kind, value]));
}

export function ToGalleryKind(value)
{
  return value === GalleryKind.Items
    ? GalleryKind.Items
    : GalleryKind.Cards;
}

export function FindGalleryEntity(state, kind, id)
{
  const { list, idOf } = GalleryEntity[kind];
  return list(state).find(entity => idOf(entity) === id);
}

function isKnownEntity(state, kind, id)
{
  const { list, idOf } = GalleryEntity[kind];
  const hasId = id !== null && id !== undefined;
  return hasId && list(state).some(entity => idOf(entity) === id);
}

/** The one writer of the active card and item. A missing id gives null, never the first entity.
 * onChange runs once per real change. */
export function CreateActiveEntities({ state, onChange } = {})
{
  const committed = PerGallery(undefined);

  function set(kind, id)
  {
    const field = selectedField[kind];
    if (!field)
    {
      throw new Error(`Unknown entity kind '${kind}'`);
    }
    const next = isKnownEntity(state, kind, id)
      ? id
      : null;
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
    return Galleries.map(kind => set(kind, state[selectedField[kind]]));
  }

  function get(kind)
  {
    return state[selectedField[kind]] ?? null;
  }

  return { set, reconcile, get };
}

/** The next entity in displayed order, else the previous one. A hidden one uses the full order. */
export function NextInDisplayedOrder(displayedIds, removedId, fullOrder = displayedIds)
{
  const isDisplayed = (displayedIds || []).includes(removedId);
  const order = isDisplayed
    ? displayedIds
    : (fullOrder || []);
  const removedIndex = order.indexOf(removedId);
  if (removedIndex < 0)
  {
    return null;
  }
  return order[removedIndex + 1] ?? order[removedIndex - 1] ?? null;
}

/** One undo step per typing burst. endAll lets an entity change end every open burst. */
export function CreateEditBursts({
  pushHistory,
  delayMs = defaultBurstDelayMs,
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

export function ReadWorkingContext(storage)
{
  try
  {
    const raw = storage?.getItem(WorkingContextKey);
    if (!raw)
    {
      return null;
    }
    const saved = JSON.parse(raw);
    const isRecord = saved && typeof saved === 'object' && !Array.isArray(saved);
    return isRecord
      ? saved
      : null;
  }
  catch
  {
    return null;
  }
}

export function WriteWorkingContext(storage, { gallery, cardId, itemKey })
{
  const record = {
    gallery,
    cardId: cardId ?? null,
    itemKey: itemKey ?? null,
  };
  try
  {
    storage?.setItem(WorkingContextKey, JSON.stringify(record));
  }
  catch
  {
    // Storage is optional: blocked or full storage only loses the reload restore.
  }
}

/** Reload restore: a stored id that is gone falls back to the existing default. */
export function ResolveWorkingContext(saved, state, defaults = {})
{
  function pick(kind, stored, fallback)
  {
    return isKnownEntity(state, kind, stored)
      ? stored
      : isKnownEntity(state, kind, fallback)
        ? fallback
        : null;
  }

  const gallery = Galleries.includes(saved?.gallery)
    ? saved.gallery
    : Galleries.includes(defaults.gallery)
      ? defaults.gallery
      : GalleryKind.Cards;
  return {
    gallery,
    cardId: pick(GalleryKind.Cards, saved?.cardId, defaults.cardId),
    itemKey: pick(GalleryKind.Items, saved?.itemKey, defaults.itemKey),
  };
}

function tileIdAttributeName(attribute)
{
  return `${DataAttributePrefix}${attribute}`;
}

function tileIdSelector(attribute)
{
  return `[${tileIdAttributeName(attribute)}]`;
}

// A focused part is found again by its first class, else by its tag.
function focusedPart(element)
{
  const classNames = String(element.className || '').split(tileFocusSelectors.classNameSeparator);
  const firstClass = classNames.filter(Boolean)[0];
  return firstClass
    ? `${tileFocusSelectors.classPrefix}${firstClass}`
    : element.tagName.toLowerCase();
}

/** Before a gallery re-render: which tile (by stable id) and which part of it had focus. */
export function CaptureTileFocus(grid, attribute, doc = globalThis.document)
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
    part: focused === tile
      ? null
      : focusedPart(focused),
  };
}

function isFocusableTile(tile)
{
  return tile.tabIndex >= 0 || tile.getAttribute(tileFocusSelectors.tabindexAttribute) !== null;
}

function focusTarget(tile, part, fallback)
{
  const partNode = tile && part
    ? tile.querySelector(part)
    : null;
  if (partNode)
  {
    return partNode;
  }
  if (tile && isFocusableTile(tile))
  {
    return tile;
  }
  return tile?.querySelector(tileFocusSelectors.focusableDescendant) || fallback || null;
}

/** After the rebuild: focus the same tile or part, else the fallback; never the page body. */
export function RestoreTileFocus(
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
