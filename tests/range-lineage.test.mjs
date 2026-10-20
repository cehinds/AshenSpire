import test from 'node:test';
import assert from 'node:assert/strict';
import { live } from './helpers/fixcore-combat-rules.mjs';
import { dispatch,previewCard } from '../src/engine/combat.js';
import { quoteRangeActions } from '../src/engine/combatEngagement.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const strike=ctx=>ctx.piles.hand.find(row=>row.cardId==='core.strike');
function mount(ctx,triggers){ctx.propertyMounts={player:{fixture:{id:'fixture',kind:'property',rules:[{triggers}]}}};}
function second(ctx){const row={...structuredClone(ctx.enemies[0]),id:'e2',rangeActorKey:'enemy:e2'};ctx.enemies.push(row);ctx.rangeState.engagements[rangePairKey('player:player','enemy:e2')]=2;return row;}
function played(ctx,card){return dispatch(ctx,{type:'playCard',cardInstanceId:card.instanceId,targetId:'e1'});}
test('real authored Envenom retains its contact and requires no second approach payment',()=>{
  const ctx=live(),card=strike(ctx);ctx.player.statuses.envenom={stacks:2};
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=2;
  const read=previewCard(ctx,card.instanceId,'e1');
  assert.equal(read.range.routes[0].advanceSp,2);
  ctx.player.stamina=read.staminaCost;primeAccuracyRolls(ctx,{count:1,drawsPerAttack:2});
  played(ctx,card);
  assert.equal(ctx.player.stamina,0);
  assert.ok(ctx.enemies[0].statuses.venom || ctx.enemies[0].statusGauges?.venom,'authored Venom applied through original contact');
});
test('finite conditional rider includes far targets before payment and refuses atomically when unaffordable',()=>{
  const ctx=live(),card=strike(ctx);second(ctx);
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=0;
  mount(ctx,[{on:'damageDealt',once:true,if:{p:'eventSourceIsOwner'},do:[{op:'damage',target:'allEnemies',amount:1}]}]);
  const read=previewCard(ctx,card.instanceId,'e1');assert.equal(read.range.routes[0].advanceSp,2);
  ctx.player.stamina=read.staminaCost-1;
  const snapshot=JSON.stringify({player:ctx.player,piles:ctx.piles,enemies:ctx.enemies,rng:ctx.rng.getCounters(),queue:ctx.queue});
  assert.throws(()=>played(ctx,card),/Stamina/);
  assert.equal(JSON.stringify({player:ctx.player,piles:ctx.piles,enemies:ctx.enemies,rng:ctx.rng.getCounters(),queue:ctx.queue}),snapshot);
  ctx.player.stamina=read.staminaCost;primeAccuracyRolls(ctx,{count:3,drawsPerAttack:2});played(ctx,card);
  assert.equal(ctx.player.stamina,0);
  assert.ok(ctx.eventLog.some(event=>event.type==='damageDealt'&&event.targetId==='e2'));
});
test('preview and acceptance reserve each repeated random rider slot once without live preview draws',()=>{
  for(let seed=1;seed<=8;seed++){
    const ctx=live();second(ctx);
    mount(ctx,[{on:'damageDealt',once:true,do:[{op:'damage',target:'randomEnemy',amount:1,repeat:2}]}]);
    for(let i=0;i<seed;i++)ctx.rng.float('misc');
    const source=ctx.player,action=()=>({source,owner:source,card:{combatProfile:{range:'melee'}},effect:{op:'damage',target:'randomEnemy',amount:1}});
    const before=structuredClone(ctx.rng.getCounters());
    const quote=quoteRangeActions(ctx,source,[action()],{preview:true});
    assert.deepEqual(ctx.rng.getCounters(),before);
    const accepted=quoteRangeActions(ctx,source,[action()]);
    assert.deepEqual(accepted,quote);assert.deepEqual(accepted.lineage,quote.lineage);
    assert.equal(accepted.lineage.edges[0].targets.length,2);
    assert.equal(ctx.rng.getCounters().misc-before.misc,3,'one root selector and two conservative rider slots');
  }
});
test('unsupported hostile preparing hooks refuse before preparation effects or gameplay RNG',()=>{
  const ctx=live(),card=strike(ctx);
  mount(ctx,[{on:'cardPreparing',do:[{op:'block',target:'owner',amount:3},{op:'damage',target:'randomEnemy',amount:1}]}]);
  const before=JSON.stringify({player:ctx.player,piles:ctx.piles,enemies:ctx.enemies,rng:ctx.rng.getCounters(),queue:ctx.queue});
  assert.throws(()=>played(ctx,card),/preparation trigger/);
  assert.equal(JSON.stringify({player:ctx.player,piles:ctx.piles,enemies:ctx.enemies,rng:ctx.rng.getCounters(),queue:ctx.queue}),before);
});

