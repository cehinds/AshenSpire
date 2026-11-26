import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deckCatalogOptions, resolveStudioDeck, filterMembership } from '../tools/score-studio/deckCatalog.js';
import { copyDeckList, groupedDeckCards, groupedDeckItems, removeSelectedItemsFromDeck } from '../tools/score-studio/deckListPanel.js';
import { removeSelectedCardsFromDeck } from '../tools/score-studio/cardSelection.js';
import { GenerateSubclassCatalog } from '../src/model/subclassCardGenerator.js';

function generatedState() {
  const catalog = GenerateSubclassCatalog({ seed: 'deck-catalog' });
  const base = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
  return { cards: [...base, ...catalog.cards], items: [],
    customClasses: [], customDecks: catalog.lists.map(list => ({ id: `subclass-list.${list.id}`, name: list.name, assignedClassId: list.classId, cardIds: list.cardIds, itemKeys: [] })) };
}

test('class views include the actual generated and original class cards without persisting virtual decks', () => {
  const state = generatedState(), snapshot = structuredClone(state);
  const reaver = resolveStudioDeck(state, 'class:reaver');
  assert.equal(reaver.cardIds.filter(id => id.startsWith('subclass.')).length, 45);
  assert.equal(reaver.cardIds.length, 50); assert.equal(new Set(reaver.cardIds).size, 50);
  assert.ok(reaver.cardIds.every(id => state.cards.find(card => card.id === id).class === 'reaver'));
  const native = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
  const shared = resolveStudioDeck(state, 'class:colorless').cardIds;
  assert.deepEqual(shared, native.filter(card => card.class === 'colorless').map(card => card.id));
  const starseer = resolveStudioDeck(state, 'class:starseer').cardIds;
  const manaRite = native.find(card => card.id === 'core.arcaneSiphon');
  assert.equal(manaRite.class, 'starseer'); assert.equal(manaRite.name, 'Mana Rite');
  assert.ok(starseer.includes(manaRite.id)); assert.ok(!shared.includes(manaRite.id));
  assert.deepEqual(resolveStudioDeck(state, 'all').cardIds, [...new Set(state.cards.map(card => card.id))]);
  assert.equal(reaver.readOnly, true); assert.equal(reaver.virtual, true);
  assert.equal(groupedDeckCards(state, 'class:reaver').shown, 50);
  assert.deepEqual(state, snapshot);
});

test('user decks remain Custom even when assigned a class; only subclass templates are class lists', () => {
  const state = { cards: [], items: [], customClasses: [{ id: 'custom_scholar', name: 'Scholar' }], customDecks: [
    { id: 'deck_martial', name: 'My Reaver', assignedClassId: 'reaver', cardIds: [], itemKeys: [], isActiveDeckList: true },
    { id: 'subclass-list.bloodletter', name: 'Bloodletter', assignedClassId: 'reaver', cardIds: [], itemKeys: [] },
  ] };
  const options = deckCatalogOptions(state);
  assert.deepEqual(options[0], { id: 'all', value: 'all', name: 'All', label: 'All', group: null, kind: 'all', readOnly: true, cardCount: 0, itemCount: 0 });
  const custom = options.find(row => row.value === 'deck_martial');
  assert.equal(custom.kind, 'custom'); assert.equal(custom.group, 'Custom decks'); assert.match(custom.label, /My Reaver · Custom.*Active/);
  assert.equal(options.find(row => row.id === 'subclass-list.bloodletter').group, 'Class decks');
  assert.equal(options.find(row => row.id === 'class:custom_scholar').label, 'Scholar · Class');
  assert.equal(options.find(row => row.id === 'class:colorless').label, 'Shared · Class');
});

test('item class views obey authored class fields, default only neutral items to Shared, and filter custom item membership', () => {
  const state = { cards: [{ id: 'classless', name: 'Imported neutral' }], items: [
    { key: 'a', name: 'A', kind: 'weapon', class: 'reaver', classId: 'rogue' },
    { key: 'b', name: 'B', kind: 'armour', classId: 'rogue' },
    { key: 'c', name: 'C', kind: 'relic', assignedClassId: 'herald' },
    { key: 'neutral', name: 'Neutral', kind: 'relic' },
  ], customDecks: [{ id: 'my_items', name: 'Equipment', cardIds: [], itemKeys: ['b', 'neutral'] }] };
  assert.deepEqual([...filterMembership(state, 'class:reaver', 'items')], ['a']);
  assert.deepEqual([...filterMembership(state, 'class:rogue', 'items')], ['b']);
  assert.deepEqual([...filterMembership(state, 'class:herald', 'items')], ['c']);
  assert.deepEqual([...filterMembership(state, 'class:colorless', 'items')], ['neutral']);
  assert.deepEqual([...filterMembership(state, 'class:colorless', 'cards')], ['classless']);
  assert.deepEqual([...filterMembership(state, 'my_items', 'items')], ['b', 'neutral']);
  assert.equal(groupedDeckItems(state, 'class:rogue').groups[0].items[0].key, 'b');
  assert.equal(filterMembership(state, 'all', 'items'), null);
});

test('copying a virtual class deck makes an editable Custom deck while the class aggregate stays unchanged', () => {
  const state = generatedState();
  state.items = [{ key: 'weapon.reaver', name: 'Sword', kind: 'weapon', class: 'reaver' }];
  const original = resolveStudioDeck(state, 'class:reaver');
  const created = copyDeckList(state, 'class:reaver', 'My build');
  const next = { ...state, customDecks: created.customDecks };
  assert.deepEqual(created.deck.cardIds, original.cardIds); assert.deepEqual(created.deck.itemKeys, ['weapon.reaver']);
  assert.equal(created.deck.assignedClassId, 'reaver'); assert.equal(resolveStudioDeck(next, created.deck.id).readOnly, false);
  const oneCard = created.deck.cardIds[0];
  next.customDecks = removeSelectedCardsFromDeck(next.customDecks, created.deck.id, [oneCard]);
  next.customDecks = removeSelectedItemsFromDeck(next.customDecks, created.deck.id, ['weapon.reaver']);
  assert.equal(resolveStudioDeck(next, created.deck.id).cardIds.length, original.cardIds.length - 1); assert.equal(resolveStudioDeck(next, created.deck.id).itemKeys.length, 0);
  assert.deepEqual(resolveStudioDeck(next, 'class:reaver'), original);
  assert.equal(deckCatalogOptions(next).find(row => row.id === created.deck.id).group, 'Custom decks');
  assert.throws(() => removeSelectedCardsFromDeck(state.customDecks, 'class:reaver', [oneCard]), /Choose a deck/);
});

test('missing IDs are reported without losing references; invalid/deleted filters match nothing', () => {
  const state = { cards: [{ id: 'known', class: 'reaver' }], items: [], customDecks: [{ id: 'partial', name: 'Partial', cardIds: ['known', 'missing', 'known'], itemKeys: ['missing.item'] }] };
  const view = resolveStudioDeck(state, 'partial');
  assert.deepEqual(view.cardIds, ['known', 'missing']); assert.deepEqual(view.missingCardIds, ['missing']); assert.deepEqual(view.missingItemKeys, ['missing.item']);
  assert.equal(resolveStudioDeck(state, 'class:invented'), null);
  assert.equal(resolveStudioDeck(state, 'deleted'), null); assert.deepEqual([...filterMembership(state, 'deleted')], []);
  assert.deepEqual([...filterMembership(state, 'class:invented', 'items')], []);
});
