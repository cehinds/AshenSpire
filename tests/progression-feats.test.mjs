import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { contentBundle } from '../src/content/index.js';
import { progressionFeats, progressionFeatUnlocks } from '../src/content/progression/feats.js';
import { createRegistries, passiveMax } from '../src/model/registries.js';
import { classSkillFeats } from '../src/content/classSkillFeats.js';
import { classMasteryProblems } from '../src/model/classMasteryContent.js';
import { syncFeatProperties, propertyMountsOf } from '../src/engine/properties.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { validateContent } from '../src/model/validate.js';

// Optional path composes this independent content workstream with the sibling
// DSL while it is still being integrated. In the aggregate tree no override is needed.
const engineRoot=process.env.PROGRESSION_ENGINE_ROOT;
const actions=await import(engineRoot ? pathToFileURL(resolve(engineRoot,'src/engine/actions.js')) : '../src/engine/actions.js');
const engine=await import(engineRoot ? pathToFileURL(resolve(engineRoot,'src/engine/combat.js')) : '../src/engine/combat.js');
const triggers=await import(engineRoot ? pathToFileURL(resolve(engineRoot,'src/engine/triggers.js')) : '../src/engine/triggers.js');
const acceptance={...contentBundle.cards[0],id:'acceptance',effects:[{op:'damage',target:'allEnemies',amount:5}],textTemplate:'Deal {damage} damage.'};
const bundle={...contentBundle,cards:[...contentBundle.cards.filter(c=>c.id!=='acceptance'),acceptance],classSkillFeats:[...classSkillFeats,...progressionFeats]};
const reg=createRegistries(bundle);
const id=slug=>'progression-'+slug;
const player=(feats=[])=>({classId:'reaver',maxHp:100,hp:80,maxMana:10,mana:3,energyMax:3,drawPerTurn:0,deck:[],relicIds:[],skillFeats:feats});
function fight(feats=[]){return createCombat({registries:reg,rng:createRng(17),player:player(feats),enemyIds:['wanderingSoldier']});}

