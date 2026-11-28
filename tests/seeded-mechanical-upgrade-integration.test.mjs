import test from 'node:test';
import assert from 'node:assert/strict';
import { PrepareUpgradeStepCpContext, EvaluateUpgradeStepCp, CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { ActNodeUpgradeStock } from '../src/model/actSeedSchedule.js';
import { productionBundle } from './helpers/production-bundle.mjs';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps } from '../src/model/cardUpgrade.js';
import { CardScoreReferenceContext, ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { NumericCeilingAtTier } from '../src/model/tierUnlocks.js';

const card = { id:'subclass.seeded-mechanical.fixture',name:'Seeded mechanical fixture',class:'reaver',rarity:'common',type:'attack',cost:1,staminaCost:1,manaCost:0,damageSchool:'physical',tags:['camp:physical','source:weapon','maneuver:attack'],effects:[{op:'damage',target:'enemy',amount:100,if:{p:'firstAttackThisCombat'}}] };

test('prepared candidate CP context preserves shared mechanical projection and custom reliability weights',()=>{
  const custom=structuredClone(scoring);custom.conditionals.inlineIf=.2;
  const args={baseDef:card,currentDef:card,instance:{rank:1},playerLevel:2,scoring:custom};
  const context=PrepareUpgradeStepCpContext(args);
  assert.equal(context.rawBefore,ScoreCard(CardDefinitionToScoreFace(card,{scoring:custom}),custom).raw);
  assert.notEqual(context.rawBefore,PrepareUpgradeStepCpContext({...args,scoring}).rawBefore);
  for(const step of [{k:'dmg',n:4},{k:'fx',fx:'block',n:4},{k:'fx',fx:'draw',n:1}])assert.deepEqual(EvaluateUpgradeStepCp({...args,step,context}),EvaluateUpgradeStepCp({...args,step}));
});

test('injected canonical registries preserve neutral CP and numeric upgrade caps for every class',()=>{
  const {registries}=CardScoreReferenceContext(card);
  let authored=0;
  for(const id of registries.cards.ids()) if(id.startsWith('core.')) {
    const base=registries.cards.get(id);
    assert.deepEqual(CardDefinitionToScoreFace(base,{scoring,registries}),CardDefinitionToScoreFace(base,{scoring}),id);
    authored++;
  }
  assert.ok(authored>=106,'all original Core definitions keep their scoring baseline');
  for(const classId of ['reaver','rogue','starseer','herald']) {
    const base={...card,class:classId,effects:[{op:'damage',target:'enemy',amount:8},{op:'block',target:'self',amount:8}]};
    assert.deepEqual(CardDefinitionToScoreFace(base,{scoring,registries}),CardDefinitionToScoreFace(base,{scoring}),classId);
    const args={baseDef:base,currentDef:base,instance:{rank:2},playerLevel:5,scoring,registries};
    const context=PrepareUpgradeStepCpContext(args);
    assert.equal(context.registries,registries);
    for(const step of [{k:'dmg',n:4},{k:'blk',n:4},{k:'fx',fx:'draw',n:1}]) {
      const direct=EvaluateUpgradeStepCp({...args,step});
      assert.deepEqual(EvaluateUpgradeStepCp({...args,step,context}),direct,classId);
      assert.deepEqual(direct,EvaluateUpgradeStepCp({...args,registries:undefined,step}),classId);
    }
    const limits={tier:2,cardRank:2,playerLevel:5,scoring,everyFamily:true};
    const stock=rollUpgradeOptions(base,[],0,upgradeStepRng(17,classId,0),{...limits,registries},60);
    assert.deepEqual(stock,rollUpgradeOptions(base,[],0,upgradeStepRng(17,classId,0),limits,60),classId);
    assert.ok(stock.some(step=>step.k==='dmg'),`${classId} keeps a real damage upgrade`);
    for(const step of stock.filter(row=>['dmg','blk'].includes(row.k))) {
      const after=ProjectCardMechanicalValues(applyUpgradeSteps(base,[step]),{registries}).card;
      for(const op of ['damage','block']) assert.ok(after.effects.filter(effect=>effect.op===op).reduce((sum,effect)=>sum+effect.amount*(effect.hits||1),0)<=NumericCeilingAtTier(op,2,scoring),`${classId} ${op} cap`);
    }
    assert.ok(!JSON.stringify(stock).includes('registries'),'dependencies never enter saved steps');
  }
});

test('production classic bundle executes seeded schedule and mechanical upgrade paths with live dependencies',()=>{
  const require=productionBundle({additionalModules:['src/model/actSeedSchedule.js','src/model/cardMechanicalProjection.js','src/model/cardUpgradeLimits.js','src/model/cardUpgradeCp.js']});
  const schedule=require('src/model/actSeedSchedule.js'),projection=require('src/model/cardMechanicalProjection.js'),state=require('src/model/state.js'),limits=require('src/model/cardUpgradeLimits.js');
  const stock=schedule.ActNodeUpgradeStock(2026,'1:bundle-blacksmith',{vendor:'blacksmith'});
  assert.equal(JSON.stringify(stock.byTier),JSON.stringify(ActNodeUpgradeStock(2026,'1:bundle-blacksmith',{vendor:'blacksmith'}).byTier));
  const {registries}=projection.CardScoreReferenceContext(card);
  const run=state.createRunState({registries,classId:'reaver',seed:2026,runId:'bundle-seed-mechanics',profileMeta:{gameProfileUnlocks:{core:{completedRunIds:['a','b','c']}}}});
  run.level.level=5;run.actNumber=1;run.mapNodeId='bundle-blacksmith';run.smithingStones=10;
  const instance=run.deck.find(row=>row.cardId==='core.strike');instance.rank=3;instance.upgraded=true;instance.upgradeSteps=[{k:'authored'}];
  const before=JSON.stringify(run),base=registries.cards.get(instance.cardId);
  const first=limits.nextUpgradeOptions(run,instance,base,registries,3,{vendor:'blacksmith'});
  assert.ok(first.length>=1);assert.equal(JSON.stringify(run),before);
  schedule.ClearScheduleCaches();
  assert.equal(JSON.stringify(limits.nextUpgradeOptions(run,instance,base,registries,3,{vendor:'blacksmith'})),JSON.stringify(first));
  // Authored 8 shows 2 with the reference Reaver's 1 Strength (owner, 2026-11-28).
  assert.equal(projection.ProjectCardMechanicalValues({...card,effects:[{op:'damage',target:'enemy',amount:8}]}).tokens.damage,2);
});
