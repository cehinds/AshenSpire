import test from 'node:test';
import assert from 'node:assert/strict';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {createRunState} from '../src/model/state.js';
import {startingAbilityPlan,startingAbilityProblem} from '../src/model/startingAbilities.js';
import {quickStartRunConfig} from '../src/model/characterCreation.js';
import {creationCategories,creationFlowCategories,creationHasSpells,creationAbilitySelection,creationFooterPlan} from '../src/ui/models/CreationWorkspaceModel.js';
const registries=createRegistries(contentBundle);
const birth=classId=>createRunState({registries,classId,seed:42});
test('creation follows authored pages and omits only Spells for noncasting class metadata',()=>{
 assert.deepEqual([...creationCategories()],['class','subclass','attributes','feats','spells','maneuvers','equipment','keepsake','review']);
 for(const cls of registries.classes.all()){
  const expected=cls.tags.includes('item:magic-focus')||registries.characterCreation.classes[cls.id].startingAbility?.skillId==='item:magic-focus';
  assert.equal(creationHasSpells(registries,cls.id),expected);
  const flow=creationFlowCategories(registries,cls.id);assert.equal(flow.includes('spells'),expected);assert.equal(flow.includes('maneuvers'),!expected);assert.equal(flow.length,8);
  assert.equal(creationFooterPlan({categories:flow,current:'equipment'}).next,'keepsake');
  assert.equal(creationFooterPlan({categories:flow,current:'feats'}).next,expected?'spells':'maneuvers');
 }
});
test('caster detection uses tags or authored skill rather than class names, retaining a tagged martial branch',()=>{
 const tagged={...registries,classes:{get:()=>({id:'custom',tags:['item:magic-focus']})},characterCreation:{classes:{custom:{startingAbility:{skillId:'combatManeuvers',count:1,rank:1}}}}};
 assert.equal(creationHasSpells(tagged,'custom'),true);assert.ok(creationFlowCategories(tagged,'custom').includes('spells'));assert.equal(tagged.characterCreation.classes.custom.startingAbility.skillId,'combatManeuvers');
 const skillOnly={...tagged,classes:{get:()=>({id:'renamed',tags:[]})},characterCreation:{classes:{renamed:{startingAbility:{skillId:'item:magic-focus'}}}}};assert.equal(creationHasSpells(skillOnly,'renamed'),true);
 const misleadingName={...skillOnly,classes:{get:()=>({id:'starseer',tags:[]})},characterCreation:{classes:{starseer:{startingAbility:{skillId:'combatManeuvers'}}}}};assert.equal(creationHasSpells(misleadingName,'starseer'),false);
});
test('ability selections retain legal distinct families, cap count and clear stale choices after class or gear changes',()=>{
 const caster=registries.classes.all().find(cls=>registries.characterCreation.classes[cls.id].startingAbility?.skillId==='item:magic-focus');
 const martial=registries.classes.all().find(cls=>registries.characterCreation.classes[cls.id].startingAbility?.skillId==='combatManeuvers');
 const plan=startingAbilityPlan(registries,birth(caster.id)),chosen=plan.choices.slice(0,plan.count).map(c=>c.id);
 assert.deepEqual(creationAbilitySelection(chosen,plan),chosen);assert.equal(startingAbilityProblem(registries,birth(caster.id),chosen),null);
 assert.deepEqual(creationAbilitySelection(chosen,startingAbilityPlan(registries,birth(martial.id))),[]);
 const reduced={...plan,choices:plan.choices.filter(c=>c.id!==chosen[0])};assert.deepEqual(creationAbilitySelection(chosen,reduced),chosen.slice(1));
 const duplicate={id:'same-family',abilityFamily:plan.choices[0].abilityFamily||plan.choices[0].id};assert.deepEqual(creationAbilitySelection([chosen[0],duplicate.id,chosen[1],'missing'],{...plan,choices:[...plan.choices,duplicate]}),chosen);
 assert.deepEqual(creationAbilitySelection(chosen,null),[]);
});
test('birth and Quick Start retain existing zero-feat and omitted-ability contracts',()=>{
 const quick=quickStartRunConfig(registries);assert.equal(Object.hasOwn(quick,'startingAbilityIds'),false);assert.equal(Object.hasOwn(quick,'startingFeatIds'),false);
 const run=createRunState({registries,seed:42,...quick});assert.deepEqual(run.feats,[]);assert.equal(run.level.level,1);
 for(const cls of registries.classes.all())assert.deepEqual(birth(cls.id).feats,[]);
});
