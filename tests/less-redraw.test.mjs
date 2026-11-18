// tests/less-redraw.test.mjs — owner, 2026-11-18: "limit the redrawing that happens when upgrading a card,
// editing a deck, or anything else that influences small changes". A small action changes only the nodes it
// affects: the list containers, the cards it did not touch and the scroll position stay; nothing is rebuilt.
//   node --test tests/less-redraw.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { PatchChildren } from '../src/ui/keyedPatch.js';
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

test('PatchChildren keeps unchanged keyed nodes, replaces the changed one and inserts the new one', () => {
  withDom(() => {
    const parent = document.createElement('div');
    for (const [key, text] of [['a', 'A'], ['b', 'B'], ['c', 'C']]) parent.appendChild(item(key, text));
    const [a, b, c] = [...parent.children];
    const stats = PatchChildren(parent, [item('a', 'A'), item('b', 'B2'), item('n', 'N'), item('c', 'C')], { keyOf });
    assert.deepEqual([...parent.children].map((node) => node.dataset.key), ['a', 'b', 'n', 'c']);
    assert.equal(parent.children[0], a, 'an unchanged node is the same node');
    assert.notEqual(parent.children[1], b, 'a changed node is replaced');
    assert.equal(parent.children[1].textContent, 'B2');
    assert.equal(parent.children[3], c, 'a node after an insertion is not rebuilt');
    assert.deepEqual(stats, { kept: 2, replaced: 1, inserted: 1 });
  });
});

test('PatchChildren drops removed nodes without touching the rest and keeps a container with changed contents', () => {
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
    PatchChildren(parent, [nextList], { keyOf, isContainer: (key) => key === 'list' });
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

// ---- the deck editor's tags, default sort and manual order (owner, 2026-11-18) -------------------------------------
const { deckEditorModel } = await import('../src/ui/models/DeckEditorModel.js');
const REG = createRegistries(contentBundle);
const fresh = () => createRunState({ seed: 0x5eed, classId: 'reaver', registries: REG, combatExpansionVersion: 1 });

test('REWARD is only for cards collected during the run; a starter never has it; a weapon art has ART, not REWARD', () => {
  const run = fresh();
  assert.ok(run.starterCardIds.length > 0, 'the opening deck is recorded as the starters');
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  const rows = [...model.deck, ...model.collection];
  for (const row of rows.filter((r) => run.starterCardIds.includes(r.cardId))) assert.equal(row.rewardTag, false, `${row.cardId} is a starter`);
  // A card the run picks up later: a class pool card that is not one of the starters.
  const reward = REG.classes.get('reaver').cardPool.find((id) => !run.starterCardIds.includes(id) && !run.deck.some((c) => c.cardId === id)
    && deckEditorModel({ registries: REG, run: { ...run, deck: [...run.deck, { instanceId: 'probe', cardId: id }] }, settings: {} }).deck.find((r) => r.cardId === id)?.source === 'reward');
  assert.ok(reward, 'the class pool holds a card the run did not start with');
  run.deck.push({ instanceId: 'collected1', cardId: reward, upgraded: false });
  const withReward = deckEditorModel({ registries: REG, run, settings: {} });
  const collected = [...withReward.deck, ...withReward.collection].find((r) => r.cardId === reward);
  assert.equal(collected.source, 'reward');
  assert.equal(collected.rewardTag, true, 'a card collected during the run is REWARD');
  const arts = rows.filter((r) => r.artTag);
  assert.ok(arts.length > 0, 'the weapon art granted by the weapon is tagged ART');
  for (const art of arts) assert.equal(art.rewardTag, false);
});

test('the default order: in the deck first, weapon arts first, then total cost, then name; a manual order overrides it', () => {
  const run = fresh();
  const model = deckEditorModel({ registries: REG, run, settings: {} });
  const rest = model.collection.filter((tile) => tile.source !== 'basic');
  const split = rest.findIndex((tile) => !(tile.inDeck > 0));
  assert.ok(rest.slice(0, split < 0 ? rest.length : split).every((tile) => tile.inDeck > 0), 'cards in the deck come first');
  for (const group of [rest.filter((t) => t.inDeck > 0), rest.filter((t) => !(t.inDeck > 0))]) {
    const keyed = group.map((t) => [t.artTag ? 0 : 1, t.totalCost, t.name]);
    const sorted = [...keyed].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]));
    assert.deepEqual(keyed, sorted, 'weapon arts, then total cost, then name');
  }
  const keys = model.collection.map((tile) => tile.key);
  run.deckEditorOrder = { collection: [...keys].reverse() };
  const manual = deckEditorModel({ registries: REG, run, settings: {} });
  assert.deepEqual(manual.collection.map((tile) => tile.key), [...keys].reverse(), 'the manual order wins');
});

test('Deck editor: dragging a card onto another reorders the list, keeps the other nodes, persists on the run and Sort restores the default', async () => {
  const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
  withDom((dom) => {
    const run = fresh();
    const changes = [];
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: {}, dragHoldMs: 0, onOrderChange: (order) => changes.push(order) });
    const root = editor.root;
    const list = root.querySelector('[data-pane="collection"] .deck-editor-list');
    const tiles = () => [...root.querySelectorAll('.deck-editor-tile')];
    const [first, second, third] = tiles();
    const before = tiles().map((tile) => tile.dataset.key);
    document.elementFromPoint = () => third;
    const fire = (node, type, y) => node.dispatchEvent(new dom.Event(type, { bubbles: true, pointerId: 3, pointerType: 'mouse', button: 0, clientX: 10, clientY: y }));
    const main = first.querySelector('.deck-editor-main');
    fire(main, 'pointerdown', 10);
    fire(main, 'pointermove', 80);
    fire(main, 'pointerup', 80);
    document.elementFromPoint = null;
    const after = tiles().map((tile) => tile.dataset.key);
    assert.notDeepEqual(after, before, 'the drop changed the order');
    assert.equal(after[2], before[0], 'the dragged card took the dropped-on place');
    assert.equal(root.querySelector('[data-pane="collection"] .deck-editor-list'), list, 'the list node is the same node');
    assert.ok(tiles().includes(second), 'a card the drag did not touch is the same node');
    assert.deepEqual(run.deckEditorOrder.collection.slice(0, 3), after.slice(0, 3), 'the manual order is kept on the run');
    assert.equal(changes.length, 1, 'the host is told, so it can save');
    const sortChip = root.querySelector('[data-focus-key="sort:default"]');
    sortChip.click();
    assert.equal(run.deckEditorOrder, undefined, 'Sort clears the manual order');
    assert.deepEqual(tiles().map((tile) => tile.dataset.key), before, 'and the default order is back');
    editor.close?.();
  });
});
