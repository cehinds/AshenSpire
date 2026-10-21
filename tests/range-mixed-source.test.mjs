import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { serializeCombatSnapshot,restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
function fixture(effects,left='dagger') {
  const profile=structuredClone(resolveGameProfile('core'));
  profile.content.cards.find(row=>row.id==='core.strike').effects=effects;
  delete profile.hash;profile.hash=gameDigest(profile);
  const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
  const run=createRunState({registries,classId:'reaver',seed:511});
  run.loadout.sets.rightHand[0]='shortbow';run.loadout.sets.leftHand[0]=left;
  const ctx=createRunCombat({registries,run,rng:createRng(511),enemyIds:['wanderingSoldier']});
  const card=Object.values(ctx.piles).flat().find(row=>row.cardId==='core.strike');
  for(const pile of Object.values(ctx.piles)){const i=pile.indexOf(card);if(i>=0)pile.splice(i,1);}
  ctx.piles.hand.push(card);
  ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')]=2;
  ctx.enemies[0].hp=ctx.enemies[0].maxHp=1000;
  ctx.enemies[0].persistentPoise={value:0,max:0};
  return {ctx,card,registries};
}
const weapon=hand=>({op:'damage',target:'enemy',amount:2,attack:{source:'weapon',hand}});
test('one live root retains the bow and dagger source of each contact in either authored order',()=>{
  for(const hands of [['mainHand','offHand'],['offHand','mainHand']]){
    const {ctx,card}=fixture(hands.map(weapon));
    const read=previewCard(ctx,card.instanceId,'e1');
    const route=read.range.routes.find(row=>row.id==='advance');
    assert.deepEqual(route.targets[0].contacts.map(row=>row.coverage),hands.map(hand=>hand==='mainHand'?2:0));
    assert.equal(route.advanceSp,2);
    ctx.player.stamina=route.costs.stamina;
    primeAccuracyRolls(ctx,{count:2});
    const start=ctx.eventLog.length;
    dispatch(ctx,{type:'playCard',cardInstanceId:card.instanceId,targetId:'e1'});
    assert.equal(ctx.player.stamina,0);
    const hits=ctx.eventLog.slice(start).filter(row=>row.type==='attackHit');
    assert.equal(hits.length,2);
    assert.equal(ctx.rangeState.engagements[rangePairKey('player:player','enemy:e1')],2);
  }
});
test('a weapon plus independent spell keeps each delivery range through a real save',()=>{
  for(const range of ['reach','ranged']){
  const effects=[weapon('mainHand'),{op:'damage',target:'enemy',amount:2,attack:{source:'spell',hand:'offHand'},tags:['camp:spell',`range:${range}`,'maneuver:casting']}];
  const {ctx,card,registries}=fixture(effects,'boneSceptre');
  const read=previewCard(ctx,card.instanceId,'e1');
  assert.deepEqual(read.range.targets[0].contacts.map(row=>row.coverage),[2,range==='reach'?1:2]);
  assert.equal(read.range.routes[0].advanceSp,range==='reach'?1:0);
  ctx.player.stamina=read.staminaCost;
  primeAccuracyRolls(ctx,{count:2});
  dispatch(ctx,{type:'playCard',cardInstanceId:card.instanceId,targetId:'e1'});
  assert.equal(ctx.player.stamina,0);
  assert.equal(ctx.eventLog.filter(row=>row.type==='attackHit'&&row.sourceId==='player').length,2);
  const saved=JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
  const restored=restoreCombatSnapshot({registries,rng:createRng(ctx.rng.seed,ctx.rng.getCounters()),snapshot:saved});
  assert.deepEqual(restored.rangeState,ctx.rangeState);
  }
});
