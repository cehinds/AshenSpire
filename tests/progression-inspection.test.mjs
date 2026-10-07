import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { characterSheetModel } from '../src/ui/models/CharacterSheetModel.js';
import { progressionStats, skillInspection, featInspection, ownedFeatInspections } from '../src/ui/models/ProgressionInspectionModel.js';
import { statRow } from '../src/model/statRows.js';
import { statRowValue } from '../src/model/derivedStats.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { abilityOfferPool } from '../src/model/abilityOffers.js';
import { abilityRankAt } from '../src/model/abilityGrades.js';
import { getFeatDescription } from '../src/model/classSkillFeatDescription.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';

const registries = createRegistries(contentBundle);
const fresh = () => createRunState({ seed: 4242, classId: 'reaver', registries });

test('compact sheet contains exactly eight resources and all five attributes without modifying the run', () => {
  const run = fresh(), before = structuredClone(run);
  const result = progressionStats(registries, run);
  assert.deepEqual(result.rows.map(row => row.faceLabel), ['HP', 'SP', 'MP', 'AR', 'PR', 'DR', 'HandSize', 'Draw']);
  assert.equal(result.attributes.length, 5);
  assert.ok(result.rows.every(row => Number.isFinite(row.value)));
  assert.deepEqual(run, before);
});

test('attribute bonus uses the saved rule, including gain and caps', () => {
  const run = fresh();
  Object.assign(run.derivedStatRuleSnapshot.rules.rules.ar, { strength: 3, gain: 2, max: 5 });
  const rule = statRow(registries, run, 'ar');
  const expected = statRowValue(rule, { attributes: run.attributes }).value
    - statRowValue(rule, { attributes: { ...run.attributes, strength: 0 } }).value;
  const attr = progressionStats(registries, run).attributes.find(row => row.id === 'strength');
  assert.ok(attr.face.summary.includes(`AR: +${expected}`));
  assert.ok(expected < run.attributes.strength * rule.strength * rule.gain, 'the cap changes the marginal contribution');
});

test('skill associations follow held item schools and the class reward pool', () => {
  const run = fresh();
  const track = characterSheetModel(registries, run).tracks.find(track => track.id === 'item:blade');
  const details = skillInspection(registries, run, track);
  assert.ok(details.cards.length);
  const pool = registries.classes.get(run.class).cardPool;
  assert.ok(details.cards.every(card => pool.includes(card.id) && card.tags.some(tag => details.tags.includes(tag))));
  run.loadout.sets = Object.fromEntries(Object.keys(run.loadout.sets).map(key => [key, []]));
  const empty = skillInspection(registries, run, track);
  assert.equal(empty.requiresEquipment, true);
  assert.deepEqual(empty.cards, []);
  assert.deepEqual(empty.tags, []);
});

test('feat inspections expose authored tags and preserve repeated general feat stacks', () => {
  const run = fresh();
  run.feats = ['fieldStudy', 'fieldStudy'];
  run.skillFeats = ['bladeCritical'];
  const feats = ownedFeatInspections(registries, run);
  assert.equal(feats.length, 2);
  assert.equal(feats.find(feat => feat.id === 'fieldStudy').owned, 2);
  assert.deepEqual(featInspection(registries, run, 'fieldStudy').tags, []);
  assert.deepEqual(featInspection(registries, run, 'bladeCritical').tags, ['blade']);
  assert.deepEqual(featInspection(registries, run, 'shieldBraced').tags, ['guard']);
  assert.equal(featInspection(registries, run, 'missing'), null);
});

const masteryRun = (classId, source = registries) => {
  const run = createRunState({ seed: 42, classId, registries: source });
  openRunClassMastery(source, run, {}, { receiptId: `inspection:${classId}` });
  return run;
};

