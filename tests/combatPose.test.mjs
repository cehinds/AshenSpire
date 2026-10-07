import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCombatPose, readinessAfterEvent, bloodRiteReaction } from '../src/model/combatPose.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSession } from '../tools/session.mjs';
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
test('real co-op status receipts and snapshots select per-seat poses and consume Prepared',()=>{
  const reg=createRegistries(contentBundle),host=createSession({registries:reg,seedString:'READINESS'});
  host.addMember({id:'p1',name:'Rogue',classId:'rogue'});host.addMember({id:'p2',name:'Herald',classId:'herald'});
  host.start();for(const id of ['p1','p2'])host.chooseNode(id,host.session.mapGraph.startIds[0]);
  const play=(id,cardId,target)=>{const p=host.live.combat.players.get(id);p.entity.energy=99;p.entity.mana=99;p.entity.stamina=99;
    p.piles.hand.push({instanceId:cardId,cardId,upgraded:false});const r=host.combatPlay(id,cardId,target);assert.ok(r.ok,r.error);return host.snapshot().scene;};
  let scene=play('p1','smokePellet');
  assert.equal(resolveCombatPose(scene.players.find(p=>p.id==='p1')),'prepared');
  assert.equal(resolveCombatPose(scene.players.find(p=>p.id==='p2')),'idle');
  assert.ok(scene.events.some(e=>e.type==='statusApplied'&&e.status==='prepared'&&e.targetId==='player'&&e.playerId==='p1'&&e.total===1));
  scene=play('p2','stigmataCard');assert.equal(resolveCombatPose(scene.players.find(p=>p.id==='p2')),'bloodRite');
  scene=play('p1','quickCut',scene.enemies.find(e=>e.alive).id);
  assert.equal(resolveCombatPose(scene.players.find(p=>p.id==='p1')),'idle');
  assert.equal(resolveCombatPose(scene.players.find(p=>p.id==='p2')),'bloodRite');
});
