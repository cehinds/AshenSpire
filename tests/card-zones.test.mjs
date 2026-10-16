import { resolveGameProfile } from '../src/model/gameProfile.js';
import { setProfileStance,profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { trimCombatStances } from '../src/engine/concurrentStances.js';
import { botCardTargetId } from '../tools/simbot.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { createCoopCombat, playCard, chooseDiscard, endTurn, previewCoopCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyStatus, removeStatus, advanceStatusClock, getStacks } from '../src/engine/statuses.js';
import { evalPredicate, triggerOwnerKey } from '../src/engine/triggers.js';
import { grantAbilityCharge, beginAbilityTurn, matchingAbilityCharges } from '../src/engine/abilityRiders.js';
import { computeTokenBindings, validateEffects, validatePredicate } from '../src/model/validate.js';
import { skillXpReceipt } from '../src/engine/skillXp.js';

// The fixture pins its own Stamina and Mana: costRule 'fixed' opts it out of the cost formula (SPEC §4.3a).
function fixture(effects, { manaCost = 0, cost = 1, coop = false, expanded = false, definition = {} } = {}) {
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Rider fixture', costRule: 'fixed', cost, manaCost, effects, upgrade: {}, abilityKind: 'spell', abilityFamily: 'fixture', cardTags: ['kind.skill', 'source:spell'], ...definition };
  const registries = { ...base, progressionEnabled: expanded, cards: { ...base.cards, get: id => id === 'defend' ? card : base.cards.get(id) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 80, hp: 50, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false })) };
  const combat = coop ? createCoopCombat({ registries, rng: createRng(9), players: [{ ...player, id: 'a' }, { ...player, id: 'b' }], enemyIds: ['wanderingSoldier'] }) : createCombat({ registries, rng: createRng(9), player, enemyIds: ['wanderingSoldier'] });
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; }
  return combat;
}
const play = combat => dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId: botCardTargetId(combat.registries, combat, combat.piles.hand[0], combat.enemies[0].id) });


test('Scout chooses and orders real draw cards, persists its paid queue and resumes once', () => {
 const combat=fixture([{op:'moveCards',from:'draw',to:'draw',look:3,amount:3,selection:'choose',position:'top'},{op:'block',target:'self',amount:5}]);
 const before=combat.piles.draw.slice(0,3).map(c=>c.instanceId), price=cardPlayCosts(combat,combat.piles.hand[0].instanceId);
 play(combat);assert.deepEqual(combat.pendingCardChoice.candidateIds,before);assert.equal(combat.player.block,0);
 assert.throws(()=>dispatch(combat,{type:'endTurn'}),/Choose the cards/);
 const saved=serializeCombatSnapshot(combat),restored=restoreCombatSnapshot({registries:combat.registries,rng:createRng(9,combat.rng.getCounters()),snapshot:saved});
 const pending=JSON.stringify(serializeCombatSnapshot(restored));
 assert.throws(()=>dispatch(restored,{type:'chooseCards',cardInstanceIds:[before[0],before[0],before[1]]}),/distinct eligible/);
 assert.equal(JSON.stringify(serializeCombatSnapshot(restored)),pending);
 dispatch(restored,{type:'chooseCards',cardInstanceIds:[...before].reverse()});
 assert.deepEqual(restored.piles.draw.slice(0,3).map(c=>c.instanceId),[...before].reverse());assert.equal(restored.player.block,5);
 assert.equal(restored.eventLog.filter(e=>e.type==='cardResolved').length,1);assert.equal(restored.player.mana,20-price.mana);
});
test('Recall and exile recovery move existing instances; transform does not mint a duplicate',()=>{
 for(const from of ['discard','exhaust']){
  const combat=fixture([{op:'moveCards',from,to:'hand',amount:1,selection:'choose',transformTo:'strike'}]);
  combat.piles[from].push({instanceId:'recall-me',cardId:'defend',upgraded:false});play(combat);
  dispatch(combat,{type:'chooseCards',cardInstanceIds:['recall-me']});
  assert.equal(combat.piles.hand.find(c=>c.instanceId==='recall-me').cardId,'strike');assert.equal(combat.piles[from].filter(c=>c.instanceId==='recall-me').length,0);
 }
});