test('every registered expanded class feat appears with its live description and authoritative property tags', () => {
  let count = 0;
  for (const cls of registries.classes.all()) {
    const run = masteryRun(cls.id), before = structuredClone(run);
    const details = skillInspection(registries, run, { id: `class:${cls.id}`, kind: 'class' });
    const expected = registries.classSkillFeats.filter(feat => feat.skillId === `class:${cls.id}`);
    assert.deepEqual(details.feats.map(feat => feat.id), expected.map(feat => feat.id));
    for (const feat of details.feats.filter(feat => feat.id.startsWith('progression-'))) {
      count++;
      assert.equal(feat.description, getFeatDescription(registries, feat.id));
      assert.ok(feat.description && !/\{[^}]+\}/.test(feat.description));
      assert.ok(feat.tags.includes(`feat:${feat.id.slice('progression-'.length)}`));
    }
    assert.deepEqual(run,before,'inspection only reads');
    run.skillFeats = details.feats.map(feat => feat.id);
    const ownedBefore = structuredClone(run);
    assert.equal(ownedFeatInspections(registries,run).length,details.feats.length);
    assert.deepEqual(run,ownedBefore,'owned inspection only reads');
  }
  assert.equal(count,50);
});

test('configured and independently installed feat definitions override global authoring imports', () => {
  const binding = contentBundle.variableBindings.find(row => row.nodeId === 'feat:coal-on-steel' && row.scope === 'default');
  const configured = createRegistries(configuredContentBundle(contentBundle, { [`gameConfig.balance.${binding.balancePath}`]: 17 }));
  const run = masteryRun('reaver',configured);
  assert.match(featInspection(configured,run,'progression-coal-on-steel').description,/17/);
  const installed = { ...configured, classSkillFeats: [{id:'module-fixture',skillId:'class:reaver',name:'Modular feat',minLevel:1,description:'Independently installed effect',tags:['blade']}] };
  assert.equal(featInspection(installed,run,'module-fixture').description,'Independently installed effect');
  assert.deepEqual(skillInspection(installed,run,{id:'class:reaver',kind:'class'}).feats.map(feat=>feat.id),['module-fixture']);
});

test('ability inspection uses shared lessons, weapon eligibility and the saved current-rank rule', () => {
  for (const [classId,id,kind] of [['starseer','item:magic-focus','focus'],['reaver','combatManeuvers','ability']]) {
    const run = masteryRun(classId);
    run.skills[id] = {level:4,xp:7,pendingDrafts:0};
    run.progressionRuleSnapshot.ability.ranksAt = [1,5,6,7,8,10];
    const scoped = registriesForClassMastery(registries,run), grade = abilityRankAt(scoped,4), before = structuredClone(run);
    const details = skillInspection(registries,run,{id,kind});
    assert.equal(grade,0,'snapshot changes the current rank despite global level 4 rank 2');
    assert.deepEqual(details.cards.map(card=>card.id),abilityOfferPool(scoped,run,id,grade));
    assert.ok(details.cards.length >= 3);
    assert.ok(details.cards.every(card=>card.abilityKind===details.abilityKind && card.abilityRank===grade && card.manaCost===0));
    assert.equal(details.requiresEquipment,false);
    const lesson = id === 'combatManeuvers' ? 'quickstep' : 'scholarsInsight';
    assert.ok(details.cards.some(card=>card.id===lesson),'shared lessons outside the class pool are included');
    const classDetails = skillInspection(registries,run,{id:`class:${classId}`,kind:'class'});
    assert.ok(classDetails.cards.filter(card=>card.abilityKind===details.abilityKind).every(card=>card.abilityRank===grade));
    assert.deepEqual(run,before);
    if (id==='combatManeuvers') {
      run.loadout.sets = Object.fromEntries(Object.keys(run.loadout.sets).map(key=>[key,[]]));
      const unarmed = skillInspection(registries,run,{id,kind});
      assert.ok(unarmed.cards.some(card=>card.id==='quickstep'));
      assert.ok(!unarmed.cards.some(card=>card.tags.includes('source:weapon')));
      assert.equal(unarmed.requiresEquipment,false);
    }
  }
});

test('root inspection of a legacy save keeps historical class feats, focus equipment rules and printed faces', () => {
  const old = createRegistries(legacyContentBundle), run = masteryRun('reaver',old);
  const track = {id:'item:magic-focus',kind:'focus'};
  assert.deepEqual(skillInspection(registries,run,track),skillInspection(old,run,track));
  assert.equal(skillInspection(registries,run,track).requiresEquipment,true);
  const classTrack = {id:'class:reaver',kind:'class'}, fromRoot = skillInspection(registries,run,classTrack);
  assert.deepEqual(fromRoot,skillInspection(old,run,classTrack));
  assert.ok(fromRoot.feats.every(feat=>!feat.id.startsWith('progression-')));
  assert.ok(fromRoot.cards.every(card=>card.legacyAbility===true && card.abilityRank===undefined));
});
