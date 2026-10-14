import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';

function fixture(cards = ['stomp', 'stomp']) {
  // Use explicit fixed-price cards: shipped Stomp's progression grade owns its price.
  const identities = { stomp: 'queueStompFixture', strike: 'queueAttackFixture' };
  const fixtureCards = Object.entries(identities).map(([source, id]) => ({
    id, name: source === 'stomp' ? '2-SP Stomp fixture' : '2-SP Attack fixture',
    type: 'attack', class: 'colorless', rarity: 'common', cost: 2, manaCost: 0, costRule: 'fixed',
    keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 1 }], textTemplate: 'Deal {damage} damage.',
  }));
  const tagging = Object.entries(identities).flatMap(([source, objectId]) =>
    ['classification.attack', 'camp:physical', source === 'stomp' ? 'maneuver:smash' : 'maneuver:attack',
      'range:melee', 'targeting:single'].map(tagId => ({ family: 'card', scope: '', objectId, tagId })));
  const registries = createRegistries({ ...contentBundle,
    cards: [...contentBundle.cards, ...fixtureCards], tagging: [...contentBundle.tagging, ...tagging] });
  const run = createRunState({ seed: 701, classId: 'reaver', registries, combatExpansionVersion: 2,
    profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  const combat = createRunCombat({ registries, rng: createRng(701), run, enemyIds: ['wanderingSoldier'], settings: {} });
  combat.piles.hand = cards.map((name, index) => ({ cardId: identities[name], instanceId: `card${index}` }));
  combat.player.energy = 6;
  combat.player.mana = 20;
  delete combat.player.combatStance;
  return combat;
}
const queue = (combat, index) => dispatch(combat, { type: 'playCard',
  cardInstanceId: `card${index}`, targetId: combat.enemies[0].id });

test('queued repeated 2-SP Smash prices before each projected transition: 2 then 1', () => {
  const combat = fixture();
  assert.equal(cardPlayCosts(combat, 'card0').stamina, 2);
  queue(combat, 0);
  assert.equal(combat.player.combatStance, undefined, 'pricing grants no live stance');
  assert.equal(cardPlayCosts(combat, 'card1').stamina, 1);
  queue(combat, 1);
  assert.deepEqual(combat.combatRounds.playerQueue.map(row => row.paid.stamina), [2, 1]);
  assert.equal(combat.player.energy, 3);
  dispatch(combat, { type: 'unqueueCard', cardInstanceId: 'card1' });
  assert.equal(combat.player.energy, 4, 'refund is exactly its discounted payment');
  dispatch(combat, { type: 'unqueueCard', cardInstanceId: 'card0' });
  assert.equal(combat.player.energy, 6);
  assert.equal(cardPlayCosts(combat, 'card1').stamina, 2, 'removing the preceding stance changes the next quote');
});

test('a queued different stance removes the live stance discount from the next card', () => {
  const combat = fixture(['strike', 'stomp']);
  combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  const firstCost = cardPlayCosts(combat, 'card0').stamina;
  queue(combat, 0);
  assert.equal(cardPlayCosts(combat, 'card1').stamina, 2, 'preceding Attack leaves the live Smash stance');
  queue(combat, 1);
  assert.deepEqual(combat.combatRounds.playerQueue.map(row => row.paid.stamina), [firstCost, 2]);
  assert.equal(combat.player.combatStance.maneuver, 'smash', 'planning does not mutate live stance');
});

test('an unaffordable projected queue play is refused without changing stance or paid records', () => {
  const combat = fixture(['strike', 'stomp']);
  combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  queue(combat, 0);
  combat.player.energy = 1;
  const before = JSON.stringify({ stance: combat.player.combatStance, queue: combat.combatRounds.playerQueue, energy: combat.player.energy });
  assert.throws(() => queue(combat, 1), /Not enough/);
  assert.equal(JSON.stringify({ stance: combat.player.combatStance, queue: combat.combatRounds.playerQueue, energy: combat.player.energy }), before);
});
