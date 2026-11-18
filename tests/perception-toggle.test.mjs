// Owner, 2026-11-18 (ruling §12): Perception is off through `enemyKnowledge.perception.enabled` (no track, no XP, no intent-read bonus);
// enabled: true is today's behaviour; an old save carrying a track still loads and the track is ignored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyKnowledge } from '../src/content/enemyKnowledge.js';
import { snapshotEnemyKnowledgeRules } from '../src/model/enemyKnowledgeRules.js';
import { openRunEnemyKnowledge, openKnowledgeEncounter, reconcilePerception, enemyKnowledgeRunProblems } from '../src/model/enemyKnowledgeRun.js';
import { perceptionEnabled, perceptionLevelFor } from '../src/model/perception.js';
import { skillTracks } from '../src/model/skills.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { characterSheetModel } from '../src/ui/models/CharacterSheetModel.js';
import { identificationChance } from '../src/model/enemyIntentKnowledge.js';

const rulesWith = enabled => { const rules = snapshotEnemyKnowledgeRules(); rules.perception.enabled = enabled; return rules; };
const open = enabled => {
  const run = { seed: 1, skills: {}, enemyKnowledgeRules: rulesWith(enabled) };
  openRunEnemyKnowledge(run, { receiptId: 'run-a', bankable: true });
  return run;
};

test('the shipped content has Perception off', () => {
  assert.equal(enemyKnowledge.perception.enabled, false);
  assert.equal(perceptionEnabled(snapshotEnemyKnowledgeRules()), false);
});

test('enabled: false creates no Perception track and awards no XP', () => {
  const run = open(false);
  assert.equal(run.skills.perception, undefined);
  openKnowledgeEncounter(run, 'node', 'fight', ['soldier']);
  assert.equal(reconcilePerception(run, run.enemyKnowledgeState.currentEncounter.id, 5), null);
  assert.equal(run.skills.perception, undefined);
  assert.deepEqual(enemyKnowledgeRunProblems(run, new Set(['soldier'])), []);
});

test('enabled: false gives no intent-read bonus even when a level is carried', () => {
  const off = rulesWith(false), on = rulesWith(true);
  const skills = { perception: { xp: 0, level: 4, pendingDrafts: 0 } };
  assert.equal(perceptionLevelFor(off, skills), 0);
  assert.equal(perceptionLevelFor(on, skills), 4);
  const attrs = { wisdom: 5, intelligence: 5 };
  assert.equal(identificationChance(off, attrs, 1, perceptionLevelFor(off, skills)), identificationChance(off, attrs, 1, 0));
  assert.ok(identificationChance(on, attrs, 1, perceptionLevelFor(on, skills)) > identificationChance(on, attrs, 1, 0));
});

test('enabled: false hides the track from the skill lists; enabled: true lists it', () => {
  const tracks = (enabled) => skillTracks({}, { includePerception: perceptionEnabled(rulesWith(enabled)) });
  assert.equal(tracks(false).some(track => track.id === 'perception'), false);
  assert.equal(tracks(true).some(track => track.id === 'perception'), true);
});

test('enabled: true is today\'s behaviour: the track opens and XP reconciles', () => {
  const run = open(true);
  assert.deepEqual(run.skills.perception, { xp: 0, level: 0, pendingDrafts: 0 });
  openKnowledgeEncounter(run, 'node', 'fight', ['soldier']);
  assert.equal(reconcilePerception(run, run.enemyKnowledgeState.currentEncounter.id, 3).levelUps, 1);
});

test('an old run carrying a Perception track still validates with Perception off (the track is ignored)', () => {
  const run = open(true);
  run.enemyKnowledgeRules.perception.enabled = false;
  run.skills.perception = { xp: 99, level: 3, pendingDrafts: 7 };
  assert.deepEqual(enemyKnowledgeRunProblems(run, new Set(['soldier'])), []);
});

test('the character sheet model lists no Perception track when it is off, and lists it when on', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 4242, classId: 'reaver', registries });
  assert.equal(run.enemyKnowledgeRules.perception.enabled, false);
  assert.equal(JSON.stringify(characterSheetModel(registries, run)).includes('Perception'), false);
  run.enemyKnowledgeRules.perception.enabled = true;
  assert.ok(characterSheetModel(registries, run).tracks.some(track => track.id === 'perception'));
});
