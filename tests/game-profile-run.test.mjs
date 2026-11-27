import '../src/engine/runCombat.js'; // binds the combat engine Core Smith card rows run
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileGear.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile,applyGameProfileToContent,bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState,serializeRun,deserializeRun } from '../src/model/state.js';
import { gameProfileClassAvailable,gameProfileCompletedRunMeta } from '../src/model/gameProfileRun.js';
import { beginGameProfileRest,createGameProfileRestDraft,commitGameProfileRest,restServiceUsed } from '../src/model/gameProfileRest.js';
import { gameProfileRestModel } from '../src/ui/models/GameProfileRestModel.js';
import { buildActMap } from '../src/engine/actmap.js';
import { legacyCoreProfile } from './coreLegacyRoutes.mjs';
import { createRng } from '../src/engine/rng.js';
import { stampDeck } from '../src/model/loadout.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { createSaveManager,createMemoryStorage,runKey } from '../src/engine/save.js';
import { SmithProbeAuthor } from '../tools/lib/smith-shot-fixture.mjs';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
const profile=resolveGameProfile('core');
const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const fresh=(registries=reg)=>createRunState({seed:73,classId:'reaver',registries,runId:'unique-run'});
// Exercise paid and free Smith transactions with a profile that grants a real tier benefit.
const smithGear={statPoints:{perRank:1}};
const smithProfile=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{gear:smithGear}});
const smithReg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,smithProfile)),smithProfile);
// The pre-one-pick Core rest block (arrival heals, every service once, Level Up listed). A run pins its profile, so an old save keeps it.
const LEGACY_RESTS={servicesPerVisit:'all',services:['smith','levelUp','upgradeCard'],recovery:{hp:'full',sp:'full',mp:'full',healingFlasks:'full',mpFlasks:'full'},smith:{free:true,tiersPerService:1}};
const freshLegacy=()=>{const run=fresh(smithReg);run.gameProfile.content.rests=structuredClone(LEGACY_RESTS);return run;};
// A branch may open narrow, so a rest depth's lane ids vary by seed: take the first rest on the floor.
// The old fixed rest depths 3, 6, 9 stand for the first, second and last rest depth of the act (Core now rests on one mid depth and the pre-boss depth).
const restId=(run,floor)=>{const rests=Object.values(run.mapGraph.nodes).filter(n=>n.type==='shrine');const depths=[...new Set(rests.map(n=>n.floor))].sort((x,y)=>x-y);const at=floor===3?0:floor===6?1:depths.length-1;return rests.find(n=>n.floor===depths[Math.min(at,depths.length-1)]).id;};
const visit=(run,registries=reg)=>{ run.mapGraph=buildActMap(registries,createRng(73),run.seatOrder[0],1);run.mapNodeId=restId(run,3); return beginGameProfileRest(run,'1:'+run.mapNodeId); };

