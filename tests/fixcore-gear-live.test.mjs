import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { ResolveSmithFixtureProfile } from './helpers/smith-tier-profile.mjs';
import { readFileSync } from 'node:fs';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor, resolveGearItem, armorBudgetFor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, initializeRunDerivedStats } from '../src/model/state.js';
import { gameProfileEquipmentReceipt, gameProfileRatingReceipt } from '../src/model/gameProfileRun.js';
import { reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { withGameProfileService } from '../src/model/gameProfileRun.js';
import { applyLevelUp, rederivePools } from '../src/model/levelup.js';
const author = JSON.parse(readFileSync(new URL('../games/ashenspire/game.json',import.meta.url)));
const profile = resolveGameAuthor(author,loadGameProfileCatalog());
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
const fresh = () => createRunState({registries:reg,classId:'reaver',seed:429});
// Owner, 2026-11-17: Core gear resolves through the gear module's `statPoints` (attribute points and Poise, no AR or DR), which takes
// precedence over the armor budget. The armor-budget (D14) tests below run on Core's gear settings without `statPoints`, as a
// profile without it still resolves armor.
const budgetGear = {...profile.modules.gear,statPoints:undefined};
const attributePoints = points=>['strength','dexterity','constitution','wisdom','intelligence'].reduce((sum,key)=>sum+(points[key]||0),0);
test('Core armor grants statPoints attribute points by rarity plus one per tier and a Poise value, never AR or DR', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor'), rule = profile.modules.gear.statPoints;
  const points = (item,rank)=>resolveGearItem(item,profile.modules.gear,{rank}).points;
  assert.equal(attributePoints(points(armor,1)),rule.attributes[armor.rarity]);
  assert.equal(attributePoints(points({...armor,rarity:'epic'},1)),rule.attributes.epic);
  assert.equal(attributePoints(points(armor,4)),rule.attributes[armor.rarity]+3*rule.perRank);
  for (const rank of [1,4]) { assert.equal(points(armor,rank).ar,0); assert.equal(points(armor,rank).dr,0); assert.ok(points(armor,rank).poise>=rule.poiseMin); }
});
test('armor budget (D14, a profile without statPoints) is 3 at rank 1 plus 1 point per tier, any rarity; rarity bonus defaults to 0', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor');
  const sum = receipt=>Object.values(receipt.points).reduce((a,b)=>a+b,0)+receipt.tagCost;
  assert.equal(sum(resolveGearItem(armor,budgetGear)),3);
  assert.equal(sum(resolveGearItem({...armor,rarity:'epic'},budgetGear)),3);
  assert.equal(sum(resolveGearItem(armor,budgetGear,{rank:4})),6);
  assert.equal(profile.modules.gear.armorBudget.perRank,1);
  assert.deepEqual(profile.modules.gear.armorBudget.rarityBonus,{});
  const bonus={...budgetGear,armorBudget:{...profile.modules.gear.armorBudget,rarityBonus:{epic:2}}};
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
  // Owner, 2026-11-18 (gear vocabulary, ruling 18): an armour group's stat rows (Heavy: Poise +2, DEX -1) are gear sources of their own, `type/<stat>`, with no resolved
  // item behind them; each still reaches the ratings once, through its stat.
  const itemSources=gear.sources.filter(source=>source.itemId!=='type'), typeSources=gear.sources.filter(source=>source.itemId==='type');
  assert.ok(typeSources.length,'the worn armour group contributes stat sources');
  assert.equal(ratings.sources.filter(source=>source.resolved).length,itemSources.length);
  for (const source of typeSources) assert.ok(ratings.sources.some(row=>row.sourceId===source.sourceId),`${source.sourceId} reaches the ratings`);
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
  const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));
  initializeRunDerivedStats(restored,reg);
  assert.equal(restored.maxHp,run.maxHp);
  assert.deepEqual(gameProfileRatingReceipt(reg,restored).totals,ratings.totals);
});
test('a saved Core attribute entitlement predating the new cadence remains claimable and changes live AR', () => {
  const run=fresh(), old=gameProfileRatingReceipt(reg,run).totals.ar;
  assert.equal(profile.modules.progression.characterLevels,true, 'Core earns character levels');
  // Under the earlier cadence level 2 had no automatic class point.
  delete run.levelRewardRuleSnapshot;
  run.level.level=2; run.level.unspentPoints=1;
  rederivePools(reg,run,'level-reward-fixture');
  const pendingSave=createSaveManager(createMemoryStorage());pendingSave.saveRun(run,null);
  const pending=pendingSave.loadRun(reg);assert.ok(pending,JSON.stringify(pendingSave.runStatus()));
  assert.equal(pending.levelRewardRuleSnapshot,undefined);
  assert.equal(pending.level.unspentPoints,1);
  assert.equal(gameProfileRatingReceipt(reg,pending).totals.ar,old);
  const strength=pending.attributes.strength;
  withGameProfileService(pending,'levelUp',()=>applyLevelUp(reg,pending,'strength'));
  assert.equal(gameProfileRatingReceipt(reg,pending).totals.ar,old+1);
  assert.equal(pending.attributes.strength,strength+1);
  assert.equal(pending.level.unspentPoints,0);
  const save=createSaveManager(createMemoryStorage());save.saveRun(pending,null);
  const restored=save.loadRun(reg);assert.ok(restored,JSON.stringify(save.runStatus()));
  initializeRunDerivedStats(restored,reg);
  assert.equal(restored.levelPoints,1);
  assert.equal(restored.attributes.strength,strength+1);
  assert.equal(gameProfileRatingReceipt(reg,restored).totals.ar,old+1);
});

