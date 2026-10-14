import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);
const player = id => ({ id, classId: 'reaver', combatExpansionVersion: 2, hp: 100, maxHp: 100,
  stamina: 10, maxStamina: 10, energyMax: 10, mana: 10, maxMana: 10,
  orderedDraw: true, drawPerTurn: 4, deck: ['first', 'replica'].map(instanceId => ({
    instanceId, cardId: 'rallyingStandard', upgraded: false,
  })) });

test('expanded Powers exhaust even after upgrades; legacy lifecycle remains unchanged', () => {
  for (const base of contentBundle.cards.filter(card => card.type === 'power')) {
    for (const upgraded of [false, true]) {
      const instance = { cardId: base.id, upgraded };
      const card = resolveCombatCard({ registries, combatExpansionVersion: 2 }, instance);
      assert.equal(registries.framework.afterPlayDestination(card), 'EXHAUST_PILE', `${base.id} ${upgraded}`);
    }
  }
  const legacy = resolveCombatCard({ registries, combatExpansionVersion: 1 }, { cardId: 'rallyingStandard' });
  assert.equal(registries.framework.afterPlayDestination(legacy), 'REMOVED_FROM_PLAY');
  assert.deepEqual(registries.cards.get('rallyingStandard').keywords, []);
});

test('solo paid Power copies each exhaust while their installed buff persists through turns', () => {
  const combat = createCombat({ registries, rng: createRng(128), combatExpansionVersion: 2,
    player: player('player'), enemyIds: ['wanderingSoldier'] });
  for (const id of ['first', 'replica']) dispatch(combat, { type: 'playCard', cardInstanceId: id });
  assert.deepEqual(combat.piles.exhaust.map(card => card.instanceId), ['first', 'replica']);
  assert.equal(combat.player.statuses.rallyingStandard.stacks, 2);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.statuses.rallyingStandard.stacks, 2);
  assert.equal(combat.piles.hand.length, 0);
  assert.equal(combat.piles.exhaust.length, 2);
});

test('co-op uses the same per-instance Power exhaustion and combat-long buff', () => {
  const combat = createCoopCombat({ registries, rng: createRng(128), combatExpansionVersion: 2,
    players: [player('a')], enemyIds: ['wanderingSoldier'] });
  for (const id of ['first', 'replica']) playCard(combat, 'a', id);
  const seat = combat.players.get('a');
  assert.deepEqual(seat.piles.exhaust.map(card => card.instanceId), ['first', 'replica']);
  assert.equal(seat.entity.statuses.rallyingStandard.stacks, 2);
  endTurn(combat, 'a');
  assert.equal(combat.players.get('a').entity.statuses.rallyingStandard.stacks, 2);
  assert.equal(combat.players.get('a').piles.exhaust.length, 2);
});