// Arithmetic operands: keep current identities/availability, but deliberately
// assign the tested armaments' new points to STR. Resolve this tiny catalog
// overlay normally rather than editing a resolved profile or its hash.
function smithArithmeticFixture(perRank = 1, { stats = true } = {}) {
 const mainId=fresh().loadout.sets.rightHand[0];
 const sourceId=item=>item.source?.id||item.id;
 const second=profile.content.gear.find(item=>item.kind!=='armor'&&sourceId(item)!==mainId&&reg.equipment.armaments.some(piece=>piece.id===sourceId(item)));
 assert.ok(mainId&&second,'two current armament identities support the two-hand scenario');
 const ids=[mainId,sourceId(second)],selected=new Set(ids);
 const gearModule=gameProfileCatalog.modules.gear;
 const defaults={...gearModule.defaults};delete defaults.typeEffectsVersion;
 const packs=Object.fromEntries(Object.entries(gameProfileCatalog.packs).map(([key,pack])=>[key,!pack.content.gear?pack:{...pack,content:{...pack.content,
  gear:pack.content.gear.map(item=>selected.has(sourceId(item))?{...item,weights:{...item.weights,bonus:{strength:1}}}:item),
 }}]));
 const catalog={...gameProfileCatalog,packs,modules:{...gameProfileCatalog.modules,gear:{...gearModule,defaults}}};
 const author=SmithProbeAuthor();
 author.modules.gear={...author.modules.gear,maxAttributes:5,
  statPoints:{...author.modules.gear.statPoints,perRank},
  pointValues:{ar:0,dr:0,poise:0,hp:0,mp:0,sp:0,ward:0,evasion:0,precision:0,strength:1,dexterity:1,constitution:1,wisdom:1,intelligence:1},
  weights:{global:{bonus:{strength:1}}}};
 delete author.modules.gear.typeEffectsVersion;
 author.modules.equipment={requirementsPolicy:'none',weaponArts:false,upgradeBonuses:{tierBonusSteps:[1,2,3],tierStoneCosts:[1,1,1]}};
 author.modules.effects={baseDamageMultiplier:1,physicalDamageMultiplier:1,playerDamageMultiplier:1,enemyDamageMultiplier:1,blockGainMultiplier:1,strengthDamageWeight:1,dexterityBlockWeight:1,magicStatWeight:1};
 if(!stats)author.modules.stats=false;
 const resolved=resolveGameAuthor(author,catalog);
 const bound=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,resolved)),resolved);
 const registries={...bound,equipment:{...bound.equipment,armaments:bound.equipment.armaments.map(piece=>selected.has(piece.id)?{...piece,mods:[],tags:[],itemTypeTags:[]}:piece)}};
 const run=fresh(registries);run.relics=[];run.itemUpgradePicks={};
 return {registries,run,ids,profile:resolved};
}

test('configured class defaults, persistent pins and restamping preserve the authored deck and grants',()=>{
 const run=fresh();
 assert.deepEqual(run.attributes,profile.content.classAttributes.reaver);
 const before=structuredClone(run.deck);
 const ordinary=run.deck.filter(card=>!card.grantedBy&&!card.equipmentRole);
 assert.deepEqual(ordinary.map(card=>card.cardId),profile.content.starterDeck.classDecks.reaver.flatMap(row=>Array(row.copies).fill(row.card)));
 stampDeck(reg,run);assert.deepEqual(run.deck,before,'restamping does not mint grants');
 assert.throws(()=>createRunState({seed:1,classId:'starseer',registries:reg}),/locked/);
 const meta={gameProfileUnlocks:{[profile.id]:{completedRunIds:['one']}}};
 const star=createRunState({seed:1,classId:'starseer',registries:reg,profileMeta:meta});
 assert.ok(Number.isFinite(star.drawPerTurn)&&star.drawPerTurn>0);
 const restored=deserializeRun(serializeRun(run));assert.equal(restored.gameProfile.hash,profile.hash);assert.equal(restored.runId,run.runId);
 assert.deepEqual(restored.deck,run.deck);
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

test('seeded route has eleven preboss depths, a start rest from act 2, a rest in every lane of every branch on one mid depth and one pre-boss rest per branch, distinct branch bosses, and replay stability',()=>{
 const run=fresh();let prior;
 for(let tier=1;tier<=3;tier++){
  const map=buildActMap(reg,createRng(100+tier),run.seatOrder[tier-1],tier);
  const b=map.bossIds.length;assert.ok(b>=1&&b<=5);assert.equal(map.floors,12);
  const restDepths=[...new Set(Object.values(map.nodes).filter(n=>n.type==='shrine').map(n=>n.floor))].sort((x,y)=>x-y);
  const mid=restDepths.filter(f=>f>1&&f<11);assert.equal(mid.length,1);assert.ok(tier===1?[5,6].includes(mid[0]):[5,6,7].includes(mid[0]),`mid rest depth ${mid}`);
  assert.deepEqual(restDepths,tier>=2?[1,mid[0],11]:[mid[0],11]);
  for(let k=0;k<b;k++){for(const floor of restDepths.filter(f=>f>1)){const row=Object.values(map.nodes).filter(n=>n.branch===k&&n.floor===floor);assert.ok(row.length>=1&&row.every(n=>n.type==='shrine'),`branch ${k} floor ${floor} is all rests`);if(floor===11)assert.equal(row.length,1,'one pre-boss rest per branch');}}
  const bosses=map.bossIds.map(id=>map.nodes[id]);assert.ok(bosses.every(n=>n.floor===12));assert.equal(new Set(bosses.map(n=>n.encounterId)).size,b);
  assert.notEqual(map.nodes[map.bossId].encounterId,prior);prior=map.nodes[map.bossId].encounterId;
  assert.deepEqual(map,buildActMap(reg,createRng(100+tier),run.seatOrder[tier-1],tier));
  // Depth 1 opens on a fight drawn as a fight (routes.firstFloor, owner 2026-10-18); every other hidden type is still '?'.
  // Core 2 shows every node type (hiddenTypes empty); an old pinned profile still hides them behind '?' events.
  for(const n of Object.values(map.nodes)){if(n.floor===1&&tier===1){assert.equal(n.actualType,'fight');assert.equal(n.type,'monster');}
   else assert.equal(n.type,{fight:'monster',event:'event',elite:'elite',treasure:'treasure',shop:'merchant',rest:'shrine',boss:'boss'}[n.actualType]);}
  const old=legacyCoreProfile(),oldReg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,old)),old);
  const oldMap=buildActMap(oldReg,createRng(100+tier),run.seatOrder[tier-1],tier);
  for(const n of Object.values(oldMap.nodes)){if(n.floor===1){assert.equal(n.actualType,'fight');assert.equal(n.type,'monster');}
   else if(!['rest','elite','boss'].includes(n.actualType))assert.equal(n.type,'event');}
 }
});

