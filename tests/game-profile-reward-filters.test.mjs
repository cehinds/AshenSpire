import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock, claimGameProfileReward, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
const profile=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{rewards:{offerCount:1000},shops:{options:1000}}});
const registries=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,profile)),profile);
// Cross-class fixtures exercise reward class scoping independently of creation/loadout.
const fresh=(classId='reaver',reg=registries)=>{ const run=createRunState({seed:1,classId:'reaver',registries:reg});run.class=classId;return run; };
const rules=profile.content.rewards;
function verifyOptions(options,run,reg) {
  for(const option of options) {
    if(option.kind==='weapons') {
      const item=reg.equipment.armaments.find(row=>row.id===option.id);
      const groups=rules.eligibility.weapons.groups.map(id=>rules.equipmentGroups[id]);
      assert.ok(groups.some(group=>group.members.includes(item.id)&&group.allTags.every(tag=>item.entityTags.includes(tag))));
    } else if(option.kind==='armor') {
      const item=reg.equipment.armour.find(row=>row.id===option.id&&row.classId===run.class);
      assert.ok(rules.eligibility.armor.groups.some(id=>rules.equipmentGroups[id].members.includes(`${run.class}:${item.id}`)));
      assert.ok(item.itemTypeTags.includes('item:armor'));
    } else if(option.kind==='weaponArts') {
      assert.equal(option.id,'core.reaverSpecial');
      const card=profile.content.cards.find(row=>row.id===option.id);
      assert.ok(card);assert.equal(card.gradeProfiles,undefined);assert.equal(card.upcast,undefined);
    }
  }
}
test('all core rewards and shop equipment obey six weapon/four armor groups',()=>{
  const categories=new Set();
  for(const classId of ['reaver','starseer','rogue','herald']) {
    const run=fresh(classId),offer=gameProfileRewardOffers(registries,run,createRng(40),{offerId:'complete-pools'});
    verifyOptions(offer.options,run,registries);offer.options.forEach(row=>categories.add(row.kind));
    const weapons=offer.options.filter(row=>row.kind==='weapons').map(row=>row.id);
    for(const forbidden of ['katana','halberd','warhammer','twinblade','battleaxe','lantern','torch','ashStaff','frostSpear','duskChime'])assert.equal(weapons.includes(forbidden),false,forbidden);
    verifyOptions(gameProfileShopStock(registries,run,createRng(41),{shopId:'complete-stock'}).options,run,registries);
  }
  assert.deepEqual([...categories].sort(),['armor','combatCards','potions','relics','weaponArts','weapons']);
});
test('coarse item tags cannot admit an ungrouped item or legacy art',()=>{
  const foreign={...registries,equipment:{...registries.equipment,armaments:[...registries.equipment.armaments,{id:'foreignBlade',entityTags:['item:blade'],itemTypeTags:['item:blade']}],armour:[...registries.equipment.armour,{id:'foreignPlate',classId:'reaver',entityTags:['item:armor'],itemTypeTags:['item:armor']}]}};
  const run=fresh('reaver',foreign),offer=gameProfileRewardOffers(foreign,run,createRng(5),{offerId:'foreign'});
  assert.equal(offer.options.some(row=>['foreignBlade','foreignPlate','katanaDrawCut','greatswordSunderingHew'].includes(row.id)),false);
});
test('valid filtered weapon claims and armor purchases preserve active deck and debit once',()=>{
  const run=fresh(),deck=structuredClone(run.deck),offer=gameProfileRewardOffers(registries,run,createRng(2),{offerId:'claim'});
  const weapon=offer.options.findIndex(row=>row.kind==='weapons');assert.ok(weapon>=0);
  const granted=claimGameProfileReward(registries,run,'claim',weapon);assert.ok(run.loadout.storage.includes(granted.id));assert.deepEqual(run.deck,deck);
  const stock=gameProfileShopStock(registries,run,createRng(3),{shopId:'filtered'}),armor=stock.options.findIndex(row=>row.kind==='armor');assert.ok(armor>=0);
  run.cinders=100;purchaseGameProfileShopOffer(registries,run,'filtered',armor);assert.equal(run.cinders,90);assert.deepEqual(run.deck,deck);
  assert.throws(()=>purchaseGameProfileShopOffer(registries,run,'filtered',armor),/sold out/);assert.equal(run.cinders,90);
});
test('ineligible persisted weapon or legacy art cannot be claimed or purchased',()=>{
  for(const [kind,id]of [['weapons','katana'],['weaponArts','katanaDrawCut']]) {
    const run=fresh();run.cinders=100;run.gameProfileRewardOffers={bad:{id:'bad',source:'combat',options:[{kind,id}],takeCount:1,taken:[],claimed:null},'shop:bad':{id:'shop:bad',source:'shop',price:10,options:[{kind,id}],takeCount:1,taken:[],claimed:null}};
    const before=JSON.stringify(run);assert.throws(()=>claimGameProfileReward(registries,run,'bad',0),/eligibility/);assert.equal(JSON.stringify(run),before);
    assert.throws(()=>purchaseGameProfileShopOffer(registries,run,'bad',0),/eligibility/);assert.equal(JSON.stringify(run),before);
  }
});
test('cards-off equipment rewards remain available without checking inactive core art refs',()=>{
  const off=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{cards:false,rewards:{offerCount:1000}}}),reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,off)),off),run=fresh('reaver',reg);
  const offer=gameProfileRewardOffers(reg,run,createRng(3),{offerId:'cards-off'});
  assert.ok(offer.options.some(row=>row.kind==='weapons'));assert.equal(offer.options.some(row=>['combatCards','weaponArts'].includes(row.kind)),false);
});
test('a zero lowerRankChance is honored even when no rank 1+ card is eligible', () => {
  // Every card is below minRank 99, and the chance to admit one is 0: combat cards must not be offered at all.
  const run = fresh();
  const p = structuredClone(run.gameProfile);
  p.content.rewards.eligibility.combatCards = { ...p.content.rewards.eligibility.combatCards, minRank: 99, lowerRankChance: 0 };
  run.gameProfile = p;
  for (let seed = 1; seed <= 5; seed++) {
    const offer = gameProfileRewardOffers(registries, run, createRng(seed), { offerId: `zero-${seed}` });
    assert.equal(offer.options.some(row => row.kind === 'combatCards'), false);
  }
});

test('empty high-rank pools honor probability boundaries across combat, level and shop offers',()=>{
  for(const chance of [0,1]) {
    const selected=resolveGameProfile({formatVersion:1,core:'ashen.core@1.0.0',modules:{'reward-ranks':{minRank:10,lowerRankChance:chance},rewards:{offerCount:1000},shops:{options:1000}}});
    const reg=bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle,selected)),selected);
    const run=fresh('reaver',reg),rng=createRng(40);
    const combat=gameProfileRewardOffers(reg,run,rng,{offerId:'rank-combat'});
    const level=gameProfileRewardOffers(reg,run,rng,{offerId:'rank-level',source:'level'});
    const shop=gameProfileShopStock(reg,run,rng,{shopId:'rank-shop'});
    for(const offer of [combat,level,shop]) {
      assert.equal(offer.options.some(row=>row.kind==='combatCards'),chance===1, `${offer.source}: chance ${chance}`);
      assert.equal(new Set(offer.options.map(row=>`${row.kind}:${row.id}`)).size,offer.options.length);
    }
    assert.ok(combat.options.some(row=>row.kind!=='combatCards'),'other categories remain available');
    assert.equal(gameProfileRewardOffers(reg,run,rng,{offerId:'rank-level',source:'level'}),level,'empty offers persist without rerolling');
  }
});
