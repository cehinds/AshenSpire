import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { characterSheetModel } from '../src/ui/models/CharacterSheetModel.js';
import { progressionStats, skillInspection } from '../src/ui/models/ProgressionInspectionModel.js';
import { statRow } from '../src/model/statRows.js';
import { statRowValue } from '../src/model/derivedStats.js';
import { abilityOfferPool } from '../src/model/abilityOffers.js';
import { abilityRankAt } from '../src/model/abilityGrades.js';
import { getFeatDescription } from '../src/model/classSkillFeatDescription.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';

const registries = createRegistries(contentBundle);
const fresh = () => createRunState({ seed: 4242, classId: 'reaver', registries });

test('compact sheet contains exactly five resources (AR, DR and PR are not stats) and all five attributes without modifying the run', () => {
  const run = fresh(), before = structuredClone(run);
  const result = progressionStats(registries, run);
  assert.deepEqual(result.rows.map(row => row.faceLabel), ['HP', 'Stamina', 'Mana', 'HandSize', 'Draw']);
  assert.equal(result.attributes.length, 5);
  assert.ok(result.rows.every(row => Number.isFinite(row.value)));
  assert.deepEqual(run, before);
});

test('attribute bonus uses the saved rule, including gain and caps', () => {
  const run = fresh();
  // HP is a row the sheet still shows: tighten it with a gain and a cap and the attribute's marginal contribution follows.
  Object.assign(run.derivedStatRuleSnapshot.rules.rules.hp, { constitution: 3, gain: 2, max: 20 });
  const rule = statRow(registries, run, 'hp');
  const expected = statRowValue(rule, { attributes: run.attributes }).value
    - statRowValue(rule, { attributes: { ...run.attributes, constitution: 0 } }).value;
  const attr = progressionStats(registries, run).attributes.find(row => row.id === 'constitution');
  assert.ok(attr.face.summary.includes(`HP: +${expected}`));
  assert.ok(!/\b(AR|DR|PR)\b/.test(JSON.stringify(progressionStats(registries, run).attributes.map(a => a.face))), 'no attribute face names AR, DR or PR');
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

const masteryRun = (classId, source = registries) => {
  const run = createRunState({ seed: 42, classId, registries: source });
  
  return run;
};
