// Owner, 2026-11-17 (playtest item 19): Core creation chooses the starting cards and their
// copies from a limited pool of unranked cards; the deck minimum and maximum still apply.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deckRules } from '../src/content/deckRules.js';
import { ApplyStartingDeckChoice, StartingDeckChoiceRefusal, StartingDeckSize, StartingPoolCounts, StartingPoolIds } from '../src/model/startingDeckChoice.js';
import { CreatePreparedRun } from '../src/services/runBirth.js';

// src/content/deckRules.js is the hand-authored source (there is no generated JSON mirror).
const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const make = (classId = 'reaver') => createRunState({ seed: 9, classId, registries, runId: `start-${classId}`, profileMeta: meta });

const loose = card => !card.grantedBy && !card.equipmentRole;
const countDeck = run => Object.fromEntries(StartingPoolIds(run).map(id => [id, run.deck.filter(card => loose(card) && card.cardId === id).length]));
const relaxed = { deckMinUnlimited: true, deckMaxUnlimited: true };

test('the current configured pool and class swaps reach creation', () => {
  for (const character of core.content.characters.filter(row => row.tags.includes('character.player'))) {
    const run = make(character.id);
    const known = new Set(core.content.cards.map(card => card.id));
    const swaps = deckRules.creationPoolSwaps[character.id] || {};
    assert.deepEqual(StartingPoolIds(run), deckRules.creationPool.map(id => swaps[id] || id).filter(id => known.has(id)));
  }
  assert.deepEqual(StartingPoolIds(createRunState({ seed: 9, classId: 'reaver', registries: createRegistries(contentBundle) })), [], 'legacy has no choice');
});

test('the counts reflect the current class deck; choosing copies rebuilds only loose pool cards', () => {
  for (const classId of Object.keys(core.content.starterDeck.classDecks)) {
    const run = make(classId), counts = StartingPoolCounts(run), [chosenId] = StartingPoolIds(run);
    assert.ok(chosenId, `${classId} has a choice pool`);
    assert.deepEqual(counts, countDeck(run));
    const pool = StartingPoolIds(run);
    const others = structuredClone(run.deck.filter(card => !(loose(card) && pool.includes(card.cardId))));
    const edited = { ...counts, [chosenId]: counts[chosenId] + 1 };
    ApplyStartingDeckChoice(run, edited, relaxed);
    assert.deepEqual(StartingPoolCounts(run), edited);
    assert.deepEqual(run.deck.filter(card => !(loose(card) && pool.includes(card.cardId))), others, 'class cards and equipment grants stay');
    assert.equal(new Set(run.deck.map(card => card.instanceId)).size, run.deck.length, 'unique instance ids');
    assert.ok(run.collectedCardIds.includes(chosenId), 'the chosen card is collected');
  }
});

test('a class may collect a pool card absent from its initial deck', () => {
  const run = make(), [chosenId] = StartingPoolIds(run);
  run.deck = run.deck.filter(card => !(loose(card) && card.cardId === chosenId));
  run.collectedCardIds = run.collectedCardIds.filter(id => id !== chosenId);
  assert.equal(StartingPoolCounts(run)[chosenId], 0);
  ApplyStartingDeckChoice(run, { ...StartingPoolCounts(run), [chosenId]: 1 }, relaxed);
  assert.ok(run.deck.some(card => card.cardId === chosenId));
  assert.ok(run.collectedCardIds.includes(chosenId));
});

test('explicit minimum, maximum and malformed choices are enforced independently of the starter composition', () => {
  const run = make(), [chosenId] = StartingPoolIds(run);
  const none = Object.fromEntries(StartingPoolIds(run).map(id => [id, 0]));
  const kept = StartingDeckSize(run, none);
  const settings = { deckMinSize: kept + 1, deckMinUnlimited: false, deckMaxUnlimited: true };
  assert.match(StartingDeckChoiceRefusal(run, none, settings), /needs at least/);
  assert.throws(() => ApplyStartingDeckChoice(run, none, settings), /needs at least/);
  assert.equal(StartingDeckChoiceRefusal(run, StartingPoolCounts(run), relaxed), '');
  const big = { ...none, [chosenId]: 30 };
  assert.equal(StartingDeckSize(run, big), kept + 30);
  assert.match(StartingDeckChoiceRefusal(run, big, { deckMinUnlimited: true, deckMaxUnlimited: false, deckMaxSize: kept + 20 }), /at most/);
  assert.match(StartingDeckChoiceRefusal(run, { 'test.not-in-pool': 1 }), /not a starting card choice/);
  for (const invalid of [-1, 1.5, '2']) assert.match(StartingDeckChoiceRefusal(run, { [chosenId]: invalid }), /whole number/);
});

test('run birth applies the creation choice and keeps it in beginChoices', () => {
  const initial = make(), [chosenId] = StartingPoolIds(initial);
  const startingCards = { ...StartingPoolCounts(initial), [chosenId]: StartingPoolCounts(initial)[chosenId] + 1 };
  const { run } = CreatePreparedRun({ seed: 9, registries, gameProfile: core, profileMeta: meta, classId: initial.class, startingCards });
  assert.deepEqual(StartingPoolCounts(run), startingCards);
  assert.deepEqual(run.beginChoices.startingCards, startingCards);
});

test('run birth falls back to the class recipe when explicit bounds refuse a saved choice', () => {
  const fresh = make(), [chosenId] = StartingPoolIds(fresh);
  const startingCards = { ...StartingPoolCounts(fresh), [chosenId]: fresh.deck.length + 20 };
  const { run } = CreatePreparedRun({ seed: 9, registries, gameProfile: core, profileMeta: meta, classId: fresh.class, startingCards,
    settings: { deckMinUnlimited: true, deckMaxUnlimited: false, deckMaxSize: fresh.deck.length } });
  assert.deepEqual(run.deck.map(card => card.cardId), fresh.deck.map(card => card.cardId));
  assert.equal(run.beginChoices.startingCards, undefined);
});
