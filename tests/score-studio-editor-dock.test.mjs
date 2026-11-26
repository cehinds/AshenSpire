import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { initCardEditorDock, CARD_EDITOR_DOCK_KEY } from '../tools/score-studio/cardEditorDock.js';
import { createAddCardTile, CaptureCardTilePositions, animateCardInsertion } from '../tools/score-studio/addCardTile.js';

function fixture(dom, stored = new Map()) {
  const { document: doc } = dom;
  const create = doc.createElement;
  doc.createElement = tag => {
    const node = create(tag);
    if (tag === 'dialog') {
      node.showModal = () => { node.open = true; };
      node.close = () => { node.open = false; node.dispatchEvent(new dom.Event('close')); };
    }
    return node;
  };
  doc.body.innerHTML = `<main class="studio-main">
    <section id="tab-cards"><div class="cards-layout"><div class="cards-gallery-pane"><div class="names-row"></div><div id="cards-grid"><div class="studio-card-tile" data-card-id="a"><div class="studio-card-stage"></div></div><div class="studio-card-tile" data-card-id="b"><div class="studio-card-stage"></div></div></div></div><div id="inspector-resizer" class="inspector-resizer"></div><aside id="card-inspector" class="card-inspector"><input id="edit-name"></aside></div></section>
    <section id="tab-items"><div class="cards-layout"><div class="cards-gallery-pane"><div class="names-row"></div><div id="items-grid"><div class="item-grid-tile" data-item-key="weapon:one"><div></div></div><div class="item-grid-tile" data-item-key="weapon:two"><div></div></div></div></div><div id="item-inspector-resizer" class="inspector-resizer"></div><aside id="item-inspector-pane" class="card-inspector"><input id="item-edit-name"></aside></div></section>
    <section id="tab-weights" class="studio-panel"><input id="weight-value"></section>
    <section id="tab-art" class="studio-panel"><input id="art-value"></section>
    <div id="deck-panel"><input id="deck-name"></div>
  </main>`;
  const state = { selectedCardId: 'a', selectedItemKey: 'weapon:one', cards: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] };
  const calls = [];
  const ctx = { document: doc, state, views: { decks: doc.getElementById('deck-panel') },
    storage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    selectCard: id => { state.selectedCardId = id; calls.push(['selectCard', id]); },
    selectItem: id => { state.selectedItemKey = id; calls.push(['selectItem', id]); },
    getSelectedItemId: () => state.selectedItemKey,
    getSelectedItemName: id => id === 'weapon:one' ? 'First weapon' : 'Second weapon',
    renameCard: id => calls.push(['renameCard', id]), balanceCard: id => calls.push(['balanceCard', id]),
    renameItem: id => calls.push(['renameItem', id]), balanceItem: id => calls.push(['balanceItem', id]),
    onViewChange: view => calls.push(['view', view]),
  };
  const cardInput = doc.getElementById('edit-name'), itemInput = doc.getElementById('item-edit-name');
  const api = initCardEditorDock(ctx);
  return { api, state, calls, stored, cardInput, itemInput, doc };
}

test('customization views reuse live inputs and preserve the gallery and selection across context changes', () => withKitDom(dom => {
  const { api, doc, state, cardInput, itemInput } = fixture(dom);
  const gallery = doc.getElementById('cards-grid'), weights = doc.getElementById('weight-value');
  cardInput.value = 'Unsaved card'; itemInput.value = 'Unsaved item'; weights.value = '17';
  api.setView('weights');
  assert.equal(api.getView(), 'weights');
  assert.equal(doc.getElementById('cards-grid'), gallery);
  assert.equal(state.selectedCardId, 'a');
  assert.ok(doc.getElementById('studio-customization-pane').querySelector('#weight-value'));
  api.setContext('items');
  assert.equal(api.getView(), 'weights');
  assert.ok(doc.getElementById('tab-items').querySelector('#studio-customization-pane'));
  assert.equal(weights.value, '17');
  api.setView('properties');
  assert.equal(doc.getElementById('card-inspector').hidden, true);
  assert.equal(doc.getElementById('item-inspector-pane').hidden, false);
  api.setContext('cards');
  assert.equal(doc.getElementById('edit-name'), cardInput);
  assert.equal(cardInput.value, 'Unsaved card'); assert.equal(itemInput.value, 'Unsaved item');
  for (const id of ['edit-name', 'item-edit-name', 'weight-value', 'art-value', 'deck-name', 'studio-customization-pane']) assert.equal(doc.querySelectorAll(`#${id}`).length, 1, id);
}));

