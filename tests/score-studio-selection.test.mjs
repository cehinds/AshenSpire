import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedCards, addSelectedCardsToDeck, removeSelectedCardsFromDeck, renameSelectedCards, removeAddedCardsFromState, removeCardsAndReferences, createCardSelectionMode } from '../tools/score-studio/cardSelection.js';
import { groupedDeckCards, createDeckFromSelection, groupedDeckItems, addSelectedItemsToDeck, removeSelectedItemsFromDeck, createDeckFromItems, copyDeckList } from '../tools/score-studio/deckListPanel.js';

const cards = () => [
  { id: 'core.original', name: 'Original', class: 'reaver' },
  { id: 'custom.first', name: 'First', class: 'reaver', _custom: true },
  { id: 'subclass.bloodletter.second', name: 'Second', class: 'reaver', _generated: true },
  { id: 'custom.hidden', name: 'Hidden', class: 'rogue', _custom: true },
];
const decks = () => [
  { id: 'deck_a', name: 'A', cardIds: ['core.original', 'custom.first'], itemKeys: ['weapon.a'] },
  { id: 'deck_b', name: 'B', cardIds: ['custom.first', 'custom.hidden'], notes: 'Keep these notes' },
  { id: 'subclass-list.bloodletter', name: 'Bloodletter', cardIds: ['subclass.bloodletter.second'], assignedClassId: 'reaver' },
];

test('explicit quota trims remove exactly authorized Core and added IDs from all references without weakening normal Delete protection',()=>{
  const state={cards:cards(),customDecks:decks(),items:[{key:'weapon.a'}],
    customClasses:[{id:'custom.class',deckId:'subclass-list.bloodletter'}],
    subclassCatalog:{lists:[{id:'bloodletter',cardIds:['subclass.bloodletter.second']}],cards:[cards()[2]],metadata:[{cardId:'subclass.bloodletter.second'}]},
    baselineRanks:{'core.original':1,'custom.first':2,'subclass.bloodletter.second':3,'custom.hidden':4},
    scoring:{overrides:{'core.original':{rank:1},'subclass.bloodletter.second':{rank:3},'custom.hidden':{rank:4}}},
    sandbox:{customCardId:'subclass.bloodletter.second',other:'keep'}};
  const saved=structuredClone(state),ids=['core.original','subclass.bloodletter.second','unknown'];
  const plan=removeCardsAndReferences(state,ids);
  assert.deepEqual(state,saved);assert.deepEqual(plan.removedIds,['core.original','subclass.bloodletter.second']);
  assert.deepEqual(plan.nextState.cards.map(card=>card.id),['custom.first','custom.hidden']);
  assert.ok(plan.nextState.customDecks.every(deck=>deck.cardIds.every(id=>!ids.includes(id))));
  assert.equal(plan.nextState.subclassCatalog,null);assert.equal(plan.nextState.customClasses[0].deckId,null);assert.equal(plan.nextState.sandbox.customCardId,null);
  assert.deepEqual(plan.nextState.scoring.overrides,{'custom.hidden':{rank:4}});assert.equal(plan.nextState.items,state.items);
  const ordinary=removeAddedCardsFromState(state,ids);assert.deepEqual(ordinary.protectedIds,['core.original']);assert.ok(ordinary.nextState.cards.some(card=>card.id==='core.original'));
});

test('selection mode starts off, gates checkbox selection, and clears hidden selections when disabled', () => {
  const mode = createCardSelectionMode();
  assert.equal(mode.enabled, false);
  mode.toggle('custom.first', true);
  assert.deepEqual([...mode.selected], []);
  mode.setEnabled(true); mode.toggle('custom.first', true); mode.toggle('custom.hidden', true);
  assert.deepEqual([...mode.selected], ['custom.first', 'custom.hidden']);
  mode.toggle('custom.first', false);
  assert.deepEqual([...mode.selected], ['custom.hidden']);
  mode.setEnabled(false);
  assert.equal(mode.enabled, false); assert.deepEqual([...mode.selected], []);
  mode.setEnabled(true); assert.deepEqual([...mode.selected], []);
});

test('selection membership is unique and an Add placeholder can never become a selected card', () => {
  const mode = createCardSelectionMode(); mode.setEnabled(true);
  mode.toggle('custom.first', true); mode.toggle('custom.first', true); mode.toggle('add-card-placeholder', true);
  assert.deepEqual(selectedCards(cards(), mode.selected).map(card => card.id), ['custom.first']);
  mode.toggle('custom.first'); assert.deepEqual(selectedCards(cards(), mode.selected), []);
});

