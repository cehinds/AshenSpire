import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposalRuleEnabled, proposalTurnRules, proposalThresholdRules, proposalCardRules,
  proposalTargetRules, proposalHitRules, proposalAfterHitRules, proposalHealingRules,
  proposalRetainProtection } from '../src/model/proposalStatusRules.js';
const data=JSON.parse(readFileSync(new URL('../games/ashenspire/packs/base-cards/statuses.json',import.meta.url)));
const {rules}=data;
const actor=(id,statuses={},extra={})=>({id,hp:40,block:0,barrier:0,statuses:Object.fromEntries(Object.entries(statuses).map(([key,stacks])=>['base.'+key,{stacks}])),...extra});
const player=actor('p'), enemy=actor('e');
const card={type:'attack',range:'melee',tags:['camp:physical','source:weapon'],effects:[{op:'damage',target:'enemy',amount:13}]};
const hit=(target,extra={})=>proposalHitRules({actor:player,target,amount:10,damageType:'slashing',camp:'physical',range:'melee',rules,...extra});

test('all authored statuses have one unique rule and one explicit lifecycle',()=>{
 assert.equal(new Set(data.statuses.map(row=>row.id)).size,data.statuses.length);
 assert.deepEqual(data.statuses.map(row=>row.id).sort(),Object.keys(rules).sort());
 for(const status of data.statuses){assert.equal(status.decay,'none','the helper owns decay, not a second generic decay');assert.ok(rules[status.id].requires.modules.includes('statuses'));}
});

test('module and elemental capabilities are explicit; core never receives elemental behavior',()=>{
 const current={},core={modules:['statuses','defenses','stats','equipment'],elements:[],protections:['block']};
 assert.ok(proposalRuleEnabled(rules['base.greased'],current));
 assert.equal(proposalRuleEnabled(rules['base.greased'],core),false);
 assert.equal(proposalRuleEnabled(rules['base.poison'],core),false);
 assert.equal(proposalRuleEnabled(rules['base.persistent-block'],core),true);
 assert.equal(proposalRuleEnabled(rules['base.persistent-barrier'],core),false);
 assert.equal(proposalRuleEnabled(rules['base.reflect'],core),false);
 assert.deepEqual(proposalTurnRules({actor:actor('e',{poison:3}),phase:'start',rules,capabilities:core}).effects,[]);
 assert.equal(proposalRuleEnabled(rules['base.persistent-block'],{modules:[],elements:[]}),false);
});

test('persistent protection replenishes remaining stacks without duplication or passive decay',()=>{
 const owner=actor('p',{'persistent-block':4,'persistent-barrier':3},{block:2,barrier:8});
 const before=structuredClone(owner),start=proposalTurnRules({actor:owner,phase:'start',rules});
 assert.deepEqual(start.effects,[{op:'block',amount:2,sourceId:'p',targetId:'p'}]);
 assert.deepEqual(start.statusChanges,[]);
 assert.deepEqual(proposalTurnRules({actor:owner,phase:'end',rules}).statusChanges,[]);
 assert.deepEqual(owner,before,'planning never mutates a live actor');
 for(const [camp,status]of[['physical','base.persistent-block'],['spell','base.persistent-barrier']]){
  const out=proposalAfterHitRules({actor:enemy,target:owner,incomingDamage:10,hpDamage:0,camp,rules});
  assert.deepEqual(out.statusChanges,[{actorId:'p',status,delta:-1}],'fully protected connected hits still qualify');
 }
 assert.deepEqual(proposalAfterHitRules({actor:enemy,target:owner,incomingDamage:0,hpDamage:0,camp:'physical',rules}).statusChanges,[]);
});

test('Poison ticks distinctly from Venom; harmful and beneficial decay leave one action opportunity',()=>{
 const owner=actor('e',{poison:3,charm:1,mirrors:1});
 const start=proposalTurnRules({actor:owner,phase:'start',rules});
 assert.equal(start.effects[0].amount,3);assert.equal(start.effects[0].damageType,'decay');
 assert.equal(start.effects[0].direct,false);
 assert.deepEqual(start.statusChanges,[{actorId:'e',status:'base.mirrors',delta:-1}]);
 assert.deepEqual(proposalTurnRules({actor:owner,phase:'end',rules}).statusChanges,[{actorId:'e',status:'base.poison',delta:-1},{actorId:'e',status:'base.charm',delta:-1}]);
 assert.deepEqual(proposalTurnRules({actor:{...owner,statuses:{venom:{stacks:9}}},phase:'start',rules}).effects,[],'legacy Venom remains owned by existing engine rules');
});

