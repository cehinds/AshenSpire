// Owner ruling 2026-10-19 (Core): exact opening decks per character.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const counts = (cards) => cards.reduce((m, c) => (m[c.cardId] = (m[c.cardId] || 0) + 1, m), {});
const start = (classId) => createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

test('Core Reaver starts with exactly 4 Strike, 4 Defend, 1 Counter and its weapon art', () => {
  const run = start('reaver');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.strike': 4, 'core.defend': 4, 'core.counter': 1, 'core.reaverSpecial': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Rogue starts with exactly 2 Strike, 2 Defend, 2 Counter, 2 Evade, 1 Draw and its weapon art', () => {
  const run = start('rogue');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.strike': 2, 'core.defend': 2, 'core.counter': 2, 'core.evade': 2, 'base.draw': 1, 'core.rogueSpecial': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Starseer starts with 3 Arcane Spark, 2 Star Spark, 4 Ethereal and 1 Resource Gain', () => {
  const run = start('starseer');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'core.cantrip': 3, 'core.starseerSpecial': 2, 'base.ethereal': 4, 'base.gain-resource': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core Herald starts with 4 Resource Echo, 4 Ethereal, 1 Smash and 1 Exhaust', () => {
  const run = start('herald');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(counts(run.deck), { 'base.paid-resource-variant': 4, 'base.ethereal': 4, 'core.smash': 1, 'base.exhaust': 1 });
  assert.deepEqual(run.sideboard, []);
});

test('Core editor offers only owned cards (owner ruling 2026-10-19)', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  for (const id of ['reaver', 'rogue', 'starseer', 'herald']) assert.deepEqual(unlimitedCardIds(start(id)), []);
});

test('a non-Core profile with deck-training keeps its unlimited-copy collection entries', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  const run = start('reaver');
  assert.equal(run.gameProfile.modules['deck-training'].ownedOnlyCollection, true, 'only the Core bundle sets the flag');
  const other = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules, 'deck-training': { ...run.gameProfile.modules['deck-training'], ownedOnlyCollection: undefined } } } };
  assert.ok(unlimitedCardIds(other).length > 0, 'unlimited basics are offered when the flag is absent');
  assert.ok(unlimitedCardIds(other).includes('core.strike'));
});

// Codex P2 (PR #2199): starterDeck.classDecks is validated at profile construction, not at class start.
test('classDecks validation fails at profile construction with a message naming the class and row', async () => {
  const { compileGameProfiles } = await import('../tools/game-config.mjs');
  const { resolveGameAuthor } = await import('../engine/kernel/gameConfig.js');
  const { catalog, authors } = compileGameProfiles();
  const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
  const build = (mutate) => { const copy = JSON.parse(JSON.stringify(catalog)); mutate(copy.packs[`${pack.id}@${pack.version}`].content.starterDeck); return () => resolveGameAuthor(authors.core, copy); };
  assert.doesNotThrow(build(() => {}), 'the shipped Core bundle validates');
  assert.throws(build(sd => { sd.classDecks.reaver[0].copies = '4'; }), /classDecks\/reaver\/0\/copies.*positive integer copies for class reaver row 0/);
  assert.throws(build(sd => { sd.classDecks.reaver[1].copies = -1; }), /classDecks\/reaver\/1\/copies.*positive integer copies for class reaver row 1/);
  assert.throws(build(sd => { sd.classDecks.reaver[0].copies = 1.5; }), /positive integer copies/);
  assert.throws(build(sd => { sd.classDecks.nobody = [{ card: 'core.strike', copies: 1 }]; }), /classDecks\/nobody.*unknown class/);
  assert.throws(build(sd => { sd.classDecks.rogue[2].card = 'core.missing'; }), /classDecks\/rogue\/2\/card.*unknown card reference "core.missing" for class rogue row 2/);
  assert.throws(build(sd => { sd.classDecks = []; }), /classDecks.*expected class-id map/);
  assert.throws(build(sd => { sd.classDecks.rogue = 'x'; }), /classDecks\/rogue.*expected an array/);
});