test('top-of-hand recall respects capacity and reports the actual overflow destination',()=>{
 const combat=fixture([{op:'moveCards',from:'discard',to:'hand',amount:3,selection:'first',position:'top'}]);
 combat.handMax=combat.piles.hand.length;
 combat.piles.discard.push(...[0,1,2].map(i=>({instanceId:`overflow-${i}`,cardId:'defend',upgraded:false})));
 play(combat);
 assert.equal(combat.piles.hand.length,combat.handMax);
 assert.equal(combat.piles.hand[0].instanceId,'overflow-0');
 assert.deepEqual(combat.piles.discard.filter(c=>c.instanceId.startsWith('overflow')).map(c=>c.instanceId),['overflow-1','overflow-2']);
 assert.deepEqual(combat.eventLog.filter(e=>e.reason==='handFull').map(e=>e.to),['discard','discard']);
});

test('author validation rejects invalid card-zone data rather than allowing a runtime-only failure',()=>{
 const valid={op:'moveCards',from:'draw',to:'hand',amount:1};
 const context=errors=>({err:(path,msg)=>errors.push({path,msg}),ids:{cards:new Set(['strike']),statuses:new Set(['weak'])},nodeIds:new Set()});
 for(const patch of [{from:'secret'},{to:'secret'},{selection:'any'},{position:'middle'},{look:0},{amount:-1},{invented:true},{transformTo:'missing'}]){
  const errors=[];validateEffects([{...valid,...patch}],'cards',context(errors));assert.ok(errors.length,JSON.stringify(patch));
 }
 const errors=[];validateEffects([valid],'cards',context(errors));assert.deepEqual(errors,[]);
});
test('corrupted pending choices cannot change zones, forge candidates or transform to unknown cards on load',()=>{
 const combat=fixture([{op:'moveCards',from:'draw',to:'hand',amount:1,look:2,selection:'choose'}]);play(combat);
 const saved=serializeCombatSnapshot(combat);
 for(const edit of [s=>s.pendingCardChoice.effect.to='secret',s=>s.pendingCardChoice.count=99,s=>s.pendingCardChoice.candidateIds=['forged'],s=>s.pendingCardChoice.effect.transformTo='unknown-card',s=>s.pendingCardChoice.effect.amount=-1]){
  const corrupt=structuredClone(saved);edit(corrupt);
  assert.throws(()=>restoreCombatSnapshot({registries:combat.registries,rng:createRng(9),snapshot:corrupt}),/Malformed|Unknown|unknown|unresolved/);
 }
});

test('modified cards retain their instance and hidden cards return after a bounded duration',()=>{
 const combat=fixture([{op:'modifyCards',from:'hand',amount:1,selection:'choose',changes:{retain:true,hideTurns:1,maneuver:'smash',range:'reach'}}]);
 play(combat);const id=combat.pendingCardChoice.candidateIds[0];dispatch(combat,{type:'chooseCards',cardInstanceIds:[id]});
 assert.ok(!combat.piles.hand.some(c=>c.instanceId===id));assert.equal(combat.hiddenCards[0].card.proposalChanges.maneuver,'smash');
 const restored=restoreCombatSnapshot({registries:combat.registries,rng:createRng(9),snapshot:serializeCombatSnapshot(combat)});
 dispatch(restored,{type:'endTurn'});assert.ok(restored.piles.hand.some(c=>c.instanceId===id));assert.equal(restored.hiddenCards.length,0);
});
test('cost growth and paid-resource variants use the same actual prices and effects in preview and play',()=>{
 const combat=fixture([{op:'block',target:'self',amount:2}],{definition:{costGrowth:{stamina:1,perUse:1,max:3},effectVariants:[{if:{p:'resourcePaid',resource:'mana',amount:1},effects:[{op:'block',target:'self',amount:7}]}]}});
 const first=combat.piles.hand[0].instanceId;assert.equal(cardPlayCosts(combat,first).stamina,1);assert.equal(previewCard(combat,first).values[0].value,7);
 play(combat);assert.equal(combat.player.block,7);
 const second=combat.piles.hand[0].instanceId;assert.equal(cardPlayCosts(combat,second).stamina,2);const sp=combat.player.stamina;play(combat);assert.equal(sp-combat.player.stamina,2);
});
test('dynamic same-card scaling matches preview before recording the current play',()=>{
 const combat=fixture([{op:'block',target:'self',amount:{f:'add',args:[2,{f:'metric',metric:'sameCardPlays',of:'self',per:3}]}}]);
 for(const expected of [2,5]){const id=combat.piles.hand[0].instanceId;assert.equal(previewCard(combat,id).values[0].value,expected);const old=combat.player.block;play(combat);assert.equal(combat.player.block-old,expected);}
});