test('ordinary selection leaves the editor closed and only the selected tile exposes Edit', () => withKitDom(dom => {
  const { api, state, doc } = fixture(dom);
  api.setDocked(false);
  assert.equal(doc.getElementById('card-editor-modal').open, undefined);
  const [a, b] = doc.querySelectorAll('#cards-grid .studio-card-tile');
  assert.ok(a.querySelector('.card-editor-edit-button'));
  assert.ok(a.querySelector('.studio-card-stage .card-editor-edit-button'), 'Edit is owned by the art stage');
  assert.equal(b.querySelector('.card-editor-edit-button'), null);
  state.selectedCardId = 'b'; api.refresh(); api.refresh();
  assert.equal(a.querySelector('.card-editor-edit-button'), null);
  assert.equal(b.querySelectorAll('.card-editor-edit-button').length, 1);
  b.click(); assert.ok(!doc.getElementById('card-editor-modal').open);
  b.querySelector('.card-editor-edit-button').click();
  assert.equal(doc.getElementById('card-editor-modal').open, true);
  assert.ok(doc.getElementById('card-editor-modal').querySelector('#edit-name'));
}));

test('floating card and item Edit actions do not trigger their gallery selection handlers', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  let selected = 0;
  const card = doc.querySelector('#cards-grid .studio-card-tile');
  card.addEventListener('click', () => selected++);
  card.querySelector('.card-editor-edit-button').click();
  assert.equal(selected, 0);
  api.editItem('weapon:one');
  const item = doc.querySelector('#items-grid .item-grid-tile');
  item.addEventListener('click', () => selected++);
  assert.ok(item.querySelector('.studio-item-card-stage .card-editor-edit-button'));
  item.querySelector('.card-editor-edit-button').click();
  assert.equal(selected, 0);
}));

test('Edit opens the one pane in a modal, native cancel returns focus, docking restores its current home', () => withKitDom(dom => {
  const { api, doc, cardInput, stored } = fixture(dom);
  let edits = 0; cardInput.addEventListener('input', () => edits++);
  api.edit('b');
  const modal = doc.getElementById('card-editor-modal');
  assert.equal(modal.open, true); assert.equal(api.isDocked(), false);
  assert.equal(stored.get(CARD_EDITOR_DOCK_KEY), 'false');
  assert.equal(modal.querySelector('#edit-name'), cardInput);
  cardInput.dispatchEvent(new dom.Event('input'));
  const cancel = new dom.Event('cancel', { cancelable: true }); modal.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true); assert.equal(modal.open, false);
  assert.equal(doc.activeElement.dataset.cardId, 'b');
  api.edit('b'); doc.getElementById('card-editor-modal-dock').click();
  assert.equal(api.isDocked(), true); assert.equal(modal.open, false);
  assert.ok(doc.getElementById('tab-cards').querySelector('#edit-name'));
  cardInput.dispatchEvent(new dom.Event('input'));
  assert.equal(edits, 2, 'the original input and its sole listener survived both moves');
}));

test('card and item modal actions address only the selected object, including item focus return', () => withKitDom(dom => {
  const { api, doc, calls, state } = fixture(dom);
  api.edit('b'); doc.getElementById('card-editor-rename').click(); doc.getElementById('card-editor-balance').click();
  assert.ok(calls.some(row => row[0] === 'renameCard' && row[1] === 'b'));
  assert.ok(calls.some(row => row[0] === 'balanceCard' && row[1] === 'b'));
  api.editItem('weapon:two');
  assert.equal(state.selectedItemKey, 'weapon:two');
  assert.ok(doc.getElementById('card-editor-modal').querySelector('#item-edit-name'));
  doc.getElementById('card-editor-rename').click(); doc.getElementById('card-editor-balance').click();
  assert.ok(calls.some(row => row[0] === 'renameItem' && row[1] === 'weapon:two'));
  assert.ok(calls.some(row => row[0] === 'balanceItem' && row[1] === 'weapon:two'));
  doc.getElementById('card-editor-modal-close').click();
  assert.equal(doc.activeElement.closest('.item-grid-tile').dataset.itemKey, 'weapon:two');
  assert.equal(doc.activeElement.classList.contains('card-editor-edit-button'), true);
  assert.equal(doc.querySelectorAll('#items-grid .card-editor-edit-button').length, 1);
}));

