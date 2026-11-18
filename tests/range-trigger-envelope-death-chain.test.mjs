import test from 'node:test';
import assert from 'node:assert/strict';
import { live as cappedLive } from './helpers/fixcore-combat-rules.mjs';
import { uncappedCombat } from './helpers/uncapped-range.mjs';
import { dispatch,previewCard } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { rangePairKey } from '../src/model/combatEngagement.js';

// Regression for the coresim crash "This action has an unbounded range-trigger
// envelope" (reaver, seed 1011 on the 11-depth maps): Carrion Talon (enemyDied
// -> damage randomEnemy) with Forsaken Medallion (damageDealt, once) and one
// enemy left. A damage site always lists enemyDied as possible, and the
// random-enemy rider could only ever resolve to that same enemy, so the walk
// recursed damage -> enemyDied -> damage until the depth guard threw.
const live = () => uncappedCombat(cappedLive());
const strike = ctx => ctx.piles.hand.find(row => row.cardId === 'core.strike');
function mount(ctx, triggers) { ctx.propertyMounts = { player: { fixture: { id: 'fixture', kind: 'property', rules: [{ triggers }] } } }; }
const TALON = { on: 'enemyDied', do: [{ op: 'damage', target: 'randomEnemy', amount: 6 }] };
const MEDALLION = { on: 'damageDealt', once: true, if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] }, do: [{ op: 'poiseDamage', amount: 4 }] };

test('a death-driven damage rider with one enemy left has a finite envelope (preview)', () => {
  const ctx = live(), card = strike(ctx);
  ctx.enemies = ctx.enemies.slice(0, 1);
  ctx.rangeState.engagements[rangePairKey('player:player', 'enemy:e1')] = 2;
  mount(ctx, [TALON, MEDALLION]);
  assert.doesNotThrow(() => previewCard(ctx, card.instanceId, 'e1'));
});

test('the same state plays without refusal and kills the lone enemy once', () => {
  const ctx = live(), card = strike(ctx);
  ctx.enemies = ctx.enemies.slice(0, 1);
  ctx.enemies[0].hp = 1;
  ctx.rangeState.engagements[rangePairKey('player:player', 'enemy:e1')] = 2;
  mount(ctx, [TALON, MEDALLION]);
  ctx.player.stamina = 10; primeAccuracyRolls(ctx, { count: 4 });
  assert.doesNotThrow(() => dispatch(ctx, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' }));
  assert.equal(ctx.eventLog.filter(event => event.type === 'enemyDied').length, 1);
});
