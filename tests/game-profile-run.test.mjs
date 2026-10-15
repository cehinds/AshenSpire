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

test('seeded route has seven branching preboss depths, two mandatory rests, and replay stability',()=>{
 const run=fresh();let prior;
 for(let tier=1;tier<=3;tier++){
  const map=buildActMap(reg,createRng(100+tier),run.seatOrder[tier-1],tier);
  assert.ok(Object.keys(map.nodes).length > 8);assert.equal(map.floors,8);assert.equal(map.columns,3);assert.equal(Object.values(map.nodes).filter(n=>n.type==='shrine').length,2);
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


test('actual core loadRun validates pinned birth gear instead of legacy baseline and preserves deck',()=>{
 const run=fresh();visit(run);const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
 const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));
 assert.equal(restored.loadout.sets.rightHand[0],'greatsword');assert.equal(restored.deck.length,10);assert.equal(restored.gameProfile.hash,profile.hash);
});


test('core Smith is a free single-tier service without stones, with paid override honored',async()=>{
 const run=fresh();visit(run);assert.equal(run.smithingStones,0);
 const {smithingPlan}=await import('../src/model/smithing.js');const item=smithingPlan(reg,run).candidates[0];assert.ok(item);
 commitGameProfileRest(reg,run,'smith',{itemRef:item.itemRef});assert.equal(run.itemUpgradeLevels[item.itemRef],1);assert.equal(run.smithingStones,0);
 assert.throws(()=>commitGameProfileRest(reg,run,'smith',{itemRef:item.itemRef}),/spent/);
 const paid=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{rest:{smith:{free:false,tiersPerService:1}}}});
 const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,paid)),paid);
 const next=createRunState({seed:1,classId:'reaver',registries:r});next.mapGraph=buildActMap(r,createRng(1),next.seatOrder[0],1);next.mapNodeId='n2_0';beginGameProfileRest(next);
 const before=JSON.stringify(next);assert.throws(()=>commitGameProfileRest(r,next,'smith',{itemRef:item.itemRef}),/Insufficient/);assert.equal(JSON.stringify(next),before);
});


test('configured class cards cannot swap or unequip the fixed run class',async()=>{
 const run=fresh(),before=JSON.stringify(run);
 const {equipClassCard}=await import('../src/model/classLibrary.js');const {swapRunClass}=await import('../src/model/classSwap.js');
 assert.throws(()=>equipClassCard(reg,run,null),/fixed for the run/);
 assert.throws(()=>equipClassCard(reg,run,'starseer'),/fixed for the run/);
 assert.throws(()=>swapRunClass(reg,run,'herald'),/fixed for the run/);
 assert.equal(JSON.stringify(run),before);
});


test('configured equipment requirements default none across six families and four armor categories, legacy override restores gates',async()=>{
 const {equipmentRequirementReceipt,equipPiece,ownership}=await import('../src/model/loadout.js');
 const weaponIds=['straightSword','kiteShield','boneSceptre','shortbow','greatsword','dagger'];
 for(const id of weaponIds){const run=fresh(),piece=reg.equipment.armaments.find(row=>row.id===id);assert.ok(piece,id);assert.equal(equipmentRequirementReceipt(reg,piece,run.attributes).ok,true,id);run.loadout.storage.push(id);assert.equal(equipPiece(reg,run.loadout,'rightHand',0,id,ownership(reg,{loadout:run.loadout}),{inCombat:false,classId:run.class,attributes:run.attributes}),true,id);}
 for(const id of ['nightweave','gutterLeathers','default','wayfarerPlate']){const run=fresh(),piece=reg.equipment.armour.find(row=>row.classId===run.class&&row.id===id);assert.ok(piece,id);assert.equal(equipmentRequirementReceipt(reg,piece,run.attributes).ok,true,id);}
 const run=fresh(),owned=ownership(reg,{loadout:run.loadout}),ctx={inCombat:false,classId:run.class,attributes:run.attributes};assert.equal(equipPiece(reg,run.loadout,'rightHand',0,null,owned,ctx),true);assert.equal(equipPiece(reg,run.loadout,'rightHand',0,'greatsword',ownership(reg,{loadout:run.loadout}),ctx),true);
 const old=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{equipment:{requirementsPolicy:'legacy'}}});const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,old)),old),legacy=createRunState({seed:1,classId:'reaver',registries:r});assert.equal(equipmentRequirementReceipt(r,r.equipment.armaments.find(row=>row.id==='greatsword'),legacy.attributes).ok,false);
 assert.deepEqual(applyGameProfileToContent(contentBundle,'current').equipment.equipmentRequirements,contentBundle.equipment.equipmentRequirements);
});

