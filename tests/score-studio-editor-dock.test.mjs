import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { initCardEditorDock, CARD_EDITOR_DOCK_KEY } from '../tools/score-studio/cardEditorDock.js';
import { createAddCardTile, CaptureCardTilePositions, animateCardInsertion } from '../tools/score-studio/addCardTile.js';

function fixture(dom, stored = new Map(), extra = {}) {
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
    <section id="tab-cards"><div class="cards-layout"><div class="cards-gallery-pane"><div class="names-row"></div><div id="cards-grid"><div class="studio-card-tile" data-card-id="a"><div class="studio-card-stage"></div></div><div class="studio-card-tile" data-card-id="b"><div class="studio-card-stage"></div></div></div></div><div id="inspector-resizer" class="inspector-resizer"></div><aside id="card-inspector" class="card-inspector"><div class="inspector-preview-wrap"><div id="inspector-card-preview"></div></div><input id="edit-name"></aside></div></section>
    <section id="tab-items"><div class="cards-layout"><div class="cards-gallery-pane"><div class="names-row"></div><div id="items-grid"><div class="item-grid-tile" data-item-key="weapon:one"><div></div></div><div class="item-grid-tile" data-item-key="weapon:two"><div></div></div></div></div><div id="item-inspector-resizer" class="inspector-resizer"></div><aside id="item-inspector-pane" class="card-inspector"><div id="item-preview-host" class="item-preview-host"></div><input id="item-edit-name"></aside></div></section>
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
    ...extra,
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

test('undocked Edit opens the one pane in a modal, native cancel returns focus, docking restores its current home', () => withKitDom(dom => {
  const { api, doc, cardInput, stored } = fixture(dom);
  api.setDocked(false); // Docked Edit stays in place (see the docked Edit test below).
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
  api.setDocked(false);
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

test('one native preview moves into the active entity header and stays there in every view', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  const entity = doc.getElementById('customization-entity');
  const wrap = doc.querySelector('.inspector-preview-wrap'), itemHost = doc.getElementById('item-preview-host');
  assert.equal(entity.getAttribute('role'), 'region');
  assert.equal(wrap.closest('#customization-entity'), entity);
  assert.equal(doc.getElementById('card-inspector').querySelector('.inspector-preview-wrap'), null, 'moved, not cloned');
  for (const view of ['design', 'weights', 'decks', 'properties']) {
    api.setView(view);
    assert.equal(doc.querySelectorAll('.inspector-preview-wrap').length, 1, view);
    assert.equal(doc.querySelector('.inspector-preview-wrap'), wrap, view);
    assert.equal(doc.querySelectorAll('#inspector-card-preview').length, 1, view);
    assert.equal(wrap.hidden, false, view);
  }
  api.setContext('items');
  assert.equal(itemHost.closest('#customization-entity'), entity);
  assert.equal(itemHost.hidden, false); assert.equal(wrap.hidden, true);
  assert.equal(entity.getAttribute('aria-label'), 'Active item');
  assert.equal(doc.getElementById('customization-entity-name').textContent, 'First weapon');
}));

test('the scope line names what each view changes and labels the pane scope', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  const pane = doc.getElementById('studio-customization-pane'), scope = doc.getElementById('customization-scope');
  const expected = {
    properties: ['card', 'Selected card · edits change only Alpha'],
    design: ['shared', 'Shared art layers · rules apply to every matching card. Preview: Alpha'],
    weights: ['global', 'Global scoring · changes rescore every card. Preview: Alpha'],
    decks: ['deck', 'Deck membership · changes only the chosen deck. Preview: Alpha'],
  };
  for (const [view, [kind, text]] of Object.entries(expected)) {
    api.setView(view);
    assert.equal(pane.getAttribute('data-scope'), kind, view);
    assert.equal(scope.textContent, text, view);
    assert.equal(doc.getElementById('customization-entity-name').textContent, 'Alpha', view);
  }
  api.setView('properties'); api.setContext('items');
  assert.equal(scope.textContent, 'Selected item · edits change only First weapon');
}));

test('docked Edit selects and shows Properties in place without opening the dialog', () => withKitDom(dom => {
  const { api, doc, state, calls } = fixture(dom);
  api.setView('weights');
  api.edit('b');
  const modal = doc.getElementById('card-editor-modal');
  assert.ok(!modal.open, 'no dialog while docked');
  assert.equal(api.isDocked(), true);
  assert.equal(api.getView(), 'properties');
  assert.equal(state.selectedCardId, 'b');
  assert.ok(calls.some(row => row[0] === 'selectCard' && row[1] === 'b'));
  assert.ok(doc.getElementById('tab-cards').querySelector('#studio-customization-pane'));
  assert.equal(doc.activeElement, doc.getElementById('customization-entity-name'), 'focus goes to the heading, not a field');
  assert.equal(doc.getElementById('customization-entity-name').textContent, 'Beta');
  doc.querySelector('#cards-grid [data-card-id="b"] .card-editor-edit-button').click();
  assert.ok(!modal.open);
}));

