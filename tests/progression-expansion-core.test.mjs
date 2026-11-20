import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import { cardManaPolicy } from '../src/content/generated/cardManaPolicy.js';
import { cardCostBudget } from '../src/model/actionCosts.js';
import { applyAbilityGrade as gradeFace } from '../src/model/abilityGrades.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape, initializeRunDerivedStats } from '../src/model/state.js';
import { awardSkillXp, activateAbilitySkill, xpToNext } from '../src/model/skills.js';
import { classRewardBudget } from '../src/model/classMilestones.js';
import { rollAbilityOffer, abilityOfferPool } from '../src/model/abilityOffers.js';
import { createRng } from '../src/engine/rng.js';
import { recordSkillXp, skillXpReceipt } from '../src/engine/skillXp.js';
import { rewardPlan, resolveContinue, pickIds } from '../src/model/rewardplan.js';
import { composeProgressionContent } from '../src/model/progressionContent.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { learnClassCard } from '../src/model/classLibraryState.js';

const source = createRegistries(contentBundle);
function fresh(meta = {}) {
  const run = createRunState({registries:source,classId:'reaver',seed:3});
  
  return {run,reg:source};
}
function lessons(reg) {
  const defs = new Map();
  for (const [kind,ids] of Object.entries({spell:['cometFragment','crystalBarrier','scholarsInsight','ashenMote'],maneuver:['quickstep','backstep','stomp']})) for (const id of ids) defs.set(id,{
    ...source.cards.get(id),costRule:undefined,abilityKind:kind,abilityRank:0,abilityFamily:id,tags:[kind === 'spell' ? 'source:spell':'source:unarmed'],
    gradeProfiles:Array.from({length:6},(_,rank)=>({rank,actionCost:rank ? Math.min(rank,3):1,manaCost:rank,effects:[{op:'block',target:'self',amount:4+rank}],textTemplate:`Grade ${rank}`})),
  });
  return {...reg,masterySource:null,cards:{get:id=>defs.get(id)||source.cards.get(id),has:id=>defs.has(id),all:()=>[...defs.values()]}};
}

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
  // The grade's Stamina and Mana are the cost formula's at grade 4 (SPEC §4.3a; authored 3 SP / 4 MP before), and a face
  // at 2 SP or more carries the 1.8 multiplier on its authored 8.
  const priced=cardCostBudget(gradeFace(reg.cards.get('cometFragment'),4),{rank:4});
  assert.equal(card.cost,priced.sp);assert.equal(card.manaCost,priced.mp);
  assert.equal(card.effects[0].amount,priced.sp>=2?Math.round(8*1.8):8);assert.equal(card.textTemplate,'Grade 4');
});
