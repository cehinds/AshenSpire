import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCombatPose, readinessAfterEvent, bloodRiteReaction } from '../src/model/combatPose.js';
import { combatRestAfterEvent } from '../src/model/combatAnimation.js';
const live = (...ids) => ({ hp:30, statuses:Object.fromEntries(ids.map(id=>[id,{stacks:1}])) });

test('stance, latest live readiness, guarded rest, idle; death overrides all',()=>{
  const p=live('prepared','starstoneCharge','stigmata');
  assert.equal(resolveCombatPose(p,'guard',['stigmata','prepared','starstoneCharge']),'starstoneCharge');
  p.statuses.starstoneCharge.stacks=0;
  assert.equal(resolveCombatPose(p,'guard',['stigmata','prepared','starstoneCharge']),'prepared');
  p.stanceId='bulwark';assert.equal(resolveCombatPose(p),'bulwark');
  p.hp=0;assert.equal(resolveCombatPose(p),'defeated');
  assert.equal(resolveCombatPose(live(),'parry'),'parry');
  assert.equal(resolveCombatPose(live(),'cast'),'idle');
  assert.equal(resolveCombatPose(live('ironVow')),'idle', 'Reaver power is not a Herald blood-economy effect');
  assert.equal(resolveCombatPose({...live('prepared'),statuses:{prepared:{stacks:1,duration:0}}}),'idle');
});
for (const rest of ['counter', 'defend']) test(`authored ${rest} rest survives its owner receipt while higher-priority poses still win`,()=>{
  const receipt=Object.freeze({type:'cardPlayed',sourceId:'p2'}), plan=Object.freeze({rest});
  assert.equal(combatRestAfterEvent('idle',receipt,'p1',plan),'idle');
  const ownedRest=combatRestAfterEvent('idle',receipt,'p2',plan);
  assert.equal(ownedRest,rest);
  const p=live('prepared','starstoneCharge');
  const order=['prepared','starstoneCharge'];
  assert.equal(resolveCombatPose(p,ownedRest,order),'starstoneCharge');
  p.statuses.starstoneCharge.duration=0;
  assert.equal(resolveCombatPose(p,ownedRest,order),'prepared');
  p.statuses.prepared.stacks=0;
  assert.equal(resolveCombatPose(p,ownedRest,order),rest);
  p.stanceId='bulwark';
  assert.equal(resolveCombatPose(p,ownedRest,order),'bulwark');
  p.alive=false;
  assert.equal(resolveCombatPose(p,ownedRest,order),'defeated');
  p.alive=true;p.hp=0;
  assert.equal(resolveCombatPose(p,ownedRest,order),'defeated');
  assert.equal(combatRestAfterEvent(ownedRest,{type:'playerTurnStart',playerId:'p2'},'p2'),'idle');
});
test('guarded authored rests are presentation-only and unsupported action rests remain idle',()=>{
  const p=live('prepared');p.statuses.prepared.duration=0;
  const order=['prepared'],before=structuredClone(p),beforeOrder=[...order];
  Object.freeze(p.statuses.prepared);Object.freeze(p.statuses);Object.freeze(p);Object.freeze(order);
  for(const rest of ['guard','shieldGuard','parry','counter','defend']) assert.equal(resolveCombatPose(p,rest,order),rest);
  for(const rest of ['cast','attack','smash','unsupported']) assert.equal(resolveCombatPose(p,rest,order),'idle');
  assert.deepEqual(p,before);assert.deepEqual(order,beforeOrder);
});
test('receipt ownership, refresh ordering and expiry never mutate the snapshot',()=>{
  const p=live('prepared','starstoneCharge'), before=structuredClone(p);
  let order=['prepared','starstoneCharge'];
  const event={type:'statusApplied',status:'prepared',targetId:'p2',total:1};
  assert.equal(readinessAfterEvent(order,event,'p1'),order);
  order=readinessAfterEvent(order,event,'p2');
  assert.deepEqual(order,['starstoneCharge','prepared']);
  assert.equal(resolveCombatPose(p,'guard',order),'prepared');
  order=readinessAfterEvent(order,{...event,type:'statusExpired'},'p2');
  assert.deepEqual(order,['starstoneCharge']);assert.deepEqual(p,before);
});
test('Herald red payment and gold healing respect receipt ownership and actual amounts',()=>{
  const p=live('stigmata');
  for(const [type,cause,result] of [['hpLost','card','hp'],['hpLost','attack',null],['hpLost','proc:bleed',null],['healed',null,'heal']]) {
    const e={type,cause,targetId:'p1',amount:2};
    assert.equal(bloodRiteReaction(p,e,'p1'),result);
    assert.equal(bloodRiteReaction(p,e,'p2'),null);
    assert.equal(bloodRiteReaction(p,{...e,amount:0},'p1'),null);
  }
});
