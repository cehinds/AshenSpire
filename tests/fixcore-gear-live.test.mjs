import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, resolveGearItem, armorBudgetFor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, initializeRunDerivedStats } from '../src/model/state.js';
import { gameProfileEquipmentReceipt, gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { awardLevelXp, xpToNext } from '../src/model/levelup.js';
import { withGameProfileService } from '../src/model/gameProfileRun.js';
import { applyLevelUp } from '../src/model/levelup.js';
const profile = resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json',import.meta.url))),loadGameProfileCatalog());
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const fresh = () => createRunState({registries:reg,classId:'reaver',seed:429});
test('Core armor budget is 3 at rank 1 plus 1 point per tier, any rarity (D14); rarity bonus defaults to 0', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor');
  const sum = receipt=>Object.values(receipt.points).reduce((a,b)=>a+b,0)+receipt.tagCost;
  assert.equal(sum(resolveGearItem(armor,profile.modules.gear)),3);
  assert.equal(sum(resolveGearItem({...armor,rarity:'epic'},profile.modules.gear)),3);
  assert.equal(sum(resolveGearItem(armor,profile.modules.gear,{rank:4})),6);
  assert.equal(profile.modules.gear.armorBudget.perRank,1);
  assert.deepEqual(profile.modules.gear.armorBudget.rarityBonus,{});
  const bonus={...profile.modules.gear,armorBudget:{...profile.modules.gear.armorBudget,rarityBonus:{epic:2}}};
  assert.equal(resolveGearItem({...armor,rarity:'epic'},bonus).budget,5);
  assert.equal(resolveGearItem({...armor,rarity:'common'},bonus).budget,3);
});
test('equipped resolved values reach live pools/ratings once and survive restore', () => {
  const run=fresh(), gear=gameProfileEquipmentReceipt(reg,run);
  assert.ok(gear.sources.length);
  const before=structuredClone(run);
  reconcileRunLoadoutHp(reg,run);
  assert.equal(run.maxHp,before.maxHp);
  assert.deepEqual(gameProfileEquipmentReceipt(reg,run),gear);
  initializeRunDerivedStats(run,reg);
  assert.equal(run.maxHp,before.maxHp);
  const ratings=gameProfileRatingReceipt(reg,run);
  assert.equal(ratings.sources.filter(source=>source.resolved).length,gear.sources.length);
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
  const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));
  initializeRunDerivedStats(restored,reg);
  assert.equal(restored.maxHp,run.maxHp);
  assert.deepEqual(gameProfileRatingReceipt(reg,restored).totals,ratings.totals);
});
test('configured earned attribute entitlement ignores legacy reward toggles and changes live AR', () => {
  const run=fresh(), old=gameProfileRatingReceipt(reg,run).totals.ar;
  const earned=awardLevelXp(reg,run,xpToNext(reg,1),{pointsPerLevel:99,grantStats:false});
  assert.equal(earned.points,profile.modules.progression.attributePointsPerLevel);
  withGameProfileService(run,'levelUp',()=>applyLevelUp(reg,run,'strength'));
  assert.equal(gameProfileRatingReceipt(reg,run).totals.ar,old+1);
  assert.equal(run.level.unspentPoints,0);
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
  const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));
  initializeRunDerivedStats(restored,reg);
  assert.equal(restored.levelPoints,1);
  assert.equal(restored.attributes.strength,run.attributes.strength);
});

test('authored HP MP SP and attribute gear reaches pools with one contribution on reload', () => {
  const catalog=loadGameProfileCatalog();
  const armor=catalog.packs['ashen.core-content@2.0.0'].content.gear.find(item=>item.kind==='armor' && item.source.id==='wayfarerPlate');
  armor.points={hp:1,mp:1,sp:1};
  const selected=resolveGameAuthor(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json',import.meta.url))),catalog);
  const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,selected)),selected);
  const run=createRunState({registries,classId:'reaver',seed:10});
  run.loadout.sets.armor[0]='wayfarerPlate';
  reconcileRunLoadoutHp(registries,run);
  const receipt=gameProfileEquipmentReceipt(registries,run);
  assert.ok(receipt.totals.hp>=10 && receipt.totals.mp>=1 && receipt.totals.sp>=1);
  const before=[run.maxHp,run.maxMana,run.maxStamina];
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
  const restored=save.loadRun(registries);assert.ok(restored,JSON.stringify(save.runStatus()));
  assert.deepEqual([restored.maxHp,restored.maxMana,restored.maxStamina],before);
  reconcileRunLoadoutHp(registries,restored);
  assert.deepEqual([restored.maxHp,restored.maxMana,restored.maxStamina],before);
  run.loadout.sets.armor[0]=null;
  reconcileRunLoadoutHp(registries,run);
  assert.deepEqual([run.maxHp,run.maxMana,run.maxStamina],before.map((n,i)=>n-[10,1,1][i]));
});

