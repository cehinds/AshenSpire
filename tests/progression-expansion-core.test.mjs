import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape, initializeRunDerivedStats } from '../src/model/state.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { awardSkillXp, bankSkillXp, claimBankedSkillLevel, activateAbilitySkill, pendingSkillLevelCount, xpToNext } from '../src/model/skills.js';
import { classRewardBudget, pendingClassMilestones } from '../src/model/classMilestones.js';
import { rollAbilityOffer, abilityOfferPool } from '../src/model/abilityOffers.js';
import { rollClassMilestoneRewards, claimClassMilestoneReward } from '../src/model/classMilestoneOffers.js';
import { createRng } from '../src/engine/rng.js';
import { recordSkillXp, skillXpReceipt } from '../src/engine/skillXp.js';
import { rewardPlan, resolveContinue, pickIds } from '../src/model/rewardplan.js';
import { composeProgressionContent } from '../src/model/progressionContent.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { learnClassCard } from '../src/model/classLibraryState.js';

const source = createRegistries(contentBundle);
function fresh(meta = {}) {
  const run = createRunState({registries:source,classId:'reaver',seed:3});
  openRunClassMastery(source,run,meta,{receiptId:'core-test'});
  return {run,reg:registriesForClassMastery(source,run)};
}
function fund(reg,run,amount) {
  bankSkillXp(reg,run,'class:reaver',amount);
  run.classMasteryState.earnedXp.reaver += amount;
}
function lessons(reg) {
  const defs = new Map();
  for (const [kind,ids] of Object.entries({spell:['cometFragment','crystalBarrier','scholarsInsight','ashenMote'],maneuver:['quickstep','backstep','stomp']})) for (const id of ids) defs.set(id,{
    ...source.cards.get(id),abilityKind:kind,abilityRank:0,abilityFamily:id,tags:[kind === 'spell' ? 'source:spell':'source:unarmed'],
    gradeProfiles:Array.from({length:6},(_,rank)=>({rank,actionCost:rank ? Math.min(rank,3):1,manaCost:rank,effects:[{op:'block',target:'self',amount:4+rank}],textTemplate:`Grade ${rank}`})),
  });
  return {...reg,masterySource:null,cards:{get:id=>defs.get(id)||source.cards.get(id),has:id=>defs.has(id),all:()=>[...defs.values()]}};
}

test('overlapping class milestones grant every earned budget and exactly four 25-XP awards',()=>{
  const {run,reg}=fresh();
  let total=0;
  for(let level=1;level<=20;level++) {
    fund(reg,run,xpToNext(reg,'class',level-1));
    const claim=claimBankedSkillLevel(reg,run,'class:reaver');
    assert.equal(claim.after,level);
    assert.equal(claim.skillAwards.length,4);
    assert.ok(claim.skillAwards.every(award=>award.gained===25));
    total+=claim.skillAwards.reduce((sum,award)=>sum+award.gained,0);
  }
  assert.equal(total,2000);
  assert.deepEqual(Object.keys(run.classMilestones['class:reaver:12'].grants).sort(),['armory','cards','feat']);
  assert.deepEqual(Object.keys(run.classMilestones['class:reaver:20'].grants).sort(),['attribute','cards','feat','relic']);
  assert.deepEqual(classRewardBudget(reg,20),{cards:10,feat:6,armory:6,relic:6,attribute:4});
  const copy=deserializeRun(serializeRun(run));
  assert.equal(claimBankedSkillLevel(reg,copy,'class:reaver'),null);
  assert.equal(copy.skills.combatManeuvers.xp,run.skills.combatManeuvers.xp);
});