test('Blight uses current HP with an at-least threshold and never kills an already dead target twice',()=>{
 assert.equal(proposalThresholdRules({actor:actor('e',{blight:8},{hp:9}),rules}).effects.length,0);
 assert.equal(proposalThresholdRules({actor:actor('e',{blight:9},{hp:9}),rules}).effects[0].amount,9);
 assert.equal(proposalThresholdRules({actor:actor('e',{blight:10},{hp:9}),rules}).effects[0].op,'loseHp');
 assert.equal(proposalThresholdRules({actor:actor('e',{blight:10},{hp:0}),rules}).effects.length,0);
});

test('Grease has an explicit prone roll and melee/reach accuracy cost',()=>{
 const owner=actor('e',{greased:3,charm:1});
 assert.equal(proposalTurnRules({actor:owner,phase:'start',rules,roll:()=>24}).effects[0].status,'prone');
 assert.equal(proposalTurnRules({actor:owner,phase:'start',rules,roll:()=>25}).effects.length,0);
 assert.equal(proposalTargetRules({actor:owner,target:player,card,rules}).accuracyDelta,-45);
 assert.equal(proposalTargetRules({actor:owner,target:player,card:{...card,range:'ranged'},rules}).accuracyDelta,-25);
});

test('Grease fire triples the hit, burns and splashes the original amount without recursive ignition',()=>{
 const target=actor('e',{greased:3}),other=actor('other');
 const out=hit(target,{amount:4,damageType:'fire',camp:'spell',allies:[target,other]});
 assert.equal(out.amount,12);assert.equal(out.unavoidable,true);
 assert.deepEqual(out.statusChanges,[{actorId:'e',status:'base.greased',delta:-1}]);
 assert.deepEqual(out.effects.map(row=>[row.op,row.amount??row.stacks,row.targetId]),[['applyStatus',3,'e'],['damage',6,'other']]);
 assert.equal(out.effects[1].proposalReactive,true);
 assert.equal(hit(target,{amount:4,damageType:'fire',camp:'spell',allies:[other],reactive:true}).effects.filter(row=>row.op==='damage').length,0);
});

test('damage caps and combined multipliers are independent of status insertion order',()=>{
 for(const statuses of[{greased:1,intangible:1},{intangible:1,greased:1}])assert.equal(hit(actor('e',statuses),{damageType:'fire',camp:'spell'}).amount,1);
 for(const statuses of[{mirrors:2,weak:2},{weak:2,mirrors:2}]){
  assert.equal(hit(enemy,{actor:actor('p',statuses),amount:10}).amount,15,'stacks extend duration rather than exponentiating coefficients');
  assert.equal(hit(enemy,{actor:actor('p',statuses),amount:1}).amount,1,'round only after composing outgoing multipliers');
 }
 assert.equal(hit(actor('e',{intangible:1}),{amount:12,direct:false}).amount,12,'ongoing damage bypasses Intangible');
});

test('Bind and Restrained are typed restrictions, independent of burden marker statuses',()=>{
 const bound=actor('p',{bind:1,restrained:2});
 assert.equal(proposalCardRules({actor:bound,card,rules}).allowed,false);
 const skill=proposalCardRules({actor:bound,card:{...card,type:'skill',range:'reach'},rules});
 assert.equal(skill.allowed,true);assert.equal(skill.staminaTax,1);assert.equal(skill.manaTax,0);
 assert.equal(proposalCardRules({actor:bound,card:{...card,type:'skill',range:'ranged'},rules}).staminaTax,0);
 const tracking=proposalCardRules({actor:actor('p',{stagger:1,paralysis:1,'restrained-burden':1}),card,rules});
 assert.equal(tracking.allowed,true);assert.equal(tracking.staminaTax,0,'burden metadata owns its one skip/tax');
});

test('Veil uses perception, Foresight and explicit rolls; area targeting bypasses it',()=>{
 const target=actor('e',{veil:1},{perception:4}),observer=actor('p',{foresight:1},{perception:4});
 const input={actor:observer,target,card,rules};
 assert.equal(proposalTargetRules(input).perceptionChance,50);
 assert.equal(proposalTargetRules({...input,perceptionRoll:49}).allowed,true);
 assert.equal(proposalTargetRules({...input,perceptionRoll:50}).allowed,false);
 assert.equal(proposalTargetRules({...input,actor:player}).perceptionChance,20);
 assert.equal(proposalTargetRules({...input,card:{...card,targeting:'area'}}).perceptionChance,null);
});

test('Evade consumes a charge on success and failure, while unavoidable fire bypasses it',()=>{
 const target=actor('e',{evade:2});
 for(const [evadeRoll,avoided]of[[24,true],[25,false]]){
  const out=proposalTargetRules({actor:player,target,card,rules,evadeRoll});
  assert.equal(out.avoided,avoided);assert.deepEqual(out.statusChanges,[{actorId:'e',status:'base.evade',delta:-1}]);
 }
 const greasy=actor('e',{evade:1,greased:1});
 const fire=proposalTargetRules({actor:player,target:greasy,card:{...card,damageType:'fire'},rules,evadeRoll:0});
 assert.equal(fire.unavoidable,true);assert.equal(fire.avoided,false);assert.deepEqual(fire.statusChanges,[]);
});

