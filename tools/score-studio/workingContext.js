// Headless helpers for the active card and item and the library view state.
// studio.js wires them in.

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

// Options for the card and item select setters.
// A deferred reveal waits for the next gallery render.
export const SelectionOptions = Object.freeze({
  Reveal: Object.freeze({ reveal: true }),
  Deferred: Object.freeze({ render: false }),
  DeferredReveal: Object.freeze({
    render: false,
    reveal: true,
  }),
});

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

function isKnownEntity(
  state,
  kind,
  id,
)
{
  const { list, idOf } = GalleryEntity[kind];
  const hasId = id !== null && id !== undefined;
  return hasId && list(state).some(entity => idOf(entity) === id);
}

function knownIdOrNull(
  state,
  kind,
  id,
)
{
  const isKnown = isKnownEntity(
    state,
    kind,
    id,
  );
  if (!isKnown)
  {
    return null;
  }
  return id;
}

function requireSelectedField(kind)
{
  const field = selectedField[kind];
  if (!field)
  {
    throw new Error(`Unknown entity kind '${kind}'`);
  }
  return field;
}

// One typing burst: the first begin pushes an undo step; a pause or end closes it.
function createBurst(openBursts, timing)
{
  const {
    pushHistory,
    delayMs,
    setTimer,
    clearTimer,
  } = timing;
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

function pickKnownId(
  state,
  kind,
  stored,
  fallback,
)
{
  const storedIsKnown = isKnownEntity(
    state,
    kind,
    stored,
  );
  if (storedIsKnown)
  {
    return stored;
  }
  return knownIdOrNull(
    state,
    kind,
    fallback,
  );
}

function resolveGallery(saved, defaults)
{
  if (Galleries.includes(saved?.gallery))
  {
    return saved.gallery;
  }
  if (Galleries.includes(defaults.gallery))
  {
    return defaults.gallery;
  }
  return GalleryKind.Cards;
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
  const className = String(element.className || '');
  const classNames = className.split(tileFocusSelectors.classNameSeparator);
  const firstClass = classNames.filter(Boolean)[0];
  return firstClass
    ? `${tileFocusSelectors.classPrefix}${firstClass}`
    : element.tagName.toLowerCase();
}

function isFocusableTile(tile)
{
  const hasTabindex = tile.getAttribute(tileFocusSelectors.tabindexAttribute) !== null;
  return tile.tabIndex >= 0 || hasTabindex;
}

function findTile(
  grid,
  attribute,
  id,
)
{
  const idAttribute = tileIdAttributeName(attribute);
  const tiles = [...grid.querySelectorAll(tileIdSelector(attribute))];
  return tiles.find(node => node.getAttribute(idAttribute) === id);
}

function focusTarget(
  tile,
  part,
  fallback,
)
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
  const focusableDescendant = tile?.querySelector(tileFocusSelectors.focusableDescendant);
  return focusableDescendant || fallback || null;
}

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

export function FindGalleryEntity(
  state,
  kind,
  id,
)
{
  const { list, idOf } = GalleryEntity[kind];
  return list(state).find(entity => idOf(entity) === id);
}

/** The one writer of the active card and item. A missing id gives null, never the first entity.
 * onChange runs once per real change. */
export function CreateActiveEntities({ state, onChange } = {})
{
  const committed = PerGallery(undefined);

  function set(kind, id)
  {
    const field = requireSelectedField(kind);
    const next = knownIdOrNull(
      state,
      kind,
      id,
    );
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

  return {
    set,
    reconcile,
    get,
  };
}

/** The next entity in displayed order, else the previous one. A hidden one uses the full order. */
export function NextInDisplayedOrder(
  displayedIds,
  removedId,
  fullOrder = displayedIds,
)
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
  const nextId = order[removedIndex + 1];
  const previousId = order[removedIndex - 1];
  return nextId ?? previousId ?? null;
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
  const timing = {
    pushHistory,
    delayMs,
    setTimer,
    clearTimer,
  };

  function create()
  {
    return createBurst(openBursts, timing);
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

  return {
    create,
    endAll,
    openCount,
  };
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

export function WriteWorkingContext(
  storage,
  {
    gallery,
    cardId,
    itemKey,
  },
)
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
export function ResolveWorkingContext(
  saved,
  state,
  defaults = {},
)
{
  const cardId = pickKnownId(
    state,
    GalleryKind.Cards,
    saved?.cardId,
    defaults.cardId,
  );
  const itemKey = pickKnownId(
    state,
    GalleryKind.Items,
    saved?.itemKey,
    defaults.itemKey,
  );
  return {
    gallery: resolveGallery(saved, defaults),
    cardId,
    itemKey,
  };
}

/** Before a gallery re-render: which tile (by stable id) and which part of it had focus. */
export function CaptureTileFocus(
  grid,
  attribute,
  doc = globalThis.document,
)
{
  const focused = doc?.activeElement;
  const focusInsideGrid = Boolean(grid && focused && focused !== grid && grid.contains(focused));
  if (!focusInsideGrid)
  {
    return null;
  }
  const tile = focused.closest?.(tileIdSelector(attribute));
  if (!tile || !grid.contains(tile))
  {
    return null;
  }
  const part = focused === tile
    ? null
    : focusedPart(focused);
  return {
    id: tile.getAttribute(tileIdAttributeName(attribute)),
    part,
  };
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
  const focusStayedInGrid = focused && focused !== doc.body && grid.contains(focused);
  if (focusStayedInGrid)
  {
    return focused;
  }
  const tile = findTile(
    grid,
    attribute,
    captured.id,
  );
  const target = focusTarget(
    tile,
    captured.part,
    fallback,
  );
  target?.focus?.({ preventScroll: true });
  return target;
}
