import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { creationFeatBrowserGroups } from '../src/ui/models/CreationFeatBrowserModel.js';
const registries = createRegistries(contentBundle);
const born = classId => createRunState({ registries, classId, seed: 42 });

test('birth browses canonical locked character, selected-class and skill feats without granting or mutation', () => {
  const run = born('starseer'), before = JSON.stringify(run);
  const groups = creationFeatBrowserGroups(registries, run);
  assert.deepEqual(groups.map(group => group.id), ['character','class','skill']);
  assert.equal(groups[0].rows.length, 6);
  assert.ok(groups[0].rows.every(row => row.currentLevel === 1 && row.requiredLevel === 2 && row.locked));
  assert.ok(groups[1].rows.length > 0);
  assert.ok(groups[1].rows.every(row => row.trackId === 'class:starseer' && row.name && row.description));
  assert.ok(groups[2].rows.some(row => row.id === 'bladeCritical' && row.requiredLevel === 2 && row.locked));
  assert.ok(groups[2].rows.some(row => row.id === 'shieldBraced' && row.trackLabel));
  assert.equal(JSON.stringify(run), before);
  assert.deepEqual(run.feats, []);
});

test('actual track levels independently meet character, class and skill requirements', () => {
  const run = born('reaver');
  run.level.level = 2;
  run.skills['class:reaver'] = { level: 1 };
  run.skills['item:blade'] = { level: 2 };
  const groups = creationFeatBrowserGroups(registries, run);
  assert.ok(groups[0].rows.every(row => !row.locked));
  assert.equal(groups[1].rows.find(row => row.id === 'reaverIronFooting').requiredLevel, 1);
  assert.equal(groups[1].rows.find(row => row.id === 'reaverIronFooting').locked, false);
  assert.equal(groups[2].rows.find(row => row.id === 'bladeCritical').locked, false);
  assert.equal(groups[2].rows.find(row => row.id === 'shieldBraced').locked, true);
});

test('authored mastery gates and retuned skill cadence change requirements rather than hardcoded values', () => {
  const run = born('reaver');
  const source = { ...registries, balance: { ...registries.balance, skill: { ...registries.balance.skill, featEvery: 5 } },
    classMastery: registries.classMastery.map(gate => gate.ref === 'reaverIronFooting' ? { ...gate, level: 7 } : gate) };
  const groups = creationFeatBrowserGroups(source, run);
  assert.equal(groups[1].rows.find(row => row.id === 'reaverIronFooting').requiredLevel, 7);
  assert.equal(groups[2].rows.find(row => row.id === 'bladeCritical').requiredLevel, 5);
  assert.ok(!groups[1].rows.some(row => row.trackId === 'class:starseer'));
});