test('authored attribute gear reaches HP MP SP pools with one contribution on reload', () => {
  // +1 CON gives 5 HP, while +1 DEX and +1 WIS bring each effective attribute to 4 for the first SP and MP increases.
  const catalog=loadGameProfileCatalog();
  const armor=catalog.packs['ashen.core-content@2.0.0'].content.gear.find(item=>item.kind==='armor' && item.source.id==='vigil');
  armor.points={constitution:1,dexterity:1,wisdom:1};
  const selected=resolveGameAuthor({ ...author, modules: { ...author.modules, gear: {
    ...author.modules?.gear, statPoints: { attributes: { [armor.rarity]: 3 } },
  } } },catalog);
  const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,selected)),selected);
  const run=createRunState({registries,classId:'reaver',seed:10});
  run.loadout.sets.armor[0]=null;
  run.level.level=5; run.level.unspentPoints=4;
  withGameProfileService(run,'levelUp',()=>{
    for (const attribute of ['dexterity','dexterity','wisdom','wisdom']) applyLevelUp(registries,run,attribute);
  });
  const unworn=[run.maxHp,run.maxMana,run.maxStamina];
  assert.deepEqual(unworn.slice(1),[4,6]);
  const unwornPoints=gameProfileEquipmentReceipt(registries,run).totals;
  run.loadout.sets.armor[0]='vigil'; // Medium: its type adds Poise only (Heavy would take 1 DEX, ruling 18), so the 3 authored points are the whole stat change
  rederivePools(registries,run,'test');
  const receipt=gameProfileEquipmentReceipt(registries,run);
  for (const attribute of ['constitution','dexterity','wisdom']) assert.equal(receipt.totals[attribute]-unwornPoints[attribute],1);
  const before=[run.maxHp,run.maxMana,run.maxStamina];
  assert.deepEqual(before,unworn.map((n,i)=>n+[5,1,1][i]));
  const save=createSaveManager(createMemoryStorage());save.saveRun(run,null);
  const restored=save.loadRun(registries);assert.ok(restored,JSON.stringify(save.runStatus()));
  assert.deepEqual([restored.maxHp,restored.maxMana,restored.maxStamina],before);
  reconcileRunLoadoutHp(registries,restored);
  assert.deepEqual([restored.maxHp,restored.maxMana,restored.maxStamina],before);
  rederivePools(registries,restored,'test');
  assert.deepEqual([restored.maxHp,restored.maxMana,restored.maxStamina],before);
  run.loadout.sets.armor[0]=null;
  rederivePools(registries,run,'test');
  assert.deepEqual([run.maxHp,run.maxMana,run.maxStamina],unworn);
});