test('rest requires real current rest, commits once and fully recovers after earned CON level',()=>{
 const run=freshLegacy();assert.throws(()=>beginGameProfileRest(run,'forged'),/current rest/);
 visit(run);run.hp=1;run.mana=0;run.stamina=0;run.flaskCharges.hpCurrent=0;run.flaskCharges.manaCurrent=0;
 run.level.unspentPoints=1;const before=run.maxHp;
 commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 assert.equal(run.maxHp,before+5);assert.equal(run.hp,run.maxHp);assert.equal(run.mana,run.maxMana);assert.equal(run.stamina,run.maxStamina);
 assert.equal(run.flaskCharges.hpCurrent,run.flaskCharges.hp);assert.equal(run.flaskCharges.manaCurrent,run.flaskCharges.mana);
 const after=JSON.stringify(run);assert.throws(()=>commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'}),/spent/);assert.equal(JSON.stringify(run),after);
});

test('failed/rest forgery is atomic; Strategize is no longer a rest service (D10)',()=>{
 const run=freshLegacy();visit(run);run.hp=1;const before=JSON.stringify(run);
 assert.throws(()=>commitGameProfileRest(reg,run,'levelUp',{attributeId:'strength'}),/no attribute point waiting/);assert.equal(JSON.stringify(run),before);
 assert.throws(()=>commitGameProfileRest(reg,run,'strategize'),/Unknown rest service/);assert.equal(JSON.stringify(run),before);
 assert.throws(()=>commitGameProfileRest(reg,run,'smith',{itemRef:'forged'}));assert.equal(JSON.stringify(run),before);
});

test('Core rest heals on arrival, and Smith and Level Up are both usable in one visit (D10)',()=>{
 const run=freshLegacy();run.hp=1;run.mana=0;run.stamina=0;run.flaskCharges.hpCurrent=0;run.flaskCharges.manaCurrent=0;
 const v=visit(run);
 assert.equal(run.hp,run.maxHp,'arrival heals');assert.equal(run.flaskCharges.hpCurrent,run.flaskCharges.hp);assert.ok(v.healed.hp>0);
 run.hp=1;visit(run);assert.equal(run.hp,1,'a remount of the same visit does not heal again');
 run.level.unspentPoints=1;
 const m1=gameProfileRestModel(reg,run,v);
 assert.ok(m1.services.every(row=>row.available),'both services open together');
 const candidate=m1.smith.candidates.find(row=>m1.smithPreviews.get(row.itemRef).available);
 commitGameProfileRest(reg,run,'smith',{itemRef:candidate.itemRef});
 const m2=gameProfileRestModel(reg,run,run.gameProfileRestVisits[v.id]);
 assert.equal(m2.services.find(row=>row.id==='smith').available,false);
 assert.equal(m2.services.find(row=>row.id==='levelUp').available,true,'Smith does not close Level Up');
 commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 assert.deepEqual(run.gameProfileRestVisits[v.id].used,{smith:true,levelUp:true});assert.equal(run.hp,run.maxHp);
 assert.throws(()=>commitGameProfileRest(reg,run,'smith',{itemRef:candidate.itemRef}),/spent/);
 assert.throws(()=>commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'}),/spent/);
 const old={id:'x',service:'smith'};assert.equal(restServiceUsed(old,'smith'),true);assert.equal(restServiceUsed(old,'levelUp'),false,'a save from before used[] still reads');
});

test('profile peek validates integrity and wrong registry refuses without changing stored bytes',()=>{
 const run=fresh(),storage=createMemoryStorage(),save=createSaveManager(storage);save.saveRun(run,null);
 assert.equal(save.peekRunGameProfile().hash,profile.hash);
 const original=storage.getItem(runKey());assert.equal(save.loadRun(createRegistries(contentBundle)),null);assert.equal(storage.getItem(runKey()),original);
 const tampered=JSON.parse(original);assert.ok(tampered.gameProfileRef&&!tampered.gameProfile,'a catalog profile is stored as a reference');delete tampered.gameProfileRef;tampered.gameProfile={...structuredClone(profile),hash:'sha256:wrong'};storage.setItem(runKey(),JSON.stringify(tampered));
 assert.throws(()=>save.peekRunGameProfile(),/digest/);const bytes=storage.getItem(runKey());assert.equal(save.loadRun(reg),null);assert.equal(storage.getItem(runKey()),bytes);
});

test('unconfigured legacy creation remains unchanged in mechanics',()=>{
 const legacy=createRunState({seed:73,classId:'reaver',registries:createRegistries(contentBundle)});
 assert.equal(legacy.gameProfile,undefined);assert.equal(legacy.attributes.strength,3);assert.equal(legacy.attributes.constitution,2);
});

test('cards and routes off use an empty deck and explicit foundation activities',()=>{
 const p=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{cards:false,routes:false}});
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


// Current Core derives one SP per DEX point. CON adds no SP.
test('two DEX increases from 2 add two authored SP, and Smith commits an equipment tier before full recovery',async()=>{
 const run=freshLegacy();visit(run);
 const {rederivePools}=await import('../src/model/levelup.js');
 run.attributes.dexterity+=2-gameProfileEffectiveAttributes(reg,run).dexterity;rederivePools(reg,run,'test');
 assert.equal(gameProfileEffectiveAttributes(reg,run).dexterity,2);
 run.level.unspentPoints=3;const initial=run.maxStamina;
 commitGameProfileRest(reg,run,'levelUp',{attributeId:'dexterity'});
 assert.equal(run.maxStamina,initial+1);
 run.mapNodeId=restId(run,6);beginGameProfileRest(run,'1:'+run.mapNodeId);commitGameProfileRest(reg,run,'levelUp',{attributeId:'dexterity'});
 assert.equal(run.maxStamina,initial+2);
 run.actNumber=2;run.mapNodeId=restId(run,9);beginGameProfileRest(run,'2:'+run.mapNodeId);commitGameProfileRest(reg,run,'levelUp',{attributeId:'constitution'});
 assert.equal(run.maxStamina,initial+2,'CON adds no SP');
 const smith=freshLegacy();visit(smith);smith.smithingStones=999;smith.hp=1;
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
 const run=fresh(smithReg);visit(run);assert.equal(run.smithingStones,0);
 const {smithingPlan}=await import('../src/model/smithing.js');const item=smithingPlan(reg,run).candidates[0];assert.ok(item);
 commitGameProfileRest(reg,run,'smith',{itemRef:item.itemRef});assert.equal(run.itemUpgradeLevels[item.itemRef],1);assert.equal(run.smithingStones,0);
 assert.throws(()=>commitGameProfileRest(reg,run,'smith',{itemRef:item.itemRef}),/spent/);
 const paid=resolveGameProfile({formatVersion:1,core:'ashen.core@2.0.0',modules:{gear:smithGear,rest:{smith:{free:false,tiersPerService:1}}}});
 const r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,paid)),paid);
 const next=createRunState({seed:1,classId:'reaver',registries:r});next.mapGraph=buildActMap(r,createRng(1),next.seatOrder[0],1);next.mapNodeId=restId(next,3);beginGameProfileRest(next);
 const before=JSON.stringify(next);assert.throws(()=>commitGameProfileRest(r,next,'smith',{itemRef:item.itemRef}),/Insufficient/);assert.equal(JSON.stringify(next),before);
});