test('Smith tier bonuses share UI combat preview and real damage/block, survive load and disappear on swapping gear',async()=>{
 const {gameProfileRatingReceipt}=await import('../src/model/gameProfileRun.js');
 const {ratingReceipt}=await import('../src/model/combatRatings.js');
 const {createRunCombat}=await import('../src/engine/runCombat.js');
 const {previewCard,dispatch}=await import('../src/engine/combat.js');
 const {smithingPlan}=await import('../src/model/smithing.js');
 const run=fresh();visit(run);
 const fight=()=>createRunCombat({registries:reg,run,rng:createRng(17),enemyIds:['wanderingSoldier']});
 const before=fight(),beforeRatings=ratingReceipt(reg,run,{}).totals;
 const beforeDefend=before.piles.hand.find(card=>card.cardId==='core.defend'),oldBlock=previewCard(before,beforeDefend.instanceId).values.find(e=>e.op==='block').value;
 const oldDamage=new Map(before.piles.hand.map(card=>[card.cardId,previewCard(before,card.instanceId,before.enemies[0].id).values.find(e=>e.op==='damage')?.value]));
 commitGameProfileRest(reg,run,'smith',{itemRef:'armament/greatsword'});
 const after=fight();assert.equal(after.player.ratings.ar,beforeRatings.ar+1);assert.deepEqual(after.player.ratings,gameProfileRatingReceipt(reg,run).totals);assert.deepEqual(after.player.ratings,ratingReceipt(reg,run,{}).totals);
 const damaging=after.piles.hand.find(card=>(previewCard(after,card.instanceId,after.enemies[0].id).values.find(e=>e.op==='damage')?.value||0)>(oldDamage.get(card.cardId)||Infinity));assert.ok(damaging,'at least one real drawn attack gains damage after the weapon upgrade');
 const preview=previewCard(after,damaging.instanceId,after.enemies[0].id).values.find(e=>e.op==='damage').value,hp=after.enemies[0].hp;dispatch(after,{type:'playCard',cardInstanceId:damaging.instanceId,targetId:after.enemies[0].id});assert.equal(hp-after.enemies[0].hp,preview);
 run.mapNodeId='n6_0';beginGameProfileRest(run);const armor=smithingPlan(reg,run).candidates.find(row=>row.itemKind==='armor');assert.ok(armor);const dr=gameProfileRatingReceipt(reg,run).totals.dr;commitGameProfileRest(reg,run,'smith',{itemRef:armor.itemRef});const blockFight=fight();assert.equal(blockFight.player.ratings.dr,dr+1);const defend=blockFight.piles.hand.find(card=>card.cardId==='core.defend');assert.ok(defend);const shown=previewCard(blockFight,defend.instanceId).values.find(e=>e.op==='block').value;assert.equal(shown,oldBlock+1);const blockBefore=blockFight.player.block;dispatch(blockFight,{type:'playCard',cardInstanceId:defend.instanceId});assert.equal(blockFight.player.block-blockBefore,shown);
 const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));assert.deepEqual(gameProfileRatingReceipt(reg,restored).totals,gameProfileRatingReceipt(reg,run).totals);
 run.loadout.sets.rightHand[0]='straightSword';run.loadout.sets.armor[0]='vigil';assert.equal(gameProfileRatingReceipt(reg,run).totals.ar,beforeRatings.ar);assert.equal(gameProfileRatingReceipt(reg,run).totals.dr,beforeRatings.dr);
 const off=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{stats:false}}),r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,off)),off),noStats=createRunState({seed:1,classId:'reaver',registries:r});noStats.itemUpgradeLevels={'armament/greatsword':3};assert.equal(gameProfileRatingReceipt(r,noStats).totals.ar,0);
});


