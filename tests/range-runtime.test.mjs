import test from 'node:test';
import assert from 'node:assert/strict';
import { live } from './helpers/fixcore-combat-rules.mjs';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { rangeSourceContact } from '../src/engine/combatEngagement.js';
import * as Foundation from '../src/engine/combatRules.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { tacticalCarrier } from '../src/engine/combatCardTactics.js';
function strike(ctx) {
  const card = ctx.piles.hand.find(row => row.cardId === 'core.strike');
  assert.ok(card, 'real Core Reaver starting Strike');
  return card;
}
function far(ctx) { ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')] = 2; }
test('real sourced Strike quotes and pays the approach surcharge once, retaining persistent engagement', () => {
  const ctx = live(), card = strike(ctx); far(ctx);
  const read = previewCard(ctx, card.instanceId, 'e1');
  assert.equal(read.range.targets[0].coverage, 0);
  assert.equal(read.range.routes[0].advanceSp, 2);
  assert.equal(read.range.targets[0].currentHitChance, 0);
  assert.ok(read.range.targets[0].hitChance > 0);
  ctx.player.stamina = read.staminaCost;
  const start = ctx.eventLog.length;
  dispatch(ctx, { type:'playCard', cardInstanceId:card.instanceId, targetId:'e1' });
  assert.equal(ctx.player.stamina, 0);
  assert.equal(ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')], 2);
  const played = ctx.eventLog.slice(start).find(row => row.type === 'cardPlayed');
  assert.equal(played.staminaSpent, read.staminaCost);
});
test('unaffordable sampled root refuses atomically without card, pool, charge, or RNG changes', () => {
  const ctx = live(), card = strike(ctx); far(ctx); ctx.player.stamina = 1;
  const before = JSON.stringify({ hand:ctx.piles.hand, player:ctx.player, rng:ctx.rng.getCounters(), queue:ctx.queue, serial:ctx.expansionActionSerial });
  assert.throws(() => dispatch(ctx, { type:'playCard', cardInstanceId:card.instanceId, targetId:'e1' }), /Stamina/);
  assert.equal(JSON.stringify({ hand:ctx.piles.hand, player:ctx.player, rng:ctx.rng.getCounters(), queue:ctx.queue, serial:ctx.expansionActionSerial }), before);
});
test('actual foundation source supplies range and canonical Throw property, never a different held piece', () => {
  const ctx = live(), card = strike(ctx), def = resolveCombatCard(ctx, card);
  const carrier = tacticalCarrier(def, card, ctx, ctx.player);
  const committed = carrier;
  const row = rangeSourceContact(ctx, ctx.player, ctx.enemies[0], committed);
  assert.equal(row.weapon, true); assert.equal(row.coverage, 'melee'); assert.equal(row.throwCapable, false);
  const unarmed = { ...carrier, attack:{ source:'unarmed' } };
  const bare = rangeSourceContact(ctx, ctx.player, ctx.enemies[0], unarmed);
  assert.equal(bare.weapon, false); assert.equal(bare.sourceWeaponId, null); assert.equal(bare.throwCapable, false);
});
