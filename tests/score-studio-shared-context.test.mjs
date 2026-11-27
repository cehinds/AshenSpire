import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/dom.mjs';
import {
  GalleryKind,
  TileIdAttribute,
  WORKING_CONTEXT_KEY,
  createActiveEntities,
  nextInDisplayedOrder,
  createEditBursts,
  readWorkingContext,
  writeWorkingContext,
  resolveWorkingContext,
  captureTileFocus,
  restoreTileFocus,
} from '../tools/score-studio/workingContext.js';

const UNKNOWN_KIND = 'decks';
const CARD_TILE_ATTRIBUTE = TileIdAttribute[GalleryKind.Cards];
const CARD_GRID_ID = 'cards-grid';
const CARD_SEARCH_ID = 'card-search';
const CARD_TILE_CLASS = 'studio-card-tile';
const EDIT_BUTTON_CLASS = 'card-editor-edit-button';

function studioState()
{
  return {
    cards: [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
      { id: 'c', name: 'Gamma' },
    ],
    items: [
      { key: 'weapon:one' },
      { key: 'weapon:two' },
    ],
    selectedCardId: null,
    selectedItemKey: null,
  };
}

// Timers run only when a test calls them, so a burst's pause is under the test's control.
function manualTimers()
{
  const pending = [];
  function setTimer(callback)
  {
    pending.push(callback);
    return pending.length;
  }
  return { pending, setTimer, clearTimer: () => {} };
}

test('one setter per kind writes the active entity and reports each real change once', () =>
{
  const state = studioState();
  const changes = [];
  const active = createActiveEntities({ state, onChange: (kind, id) => changes.push([kind, id]) });
  assert.deepEqual(active.set(GalleryKind.Cards, 'b'), { id: 'b', changed: true });
  assert.deepEqual(active.set(GalleryKind.Cards, 'b'), { id: 'b', changed: false });
  active.set(GalleryKind.Items, 'weapon:two');
  assert.equal(state.selectedCardId, 'b');
  assert.equal(state.selectedItemKey, 'weapon:two');
  assert.deepEqual(changes, [[GalleryKind.Cards, 'b'], [GalleryKind.Items, 'weapon:two']]);
  assert.throws(() => active.set(UNKNOWN_KIND, 'x'), /Unknown entity kind/);
});

test('a removed or unknown entity clears to the empty state, never the first card', () =>
{
  const state = studioState();
  const active = createActiveEntities({ state });
  active.set(GalleryKind.Cards, 'c');
  assert.deepEqual(active.set(GalleryKind.Cards, 'missing'), { id: null, changed: true });
  assert.equal(state.selectedCardId, null, 'an unknown id is not replaced by the first card');
  active.set(GalleryKind.Cards, 'c');
  // Content that drops the active card, then reconcile.
  state.cards = state.cards.filter(card => card.id !== 'c');
  active.reconcile();
  assert.equal(state.selectedCardId, null);
  active.set(GalleryKind.Cards, 'b');
  state.cards = [...state.cards];
  active.reconcile();
  assert.equal(state.selectedCardId, 'b');
});

test('an out-of-band write is reconciled through the setter and still counts as a change', () =>
{
  const state = studioState();
  const changes = [];
  const active = createActiveEntities({ state, onChange: kind => changes.push(kind) });
  active.set(GalleryKind.Cards, 'a');
  state.selectedCardId = 'b';
  active.reconcile();
  assert.equal(state.selectedCardId, 'b');
  assert.deepEqual(changes, [GalleryKind.Cards, GalleryKind.Cards, GalleryKind.Items]);
});

