import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState,serializeRun,deserializeRun } from '../src/model/state.js';
import { gameProfileClassAvailable,gameProfileCompletedRunMeta } from '../src/model/gameProfileRun.js';
import { beginGameProfileRest,createGameProfileRestDraft,commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { stampDeck } from '../src/model/loadout.js';
import { createSaveManager,createMemoryStorage,runKey } from '../src/engine/save.js';
const profile=resolveGameProfile('core');
const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const fresh=()=>createRunState({seed:73,classId:'reaver',registries:reg,runId:'unique-run'});
const visit=run=>{ run.mapGraph=buildActMap(reg,createRng(73),run.seatOrder[0],1);run.mapNodeId='n2_0'; return beginGameProfileRest(run,'1:n2_0'); };

test('fixed classes, ten starters, persistent pin and restamping do not mint equipment grants',()=>{
 const run=fresh(); assert.equal(Object.values(run.attributes).reduce((a,b)=>a+b),6);
 assert.equal(run.attributes.strength,2);assert.equal(run.drawPerTurn,5);assert.equal(run.deck.length,10);
 assert.equal(run.loadout.sets.rightHand[0],'greatsword');assert.equal(run.loadout.sets.leftHand[0],null);
 stampDeck(reg,run);assert.equal(run.deck.length,10);assert.equal(run.deck.filter(c=>c.cardId==='core.strike').length,3);
 assert.throws(()=>createRunState({seed:1,classId:'starseer',registries:reg}),/locked/);
 const meta={gameProfileUnlocks:{[profile.id]:{completedRunIds:['one']}}};
 const star=createRunState({seed:1,classId:'starseer',registries:reg,profileMeta:meta});assert.equal(star.drawPerTurn,6);
 const restored=deserializeRun(serializeRun(run));assert.equal(restored.gameProfile.hash,profile.hash);assert.equal(restored.runId,run.runId);
});

test('terminal wins and defeats each unlock one class, durable dedupe survives history truncation',()=>{
 let meta={};
 for(let i=0;i<30;i++)meta=gameProfileCompletedRunMeta(profile,meta,{finishId:`run-${i}`,victory:i%2===0}).meta;
 assert.equal(meta.gameProfileUnlocks[profile.id].completedRunIds.length,30);
 assert.equal(gameProfileCompletedRunMeta(profile,meta,{finishId:'run-0',victory:true}).meta,meta);
 for(const id of ['reaver','starseer','rogue','herald'])assert.ok(gameProfileClassAvailable(profile,meta,id));
 assert.equal(gameProfileClassAvailable(profile,{},'starseer'),false);
 assert.equal(gameProfileClassAvailable(profile,{},'reaver'),true);
 assert.equal(gameProfileClassAvailable(profile,{},'herald'),false);
});

test('seeded route has seven preboss nodes, exactly two visible rests, and replay stability',()=>{
 const run=fresh();let prior;
 for(let tier=1;tier<=3;tier++){
  const map=buildActMap(reg,createRng(100+tier),run.seatOrder[tier-1],tier);
  assert.equal(Object.keys(map.nodes).length,8);assert.equal(Object.values(map.nodes).filter(n=>n.type==='shrine').length,2);
  assert.equal(map.nodes.boss.floor,8);assert.notEqual(map.nodes.boss.encounterId,prior);prior=map.nodes.boss.encounterId;
  assert.deepEqual(map,buildActMap(reg,createRng(100+tier),run.seatOrder[tier-1],tier));
  for(const n of Object.values(map.nodes))if(!['rest','elite','boss'].includes(n.actualType))assert.equal(n.type,'event');
 }
});

test('rest requires real current rest, commits once and fully recovers after earned CON level',()=>{
 const run=fresh();assert.throws(()=>beginGameProfileRest(run,'forged'),/current rest/);
 visit(run);run.hp=1;run.mana=0;run.stamina=0;run.flaskCharges.hpCurrent=0;run.flaskCharges.manaCurrent=0;
 run.level.unspentPoints=1;const before=run.maxHp;
 commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 assert.equal(run.maxHp,before+10);assert.equal(run.hp,run.maxHp);assert.equal(run.mana,run.maxMana);assert.equal(run.stamina,run.maxStamina);
 assert.equal(run.flaskCharges.hpCurrent,run.flaskCharges.hp);assert.equal(run.flaskCharges.manaCurrent,run.flaskCharges.mana);
 const after=JSON.stringify(run);assert.throws(()=>commitGameProfileRest(reg,run,'strategize'),/spent/);assert.equal(JSON.stringify(run),after);
});

test('failed/rest forgery is atomic; empty Strategize remains available without XP or upgrades',()=>{
 const run=fresh();visit(run);run.hp=1;const before=JSON.stringify(run);
 assert.throws(()=>commitGameProfileRest(reg,run,'levelUp',{attributeId:'strength'}),/no attribute point/);assert.equal(JSON.stringify(run),before);
 const draft=createGameProfileRestDraft(run);draft.deck[0].cardId='unknown';
 assert.throws(()=>commitGameProfileRest(reg,run,'strategize',{draft}),/Unknown/);assert.equal(JSON.stringify(run),before);
 const forged=createGameProfileRestDraft(run);forged.deck.push({instanceId:'fake',cardId:'core.smash',upgraded:false});
 assert.throws(()=>commitGameProfileRest(reg,run,'strategize',{draft:forged}),/invent/);assert.equal(JSON.stringify(run),before);
 commitGameProfileRest(reg,run,'strategize');assert.equal(run.hp,run.maxHp);
});

test('profile peek validates integrity and wrong registry refuses without changing stored bytes',()=>{
 const run=fresh(),storage=createMemoryStorage(),save=createSaveManager(storage);save.saveRun(run,null);
 assert.equal(save.peekRunGameProfile().hash,profile.hash);
 const original=storage.getItem(runKey());assert.equal(save.loadRun(createRegistries(contentBundle)),null);assert.equal(storage.getItem(runKey()),original);
 const tampered=JSON.parse(original);tampered.gameProfile.hash='sha256:wrong';storage.setItem(runKey(),JSON.stringify(tampered));
 assert.throws(()=>save.peekRunGameProfile(),/digest/);const bytes=storage.getItem(runKey());assert.equal(save.loadRun(reg),null);assert.equal(storage.getItem(runKey()),bytes);
});

test('unconfigured legacy creation remains unchanged in mechanics',()=>{
 const legacy=createRunState({seed:73,classId:'reaver',registries:createRegistries(contentBundle)});
 assert.equal(legacy.gameProfile,undefined);assert.equal(legacy.attributes.strength,3);assert.equal(legacy.attributes.constitution,2);
});

test('cards and routes off use an empty deck and explicit foundation activities',()=>{
 const p=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:false,routes:false}});
 const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,p)),p);
 const run=createRunState({seed:1,classId:'reaver',registries:r});
 assert.deepEqual(run.deck,[]);assert.deepEqual(run.sideboard,[]);stampDeck(r,run);assert.deepEqual(run.deck,[]);
 const map=buildActMap(r,createRng(1),run.seatOrder[0],1);
 assert.equal(map.activityLauncher,true);assert.ok(map.nodes.activityFight);assert.ok(map.nodes.activityRest);assert.ok(map.nodes.activityBoss);
});

