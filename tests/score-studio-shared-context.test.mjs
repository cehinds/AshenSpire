import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/dom.mjs';
import {
  GalleryKind,
  TileIdAttribute,
  WorkingContextKey,
  CreateActiveEntities,
  NextInDisplayedOrder,
  CreateEditBursts,
  ReadWorkingContext,
  WriteWorkingContext,
  ResolveWorkingContext,
  CaptureTileFocus,
  RestoreTileFocus,
} from '../tools/score-studio/workingContext.js';

const UNKNOWN_KIND = 'decks';
const CARD_TILE_ATTRIBUTE = TileIdAttribute[GalleryKind.Cards];
const CARD_GRID_ID = 'cards-grid';
const CARD_SEARCH_ID = 'card-search';
const CARD_TILE_CLASS = 'studio-card-tile';
const EDIT_BUTTON_CLASS = 'card-editor-edit-button';
const UNKNOWN_GALLERY = 'weights';
const MISSING_ID = 'missing';
const DRAFT_KEY_WORD = 'Draft';

const CardId = Object.freeze({
  Alpha: 'a',
  Beta: 'b',
  Gamma: 'c',
});

const ItemKey = Object.freeze({
  One: 'weapon:one',
  Two: 'weapon:two',
});

function studioState()
{
  return {
    cards: [
      { id: CardId.Alpha, name: 'Alpha' },
      { id: CardId.Beta, name: 'Beta' },
      { id: CardId.Gamma, name: 'Gamma' },
    ],
    items: [
      { key: ItemKey.One },
      { key: ItemKey.Two },
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

  function clearTimer()
  {
    // A manual timer only runs when the test calls it, so there is nothing to cancel.
  }

  return { pending, setTimer, clearTimer };
}

test('one setter per kind writes the active entity and reports each real change once', () =>
{
  const state = studioState();
  const changes = [];
  const active = CreateActiveEntities({
    state,
    onChange: (kind, id) => changes.push([kind, id]),
  });
  assert.deepEqual(active.set(GalleryKind.Cards, CardId.Beta), { id: CardId.Beta, changed: true });
  assert.deepEqual(active.set(GalleryKind.Cards, CardId.Beta), { id: CardId.Beta, changed: false });
  active.set(GalleryKind.Items, ItemKey.Two);
  assert.equal(state.selectedCardId, CardId.Beta);
  assert.equal(state.selectedItemKey, ItemKey.Two);
  assert.deepEqual(changes, [
    [GalleryKind.Cards, CardId.Beta],
    [GalleryKind.Items, ItemKey.Two],
  ]);
  assert.throws(() => active.set(UNKNOWN_KIND, MISSING_ID), /Unknown entity kind/);
});

test('a removed or unknown entity clears to the empty state, never the first card', () =>
{
  const state = studioState();
  const active = CreateActiveEntities({ state });
  active.set(GalleryKind.Cards, CardId.Gamma);
  assert.deepEqual(active.set(GalleryKind.Cards, MISSING_ID), { id: null, changed: true });
  assert.equal(state.selectedCardId, null, 'an unknown id is not replaced by the first card');
  active.set(GalleryKind.Cards, CardId.Gamma);
  // Content that drops the active card, then reconcile.
  state.cards = state.cards.filter(card => card.id !== CardId.Gamma);
  active.reconcile();
  assert.equal(state.selectedCardId, null);
  active.set(GalleryKind.Cards, CardId.Beta);
  state.cards = [...state.cards];
  active.reconcile();
  assert.equal(state.selectedCardId, CardId.Beta);
});

test('an out-of-band write is reconciled through the setter and still counts as a change', () =>
{
  const state = studioState();
  const changes = [];
  const active = CreateActiveEntities({
    state,
    onChange: kind => changes.push(kind),
  });
  active.set(GalleryKind.Cards, CardId.Alpha);
  state.selectedCardId = CardId.Beta;
  active.reconcile();
  assert.equal(state.selectedCardId, CardId.Beta);
  assert.deepEqual(changes, [GalleryKind.Cards, GalleryKind.Cards, GalleryKind.Items]);
});

test('Delete selects the next entity in displayed order, else the previous one, else none', () =>
{
  const { Alpha, Beta, Gamma } = CardId;
  const fullOrder = [Alpha, Beta, Gamma];
  assert.equal(NextInDisplayedOrder(fullOrder, Beta), Gamma);
  assert.equal(NextInDisplayedOrder(fullOrder, Gamma), Beta);
  assert.equal(NextInDisplayedOrder([Beta], Beta), null);
  // Filtered display order wins over the full list.
  assert.equal(NextInDisplayedOrder([Gamma, Alpha], Gamma, fullOrder), Alpha);
  // A removed card hidden by filters falls back to the full order.
  assert.equal(NextInDisplayedOrder([Alpha], Beta, fullOrder), Gamma);
  assert.equal(NextInDisplayedOrder([], MISSING_ID, []), null);
});

test('an entity change ends every open edit burst, so one Undo never spans two cards', () =>
{
  const history = [];
  const { setTimer, clearTimer } = manualTimers();
  const bursts = CreateEditBursts({
    pushHistory: () => history.push(history.length),
    setTimer,
    clearTimer,
  });
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
  const bursts = CreateEditBursts({
    pushHistory: () => history.push(1),
    setTimer,
    clearTimer,
  });
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
  const savedContext = { gallery: GalleryKind.Items, cardId: CardId.Gamma, itemKey: ItemKey.Two };
  const defaults = { cardId: CardId.Alpha, itemKey: ItemKey.One };
  WriteWorkingContext(storage, savedContext);
  assert.deepEqual([...stored.keys()], [WorkingContextKey]);
  assert.ok(!WorkingContextKey.includes(DRAFT_KEY_WORD), 'view state is not stored with the draft');
  const saved = ReadWorkingContext(storage);
  assert.deepEqual(saved, savedContext);
  const state = studioState();
  assert.deepEqual(ResolveWorkingContext(saved, state, defaults), savedContext);
  // The stored card was deleted: the existing default returns without error.
  state.cards = state.cards.filter(card => card.id !== CardId.Gamma);
  assert.deepEqual(
    ResolveWorkingContext(saved, state, defaults),
    { gallery: GalleryKind.Items, cardId: CardId.Alpha, itemKey: ItemKey.Two },
  );
  const unknownContext = { gallery: UNKNOWN_GALLERY, cardId: 42 };
  assert.deepEqual(
    ResolveWorkingContext(unknownContext, state, { cardId: CardId.Alpha }),
    { gallery: GalleryKind.Cards, cardId: CardId.Alpha, itemKey: null },
  );
  stored.set(WorkingContextKey, '{not json');
  assert.equal(ReadWorkingContext(storage), null);
  const blockedStorage = {
    getItem: () =>
    {
      throw new Error('blocked');
    },
  };
  assert.equal(ReadWorkingContext(blockedStorage), null);
  const fullStorage = {
    setItem: () =>
    {
      throw new Error('full');
    },
  };
  assert.doesNotThrow(() => WriteWorkingContext(fullStorage, { gallery: GalleryKind.Cards }));
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
  render([CardId.Alpha, CardId.Beta, CardId.Gamma]);
  tile(CardId.Beta).focus();
  const captured = CaptureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  assert.deepEqual(captured, { id: CardId.Beta, part: null });
  render([CardId.Alpha, CardId.Beta, CardId.Gamma]);
  assert.notEqual(doc.activeElement, tile(CardId.Beta), 'the rebuild destroyed the focused tile');
  RestoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, tile(CardId.Beta));
}));