test('selection uses exact IDs across classes and filters, ignores unknown IDs and deduplicates', () => {
  const chosen = selectedCards(cards(), new Set(['custom.hidden', 'missing', 'custom.first']));
  assert.deepEqual(chosen.map(card => card.id), ['custom.first', 'custom.hidden']);
  assert.deepEqual(selectedCards(cards(), ['custom.first', 'custom.first']).map(card => card.id), ['custom.first']);
});

test('add selection prevents duplicates and changes only the target custom deck', () => {
  const before = decks(), snapshot = structuredClone(before);
  const after = addSelectedCardsToDeck(before, 'deck_a', ['custom.first', 'custom.hidden', 'custom.hidden']);
  assert.deepEqual(after[0].cardIds, ['core.original', 'custom.first', 'custom.hidden']);
  assert.deepEqual(after[0].itemKeys, ['weapon.a']);
  assert.equal(after[1], before[1]); assert.equal(after[2], before[2]);
  assert.deepEqual(before, snapshot);
  assert.throws(() => addSelectedCardsToDeck(before, 'subclass-list.bloodletter', ['core.original']), /templates/);
  assert.throws(() => addSelectedCardsToDeck(before, 'missing', []), /Choose a deck/);
});

test('remove selection changes only membership in the target deck, preserving gallery and other decks', () => {
  const before = decks(), gallery = cards(), snapshot = structuredClone(before);
  const after = removeSelectedCardsFromDeck(before, 'deck_a', ['custom.first', 'custom.hidden']);
  assert.deepEqual(after[0].cardIds, ['core.original']);
  assert.equal(after[1], before[1]); assert.equal(after[2], before[2]);
  assert.equal(gallery.length, 4); assert.deepEqual(before, snapshot);
  assert.throws(() => removeSelectedCardsFromDeck(before, 'subclass-list.bloodletter', ['subclass.bloodletter.second']), /template/);
});

test('bulk rename changes only selected cards and numbers in gallery order, including hidden selections', () => {
  const before = cards(), snapshot = structuredClone(before);
  const after = renameSelectedCards(before, ['custom.hidden', 'custom.first'], { prefix: '[', suffix: ']', pattern: '{n}: {name}', start: 7 });
  assert.deepEqual(after.map(card => card.name), ['Original', '[7: First]', 'Second', '[8: Hidden]']);
  assert.equal(after[0], before[0]); assert.equal(after[2], before[2]);
  assert.equal(after[1]._autoName, false); assert.equal(after[1]._edited, true);
  assert.deepEqual(before, snapshot);
  assert.throws(() => renameSelectedCards(before, ['custom.first'], { start: -1 }), /non-negative/);
  assert.throws(() => renameSelectedCards(before, ['custom.first'], { pattern: ' ' }), /1–120/);
  assert.equal(renameSelectedCards([{ id: 'custom.literal', name: '$&' }], ['custom.literal'], { pattern: '{name} {n}' })[0].name, '$& 1');
});

test('remove added cards cleans every deck and subclass reference while preserving originals and unrelated state', () => {
  const state = { cards: cards(), customDecks: decks(), selectedCardId: 'subclass.bloodletter.second',
    subclassCatalog: { seed: 'keep', lists: [{ id: 'bloodletter', classId: 'reaver', cardIds: ['subclass.bloodletter.second'] }], cards: [cards()[2]], metadata: [{ cardId: 'subclass.bloodletter.second', requestedRank: 2 }] },
    customClasses: [{ id: 'custom_class', deckId: 'subclass-list.bloodletter' }, { id: 'unrelated_class', deckId: 'previously_missing_deck' }],
    baselineRanks: { 'core.original': 1, 'custom.first': 2 },
    scoring: { costs: { sp: 1 }, overrides: { 'custom.first': { rank: 2 }, 'core.original': { rank: 1 } } },
    sandbox: { customCardId: 'custom.first', log: ['Keep log'] },
  };
  const snapshot = structuredClone(state);
  const { nextState, removedIds, protectedIds } = removeAddedCardsFromState(state, ['core.original', 'custom.first', 'subclass.bloodletter.second']);
  assert.deepEqual(removedIds, ['custom.first', 'subclass.bloodletter.second']);
  assert.deepEqual(protectedIds, ['core.original']);
  assert.deepEqual(nextState.cards.map(card => card.id), ['core.original', 'custom.hidden']);
  assert.deepEqual(nextState.customDecks.map(deck => deck.cardIds), [['core.original'], ['custom.hidden']]);
  assert.deepEqual(nextState.customDecks[0].itemKeys, ['weapon.a']);
  assert.equal(nextState.subclassCatalog, null);
  assert.equal(nextState.customClasses[0].deckId, null);
  assert.equal(nextState.customClasses[1].deckId, 'previously_missing_deck');
  assert.equal(
    nextState.selectedCardId,
    null,
    'removal makes no replacement choice; the caller names one',
  );
  assert.deepEqual(nextState.scoring.overrides, { 'core.original': { rank: 1 } });
  assert.deepEqual(nextState.baselineRanks, { 'core.original': 1 });
  assert.deepEqual(nextState.sandbox, { customCardId: null, log: ['Keep log'] });
  assert.deepEqual(state, snapshot);
});

