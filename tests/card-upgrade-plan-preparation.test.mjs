import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, fresh, registries as baseRegistries, withScoring } from './helpers/drawback-contract.mjs';
import { planCardUpgrade, ClearCardUpgradePlanCache } from '../src/model/cardUpgradeService.js';
import { canUpgrade, nextUpgradeOptions, nextUpgradeStep, RestUpgradeRule } from '../src/model/cardUpgradeLimits.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { resolveCard } from '../src/model/registries.js';
import { upgradeStepsOf } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { GetActiveScoring } from '../src/model/activeScoring.js';

// Assemble the original service contract with independently unprepared reads.
// This checks the new preparation against full quotes, not just one picked step.
function unpreparedPlan(run, registries, instance, {choices=1,combos=false,vendor=''}={}) {
  const verdict=canUpgrade(registries,run,instance,{preparation:null});
  const quote={ok:verdict.ok,code:verdict.code,reason:verdict.reason,instanceId:instance.instanceId,n:verdict.n,cost:verdict.cost,free:verdict.free,step:null,before:null,after:null};
  if(!verdict.ok&&verdict.code!=='stones')return quote;
  const base=registries.cards.get(instance.cardId),applied=upgradeStepsOf(instance);
  const face=ref=>projectGameCard(run,ref)||resolveCard(registries,ref);
  const after=step=>face({...instance,upgraded:true,upgradeSteps:[...applied,step]});
  const before=face(instance);
  if(choices<=1){
    const step=vendor?nextUpgradeOptions(run,instance,base,registries,1,{vendor,preparation:null})[0]||null:nextUpgradeStep(run,instance,base,registries,{preparation:null});
    return {...quote,...(vendor?{vendor}:{}),step,before,after:after(step)};
  }
  const options=nextUpgradeOptions(run,instance,base,registries,choices,{combos,vendor,preparation:null}).map(step=>({step,after:after(step)}));
  return {...quote,choices,combos,...(vendor?{vendor}:{}),step:options[0].step,options,before,after:options[0].after};
}

for(const scenario of ['fresh','authored','upgraded','maxed','slots','stones'])test('bounded preparation preserves complete independent quotes and reloads: '+scenario,()=>withScoring(()=>{
  const maxed={...cards.plain,id:'fixture.maxed',type:'power',cost:0,staminaCost:0,manaCost:0,effects:[]};
  const registries={...baseRegistries,cards:{...baseRegistries.cards,get:id=>id===maxed.id?maxed:baseRegistries.cards.get(id),has:id=>id===maxed.id||baseRegistries.cards.has(id)}};
  const run=fresh();run.seed=8301;run.level.level=5;run.smithingStones=scenario==='stones'?0:20;run.mapNodeId='fixture.smith';
  const instance={instanceId:'fixture.owned',cardId:scenario==='maxed'?maxed.id:scenario==='authored'?cards.hold.id:cards.plain.id,rank:3,upgraded:false,upgradeSteps:[]};
  if(scenario==='upgraded'||scenario==='stones')Object.assign(instance,{upgraded:true,upgradeSteps:[{k:'dmg',n:1},{k:'fx',fx:'draw',n:1},{k:'fx',fx:'retain'}]});
  if(scenario==='slots')Object.assign(instance,{rank:1,upgraded:true,upgradeSteps:[{k:'dmg',n:1},{k:'fx',fx:'draw',n:1}]});
  run.deck=[instance];run.sideboard=[];
  const snapshot=JSON.stringify(run),definitions=JSON.stringify([cards.plain,cards.hold,maxed]);
  for(const rule of [{},RestUpgradeRule(instance),{choices:3,vendor:'blacksmith'},{choices:3,vendor:'arcane'}]){
    ClearCardUpgradePlanCache(run);
    const expected=unpreparedPlan(run,registries,instance,rule);
    const actual=planCardUpgrade(run,registries,instance.instanceId,rule);
    assert.deepEqual(actual,expected);
    assert.ok(!JSON.stringify(actual).includes('projectionScope'),'scratch context never enters a quote or saved step');
    if(['maxed','slots','stones'].includes(scenario))assert.equal(actual.code,scenario);
    const loaded=JSON.parse(snapshot);
    assert.deepEqual(planCardUpgrade(loaded,registries,instance.instanceId,rule),expected);
    assert.equal(JSON.stringify(run),snapshot,'planning never mutates the run or its saved RNG facts');
  }
  assert.equal(JSON.stringify([cards.plain,cards.hold,maxed]),definitions);
  instance.playsEver=7;instance.rank=4;run.attributes.strength+=2;
  const rule={choices:3,vendor:'blacksmith'};
  assert.deepEqual(planCardUpgrade(run,registries,instance.instanceId,rule),unpreparedPlan(run,registries,instance,rule));
}));

test('prepared structural menus keep every seeded vendor selection and RNG draw identical, and reject changed operands',()=>withScoring(()=>{
  const preparation={},base=structuredClone(cards.plain),applied=[];
  const limits={rank:2,cardRank:2,playerLevel:5,instance:{rank:2},scoring:GetActiveScoring(),registries:baseRegistries};
  const compare=(extra,count)=>{
    let plainDraws=0,preparedDraws=0;
    const plainRng=upgradeStepRng(91,'fixture.roll',0),preparedRng=upgradeStepRng(91,'fixture.roll',0);
    const plain=rollUpgradeOptions(base,applied,applied.length,()=>{plainDraws++;return plainRng();},{...limits,...extra},count);
    const prepared=rollUpgradeOptions(base,applied,applied.length,()=>{preparedDraws++;return preparedRng();},{...limits,...extra,preparation},count);
    assert.deepEqual(prepared,plain);assert.equal(preparedDraws,plainDraws);
  };
  for(const vendor of ['', 'blacksmith','arcane'])for(const count of [1,3,20])compare({vendor},count);
  base.effects[0].amount=12;compare({},3);
  applied.push({k:'dmg',n:1});compare({},3);
  limits.rank=3;limits.cardRank=3;limits.instance.rank=3;compare({},3);
  limits.scale=2;compare({},3);
  limits.maxRange='melee';compare({},3);
  limits.scoring=structuredClone(limits.scoring);limits.scoring.effects.damage.weight=2;compare({},3);
}));
