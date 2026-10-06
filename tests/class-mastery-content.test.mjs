import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle as expandedBundle } from '../src/content/index.js';
// Keep the pre-expansion regression suite on its actual saved content contract.
const contentBundle = { ...expandedBundle, ...expandedBundle.legacyProgression, legacyProgression: undefined, balance: {...expandedBundle.balance, progression: undefined} };
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { validateContent } from '../src/model/validate.js';
import { masteryRowId, masteryCorePool, masteryCardPool, masteryRefAvailable, masteryXpAtLevel } from '../src/model/classMastery.js';
import { classMasteryProblems } from '../src/model/classMasteryContent.js';

const reg=createRegistries(contentBundle);
const allGatedCards=new Set(reg.classMastery.filter(r=>r.kind==='cards').map(r=>r.ref));
const fresh=()=>structuredClone({...contentBundle,scripts:{}});
const refusal=(edit,pattern)=>{const bundle=fresh();edit(bundle);assert.match(classMasteryProblems(bundle).join('\n'),pattern);};

test('mastery authors every level, a deep core, twenty feats and the front-loaded curve',()=>{
 assert.equal(validateContent(contentBundle).ok,true);
 assert.equal(contentBundle.classSkillFeats.length,20);
 assert.equal(masteryXpAtLevel(reg,1),50);
 assert.ok(masteryXpAtLevel(reg,20)>16000 && masteryXpAtLevel(reg,20)<18000);
 for(const cls of reg.classes.all()){
  const core=masteryCorePool(reg,cls.id);
  assert.ok(core.length>=Math.ceil(cls.cardPool.length*reg.balance.classMastery.corePoolShare));
  assert.deepEqual(masteryCardPool(reg,{},cls.id),core);
  const gatedFeats=reg.classMastery.filter(r=>r.classId===cls.id && r.kind==='feat');
  assert.deepEqual(gatedFeats.map(r=>r.level),[6,14]);
  assert.equal(reg.classSkillFeats.filter(f=>f.skillId===`class:${cls.id}`).length,5);
  for(const kitId of cls.eligibleStartingKitIds){
   const run=createRunState({registries:reg,classId:cls.id,startingKitId:kitId,seed:7,profileMeta:{discoveredArmaments:reg.equipment.armaments.map(a=>a.id)}});
   assert.ok(run.deck.every(c=>!allGatedCards.has(c.cardId)),`${cls.id} ${kitId}: every starting card is core globally`);
  }
 }
 assert.ok(masteryCorePool(reg,'herald').includes('emberCommunion'));
});

test('a claimed row joins the class card pool and global items open to every class',()=>{
 const cards=reg.classMastery.filter(r=>r.classId==='reaver' && r.level===1);
 const item=reg.classMastery.find(r=>r.classId==='reaver' && r.level===2);
 const profile={classMastery:{reaver:{xp:50,level:2,unlockedRows:[...cards,item].map(masteryRowId)}}};
 assert.ok(cards.every(r=>masteryCardPool(reg,profile,'reaver').includes(r.ref)));
 assert.equal(masteryRefAvailable(reg,{},item.kind,item.ref),false);
 assert.equal(masteryRefAvailable(reg,profile,item.kind,item.ref),true);
 assert.equal(masteryRefAvailable(reg,{},'weapon','armament/straightSword'),true);
});

test('cycle, foreign cards, duplicate ownership and starting cards are refused by name',()=>{
 refusal(b=>b.classMastery[0].kind='weapon',/reaver:1:weapon:enterGorefire.*breaks the cycle/);
 refusal(b=>b.classMastery[0].ref='missingCard',/missingCard.*unknown card/);
 refusal(b=>b.classMastery[0].ref='starSpark',/starSpark.*outside 'reaver' cardPool/);
 refusal(b=>b.classMastery.find(r=>r.classId==='rogue' && r.level===8).ref='armament/warhammer',/rogue.*already listed by 'reaver'/);
 refusal(b=>b.classMastery[0].ref=b.classes.find(c=>c.id==='reaver').startingSignatureCard,/starting-deck card must be core/);
 refusal(b=>b.classMastery.find(r=>r.classId==='reaver' && r.level===8).ref='armament/straightSword',/baseline starting equipment cannot be gated/);
 refusal(b=>b.classMastery.find(r=>r.classId==='reaver' && r.level===4).ref=b.classes.find(c=>c.id==='herald').kitRelic,/herald.*starting relic cannot be gated/);
 refusal(b=>b.classMastery[0].ref='quickstep',/rogue.rogueBow.quickstep.*core globally/);
});

test('too-small cores and school rarity shortages fail before a run can roll them',()=>{
 refusal(b=>{
  const cls=b.classes.find(c=>c.id==='reaver');
  for(const ref of cls.cardPool.filter(id=>!b.classMastery.some(r=>r.kind==='cards' && r.ref===id)))b.classMastery.push({classId:cls.id,level:1,kind:'cards',ref});
 },/core pool.*below corePoolShare/);
 refusal(b=>{
  const tags=id=>b.tagging.filter(t=>t.family==='card' && t.objectId===id).map(t=>t.tagId);
  const cls=b.classes.find(c=>c.id==='starseer');
  const ids=cls.cardPool.filter(id=>b.cards.find(c=>c.id===id).rarity==='rare' && tags(id).includes('ritual'));
  for(const ref of ids.filter(id=>!b.classMastery.some(r=>r.kind==='cards' && r.ref===id)))b.classMastery.push({classId:cls.id,level:19,kind:'cards',ref});
 },/starseer.ashStaff.rare.*needs four distinct choices/);
});

test('invalid balance and class-feat effects fail by their authored identity',()=>{
 refusal(b=>b.balance.classMastery.pay.perBoss=-1,/pay.perBoss/);
 refusal(b=>b.classSkillFeats[0].passive.block=0,/reaverIronFooting.*positive integer/);
 refusal(b=>b.classMastery.find(r=>r.kind==='feat').ref='notAFeat',/notAFeat.*unknown class feat/);
 refusal(b=>b.classMastery.find(r=>r.kind==='armament').ref='armor/reaver/notAnOutfit',/notAnOutfit.*not armour/);
 for(const multiplier of [Infinity,'1.5'])refusal(b=>b.classSkillFeats.find(f=>f.crit).crit.multiplier=multiplier,/finite numbers/);
 refusal(b=>b.classSkillFeats.find(f=>f.crit).crit.weights={banana:100},/weight 'banana'.*name an attribute/);
 refusal(b=>b.classSkillFeats.find(f=>f.crit).crit.weights={strength:Infinity},/weight 'strength'.*finite/);
 refusal(b=>b.classSkillFeats[0].skillId=4,/reaverIronFooting.*name a class track/);
 refusal(b=>b.classSkillFeats={},/feats.*must be an array/);
});