test('deleting a subset keeps surviving subclass list cards and metadata exportable', () => {
  const state = { cards: cards(), customDecks: [{ id: 'subclass-list.bloodletter', cardIds: ['subclass.bloodletter.second', 'custom.first'], subclassMetadata: [{ cardId: 'subclass.bloodletter.second' }, { cardId: 'custom.first' }] }],
    subclassCatalog: { lists: [{ id: 'bloodletter', cardIds: ['subclass.bloodletter.second', 'custom.first'] }], metadata: [{ cardId: 'subclass.bloodletter.second' }, { cardId: 'custom.first' }] } };
  const { nextState } = removeAddedCardsFromState(state, ['custom.first']);
  assert.deepEqual(nextState.subclassCatalog.lists[0].cardIds, ['subclass.bloodletter.second']);
  assert.deepEqual(nextState.subclassCatalog.metadata, [{ cardId: 'subclass.bloodletter.second' }]);
  assert.deepEqual(nextState.customDecks[0].subclassMetadata, [{ cardId: 'subclass.bloodletter.second' }]);
});

test('original Core cards remain protected even if a prior operation marked one generated', () => {
  const state = { cards: [{ id: 'core.original', name: 'Keep', _generated: true }], customDecks: [] };
  const result = removeAddedCardsFromState(state, ['core.original']);
  assert.equal(result.nextState, state); assert.deepEqual(result.removedIds, []);
});

test('deck panel groups only target-deck members into stable class/type rows, independent of gallery filters', () => {
  const state = { cards: cards().map((card, index) => ({ ...card, type: index % 2 ? 'skill' : 'attack', rarity: index % 2 ? 'uncommon' : 'common' })), customDecks: decks() };
  const before = structuredClone(state);
  const view = groupedDeckCards(state, 'deck_b');
  assert.equal(view.total, 2); assert.equal(view.shown, 2);
  assert.deepEqual(view.groups.map(group => [group.classId, group.type, group.cards.map(card => card.id)]), [['reaver', 'skill', ['custom.first']], ['rogue', 'skill', ['custom.hidden']]]);
  const filtered = groupedDeckCards(state, 'deck_b', 'Hidden');
  assert.equal(filtered.total, 2); assert.equal(filtered.shown, 1); assert.equal(filtered.groups[0].cards[0].id, 'custom.hidden');
  assert.deepEqual(state, before);
  assert.equal(groupedDeckCards(state, 'missing').deck, null);
});

test('creating a custom deck from selected/template cards deduplicates, ignores missing IDs and preserves template membership', () => {
  const state = { cards: cards(), customDecks: decks() }, before = structuredClone(state);
  const created = createDeckFromSelection(state, 'Bloodletter deck', ['subclass.bloodletter.second', 'subclass.bloodletter.second', 'missing']);
  assert.deepEqual(created.deck.cardIds, ['subclass.bloodletter.second']);
  assert.equal(created.deck.id.startsWith('subclass-list.'), false);
  assert.equal(created.customDecks.length, 4);
  assert.deepEqual(created.customDecks[2], state.customDecks[2]); assert.deepEqual(state, before);
});

test('deck panel reports missing references without confusing them with another deck or deleting them', () => {
  const state = { cards: cards(), customDecks: [{ id: 'partial', cardIds: ['custom.first', 'unavailable', 'custom.first'] }] };
  const result = groupedDeckCards(state, 'partial');
  assert.equal(result.total, 2); assert.equal(result.shown, 1); assert.deepEqual(result.missingIds, ['unavailable']);
});

