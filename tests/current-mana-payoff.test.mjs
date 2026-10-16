import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { validateContent } from '../src/model/validate.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { equipmentKitReceipt, createEquipmentProfileRuleSnapshot } from '../src/model/loadout.js';
const registries = createRegistries(contentBundle);
// Frozen former resolved prices plus the shared one-Mana minimum. Stronger
// effects must not silently buy another SP/MP through the budget formula.
const costs = {
  "cometFragment": [[1,1],[1,1],[1,1],[2,2],[2,3],[2,3]],
  "ashenMote": [[1,1],[1,1],[1,2],[2,2],[2,3],[2,3]],
  "forceNudge": [[1,1],[1,1]],
  "holySpark": [[1,1],[1,1]],
  "progression-cinder-orbit": [[1,1],[1,1],[1,2],[1,2],[1,3],[1,3]],
  "progression-blood-censer": [[1,1],[1,1],[1,2],[1,2],[1,3],[1,3]],
  "emberVigil": [[1,1],[1,1],[1,1],[1,2],[1,2],[1,3]],
  "progression-lunar-aegis": [[1,1],[1,1],[1,1],[1,1],[1,2],[1,2]],
  "progression-ash-benediction": [[1,1],[1,1],[1,1],[1,1],[1,2],[1,2]],
  "readTheAsh": [[1,1],[1,1],[1,1],[1,2],[1,2],[1,3]],
  "attune": [[1,1],[1,1]],
  "emberCommunion": [[1,1],[1,1]],
  "transfusion": [[1,1],[1,1]],
  "warmLitany": [[1,1],[1,1]],
  "cinderSigil": [[1,1],[1,1],[1,2],[2,3],[2,3],[2,4]],
  "starPath": [[1,1],[1,1],[1,1],[1,2],[1,2],[1,3]],
  "shieldBash": [[2,1],[1,1],[2,1],[2,1],[2,1],[3,1]],
  "quickstep": [[1,1],[1,1],[1,1],[1,1],[1,1],[1,1]],
  "scholarsInsight": [[1,1],[1,1],[1,1],[1,2],[1,2],[1,3]],
  "blightTouch": [[1,1],[1,1],[1,2],[1,3],[1,3],[2,4]],
  "penance": [[1,1],[1,1],[1,1],[1,1],[1,2],[2,2]],
  "urgentHeal": [[1,1],[1,1]],
  "rimeNeedle": [[1,1],[1,1]],
  "staticNeedle": [[1,1],[1,1]],
  "drowsingMote": [[1,1],[1,1]],
  "rotMote": [[1,1],[1,1]]
};
const minimum = {
  "cometFragment": ["damage",8],
  "ashenMote": ["damage",8],
  "forceNudge": ["damage",8],
  "holySpark": ["damage",8],
  "progression-cinder-orbit": ["damage",8],
  "progression-blood-censer": ["damage",8],
  "emberVigil": ["block",8],
  "progression-lunar-aegis": ["block",8],
  "progression-ash-benediction": ["block",8],
  "readTheAsh": ["draw",2],
  "attune": ["restoreMana",2],
  "emberCommunion": ["restoreMana",2],
  "transfusion": ["heal",8],
  "warmLitany": ["heal",5],
  "cinderSigil": ["damage",8],
  "starPath": ["draw",2],
  "shieldBash": ["damage",8],
  "quickstep": ["block",8],
  "scholarsInsight": ["draw",2],
  "blightTouch": ["damage",8],
  "penance": ["block",8],
  "urgentHeal": ["heal",8],
  "rimeNeedle": ["damage",6],
  "staticNeedle": ["damage",6],
  "drowsingMote": ["damage",5],
  "rotMote": ["damage",6]
};
test('current paid entry cards keep their resource prices and provide their promised payoff', () => {
 for (const [id, prices] of Object.entries(costs)) {
  const definition = registries.cards.get(id);
  let previous = 0;
  for (const [rank, price] of prices.entries()) {
   const ref = definition.gradeProfiles ? {cardId:id, abilityRank:rank} : {cardId:id, upgraded:rank===1};
   const card = resolveCard(registries, ref);
   assert.deepEqual([card.cost, card.manaCost], price, id+'/'+rank);
   const [op, floor] = minimum[id];
   const payoff = card.effects.find(e=>e.op===op)?.amount;
   assert.ok(payoff >= floor, id+'/'+rank+' payoff');
   assert.ok(payoff >= previous, id+'/'+rank+' never weakens its prior grade');
   previous = payoff;
  }
 }
});

test('recovery and setup keep their distinct extra effects', () => {
 const communion=resolveCard(registries,{cardId:'emberCommunion'});
 assert.equal(communion.effects.find(e=>e.op==='heal').amount,5);
 const litany=resolveCard(registries,{cardId:'warmLitany'});
 assert.equal(litany.effects.find(e=>e.op==='block').amount,5);
 for (const id of ['rimeNeedle','staticNeedle','drowsingMote','rotMote']) {
  const card=resolveCard(registries,{cardId:id});
  assert.ok(card.effects.some(e=>e.op==='buildup' && e.amount===3 && e.chance===50),id+' preserves setup pressure');
  assert.equal(card.upcast.damagePerRank,1,id+' keeps existing upcast growth');
 }
});