test('necrotic conversion heals while divine inversion affects only typed healing',()=>{
 const target=actor('e',{'necrotic-healing':1,'divine-harm':1});
 const necro=hit(target,{amount:7,damageType:'decay',camp:'spell'});
 assert.equal(necro.amount,0);assert.equal(necro.healing,7);
 assert.equal(hit(actor('e',{'necrotic-healing':1,intangible:1}),{amount:7,damageType:'decay'}).healing,7,'conversion precedes protection caps');
 assert.equal(hit(target,{amount:7,damageType:'fire'}).amount,7);
 assert.deepEqual(proposalHealingRules({target,amount:8,damageType:'divine',rules}),{healing:0,damage:8,damageType:'sacred'});
 assert.equal(proposalHealingRules({target,amount:8,rules}).healing,8);
});

test('enchantments and extra equipment actions use ordinary nonrecursive effects',()=>{
 const caster=actor('p',{'elemental-weapon':1,'extra-weapon':1,'extra-shield':1});
 const enchanted=hit(enemy,{actor:caster,card});
 assert.equal(enchanted.effects[0].amount,3);assert.equal(enchanted.effects[0].damageType,'fire');
 const extra=proposalCardRules({actor:caster,card,rules});
 assert.equal(extra.effects[0].amount,13);assert.equal(extra.effects[0].proposalReactive,true);
 assert.equal(extra.statusChanges[0].status,'base.extra-weapon');
 const shield=proposalCardRules({actor:caster,card:{type:'skill',tags:['shield'],effects:[{op:'block',amount:9}]},rules});
 assert.equal(shield.effects[0].amount,9);
 assert.equal(proposalCardRules({actor:caster,card,rules,reactive:true}).effects.length,0);
 assert.equal(hit(enemy,{actor:caster,card,reactive:true}).effects.length,0);
});

test('reflect and automatic reactions preserve ownership and cannot recurse',()=>{
 const defender=actor('p',{reflect:1,'auto-counter':1,'auto-sweep':1}),enemy2=actor('e2');
 const out=proposalAfterHitRules({actor:enemy,target:defender,hpDamage:10,incomingDamage:12,range:'melee',opponents:[enemy,enemy2],rules});
 assert.deepEqual(out.effects.map(row=>[row.amount,row.targetId,row.sourceId]),[[5,'e','p'],[6,'e','p'],[4,'e','p'],[4,'e2','p']]);
 assert.ok(out.effects.every(row=>row.proposalReactive));assert.equal(out.statusChanges.length,2);
 assert.equal(proposalAfterHitRules({actor:enemy,target:defender,hpDamage:10,incomingDamage:12,range:'melee',opponents:[enemy],rules,reactive:true}).effects.length,0);
});

test('guard redirects before damage with stable actor ordering and a finite charge',()=>{
 const a=actor('a',{'guard-allies':1}),z=actor('z',{'guard-allies':2});
 for(const allies of[[a,z],[z,a]]){
  const out=hit(enemy,{allies});assert.equal(out.amount,6);assert.deepEqual(out.redirect,{targetId:'a',amount:4});
  assert.equal(out.effects[0].proposalReactive,true);assert.deepEqual(out.statusChanges,[{actorId:'a',status:'base.guard-allies',delta:-1}]);
 }
 assert.equal(hit(enemy,{allies:[a],reactive:true}).redirect,null);
});

test('retention never creates Block and Many Forms extends capacity through explicit stacks',()=>{
 const owner=actor('p',{'retain-block':2,'many-forms':1},{block:13});
 // Capped retention remains available to other authored rules. Hold Block uses
 // the generic full-retention modifier so it matches its unqualified card text.
 const cappedRules={...rules,'base.retain-block':{...rules['base.retain-block'],behaviors:[{kind:'retainProtection',pool:'block',amountPerStack:4}]}};
 assert.equal(proposalRetainProtection({actor:owner,rules:cappedRules}),8);
 assert.equal(proposalRetainProtection({actor:owner,amount:3,rules:cappedRules}),3);
 assert.equal(proposalRetainProtection({actor:owner,pool:'barrier',amount:9,rules:cappedRules}),0);
 assert.equal(data.statuses.find(row=>row.id==='base.retain-block').modifiers.retainBlock,true);
 assert.deepEqual(rules['base.retain-block'].behaviors,[]);
 assert.deepEqual(rules['base.retain-block'].decay,{phase:'start',stacks:1});
 assert.equal(proposalCardRules({actor:owner,card,rules}).additionalStanceCapacity,1);
 assert.equal(proposalCardRules({actor:actor('p',{'read-intent':1}),card,rules}).revealIntent,undefined,
  'the status marker cannot reveal intents without a selected-target read ledger');
});