test('focus inside a tile returns to the same part; a removed tile moves focus to a named control', () => withKitDom(dom =>
{
  const { doc, grid, render, tile, search } = galleryFixture(dom);
  const editButtonOf = id => tile(id).querySelector(`.${EDIT_BUTTON_CLASS}`);
  render([CardId.Alpha, CardId.Beta]);
  editButtonOf(CardId.Alpha).focus();
  let captured = CaptureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  assert.deepEqual(captured, { id: CardId.Alpha, part: `.${EDIT_BUTTON_CLASS}` });
  render([CardId.Alpha, CardId.Beta]);
  RestoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, editButtonOf(CardId.Alpha));
  tile(CardId.Beta).focus();
  captured = CaptureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc);
  render([CardId.Alpha]);
  RestoreTileFocus(grid, CARD_TILE_ATTRIBUTE, captured, search(), doc);
  assert.equal(doc.activeElement, search(), 'focus never drops to the page body');
  // Focus outside the gallery is left alone.
  search().focus();
  assert.equal(CaptureTileFocus(grid, CARD_TILE_ATTRIBUTE, doc), null);
}));

// Static routing checks on the composition root: studio.js boots the page on import, so these read its source.
function source(name)
{
  return readFileSync(new URL(`../tools/score-studio/${name}`, import.meta.url), 'utf8');
}

function body(sourceText, name)
{
  const start = sourceText.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const nextFunction = sourceText.indexOf('\nfunction ', start + 1);
  const nextAsyncFunction = sourceText.indexOf('\nasync function ', start + 1);
  const ends = [nextFunction, nextAsyncFunction, sourceText.length].filter(index => index > start);
  return sourceText.slice(start, Math.min(...ends));
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
    'cardEditorDock.js',
  ];
  for (const file of writerFiles)
  {
    assert.doesNotMatch(source(file), writes, `${file} writes the active entity only through the setters`);
  }
  const studio = source('studio.js');
  assert.equal(studio.match(/state\.artTarget\s*=(?!=)/g)?.length, 1, 'artTarget is set in one place, with activeGallery and the dock context');
  assert.match(body(studio, 'selectStudioCard'), /selectGalleryEntity\(GalleryKind\.Cards,/);
  assert.match(body(studio, 'selectStudioItem'), /selectGalleryEntity\(GalleryKind\.Items,/);
  assert.match(body(studio, 'selectGalleryEntity'), /activeEntities\.set\(kind,/);
  for (const name of ['selectStudioCard', 'selectStudioItem', 'selectGalleryEntity'])
  {
    assert.doesNotMatch(body(studio, name), /syncAllViews/, `${name} never rebuilds every view`);
  }
  assert.match(body(studio, 'syncAllViews'), /activeEntities\.reconcile\(\)/, 'content changes reconcile through the setters');
  // The Design picker and target route through the setter and the gallery tabs.
  assert.match(studio, /const ART_PREVIEW_SELECT_ID = 'art-preview-card-select';/);
  assert.match(studio, /getElementById\(ART_PREVIEW_SELECT_ID\)\.addEventListener\(CHANGE_EVENT[\s\S]{0,200}selectStudio(Item|Card)\(event\.target\.value/);
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
  assert.match(studio, /CreateActiveEntities\(\{\s*state,\s*onChange: \(\) =>\s*\{\s*editBursts\.endAll\(\);/);
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
