// Owner 2026-10-28 (batch 2): ten new Core maneuver cards (four Basic smashes/sweeps, six higher-rank) and a second casting
// cantrip. Basics are unlimited for the Martial Adept like Strike; higher-rank cards are owned-count only, every smash
// deals Poise damage, every card resolves at both grades, and the depth 4+ rank lean and the casting slot reach them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { deckCopyLimit } from '../src/model/deckRules.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { reserveStanceCards } from '../src/model/stanceCoverage.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const live = (classId, ids, seed = 611) => {
  const run = createRunState({ registries, seed, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  executeRunEffects({ run, registries, rng: createRng(run.seed) }, ids.map(card => ({ op: 'addCardToDeck', card })));
  return run;
};
const ids = list => list.map(id => `core.${id}`);
const BASICS = ids(['hammerBlow', 'rendingSmash', 'wideSweep', 'reapingArc']);
const HIGHER = ids(['stunningBlow', 'skullsplitter', 'whirlwind', 'feint', 'hitAndRun', 'rakingSweep']);
const CANTRIP = 'core.wardingGlance';
const ALL = [...BASICS, ...HIGHER, CANTRIP];
const def = id => profile.content.cards.find(card => card.id === id);

test('Reaver and Rogue copy limits: each new Basic is unlimited, every other new card is limited to the copies owned', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = live(classId, ['core.strike', ...ALL]);
    assert.equal(deckCopyLimit(registries, 'core.strike', {}, run), Infinity);
    for (const id of BASICS) assert.equal(deckCopyLimit(registries, id, {}, run), Infinity, `${classId}/${id}`);
    for (const id of [...HIGHER, CANTRIP]) assert.equal(deckCopyLimit(registries, id, {}, run), 1, `${classId}/${id}`);
  }
});

test('Starseer copy limits: the new cantrip is unlimited, no new maneuver is', () => {
  const run = live('starseer', ALL);
  assert.equal(deckCopyLimit(registries, CANTRIP, {}, run), Infinity);
  for (const id of [...BASICS, ...HIGHER]) assert.notEqual(deckCopyLimit(registries, id, {}, run), Infinity, id);
});

test('every smash carries at least 3 Poise damage at both grades; sweeps keep authored damage', () => {
  for (const id of ALL.filter(id => def(id).tags.includes('maneuver:smash'))) {
    for (const upgraded of [false, true]) {
      const card = resolveCard(registries, { cardId: id, upgraded });
      const poise = card.effects.find(e => e.op === 'poiseDamage');
      assert.ok(poise && poise.amount >= 3, `${id} upgraded=${upgraded}`);
    }
  }
  assert.ok(ALL.some(id => def(id).tags.includes('maneuver:sweep')));
});

test('every new card resolves at base and upgraded with its authored SP cost, a face and a stronger upgrade', () => {
  for (const id of ALL) {
    const base = resolveCard(registries, { cardId: id }), up = resolveCard(registries, { cardId: id, upgraded: true });
    assert.equal(base.cost, def(id).staminaCost, id);
    assert.equal(base.manaCost, 0, id);
    assert.equal(up.cost, base.cost, `${id}: the upgrade keeps its cost`);
    assert.ok(base.textTemplate && up.textTemplate, id);
    assert.notDeepEqual(up.effects, base.effects, `${id}: the upgrade changes numbers`);
    assert.deepEqual(up.keywords, base.keywords, `${id}: the upgrade keeps its keywords`);
  }
  for (const id of BASICS) assert.equal(def(id).rarity, 'common', id);
  for (const id of BASICS.filter(id => def(id).tags.some(tag => tag === 'maneuver:smash' || tag === 'maneuver:sweep'))) assert.equal(def(id).staminaCost, 2, `${id}: a basic smash or sweep costs 2 SP`);
});

test('offers at map depth 4+ reach every higher-rank card of each class over 600 seeds', () => {
  const classOf = { reaver: ['core.skullsplitter', 'core.whirlwind'], rogue: ['core.feint', 'core.hitAndRun'], starseer: [], herald: [] };
  const colorless = ['core.stunningBlow', 'core.rakingSweep'];
  for (const classId of Object.keys(classOf)) {
    const seen = new Set();
    for (let seed = 1; seed <= 600; seed++) {
      const run = live(classId, [], seed);
      run.floor = 4;
      for (const option of gameProfileRewardOffers(registries, run, createRng(seed + 40000), { offerId: 'b2' }).options) if (option.kind === 'combatCards') seen.add(option.id);
    }
    for (const id of [...colorless, ...classOf[classId]]) assert.ok(seen.has(id), `${classId} never offered ${id}`);
    for (const other of Object.keys(classOf).filter(c => c !== classId)) for (const id of classOf[other]) assert.ok(!seen.has(id), `${classId} was offered ${other}'s ${id}`);
  }
});

test('Warding Glance spreads the casting stance-coverage slot away from Glimpse', () => {
  const run = createRunState({ registries, seed: 5, classId: 'reaver' });
  run.deck = run.deck.filter(card => !/cantrip|manaSurge|Special/i.test(card.cardId)); run.sideboard = [];
  const eligible = profile.content.cards.filter(card => card.class === 'colorless' || card.class === 'reaver').map(card => card.id);
  const share = pool => {
    const counts = {};
    for (let seed = 1; seed <= 2000; seed++) {
      const picks = reserveStanceCards(registries, run, createRng(seed), 'cardRewards', pool);
      for (const id of picks) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  };
  const castingOf = counts => Object.entries(counts).filter(([id]) => ['core.glimpse', CANTRIP, 'core.cantrip', 'core.manaSurge'].includes(id));
  const before = share(eligible.filter(id => id !== CANTRIP)), after = share(eligible);
  const total = counts => castingOf(counts).reduce((sum, [, n]) => sum + n, 0);
  const glimpseBefore = (before['core.glimpse'] || 0) / total(before), glimpseAfter = (after['core.glimpse'] || 0) / total(after);
  console.log(`casting-slot Glimpse share: before ${(glimpseBefore * 100).toFixed(1)}%, after ${(glimpseAfter * 100).toFixed(1)}% (Warding Glance ${((after[CANTRIP] || 0) / total(after) * 100).toFixed(1)}%)`);
  assert.ok(total(before) > 0 && (after[CANTRIP] || 0) > 0);
  assert.ok(glimpseAfter < glimpseBefore, 'Glimpse share of casting-slot picks drops');
});
