import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCardMechanicalValues, CardScoreReferenceContext } from '../src/model/cardMechanicalProjection.js';
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { staticCardTokens } from '../src/model/playingCard.js';
import { rebalanceCardAsync, focusedCardMetrics } from '../tools/score-studio/focusedRebalance.js';
import { productionBundle } from './helpers/production-bundle.mjs';

const base = { id:'subclass.projection.serrated-cut',name:'Serrated Cut',class:'reaver',type:'attack',rarity:'common',cost:0,staminaCost:0,manaCost:0,costRule:'fixed',icon:'attack',tags:['camp:physical','source:weapon','maneuver:attack','blood','theme:blood','classification.attack'],keywords:[],damageSchool:'physical',effects:[{op:'damage',target:'enemy',amount:8},{op:'applyStatus',target:'enemy',status:'bleed',stacks:1}],textTemplate:'Deal {damage} damage. Apply {bleed} bleed.' };
const card = amount => ({...structuredClone(base),effects:[{...base.effects[0],amount},structuredClone(base.effects[1])]});
const cp = def => CombatPower(ScoreCard(CardDefinitionToScoreFace(def),scoring).raw,def.rarity,scoring);

test('authored damage plateaus share exactly the displayed mechanic and CP',()=>{
  const a=ProjectCardMechanicalValues(card(8)),b=ProjectCardMechanicalValues(card(7)),c=ProjectCardMechanicalValues(card(16));
  // The reference Reaver's 1 Strength (owner, 2026-11-28) adds one point to each displayed hit.
  assert.equal(a.tokens.damage,2);assert.equal(b.tokens.damage,2);assert.equal(c.tokens.damage,4);
  assert.equal(a.card.effects[0].amount,2);assert.equal(c.card.effects[0].amount,4);
  assert.equal(cp(card(8)),cp(card(7)));assert.ok(cp(card(16))>cp(card(8)));
  assert.equal(CardDefinitionToScoreFace(card(8)).dmg,2);assert.equal(CardDefinitionToScoreFace(card(16)).dmg,4);
  for(const id of ['core.projection-probe','subclass.projection-probe']){
    const before={...card(8),id},same={...card(7),id},after={...card(16),id};
    assert.equal(cp(before),12);assert.equal(cp(same),12);assert.equal(cp(after),14);
  }
});

test('cached projections respect alternate contexts and mutations to a supplied neutral baseline',()=>{
  const reference=CardScoreReferenceContext(base),rules={...reference.rules,faceAttributes:{strength:0,dexterity:0,intelligence:0,wisdom:0},gearRules:[]};
  const original=ProjectCardMechanicalValues(base,reference),custom=ProjectCardMechanicalValues(original.card,{registries:reference.registries,rules});
  assert.deepEqual(custom.tokens,staticCardTokens(base,reference.registries,rules));
  assert.notEqual(custom.tokens.damage,original.tokens.damage);
  const previous=custom.tokens.damage;rules.faceAttributes.strength=20;
  const changed=ProjectCardMechanicalValues(custom.card,{registries:reference.registries,rules});
  assert.deepEqual(changed.tokens,staticCardTokens(base,reference.registries,rules));assert.ok(changed.tokens.damage>previous);
  assert.equal(base.effects[0].amount,8);
});

test('bound registries reuse their own neutral class reference and canonical contexts match the default renderer',()=>{
  const canonical=CardScoreReferenceContext(base).registries,supplied={...canonical};
  for(const classId of ['reaver','rogue','starseer','herald']){
    const definition={...card(16),class:classId};
    const reference=CardScoreReferenceContext(definition,{registries:supplied});
    assert.equal(reference.registries,supplied);assert.equal(reference.rules.class,classId);
    assert.equal(reference.rules.seed,31);assert.deepEqual(reference.rules.relics,[]);
    assert.equal(CardScoreReferenceContext(definition,{registries:supplied}),reference);
    assert.deepEqual(ProjectCardMechanicalValues(definition,{registries:supplied}).tokens,ProjectCardMechanicalValues(definition).tokens);
    assert.deepEqual(CardDefinitionToScoreFace(definition,{registries:supplied}),CardDefinitionToScoreFace(definition));
  }
});

test('custom bound profiles retain their own renderer values and raw registries keep the original partial-context fallback',async()=>{
  const {registries:customRegistries}=await import('./helpers/fixcore-combat-rules.mjs');
  const supplied={...customRegistries},definition=card(16),reference=CardScoreReferenceContext(definition,{registries:supplied});
  const before=ProjectCardMechanicalValues(definition,{registries:supplied});
  assert.deepEqual(before.tokens,staticCardTokens(definition,supplied,reference.rules));
  assert.notEqual(before.tokens.damage,ProjectCardMechanicalValues(definition).tokens.damage);
  reference.rules.faceAttributes={strength:20,dexterity:0,intelligence:0,wisdom:0};
  const mutated=ProjectCardMechanicalValues(definition,{registries:supplied});
  assert.notEqual(mutated,before);assert.deepEqual(mutated.tokens,staticCardTokens(definition,supplied,reference.rules));
  const canonical=CardScoreReferenceContext(definition);supplied.gameProfile=canonical.registries.gameProfile;
  const replaced=CardScoreReferenceContext(definition,{registries:supplied});
  assert.notEqual(replaced,reference);assert.equal(replaced.rules.gameProfile.hash,supplied.gameProfile.hash);
  assert.deepEqual(ProjectCardMechanicalValues(definition,{registries:supplied}).tokens,ProjectCardMechanicalValues(definition).tokens);
  const {gameProfile:_profile,...raw}=canonical.registries;
  assert.equal(CardScoreReferenceContext(definition,{registries:raw}),canonical);
  assert.deepEqual(ProjectCardMechanicalValues(definition,{registries:raw}),ProjectCardMechanicalValues(definition,{registries:raw,rules:canonical.rules}));
});

