import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { executeAction, staggerPlayer } from '../src/engine/actions.js';
import { getStacks } from '../src/engine/statuses.js';

function fight(effects, coop) {
  const registries = createRegistries({ ...legacyContentBundle,
    cards: legacyContentBundle.cards.map(card => card.id === 'strike' ? { ...card, effects } : card),
    enemies: legacyContentBundle.enemies.map(enemy => enemy.id === 'gildedKnight' ? { ...enemy, firstMove: 'parry' } : enemy),
    enemyMoves: legacyContentBundle.enemyMoves.map(move => move.enemyId === 'gildedKnight' && move.id === 'parry'
      ? { ...move, counterPoiseDamage: 4 } : move),
  });
  const player = { classId: 'reaver', hp: 200, maxHp: 200, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'strike1', cardId: 'strike' }], relicIds: [] };
  const options = { registries, rng: createRng(340), enemyIds: ['gildedKnight', 'wanderingSoldier'], ratingsRules: null };
  const c = coop ? createCoopCombat({ ...options, players: [{ id: 'p1', ...player }] }) : createCombat({ ...options, player });
  const actor = coop ? c.players.get('p1').entity : c.player;
  actor.poiseMeter = { value: 0, max: 100 };
  return { c, actor, play: () => coop ? playCard(c, 'p1', 'strike1', c.enemies[0].id)
    : dispatch(c, { type: 'playCard', cardInstanceId: 'strike1', targetId: c.enemies[0].id }) };
}

for (const coop of [false, true]) {
  const mode = coop ? 'co-op' : 'solo';
  for (const interrupt of ['stagger', 'death']) {
    test(`${mode} cancels an already queued Counter reply after source ${interrupt}`, () => {
      const effects = [{ op: 'damage', target: 'enemy', amount: 6 }, interrupt === 'stagger'
        ? { op: 'poiseDamage', target: 'enemy', amount: 18 } : { op: 'damage', target: 'enemy', amount: 53 }];
      const { c, actor, play } = fight(effects, coop), knight = c.enemies[0];
      assert.equal(knight.combatCounter.damage, 6);
      play();
      assert.equal(actor.hp, 200, 'cancelled reply cannot deal Health damage');
      assert.equal(actor.poiseMeter.value, 0, 'cancelled reply cannot deal its listed Poise damage');
      assert.equal(knight.combatCounter, undefined, 'spent reaction is not refunded');
      assert.equal(c.eventLog.filter(event => event.type === 'combatCounterConsumed').length, 1);
      assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
      assert.equal(c.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === knight.id).length, 0);
      assert(c.eventLog.some(event => event.type === (interrupt === 'stagger' ? 'enemyStaggered' : 'enemyDied')
        && event.targetId === knight.id));
      assert.equal(c.enemies[1].alive, true, 'combat remains live so cancellation does not rely on victory');
    });
  }
  test(`${mode} ordinary queued Counter still deals damage and listed Poise once`, () => {
    const { c, actor, play } = fight([{ op: 'damage', target: 'enemy', amount: 6 }], coop);
    play();
    assert.equal(actor.hp, 186);
    assert.equal(actor.poiseMeter.value, 6);
    assert.equal(c.enemies[0].combatCounter, undefined);
    assert.equal(c.eventLog.filter(event => event.type === 'damageDealt' && event.sourceId === c.enemies[0].id).length, 1);
  });
}

test('player interruption cancels Counter-only queued effects and preserves ordinary riders', () => {
  const { c, actor } = fight([{ op: 'damage', target: 'enemy', amount: 6 }], false);
  const target = c.enemies[1], hp = target.hp;
  const reaction = { source: actor, owner: actor, target, card: { combatReaction: true },
    effect: { op: 'damage', amount: 14 }, meta: { combatCounterReaction: true } };
  c.queue.push(reaction, { ...reaction, effect: { op: 'poiseDamage', amount: 6 }, meta: { combatCounterReaction: true } },
    { source: actor, owner: actor, target, card: { combatReaction: true },
      effect: { op: 'applyStatus', status: 'bleed', stacks: 1 }, meta: { combatDamageRider: true } });
  staggerPlayer(c, actor);
  while (c.queue.length) executeAction(c, c.queue.shift());
  assert.equal(target.hp, hp);
  assert.equal(target.poiseMeter.value, 0);
  assert.equal(getStacks(target, 'bleed'), 1, 'ordinary typed rider is not suppressed by reaction marker');
  assert(actor.pendingActionLoss > 0);
  executeAction(c, { ...reaction, meta: { combatCounterReaction: true } });
  assert(target.hp < hp, 'a new reply after the earlier interruption is not blocked by owed action loss');
});

test('a freshly prepared live Counter works after an earlier player stagger', () => {
  const registries = createRegistries({ ...contentBundle,
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
      ? { ...enemy, firstMove: 'slash' } : enemy),
    enemyMoves: contentBundle.enemyMoves.map(move => move.enemyId === 'wanderingSoldier' && move.id === 'slash'
      ? { ...move, damage: 4 } : move),
  });
  const c = createCombat({ registries, rng: createRng(50), enemyIds: ['wanderingSoldier'], ratingsRules: null,
    player: { classId: 'reaver', hp: 200, maxHp: 200, energyMax: 10, drawPerTurn: 1,
      deck: [{ instanceId: 'riposte1', cardId: 'riposte' }], relicIds: [] } });
  staggerPlayer(c, c.player);
  assert(c.player.pendingActionLoss > 0);
  const enemy = c.enemies[0], hp = enemy.hp;
  dispatch(c, { type: 'playCard', cardInstanceId: 'riposte1' });
  assert(c.player.combatCounter, 'new preparation is armed despite earlier owed action loss');
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.player.hp, 200);
  assert(enemy.hp < hp);
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 1);
});
