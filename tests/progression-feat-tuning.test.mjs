import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { progressionFeats } from '../src/content/progression/feats.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredPropertyRules } from '../src/model/propertyRuleBindings.js';
import { getFeatDescription } from '../src/model/classSkillFeatDescription.js';
import { configuredContentBundle, advancedConfigRows, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { treeProblems, nodeTokens } from '../src/model/tree.js';
import { syncFeatProperties } from '../src/engine/properties.js';
import { createRng } from '../src/engine/rng.js';
const engineRoot=process.env.PROGRESSION_ENGINE_ROOT;
const engine=await import(engineRoot ? pathToFileURL(resolve(engineRoot,'src/engine/combat.js')) : '../src/engine/combat.js');
const bundle={...contentBundle,classSkillFeats:[...contentBundle.classSkillFeats.filter(f=>!progressionFeats.some(n=>n.id===f.id)),...progressionFeats]};

test('every feat magnitude binds to balance with useful Advanced help and text',()=>{
 const variables=bundle.nodeVariables.filter(row=>row.nodeId.startsWith('feat:'));
 assert.equal(variables.length,55);assert.equal(new Set(variables.map(row=>row.nodeId)).size,50);
 const rows=advancedConfigRows(bundle).filter(row=>row.key.startsWith('gameConfig.balance.progressionFeats.'));
 assert.equal(rows.length,variables.length);
 for(const variable of variables){
  const binding=bundle.variableBindings.find(row=>row.nodeId===variable.nodeId && row.variable===variable.variable && row.scope==='default');
  assert.ok(binding?.balancePath.startsWith('progressionFeats.'));const row=rows.find(row=>row.key==='gameConfig.balance.'+binding.balancePath);
  assert.ok(row);assert.equal(row.advancedGroup,'Progression');assert.ok(row.note.length>50);assert.ok(!row.note.includes('Authored balance value'));assert.ok(!/\{.*\}/.test(row.note));
  const rule=bundle.propertyRules.find(row=>row.tag===variable.nodeId);assert.ok(rule.textTemplate.includes('{'+variable.variable+'}'));
 }
 assert.deepEqual(treeProblems(bundle),[]);
});

test('authored feat effects contain variable bindings rather than duplicate magnitudes',()=>{
 const authored=JSON.parse(readFileSync(new URL('../content/source/nodeEffects.json',import.meta.url),'utf8'));
 for(const [tag,rule]of Object.entries(authored).filter(([tag])=>tag.startsWith('feat:'))){
  for(const trigger of rule.triggers||[])for(const effect of trigger.do||[])for(const field of ['amount','stacks','damage','manaDiscount','block','heal','break','buildup'])if(effect[field]!==undefined)assert.equal(typeof effect[field].variable,'string',tag+'.'+field);
  for(const [key,value]of Object.entries(rule.passives||{}))if(typeof value!=='boolean')assert.equal(typeof value.variable,'string',tag+'.'+key);
 }
});

test('default rebinding preserves every existing normalized property and manual fixtures',()=>{
 assert.deepEqual(configuredPropertyRules(contentBundle),contentBundle.propertyRules);
 const fixture={propertyRules:[{tag:'fixture',triggers:[{on:'combatStart',do:[{op:'block',amount:7}]}]}]};
 assert.equal(configuredPropertyRules(fixture),fixture.propertyRules);
 assert.equal(configuredPropertyRules({...fixture,nodeEffects:{fixture:{triggers:[]}}}),fixture.propertyRules);
});

test('each setting changes the mounted magnitude and rendered sentence together',()=>{
 for(const binding of bundle.variableBindings.filter(row=>row.nodeId.startsWith('feat:') && row.scope==='default')){
  const defaultValue=nodeTokens(bundle,binding.nodeId)[binding.variable];const updated=defaultValue+1;
  const configured=configuredContentBundle(bundle,{['gameConfig.balance.'+binding.balancePath]:updated});const registries=createRegistries(configured);
  const feat=progressionFeats.find(row=>'feat:'+row.id.slice('progression-'.length)===binding.nodeId);
  assert.ok(getFeatDescription(registries,feat).includes(String(updated)),binding.nodeId+' text');assert.ok(!/\{[^}]+\}/.test(getFeatDescription(registries,feat)));
  const raw=bundle.nodeEffects[binding.nodeId],resolved=registries.propertyRules.get(binding.nodeId);
  const inspect=(source,value)=>{
   if(source?.variable===binding.variable){assert.equal(value,updated,binding.nodeId+' effect');return;}
   if(source&&typeof source==='object')for(const[key,child]of Object.entries(source))inspect(child,value?.[key]);
  };inspect(raw,resolved);
  assert.equal(nodeTokens(bundle,binding.nodeId)[binding.variable],defaultValue,'authored bundle unchanged');
 }
});

test('a configured damage bonus changes a real card and its description, leaving an existing mount unchanged',()=>{
 const key='gameConfig.balance.progressionFeats.brace-and-bite.damage';const featId='progression-brace-and-bite';
 const play=(setting)=>{
  const original=bundle.cards.find(c=>c.id==='strike');const card={...original,id:'tuning-card',cost:0,effects:[{op:'damage',target:'enemy',amount:5}],upgrade:undefined};
  const authored={...bundle,cards:[...bundle.cards,card],tagging:[...bundle.tagging,{family:'card',scope:'',objectId:card.id,tagId:'classification.attack'},{family:'card',scope:'',objectId:card.id,tagId:'blade'}]};
  const configured=configuredContentBundle(authored,{[key]:setting});const reg=createRegistries(configured);
  const c=engine.createCombat({registries:reg,rng:createRng(411),player:{classId:'reaver',hp:90,maxHp:100,maxMana:10,mana:3,energyMax:3,drawPerTurn:0,deck:[],relicIds:[],skillFeats:[featId]},enemyIds:['wanderingSoldier']});c.skillFeats=[featId];syncFeatProperties(c);c.player.block=1;c.enemies[0].block=0;c.enemies[0].hp=1000;c.enemies[0].maxHp=1000;c.piles.hand.push({instanceId:'test-card',cardId:card.id});
  const from=c.eventLog.length;engine.dispatch(c,{type:'playCard',cardInstanceId:'test-card',targetId:c.enemies[0].id});
  return {c,text:getFeatDescription(reg,featId),damage:c.eventLog.slice(from).filter(e=>e.type==='damageDealt'&&e.sourceId==='player').reduce((n,e)=>n+e.amount,0)};
 };
 const low=play(3),high=play(7);assert.equal(high.damage-low.damage,4);assert.match(low.text,/\+3 damage/);assert.match(high.text,/\+7 damage/);
 assert.equal(low.c.propertyMounts.player['feat:'+featId].rules[0].triggers[0].do[0].damage,3);
});

test('feat tuning import rejects negative, fractional and out-of-range settings by name',()=>{
 for(const value of [-1,1.5,9999])assert.throws(()=>parseAdvancedConfigFile(advancedConfigExport({'gameConfig.balance.progressionFeats.brace-and-bite.damage':value}),bundle),/Brace.*Bite.*Damage/i);
});