test('veteran allocations preserve budgets without replaying class-to-skill XP or re-equipping grants',()=>{
  const meta={classMastery:{reaver:{xp:100000,level:20,unlockedRows:[]}}};
  const {run,reg}=fresh(meta);
  assert.equal(run.skills.combatManeuvers.xp,0);
  assert.equal(run.skills.combatManeuvers.pendingDrafts,1);
  assert.equal(pendingClassMilestones(run).filter(row=>row.kind==='feat').length,6);
  assert.equal(pendingClassMilestones(run).filter(row=>row.kind==='attribute').length,4);
  assert.equal(activateAbilitySkill(run,'combatManeuvers'),false);
  assert.deepEqual(validateRunShape(run),[]);
});

test('a class swap shares the run feat and attribute budget instead of replaying veteran grants (#1676, #1658)',()=>{
  const meta={classMastery:{reaver:{xp:100000,level:20,unlockedRows:[]},herald:{xp:100000,level:20,unlockedRows:[]}}};
  const run=createRunState({registries:source,classId:'reaver',seed:71});
  openRunClassMastery(source,run,meta,{receiptId:'swap-budget'});
  let reg=registriesForClassMastery(source,run);
  const rng=createRng(5);
  const before={...run.attributes};
  const take=kind=>rollClassMilestoneRewards(reg,rng,run,{meta}).filter(offer=>offer.rewardKind===kind)
    .filter(offer=>(offer.choiceIds||offer.options).some(choice=>claimClassMilestoneReward(reg,run,offer.receiptId,choice,{meta}))).length;
  const taken=kind=>Object.values(run.classMilestones).filter(row=>row.grants[kind]?.state==='taken').length;
  assert.equal(take('attribute'),4);
  assert.equal(run.skillAttributePoints,4);
  learnClassCard(reg,run,'herald');
  equipClassCard(reg,run,'herald');
  reg=registriesForClassMastery(source,run);
  assert.equal(pendingClassMilestones(run).filter(row=>row.kind==='attribute').length,0,'the run budget of four points is already used');
  assert.equal(take('attribute'),0);
  assert.equal(take('feat'),6,'feats the run has not taken stay available to the equipped class');
  equipClassCard(reg,run,'reaver');
  reg=registriesForClassMastery(source,run);
  assert.equal(pendingClassMilestones(run).filter(row=>['feat','attribute'].includes(row.kind)).length,0,'swapping back replays nothing');
  assert.equal(take('feat'),0);
  assert.equal(run.skillAttributePoints,4);
  assert.equal(Object.values(run.attributes).reduce((a,b)=>a+b,0)-Object.values(before).reduce((a,b)=>a+b,0),4);
  assert.equal(taken('attribute'),4);
  assert.equal(taken('feat'),6);
  assert.deepEqual(validateRunShape(run),[]);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))),[]);
});

test('ability activation plus nine linear steps costs 2700 XP and queues ten lessons without legacy rank-ups',()=>{
  const {run,reg}=fresh();
  awardSkillXp(reg,run,'combatManeuvers',2700);
  assert.equal(run.skills.combatManeuvers.level,10);
  assert.equal(run.skills.combatManeuvers.xp,0);
  assert.equal(run.skills.combatManeuvers.pendingDrafts,10);
  assert.equal(run.skills.combatManeuvers.pendingRankUps,undefined);
});

test('ability offers persist three current-grade families and one bounded INT option, with no reroll',()=>{
  const {run,reg:base}=fresh();const reg=lessons(base),rng=createRng(3);
  run.attributes.intelligence=20;
  const offer=rollAbilityOffer(reg,rng,run,{skillId:'item:magic-focus',level:4,offerId:'ability:spell:4'});
  assert.deepEqual(offer.abilityRanks.slice(0,3),[2,2,2]);
  assert.equal(new Set(offer.cardIds.slice(0,3)).size,3);
  assert.equal(offer.cardIds.length,4);
  assert.ok(offer.abilityRanks[3]>=3&&offer.abilityRanks[3]<=5);
  const counters=rng.getCounters();run.attributes.intelligence=0;
  assert.deepEqual(rollAbilityOffer(reg,rng,run,{skillId:'item:magic-focus',level:4,offerId:offer.offerId}),offer);
  assert.deepEqual(rng.getCounters(),counters);
  const max=rollAbilityOffer(reg,rng,run,{skillId:'item:magic-focus',level:10,offerId:'max'});
  assert.deepEqual(max.abilityRanks,[5,5,5]);
  assert.equal(abilityOfferPool(reg,{...run,loadout:null},'combatManeuvers',5).length,3);
});