test('an invalid or missing selection shows the empty state and disables card actions', () => withKitDom(dom => {
  const { api, doc, state, calls } = fixture(dom);
  const pane = doc.getElementById('studio-customization-pane'), empty = doc.getElementById('customization-empty');
  assert.equal(pane.getAttribute('data-empty'), 'false'); assert.equal(empty.hidden, true);
  for (const selected of ['gone', null]) {
    state.selectedCardId = selected;
    assert.doesNotThrow(() => api.refresh());
    assert.equal(pane.getAttribute('data-empty'), 'true', String(selected));
    assert.equal(empty.hidden, false);
    assert.equal(empty.textContent, 'No card selected. Choose a card in the library.');
    assert.equal(doc.getElementById('card-inspector').hidden, true, 'stale inspector is hidden');
    assert.equal(doc.querySelector('.inspector-preview-wrap').hidden, true, 'stale preview is hidden');
    assert.equal(doc.getElementById('customization-entity-name').textContent, 'No card selected');
    assert.equal(doc.getElementById('card-editor-rename').disabled, true);
    assert.equal(doc.getElementById('card-editor-balance').disabled, true);
    assert.equal(doc.querySelectorAll('#cards-grid .card-editor-edit-button').length, 0, 'no Edit on any tile');
  }
  const before = calls.length;
  doc.getElementById('card-editor-rename').disabled = false; doc.getElementById('card-editor-rename').click();
  assert.equal(calls.length, before, 'a forced click still cannot act on an invalid card');
  state.selectedCardId = 'b'; api.refreshEntity();
  assert.equal(pane.getAttribute('data-empty'), 'false');
  assert.equal(doc.getElementById('card-inspector').hidden, false);
  assert.equal(doc.querySelectorAll('#cards-grid [data-card-id="b"] .card-editor-edit-button').length, 1, 'an inspector render alone restores Edit');
}));

test('narrow screens switch between the library and the editor without losing the active card', () => withKitDom(dom => {
  const media = { matches: true, addEventListener() {} };
  const { api, doc, state } = fixture(dom, new Map(), { matchMedia: query => { media.query = query; return media; }, narrowQuery: '(max-width: 900px)' });
  assert.equal(media.query, '(max-width: 900px)');
  const body = doc.body, nav = doc.getElementById('customization-narrow-nav');
  const [library, editor] = nav.querySelectorAll('button');
  assert.ok(body.classList.contains('customize-narrow'));
  assert.ok(!body.classList.contains('customize-panel-editor'), 'the library is the default panel');
  assert.equal(library.textContent, 'Library'); assert.equal(editor.textContent, 'Card: Alpha');
  assert.equal(library.getAttribute('aria-pressed'), 'true'); assert.equal(editor.getAttribute('aria-pressed'), 'false');
  assert.ok(doc.getElementById('customization-narrow-nav-items'), 'items get their own nav');
  // Selecting a tile only selects; it does not jump to the editor.
  state.selectedCardId = 'b'; api.refresh();
  assert.ok(!body.classList.contains('customize-panel-editor'));
  assert.equal(editor.textContent, 'Card: Beta');
  editor.click();
  assert.ok(body.classList.contains('customize-panel-editor'));
  assert.equal(editor.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement, doc.getElementById('customization-entity-name'));
  library.click();
  assert.ok(!body.classList.contains('customize-panel-editor'));
  assert.equal(state.selectedCardId, 'b', 'returning keeps the active card');
  assert.equal(doc.activeElement.dataset.cardId, 'b', 'focus returns to the active tile');
  doc.querySelector('#cards-grid [data-card-id="b"] .card-editor-edit-button').click();
  assert.ok(body.classList.contains('customize-panel-editor'), 'Edit opens the editor panel');
  assert.ok(!doc.getElementById('card-editor-modal').open);
}));

test('the resizer is a named separator with Home and End limits and an understandable minimum', () => withKitDom(dom => {
  const { doc, stored } = fixture(dom);
  const resize = doc.getElementById('inspector-resizer');
  assert.equal(resize.getAttribute('role'), 'separator');
  assert.equal(resize.getAttribute('aria-label'), 'Resize customization pane');
  assert.equal(resize.tabIndex, 0);
  const press = key => { const event = new dom.Event('keydown', { key, cancelable: true }); resize.dispatchEvent(event); return event; };
  assert.equal(press('Home').defaultPrevented, true);
  assert.equal(stored.get('ashenspire:studioInspectorW'), '340');
  assert.equal(resize.getAttribute('aria-valuenow'), '340');
  assert.equal(resize.getAttribute('aria-valuetext'), '340 pixels, minimum 340');
  press('ArrowRight'); assert.equal(stored.get('ashenspire:studioInspectorW'), '340', 'never below the minimum');
  press('End');
  assert.equal(stored.get('ashenspire:studioInspectorW'), '780');
  assert.equal(resize.getAttribute('aria-valuetext'), '780 pixels, minimum 340');
  assert.equal(press('Tab').defaultPrevented, false, 'other keys pass through');
}));

test('repeated refresh, view and context changes build the header once and add no listeners', () => withKitDom(dom => {
  const { api, doc } = fixture(dom);
  const edit = doc.querySelector('#cards-grid .card-editor-edit-button');
  const navEditor = doc.querySelector('#customization-narrow-nav .customization-nav-editor');
  const listenerCount = node => [...node.listeners.values()].reduce((sum, list) => sum + list.length, 0);
  const before = [edit, navEditor, doc.getElementById('customization-view')].map(listenerCount);
  for (let run = 0; run < 5; run++) { api.refresh(); api.refreshEntity(); api.setView(['design', 'weights', 'decks', 'properties'][run % 4]); }
  api.setContext('items'); api.setContext('cards'); api.setView('properties');
  for (const id of ['customization-entity', 'customization-entity-name', 'customization-scope', 'customization-empty', 'customization-narrow-nav', 'customization-narrow-nav-items', 'inspector-card-preview', 'item-preview-host']) assert.equal(doc.querySelectorAll(`#${id}`).length, 1, id);
  assert.equal(doc.querySelectorAll('.inspector-preview-wrap').length, 1);
  assert.equal(doc.querySelectorAll('#cards-grid .card-editor-edit-button').length, 1);
  assert.equal(doc.querySelector('#cards-grid .card-editor-edit-button'), edit, 'the same Edit node is kept');
  assert.deepEqual([edit, navEditor, doc.getElementById('customization-view')].map(listenerCount), before);
}));