test('enemy generated burden overlay skips once, exhausts, reveals and survives save without minting a player card',()=>{
 const combat=fixture([{op:'addBurden',target:'enemy',card:'defend',count:1},{op:'revealIntent',target:'enemy',amount:2}],{definition:{burden:{skipActions:1},keywords:['ethereal']}});
 play(combat);const enemy=combat.enemies[0];assert.equal(enemy.burdenPiles.draw.length,1);assert.equal(combat.piles.hand.filter(c=>c.cardId==='defend').length,1);
 const restored=restoreCombatSnapshot({registries:combat.registries,rng:createRng(9,combat.rng.getCounters()),snapshot:serializeCombatSnapshot(combat)});
 const hp=restored.player.hp;dispatch(restored,{type:'endTurn'});
 assert.equal(restored.player.hp,hp);assert.equal(restored.enemies[0].burdenPiles.exhaust.length,1);assert.equal(restored.enemies[0].burdenPiles.hand.length,0);
 assert.ok(restored.eventLog.some(e=>e.type==='intentRevealed'));assert.ok(restored.eventLog.some(e=>e.type==='enemyBurdenDrawn'));
 dispatch(restored,{type:'endTurn'});assert.ok(restored.eventLog.some(e=>e.type==='enemyMoveStarted'),'normal authored move resumes after burden expires');
});

test('configured X spends remaining SP and scales actual damage and target count with the paid amount',()=>{
 const combat=fixture([{op:'damage',target:'allEnemies',amount:{f:'energySpent',per:4}}],{cost:'X',manaCost:1,definition:{targetLimit:{f:'energySpent',per:1}}});
 combat.gameProfile=resolveGameProfile('core');combat.player.stamina=2;
 combat.enemies.push(...[1,2].map(i=>({...structuredClone(combat.enemies[0]),id:`extra-${i}`})));
 const id=combat.piles.hand[0].instanceId;assert.equal(cardPlayCosts(combat,id).stamina,2);const preview=previewCard(combat,id);assert.equal(preview.values[0].value,6); // configured Poise mitigates the authored 8 by 25%

 dispatch(combat,{type:'playCard',cardInstanceId:id});assert.equal(combat.player.stamina,0);
 assert.deepEqual(combat.enemies.map(e=>1000-e.hp),[6,6,0]);
});
test('co-op choices and hidden cards belong to the acting seat and return only to that seat',()=>{
 const combat=fixture([{op:'modifyCards',from:'hand',amount:1,selection:'choose',changes:{hideTurns:1,retain:true}}],{coop:true});
 const a=combat.players.get('a'),b=combat.players.get('b');for(const P of [a,b])for(const pile of Object.values(P.piles))for(const card of pile)card.instanceId=`${P.id}-${card.instanceId}`;
 playCard(combat,'a',a.piles.hand[0].instanceId);const chosen=combat.pendingCardChoice.candidateIds[0];
 assert.throws(()=>chooseDiscard(combat,'b',[chosen]),/another player/);chooseDiscard(combat,'a',[chosen]);
 assert.equal(combat.hiddenCards[0].playerId,'a');endTurn(combat,'a');endTurn(combat,'b');
 assert.ok(a.piles.hand.some(c=>c.instanceId===chosen));assert.ok(!b.piles.hand.some(c=>c.instanceId===chosen));assert.equal(combat.hiddenCards.length,0);
});
test('Many Forms uses one best defensive receipt for each attack and expires back to the primary stance',()=>{
 const combat=fixture([{op:'block',amount:1,target:'self'}]);combat.gameProfile=resolveGameProfile('core');
 combat.registries={...combat.registries,proposalStatusRules:{'weak':{behaviors:[{kind:'stanceCapacity',additionalPerStack:1,maxStances:2,defensePriority:['counter','defend','evade','casting','attack','smash','sweep']}]}}};
 combat.player.statuses['weak']={stacks:1};
 const carrier=maneuver=>({combatProfile:{maneuver,camp:'physical',range:'melee'}});
 setProfileStance(combat,combat.player,carrier('counter'));setProfileStance(combat,combat.player,carrier('defend'));
 assert.equal(combat.player.concurrentStances.length,2);
 for(const maneuver of ['smash','sweep'])assert.equal(profileDamageReceipt(combat,combat.enemies[0],combat.player,10,carrier(maneuver)).advantage,false);
 const restored=restoreCombatSnapshot({registries:combat.registries,rng:createRng(9),snapshot:serializeCombatSnapshot(combat)});assert.equal(restored.player.concurrentStances.length,2);
 restored.player.statuses['weak'].stacks=0;trimCombatStances(restored,restored.player);
 assert.equal(restored.player.concurrentStances,undefined);assert.equal(restored.player.combatStance.maneuver,'defend');assert.equal(profileDamageReceipt(restored,restored.enemies[0],restored.player,10,carrier('smash')).advantage,true);
});

