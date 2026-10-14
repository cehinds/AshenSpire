import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard, endTurn } from '../src/engine/coopCombat.js';
import { getStacks } from '../src/engine/statuses.js';

function fight(payload, { lethal = true, stagger = false } = {}) {
  const damage = { op: 'damage', target: 'player', amount: 8 };
  const support = [
    { op: 'applyStatus', target: 'player', status: 'weak', stacks: 1 },
    { op: 'applyStatus', target: 'self', status: 'strength', stacks: 2 },
  ];
  const effects = [damage, ...support];
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash' } : enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => {
      if (move.enemyId !== 'wanderingSoldier' || move.id !== 'slash') return move;
      const { damage: ignoredDamage, delay: ignoredDelay, ...rest } = move;
      if (payload === 'primary') return { ...rest, damage: 8, effects };
      if (payload === 'effects') return { ...rest, effects: [damage, ...effects] };
      return { ...rest, damage: 8, delay: { turns: 1, whileCharging: { effects: [damage, ...effects] } } };
    }),
  });
  const combat = createCoopCombat({ registries, rng: createRng(50), ratingsRules: null,
    enemyIds: ['wanderingSoldier', 'gildedKnight'],
    players: ['p1', 'p2'].map(id => ({ id, classId: 'reaver', hp: 200, maxHp: 200,
      energyMax: 10, drawPerTurn: 1, relicIds: [], deck: [{ instanceId: `reply-${id}`, cardId: 'riposte' }] })),
  });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = lethal ? 1 : 100;
  if (stagger) enemy.poiseMeter = { value: 0, max: 1 };
  for (const id of ['p1', 'p2']) playCard(combat, id, `reply-${id}`);
  for (const id of ['p1', 'p2']) assert.ok(combat.players.get(id).entity.combatCounter, `${id} prepares its own Counter`);
  endTurn(combat, 'p1');
  endTurn(combat, 'p2');
  return { combat, enemy };
}

for (const payload of ['primary', 'effects', 'charging']) {
  test(`co-op ${payload} fanout stops when the first seat's Counter kills the acting enemy`, () => {
    const { combat, enemy } = fight(payload);
    assert.equal(enemy.alive, false);
    assert.equal(combat.enemies[1].alive, true, 'another enemy keeps combat active');
    assert.equal(combat.result, null, 'stopping fanout must not depend on combat completion');
    assert.equal(combat.phase, 'player', 'other enemies and the turn loop still finish');
    const attacks = combat.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id);
    assert.deepEqual(attacks.map(event => event.targetPlayerId), ['p1'], 'dead source cannot enqueue attacks against the later seat');
    const consumed = combat.eventLog.filter(event => event.type === 'combatCounterConsumed');
    assert.deepEqual(consumed.map(event => event.sourcePlayerId), ['p1'], 'later seat Counter is not spent by a dead source');
    assert.equal(combat.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
    for (const id of ['p1', 'p2']) {
      const player = combat.players.get(id).entity;
      assert.equal(player.hp, 200);
      assert.equal(getStacks(player, 'weak'), 0, 'later support effects are not enqueued');
    }
    assert.equal(getStacks(enemy, 'strength'), 0);
    assert.equal(enemy.pendingMove, null, 'a dead charging source does not publish a delayed move');
    assert.notEqual(enemy.intent?.pending, true);
  });
}

test('a living co-op source completes every seat and authored effect after two Counters', () => {
  const { combat, enemy } = fight('primary', { lethal: false });
  assert.equal(enemy.alive, true);
  const attacks = combat.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id);
  assert.deepEqual(attacks.map(event => event.targetPlayerId), ['p1', 'p2', 'p1', 'p2']);
  assert.deepEqual(combat.eventLog.filter(event => event.type === 'combatCounterConsumed').map(event => event.sourcePlayerId), ['p1', 'p2']);
  assert.equal(combat.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 2);
  for (const id of ['p1', 'p2']) assert.equal(getStacks(combat.players.get(id).entity, 'weak'), 1);
  assert.equal(getStacks(enemy, 'strength'), 2, 'self support resolves once');
});

test('Stagger from an earlier seat Counter preserves the living source current move fanout', () => {
  const { combat, enemy } = fight('primary', { lethal: false, stagger: true });
  assert.equal(enemy.alive, true);
  assert.ok(combat.eventLog.some(event => event.type === 'enemyStaggered' && event.targetId === enemy.id));
  assert.deepEqual(combat.eventLog.filter(event => event.type === 'combatCounterConsumed').map(event => event.sourcePlayerId), ['p1', 'p2']);
  assert.equal(combat.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 2, 'later seat can still use its fresh Counter');
  assert.equal(getStacks(enemy, 'strength'), 2, 'already started live move support continues');
});