test('edited costs remain authoritative with disabled resources and a conflicting profile resource variant',()=>{
  const context=CardScoreReferenceContext(base),definition={...card(16),cost:1,staminaCost:1};
  const profile={...context.rules.gameProfile,modules:{...context.rules.gameProfile.modules,resources:{...context.rules.gameProfile.modules.resources,include:['sp']}},
    content:{...context.rules.gameProfile.content,resourceVariants:{[definition.id]:{sp:{cost:3,staminaCost:3,manaCost:0,effects:[{op:'damage',target:'enemy',amount:99}]}}}}};
  const rules={...context.rules,gameProfile:profile},snapshot=structuredClone(profile.content.resourceVariants);
  const projected=ProjectCardMechanicalValues(definition,{registries:context.registries,rules});
  assert.equal(projected.card.cost,1);assert.equal(projected.card.staminaCost,1);assert.equal(projected.card.manaCost,0);
  assert.equal(projected.tokens.damage,ProjectCardMechanicalValues(definition).tokens.damage);
  assert.deepEqual(profile.content.resourceVariants,snapshot);assert.equal(definition.effects[0].amount,16);
  assert.throws(()=>ProjectCardMechanicalValues({...definition,manaCost:1},{registries:context.registries,rules}),/missing authored disabled-resource variant/);
});

test('identical full inputs reuse the frozen final projection while source and context changes invalidate it',()=>{
  const context=CardScoreReferenceContext(base),source=card(8),snapshot=structuredClone(source);
  const original=ProjectCardMechanicalValues(source,context);
  assert.equal(ProjectCardMechanicalValues(structuredClone(source),context),original);
  assert.equal(ProjectCardMechanicalValues({...structuredClone(source),_edited:true},context),original);
  assert.ok(Object.isFrozen(original));assert.ok(Object.isFrozen(original.card.effects[0]));
  assert.throws(()=>{original.card.effects[0].amount=99;},TypeError);
  assert.deepEqual(source,snapshot);
  source.effects[0].amount=16;
  const changed=ProjectCardMechanicalValues(source,context);
  assert.notEqual(changed,original);assert.equal(changed.tokens.damage,4);assert.equal(original.tokens.damage,2);
  assert.deepEqual(original.card.effects[1],snapshot.effects[1]);assert.equal(snapshot.effects[0].amount,8);
  const rules={...context.rules,faceAttributes:{strength:0,dexterity:0,intelligence:0,wisdom:0},gearRules:[]};
  const alternate=ProjectCardMechanicalValues(original.card,{registries:context.registries,rules});
  assert.notEqual(alternate,original);assert.deepEqual(alternate.tokens,staticCardTokens(snapshot,context.registries,rules));
  const prior=alternate.tokens.damage;rules.faceAttributes.strength=20;
  const mutated=ProjectCardMechanicalValues(original.card,{registries:context.registries,rules});
  assert.notEqual(mutated,alternate);assert.ok(mutated.tokens.damage>prior);
});

test('configured and legacy fallback projections own nested metadata without freezing or aliasing their source',()=>{
  const context=CardScoreReferenceContext(base);
  for(const legacy of [false,true]){
    const profile=structuredClone(context.rules.gameProfile);
    if(legacy)profile.modules.cards.mode='legacy';
    const rules={...context.rules,gameProfile:profile};
    const empty=ProjectCardMechanicalValues({id:'fixture.empty',type:'skill'},{registries:context.registries,rules});
    assert.deepEqual(empty.values,[]);assert.deepEqual(empty.tokens,{});assert.equal(Object.hasOwn(empty.card,'effects'),false);
    const source=card(8);
    source.effects[1].if={p:'hasStatus',of:'target',status:'bleed'};
    source.upgrade={effects:[{op:'damage',target:'enemy',amount:12}]};
    source.faceTemplate=['Deal {damage} damage.'];
    const snapshot=structuredClone(source);
    const projected=ProjectCardMechanicalValues(source,{registries:context.registries,rules});
    assert.deepEqual(source,snapshot);
    assert.ok(Object.isFrozen(projected.card.effects[1].if));
    assert.ok(Object.isFrozen(projected.card.upgrade.effects[0]));
    assert.equal(Object.isFrozen(source.tags),false);
    assert.equal(Object.isFrozen(source.effects[1].if),false);
    source.tags.push('fixture:edited');source.effects[1].if.status='weak';
    source.upgrade.effects[0].amount=99;source.faceTemplate[0]='Edited';
    assert.deepEqual(projected.card.tags,snapshot.tags);
    assert.deepEqual(projected.card.effects[1].if,snapshot.effects[1].if);
    assert.deepEqual(projected.card.upgrade,snapshot.upgrade);
    assert.deepEqual(projected.card.faceTemplate,snapshot.faceTemplate);
    assert.notEqual(ProjectCardMechanicalValues(source,{registries:context.registries,rules}),projected);
  }
});

