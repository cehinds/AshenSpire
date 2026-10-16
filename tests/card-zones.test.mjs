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
import { computeTokenBindings, validateEffects } from '../src/model/validate.js';
import { skillXpReceipt } from '../src/engine/skillXp.js';

// The fixture pins its own Stamina and Mana: costRule 'fixed' opts it out of the cost formula (SPEC §4.3a).
function fixture(effects, { manaCost = 0, cost = 1, coop = false, expanded = false } = {}) {
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Rider fixture', costRule: 'fixed', cost, manaCost, effects, upgrade: {}, abilityKind: 'spell', abilityFamily: 'fixture', cardTags: ['kind.skill', 'source:spell'] };
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