// slug, card tags, current/before-play history, expected operation and values.
// These are independently authored acceptance cases from the approved prose.
const cases=[
 ['coal-on-steel',['blade'],{},'applyStatus',{status:'bleed',stacks:1}],
 ['brace-and-bite',['blade'],{block:1},'grantCardCharge',{damage:3}],
 ['red-footwork',['guard'],{targetStatus:'bleed'},'draw',{amount:1}],
 ['anvil-discipline',['heavy'],{},'grantCardCharge',{break:2}],
 ['forge-momentum',['blade'],{tagPlays:{guard:1}},'grantCardCharge',{damage:4}],
 ['paid-in-blood',['blood'],{hpLostSinceTurnStart:1},'grantCardCharge',{damage:4}],
 ['last-rampart',['guard'],{hp:50},'grantCardCharge',{block:4}],
 ['war-cadence',['heavy'],{tagPlays:{heavy:2}},'block',{amount:4}],
 ['broad-sentence',['blade'],{targetsAll:true},'grantCardCharge',{damage:2}],
 ['ember-sovereign',[],{charge:'ember-crown'},'grantCardCharge',{damage:2}],
 ['dread-of-the-hammer',['heavy'],{targetStatus:'staggered'},'grantCardCharge',{damage:4}],
 ['scarred-oath',['guard'],{hpLostSinceTurnStart:1},'grantCardCharge',{block:3}],
 ['harvest-the-wound',[],{killedStatus:'bleed'},'heal',{amount:3}],
 ['orbit-keeper',['starstone'],{previousSpell:1},'grantCardCharge',{damage:3}],
 ['moonward-scholar',['guard'],{manaSpent:2,spell:true},'grantCardCharge',{block:3}],
 ['comet-reader',['ability:comet-mark'],{},'applyStatus',{status:'vulnerable',stacks:1}],
 ['mirror-of-rime',['ability:rime-mirror'],{},'grantCardCharge',{buildup:2,buildupStatus:'frost'}],
 ['constellation-keeper',['starstone'],{distinctTagPlays:{starstone:{a:true,b:true}}},'grantCardCharge',{damage:3}],
 ['patient-wellspring',['ability:mana-weave'],{},'block',{amount:3}],
 ['weight-of-the-void',['ability:gravity-snare'],{},'applyStatus',{status:'weak',stacks:1}],
 ['nightglass-scholar',[],{charge:'nightglass',spell:true},'grantCardCharge',{damage:2}],
 ['eclipse-hunter',['starstone'],{targetStatus:'frost'},'grantCardCharge',{damage:4}],
 ['firmament-keeper',[],{consumed:'warded-casting'},'block',{amount:4}],
 ['celestial-refrain',['starstone'],{sameCardPlays:{acceptance:2}},'block',{amount:4}],
 ['threefold-sky',['starstone'],{distinctTagPlays:{starstone:{a:true,b:true,c:true}}},'draw',{amount:1}],
 ['first-knife',['blade'],{cardsPlayed:0},'grantCardCharge',{damage:3}],
 ['pocket-method',['guard'],{discarded:1},'grantCardCharge',{block:3}],
 ['crooked-measure',['ability:crooked-guard'],{},'applyStatus',{status:'weak',stacks:1}],
 ['open-flank',['blade'],{targetBlock:0},'grantCardCharge',{damage:3}],
 ['hidden-palm',['ability:sleight-hand'],{discarded:1},'block',{amount:3}],
 ['tighten-the-wire',['ability:tether-cut'],{targetStatus:'weak'},'grantCardCharge',{damage:3}],
 ['smoke-dancer',['blade'],{charge:'smoke-edge'},'grantCardCharge',{damage:2}],
 ['carrion-measure',['blade'],{targetHp:50},'grantCardCharge',{damage:4}],
 ['two-quiet-knives',['ability:paired-strikes'],{},'grantCardCharge',{damage:1}],
 ['trapdoor-smile',['blade'],{tagPlays:{guile:1,guard:1}},'grantCardCharge',{damage:4}],
 ['clean-exit',['guard'],{attacksPlayed:0},'restoreStamina',{amount:1}],
 ['razor-ledger',['blade'],{discarded:1},'grantCardCharge',{damage:3}],
 ['ashen-mercy',['ability:mercy-ash'],{},'grantCardCharge',{heal:2}],
 ['censer-keeper',['ability:blood-censer'],{},'block',{amount:3}],
 ['sower-of-blight',['ability:blight-seed'],{},'grantCardCharge',{buildup:2,buildupStatus:'crimsonBlight'}],
 ['funeral-watch',['guard'],{hp:50},'grantCardCharge',{block:3}],
 ['ember-almoner',['ability:ember-tithe'],{},'applyStatus',{status:'regen',stacks:1}],
 ['choir-of-bone',['guard'],{targetStatus:'crimsonBlight'},'restoreStamina',{amount:1}],
 ['requiem-reader',['ritual'],{targetStatus:'crimsonBlight'},'grantCardCharge',{damage:3}],
 ['pilgrim-of-scars',['guard'],{turnStartHpPct:50},'heal',{amount:3}],
 ['crowned-offering',['ritual'],{offeringsPaid:1},'grantCardCharge',{damage:4}],
 ['dawn-cantor',['ability:dawn-rite'],{},'block',{amount:3}],
 ['bearer-of-burdens',[],{newNegative:true},'restoreMana',{amount:1}],
 ['sepulchral-promise',[],{killedStatus:'crimsonBlight'},'heal',{amount:3}],
];
function eventFor(combat,slug,tags,scenario){
 const p=combat.player,e=combat.enemies[0];
 p.block=scenario.block||0;p.hp=scenario.hp??80;e.block=scenario.targetBlock??1;e.hp=scenario.targetHp??80;e.maxHp=100;
 if(scenario.targetStatus)e.statuses[scenario.targetStatus]={stacks:1};
 const history={cardsPlayed:0,tagPlays:{},distinctTagPlays:{},manaSpent:0,discarded:0,hpLostSinceTurnStart:0,offeringsPaid:0,previousSpell:0,turnStartHpPct:80,attacksPlayed:0,cardPlaysCombat:0,charges:{},...scenario};
 if(scenario.charge)history.charges[scenario.charge]={damage:3};
 p.abilityRiders=structuredClone(history);
 const rule=reg.propertyRules.get('feat:'+slug).triggers[0];
 return {type:rule.on,sourceId:scenario.newNegative?e.id:p.id,targetId:scenario.newNegative?p.id:e.id,cardId:'acceptance',cardType:'attack',cardTags:tags,abilityKind:scenario.spell?'spell':'maneuver',cardTargetsAllEnemies:!!scenario.targetsAll,targetsAllEnemies:!!scenario.targetsAll,keys:scenario.consumed?[scenario.consumed]:[],...(scenario.killedStatus?{targetStatusesBefore:{[scenario.killedStatus]:{stacks:1}}}:{}),status:'weak',sourceKind:scenario.newNegative?'enemy':'player',targetKind:scenario.newNegative?'player':'enemy',wasAbsent:!!scenario.newNegative,amount:1,abilityBefore:history,abilityEntities:{player:structuredClone(p),[e.id]:structuredClone(e)}};
}
for(const [slug,tags,scenario,opcode,values] of cases)test(slug+' applies its authored bonus once and rejects another owner',()=>{
 const c=fight([id(slug)]);const event=eventFor(c,slug,tags,scenario);const start=c.queue.length;
 triggers.emitEvent(c,event.type,{...event,sourceId:'unrelated',targetId:'unrelated'});assert.equal(c.queue.length,start,'unrelated event must not spend the gate');
 triggers.emitEvent(c,event.type,event);assert.equal(c.queue.length,start+1,'qualified first event');
 const effect=c.queue.at(-1).effect;assert.equal(effect.op,opcode);for(const [key,value]of Object.entries(values))assert.deepEqual(effect[key],value,key);
 triggers.emitEvent(c,event.type,event);assert.equal(c.queue.length,start+1,'second event in turn is gated');
 c.turn++;triggers.emitEvent(c,event.type,event);assert.equal(c.queue.length,start+(scenario.killedStatus?1:2),'turn gates reset; kill gates remain once per combat');
});