test('authored cross-owner Zealotry prices its own return without borrowing incoming approach',async()=>{
  const {executeAction}=await import('../src/engine/actions.js');
  for(const available of [0,2]){
    const ctx=live(),target=ctx.enemies[0];
    ctx.propertyMounts={};ctx.player.statuses.zealotry={stacks:1};
    ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=2;
    ctx.player.stamina=available;
    const before=ctx.rng.getCounters().misc;
    primeAccuracyRolls(ctx,{count:1,drawsPerAttack:2});
    ctx.emit('hpLost',{targetId:'player',sourceId:'e1',amount:1,cause:'attack'});
    while(ctx.queue.length)executeAction(ctx,ctx.queue.shift());
    if(available===0){
      assert.equal(ctx.rng.getCounters().misc,before);
      assert.ok(ctx.eventLog.some(event=>event.type==='combatRangeActionUnavailable'&&event.advanceSp===2));
      assert.equal(ctx.player.stamina,0);
    }else{
      assert.equal(ctx.player.stamina,0);
      assert.equal(ctx.rng.getCounters().misc,before+1);
      assert.ok(ctx.eventLog.some(event=>event.type==='damageDealt'&&event.sourceId==='player'&&event.targetId===target.id));
    }
  }
});
test('paid Counter reserves its far inherited rider and reuses that graph on the actual return',()=>{
  const ctx=live(),farEnemy=second(ctx);
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=0;
  mount(ctx,[{on:'damageDealt',once:true,if:{p:'eventSourceIsOwner'},do:[{op:'applyStatus',target:'allEnemies',status:'weak',stacks:1}]}]);
  ctx.piles.hand=[{instanceId:'counter-rider',cardId:'core.counter'}];
  ctx.player.combatStance={maneuver:'counter',camp:'physical',range:'melee'};
  ctx.player.stamina=2;
  primeAccuracyRolls(ctx,{count:2,drawsPerAttack:2});
  dispatch(ctx,{type:'endTurn'});
  const option=ctx.pendingReaction.options.find(row=>row.play.rangeRoute==='advance');
  assert.ok(option);assert.equal(option.staminaCost,2,'far rider is included in the accepted return price');
  const start=ctx.eventLog.length;
  dispatch(ctx,{type:'chooseReaction',offerId:ctx.pendingReaction.id,optionId:option.id});
  const events=ctx.eventLog.slice(start);
  assert.ok(events.some(event=>event.type==='combatCounterTriggered'));
  assert.ok(events.some(event=>event.type==='statusApplied'&&event.targetId===farEnemy.id&&event.status==='weak'));
  assert.equal(events.filter(event=>event.type==='staminaSpent').reduce((n,event)=>n+event.amount,0),2);
  assert.equal(ctx.phase,'player');
  assert.equal(ctx.turn,2);
  assert.equal(ctx.player.stamina,ctx.player.energyMax,'the enemy phase completed and began the next player turn');
});

test('cardResolved uses its explicit completed root receipt after pending play is removed',()=>{
  const ctx=live(),card=strike(ctx);second(ctx);
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=0;
  mount(ctx,[{on:'cardResolved',once:true,do:[{op:'applyStatus',target:'allEnemies',status:'weak',stacks:1}]}]);
  const read=previewCard(ctx,card.instanceId,'e1');assert.equal(read.range.routes[0].advanceSp,2);
  ctx.player.stamina=read.staminaCost;played(ctx,card);
  assert.equal(ctx.player.stamina,0);
  assert.ok(ctx.eventLog.some(event=>event.type==='cardResolved'&&event.rangeOrigin));
  assert.ok(ctx.eventLog.some(event=>event.type==='statusApplied'&&event.targetId==='e2'&&event.status==='weak'));
  assert.equal(ctx.eventLog.some(event=>event.type==='combatRangeActionUnavailable'),false);
  assert.equal(ctx.eventLog.some(event=>event.rangeLifecycleCarrier),false,'full carrier is scoped to emission, never stored in bus receipts');
});
