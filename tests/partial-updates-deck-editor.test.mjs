// The deck editor updates the part that changed (CLEAN-CODE-PROMPT §3): a filter or sort chip
// rebuilds the two lists, the display chip the deck list, a pick only the held row, a refusal only
// the line beside Done. Each test holds the nodes that must survive and checks they are the same.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { deckEditorModel } from '../src/ui/models/DeckEditorModel.js';
import { deckEditorCollectionRows } from '../src/ui/models/deckEditorCollectionRows.js';
import { setKeyBindings } from '../src/ui/input.js';
import { withModalDom } from './helpers/dom.mjs';

const REG = createRegistries(contentBundle);
const freshRun = () => createRunState({ seed: 0x5eed, classId: 'reaver', registries: REG, combatExpansionVersion: 1 });
setKeyBindings(null);

// The editor's confirmation keeps a short timer; keep it inside the fixture (as deck-editor.test.mjs does).
const withDom = fn => withModalDom((...args) => {
  const nativeTimeout = globalThis.setTimeout;
  const nativeElement = globalThis.HTMLElement;
  globalThis.HTMLElement = args[0].document.body.constructor;
  const timers = new Set();
  globalThis.setTimeout = (...params) => { const id = nativeTimeout(...params); timers.add(id); return id; };
  try { return fn(...args); }
  finally {
    for (const id of timers) clearTimeout(id);
    globalThis.setTimeout = nativeTimeout;
    if (nativeElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = nativeElement;
  }
});

const { mountDeckEditor } = await import('../src/ui/screens/deckEditor.js');
const byKey = (root, key) => root.querySelector(`[data-focus-key="${key}"]`);
const listOf = (root, pane) => root.querySelector(`[data-pane="${pane}"] .deck-editor-list`);
// The keys the screen lists: the model's collection as the screen folds it (deckEditorCollectionRows).
const collectionKeys = (run, view) => deckEditorCollectionRows({ registries: REG, run, collection: deckEditorModel({ registries: REG, run, view }).collection }).map(row => row.key);
const keysOf = (nodes, name) => [...nodes].map(node => node.dataset[name]);
const frame = (root) => ({
  panel: root.querySelector('.deck-editor'),
  head: root.querySelector('.deck-editor-head'),
  panes: root.querySelector('.deck-editor-panes'),
  footer: root.querySelector('.deck-editor-footer'),
  tools: root.querySelector('.deck-editor-tools'),
  inspector: root.querySelector('.deck-editor-inspector'),
});
// A press focuses the control first, as in a browser, so the editor's focus key names it.
const assertSameFrame = (root, before) => {
  for (const [name, node] of Object.entries(frame(root))) assert.equal(node, before[name], `the ${name} is the same node`);
};

test('deck editor: a filter chip marks itself and rebuilds only the two lists', () => {
  withDom(() => {
    const run = freshRun();
    const editor = mountDeckEditor(document.body, { registries: REG, run });
    const root = editor.root;
    const before = frame(root);
    const [type] = deckEditorModel({ registries: REG, run }).filters.type;
    const chip = byKey(root, `filter:type:${type.id}`);
    const otherChip = byKey(root, 'filter:upgraded');
    const deckList = listOf(root, 'deck');
    chip.focus();
    chip.click();
    assertSameFrame(root, before);
    assert.equal(byKey(root, `filter:type:${type.id}`), chip, 'the chip is the same node');
    assert.equal(byKey(root, 'filter:upgraded'), otherChip, 'its siblings are the same nodes');
    assert.equal(chip.getAttribute('aria-pressed'), 'true');
    assert.ok(chip.classList.contains('on'));
    assert.equal(otherChip.getAttribute('aria-pressed'), 'false');
    assert.notEqual(listOf(root, 'deck'), deckList, 'the deck list was rebuilt');
    const expected = collectionKeys(run, { filters: { type: [type.id] } });
    assert.deepEqual(keysOf(listOf(root, 'collection').querySelectorAll('.deck-editor-tile'), 'key'), expected, 'the collection shows the filtered rows');
    chip.click();
    assert.equal(chip.getAttribute('aria-pressed'), 'false', 'a second press turns it off in place');
    editor.close();
  });
});

test('deck editor: a sort chip moves the mark between the sort chips and reorders the lists', () => {
  withDom(() => {
    const run = freshRun();
    const editor = mountDeckEditor(document.body, { registries: REG, run });
    const root = editor.root;
    const before = frame(root);
    const byCost = byKey(root, 'sort:cost');
    const byName = byKey(root, 'sort:name');
    byName.focus();
    byName.click();
    assertSameFrame(root, before);
    assert.equal(byKey(root, 'sort:name'), byName);
    assert.equal(byName.getAttribute('aria-pressed'), 'true');
    assert.equal(byCost.getAttribute('aria-pressed'), 'false');
    assert.equal(byCost.classList.contains('on'), false);
    const expected = collectionKeys(run, { sort: 'name' });
    assert.deepEqual(keysOf(listOf(root, 'collection').querySelectorAll('.deck-editor-tile'), 'key'), expected);
    editor.close();
  });
});

test('deck editor: the display chip rebuilds only the deck list', () => {
  withDom(() => {
    const run = freshRun();
    const editor = mountDeckEditor(document.body, { registries: REG, run });
    const root = editor.root;
    const before = frame(root);
    const collection = listOf(root, 'collection');
    const asList = byKey(root, 'display:list');
    const asCards = byKey(root, 'display:cards');
    asCards.focus();
    asCards.click();
    assertSameFrame(root, before);
    assert.equal(listOf(root, 'collection'), collection, 'the collection list is the same node');
    assert.equal(byKey(root, 'display:cards'), asCards);
    assert.equal(asCards.getAttribute('aria-pressed'), 'true');
    assert.equal(asList.getAttribute('aria-pressed'), 'false');
    assert.ok(listOf(root, 'deck').classList.contains('deck-editor-display-cards'));
    assert.equal(listOf(root, 'deck').querySelector('.deck-editor-main').dataset.illustrated, 'true');
    editor.close();
  });
});

test('deck editor: picking a row up sets only that row\'s held state and the keys line', () => {
  withDom(() => {
    const run = freshRun();
    const editor = mountDeckEditor(document.body, { registries: REG, run, settings: { playInDeckOrder: true } });
    const root = editor.root;
    const before = frame(root);
    const deckList = listOf(root, 'deck');
    const rows = [...root.querySelectorAll('.deck-editor-row')];
    const [first, second] = rows;
    const pick = first.querySelector('.deck-editor-pick');
    const keys = root.querySelector('.deck-editor-keys');
    const idle = keys.textContent;
    pick.focus();
    pick.click();
    assertSameFrame(root, before);
    assert.equal(listOf(root, 'deck'), deckList, 'the deck list is the same node');
    assert.deepEqual([...root.querySelectorAll('.deck-editor-row')], rows, 'every row is the same node');
    assert.ok(first.classList.contains('held'));
    assert.equal(second.classList.contains('held'), false);
    assert.equal(pick.getAttribute('aria-pressed'), 'true');
    assert.equal(pick.classList.contains('is-selected'), false, 'no class the full draw would not give');
    assert.equal(root.querySelector('.deck-editor-keys'), keys);
    assert.notEqual(keys.textContent, idle, 'the keys line names the held card');
    pick.click();
    assert.equal(first.classList.contains('held'), false, 'a second press drops it in place');
    assert.equal(pick.getAttribute('aria-pressed'), 'false');
    assert.equal(keys.textContent, idle);
    editor.close();
  });
});

test('deck editor: a refused tab change shows only the refusal line beside Done', () => {
  withDom(() => {
    const run = freshRun();
    let navigated = 0;
    const editor = mountDeckEditor(document.body, {
      registries: REG, run, settings: { deckMinSize: run.deck.length + 5 }, onNavigate: () => { navigated += 1; },
    });
    const root = editor.root;
    const before = frame(root);
    const line = root.querySelector('#deck-editor-refusal');
    const done = root.querySelector('#deck-editor-done');
    line.textContent = '';
    line.setAttribute('hidden', 'true');
    root.querySelector('[data-modal-tab="armory"]').click();
    assert.equal(navigated, 0, 'the refusal keeps the editor open');
    assertSameFrame(root, before);
    assert.equal(root.querySelector('#deck-editor-refusal'), line, 'the line is the same node');
    assert.equal(root.querySelector('#deck-editor-done'), done, 'Done is the same node');
    assert.equal(line.hasAttribute('hidden'), false);
    assert.match(line.textContent, /\d/, 'the line names the count and the bound');
    assert.equal(root.querySelector('[data-modal-tab="armory"]').getAttribute('aria-selected'), 'false', 'the refused tab is not marked');
    assert.equal(root.querySelector('[data-modal-tab="deck"]').getAttribute('aria-selected'), 'true', 'the Deck tab stays marked');
    editor.close();
  });
});
