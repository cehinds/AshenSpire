import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import {
  WORKING_CONTEXT_KEY, createActiveEntities, nextInDisplayedOrder, createEditBursts,
  readWorkingContext, writeWorkingContext, resolveWorkingContext, captureTileFocus, restoreTileFocus,
} from '../tools/score-studio/workingContext.js';

const studioState = () => ({
  cards: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }],
  items: [{ key: 'weapon:one' }, { key: 'weapon:two' }],
  selectedCardId: null, selectedItemKey: null,
});

test('one setter per kind writes the active entity and reports each real change once', () => {
  const state = studioState(), changes = [];
  const active = createActiveEntities({ state, onChange: (kind, id) => changes.push([kind, id]) });
  assert.deepEqual(active.set('cards', 'b'), { id: 'b', changed: true });
  assert.deepEqual(active.set('cards', 'b'), { id: 'b', changed: false });
  active.set('items', 'weapon:two');
  assert.equal(state.selectedCardId, 'b');
  assert.equal(state.selectedItemKey, 'weapon:two');
  assert.deepEqual(changes, [['cards', 'b'], ['items', 'weapon:two']]);
  assert.throws(() => active.set('decks', 'x'), /Unknown entity kind/);
});

test('a removed or unknown entity clears to the empty state, never the first card', () => {
  const state = studioState();
  const active = createActiveEntities({ state });
  active.set('cards', 'c');
  assert.deepEqual(active.set('cards', 'missing'), { id: null, changed: true });
  assert.equal(state.selectedCardId, null, 'an unknown id is not replaced by the first card');
  active.set('cards', 'c');
  // Undo of New, Revert or an import that drops the card: content changes, then reconcile.
  state.cards = state.cards.filter(card => card.id !== 'c');
  active.reconcile();
  assert.equal(state.selectedCardId, null);
  // A still-valid entity is kept through a content change.
  active.set('cards', 'b');
  state.cards = [...state.cards];
  active.reconcile();
  assert.equal(state.selectedCardId, 'b');
});

test('an out-of-band write is reconciled through the setter and still counts as a change', () => {
  const state = studioState(), changes = [];
  const active = createActiveEntities({ state, onChange: kind => changes.push(kind) });
  active.set('cards', 'a');
  state.selectedCardId = 'b';
  active.reconcile();
  assert.equal(state.selectedCardId, 'b');
  assert.deepEqual(changes, ['cards', 'cards', 'items']);
});