test('Delete selects the next entity in displayed order, else the previous one, else none', () =>
{
  assert.equal(nextInDisplayedOrder(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(nextInDisplayedOrder(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(nextInDisplayedOrder(['b'], 'b'), null);
  // Filtered display order wins over the full list.
  assert.equal(nextInDisplayedOrder(['c', 'a'], 'c', ['a', 'b', 'c']), 'a');
  // A removed card hidden by filters falls back to the full order.
  assert.equal(nextInDisplayedOrder(['a'], 'b', ['a', 'b', 'c']), 'c');
  assert.equal(nextInDisplayedOrder([], 'z', []), null);
});

test('an entity change ends every open edit burst, so one Undo never spans two cards', () =>
{
  const history = [];
  const { setTimer, clearTimer } = manualTimers();
  const bursts = createEditBursts({ pushHistory: () => history.push(history.length), setTimer, clearTimer });
  const nameBurst = bursts.create();
  const costBurst = bursts.create();
  nameBurst.begin();
  nameBurst.begin();
  costBurst.begin();
  assert.equal(history.length, 2, 'one undo step per burst');
  assert.equal(bursts.openCount(), 2);
  bursts.endAll();
  assert.equal(bursts.openCount(), 0);
  nameBurst.begin();
  assert.equal(history.length, 3, 'typing after the entity change records a new undo step');
  nameBurst.end();
  assert.equal(nameBurst.isOpen(), false);
});

test('a burst still closes on its own after the pause', () =>
{
  const history = [];
  const { pending, setTimer, clearTimer } = manualTimers();
  const bursts = createEditBursts({ pushHistory: () => history.push(1), setTimer, clearTimer });
  const burst = bursts.create();
  burst.begin();
  pending.at(-1)();
  burst.begin();
  assert.equal(history.length, 2);
});

test('reload restore keeps view state under its own key and falls back when a stored id is gone', () =>
{
  const stored = new Map();
  const storage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  };
  const savedContext = { gallery: GalleryKind.Items, cardId: 'c', itemKey: 'weapon:two' };
  const defaults = { cardId: 'a', itemKey: 'weapon:one' };
  writeWorkingContext(storage, savedContext);
  assert.deepEqual([...stored.keys()], [WORKING_CONTEXT_KEY]);
  assert.ok(!WORKING_CONTEXT_KEY.includes('Draft'), 'view state is not stored with the draft');
  const saved = readWorkingContext(storage);
  assert.deepEqual(saved, savedContext);
  const state = studioState();
  assert.deepEqual(resolveWorkingContext(saved, state, defaults), savedContext);
  // The stored card was deleted: the existing default returns without error.
  state.cards = state.cards.filter(card => card.id !== 'c');
  assert.deepEqual(
    resolveWorkingContext(saved, state, defaults),
    { gallery: GalleryKind.Items, cardId: 'a', itemKey: 'weapon:two' },
  );
  assert.deepEqual(
    resolveWorkingContext({ gallery: 'weights', cardId: 42 }, state, { cardId: 'a' }),
    { gallery: GalleryKind.Cards, cardId: 'a', itemKey: null },
  );
  stored.set(WORKING_CONTEXT_KEY, '{not json');
  assert.equal(readWorkingContext(storage), null);
  const blockedStorage = {
    getItem: () =>
    {
      throw new Error('blocked');
    },
  };
  assert.equal(readWorkingContext(blockedStorage), null);
  const fullStorage = {
    setItem: () =>
    {
      throw new Error('full');
    },
  };
  assert.doesNotThrow(() => writeWorkingContext(fullStorage, { gallery: GalleryKind.Cards }));
});

function galleryFixture(dom)
{
  const { document: doc } = dom;
  doc.body.innerHTML = `<input id="${CARD_SEARCH_ID}"><div id="${CARD_GRID_ID}"></div>`;
  const grid = doc.getElementById(CARD_GRID_ID);
  function render(ids)
  {
    grid.replaceChildren();
    for (const id of ids)
    {
      const tile = doc.createElement('div');
      tile.className = CARD_TILE_CLASS;
      tile.dataset.cardId = id;
      tile.tabIndex = 0;
      const editButton = doc.createElement('button');
      editButton.className = EDIT_BUTTON_CLASS;
      tile.append(editButton);
      grid.append(tile);
    }
  }
  function tile(id)
  {
    return grid.querySelectorAll(`.${CARD_TILE_CLASS}`).find(node => node.dataset.cardId === id);
  }
  const search = () => doc.getElementById(CARD_SEARCH_ID);
  return { doc, grid, render, tile, search };
}

test('a gallery re-render keeps focus on the tile with the same id', () => withKitDom(dom =>
{
  const { doc, grid, render, tile, search } = galleryFixture(dom);
  render(['a', 'b', 'c']);
  tile('b').focus();
  const captured = captureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  assert.deepEqual(captured, { id: 'b', part: null });
  render(['a', 'b', 'c']);
  assert.notEqual(doc.activeElement, tile('b'), 'the rebuild destroyed the focused tile');
  restoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, tile('b'));
}));

test('focus inside a tile returns to the same part; a removed tile moves focus to a named control', () => withKitDom(dom =>
{
  const { doc, grid, render, tile, search } = galleryFixture(dom);
  const editButtonOf = id => tile(id).querySelector(`.${EDIT_BUTTON_CLASS}`);
  render(['a', 'b']);
  editButtonOf('a').focus();
  let captured = captureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  assert.deepEqual(captured, { id: 'a', part: `.${EDIT_BUTTON_CLASS}` });
  render(['a', 'b']);
  restoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, editButtonOf('a'));
  tile('b').focus();
  captured = captureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  render(['a']);
  restoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, search(), 'focus never drops to the page body');
  // Focus outside the gallery is left alone.
  search().focus();
  assert.equal(captureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc), null);
}));

