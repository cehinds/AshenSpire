import test from 'node:test';
import assert from 'node:assert/strict';
import { rebalanceCard as rebalanceCardImpl, rebalanceCardAsync as rebalanceCardAsyncImpl, rebalanceItem as rebalanceItemImpl, focusedCardMetrics as focusedCardMetricsImpl, focusedCardConstraints as focusedCardConstraintsImpl, focusedChanges, focusedEffectOptions } from '../tools/score-studio/focusedRebalance.js';
import { TuneCardToTarget } from '../src/model/autoBalance.js';
import { readFileSync } from 'node:fs';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import {scoringContract,tierContract} from './helpers/scoring-contract.mjs';
// A deliberate 20-point band scenario: a single capped primary reaches Rank 2,
// while higher targets require additional effects. Current policy is checked separately.
const scoring={...shippedScoring,...scoringContract(),items:shippedScoring.items,naming:shippedScoring.naming,rank:{unrankedMax:0,width:20,maxRank:5,maxCp:100},
  costs:{sp:{weight:-5},mp:{weight:-15}},effects:{...scoringContract().effects,damage:{weight:1,per:1},block:{weight:1,per:1}},
  statuses:{...scoringContract().statuses,bleed:{weight:3,target:'enemy'},chill:{weight:1,target:'enemy'},shock:{weight:1,target:'enemy'},weak:{weight:3,target:'enemy'},counter:{weight:2,target:'self'},evade:{weight:2,target:'self'},prepared:{weight:2,target:'self'}},tierUnlocks:tierContract()};
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { GenerateSubclassCatalog } from '../src/model/subclassCardGenerator.js';
import { GenerateItem, ScoreGeneratedItem } from '../src/model/itemGenerator.js';
import { validateCardTemplates } from '../src/model/validate/templates.js';
import { walkSchema } from '../src/model/validate/schemaWalk.js';
import { SCHEMAS } from '../src/model/schemas.js';



const globalFixtureScoring=scoring;
const rebalanceCard=(card,settings={},context={})=>rebalanceCardImpl(card,settings,{scoring,...context});
const rebalanceCardAsync=(card,settings={},context={})=>rebalanceCardAsyncImpl(card,settings,{scoring,quantum:1,...context});
const rebalanceItem=(item,settings={},context={})=>rebalanceItemImpl(item,settings,{scoring,...context});
const focusedCardMetrics=(card,context={})=>focusedCardMetricsImpl(card,{scoring,...context});
const focusedCardConstraints=(card,metrics,context={})=>focusedCardConstraintsImpl(card,metrics,context.scoring??scoring);

