// tests/less-redraw.test.mjs — owner, 2026-11-18: "limit the redrawing that happens when upgrading a card,
// editing a deck, or anything else that influences small changes". A small action changes only the nodes it
// affects: the list containers, the cards it did not touch and the scroll position stay; nothing is rebuilt.
//   node --test tests/less-redraw.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { patchChildren } from '../src/ui/keyedPatch.js';
import { setKeyBindings } from '../src/ui/input.js';
import { withModalDom as withBaseDom } from './helpers/dom.mjs';

setKeyBindings(null);
const withDom = (fn) => withBaseDom((...args) => {
  const nativeTimeout = globalThis.setTimeout;
  const nativeElement = globalThis.HTMLElement;
  globalThis.HTMLElement = args[0].document.body.constructor;
  const timers = new Set();
  globalThis.setTimeout = (...params) => { const id = nativeTimeout(...params); timers.add(id); return id; };
  try { return fn(...args); } finally {
    for (const id of timers) clearTimeout(id);
    globalThis.setTimeout = nativeTimeout;
    if (nativeElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = nativeElement;
  }
});

const keyOf = (node) => (node.dataset?.key ? `item:${node.dataset.key}` : node.classList?.contains('list') ? 'list' : null);
const item = (key, text) => {
  const node = document.createElement('div');
  node.dataset.key = key;
  node.textContent = text;
  return node;
};

test('patchChildren keeps unchanged keyed nodes, replaces the changed one and inserts the new one', () => {
  withDom(() => {
    const parent = document.createElement('div');
    for (const [key, text] of [['a', 'A'], ['b', 'B'], ['c', 'C']]) parent.appendChild(item(key, text));
    const [a, b, c] = [...parent.children];
    const stats = patchChildren(parent, [item('a', 'A'), item('b', 'B2'), item('n', 'N'), item('c', 'C')], { keyOf });
    assert.deepEqual([...parent.children].map((node) => node.dataset.key), ['a', 'b', 'n', 'c']);
    assert.equal(parent.children[0], a, 'an unchanged node is the same node');
    assert.notEqual(parent.children[1], b, 'a changed node is replaced');
    assert.equal(parent.children[1].textContent, 'B2');
    assert.equal(parent.children[3], c, 'a node after an insertion is not rebuilt');
    assert.deepEqual(stats, { kept: 2, replaced: 1, inserted: 1 });
  });
});

test('patchChildren drops removed nodes without touching the rest and keeps a container with changed contents', () => {
  withDom(() => {
    const parent = document.createElement('div');
    const list = document.createElement('div');
    list.classList.add('list');
    for (const key of ['a', 'b', 'c']) list.appendChild(item(key, key));
    parent.appendChild(list);
    const [a, , c] = [...list.children];
    const nextList = document.createElement('div');
    nextList.classList.add('list');
    for (const key of ['a', 'c']) nextList.appendChild(item(key, key));
    patchChildren(parent, [nextList], { keyOf, isContainer: (key) => key === 'list' });
    assert.equal(parent.children[0], list, 'the list container stays');
    assert.deepEqual([...list.children].map((node) => node.dataset.key), ['a', 'c']);
    assert.equal(list.children[0], a);
    assert.equal(list.children[1], c);
  });
});

test('Deck editor: adding a card keeps the lists, the panes and the cards it did not touch', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  const registries = createRegistries(contentBundle);
  withDom(() => {
    const run = createRunState({ seed: 0x5eed, classId: 'reaver', registries, combatExpansionVersion: 1 });
    run.sideboard = [];
    const editor = mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: 1 }, onDone() {}, onCancel() {} });
    const root = editor.root;
    const panes = root.querySelector('.deck-editor-panes');
    const collectionList = root.querySelector('[data-pane="collection"] .deck-editor-list');
    const tiles = [...root.querySelectorAll('.deck-editor-tile')];
    const addable = tiles.find((tile) => !tile.classList.contains('spent') && tile.querySelector('.deck-editor-step[data-action="add"]'));
    assert.ok(addable, 'a collection card can be added');
    const untouched = tiles.filter((tile) => tile !== addable && tile.dataset.key !== addable.dataset.key);
    assert.ok(untouched.length > 2, 'there are other cards to keep');
    const deckBefore = run.deck.length;
    addable.querySelector('.deck-editor-step[data-action="add"]').click();
    assert.equal(run.deck.length, deckBefore + 1, 'the card was added');
    assert.equal(root.querySelector('.deck-editor-panes'), panes, 'the panes element is the same node');
    assert.equal(root.querySelector('[data-pane="collection"] .deck-editor-list'), collectionList, 'the collection list is the same node');
    const keptCount = untouched.filter((tile) => root.contains(tile) && collectionList.contains(tile)).length;
    assert.equal(keptCount, untouched.length, 'every card the action did not touch is still the same node');
    editor.close?.();
  });
});