test('combat growth survives a turn and reload while one-use linked scrolls stay spent after recovery',()=>{
 const growth=fixture([{op:'block',target:'self',amount:2}],{definition:{costGrowth:{stamina:1,perUse:1,max:3}}});play(growth);dispatch(growth,{type:'endTurn'});
 const restored=restoreCombatSnapshot({registries:growth.registries,rng:createRng(9),snapshot:serializeCombatSnapshot(growth)});
 assert.equal(cardPlayCosts(restored,restored.piles.hand[0].instanceId).stamina,2);
 const scroll=fixture([{op:'castLinkedSpell',card:'strike',target:'enemy'}],{definition:{playLimit:1,keywords:['exhaust']}});
 const id=scroll.piles.hand[0].instanceId;play(scroll);assert.ok(scroll.enemies[0].hp<1000);
 const index=scroll.piles.exhaust.findIndex(card=>card.instanceId===id);scroll.piles.hand.push(scroll.piles.exhaust.splice(index,1)[0]);
 const state=JSON.stringify(serializeCombatSnapshot(scroll));assert.throws(()=>dispatch(scroll,{type:'playCard',cardInstanceId:id,targetId:scroll.enemies[0].id}),/unplayable/);assert.equal(JSON.stringify(serializeCombatSnapshot(scroll)),state);
});
test('Conceal snapshots both selected count and hidden duration from its authored stack formula',()=>{
 const combat=fixture([{op:'modifyCards',from:'hand',amount:{f:'stacks',status:'weak',of:'self'},selection:'choose',changes:{hideTurns:{f:'stacks',status:'weak',of:'self'}}}]);
 combat.player.statuses.weak={stacks:2};combat.piles.hand.push({instanceId:'extra-conceal',cardId:'defend',upgraded:false});
 play(combat);assert.equal(combat.pendingCardChoice.count,2);assert.equal(combat.pendingCardChoice.effect.changes.hideTurns,2);
 dispatch(combat,{type:'chooseCards',cardInstanceIds:combat.pendingCardChoice.candidateIds.slice(0,2)});assert.ok(combat.hiddenCards.every(row=>row.returnTurn===combat.turn+2));
});

test('stance variant validation accepts combat maneuvers while refusing invented identities',()=>{
 const errors=[],ctx={err:(p,m)=>errors.push(m),ids:{stances:new Set(['brace'])}};
 for(const stance of ['smash','defend','casting','prepared','brace'])validatePredicate({p:'inStance',stance},'variant',ctx);
 assert.deepEqual(errors,[]);validatePredicate({p:'inStance',stance:'invented'},'variant',ctx);assert.equal(errors.length,1);
});
