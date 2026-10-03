import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { skillBookReadPlan, commitSkillBookRead, consumableConfigRows, consumableTableProblems } from '../src/model/consumables.js';
import { classBookBonuses } from '../src/model/bookBonusRewards.js';
import { deckCopyLimit } from '../src/model/deckCopyLimit.js';
import { featIds } from '../src/model/feats.js';

function fixture(card=25,feat=5) {
  const registries=createRegistries(configuredContentBundle(contentBundle,{
    'gameConfig.consumables.starseerClassBook.combatCardChance':card,
    'gameConfig.consumables.starseerClassBook.featChance':feat,
  }));
  const run=createRunState({seed:123,classId:'reaver',registries});
  run.consumables={starseerClassBook:3};
  return {registries,run};
}
const quote=(r,run)=>{const plan=skillBookReadPlan(r,run,'starseerClassBook');return {...plan,choice:plan.lessons[0]};};

test('class books expose independently configurable bounded 25/5 defaults',()=>{
  for(const book of contentBundle.consumables.filter((row)=>row.learnClass)) {
    assert.equal(book.combatCardChance,25);assert.equal(book.featChance,5);
    for(const field of ['combatCardChance','featChance']){
      const row=consumableConfigRows(contentBundle).find((row)=>row.key===`gameConfig.consumables.${book.id}.${field}`);
      assert.equal(row.min,0);assert.equal(row.max,100);
      for(const value of [-1,101,12.5]) {
        const bad={...contentBundle,consumables:contentBundle.consumables.map((b)=>b.id===book.id?{...b,[field]:value}:b)};
        const errors=[];consumableTableProblems(bad.consumables,bad,(path,message)=>errors.push({path,message}));
        assert.ok(errors.some((error)=>error.path===`consumables.${book.id}.${field}`));
      }
    }
  }
});
for(const [card,feat] of [[0,0],[100,0],[0,100],[100,100]])test(`independent ${card}/${feat} bonuses commit once with XP and class learning`,()=>{
  const {registries:r,run}=fixture(card,feat);const q=quote(r,run);const before=run.deck.length;
  const receipt=commitSkillBookRead(r,run,q);
  assert.equal(receipt.gained,40);assert.equal(receipt.classLearned,true);
  assert.ok(run.classCards.starseer);assert.equal(run.class,'reaver');
  assert.equal(Boolean(receipt.bonuses.card),card===100);assert.equal(Boolean(receipt.bonuses.feat),feat===100);
  assert.equal(run.deck.length,before+(card===100?1:0));assert.equal(run.feats.length,feat===100?1:0);
  assert.equal(run.consumables.starseerClassBook,2);assert.equal(run.bookReadRevision,1);
  if(receipt.bonuses.card) assert.ok(r.classes.get('starseer').cardPool.includes(receipt.bonuses.card.id));
  if(receipt.bonuses.feat) assert.ok(featIds.includes(receipt.bonuses.feat.id));
  const committed=structuredClone(run);assert.throws(()=>commitSkillBookRead(r,run,q),/changed/);assert.deepEqual(run,committed);
  assert.deepEqual(validateRunShape(run),[]);
});
test('known-class repeat readings retain picks and grant another XP receipt',()=>{
  const {registries:r,run}=fixture(0,0);commitSkillBookRead(r,run,quote(r,run));
  run.classCards.starseer.coreTags=['retained-pick'];const saved=structuredClone(run.classCards.starseer);
  const receipt=commitSkillBookRead(r,run,quote(r,run));
  assert.equal(receipt.classLearned,false);assert.equal(receipt.gained,40);
  assert.equal(run.skills['class:starseer'].xp,80);assert.deepEqual(run.classCards.starseer,saved);
});
test('preview/cancel, wrong choice, combat and changed odds cannot spend or reroll',()=>{
  const {registries:r,run}=fixture();const before=structuredClone(run);const q=quote(r,run);
  const expected=classBookBonuses(r,run,q.def);
  assert.deepEqual(classBookBonuses(r,structuredClone(run),q.def),expected);
  assert.throws(()=>commitSkillBookRead(r,run,{...q,choice:{kind:'card',id:'bad'}}));
  assert.throws(()=>commitSkillBookRead(r,run,q,{inCombat:true}));
  assert.throws(()=>commitSkillBookRead(r,run,{...q,rewardChances:[100,100]}),/changed/);
  assert.deepEqual(run,before);assert.deepEqual(classBookBonuses(r,run,q.def),expected);
});
test('class bonus obeys rarity unlocks and sends excess copies to the sideboard',()=>{
  const {registries:r,run}=fixture(100,0);
  assert.equal(r.cards.get(classBookBonuses(r,run,r.consumables.get('starseerClassBook')).card.id).rarity,'common');
  run.class='starseer';run.skills['class:starseer']={level:20,xp:0,pendingDrafts:0};
  for (run.seed=0;run.seed<1000;run.seed++) {
    const candidate=classBookBonuses(r,run,r.consumables.get('starseerClassBook')).card;
    if (Number.isFinite(deckCopyLimit(r,candidate.id,{},run.class))) break;
  }
  assert.ok(run.seed<1000,'seeded class pool includes an own-class limited card');
  const q=quote(r,run);const reward=classBookBonuses(r,run,q.def).card;
  const limit=deckCopyLimit(r,reward.id,{},run.class);
  assert.ok(Number.isFinite(limit));
  run.deck=run.deck.filter((card)=>card.cardId!==reward.id);
  for(let n=0;n<limit;n++) run.deck.push({instanceId:`limit-${n}`,cardId:reward.id,upgraded:false});
  const receipt=commitSkillBookRead(r,run,q);
  assert.equal(receipt.bonuses.card.destination,'sideboard');assert.equal(run.sideboard.at(-1).cardId,reward.id);
});
test('legacy frozen book definitions with no odds grant XP without bonuses',()=>{
  const bundle={...contentBundle,consumables:contentBundle.consumables.map(({combatCardChance,featChance,...book})=>book)};
  const r=createRegistries(bundle);const run=createRunState({seed:123,classId:'reaver',registries:r});run.consumables={starseerClassBook:1};
  const receipt=commitSkillBookRead(r,run,quote(r,run));assert.deepEqual(receipt.bonuses,{card:null,feat:null});assert.equal(receipt.gained,40);
});
