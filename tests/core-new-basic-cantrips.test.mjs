// Owner 2026-10-28 (batch 1): ten new Core Basic and Cantrip cards. The Martial Adept mints the new Basics without
// limit like Strike, the Magic Adept mints the new Cantrips, and all ten count as Basic or Cantrip for the reward bias.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { deckCopyLimit } from '../src/model/deckRules.js';
import { basicOrCantripMatcher } from '../src/model/stanceCoverage.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// Copy limits read the collected-card ledger: each card is collected first, as a reward claim does.
const live = (classId, ids) => {
  const run = createRunState({ registries, seed: 511, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  executeRunEffects({ run, registries, rng: createRng(run.seed) }, ids.map(card => ({ op: 'addCardToDeck', card })));
  return run;
};
const BASICS = ['jab', 'gash', 'pommelStrike', 'steadyGuard', 'drivingThrust', 'expose'].map(id => `core.${id}`);
const CANTRIPS = ['cinderDart', 'mendingTouch', 'glimpse', 'galePush'].map(id => `core.${id}`);

test('Reaver and Rogue copy limits: every new Basic is unlimited like Strike, no new Cantrip is', () => {
  for (const classId of ['reaver', 'rogue']) {
    const run = live(classId, ['core.strike', ...BASICS, ...CANTRIPS]);
    assert.equal(deckCopyLimit(registries, 'core.strike', {}, run), Infinity);
    for (const id of BASICS) assert.equal(deckCopyLimit(registries, id, {}, run), Infinity, `${classId}/${id}`);
    for (const id of CANTRIPS) assert.notEqual(deckCopyLimit(registries, id, {}, run), Infinity, `${classId}/${id}`);
  }
});

test('Starseer copy limits: every new Cantrip is unlimited, no new Basic is', () => {
  const run = live('starseer', [...BASICS, ...CANTRIPS]);
  for (const id of CANTRIPS) assert.equal(deckCopyLimit(registries, id, {}, run), Infinity, id);
  for (const id of BASICS) assert.notEqual(deckCopyLimit(registries, id, {}, run), Infinity, id);
});

test('basicOrCantripMatcher counts all ten new cards and not an ordinary common', () => {
  const matches = basicOrCantripMatcher(registries, live('reaver', []));
  for (const id of [...BASICS, ...CANTRIPS]) assert.ok(matches(id), id);
  assert.ok(!matches('core.advance'));
});

test('Mending Touch matches the heal-rules cheap shape (fx:heal, Exhaust, 1 SP + 1 MP) at both grades', () => {
  const card = profile.content.cards.find(row => row.id === 'core.mendingTouch'), shapes = profile.modules['heal-rules'].shapes;
  const shape = shapes.filter(s => s.tags.every(t => card.tags.includes(t))).sort((a, b) => b.tags.length - a.tags.length)[0];
  assert.equal(shape.id, 'cheap');
  assert.deepEqual([card.staminaCost, card.manaCost], [shape.cost.sp, shape.cost.mp]);
  assert.ok(card.keywords.includes('exhaust'));
  assert.equal(card.effects[0].amount, 4);
  assert.equal(card.upgrade.effects[0].amount, 6);
  assert.equal(card.upgrade.keywords, undefined, 'the upgrade keeps Exhaust');
});