test('configured Evade counts and element packet channels preserve canonical mechanic units',()=>{
  const evade={...base,effects:[{op:'applyStatus',target:'self',status:'evade',stacks:{f:'metric',metric:'evadeStackGain',of:'self',per:2}}]};
  const projection=ProjectCardMechanicalValues(evade);assert.equal(projection.tokens.evade,'2');assert.equal(projection.card.effects[0].stacks,2);
  const packet={...base,magicShare:.5,tags:[...base.tags,'school:fire'],effects:[{op:'damage',target:'enemy',amount:16}]};
  const projected=ProjectCardMechanicalValues(packet);assert.equal(projected.card.effects[0].amount,projected.tokens.damage+projected.tokens.packet);
  assert.equal(CardDefinitionToScoreFace(packet).dmg,projected.tokens.damage+projected.tokens.packet);
});

test('the shipped classic bundle initializes shared projection lazily without captured undefined imports',()=>{
  const require=productionBundle({additionalModules:['src/model/cardMechanicalProjection.js','src/model/cardUpgradeCp.js']});
  const model=require('src/model/cardMechanicalProjection.js'),adapter=require('src/model/cardUpgradeCp.js');
  assert.equal(model.ProjectCardMechanicalValues(card(8)).tokens.damage,2);
  assert.equal(adapter.CardDefinitionToScoreFace(card(8)).dmg,2);
  assert.equal(adapter.CardDefinitionToScoreFace(card(7)).dmg,2);
  assert.equal(adapter.CardDefinitionToScoreFace(card(16)).dmg,4);
  const supplied={...model.CardScoreReferenceContext(base).registries};
  const reference=model.CardScoreReferenceContext(base,{registries:supplied});
  assert.equal(reference.registries,supplied);
  assert.equal(model.ProjectCardMechanicalValues(card(8),{registries:supplied}).tokens.damage,2);
  assert.equal(adapter.CardDefinitionToScoreFace(card(16),{registries:supplied}).dmg,4);
});

test('default projection equals the actual static token reader in the injected reference run',()=>{
  const context=CardScoreReferenceContext(base),projection=ProjectCardMechanicalValues(base,context);
  assert.deepEqual(projection.tokens,staticCardTokens(base,context.registries,context.rules));
  assert.deepEqual(CardDefinitionToScoreFace(base),CardDefinitionToScoreFace(base,context));
  assert.deepEqual(CardDefinitionToScoreFace(projection.card),CardDefinitionToScoreFace(base));
  assert.equal(base.effects[0].amount,8);assert.ok(Object.isFrozen(projection.card));
});

test('rebalancing fixed costs/rarity changes actual displayed damage when CP changes',async()=>{
  const priced={...base,cost:1,staminaCost:1};
  const before=focusedCardMetrics(priced),result=await rebalanceCardAsync(priced,{targetRank:before.rank,targetCp:before.cp+2,targetRarity:'keep',sp:1,mp:0,seed:42,reroll:1});
  assert.equal(result.feasible,true,result.constraintErrors.join('; '));
  assert.equal(result.card.staminaCost,1);assert.equal(result.card.manaCost,0);assert.equal(result.card.rarity,'common');
  assert.equal(result.metrics.cp,before.cp+2);
  const original=ProjectCardMechanicalValues(base),candidate=ProjectCardMechanicalValues(result.card);
  assert.equal(original.tokens.damage,2);assert.equal(candidate.tokens.damage,4);assert.equal(candidate.tokens.bleed,1);
  assert.equal(result.card.effects[1].stacks,1);assert.equal(base.effects[0].amount,8);
});

test('conditional/charge expected values retain reliability and barrier stacks retain their units',()=>{
  const condition={p:'hasStatus',of:'target',status:'bleed'};
  const conditional=card(16);conditional.effects[0].if=condition;
  assert.equal(CardDefinitionToScoreFace(conditional).dmg,4*(scoring.conditionals?.inlineIf??.7));
  const charged={...base,effects:[{op:'grantCardCharge',target:'self',key:'test',cardType:'attack',damage:3}]};
  assert.equal(ProjectCardMechanicalValues(charged).tokens.chargeDamage,3);
  assert.equal(CardDefinitionToScoreFace(charged).dmg,3*(scoring.conditionals?.inlineIf??.7));
  const barrier={...base,effects:[{op:'applyStatus',target:'self',status:'barrier',stacks:2}]};
  const projection=ProjectCardMechanicalValues(barrier);assert.equal(projection.tokens.barrier,10);assert.equal(projection.card.effects[0].stacks,2);
});
