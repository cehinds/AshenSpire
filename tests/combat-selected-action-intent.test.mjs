import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {combatProfileFor} from '../src/model/combatCardProfile.js';

const source=readFileSync(new URL('../src/ui/screens/combat.js',import.meta.url),'utf8');
const begin=source.indexOf('  function syncPlayerActionIntent('),end=source.indexOf('  function armSelf(',begin);

test('the actual selected action resolves effective equipment tags and the chosen upcast ranks',()=>{
  const inst={instanceId:'shield-instance',cardId:'shieldBash'},ranks=[0,2];
  const calls=[],actions=[],events=[];
  const leading={querySelector:()=>({remove:()=>calls.push('remove')}),append:action=>actions.push(action)};
  const player={querySelector:()=>leading};
  const context={combat:{},upcastRanksByCard:new Map([[inst.instanceId,ranks]]),combatProfileFor,
    resolveCombatCard:(combat,instance,options)=>{
      assert.equal(combat,context.combat);assert.equal(instance,inst);assert.equal(options.upcastRanks,ranks);
      calls.push('resolve');
      return {id:'shieldBash',tags:['camp:physical','maneuver:smash'],cardTags:['camp:physical','maneuver:counter']};
    },playerActionIntent:(profile,onTarget)=>({profile,onTarget}),selfArm:inst.instanceId,
    playCard:(...args)=>calls.push(args),selectCombatant:id=>calls.push(id),
    combatEl:{dispatchEvent:event=>events.push(event.type)},CustomEvent:class{constructor(type){this.type=type;}}};
  const sync=runInNewContext(source.slice(begin,end)+'\nsyncPlayerActionIntent',context);
  sync(player,inst);
  assert.equal(actions[0].profile.maneuver,'counter','replacement identity wins over the base Smash tags');
  actions[0].onTarget();assert.deepEqual(calls.at(-1),[inst.instanceId,null]);
  context.selfArm=null;actions[0].onTarget();assert.equal(calls.at(-1),'player');
  assert.deepEqual(events,['combatantselectionchange']);
});

test('both real selection/render callers pass the instance and clear removes the previous action',()=>{
  assert.match(source,/syncPlayerActionIntent\(player, inst\);/);
  assert.match(source,/syncPlayerActionIntent\(box, activeCard\);/);
  const calls=[];
  const player={querySelector:()=>({querySelector:()=>({remove:()=>calls.push('removed')}),append:()=>assert.fail('no selected action')})};
  const context={upcastRanksByCard:new Map(),resolveCombatCard:()=>assert.fail('no carrier to resolve'),
    combatProfileFor,playerActionIntent:profile=>{assert.equal(profile,null);return null;},
    combatEl:{dispatchEvent:()=>calls.push('refit')},CustomEvent:class{}};
  runInNewContext(source.slice(begin,end)+'\nsyncPlayerActionIntent',context)(player,null);
  assert.deepEqual(calls,['removed','refit']);
});
