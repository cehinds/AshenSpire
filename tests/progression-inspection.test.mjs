import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { characterSheetModel } from '../src/ui/models/CharacterSheetModel.js';
import { progressionStats, skillInspection, featInspection, ownedFeatInspections } from '../src/ui/models/ProgressionInspectionModel.js';
import { statRow } from '../src/model/statRows.js';
import { statRowValue } from '../src/model/derivedStats.js';

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