test('authored grades resolve their exact resource costs and values without an upgrade or rank overlay',()=>{
  const {reg:base}=fresh(),reg=lessons(base);
  const card=resolveCard(reg,{cardId:'cometFragment',abilityRank:4,rank:10,upgraded:true,skillBonus:99});
  assert.equal(card.cost,3);assert.equal(card.manaCost,4);assert.equal(card.effects[0].amount,8);assert.equal(card.textTemplate,'Grade 4');
});

test('one resolved spell or maneuver pays its authored track, independent of shared school tags',()=>{
  const {reg}=fresh();const combat={registries:reg,player:{},playerKey:'player'};
  recordSkillXp(combat,{type:'cardResolved',abilityKind:'spell',cardTags:['blood','guard'],printedManaCost:2});
  recordSkillXp(combat,{type:'cardResolved',abilityKind:'maneuver',cardTags:['blood'],printedManaCost:0});
  assert.deepEqual(skillXpReceipt(combat),{'item:magic-focus':7,combatManeuvers:2});
  recordSkillXp(combat,{type:'arcaneExposureChanged',sourceId:'player',amount:100});
  assert.equal(skillXpReceipt(combat)['item:magic-focus'],7);
});

test('Spellcraft XP scales with printed Mana rather than discounted payment or individual hits',()=>{
  const {reg}=fresh();
  for(const printedManaCost of [0,1,2,5]) {
    const combat={registries:reg,player:{},playerKey:'player'};
    recordSkillXp(combat,{type:'cardResolved',abilityKind:'spell',cardTags:['source:spell'],printedManaCost,manaPaid:0});
    assert.equal(skillXpReceipt(combat)['item:magic-focus'],5+printedManaCost);
    recordSkillXp(combat,{type:'damageDealt',sourceId:'player',targetId:'enemy',amount:8});
    recordSkillXp(combat,{type:'damageDealt',sourceId:'player',targetId:'enemy',amount:8});
    assert.equal(skillXpReceipt(combat)['item:magic-focus'],5+printedManaCost);
  }
});

test('milestone choice commits once, preserves its receipt and pending options through save/reload',()=>{
  const {run,reg}=fresh();fund(reg,run,50);claimBankedSkillLevel(reg,run,'class:reaver');
  const offers=rollClassMilestoneRewards(reg,createRng(5),run);
  assert.equal(offers[0].rewardKind,'feat');
  const choice=offers[0].options[0];
  assert.equal(claimClassMilestoneReward(reg,run,offers[0].receiptId,choice),true);
  assert.equal(claimClassMilestoneReward(reg,run,offers[0].receiptId,choice),false);
  assert.deepEqual(validateRunShape(run),[]);
  const copy=deserializeRun(serializeRun(run));
  assert.equal(copy.classMilestones['class:reaver:1'].grants.feat.selection.id,choice);
  assert.equal(rewardPlan({classMilestoneRewards:offers}).rows[0].key,`classMilestone:${offers[0].receiptId}`);
});