// Static routing checks on the composition root: studio.js boots the page on import, so these read its source.
function source(name)
{
  return readFileSync(new URL(`../tools/score-studio/${name}`, import.meta.url), 'utf8');
}

function body(src, name)
{
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const nextFunction = src.indexOf('\nfunction ', start + 1);
  const nextAsyncFunction = src.indexOf('\nasync function ', start + 1);
  const ends = [nextFunction, nextAsyncFunction, src.length].filter(index => index > start);
  return src.slice(start, Math.min(...ends));
}

test('every writer of the active card and item goes through the two setters', () =>
{
  const writes = /state\.selected(CardId|ItemKey)\s*=(?!=)/;
  const writerFiles = [
    'studio.js',
    'studioToolsModal.js',
    'subclassCatalog.js',
    'cardSelection.js',
    'deckListPanel.js',
  ];
  for (const file of writerFiles)
  {
    assert.doesNotMatch(source(file), writes, `${file} writes the active entity only through the setters`);
  }
  const studio = source('studio.js');
  assert.equal(studio.match(/state\.artTarget\s*=(?!=)/g)?.length, 1, 'artTarget is set in one place, with activeGallery and the dock context');
  assert.match(body(studio, 'selectStudioCard'), /activeEntities\.set\(GalleryKind\.Cards,/);
  assert.match(body(studio, 'selectStudioItem'), /activeEntities\.set\(GalleryKind\.Items,/);
  for (const name of ['selectStudioCard', 'selectStudioItem'])
  {
    assert.doesNotMatch(body(studio, name), /syncAllViews/, `${name} never rebuilds every view`);
  }
  assert.match(body(studio, 'syncAllViews'), /activeEntities\.reconcile\(\)/, 'content changes reconcile through the setters');
  // The Design picker and target route through the setter and the gallery tabs.
  assert.match(studio, /art-preview-card-select'\)\.addEventListener\('change'[\s\S]{0,200}selectStudio(Item|Card)\(event\.target\.value/);
  assert.match(studio, /data-art-target[\s\S]{0,300}showGallery\(kind\)/);
  assert.match(source('studioToolsModal.js'), /ctx\.selectCard\(state\.cards\[0\]\.id/);
  assert.match(source('studioToolsModal.js'), /ctx\.selectItem\(state\.items\[0\]\.key/);
  assert.match(source('subclassCatalog.js'), /ctx\.selectCard\(list\.cardIds\[0\]/);
});

test('no silent first-card fallback in the inspectors, the preview, undo or revert', () =>
{
  const studio = source('studio.js');
  const viewFunctions = [
    'renderInspector',
    'renderItemInspector',
    'renderArtPreviewOnly',
    'restoreSnapshot',
    'revertToRepo',
  ];
  for (const name of viewFunctions)
  {
    assert.doesNotMatch(body(studio, name), /state\.(cards|items)\[0\]/, `${name} never falls back to the first entity`);
  }
  assert.doesNotMatch(body(studio, 'renderArtTab'), /state\.(cards|items)\[0\]/, 'the picker follows the active entity');
});

test('edit bursts end on entity change and view state stays out of snapshots, the draft and bundles', () =>
{
  const studio = source('studio.js');
  assert.match(studio, /createActiveEntities\(\{\s*state,\s*onChange: \(\) =>\s*\{\s*editBursts\.endAll\(\);/);
  assert.match(body(studio, 'createEditBurst'), /editBursts\.create\(\)/);
  for (const name of ['snapshotState', 'writeDraftNow'])
  {
    assert.doesNotMatch(body(studio, name), /selectedCardId|selectedItemKey|activeGallery|WorkingContext/, `${name} holds content only`);
  }
  for (const file of ['studioToolsModal.js', 'studio.js'])
  {
    assert.doesNotMatch(source(file), /scoreStudioWorkingContext/, `${file} does not spell the view-state key itself`);
  }
});