test('archived Core 1 keeps its original gear and training policy', () => {
  const old=resolveGameAuthor({formatVersion:1,core:'ashen.core@1.0.0',modules:{}},loadGameProfileCatalog());
  assert.equal(old.modules.gear.armorBudget,undefined);
  assert.equal(old.modules.progression.entitlementPolicy,undefined);
  assert.equal(old.content.cards.some(card=>card.id==='core.cantrip'),false);
  assert.ok(old.content.characters.find(row=>row.id==='starseer').tags.includes('training.basic'));
});
test('equipment inspection exposes converted values and armor budget', async () => {
  const {equipmentCardModel}=await import('../src/model/equipmentCard.js');
  const {resolveUpgradedEquipment}=await import('../src/model/itemUpgrades.js');
  const armor=reg.equipment.armour.find(piece=>piece.classId==='reaver' && piece.id==='wayfarerPlate');
  assert.ok(armor);
  const model=equipmentCardModel(reg,resolveUpgradedEquipment(reg,`armor/reaver/${armor.id}`,1));
  assert.ok(model.bonuses.some(row=>row.label==='Rank 2 · 4 points'));
  assert.ok(model.facts.every(row=>row.explanation.includes('stat-budget point(s)')));
});
test('resolved gear suppresses duplicate legacy pool stats and retains independent effects', async () => {
  const {runMods}=await import('../src/model/loadout.js');
  const run=fresh();
  const registry={...reg,equipment:{...reg.equipment,armaments:reg.equipment.armaments.map(piece=>piece.id==='greatsword' ? {...piece,mods:[...(piece.mods || []),'self.maxHp=+999','self.regen=+2','self.swapCost=+1']} : piece)}};
  const baseline=runMods(reg,run.loadout,run.class,run), actual=runMods(registry,run.loadout,run.class,run);
  assert.equal(actual.maxHp,baseline.maxHp);
  assert.equal(actual.swapCostDelta,baseline.swapCostDelta+1);
  assert.equal(actual.startStatuses.find(row=>row.status==='regen')?.stacks,(baseline.startStatuses.find(row=>row.status==='regen')?.stacks || 0)+2);
});
test('Core 2 weapon upgrades retain each equipped source identity', () => {
  const run=fresh();run.loadout.sets.leftHand[0]='dagger';
  const before=gameProfileRatingReceipt(reg,run);
  run.itemUpgradeLevels={'armament/greatsword':2,'armament/dagger':1};
  const after=gameProfileRatingReceipt(reg,run);
  assert.equal(after.totals.ar,before.totals.ar+3);
  assert.equal(after.sources.find(row=>row.sourceId==='armament/greatsword' && row.weaponTier)?.ar,2);
  assert.equal(after.sources.find(row=>row.sourceId==='armament/dagger' && row.weaponTier)?.ar,1);
});
test('combat refresh derives from allocated attributes without counting gear twice', async () => {
  const {gameProfileEffectiveAttributes}=await import('../src/model/gameProfileGear.js');
  const run=fresh(), expected=gameProfileRatingReceipt(reg,run);
  const combat={...run,allocatedAttributes:{...run.attributes},attributes:gameProfileEffectiveAttributes(reg,run)};
  assert.deepEqual(gameProfileRatingReceipt(reg,combat).totals,expected.totals);
});

test('armor rarity bonus ignores inherited keys such as constructor', () => {
  const settings = { armorBudget: { baseline: 3, rarityBonus: { epic: 2 } } };
  assert.equal(armorBudgetFor({ rarity: 'constructor' }, settings, 1), 3);
  assert.equal(armorBudgetFor({ rarity: 'toString' }, settings, 4), 3);
  assert.equal(armorBudgetFor({ rarity: 'epic' }, settings, 1), 5);
});
test('tier DR point comes only from unspent budget: authored DR that spends the allowance is not topped up', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor'), s = profile.modules.gear;
  const authored = {...armor,tags:[],points:{dr:4}};
  const r2 = resolveGearItem(authored,s,{rank:2});
  assert.equal(r2.budget,4);
  assert.equal(r2.points.dr,4);
  assert.equal(Object.values(r2.points).reduce((a,b)=>a+b,0),4);
  // Nothing authored: the tier point is a DR point and the budget is still exactly spent.
  const bare = {...armor,tags:[],points:{}};
  assert.ok(resolveGearItem(bare,s,{rank:2}).points.dr >= resolveGearItem(bare,s,{rank:1}).points.dr + 1);
  assert.equal(Object.values(resolveGearItem(bare,s,{rank:2}).points).reduce((a,b)=>a+b,0),4);
});
test('tier DR point is a Core policy flag: Core raises DR, a perRank profile without perRankStat keeps the weighted split', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor'), s = profile.modules.gear;
  assert.equal(s.armorBudget.perRankStat,'dr');
  const bare = {...armor,tags:[],points:{}, weights:{ratings:{poise:1}}};
  const dr = (settings,rank)=>resolveGearItem(bare,settings,{rank}).points.dr;
  assert.equal(dr(s,2),dr(s,1)+1);
  const generic = {...s,armorBudget:{...s.armorBudget,perRankStat:undefined}};
  assert.equal(dr(generic,2),dr(generic,1));
  const p1 = resolveGearItem(bare,generic,{rank:1}).points, p2 = resolveGearItem(bare,generic,{rank:2}).points;
  assert.equal(p2.poise,p1.poise+1);
});