test('an explicit zero-per-rank profile refuses an effectless owned armament upgrade',async()=>{
 const {registries:r,run}=smithArithmeticFixture(0);visit(run,r);
 const {smithingPlan}=await import('../src/model/smithing.js');
 const main=run.loadout.sets.rightHand[run.loadout.active.rightHand||0];
 assert.ok(r.equipment.armaments.some(piece=>piece.id===main));
 const itemRef=`armament/${main}`;
 assert.equal(run.gameProfile.modules.gear.statPoints.perRank,0);
 assert.equal(smithingPlan(r,run).candidates.some(row=>row.itemRef===itemRef),false);
 const before=JSON.stringify(run);
 assert.throws(()=>commitGameProfileRest(r,run,'smith',{itemRef}),/not an eligible/);
 assert.equal(JSON.stringify(run),before);
});


test('configured class cards cannot swap or unequip the fixed run class',async()=>{
 const run=fresh(),before=JSON.stringify(run);
 const {equipClassCard}=await import('../src/model/classLibrary.js');const {swapRunClass}=await import('../src/model/classSwap.js');
 assert.throws(()=>equipClassCard(reg,run,null),/fixed for the run/);
 assert.throws(()=>equipClassCard(reg,run,'starseer'),/fixed for the run/);
 assert.throws(()=>swapRunClass(reg,run,'herald'),/fixed for the run/);
 assert.equal(JSON.stringify(run),before);
});


