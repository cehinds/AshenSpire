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

test('public route previews use the supplied observer target and preserve per-contact odds', async () => {
  const { previewRangeRoutes } = await import('../src/engine/combatEngagement.js');
  const ctx = live(), source = ctx.player, raw = ctx.enemies[0];
  const projected = { ...raw, visibleOdds: 37 };
  const actions = [{ source, target: projected, card: { combatProfile: { range:'melee' } }, effect:{ op:'damage',target:'enemy',amount:1 } }];
  const quote = previewRangeRoutes(ctx, source, actions, { energy:1,stamina:1,mana:0 }, { hitPreview: (_ctx,_source,target) => ({inRange:true,hitChance:target.visibleOdds || 99}) });
  assert.equal(quote.targets[0].currentHitChance,37);
  assert.equal(quote.targets[0].hitChance,37);
  assert.equal(quote.targets[0].contacts[0].hitChance,37);
});
test('random target quotes fork the same seeded selection without drawing live RNG', async () => {
  const { quoteRangeActions } = await import('../src/engine/combatEngagement.js');
  const ctx=live(), source=ctx.player, original=ctx.enemies[0];
  ctx.enemies.push({...structuredClone(original),id:'e2',rangeActorKey:'enemy:e2'});
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e2')]=2;
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=0;
  const action=()=>({source,owner:source,card:{combatProfile:{range:'melee'}},effect:{op:'damage',target:'randomEnemy',amount:1}});
  const before=structuredClone(ctx.rng.getCounters());
  const quoted=quoteRangeActions(ctx,source,[action()],{preview:true});
  assert.deepEqual(ctx.rng.getCounters(),before);
  const accepted=quoteRangeActions(ctx,source,[action()]);
  assert.deepEqual(accepted,quoted);
  assert.equal(accepted.targets.filter(row=>!row.contactId.startsWith('rider:')).length,1);
  assert.ok(accepted.targets.filter(row=>row.contactId.startsWith('rider:')).every(row=>row.targetKey===accepted.targets[0].targetKey),'the authored Medallion rider keeps its sampled parent target');
});

function distantUnclosingIncoming(ctx) {
  far(ctx);
  const table=ctx.registries.enemies;
  ctx.registries={...ctx.registries,enemies:{...table,get:id=>{
    const def=table.get(id), move=def.moves.slash;
    if(!move)return def;
    return {...def,moves:{...def.moves,slash:{...move,range:'melee',traits:['adequateReach'],tags:[...(move.tags||[]).filter(tag=>!tag.startsWith('range:')),'range:melee']}}};
  }}};
  ctx.enemies[0].intent={...ctx.enemies[0].intent,moveId:'slash'};
  ctx.enemies[0].plannedMoves=[];
}
test('paid hand Counter reserves its return approach after stance discount and never pays twice', async () => {
  const { primeAccuracyRolls }=await import('./accuracyFixture.mjs');
  const ctx=live(); distantUnclosingIncoming(ctx);
  ctx.piles.hand=[{instanceId:'counter-range',cardId:'core.counter'}];
  ctx.player.combatStance={maneuver:'counter',camp:'physical',range:'melee'};
  ctx.player.stamina=2;
  primeAccuracyRolls(ctx,{count:2});
  dispatch(ctx,{type:'endTurn'});
  const option=ctx.pendingReaction?.options.find(row=>row.cardId==='core.counter' && row.play.rangeRoute==='advance');
  assert.ok(option);
  assert.equal(option.staminaCost,2,'zero discounted base plus two approach SP');
  const start=ctx.eventLog.length;
  dispatch(ctx,{type:'chooseReaction',offerId:ctx.pendingReaction.id,optionId:option.id});
  const events=ctx.eventLog.slice(start);
  assert.equal(events.filter(row=>row.type==='staminaSpent').reduce((sum,row)=>sum+row.amount,0),2);
  assert.ok(events.some(row=>row.type==='combatCounterTriggered'));
  assert.ok(!events.some(row=>row.type==='combatRangeReturnUnavailable'));
});
test('unaffordable automatic Counter preserves interception but spends no offensive cycle or hit RNG', async () => {
  const { primeAccuracyRolls }=await import('./accuracyFixture.mjs');
  const ctx=live(); distantUnclosingIncoming(ctx);
  ctx.piles.hand=[{instanceId:'counter-range',cardId:'core.counter'}];
  ctx.player.stamina=1;
  dispatch(ctx,{type:'playCard',cardInstanceId:'counter-range'});
  primeAccuracyRolls(ctx,{count:3});
  dispatch(ctx,{type:'setReactions',enabled:false});
  const start=ctx.eventLog.length;
  dispatch(ctx,{type:'endTurn'});
  const events=ctx.eventLog.slice(start);
  assert.ok(events.some(row=>row.type==='combatCounterConsumed'));
  assert.ok(events.some(row=>row.type==='combatRangeReturnUnavailable' && row.advanceSp===2 && row.defenseKept));
  assert.ok(!events.some(row=>row.type==='combatCounterTriggered'));
  assert.equal(ctx.player.combatCounterReturnedCycle,undefined);
  assert.equal(events.filter(row=>row.type==='attackHit' && row.sourceId==='player').length,0);
});