const attack = { id: 'focused.test', name: 'Hand named blade', class: 'reaver', type: 'attack', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', icon: 'attack', tags: ['camp:physical', 'source:weapon', 'maneuver:attack'], keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 6 }], textTemplate: 'Deal {damage} damage.' };
function validate(card) {
  const errors=[];const err=(path,message)=>errors.push(`${path}: ${message}`);
  const clean=Object.fromEntries(Object.entries(card).filter(([key])=>!key.startsWith('_')));
  delete clean.tags; // Studio carries tagging rows alongside the Core definition.
  const anyId={has:()=>true};
  walkSchema(clean,SCHEMAS.card,'card',{err,ids:new Proxy({},{get:()=>anyId}),nodeIds:anyId,tagIds:anyId,skillIds:anyId});validateCardTemplates(card,'card',err);
  assert.deepEqual(errors,[]);
}

test('default focused settings preserve the entire definition and never mutate originals', () => {
  const original=structuredClone(attack), result=rebalanceCard(attack);
  assert.deepEqual(result.card,original);assert.deepEqual(attack,original);assert.deepEqual(result.changes,[]);
  result.card.effects[0].amount=999;assert.equal(attack.effects[0].amount,6);
});

test('fixed costs, rarity and target rank are honored with actual shared CP and no new drawbacks', () => {
  const result=rebalanceCard(attack,{targetRank:2,targetRarity:'common',sp:1,mp:0});
  assert.equal(result.feasible,true);assert.equal(result.card.staminaCost,1);assert.equal(result.card.manaCost,0);assert.equal(result.metrics.rank,2);
  assert.equal(result.card.name,attack.name);assert.equal(result.card.id,attack.id);assert.equal(result.card.class,attack.class);
  assert.equal(result.card.effects.length,1);assert.equal(result.card.effects[0].op,'damage');
  const face=CardDefinitionToScoreFace(result.card,{scoring});const cp=CombatPower(ScoreCard(face,scoring).raw,result.card.rarity,scoring);
  assert.equal(result.metrics.cp,cp);assert.equal(result.metrics.rank,RankOf(cp,scoring));assert.deepEqual(focusedCardConstraints(result.card,result.metrics),[]);validate(result.card);
});

test('seeded rerolls vary numbers while preserving the authored mechanic shape', () => {
  const settings={targetRank:2,seed:42,reroll:1};
  assert.deepEqual(rebalanceCard(attack,settings),rebalanceCard(attack,settings));
  const variants=Array.from({length:8},(_,reroll)=>rebalanceCard(attack,{...settings,reroll}));
  assert.ok(new Set(variants.map(r=>JSON.stringify(r.card.effects))).size>1);
  for(const result of variants){assert.equal(result.feasible,true);assert.equal(result.card.effects.length,1);assert.equal(result.card.effects[0].op,'damage');assert.equal(result.card.id,attack.id);}
});

test('requested existing effect riders and exact effect counts produce legal text and mechanics', () => {
  for(const preferences of [['draw'],['heal','poise'],['cleanse'],['restoreMp','move']]){
    const result=rebalanceCard(attack,{targetRank:3,effectCount:3,preferredEffects:preferences,seed:42});
    assert.equal(result.feasible,true,result.constraintErrors.join('; '));assert.equal(result.card.effects.length,3);validate(result.card);
    assert.equal(result.card.effects.some(e=>e.op==='loseHp'),false);
  }
});

test('stances compose existing statuses, while unavailable slots preserve primary effects', () => {
  const result=rebalanceCard(attack,{targetRank:3,effectCount:3,preferredEffects:['draw'],preferredStances:['evade'],seed:4});
  assert.equal(result.feasible,true,result.constraintErrors.join('; '));assert.deepEqual(result.card.stanceTrigger,{stance:'evade'});
  assert.ok(result.card.effects.some(e=>e.op==='applyStatus'&&e.status==='evade'));validate(result.card);
  const noSlot=rebalanceCard(attack,{targetRank:2,effectCount:1,preferredEffects:['draw']});
  assert.equal(noSlot.feasible,true);assert.equal(noSlot.card.effects.length,1);assert.equal(noSlot.card.effects[0].op,'damage');assert.match(noSlot.warnings.join(' '),/Primary.*preserved/);
  assert.equal(noSlot.metrics.rank,2);
  const capped=rebalanceCard(attack,{targetRank:3,effectCount:1,preferredEffects:['draw']});
  assert.equal(capped.feasible,false);assert.match(capped.constraintErrors.join(' '),/requested Rank 3/);
  assert.equal(capped.card.effects.length,1);assert.equal(capped.card.effects[0].op,'damage');
});

test('infeasible exact CP, locked zero cost, martial Mana and invalid preferences never masquerade as success', () => {
  for(const settings of [{targetRank:1,targetCp:40,sp:1,mp:0},{targetRank:1,sp:0,mp:0},{targetRank:2,mp:1},{preferredEffects:['imaginary-op']},{effectCount:9}]){
    const result=rebalanceCard(attack,settings);assert.equal(result.feasible,false,JSON.stringify(settings));assert.ok(result.constraintErrors.length);assert.equal(result.card.name,attack.name);
    assert.deepEqual(result.metrics,focusedCardMetrics(result.card));assert.ok(!result.card.effects.some(e=>e.op==='loseHp'));
  }
});

test('manual names remain stable and opt-in convention names reflect the candidate', () => {
  const manual=rebalanceCard(attack,{targetRank:2,generateNames:false}), named=rebalanceCard(attack,{targetRank:2,generateNames:true});
  assert.equal(manual.card.name,attack.name);assert.notEqual(named.card.name,attack.name);assert.equal(named.card._autoName,true);
});

test('provided faceOf drives both tuning and final measured metrics', () => {
  let calls=0;const faceOf=card=>{calls++;const face=CardDefinitionToScoreFace(card,{scoring});face.attr=2;return face;};
  const result=rebalanceCard(attack,{targetRank:2},{scoring,faceOf});
  assert.ok(calls>2);assert.deepEqual(result.metrics,focusedCardMetrics(result.card,{scoring,faceOf}));
});

test('all twelve subclass signatures keep conditions/charges and rebase authored upgrades', () => {
  const scoring=shippedScoring;
  const rebalanceCard=(card,settings)=>rebalanceCardImpl(card,settings,{scoring});
  const focusedCardMetrics=card=>focusedCardMetricsImpl(card,{scoring});
  const focusedCardConstraints=(card,metrics)=>focusedCardConstraintsImpl(card,metrics,scoring);
  const catalog=GenerateSubclassCatalog({seed:7});
  for(const list of catalog.lists){
    const original=catalog.cards.find(c=>list.cardIds.includes(c.id)&&c.effects.some(e=>e.if||e.op==='grantCardCharge'));
    const saved=structuredClone(original), rank=focusedCardMetrics(original).rank;
    const result=rebalanceCard(original,{targetRank:rank,seed:7,reroll:1});
    assert.equal(result.feasible,true,`${list.id}: ${result.constraintErrors.join('; ')}`);
    assert.deepEqual(original,saved);assert.equal(result.card.id,original.id);assert.equal(result.card.class,original.class);assert.equal(result.card.name,original.name);
    assert.deepEqual(result.card.effects.map(e=>({op:e.op,if:e.if,key:e.key,abilityKind:e.abilityKind})),original.effects.map(e=>({op:e.op,if:e.if,key:e.key,abilityKind:e.abilityKind})));
    validate(result.card);if(result.feasible)assert.deepEqual(focusedCardConstraints(result.card,result.metrics),[]);
  }
});

test('inline conditions, alternate payloads and charge bonuses obey the same lower-tier ceilings', () => {
  const metrics={rank:1};
  const direct={...attack,effects:[{op:'damage',target:'enemy',amount:80}]};
  const conditional={...attack,effects:[{op:'damage',target:'enemy',amount:80,if:{p:'hasStatus',of:'target',status:'bleed'}}]};
  const charge={...attack,effects:[{op:'grantCardCharge',target:'self',key:'test',damage:21}]};
  for(const card of [direct,conditional,charge])assert.match(focusedCardConstraints(card,metrics).join(' '),/damage.*ceiling/);
  const alternate={...attack,effectVariants:[{if:{p:'always'},effects:[{op:'applyStatus',target:'self',status:'prepared',stacks:99}]}]};
  assert.match(focusedCardConstraints(alternate,metrics).join(' '),/prepared/);
  const dynamic={...attack,effects:[{op:'damage',target:'enemy',amount:{f:'stacks',of:'target',status:'bleed'}}]};
  assert.match(focusedCardConstraints(dynamic,metrics).join(' '),/finite authored maximum/);
  dynamic.effects[0].amount.max=10;assert.deepEqual(focusedCardConstraints(dynamic,metrics),[]);
  const high=GenerateSubclassCatalog({seed:9,rank:4}).cards.find(c=>c.effects.some(e=>e.if)&&c.effects.some(e=>e.op==='applyStatus'));
  const lowered=rebalanceCard(high,{targetRank:1,sp:1,mp:high.manaCost});
  if(lowered.feasible)assert.deepEqual(focusedCardConstraints(lowered.card,lowered.metrics),[]);
  else assert.ok(lowered.constraintErrors.length);
});

test('charge-only cards can tune their existing payload without adding effects', () => {
  const charge={...attack,id:'focused.charge',class:'starseer',tags:['camp:spell','source:spell'],manaCost:1,effects:[{op:'grantCardCharge',target:'self',key:'focused.charge',abilityKind:'spell',damage:2}],textTemplate:'Your next spell increases existing damage by {chargeDamage}.'};
  const result=rebalanceCard(charge,{targetRank:0,sp:0,mp:1});
  assert.equal(result.feasible,true,result.constraintErrors.join('; '));
  assert.equal(result.card.effects.length,1);assert.equal(result.card.effects[0].key,'focused.charge');assert.ok(result.card.effects[0].damage>2);
  assert.equal(result.card.manaCost,1);assert.equal(result.card.staminaCost,0);assert.deepEqual(result.metrics,focusedCardMetrics(result.card));
  const impossible=rebalanceCard(charge,{targetRank:2,sp:0,mp:1});assert.equal(impossible.feasible,false);assert.match(impossible.constraintErrors.join(' '),/Measured Rank/);
});

test('numeric-only edits preserve authored upgrade deltas and change reports are field-specific', () => {
  const card={...attack,upgrade:{name:'My upgrade',effects:[{op:'damage',target:'enemy',amount:8}],textTemplate:'Deal {damage} damage.'}};
  const result=rebalanceCard(card,{targetRank:2});
  assert.equal(result.card.upgrade.name,'My upgrade');assert.equal(result.card.upgrade.effects[0].amount-result.card.effects[0].amount,2);
  assert.ok(result.changes.some(change=>change.field==='effects'));assert.deepEqual(focusedChanges(card,card),[]);
});

test('items reuse the existing item tuner without changing identity or source entries', () => {
  const item=GenerateItem({kind:'weapon',rank:2,rarity:'common',seed:15}).entry, saved=structuredClone(item);
  assert.deepEqual(rebalanceItem(item).item,saved);
  const result=rebalanceItem(item,{targetRank:3,targetRarity:'uncommon'});
  assert.deepEqual(item,saved);assert.equal(result.item.id,item.id);assert.equal(result.item.key,item.key);assert.equal(result.item.name,item.name);assert.equal(result.item.rarity,'uncommon');
  const score=ScoreGeneratedItem(result.item,scoring);assert.equal(result.metrics.cp,score.cp);assert.equal(result.metrics.rank,score.rank);
  const impossible=rebalanceItem(item,{targetRank:1,targetCp:40});assert.equal(impossible.feasible,false);assert.match(impossible.constraintErrors.join(' '),/requested/);
});

test('existing status preferences materialize exact Bleed/Venom riders and reject unknown or locked statuses', () => {
  const result=rebalanceCard(attack,{targetRank:3,effectCount:3,sp:2,mp:0,preferredEffects:['status:bleed','status:venom'],seed:42});
  assert.equal(result.feasible,true,result.constraintErrors.join('; '));assert.equal(result.card.effects.length,3);assert.equal(result.card.effects[0].op,'damage');
  assert.deepEqual(result.card.effects.filter(e=>e.op==='applyStatus').map(e=>[e.status,e.target]),[['bleed','enemy'],['venom','enemy']]);validate(result.card);
  const invalid=rebalanceCard(attack,{preferredEffects:['status:imaginary']});assert.equal(invalid.feasible,false);assert.match(invalid.constraintErrors.join(' '),/Unsupported/);
  const locked=rebalanceCard(attack,{targetRank:0,preferredEffects:['status:venom']});assert.equal(locked.feasible,false);assert.match([...locked.constraintErrors,...locked.warnings].join(' '),/Venom requires effective tier 1/);
  const options=focusedEffectOptions(scoring);assert.equal(options.filter(o=>o.kind==='status').length,Object.keys(scoring.statuses).length);assert.ok(options.some(o=>o.id==='status:bleed'&&o.label==='Bleed'));
});

test('effect and stance palettes choose seeded subsets while blank count keeps the current number', () => {
  const preferences=['draw','poise','heal'], variants=[];
  for(let reroll=1;reroll<=8;reroll++){
    const result=rebalanceCard(attack,{targetRank:3,effectCount:2,preferredEffects:preferences,seed:23,reroll});
    assert.equal(result.feasible,true,result.constraintErrors.join('; '));assert.equal(result.card.effects.length,2);assert.equal(result.card.effects[0].op,'damage');
    assert.ok(['draw','poiseDamage','heal'].includes(result.card.effects[1].op));variants.push(result.card.effects[1].op);validate(result.card);
  }
  assert.ok(new Set(variants).size>1);
  const kept=rebalanceCard(attack,{targetRank:3,preferredEffects:preferences,seed:23,reroll:1});assert.equal(kept.card.effects.length,attack.effects.length);
  const stanceVariants=[];
  for(let reroll=1;reroll<=8;reroll++){
    const result=rebalanceCard(attack,{targetRank:3,effectCount:2,preferredStances:['counter','evade','prepared'],seed:23,reroll});
    assert.equal(result.feasible,true,result.constraintErrors.join('; '));assert.equal(result.card.effects.length,2);assert.equal(result.card.effects[0].op,'damage');
    stanceVariants.push(result.card.effects.find(e=>e.op==='applyStatus')?.status);validate(result.card);
  }
  assert.ok(new Set(stanceVariants).size>1);
});

test('legacy Core Force card reports its requested-tier cause without an expensive futile search', () => {
  // Historical Force identity is explicit: the live ID is now the authored Mana Rite.
  const card={id:'fixture.legacy-force',name:'Arcane Siphon',class:'colorless',rarity:'uncommon',cost:1,staminaCost:1,manaCost:1,costRule:'fixed',type:'attack',icon:'attack',keywords:[],effects:[{op:'damage',target:'enemy',amount:14},{op:'restoreMana',target:'self',amount:2}],tags:['camp:spell','source:spell','maneuver:casting','classification.attack','school:force','tradition:arcane'],textTemplate:'Deal {damage} damage. Restore {restoreMana} Mana.',damageSchool:'magic',exposureBuildupPerHit:5};
  const scoring=structuredClone(globalFixtureScoring);
  scoring.tierUnlocks.elements.force=3;
  let measures=0;const faceOf=c=>{measures++;return CardDefinitionToScoreFace(c,{scoring});};
  const result=rebalanceCard(card,{targetRank:1,targetCp:2},{scoring,faceOf});
  assert.equal(result.feasible,false);assert.match(result.constraintErrors.join(' '),/Force school requires effective tier 3/);assert.deepEqual(result.card.effects,card.effects);assert.ok(measures<=3);
  const nonForce={...card,tags:card.tags.filter(tag=>tag!=='school:force')};
  const current=rebalanceCard(nonForce,{targetRank:1,targetCp:2},{scoring});
  assert.doesNotMatch(current.constraintErrors.join(' '),/Force school/,'unrelated cards do not inherit a Force gate');
});

test('bounded coarse search visits later cost pairs before refining a legal magnitude', () => {
  const card={...attack,tags:['camp:spell'],damageSchool:'magic',manaCost:1};
  const result=TuneCardToTarget(card,{scoring,targetRank:1,targetCp:2,faceOf:c=>CardDefinitionToScoreFace({...c,staminaCost:0,manaCost:0},{scoring}),scaleField:{index:0,field:'amount'},magnitudeMax:60,maxManaCost:3,searchBudget:320,coarseCostSearch:true,allowExtraEffects:false,allowHpDrawback:false,candidateAllowed:c=>c.staminaCost===3&&c.manaCost===3});
  assert.equal(result.legalCandidate,true);assert.equal(result.card.staminaCost,3);assert.equal(result.card.manaCost,3);assert.equal(result.score.cp,2);assert.ok(result.searched<=320);
});

test('asynchronous tuning matches sync results and yields repeatedly to a live heartbeat', async () => {
  const settings={targetRank:3,effectCount:3,preferredEffects:['draw'],seed:4,reroll:2};
  const sync=rebalanceCard(attack,settings);let beats=0,yields=0;
  const timer=setInterval(()=>beats++,0);
  try{
    const asyncResult=await rebalanceCardAsync(attack,settings,{yieldToUi:()=>{yields++;return new Promise(resolve=>setTimeout(resolve,0));}});
    assert.deepEqual(asyncResult,sync);assert.ok(yields>2);assert.ok(beats>2);
  }finally{clearInterval(timer);}
});

test('asynchronous cancellation stops remaining candidates and never mutates an original', async () => {
  const saved=structuredClone(attack);let cancelled=false, measures=0;
  await assert.rejects(rebalanceCardAsync(attack,{targetRank:3},{faceOf:card=>{measures++;return CardDefinitionToScoreFace(card,{scoring});},shouldCancel:()=>cancelled,yieldToUi:async()=>{cancelled=true;}}),{name:'AbortError'});
  assert.deepEqual(attack,saved);assert.ok(measures<30);
  const controller=new AbortController();controller.abort();
  await assert.rejects(rebalanceCardAsync(attack,{targetRank:3},{signal:controller.signal}),{name:'AbortError'});
});
