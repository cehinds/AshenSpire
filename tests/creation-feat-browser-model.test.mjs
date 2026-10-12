import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { masteryRowId } from '../src/model/classMastery.js';
import { skillFeatOptions } from '../src/model/skills.js';
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


test('profile unlocks expose their source without falsely claiming the numeric level is met', () => {
  const run = born('reaver');
  const gate = registries.classMastery.find(row => row.kind === 'feat' && row.ref === 'reaverIronFooting');
  run.classMasteryState = { version: 1, profile: { classMastery: { reaver: { level: 0, xp: 0, unlockedRows: [masteryRowId(gate)] } } } };
  const result = creationFeatBrowserGroups(registries, run)[1].rows.find(row => row.id === gate.ref);
  assert.equal(result.currentLevel, 0);
  assert.equal(result.requiredLevel, gate.level);
  assert.equal(result.locked, false);
  assert.equal(result.unlockedByProfile, true);
  assert.ok(skillFeatOptions(run, 'class:reaver', 0, registries).includes(gate.ref));
});

test('mastery gate overrides a differing minLevel like authoritative skill feat options', () => {
  const run = born('reaver');
  run.classMasteryState = { version: 1, profile: { classMastery: {} } };
  run.skills['class:reaver'] = { level: 1 };
  const source = { ...registries, classSkillFeats: registries.classSkillFeats.map(feat => feat.id === 'reaverIronFooting' ? { ...feat, minLevel: 9 } : feat) };
  const result = creationFeatBrowserGroups(source, run)[1].rows.find(row => row.id === 'reaverIronFooting');
  assert.equal(result.requiredLevel, 1);
  assert.equal(result.locked, false);
  assert.ok(skillFeatOptions(run, 'class:reaver', 1, source).includes(result.id));
});
