// Owner bug (2026-11-01): "The Furnace Saint used Advance. / missed Forsaken: out of range · 0% chance".
// A pure movement (an enemy's Advance, a player's Advance card) is no attack: it makes no contact and rolls no hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fight = (seed, enemyId = 'furnaceSaint') => {
  const run = createRunState({ registries, classId: 'reaver', seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  combat.player.hp = combat.player.maxHp = 100000;
  return combat;
};
const endTurn = combat => {
  const begin = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  for (let k = 0; combat.pendingReaction && k < 50; k++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  return combat.eventLog.slice(begin);
};
const isHitRoll = e => e.type === 'attackHit' || e.type === 'attackMissed';

test('an enemy Advance rolls no hit and never "misses out of range"; its attacks still roll', () => {
  let advances = 0, attackRolls = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const combat = fight(seed);
    for (let turn = 0; turn < 6 && !combat.result; turn++) {
      const events = endTurn(combat);
      advances += events.filter(e => e.type === 'enemyMoveStarted' && e.moveId === 'advance').length;
      assert.deepEqual(events.filter(e => isHitRoll(e) && e.moveId === 'advance'), [], `seed ${seed}: Advance is not an attack`);
      assert.deepEqual(events.filter(e => e.missReason === 'range'), [], `seed ${seed}: no out-of-range miss from an in-range-or-moving enemy`);
      attackRolls += events.filter(e => isHitRoll(e) && e.sourceKind === 'enemy').length;
    }
  }
  assert.ok(advances > 0, 'the fixture reaches an enemy Advance');
  assert.ok(attackRolls > 0, 'control: ordinary enemy attacks still roll to hit');
});

test('an enemy Advance still closes the pair one band', () => {
  const combat = fight(1), enemy = combat.enemies[0];
  const key = rangePairKey('player:player', enemy.rangeActorKey || `enemy:${enemy.id}`);
  combat.rangeState.engagements[key] = 1;
  enemy.pendingMove = null;
  enemy.plannedMoves = [{ moveId: 'advance', sp: 1 }]; enemy.planDue = true;
  enemy.intent = { kind: 'buff', moveId: 'advance' };
  const events = endTurn(combat);
  assert.ok(events.some(e => e.type === 'combatEngagementMoved' && e.bands === -1));
  assert.equal(events.filter(isHitRoll).filter(e => e.moveId === 'advance').length, 0);
  assert.equal(combat.rangeState.engagements[key], 0);
});

test('a player Advance card still moves the pair and rolls no hit', () => {
  const combat = fight(7, 'wanderingSoldier'), enemy = combat.enemies[0];
  const key = rangePairKey('player:player', enemy.rangeActorKey || `enemy:${enemy.id}`);
  combat.rangeState.engagements[key] = 2;
  // The Reaver starter deck owns no Advance, so put one in hand rather than skip the player path.
  const card = { instanceId: 'advance-probe', cardId: 'core.advance', upgraded: false };
  combat.piles.hand.push(card);
  const begin = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const events = combat.eventLog.slice(begin);
  assert.equal(combat.rangeState.engagements[key], 1);
  assert.deepEqual(events.filter(isHitRoll), []);
});