test('Delete selects the next entity in displayed order, else the previous one, else none', () => {
  assert.equal(nextInDisplayedOrder(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(nextInDisplayedOrder(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(nextInDisplayedOrder(['b'], 'b'), null);
  // Filtered display order wins over the full list.
  assert.equal(nextInDisplayedOrder(['c', 'a'], 'c', ['a', 'b', 'c']), 'a');
  // A removed card hidden by filters falls back to the full order.
  assert.equal(nextInDisplayedOrder(['a'], 'b', ['a', 'b', 'c']), 'c');
  assert.equal(nextInDisplayedOrder([], 'z', []), null);
});

test('an entity change ends every open edit burst, so one Undo never spans two cards', () => {
  const history = [], timers = [];
  const bursts = createEditBursts({ pushHistory: () => history.push(history.length), setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  const name = bursts.create(), cost = bursts.create();
  name.begin(); name.begin(); cost.begin();
  assert.equal(history.length, 2, 'one undo step per burst');
  assert.equal(bursts.openCount(), 2);
  bursts.endAll();
  assert.equal(bursts.openCount(), 0);
  name.begin();
  assert.equal(history.length, 3, 'typing after the entity change records a new undo step');
  name.end();
  assert.equal(name.isOpen(), false);
});

test('a burst still closes on its own after the pause', () => {
  const history = [], timers = [];
  const bursts = createEditBursts({ pushHistory: () => history.push(1), setTimer: fn => { timers.push(fn); return timers.length; }, clearTimer: () => {} });
  const burst = bursts.create();
  burst.begin();
  timers.at(-1)();
  burst.begin();
  assert.equal(history.length, 2);
});

test('reload restore keeps view state under its own key and falls back when a stored id is gone', () => {
  const stored = new Map();
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) };
  writeWorkingContext(storage, { gallery: 'items', cardId: 'c', itemKey: 'weapon:two' });
  assert.deepEqual([...stored.keys()], [WORKING_CONTEXT_KEY]);
  assert.ok(!WORKING_CONTEXT_KEY.includes('Draft'), 'view state is not stored with the draft');
  const saved = readWorkingContext(storage);
  assert.deepEqual(saved, { gallery: 'items', cardId: 'c', itemKey: 'weapon:two' });
  const state = studioState();
  assert.deepEqual(resolveWorkingContext(saved, state, { cardId: 'a', itemKey: 'weapon:one' }), { gallery: 'items', cardId: 'c', itemKey: 'weapon:two' });
  // The stored card was deleted: the existing default returns without error.
  state.cards = state.cards.filter(card => card.id !== 'c');
  assert.deepEqual(resolveWorkingContext(saved, state, { cardId: 'a', itemKey: 'weapon:one' }), { gallery: 'items', cardId: 'a', itemKey: 'weapon:two' });
  assert.deepEqual(resolveWorkingContext({ gallery: 'weights', cardId: 42 }, state, { cardId: 'a' }), { gallery: 'cards', cardId: 'a', itemKey: null });
  stored.set(WORKING_CONTEXT_KEY, '{not json');
  assert.equal(readWorkingContext(storage), null);
  assert.equal(readWorkingContext({ getItem: () => { throw new Error('blocked'); } }), null);
  assert.doesNotThrow(() => writeWorkingContext({ setItem: () => { throw new Error('full'); } }, { gallery: 'cards' }));
});

function galleryFixture(dom) {
  const { document: doc } = dom;
  doc.body.innerHTML = '<input id="card-search"><div id="cards-grid"></div>';
  const grid = doc.getElementById('cards-grid');
  const render = ids => {
    grid.replaceChildren();
    for (const id of ids) {
      const tile = doc.createElement('div'); tile.className = 'studio-card-tile'; tile.dataset.cardId = id; tile.tabIndex = 0;
      const edit = doc.createElement('button'); edit.className = 'card-editor-edit-button';
      tile.append(edit); grid.append(tile);
    }
  };
  const tile = id => grid.querySelectorAll('.studio-card-tile').find(node => node.dataset.cardId === id);
  return { doc, grid, render, tile };
}

test('a gallery re-render keeps focus on the tile with the same id', () => withKitDom(dom => {
  const { doc, grid, render, tile } = galleryFixture(dom);
  render(['a', 'b', 'c']);
  tile('b').focus();
  const captured = captureTileFocus(grid, 'card-id', doc);
  assert.deepEqual(captured, { id: 'b', part: null });
  render(['a', 'b', 'c']);
  assert.notEqual(doc.activeElement, tile('b'), 'the rebuild destroyed the focused tile');
  restoreTileFocus(grid, 'card-id', captured, doc.getElementById('card-search'), doc);
  assert.equal(doc.activeElement, tile('b'));
}));

test('focus inside a tile returns to the same part; a removed tile moves focus to a named control', () => withKitDom(dom => {
  const { doc, grid, render, tile } = galleryFixture(dom);
  render(['a', 'b']);
  tile('a').querySelector('.card-editor-edit-button').focus();
  let captured = captureTileFocus(grid, 'card-id', doc);
  assert.deepEqual(captured, { id: 'a', part: '.card-editor-edit-button' });
  render(['a', 'b']);
  restoreTileFocus(grid, 'card-id', captured, doc.getElementById('card-search'), doc);
  assert.equal(doc.activeElement, tile('a').querySelector('.card-editor-edit-button'));
  tile('b').focus();
  captured = captureTileFocus(grid, 'card-id', doc);
  render(['a']);
  restoreTileFocus(grid, 'card-id', captured, doc.getElementById('card-search'), doc);
  assert.equal(doc.activeElement, doc.getElementById('card-search'), 'focus never drops to the page body');
  // Focus outside the gallery is left alone.
  doc.getElementById('card-search').focus();
  assert.equal(captureTileFocus(grid, 'card-id', doc), null);
}));