test('configured upgrade groups take highest active tiers without summing and honor JSON coefficients',async()=>{
 const {gameProfileRatingReceipt}=await import('../src/model/gameProfileRun.js');
 const run=fresh(),base=gameProfileRatingReceipt(reg,run).totals;
 run.loadout.sets.leftHand[0]='dagger';run.itemUpgradeLevels={'armament/greatsword':3,'armament/dagger':2};assert.equal(gameProfileRatingReceipt(reg,run).totals.ar,base.ar+3);
 run.loadout.sets.leftHand[0]='kiteShield';run.itemUpgradeLevels['armament/kiteShield']=2;run.itemUpgradeLevels[`armor/reaver/${run.loadout.sets.armor[0]}`]=1;const totals=gameProfileRatingReceipt(reg,run).totals;assert.equal(totals.ar,base.ar+3);assert.equal(totals.dr,base.dr+2);
 const custom=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{equipment:{upgradeBonuses:{weaponARPerTier:2,armorDRPerTier:3}}}}),r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,custom)),custom),other=createRunState({seed:1,classId:'reaver',registries:r});const initial=gameProfileRatingReceipt(r,other).totals.ar;other.itemUpgradeLevels['armament/greatsword']=1;assert.equal(gameProfileRatingReceipt(r,other).totals.ar,initial+2);
});


test('all four unlocked core classes instantiate exact kits and decks, construct combat and load actual saves',async()=>{
 const {createRunCombat}=await import('../src/engine/runCombat.js');
 const meta={gameProfileUnlocks:{[profile.id]:{completedRunIds:['one','two','three']}}};
 const hands={reaver:['greatsword',null],starseer:['boneSceptre',null],rogue:['dagger','dagger'],herald:['boneSceptre',null]};
 for(const [classId,expected] of Object.entries(hands)){
  const run=createRunState({seed:17,classId,registries:reg,profileMeta:meta});assert.equal(run.deck.length,10,classId);
  assert.deepEqual([run.loadout.sets.rightHand[0],run.loadout.sets.leftHand[0]],expected,classId);
  stampDeck(reg,run);assert.equal(run.deck.length,10,classId);
  const combat=createRunCombat({registries:reg,run,rng:createRng(17),enemyIds:['wanderingSoldier']});assert.ok(combat.enemies[0].alive,classId);assert.equal(combat.piles.hand.length,classId==='starseer'?6:5,classId);
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);const restored=save.loadRun(reg);assert.ok(restored,`${classId}: ${JSON.stringify(save.runStatus())}`);assert.equal(restored.deck.length,10,classId);assert.deepEqual([restored.loadout.sets.rightHand[0],restored.loadout.sets.leftHand[0]],expected,classId);
 }
});

test('legacy duplicate equipped-armament validation and normalization remain in force',async()=>{
 const {buildEquippedWeaponCardPlan,normalizeArmamentLocations}=await import('../src/model/loadout.js');
 const legacy=createRegistries(contentBundle),run=createRunState({seed:17,classId:'rogue',registries:legacy});run.loadout.sets.rightHand[0]='dagger';run.loadout.sets.leftHand[0]='dagger';
 assert.throws(()=>buildEquippedWeaponCardPlan(legacy,run.loadout,run.class),/distinct equipment-instance identity/);
 normalizeArmamentLocations(legacy,run.loadout);assert.equal(run.loadout.sets.leftHand[0],null);
});
