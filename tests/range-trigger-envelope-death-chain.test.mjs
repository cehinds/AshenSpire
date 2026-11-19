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

function three(ctx) {
  const base = ctx.enemies[0];
  ctx.enemies = ['e1', 'e2', 'e3'].map(id => ({ ...structuredClone(base), id, rangeActorKey: `enemy:${id}`, hp: 1 }));
  for (const id of ['e1', 'e2', 'e3']) ctx.rangeState.engagements[rangePairKey('player:player', `enemy:${id}`)] = 2;
}

test('every Talon shot lands on a living enemy when all enemies have 1 HP', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const ctx = live(), card = strike(ctx);
    three(ctx);
    mount(ctx, [TALON]);
    ctx.player.stamina = 20;
    for (let i = 0; i < seed; i++) ctx.rng.float('misc');
    primeAccuracyRolls(ctx, { count: 2 });
    dispatch(ctx, { type: 'playCard', cardInstanceId: card.instanceId, targetId: 'e1' });
    const dead = new Set(), shots = [];
    for (const event of ctx.eventLog) {
      if (event.type === 'damageDealt') { assert.ok(!dead.has(event.targetId), `seed ${seed}: shot at already dead ${event.targetId}`); shots.push(event.targetId); }
      if (event.type === 'enemyDied') dead.add(event.targetId ?? event.enemyId ?? event.id);
    }
    // The planned random pick must never be spent on the dead enemy: with two
    // living enemies left, Talon's shot is not silently lost.
    assert.ok(shots.length >= 2, `seed ${seed}: Talon shot was dropped (${shots.join(',')})`);
  }
});
