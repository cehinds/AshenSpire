// Combat Rounds Preview: End Turn must still end the turn when an earlier queued card (Restful Dream
// puts its owner to Sleep) leaves the player under a control status that refuses the cards queued after it.
// Before the fix the commit threw "Recover from the active control statuses before playing cards",
// the atomic commit rolled back, and every later End Turn threw the same way: the turn could not end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { combatRoundsFor, COMBAT_ROUNDS_KEY, MOMENTUM_KEY, MULTI_ACTION_KEY } from '../src/model/combatRounds.js';

const registries = createRegistries(contentBundle);

function fight(classId, queued) {
  const combat = createCombat({
    registries, rng: createRng(18), combatExpansionVersion: 2, reactionRulesVersion: 2,
    combatRounds: combatRoundsFor({ [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: true, [MULTI_ACTION_KEY]: true }),
    enemyIds: ['wanderingSoldier'],
    player: { classId, maxHp: 400, hp: 400, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 6, drawPerTurn: 5,
      deck: queued.map((cardId, i) => ({ cardId, instanceId: `q${i}` })) },
  });
  assert.deepEqual(combat.piles.hand.map(c => c.cardId).sort(), [...queued].sort(), 'fixture: the whole deck is in hand');
  return combat;
}

for (const [classId, counter] of [['reaver', 'guardCounter'], ['starseer', 'umbralWard']]) {
  test(`${classId}: End Turn ends the turn when a queued card puts the player to Sleep before a queued Counter`, () => {
    const combat = fight(classId, ['restfulDream', counter]);
    const dream = combat.piles.hand.find(c => c.cardId === 'restfulDream');
    const second = combat.piles.hand.find(c => c.cardId === counter);
    dispatch(combat, { type: 'playCard', cardInstanceId: dream.instanceId });
    dispatch(combat, { type: 'playCard', cardInstanceId: second.instanceId });
    const turn = combat.turn;
    const { events } = dispatch(combat, { type: 'endTurn' });
    assert.ok(combat.turn > turn || combat.pendingReaction, 'the turn advanced (or a reaction is waiting to be answered)');
    assert.deepEqual(combat.combatRounds.playerQueue, [], 'the queue is empty after the commit');
    const skip = events.find(e => e.type === 'combatRoundCardSkipped' && e.cardInstanceId === second.instanceId);
    assert.equal(skip?.reason, 'controlled', 'the refused Counter is skipped with its reason');
    assert.deepEqual(skip.refund && Object.keys(skip.refund).sort(), ['energy', 'mana', 'stamina'], 'and its SP and MP are refunded');
  });
}

test('a controlled-skip refund never lifts Mana above its maximum', () => {
  // Codex P2 on #1963: an earlier live entry can restore Mana after the queue-time payment,
  // so the refund of the refused card must respect maxMana.
  const combat = fight('starseer', ['restfulDream', 'frostVeil']);
  const dream = combat.piles.hand.find(c => c.cardId === 'restfulDream');
  const ward = combat.piles.hand.find(c => c.cardId === 'frostVeil');
  dispatch(combat, { type: 'playCard', cardInstanceId: dream.instanceId });
  dispatch(combat, { type: 'playCard', cardInstanceId: ward.instanceId });
  const paid = combat.combatRounds.playerQueue.find(r => r.instanceId === ward.instanceId)?.paid;
  assert.ok(paid?.mana > 0, 'fixture: the queued card paid Mana');
  combat.player.mana = combat.player.maxMana; // an earlier effect restored Mana in full
  const seen = [];
  combat.on?.('combatRoundCardSkipped', () => seen.push(combat.player.mana));
  const { events } = dispatch(combat, { type: 'endTurn' });
  assert.ok(events.some(e => e.type === 'combatRoundCardSkipped' && e.reason === 'controlled'));
  assert.ok(combat.player.mana <= combat.player.maxMana, `Mana ${combat.player.mana} stays within ${combat.player.maxMana}`);
  for (const m of seen) assert.ok(m <= combat.player.maxMana, `Mana ${m} at the skip stays within the maximum`);
});