test('an actual pre-expansion save selects original cards, gates, costs, and cadence after modular installation',()=>{
  const oldReg=source.legacyProgressionSource;
  const run=createRunState({registries:oldReg,classId:'reaver',seed:9});
  openRunClassMastery(oldReg,run,{}, {receiptId:'legacy'});
  run.schemaVersion=21;
  const restored=deserializeRun(JSON.stringify(run));
  const projected=registriesForClassMastery(source,restored);
  assert.equal(projected.balance.progression,undefined);
  assert.deepEqual(projected.classMastery,oldReg.classMastery);
  assert.deepEqual(projected.cards.get('stomp'),oldReg.cards.get('stomp'));
  assert.equal(restored.progressionRulesVersion,undefined);
  fund(projected,restored,50);claimBankedSkillLevel(projected,restored,'class:reaver');
  assert.equal(restored.classMilestones,undefined);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(restored))),[]);
  const extended=composeProgressionContent(contentBundle,[{progressionCards:[{id:'installed-later'}],progressionCardUnlocks:[{classId:'reaver',level:20,kind:'cards',ref:'installed-later'}]}],{rules:contentBundle.balance.progression,unlocks:contentBundle.classMastery});
  assert.ok(!extended.legacyProgression.classes.find(cls=>cls.id==='reaver').cardPool.includes('installed-later'));
});

test('a repeated family bonus keeps a unique choice identity and claims its higher grade',()=>{
  const {run,reg:base}=fresh();const reg=lessons(base),rng=createRng(3);
  run.attributes.intelligence=20;
  const offer=rollAbilityOffer(reg,rng,run,{skillId:'combatManeuvers',level:1,offerId:'ability:combatManeuvers:1'});
  assert.equal(offer.cardIds.length,4);
  assert.equal(new Set(offer.cardIds).size,3);
  assert.equal(new Set(offer.choiceIds).size,4);
  const plan=rewardPlan({skillDrafts:[offer]});
  assert.deepEqual(pickIds(plan.rows[0]),offer.choiceIds);
  const chosen=resolveContinue(plan,{},'auto',()=>3).take[0];
  assert.equal(chosen.cardId,offer.cardIds[3]);
  assert.equal(chosen.choiceId,offer.choiceIds[3]);
  fund(reg,run,50);claimBankedSkillLevel(reg,run,'class:reaver');
  fund(reg,run,xpToNext(reg,'class',1));claimBankedSkillLevel(reg,run,'class:reaver');
  const receipt='class:reaver:2:cards';
  run.classMilestoneOffers ||= {};
  run.classMilestoneOffers[receipt]={receiptId:receipt,classId:'reaver',skillId:'class:reaver',level:2,requiredLevel:2,rewardKind:'cards',options:['stomp','stomp'],abilityRanks:[0,3],choiceIds:['stomp@0','stomp@3'],intelligenceSnapshot:20};
  assert.equal(claimClassMilestoneReward(reg,run,receipt,'stomp@3'),true);
  assert.equal(run.deck.at(-1).abilityRank,3);
  assert.deepEqual(validateRunShape(run),[]);
  const invalid=structuredClone(run);invalid.classMilestones['class:reaver:2'].grants.cards.selection.abilityRank=0;
  assert.ok(validateRunShape(invalid).some(problem=>problem.includes('earned selection')));
});

test('milestone auto collection derives the persisted choice instead of an empty callback argument',()=>{
  const {run,reg}=fresh();fund(reg,run,50);claimBankedSkillLevel(reg,run,'class:reaver');
  const offers=rollClassMilestoneRewards(reg,createRng(5),run);
  const chosen=resolveContinue(rewardPlan({classMilestoneRewards:offers}),{},'auto').take[0];
  assert.equal(chosen.choiceId,offers[0].options[0]);
  assert.equal(claimClassMilestoneReward(reg,run,chosen.receiptId,chosen.choiceId),true);
  const invalid=structuredClone(run);invalid.classMilestoneOffers[chosen.receiptId].level=20;
  assert.ok(validateRunShape(invalid).some(problem=>problem.includes('earned cadence')));
});

