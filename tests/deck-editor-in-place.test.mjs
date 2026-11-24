import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { withModalDom } from './helpers/dom.mjs';
import { mountDeckEditor } from '../src/ui/screens/deckEditor.js';

const registries = createRegistries(contentBundle);
const runState = () => createRunState({ seed: 91, classId: 'reaver', registries, combatExpansionVersion: 1 });
const tile = (root, key) => root.querySelector(`.deck-editor-tile[data-key="${key}"]`);
const step = (root, key, action) => tile(root, key).querySelector(`[data-action="${action}"].deck-editor-step`);

function mounted(fn, options = {}) {
  withModalDom(dom => {
    const run = runState();
    const editor = mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: 1, ...options.settings }, search: true });
    try { fn(editor, run, dom); }
    finally { editor.close(); }
  });
}

test('deck transfers keep the desk, both scroll owners, controls and unrelated cards mounted', () => {
  mounted((editor, run) => {
    const root = editor.root;
    const panel = root.querySelector('.deck-editor');
    const collection = root.querySelector('[data-pane="collection"]');
    const deck = root.querySelector('[data-pane="deck"]');
    const libraryList = collection.querySelector('.deck-editor-list');
    const deckList = deck.querySelector('.deck-editor-list');
    const tools = collection.querySelector('.deck-editor-tools');
    const search = collection.querySelector('input');
    const other = [...root.querySelectorAll('.deck-editor-tile')].find(node => node.dataset.key !== 'basic:attack');
    const otherKey = other.dataset.key;
    panel.scrollTop = 19; libraryList.scrollTop = 117; deckList.scrollTop = 83;
    const count = run.deck.length;
    step(root, 'basic:attack', 'add').click();
    assert.equal(run.deck.length, count + 1);
    assert.equal(root.querySelector('.deck-editor'), panel);
    assert.equal(root.querySelector('[data-pane="collection"]'), collection);
    assert.equal(root.querySelector('[data-pane="deck"]'), deck);
    assert.equal(collection.querySelector('.deck-editor-list'), libraryList);
    assert.equal(deck.querySelector('.deck-editor-list'), deckList);
    assert.equal(collection.querySelector('.deck-editor-tools'), tools);
    assert.equal(collection.querySelector('input'), search);
    assert.equal(tile(root, otherKey), other);
    assert.equal(panel.scrollTop, 19);
    assert.equal(libraryList.scrollTop, 117);
    assert.equal(deckList.scrollTop, 83);
    assert.match(root.querySelector('.deck-editor-counter').textContent, new RegExp(`^${count + 1} /`));
  });
});

test('repeated removals use the current instance and update the stepper until no copies remain', () => {
  mounted((editor, run) => {
    const root = editor.root;
    step(root, 'basic:attack', 'add').click();
    step(root, 'basic:attack', 'add').click();
    let removals = 0;
    while (!step(root, 'basic:attack', 'remove').hasAttribute('disabled') && removals < 50) {
      const before = run.deck.length;
      step(root, 'basic:attack', 'remove').click();
      assert.equal(run.deck.length, before - 1);
      removals += 1;
    }
    assert.ok(removals >= 2 && removals < 50);
    assert.equal(step(root, 'basic:attack', 'remove').hasAttribute('disabled'), true);
    assert.equal(document.activeElement.dataset.focusKey, 'tile-add:basic:attack');
    const countText = tile(root, 'basic:attack').querySelector('.deck-editor-stepper-count').textContent;
    assert.match(countText, /^0/);
    const beforeAdd = run.deck.length;
    step(root, 'basic:attack', 'add').click();
    assert.equal(step(root, 'basic:attack', 'remove').hasAttribute('disabled'), false);
    step(root, 'basic:attack', 'remove').click();
    assert.equal(run.deck.length, beforeAdd);
  });
});

test('inspection and Back retain the same list and card nodes', () => {
  mounted(editor => {
    const root = editor.root;
    const collection = root.querySelector('[data-pane="collection"]');
    const list = collection.querySelector('.deck-editor-list');
    const original = tile(root, 'basic:attack');
    list.scrollTop = 161;
    original.querySelector('.deck-editor-main').click();
    root.querySelector('[data-focus-key="inspect-back"]').click();
    assert.equal(collection.querySelector('.deck-editor-list'), list);
    assert.equal(tile(root, 'basic:attack'), original);
    assert.equal(list.scrollTop, 161);
    assert.equal(original.querySelector('.deck-editor-main').getAttribute('aria-pressed'), 'true');
  });
});

test('search and expanded filters survive a transfer with their mounted controls intact', () => {
  mounted((editor, run, dom) => {
    const root = editor.root;
    const search = root.querySelector('[data-focus-key="search"]');
    search.value = 'Strike';
    search.dispatchEvent(new dom.Event('input'));
    const tools = root.querySelector('.deck-editor-tools');
    tools.open = true;
    tools.dispatchEvent(new dom.Event('toggle'));
    const filteredKeys = [...root.querySelectorAll('[data-pane="collection"] .deck-editor-tile')].map(node => node.dataset.key);
    const before = run.deck.length;
    step(root, 'basic:attack', 'add').click();
    assert.equal(run.deck.length, before + 1);
    assert.equal(root.querySelector('[data-focus-key="search"]'), search);
    assert.equal(search.value, 'Strike');
    assert.equal(root.querySelector('.deck-editor-tools'), tools);
    assert.equal(tools.open, true);
    assert.deepEqual([...root.querySelectorAll('[data-pane="collection"] .deck-editor-tile')].map(node => node.dataset.key), filteredKeys);
  });
});

test('a transfer preserves the mounted collapsed deck group', () => {
  mounted(editor => {
    const root = editor.root;
    const deck = root.querySelector('[data-pane="deck"]');
    const group = deck.querySelector('.deck-editor-group');
    group.open = false;
    group.dispatchEvent(new Event('toggle'));
    step(root, 'basic:attack', 'add').click();
    assert.equal(root.querySelector('[data-pane="deck"]'), deck);
    assert.equal(deck.querySelector('.deck-editor-group'), group);
    assert.equal(group.open, false);
  });
});

test('moving a middle card keeps its node and updates the deck order in place', () => {
  mounted((editor, run) => {
    const root = editor.root;
    const pane = root.querySelector('[data-pane="deck"]');
    const list = pane.querySelector('.deck-editor-list');
    const row = list.querySelectorAll('.deck-editor-row')[2];
    const id = row.dataset.instanceId;
    const oldIndex = run.deck.findIndex(card => card.instanceId === id);
    list.scrollTop = 141;
    row.querySelector('[data-action="down"]').click();
    assert.equal(run.deck.findIndex(card => card.instanceId === id), oldIndex + 1);
    assert.equal(root.querySelector('[data-pane="deck"]'), pane);
    assert.equal(pane.querySelector('.deck-editor-list'), list);
    assert.equal(list.querySelector(`[data-instance-id="${id}"].deck-editor-row`), row);
    assert.equal(list.scrollTop, 141);
  }, { settings: { playInDeckOrder: true } });
});