test('explicit no-requirements policy covers the current catalog; legacy minima fail closed at a controlled boundary',async()=>{
 const {equipmentRequirementReceipt,equipPiece,ownership,fitsSlot}=await import('../src/model/loadout.js');
 const author=SmithProbeAuthor();author.modules.equipment={requirementsPolicy:'none'};
 const p=resolveGameProfile(author),r=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,p)),p);
 const definitionSnapshot=JSON.stringify(r.equipment),run=fresh(r);
 assert.ok(r.equipment.armaments.length&&r.equipment.armour.length);
 for(const piece of r.equipment.armaments){
  assert.equal(equipmentRequirementReceipt(r,piece,{}).ok,true,piece.id);
  const loadout=structuredClone(run.loadout);
  for(const ids of Object.values(loadout.sets))ids.fill(null);
  loadout.storage=[piece.id];
  const slot=r.equipment.slots.find(slot=>fitsSlot(slot,piece));assert.ok(slot,piece.id);
  assert.equal(equipPiece(r,loadout,slot.id,0,piece.id,ownership(r,{loadout}),{inCombat:false,classId:run.class,attributes:{}}),true,piece.id);
 }
 for(const piece of r.equipment.armour)assert.equal(equipmentRequirementReceipt(r,piece,{}).ok,true,`${piece.classId}/${piece.id}`);
 const main=run.loadout.sets.rightHand[run.loadout.active.rightHand||0],ctx={inCombat:false,classId:run.class,attributes:run.attributes};
 assert.equal(equipPiece(r,run.loadout,'rightHand',0,null,ownership(r,{loadout:run.loadout}),ctx),true);
 assert.equal(equipPiece(r,run.loadout,'rightHand',0,main,ownership(r,{loadout:run.loadout}),ctx),true);
 const legacyAuthor=SmithProbeAuthor();legacyAuthor.modules.equipment={requirementsPolicy:'legacy'};
 const old=resolveGameProfile(legacyAuthor);
 const basis=contentBundle.equipment.armaments[0];
 const input={...contentBundle,equipment:{...contentBundle.equipment,
  armaments:contentBundle.equipment.armaments.map(piece=>piece.id===basis.id?{...piece,requirements:{attributes:{strength:3}}}:piece),
  equipmentRequirements:[...contentBundle.equipment.equipmentRequirements.filter(row=>row.itemId!==basis.id),{itemId:basis.id,attributeId:'strength',minimum:3}],
 }};
 const inputSnapshot=JSON.stringify(input.equipment);
 const project=resolved=>bindGameProfileRegistries(createRegistries(applyGameProfileToContent(input,resolved)),resolved);
 const legacy=project(old),required=legacy.equipment.armaments.find(piece=>piece.id===basis.id);
 const unrestricted=project(p),cleared=unrestricted.equipment.armaments.find(piece=>piece.id===basis.id);
 assert.deepEqual(required.requirements.attributes,{strength:3},'legacy policy preserves the controlled input requirement');
 assert.deepEqual(cleared.requirements.attributes,{},'none policy clears executable requirements');
 assert.equal(unrestricted.equipment.equipmentRequirements.length,0,'none policy also clears the authored requirement table');
 assert.equal(equipmentRequirementReceipt(unrestricted,cleared,{}).ok,true);
 assert.equal(equipmentRequirementReceipt(legacy,required,{strength:2}).ok,false);
 assert.equal(equipmentRequirementReceipt(legacy,required,{strength:3}).ok,true);
 assert.equal(equipmentRequirementReceipt(legacy,required,{}).ok,false,'missing attributes fail closed');
 assert.equal(JSON.stringify(input.equipment),inputSnapshot);
 assert.equal(JSON.stringify(r.equipment),definitionSnapshot);
});

 // Owner, 2026-11-14: the quote is the HP lost after the target's Poise; the AR bonus is read off the receipt's incoming hit.
