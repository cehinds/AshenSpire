import test from 'node:test';
import assert from 'node:assert/strict';
import { PrepareUpgradeStepCpContext, EvaluateUpgradeStepCp, CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { ActNodeUpgradeStock } from '../src/model/actSeedSchedule.js';
import { productionBundle } from './helpers/production-bundle.mjs';

const card = { id:'subclass.seeded-mechanical.fixture',name:'Seeded mechanical fixture',class:'reaver',rarity:'common',type:'attack',cost:1,staminaCost:1,manaCost:0,damageSchool:'physical',tags:['camp:physical','source:weapon','maneuver:attack'],effects:[{op:'damage',target:'enemy',amount:100,if:{p:'firstAttackThisCombat'}}] };

test('prepared candidate CP context preserves shared mechanical projection and custom reliability weights',()=>{
  const custom=structuredClone(scoring);custom.conditionals.inlineIf=.2;
  const args={baseDef:card,currentDef:card,instance:{rank:1},playerLevel:2,scoring:custom};
  const context=PrepareUpgradeStepCpContext(args);
  assert.equal(context.rawBefore,ScoreCard(CardDefinitionToScoreFace(card,{scoring:custom}),custom).raw);
  assert.notEqual(context.rawBefore,PrepareUpgradeStepCpContext({...args,scoring}).rawBefore);
  for(const step of [{k:'dmg',n:4},{k:'fx',fx:'block',n:4},{k:'fx',fx:'draw',n:1}])assert.deepEqual(EvaluateUpgradeStepCp({...args,step,context}),EvaluateUpgradeStepCp({...args,step}));
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
  assert.equal(projection.ProjectCardMechanicalValues({...card,effects:[{op:'damage',target:'enemy',amount:8}]}).tokens.damage,3);
});