test('current entry Smashes pay a premium against the same-grade Reaver attack', () => {
 for (const id of ['kickOff', 'progression-breaker-s-toll']) {
  let previous=0;
  for (let abilityRank=0; abilityRank<6; abilityRank++) {
   const attack=resolveCard(registries,{cardId:'progression-ember-hew',abilityRank});
   const smash=resolveCard(registries,{cardId:id,abilityRank});
   const damage=smash.effects.find(e=>e.op==='damage').amount;
   assert.equal(smash.cost,attack.cost+1,id+'/'+abilityRank+' pays one more SP');
   assert.equal(smash.manaCost,0,id+' does not invent a Mana price');
   assert.ok(damage>=Math.ceil(attack.effects.find(e=>e.op==='damage').amount*1.5),id+'/'+abilityRank+' keeps its status-rich damage premium');
   assert.ok(damage>=previous,id+' never loses damage at a higher grade');
   assert.ok(smash.effects.some(e=>e.op==='poiseDamage'),id+' retains its Poise rider');
   previous=damage;
  }
 }
});

test('Sundering Hew buys a large payoff over the starting greatsword Smash', () => {
 // Starting Reaver: greatsword blade base5 + uncommon1 + AR6 = 12.
 // This is the starting equipment receipt, not a universal ratio after AR growth.
 const run=createRunState({seed:3,classId:'reaver',registries});
 run.loadout.sets.rightHand[run.loadout.active.rightHand||0]='greatsword';
 run.loadout.sets.leftHand[run.loadout.active.leftHand||0]=null;
 const receipt=equipmentKitReceipt(registries,run.loadout,'reaver',run.attributes,createEquipmentProfileRuleSnapshot(registries),run)
  .find(row=>row.role==='attack');
 assert.equal(receipt.receipt.value,12,'starting greatsword AR receipt');
 assert.ok(receipt.piece.mods.includes('strike.cost=+1'),'greatsword basic attack pays its SP premium');
 const base=resolveCard(registries,{cardId:'greatswordSunderingHew'});
 const upgraded=resolveCard(registries,{cardId:'greatswordSunderingHew',upgraded:true});
 assert.deepEqual([base.cost,base.manaCost],[2,1]);
 assert.equal(base.effects.find(e=>e.op==='damage').amount,36);
 assert.equal(upgraded.effects.find(e=>e.op==='damage').amount,48);
 assert.equal(base.effects.find(e=>e.op==='poiseDamage').amount,5);
 assert.equal(upgraded.effects.find(e=>e.op==='poiseDamage').amount,7);
 assert.equal(base.effects.find(e=>e.status==='vulnerable').stacks,1);
 assert.equal(applyCombatExpansionCard(base).effects.find(e=>e.status==='vulnerable').amount,4,'combat v2 keeps four Vulnerable buildup');
});


test('fixed grade prices validate without accepting fractional or out-of-range costs', () => {
 assert.deepEqual(validateContent(contentBundle).errors,[]);
 for (const [actionCost,manaCost] of [[0,1],[-1,1],[1.5,1],[6,1],[1,-1],[1,1.5],[1,6]]) {
  const bundle={...contentBundle,cards:structuredClone(contentBundle.cards),equipment:{...contentBundle.equipment,armaments:contentBundle.equipment.armaments.map(piece=>({...piece}))}};
  const grade=bundle.cards.find(card=>card.id==='cometFragment').gradeProfiles[2];
  grade.actionCost=actionCost; grade.manaCost=manaCost;
  assert.ok(validateContent(bundle).errors.some(error=>error.path==='cards.cometFragment.gradeProfiles.2'),`${actionCost} SP / ${manaCost} MP must be rejected`);
 }
 const formula={...contentBundle,cards:structuredClone(contentBundle.cards)};
 delete formula.cards.find(card=>card.id==='cometFragment').gradeProfiles[2].traits.costRule;
 assert.ok(validateContent(formula).errors.some(error=>error.path==='cards.cometFragment.gradeProfiles.2'),'formula grades still require rank-based authored Mana');
});


test('boot validation agrees with the authored weapon-art Mana minimum', () => {
 const bundle={...contentBundle,cards:structuredClone(contentBundle.cards),equipment:{...contentBundle.equipment,armaments:contentBundle.equipment.armaments.map(piece=>({...piece}))}};
 bundle.equipment.armaments.find(piece=>piece.id==='greatsword').weaponArtManaCost=0;
 assert.ok(validateContent(bundle).errors.some(error=>error.path==='equipment.armaments.greatsword.weaponArtManaCost'));
});