test('Smith tier bonuses share UI combat preview and real damage/block, and disappear on swapping gear',async()=>{
 const {gameProfileRatingReceipt}=await import('../src/model/gameProfileRun.js');
 const {ratingReceipt}=await import('../src/model/combatRatings.js');
 const {createRunCombat}=await import('../src/engine/runCombat.js');
 const {previewCard,dispatch}=await import('../src/engine/combat.js');
 const {smithingPlan}=await import('../src/model/smithing.js');
 const fixture=smithArithmeticFixture(),run=fixture.run,itemRef=`armament/${fixture.ids[0]}`;
 const card=(id,effects,maneuver)=>({id,name:id,class:'colorless',rarity:'common',type:maneuver==='defend'?'skill':'attack',kindIds:[`classification.${maneuver==='defend'?'skill':'attack'}`],costRule:'fixed',cost:1,staminaCost:1,manaCost:0,damageSchool:'physical',exposureBuildupPerHit:0,keywords:[],effects,
  attack:{damageType:'blunt'},tags:['camp:physical',`maneuver:${maneuver}`,'range:melee',`classification.${maneuver==='defend'?'skill':'attack'}`]});
 const cards=[card('fixture.smith.hit',[{op:'damage',target:'enemy',amount:8}],'attack'),card('fixture.smith.block',[{op:'block',target:'self',amount:5}],'defend')];
 // This is also the Smith simulator's internal key; its definition is wholly
 // controlled here, rather than borrowed from today's enemy catalog.
 const enemy={id:'wanderingSoldier',name:'Fixture target',hp:[1000,1000],poiseMax:0,attributes:{strength:0,dexterity:0,constitution:0,wisdom:0,intelligence:0},spPool:1,firstMove:'idle',moves:{idle:{id:'idle',enemyId:'wanderingSoldier',intent:'block',block:0,sp:1,weight:1,tags:['camp:physical','maneuver:defend']}}};
 const base=fixture.registries;
 const r={...base,cards:{...base.cards,has:id=>cards.some(card=>card.id===id)||base.cards.has(id),get:id=>cards.find(card=>card.id===id)||base.cards.get(id)},
  enemies:{...base.enemies,has:id=>id===enemy.id||base.enemies.has(id),get:id=>id===enemy.id?enemy:base.enemies.get(id)}};
 run.deck=cards.map((card,index)=>({cardId:card.id,instanceId:`smith.${index}`,upgraded:false}));run.sideboard=[];
 for(const [slot,ids] of Object.entries(run.loadout.sets))if(slot!=='rightHand')ids.fill(null);
 visit(run,r);
 const definitionSnapshot=JSON.stringify({cards,enemy,profile:fixture.profile});
 const fight=()=>{const combat=createRunCombat({registries:r,run,rng:createRng(17),enemyIds:[enemy.id]});
  combat.fixCoreRules.accuracy.hitRoll=false;combat.fixCoreRules.stance={...combat.fixCoreRules.stance,effectivenessMultiplier:1,discount:0};delete combat.fixCoreRules.stanceBenefits;
  for(const entity of [combat.player,...combat.enemies]){entity.statuses={};entity.critRules=[];delete entity.combatStance;delete entity.combatCounter;}
  const target=combat.enemies[0];target.hp=target.maxHp=1000;target.ratings={ar:0,dr:0,pr:0,poise:0,ward:0};target.persistentPoise={value:0,max:0};target.block=0;delete target.weaknesses;
  combat.player.stamina=combat.player.energy=100;combat.player.mana=100;
  for(const pile of Object.values(combat.piles))pile.length=0;combat.piles.hand.push(...structuredClone(run.deck));return combat;};
 const before=fight(),beforeRatings=ratingReceipt(r,run,{}).totals;
 const previewHit=combat=>previewCard(combat,'smith.0',combat.enemies[0].id).values.find(effect=>effect.op==='damage').damageReceipt.totalDamage;
 const previewBlock=combat=>previewCard(combat,'smith.1').values.find(effect=>effect.op==='block').value;
 const oldDamage=previewHit(before),oldBlock=previewBlock(before);
 const quote=smithingPlan(r,run,undefined,{free:true}).candidates.find(row=>row.itemRef===itemRef);assert.ok(quote);
 commitGameProfileRest(r,run,'smith',{itemRef});
 const after=fight(),expected=gameProfileRatingReceipt(r,run);
 assert.deepEqual(after.player.ratings,expected.totals);assert.deepEqual(after.player.ratings,ratingReceipt(r,run,{}).totals);
 assert.ok(after.player.ratings.ar>beforeRatings.ar,'controlled STR allocation reaches the rating receipt');
 const preview=previewHit(after),hp=after.enemies[0].hp;assert.ok(preview>oldDamage);
 dispatch(after,{type:'playCard',cardInstanceId:'smith.0',targetId:after.enemies[0].id});assert.equal(hp-after.enemies[0].hp,preview);
 const blockFight=fight(),shownBlock=previewBlock(blockFight),block=blockFight.player.block;
 dispatch(blockFight,{type:'playCard',cardInstanceId:'smith.1'});assert.equal(blockFight.player.block-block,shownBlock);
 assert.equal(shownBlock,oldBlock,'a STR-only tier does not change the controlled Block channel');
 run.loadout.sets.rightHand[0]=null;const swapped=gameProfileRatingReceipt(r,run).totals;
 delete run.itemUpgradeLevels[itemRef];assert.deepEqual(swapped,gameProfileRatingReceipt(r,run).totals,'an unequipped tier contributes no global rating');
 const off=smithArithmeticFixture(1,{stats:false}),noUpgrades=gameProfileRatingReceipt(off.registries,off.run).totals;
 off.run.itemUpgradeLevels={[`armament/${off.ids[0]}`]:3};assert.deepEqual(gameProfileRatingReceipt(off.registries,off.run).totals,noUpgrades,'stats off suppresses the tier rating');
 assert.equal(JSON.stringify({cards,enemy,profile:fixture.profile}),definitionSnapshot);
});