test('fifty unique feats, matching gates, and unchanged original twenty',()=>{
 assert.equal(progressionFeats.length,50);assert.equal(new Set(progressionFeats.map(f=>f.id)).size,50);
 assert.equal(cases.length+1,50);assert.equal(classSkillFeats.length,20);
 assert.deepEqual(bundle.classSkillFeats.slice(0,20),classSkillFeats);
 for(const feat of progressionFeats){assert.ok(progressionFeatUnlocks.some(row=>row.ref===feat.id && row.classId===feat.skillId.slice(6) && row.level===feat.minLevel));assert.ok(reg.classSkillFeats.find(f=>f.id===feat.id).propertyTags.length===1);}
 assert.deepEqual(classMasteryProblems(bundle),[]);
});

test('selected feat mounts once; deselection removes only its carrier',()=>{
 const c=fight([id('brace-and-bite'),id('coal-on-steel')]);const key='feat:'+id('brace-and-bite');const mounts=propertyMountsOf(c,c.player);assert.ok(mounts[key]);
 const stable=mounts[key];syncFeatProperties(c);assert.equal(propertyMountsOf(c,c.player)[key],stable);
 c.skillFeats=[id('coal-on-steel')];syncFeatProperties(c);assert.ok(!propertyMountsOf(c,c.player)[key]);assert.ok(propertyMountsOf(c,c.player)['class:reaver']);
});

test('combat snapshot restores selected carriers and spent gates without replay',()=>{
 const c=fight([id('brace-and-bite')]);const event=eventFor(c,'brace-and-bite',['blade'],{block:1});triggers.emitEvent(c,event.type,event);c.queue=[];
 const saved=serializeCombatSnapshot(c);assert.ok(!saved.propertyMounts);const restored=restoreCombatSnapshot({registries:reg,rng:createRng(17),snapshot:saved});
 assert.deepEqual(restored.skillFeats,c.skillFeats);assert.ok(propertyMountsOf(restored,restored.player)['feat:'+id('brace-and-bite')]);
 const before=restored.queue.length;triggers.emitEvent(restored,event.type,event);assert.equal(restored.queue.length,before);
});

test('co-op mounts each seat selection under its own identity',()=>{
 const c=createCoopCombat({registries:reg,rng:createRng(19),players:[{...player([id('coal-on-steel')]),id:'a'},{...player([id('brace-and-bite')]),id:'b'}],enemyIds:['wanderingSoldier']});
 const a=propertyMountsOf(c,c.players.get('a').entity),b=propertyMountsOf(c,c.players.get('b').entity);assert.ok(a['feat:'+id('coal-on-steel')]);assert.ok(!a['feat:'+id('brace-and-bite')]);assert.ok(b['feat:'+id('brace-and-bite')]);
});

test('Memory of Winter retains at most four Block on a real turn, with highest allowance',()=>{
 const c=fight([id('memory-of-winter')]);c.player.block=10;c.enemies[0].intent=null;dispatch(c,{type:'endTurn'});assert.equal(c.player.block,4);assert.equal(passiveMax(reg,[],'retainBlockUpTo',propertyMountsOf(c,c.player)),4);
 c.skillFeats=[];syncFeatProperties(c);c.player.block=10;c.enemies[0].intent=null;dispatch(c,{type:'endTurn'});assert.equal(c.player.block,0);
 assert.equal(passiveMax(reg,[],'retainBlockUpTo',{a:{rules:[{passives:{retainBlockUpTo:4}}]},b:{rules:[{passives:{retainBlockUpTo:6}}]}}),6);
});

