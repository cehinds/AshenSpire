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

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const make = (classId = 'reaver') => createRunState({ seed: 9, classId, registries, runId: `start-${classId}`, profileMeta: meta });

test('the pool is the five unranked starting cards, as data', () => {
  assert.deepEqual(StartingPoolIds(make()), [...deckRules.creationPool]);
  assert.deepEqual(StartingPoolIds(createRunState({ seed: 9, classId: 'reaver', registries: createRegistries(contentBundle) })), [], 'legacy has no choice');
});

test('the counts start at the class deck, and a choice rebuilds only the pool cards', () => {
  const run = make('reaver');
  const counts = StartingPoolCounts(run);
  assert.deepEqual(counts, { 'core.strike': 2, 'core.smash': 1, 'core.counter': 1, 'core.defend': 3, 'core.sweep': 1 });
  const others = run.deck.filter((card) => !deckRules.creationPool.includes(card.cardId)).map((card) => card.cardId);
  ApplyStartingDeckChoice(run, { ...counts, 'core.strike': 4, 'core.defend': 1 });
  assert.equal(run.deck.filter((card) => card.cardId === 'core.strike').length, 4);
  assert.equal(run.deck.filter((card) => card.cardId === 'core.defend').length, 1);
  assert.deepEqual(run.deck.filter((card) => !deckRules.creationPool.includes(card.cardId)).map((card) => card.cardId), others, 'class cards stay');
  assert.equal(new Set(run.deck.map((card) => card.instanceId)).size, run.deck.length, 'unique instance ids');
});

test('a class may take a pool card it did not start with, and it is collected', () => {
  const run = make('starseer');
  assert.equal(StartingPoolCounts(run)['core.strike'], 0);
  ApplyStartingDeckChoice(run, { ...StartingPoolCounts(run), 'core.strike': 1 });
  assert.ok(run.deck.some((card) => card.cardId === 'core.strike'));
  assert.ok(run.collectedCardIds.includes('core.strike'));
});

test('the deck minimum and maximum still apply', () => {
  const run = make('reaver');
  const none = Object.fromEntries(StartingPoolIds(run).map((id) => [id, 0]));
  assert.match(StartingDeckChoiceRefusal(run, none), /needs at least 10/);
  assert.throws(() => ApplyStartingDeckChoice(run, none), /needs at least/);
  assert.equal(StartingDeckChoiceRefusal(run, StartingPoolCounts(run)), '');
  const big = { ...StartingPoolCounts(run), 'core.strike': 30 };
  assert.match(StartingDeckChoiceRefusal(run, big, { deckMaxUnlimited: false, deckMaxSize: 20 }), /at most 20/);
  assert.equal(StartingDeckSize(run, big), run.deck.length + 28);
  assert.match(StartingDeckChoiceRefusal(run, { 'core.cantrip': 1 }), /not a starting card choice/);
  assert.match(StartingDeckChoiceRefusal(run, { 'core.strike': -1 }), /whole number/);
});

test('run birth applies the creation choice and keeps it in beginChoices', () => {
  const startingCards = { 'core.strike': 5, 'core.smash': 1, 'core.counter': 1, 'core.defend': 2, 'core.sweep': 1 };
  const { run } = CreatePreparedRun({ seed: 9, registries, gameProfile: core, profileMeta: meta, classId: 'reaver', startingCards });
  assert.equal(run.deck.filter((card) => card.cardId === 'core.strike').length, 5);
  assert.deepEqual(run.beginChoices.startingCards, startingCards);
});