test('configured low-level level and smith mutations cannot bypass rest',async()=>{
 const {applyLevelUp}=await import('../src/model/levelup.js');const {commitSmithing,commitItemUpgrade}=await import('../src/model/smithing.js');
 const run=fresh();run.level.unspentPoints=1;const before=JSON.stringify(run);
 assert.throws(()=>applyLevelUp(reg,run,'strength'),/committed rest/);
 assert.throws(()=>commitSmithing(reg,run,'armament:greatsword'),/Smith rest/);
 assert.throws(()=>commitItemUpgrade(reg,run,'armament:greatsword',undefined,{free:true}),/Smith rest/);
 assert.equal(JSON.stringify(run),before);
});


test('profile completion ledger persists independently from bounded history and rejects nonterminal facts',()=>{
 let meta=gameProfileCompletedRunMeta(profile,{}, {finishId:'completed',victory:false}).meta;
 const save=createSaveManager(createMemoryStorage());assert.equal(save.saveMeta(meta).ok,true);
 const restored=save.loadMeta();assert.deepEqual(restored.gameProfileUnlocks,meta.gameProfileUnlocks);
 assert.throws(()=>gameProfileCompletedRunMeta(profile,restored,{finishId:'quit'}),/terminal/);
});


test('two CON increases add one authored SP, and Smith commits an equipment tier before full recovery',async()=>{
 const run=fresh();visit(run);run.level.unspentPoints=2;const initial=run.maxStamina;
 commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 run.mapNodeId='n6_0';beginGameProfileRest(run,'1:n6_0');commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 assert.equal(run.maxStamina,initial+1);
 const smith=fresh();visit(smith);smith.smithingStones=999;smith.hp=1;
 const {smithingPlan}=await import('../src/model/smithing.js');const candidate=smithingPlan(reg,smith).candidates.find(row=>row.affordable);
 assert.ok(candidate);commitGameProfileRest(reg,smith,'smith',{itemRef:candidate.itemRef});
 assert.equal(smith.itemUpgradeLevels[candidate.itemRef],candidate.nextLevel);assert.equal(smith.hp,smith.maxHp);
});