test('equipment inspection exposes converted values and armor budget', async () => {
  const {equipmentCardModel}=await import('../src/model/equipmentCard.js');
  const {resolveUpgradedEquipment}=await import('../src/model/itemUpgrades.js');
  const armor=reg.equipment.armour.find(piece=>piece.classId==='reaver' && piece.id==='wayfarerPlate');
  assert.ok(armor);
  const model=equipmentCardModel(reg,resolveUpgradedEquipment(reg,`armor/reaver/${armor.id}`,1));
  assert.ok(model.bonuses.every(row=>!/points|Rank \d/.test(row.label)));assert.ok(model.bonuses.some(row=>/Poise/.test(row.label)));
  assert.ok(model.facts.every(row=>row.explanation.includes('stat-budget point(s)')));
});
test('resolved gear suppresses duplicate legacy pool stats and retains independent effects', async () => {
  const {runMods}=await import('../src/model/loadout.js');
  const run=fresh();
  const registry={...reg,equipment:{...reg.equipment,armaments:reg.equipment.armaments.map(piece=>piece.id==='greatsword' ? {...piece,mods:[...(piece.mods || []),'self.maxHp=+999','self.regen=+2','self.swapCost=+1']} : piece)}};
  const baseline=runMods(reg,run.loadout,run.class,run), actual=runMods(registry,run.loadout,run.class,run);
  // Owner, 2026-11-18 ("no hidden caps; balance through cost and consequence", a845a23): resolved gear replaces a legacy pool mod only where its own points supply that
  // pool; the Greatsword's resolved hp is 0, so its authored +999 max HP is a real, uncapped bonus on top, counted once.
  assert.equal(actual.maxHp,baseline.maxHp+999);
  assert.equal(actual.swapCostDelta,baseline.swapCostDelta+1);
  assert.equal(actual.startStatuses.find(row=>row.status==='regen')?.stacks,(baseline.startStatuses.find(row=>row.status==='regen')?.stacks || 0)+2);
});
// Owner, 2026-11-17 (gear statPoints): a weapon Smith tier adds attribute points to its own item, not AR, so each source keeps its own gain.
test('Core 2 weapon upgrades retain each equipped source identity', () => {
  const smithProfile=ResolveSmithFixtureProfile(author);
  const smithReg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,smithProfile)),smithProfile);
  const run=createRunState({registries:smithReg,classId:'reaver',seed:429});run.loadout.sets.leftHand[0]='dagger';
  const before=gameProfileRatingReceipt(smithReg,run), gearBefore=gameProfileEquipmentReceipt(smithReg,run);
  run.itemUpgradeLevels={'armament/greatsword':2,'armament/dagger':1};
  const after=gameProfileRatingReceipt(smithReg,run), gearAfter=gameProfileEquipmentReceipt(smithReg,run);
  const gained=id=>attributePoints(gearAfter.sources.find(row=>row.sourceId===id))-attributePoints(gearBefore.sources.find(row=>row.sourceId===id));
  assert.equal(gained('armament/greatsword'),2);
  assert.equal(gained('armament/dagger'),1);
  assert.equal(after.sources.some(row=>row.weaponTier),false,'no flat AR per tier');
  assert.equal(after.totals.ar-before.totals.ar,gearAfter.totals.strength-gearBefore.totals.strength,'AR moves only with the STR the tiers bought');
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
  const armor = profile.content.gear.find(item=>item.kind==='armor'), s = budgetGear;
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
test('tier DR point is an armor-budget policy flag: perRankStat raises DR, a perRank profile without it keeps the weighted split', () => {
  const armor = profile.content.gear.find(item=>item.kind==='armor'), s = budgetGear;
  assert.equal(s.armorBudget.perRankStat,'dr');
  const bare = {...armor,tags:[],points:{}, weights:{ratings:{poise:1}}};
  const dr = (settings,rank)=>resolveGearItem(bare,settings,{rank}).points.dr;
  assert.equal(dr(profile.modules.gear,2),0,'Core statPoints: a tier is attribute points, never DR');
  assert.equal(dr(s,2),dr(s,1)+1);
  const generic = {...s,armorBudget:{...s.armorBudget,perRankStat:undefined}};
  assert.equal(dr(generic,2),dr(generic,1));
  const p1 = resolveGearItem(bare,generic,{rank:1}).points, p2 = resolveGearItem(bare,generic,{rank:2}).points;
  assert.equal(p2.poise,p1.poise+1);
});