test('an advanced default family keeps a rank-zero starter and a class attribute rederives the saved pools',()=>{
  const starting=createRunState({registries:source,classId:'reaver',seed:4});
  const id=starting.deck.find(inst=>!inst.equipmentRole)?.cardId || starting.deck[0].cardId;
  const update={...source.cards.get(id),abilityKind:'maneuver',abilityRank:3,abilityFamily:id,cost:2,manaCost:3,
    gradeProfiles:Array.from({length:6},(_,rank)=>({rank,actionCost:rank?Math.min(rank,3):1,manaCost:rank,effects:[{op:'block',target:'self',amount:4+rank}]}))};
  const bundle=composeProgressionContent(contentBundle,[{abilityCardUpdates:[update]}],{rules:contentBundle.balance.progression,unlocks:contentBundle.classMastery});
  const root=createRegistries(bundle),run=createRunState({registries:root,classId:'reaver',seed:4});
  assert.equal(root.cards.get(id).manaCost,3);
  assert.ok(run.deck.some(inst=>inst.cardId===id));
  assert.ok(run.deck.filter(inst=>inst.cardId===id).every(inst=>inst.abilityRank===0 && resolveCard(root,inst).manaCost===0));
  openRunClassMastery(root,run,{}, {receiptId:'attributes'});
  const reg=registriesForClassMastery(root,run);
  for(let level=1;level<=5;level++) {fund(reg,run,xpToNext(reg,'class',level-1));claimBankedSkillLevel(reg,run,'class:reaver');}
  const offer=rollClassMilestoneRewards(reg,createRng(1),run).find(row=>row.rewardKind==='attribute');
  assert.equal(claimClassMilestoneReward(reg,run,offer.receiptId,'constitution'),true);
  const restored=deserializeRun(serializeRun(run));
  assert.doesNotThrow(()=>initializeRunDerivedStats(restored,reg,{preserveDeficits:true}));
});

test('class bonus XP banks every favored skill and leaves its level for the manual claim',()=>{
  const {run,reg}=fresh();
  const threshold=xpToNext(reg,'weapon',1);
  run.skills['item:blade']={xp:threshold-10,level:1,pendingDrafts:0};
  fund(reg,run,50);
  const claim=claimBankedSkillLevel(reg,run,'class:reaver');
  const award=claim.skillAwards.find(row=>row.skillId==='item:blade');
  assert.equal(award.before,1);assert.equal(award.after,1);assert.equal(award.gained,25);assert.equal(award.levelUps,0);
  assert.equal(run.skills['item:blade'].level,1);
  assert.equal(run.skills['item:blade'].xp,threshold+15);
  assert.equal(pendingSkillLevelCount(reg,run,'item:blade'),1);
  const restored=deserializeRun(serializeRun(run));
  assert.equal(claimBankedSkillLevel(reg,restored,'class:reaver'),null);
  assert.equal(restored.skills['item:blade'].xp,threshold+15);
  assert.equal(claimBankedSkillLevel(reg,restored,'item:blade').after,2);
  assert.equal(restored.skills['item:blade'].xp,15);
});

test('new draft and sealed pools preserve every equipment gate while legacy full pools retain their contract',()=>{
  const gated = new Set(source.classMastery.filter(row=>['weapon','armament'].includes(row.kind)).map(row=>row.ref));
  for(const mode of ['draft','sealed']) {
    const run=createRunState({registries:source,classId:'reaver',seed:3});run.custom={deckMode:mode};
    openRunClassMastery(source,run,{}, {receiptId:mode});
    const reg=registriesForClassMastery(source,run);
    assert.ok(reg.equipment.armaments.every(piece=>!gated.has(`armament/${piece.id}`)));
    assert.ok(reg.equipment.armour.every(piece=>!gated.has(`armor/${piece.classId}/${piece.id}`)));
    assert.equal(reg.classes.get('reaver').cardPool.length,source.classes.get('reaver').cardPool.length);
    const oldRoot=source.legacyProgressionSource;
    const old=createRunState({registries:oldRoot,classId:'reaver',seed:3});old.custom={deckMode:mode};
    openRunClassMastery(oldRoot,old,{}, {receiptId:'old:'+mode});
    const legacy=registriesForClassMastery(source,old);
    assert.equal(legacy.equipment.armaments.length,oldRoot.equipment.armaments.length);
    assert.equal(legacy.equipment.armour.length,oldRoot.equipment.armour.length);
  }
});