test('configured Smith tiers follow the Core 2 tier steps per hand and honor JSON coefficients',async()=>{
 const {gameProfileRatingReceipt}=await import('../src/model/gameProfileRun.js');
 const points=(registries,subject)=>Object.values(gameProfileEffectiveAttributes(registries,subject)).reduce((a,b)=>a+b,0);
 const {run,registries:r,ids}=smithArithmeticFixture(),ref=`armament/${ids[0]}`;
 for(const [slot,items] of Object.entries(run.loadout.sets))if(slot!=='rightHand')items.fill(null);
 const base=points(r,run),baseAr=gameProfileRatingReceipt(r,run).totals.ar;
 // Deliberate tier steps [1,2,3] accumulate to 1/3/6, independent of today's ladder.
 for(const [level,bonus] of [[1,1],[2,3],[3,6]]){run.itemUpgradeLevels={[ref]:level};assert.equal(points(r,run),base+bonus);}
 assert.equal(gameProfileRatingReceipt(r,run).totals.ar,gameProfileEffectiveAttributes(r,run).strength,'AR reads the effective STR, not another tier grant');
 assert.ok(gameProfileRatingReceipt(r,run).totals.ar>baseAr);
 run.itemUpgradeLevels={};run.loadout.sets.leftHand[0]=ids[1];const bare=points(r,run);
 run.itemUpgradeLevels={[ref]:3,[`armament/${ids[1]}`]:2};assert.equal(points(r,run),bare+6+3,'each hand contributes its own controlled tier');
 const other=smithArithmeticFixture(2),initial=points(other.registries,other.run);
 other.run.itemUpgradeLevels[`armament/${other.ids[0]}`]=1;assert.equal(points(other.registries,other.run),initial+2);
});


