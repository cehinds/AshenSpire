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

test('Core Herald keeps the shared starter list (base.divine-strike and base.necrotic-heal are not in Core)', () => {
  const run = start('herald');
  assert.equal(run.deck.length, 10);
  assert.equal(counts(run.deck)['core.strike'], 3);
});

test('Core editor offers only owned cards (owner ruling 2026-10-19)', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  for (const id of ['reaver', 'rogue', 'starseer', 'herald']) assert.deepEqual(unlimitedCardIds(start(id)), []);
});
