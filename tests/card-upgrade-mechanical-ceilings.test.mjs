import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { GenerateSubclassCatalog } from '../src/model/subclassCardGenerator.js';
import { ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { CardDefinitionToScoreFace, EvaluateUpgradeStepCp } from '../src/model/cardUpgradeCp.js';
import { applyUpgradeSteps, UpgradeTagStacks, upgradeStepsProblems } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { NumericCeilingAtTier } from '../src/model/tierUnlocks.js';
import { scoring } from '../src/content/generated/scoring.js';

const historicalScoring = JSON.parse(readFileSync(new URL('./fixtures/scoring-pre-starseer.json', import.meta.url), 'utf8'));

const base = { id:'upgrade.mechanical.fixture',name:'Mechanical fixture',class:'reaver',type:'attack',rarity:'common',cost:1,staminaCost:1,manaCost:0,damageSchool:'physical',keywords:[],tags:['camp:physical','source:weapon','maneuver:attack','classification.attack'],effects:[{op:'damage',target:'enemy',amount:8}] };
const actual = card => ProjectCardMechanicalValues(card).card.effects;
const roll = (card, applied = [], limits = {}) => rollUpgradeOptions(card, applied, applied.length, upgradeStepRng(7,'mechanical-review',applied.length),{cardRank:2,everyFamily:true,scoring,...limits},40);
const total = (effects,op) => effects.reduce((sum,effect)=>sum+(effect.op===op ? effect.amount*(effect.hits||1) : effect.op==='grantCardCharge' ? effect[op]||0 : 0),0);
const authoredFor = (card, wanted, op='damage') => {
  for(let amount=1;amount<=240;amount++){const next=structuredClone(card);next.effects[0].amount=amount;if(actual(next)[0].amount===wanted)return next;}
  throw new Error(`No fixture for ${op} ${wanted}`);
};

test('rolled Quiet Incision damage upgrades remain available when raw inputs exceed the mechanical tier ceiling under the historical fixture',()=>{
  const scoring=historicalScoring;
  const card=GenerateSubclassCatalog({seed:'mechanical-export-integration',subclassIds:['assassin'],countPerSubclass:1},{scoring}).cards[0];
  const current=applyUpgradeSteps(card,[{k:'authored'}]), before=actual(current), cap=NumericCeilingAtTier('damage',2,scoring);
  assert.ok(card.effects[0].amount>cap);assert.equal(total(before,'damage'),27);
  const steps=roll(card,[{k:'authored'}],{playerLevel:2,scoring}).filter(step=>step.k==='dmg');assert.ok(steps.length,'a valid damage step must be offered, not merely allowed by a CP probe');
  for(const step of steps){assert.deepEqual(upgradeStepsProblems([step]),[]);const after=applyUpgradeSteps(current,[step]), projected=actual(after);assert.ok(projected[0].amount>before[0].amount);assert.ok(total(projected,'damage')<=cap);assert.equal(UpgradeTagStacks(after,'improved'),step.improvedStacks||1);const cp=CombatPower(ScoreCard(CardDefinitionToScoreFace(after,{scoring}),scoring).raw,after.rarity,scoring);assert.ok(RankOf(cp,scoring)<=2);assert.equal(EvaluateUpgradeStepCp({baseDef:card,currentDef:current,step,instance:{rank:2},playerLevel:2,scoring}).allowed,true);}
});

test('shipped Quiet Incision reaches the combined damage cap and keeps effective non-damage upgrades',()=>{
  const card=GenerateSubclassCatalog({seed:'mechanical-export-integration',subclassIds:['assassin'],countPerSubclass:1}).cards[0];
  const current=applyUpgradeSteps(card,[{k:'authored'}]), before=actual(current), cap=NumericCeilingAtTier('damage',2,scoring);
  assert.ok(card.effects[0].amount>cap);
  assert.equal(total(before,'damage'),cap,'plain and conditional contacts jointly fill the current cap');
  const steps=roll(card,[{k:'authored'}],{playerLevel:2});
  assert.equal(steps.some(step=>step.k==='dmg'),false,'damage cannot cross the full mechanical cap');
  assert.ok(steps.length,'other effective families remain available');
  for(const step of steps){
    assert.deepEqual(upgradeStepsProblems([step]),[]);
    const after=applyUpgradeSteps(current,[step]);
    assert.notDeepEqual(actual(after),before,'every offered alternative changes actual mechanics');
    assert.ok(total(actual(after),'damage')<=cap);
    assert.equal(EvaluateUpgradeStepCp({baseDef:card,currentDef:current,step,instance:{rank:2},playerLevel:2,scoring}).allowed,true);
  }
});

test('Block upgrades cross authored rounding plateaus and retain their mechanical ceiling and Improved stack',()=>{
  const cap=NumericCeilingAtTier('block',2,scoring), template={...base,type:'skill',upgradeMenu:['blk'],effects:[{op:'block',target:'self',amount:1}]};
  const card=authoredFor(template,cap-1,'block');assert.ok(card.effects[0].amount>cap);
  const steps=roll(card).filter(step=>step.k==='blk');assert.ok(steps.length);
  for(const step of steps){const after=applyUpgradeSteps(card,[step]);assert.ok(actual(after)[0].amount>actual(card)[0].amount);assert.ok(total(actual(after),'block')<=cap);assert.equal(UpgradeTagStacks(after,'improved'),step.improvedStacks||1);}
});

test('numeric ceilings include conditional damage and pending charges rather than only the first plain effect',()=>{
  const cap=NumericCeilingAtTier('damage',1,scoring), template={...base,upgradeMenu:['dmg'],effects:[{op:'damage',target:'enemy',amount:1},{op:'damage',target:'enemy',amount:8,if:{p:'firstAttackThisCombat'}},{op:'grantCardCharge',target:'self',key:'cap',cardType:'attack',damage:1}]};
  const remainder=cap-total(actual({...template,effects:template.effects.slice(1)}),'damage');
  const capped=authoredFor(template,remainder);assert.equal(total(actual(capped),'damage'),cap);assert.equal(roll(capped,[],{cardRank:1}).some(step=>step.k==='dmg'),false);
  const room=authoredFor(template,remainder-1), steps=roll(room,[],{cardRank:1}).filter(step=>step.k==='dmg');assert.ok(steps.length);
  for(const step of steps)assert.ok(total(actual(applyUpgradeSteps(room,[step])),'damage')<=cap);
});

test('the doubled printed-damage guard still applies when the effective tier has no numeric ceiling',()=>{
  const card={...base,upgradeMenu:['dmg']}, printed=actual(card)[0].amount;
  const doubled=authoredFor(card,printed*2), applied=[{k:'dmg',n:doubled.effects[0].amount-card.effects[0].amount}];
  assert.equal(actual(applyUpgradeSteps(card,applied))[0].amount,printed*2);assert.equal(UpgradeTagStacks(applyUpgradeSteps(card,applied),'improved'),1);
  assert.equal(roll(card,applied,{cardRank:4}).some(step=>step.k==='dmg'),false);
});

test('hits and area-to-single upgrades obey the same mechanical cap, and rounded area downgrades are absent',()=>{
  const withCap=cap=>{const copy=structuredClone(scoring);copy.tierUnlocks.ceilings.damage[3]=cap;return copy;};
  const hit={...base,cost:2,staminaCost:2,upgradeMenu:['hits']};assert.ok(roll(hit,[],{cardRank:3,scoring:withCap(100)}).some(step=>step.k==='hits'));assert.equal(roll(hit,[],{cardRank:3,scoring:withCap(actual(hit)[0].amount)}).some(step=>step.k==='hits'),false);
  const area=authoredFor({...base,upgradeMenu:['targeting'],effects:[{op:'damage',target:'allEnemies',amount:1}]},16);
  assert.ok(roll(area,[],{cardRank:3,scoring:withCap(100)}).some(step=>step.k==='tag'&&step.retarget==='single'));assert.equal(roll(area,[],{cardRank:3,scoring:withCap(18)}).some(step=>step.k==='tag'&&step.retarget==='single'),false);
  const rounded={...base,upgradeMenu:['targeting'],effects:[{op:'damage',target:'allEnemies',amount:8}]};assert.equal(actual(rounded)[0].amount,actual(applyUpgradeSteps(rounded,[{k:'tag',tag:'targeting:single',retarget:'single'}]))[0].amount);assert.equal(roll(rounded,[],{cardRank:3}).some(step=>step.k==='tag'&&step.retarget==='single'),false);
});