test('invalid feat carriers and malformed property DSL fail with row identity',()=>{
 const b={...bundle,classSkillFeats:[...classSkillFeats,{...progressionFeats[0],id:'unmounted'}]};assert.match(classMasteryProblems(b).join('\n'),/unmounted.*effect/);
 // Full schema validation must reject malformed generic effects, not merely
 // accept a named property as proof of executable behaviour.
 const malformed={...bundle,propertyRules:bundle.propertyRules.map(row=>row.tag==='feat:coal-on-steel'?{...row,triggers:[{on:'cardPreparing',do:[{op:'madeUp',amount:1}]}]}:row)};
 assert.ok(validateContent(malformed).errors.some(e=>JSON.stringify(e).includes('madeUp')));
});

// Exercise the modifier path through actual card resolution, rather than only
// inspecting queued recipes. Each scalar modifier is measured against the same
// play without the feat, with identical seed, history and targets.
const firstHitFeats = new Set(['ember-sovereign','nightglass-scholar','smoke-dancer','requiem-reader']);
for(const [slug,tags,scenario,opcode,values] of cases.filter(row=>row[3]==='grantCardCharge'))test(slug+' changes a real card result by its exact bonus',()=>{
 function play(selected){
  const stat=values.buildupStatus;
  const effects=[{op:'damage',target:scenario.targetsAll?'allEnemies':'enemy',amount:5,...(slug==='two-quiet-knives'||firstHitFeats.has(slug)?{hits:2}:{})},{op:'block',target:'self',amount:5},{op:'heal',target:'self',amount:5},...(stat?[{op:'applyStatus',target:'enemy',status:stat,stacks:1}]:[])];
  const card={...acceptance,type:'attack',cost:0,manaCost:0,abilityKind:scenario.spell?'spell':'maneuver',effects,upgrade:undefined};
  const rb={...bundle,cards:[...contentBundle.cards,card],tagging:[...bundle.tagging,{family:'card',scope:'',objectId:'acceptance',tagId:'classification.attack'},...tags.map(tagId=>({family:'card',scope:'',objectId:'acceptance',tagId}))]};
  const rr=createRegistries(rb);const c=engine.createCombat({registries:rr,rng:createRng(59),player:player(selected?[id(slug)]:[]),enemyIds:scenario.targetsAll?['wanderingSoldier','wanderingSoldier']:['wanderingSoldier']});
  c.skillFeats=selected?[id(slug)]:[];syncFeatProperties(c);
  eventFor(c,slug,tags,scenario);for(const enemy of c.enemies){enemy.maxHp=1000;enemy.hp=scenario.targetHp?400:900;enemy.block=scenario.targetBlock??1;}
  c.piles.hand.push({instanceId:'acceptance-copy',cardId:'acceptance'});c.player.energy=99;const before=c.eventLog.length;
  engine.dispatch(c,{type:'playCard',cardInstanceId:'acceptance-copy',targetId:c.enemies[0].id});
  const events=c.eventLog.slice(before);return {c,damage:events.filter(e=>e.type==='damageDealt'&&e.sourceId==='player').map(e=>e.amount),block:c.player.block,heal:events.filter(e=>e.type==='healed').reduce((n,e)=>n+e.amount,0),buildup:events.filter(e=>e.type==='statusApplied'&&e.status===stat).reduce((n,e)=>n+e.stacks,0),impact:events.filter(e=>e.type==='poiseDamageDealt'||e.type==='impactDealt')};
 }
 const base=play(false),boosted=play(true);
 if(values.damage)assert.deepEqual(boosted.damage,base.damage.map((n,index)=>n+(firstHitFeats.has(slug)&&index>0?0:slug==='dread-of-the-hammer'?6:values.damage)),'only the authored hit or effect scope receives the bonus');
 if(values.block)assert.equal(boosted.block-base.block,values.block);
 if(values.heal)assert.equal(boosted.heal-base.heal,values.heal);
 if(values.buildup)assert.equal(boosted.buildup-base.buildup,values.buildup);
 if(values.break)assert.ok(boosted.c.enemies[0].poiseMeter.value>=base.c.enemies[0].poiseMeter.value+values.break);
});

