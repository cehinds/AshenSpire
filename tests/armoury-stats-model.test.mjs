// tests/armoury-stats-model.test.mjs — the Armoury character-stats panel's data
// (ui/models/ArmouryStatsModel.js), read without a DOM. The expected strings were
// captured from the expressions mountEquipment used before the extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { armouryStatsModel, armouryStatsInitiallyOpen, relicsSummary, faceSummary } from '../src/ui/models/ArmouryStatsModel.js';

const registries = createRegistries(contentBundle);
const run = createRunState({ seed: 1, classId: 'reaver', registries });

test('out of combat the model carries no attribute rows and nothing open at first', () => {
  const model = armouryStatsModel({ registries, run, meta: {}, inCombat: false, characterMode: 'folded' });
  assert.equal(model.initiallyOpen, null);
  assert.equal(model.attributeRows, null);
  assert.equal(model.attributesSummary, '');
  assert.equal(model.configuredFoundation, false);
  assert.equal(model.skillRows.length, 2);
  assert.equal(model.skillRows[0].sense, 'Reaver — level 0, 400 XP to level 1.');
  assert.deepEqual(model.staleTracks, []);
  assert.equal(model.equipmentCardsSummary, 'Slashing Strike x1 · Shield Defend x0 · Weapon Technique x0');
});

test('in combat the attribute rows are compact and summarised in one line', () => {
  const model = armouryStatsModel({ registries, run, meta: {}, inCombat: true, characterMode: 'expanded' });
  assert.equal(model.initiallyOpen, 'attributesCard');
  assert.equal(model.attributeRows.length, 5);
  assert.ok(model.attributeRows.every((entry) => entry.face.compact === true));
  assert.equal(model.attributesSummary, 'STR 3 · DEX 1 · CON 2 · WIS 1 · INT 1');
});

test('the small string helpers', () => {
  assert.equal(armouryStatsInitiallyOpen('expanded'), 'attributesCard');
  assert.equal(armouryStatsInitiallyOpen('folded'), null);
  assert.equal(relicsSummary(['A', 'B']), '2 equipped · A · B');
  assert.equal(relicsSummary([]), '0 equipped');
  assert.equal(faceSummary([{ label: 'STR', value: 3 }, { label: 'DEX', value: 1 }]), 'STR 3 · DEX 1');
});