test('a paid Counter return reuses the accepted quote after movement and source changes', async () => {
  const { paidCounterRange, authorizeCounterRange }=await import('../src/engine/combatEngagement.js');
  const { rangeActionPlan }=await import('../src/model/combatEngagement.js');
  const ctx=live(); far(ctx);
  const source=ctx.player, attacker=ctx.enemies[0];
  const incoming=rangeActionPlan(ctx.rangeState,'enemy:e1',[{contactId:'incoming:0',targetKey:'player:player',coverage:'melee',bypass:true}]);
  incoming.rootId='accepted-incoming'; incoming.paid={energy:1,stamina:1,mana:0};
  ctx._reactionPlaying=true;
  ctx._rangeIncoming={rootId:incoming.rootId,contactId:'incoming:0',sourceKey:'enemy:e1',targetKey:'player:player'};
  ctx._rangeContext=incoming;
  const carrier=tacticalCarrier(resolveCombatCard(ctx,{cardId:'core.counter'}),{cardId:'core.counter',instanceId:'frozen-counter'},ctx,source);
  const paid=paidCounterRange(ctx,source,carrier,{energy:0,stamina:0,mana:0});
  assert.equal(paid.reservation.rangePlan.advanceSp,2);
  const before=structuredClone(paid.reservation.rangePlan);
  const graph=structuredClone(paid.reservation.rangeLineagePlan);
  assert.ok(graph?.edges.length,'the real mounted Medallion rider is part of the paid return envelope');
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=0;
  ctx.loadout.sets.rightHand[0]='halberd';
  carrier.resolvedRangeSource={sourceType:'weapon',itemId:'halberd',range:'reach',propertyTags:[]};
  carrier.rangeCounterReservation=paid.reservation;
  const authorized=authorizeCounterRange(ctx,source,attacker,carrier,{rangePlan:incoming,rangeContactId:'incoming:0'});
  assert.deepEqual(authorized.rangeReturnAuthorization.plan,before);
  assert.deepEqual(authorized.rangeReturnAuthorization.lineage,graph);
  assert.equal(authorized.resolvedRangeSource.itemId,before.targets[0].sourceWeaponId);
  assert.equal(authorized.rangeCounterReservation,undefined);
});
test('a missed incoming contact neither refunds nor preserves its paid Counter reservation', async () => {
  const { primeAccuracyRolls }=await import('./accuracyFixture.mjs');
  const ctx=live(); distantUnclosingIncoming(ctx);
  ctx.piles.hand=[{instanceId:'counter-range',cardId:'core.counter'}];
  ctx.player.combatStance={maneuver:'counter',camp:'physical',range:'melee'};
  ctx.player.stamina=2;
  primeAccuracyRolls(ctx,{die:1,count:3});
  dispatch(ctx,{type:'endTurn'});
  const option=ctx.pendingReaction.options.find(row=>row.play.rangeRoute==='advance');
  assert.equal(option.staminaCost,2);
  const start=ctx.eventLog.length;
  dispatch(ctx,{type:'chooseReaction',offerId:ctx.pendingReaction.id,optionId:option.id});
  const events=ctx.eventLog.slice(start);
  assert.equal(events.filter(row=>row.type==='staminaSpent').reduce((sum,row)=>sum+row.amount,0),2);
  assert.equal(events.some(row=>row.type==='combatCounterTriggered'),false);
  assert.equal(ctx.player.combatCounter?.carrier?.rangeCounterReservation,undefined);
});