test('all unlocked Core classes instantiate authored kits and decks, construct combat and load actual saves',async()=>{
 const {createRunCombat}=await import('../src/engine/runCombat.js');
 const meta={gameProfileUnlocks:{[profile.id]:{completedRunIds:['one','two','three']}}};
 for(const classId of Object.keys(profile.content.starterDeck.classDecks)){
  const character=profile.content.characters.find(row=>row.id===classId);
  const expected=['mainHand','offHand'].map(key=>character.defaultGear.find(item=>item.key===key)?.id||null);
  const run=createRunState({seed:17,classId,registries:reg,profileMeta:meta});
  const before=structuredClone(run.deck);
  assert.deepEqual(run.deck.filter(card=>!card.grantedBy&&!card.equipmentRole).map(card=>card.cardId),profile.content.starterDeck.classDecks[classId].flatMap(row=>Array(row.copies).fill(row.card)),classId);
  assert.deepEqual([run.loadout.sets.rightHand[0],run.loadout.sets.leftHand[0]],expected,classId);
  stampDeck(reg,run);assert.deepEqual(run.deck,before,classId);
  const combat=createRunCombat({registries:reg,run,rng:createRng(17),enemyIds:['wanderingSoldier']});assert.ok(combat.enemies[0].alive,classId);assert.equal(combat.piles.hand.length,Math.min(run.deck.length,run.drawPerTurn),classId);
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);const restored=save.loadRun(reg);assert.ok(restored,`${classId}: ${JSON.stringify(save.runStatus())}`);assert.deepEqual(restored.deck,run.deck,classId);assert.deepEqual([restored.loadout.sets.rightHand[0],restored.loadout.sets.leftHand[0]],expected,classId);
 }
});

test('legacy duplicate equipped-armament validation and normalization remain in force',async()=>{
 const {buildEquippedWeaponCardPlan,normalizeArmamentLocations}=await import('../src/model/loadout.js');
 const legacy=createRegistries(contentBundle),run=createRunState({seed:17,classId:'rogue',registries:legacy});run.loadout.sets.rightHand[0]='dagger';run.loadout.sets.leftHand[0]='dagger';
 assert.throws(()=>buildEquippedWeaponCardPlan(legacy,run.loadout,run.class),/distinct equipment-instance identity/);
 normalizeArmamentLocations(legacy,run.loadout);assert.equal(run.loadout.sets.leftHand[0],null);
});