for(const [slug,tags,before]of [['war-cadence',['heavy'],{tagPlays:{heavy:1}}],['celestial-refrain',['starstone'],{sameCardPlays:{acceptance:1}}],['threefold-sky',['starstone'],{distinctTagPlays:{starstone:{a:true,b:true}}}]])test(slug+' counts the card just resolved instead of its before-play snapshot',()=>{
 const card={...acceptance,cost:0,effects:[{op:'block',target:'self',amount:1}],upgrade:undefined};
 const rr=createRegistries({...bundle,cards:[...contentBundle.cards,card],tagging:[...bundle.tagging,{family:'card',scope:'',objectId:'acceptance',tagId:'classification.attack'},...tags.map(tagId=>({family:'card',scope:'',objectId:'acceptance',tagId}))]});
 const c=engine.createCombat({registries:rr,rng:createRng(44),player:player([id(slug)]),enemyIds:['wanderingSoldier']});c.skillFeats=[id(slug)];syncFeatProperties(c);
 eventFor(c,slug,tags,before);c.piles.draw=[{instanceId:'drawn-bonus',cardId:'strike'}];c.piles.hand.push({instanceId:'metric-card',cardId:'acceptance'});
 engine.dispatch(c,{type:'playCard',cardInstanceId:'metric-card',targetId:c.enemies[0].id});
 if(slug==='threefold-sky')assert.ok(c.piles.hand.some(card=>card.instanceId==='drawn-bonus'));
 else assert.equal(c.player.block,5);
});

test('Hidden Palm sees the explicit discard performed within the resolving card',()=>{
 const c=fight([id('hidden-palm')]);const event=eventFor(c,'hidden-palm',['ability:sleight-hand'],{discarded:0});c.player.abilityRiders.discarded=1;
 triggers.emitEvent(c,'cardResolved',event);assert.equal(c.queue.length,1);assert.equal(c.queue[0].effect.amount,3);
});

for(const [slug,status]of [['harvest-the-wound','bleed'],['sepulchral-promise','crimsonBlight']])test(slug+' heals after a lethal final hit using target status before death',()=>{
 const card={...acceptance,cost:0,effects:[{op:'damage',target:'enemy',amount:5}],upgrade:undefined};
 const rr=createRegistries({...bundle,cards:[...contentBundle.cards,card],tagging:[...bundle.tagging,{family:'card',scope:'',objectId:'acceptance',tagId:'classification.attack'}]});
 const c=engine.createCombat({registries:rr,rng:createRng(77),player:{...player([id(slug)]),hp:50},enemyIds:['wanderingSoldier']});c.skillFeats=[id(slug)];syncFeatProperties(c);
 c.enemies[0].hp=1;c.enemies[0].block=0;c.enemies[0].statuses[status]={stacks:1};c.piles.hand.push({instanceId:'kill-card',cardId:'acceptance'});
 engine.dispatch(c,{type:'playCard',cardInstanceId:'kill-card',targetId:c.enemies[0].id});assert.equal(c.result,'victory');assert.equal(c.player.hp,53);
});

test('Bearer of Burdens restores Mana for a newly enemy-applied debuff, not a friendly buff or repeated application',()=>{
 const c=engine.createCombat({registries:reg,rng:createRng(88),player:player([id('bearer-of-burdens')]),enemyIds:['wanderingSoldier']});c.skillFeats=[id('bearer-of-burdens')];syncFeatProperties(c);
 const source=c.enemies[0];const apply=status=>{actions.executeAction(c,{effect:{op:'applyStatus',target:'player',status,stacks:1},source,owner:source,target:c.player,meta:{}});while(c.queue.length)actions.executeAction(c,c.queue.shift());};
 apply('strength');assert.equal(c.player.mana,3);apply('weak');assert.equal(c.player.mana,4);apply('weak');assert.equal(c.player.mana,4);apply('frail');assert.equal(c.player.mana,4);
 c.turn++;delete c.player.statuses.frail;apply('frail');assert.equal(c.player.mana,5);
});

test('Cold Memory retention is independent in co-op seats',()=>{
 const c=createCoopCombat({registries:reg,rng:createRng(24),players:[{...player([id('memory-of-winter')]),id:'a'},{...player([]),id:'b'}],enemyIds:['wanderingSoldier']});
 const a=c.players.get('a').entity,b=c.players.get('b').entity;assert.equal(passiveMax(reg,[],'retainBlockUpTo',propertyMountsOf(c,a)),4);assert.equal(passiveMax(reg,[],'retainBlockUpTo',propertyMountsOf(c,b)),0);
});