const items = () => [
  { key: 'weapon.a', name: 'Iron Blade', kind: 'weapon', rarity: 'common' },
  { key: 'relic.b', name: 'Ash Seal', kind: 'relic', rarity: 'rare' },
  { key: 'armour.c', name: 'Heavy Coat', kind: 'armour', rarity: 'uncommon' },
];

test('item deck rows group by kind and search item fields without leaking retained card membership', () => {
  const state = { cards: cards(), items: items(), customDecks: [{ id: 'mixed', cardIds: ['custom.first'], itemKeys: ['relic.b', 'weapon.a', 'armour.c', 'weapon.a', 'missing.item'] }] };
  const before = structuredClone(state), view = groupedDeckItems(state, 'mixed');
  assert.equal(view.total, 4); assert.equal(view.shown, 3); assert.deepEqual(view.missingKeys, ['missing.item']);
  assert.deepEqual(view.groups.map(group => [group.kind, group.items.map(item => item.key)]), [['armour', ['armour.c']], ['relic', ['relic.b']], ['weapon', ['weapon.a']]]);
  const rare = groupedDeckItems(state, 'mixed', 'rare');
  assert.equal(rare.total, 4); assert.equal(rare.shown, 1); assert.equal(rare.groups[0].items[0].key, 'relic.b');
  assert.equal(groupedDeckItems(state, 'mixed', 'custom.first').shown, 0);
  assert.equal(groupedDeckItems(state, 'missing').deck, null); assert.deepEqual(state, before);
});

test('item add/remove changes only target deck item keys, retaining its cards and other decks', () => {
  const before = [{ id: 'mixed', cardIds: ['custom.first'], itemKeys: ['weapon.a'] }, { id: 'other', cardIds: ['core.original'], itemKeys: ['weapon.a'] }], snapshot = structuredClone(before);
  const added = addSelectedItemsToDeck(before, 'mixed', ['weapon.a', 'relic.b', 'relic.b']);
  assert.deepEqual(added[0].itemKeys, ['weapon.a', 'relic.b']); assert.equal(added[0].cardIds, before[0].cardIds); assert.equal(added[1], before[1]);
  const removed = removeSelectedItemsFromDeck(added, 'mixed', ['weapon.a']);
  assert.deepEqual(removed[0].itemKeys, ['relic.b']); assert.deepEqual(removed[0].cardIds, ['custom.first']); assert.equal(removed[1], before[1]);
  assert.deepEqual(before, snapshot);
  assert.throws(() => addSelectedItemsToDeck(decks(), 'subclass-list.bloodletter', ['weapon.a']), /template/);
  assert.throws(() => removeSelectedItemsFromDeck(decks(), 'subclass-list.bloodletter', ['weapon.a']), /template/);
});

test('creating an item deck uses only existing selected items and copies no retained card selection', () => {
  const state = { cards: cards(), items: items(), customDecks: decks(), selectedCardId: 'custom.first', selectedItemKey: 'relic.b' }, snapshot = structuredClone(state);
  const created = createDeckFromItems(state, 'My items', ['relic.b', 'missing', 'relic.b']);
  assert.deepEqual(created.deck.itemKeys, ['relic.b']); assert.deepEqual(created.deck.cardIds, []);
  assert.equal(created.customDecks.length, 4); assert.deepEqual(state, snapshot);
});

test('copying a read-only subclass template preserves both its card and item memberships in a regular deck', () => {
  const state = { cards: cards(), items: items(), customDecks: [{ id: 'subclass-list.bloodletter', name: 'Bloodletter', assignedClassId: 'reaver', cardIds: ['subclass.bloodletter.second'], itemKeys: ['weapon.a', 'relic.b'] }] }, snapshot = structuredClone(state);
  const result = copyDeckList(state, 'subclass-list.bloodletter');
  assert.equal(result.deck.id.startsWith('subclass-list.'), false);
  assert.deepEqual(result.deck.cardIds, ['subclass.bloodletter.second']); assert.deepEqual(result.deck.itemKeys, ['weapon.a', 'relic.b']);
  assert.equal(result.deck.assignedClassId, 'reaver'); assert.deepEqual(result.customDecks[0], snapshot.customDecks[0]); assert.deepEqual(state, snapshot);
});