test('canceling a globally undocked item editor returns to its focusable Edit action', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  api.setContext('items');
  doc.getElementById('item-editor-gallery-toggle').click();
  const modal = doc.getElementById('card-editor-modal');
  assert.equal(modal.open, true);
  modal.dispatchEvent(new dom.Event('cancel', { cancelable: true }));
  assert.equal(modal.open, false);
  assert.equal(doc.activeElement.tagName, 'BUTTON');
  assert.equal(doc.activeElement.classList.contains('card-editor-edit-button'), true);
  assert.equal(doc.activeElement.closest('.item-grid-tile').dataset.itemKey, 'weapon:one');
}));

test('saved undocking and views restore without opening a dialog; keyboard resizing works on both galleries', () => withKitDom(dom => {
  const stored = new Map([[CARD_EDITOR_DOCK_KEY, 'false'], ['ashenspire:scoreStudioCustomizationView:v1', 'design']]);
  const { api, doc } = fixture(dom, stored);
  assert.equal(api.isDocked(), false); assert.equal(api.getView(), 'design');
  assert.ok(!doc.getElementById('card-editor-modal').open);
  api.setDocked(true);
  const resize = doc.getElementById('item-inspector-resizer');
  resize.dispatchEvent(new dom.Event('keydown', { key: 'ArrowLeft', cancelable: true }));
  assert.equal(stored.get('ashenspire:studioInspectorW'), '440');
  assert.ok(doc.getElementById('tab-items').querySelector('#studio-customization-pane'));
  assert.equal(api.getView(), 'design');
  assert.throws(() => api.setView('invented'), /Unknown customization view/);
  api.setView('weights'); api.open();
  assert.equal(api.getView(), 'weights', 'opening an undocked view keeps its active content');
  assert.equal(doc.getElementById('card-editor-modal').open, true);
}));

test('the Add card cell is one accessible action and never participates in card selection or position capture', () => withKitDom(dom => {
  const { doc } = fixture(dom);
  const grid = doc.getElementById('cards-grid');
  let additions = 0;
  const tile = createAddCardTile({ document: doc, onAdd: () => additions++ });
  grid.prepend(tile);
  assert.equal(tile.classList.contains('studio-card-tile'), false);
  assert.equal(tile.hasAttribute('data-card-id'), false);
  assert.equal(tile.querySelector('[data-card-selection]'), null);
  const buttons = tile.querySelectorAll('button');
  assert.equal(buttons.length, 1); assert.equal(buttons[0].getAttribute('aria-label'), 'Add card');
  buttons[0].click(); assert.equal(additions, 1);
  assert.deepEqual([...CaptureCardTilePositions(grid).keys()], ['a', 'b']);
}));

test('insertion animation moves existing cards from their prior positions and respects reduced motion', () => withKitDom(dom => {
  const { doc } = fixture(dom), grid = doc.getElementById('cards-grid');
  const [a, b] = grid.querySelectorAll('.studio-card-tile');
  a.box = { left: 10, top: 20 }; b.box = { left: 210, top: 20 };
  const before = CaptureCardTilePositions(grid);
  a.box = { left: 210, top: 20 }; b.box = { left: 10, top: 320 };
  const added = doc.createElement('div'); added.className = 'studio-card-tile'; added.dataset.cardId = 'new'; added.box = { left: 10, top: 20 }; grid.append(added);
  const calls = [];
  for (const tile of [a, b, added]) tile.animate = (frames, options) => { calls.push({ id: tile.dataset.cardId, frames, options }); return { cancel() {} }; };
  assert.equal(animateCardInsertion(grid, 'new', { before, reducedMotion: true }).length, 0);
  assert.equal(calls.length, 0);
  assert.equal(animateCardInsertion(grid, 'new', { before, reducedMotion: false }).length, 3);
  assert.match(calls.find(call => call.id === 'a').frames[0].transform, /-200px/);
  assert.equal(calls.find(call => call.id === 'new').frames[0].opacity, 0);
  assert.ok(calls.every(call => call.options.duration === 180));
}));
