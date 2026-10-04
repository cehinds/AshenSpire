import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProgressionRewards, partitionProgressionRewards, unclaimedProgressionRewards, progressionRewardUnlocked, deferredOtherClassRewardCount } from '../src/model/deferredProgression.js';
import { pendingRewardCheckpoint } from '../src/model/rewardSourcePolicy.js';
import { rewardPlan } from '../src/model/rewardplan.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { learnClassCard } from '../src/model/classLibraryState.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { classTreeRows } from '../src/model/classTree.js';

const registries = createRegistries(contentBundle);
const makeRun = () => createRunState({ seed: 123, classId: 'reaver', registries });
test('unfinished choices survive exit and save/reload, with absolute level requirements', () => {
  const run = makeRun();
  run.level = { level: 1, xp: 355, unspentPoints: 0 };
  const rewards = mergeProgressionRewards({}, {
    cinders: 32, cardIds: ['strike'],
    levelChoices: [{ ordinal: 0, options: [{ kind: 'feat', id: 'fieldStudy' }] },
      { ordinal: 1, options: [{ kind: 'feat', id: 'weaponDrill' }] }],
  }, run);
  const checkpoint = pendingRewardCheckpoint(rewards, { source: 'elite', after: 'map' });
  checkpoint.states['levelChoice:0'] = 'taken';
  checkpoint.chosenDraftCardIds['levelChoice:0'] = 'feat:fieldStudy';
  run.deferredProgression = unclaimedProgressionRewards(checkpoint);
  assert.deepEqual(Object.keys(run.deferredProgression), ['levelChoices']);
  assert.equal(run.deferredProgression.levelChoices[0].requiredLevel, 3);
  assert.deepEqual(validateRunShape(run), []);
  const restored = deserializeRun(serializeRun(run));
  assert.deepEqual(restored.deferredProgression, run.deferredProgression);
  assert.equal(restored.level.xp, 355, 'deferring never consumes XP');
  const next = mergeProgressionRewards(restored.deferredProgression, {
    levelChoices: [{ ordinal: 0, options: [{ kind: 'feat', id: 'vitalRenewal' }] }],
  }, restored, { characterStart: 3 });
  assert.deepEqual(next.levelChoices.map(row => row.requiredLevel), [3, 4]);
  assert.deepEqual(next.levelChoices.map(row => row.ordinal), [0, 1]);
  const rows = rewardPlan(next).rows;
  assert.equal(progressionRewardUnlocked(rows[0], restored), false);
  restored.level.level = 3;
  assert.equal(progressionRewardUnlocked(rows[0], restored), true);
  assert.equal(progressionRewardUnlocked(rows[1], restored), false);
});

test('later victories reserve saved skill drafts instead of duplicating or rerolling them', () => {
  const run = makeRun();
  run.skills['item:blade'] = { level: 1, xp: 200, pendingDrafts: 1 };
  const saved = { skillDrafts: [{ skillId: 'item:blade', level: 1, requiredLevel: 1, cardIds: ['strike'] }] };
  const next = mergeProgressionRewards(saved, { skillDrafts: [
    { skillId: 'item:blade', level: 1, cardIds: ['different'] },
    { skillId: 'item:blade', level: 2, claimOrdinal: 1, cardIds: ['new-level'] },
  ] }, run);
  assert.deepEqual(next.skillDrafts.map(row => row.cardIds), [['strike'], ['new-level']]);
  assert.deepEqual(next.skillDrafts.map(row => row.requiredLevel), [1, 2]);
});

test('malformed deferred rewards are rejected by the normal save validator', () => {
  const run = makeRun();
  run.deferredProgression = { levelChoices: [{ ordinal: 0, requiredLevel: -1, options: [{ kind: 'feat', id: 'fieldStudy' }] }] };
  assert.ok(validateRunShape(run).some(problem => problem.includes('deferredProgression') && problem.includes('requiredLevel')));
  run.deferredProgression = { cinders: 30 };
  assert.ok(validateRunShape(run).some(problem => problem.includes('non-progression')));
});

test('banked class bonuses are issued once and combat feats need no character level', () => {
  const run = makeRun();
  run.skills['class:reaver'] = { level: 1, xp: 300, pendingDrafts: 0 };
  const bonus = { source: 'class', skillId: 'class:reaver', claimOrdinal: 1, options: [{ kind: 'feat', id: 'fieldStudy' }] };
  const saved = mergeProgressionRewards({}, { levelChoices: [bonus] }, run);
  const next = mergeProgressionRewards(saved, { levelChoices: [bonus,
    { source: 'combat', options: [{ kind: 'feat', id: 'weaponDrill' }] }],
  }, run);
  assert.equal(next.levelChoices.length, 2, 're-rolling a still-banked class level cannot duplicate its bonus');
  const rows = rewardPlan(next).rows;
  assert.equal(progressionRewardUnlocked(rows[0], run), false);
  assert.equal(progressionRewardUnlocked(rows[1], run), true);
});

test('deferred class rewards survive class changes, victory, Character, and actual save reload', () => {
  let run = makeRun();
  const saves = createSaveManager(createMemoryStorage());
  const nodeId = classTreeRows(registries, 'reaver')[0].nodeId;
  const initial = mergeProgressionRewards({}, {
    classDrafts: [{ classId: 'reaver', level: 1, nodeIds: [nodeId] }],
    levelChoices: [
      { options: [{ kind: 'classNode', id: nodeId }, { kind: 'feat', id: 'fieldStudy' }] },
      { source: 'class', skillId: 'class:reaver', claimOrdinal: 1, options: [{ kind: 'feat', id: 'weaponDrill' }] },
    ],
    levelCards: [{ source: 'class', skillId: 'class:reaver', claimOrdinal: 1, cardIds: ['strike'] }],
  }, run);
  run.deferredProgression = unclaimedProgressionRewards(pendingRewardCheckpoint(initial, { source: 'normal', after: 'map' }));
  assert.equal(run.deferredProgression.levelChoices[0].classId, 'reaver', 'mixed character offers retain the class owning their tree choices');
  const original = structuredClone(run.deferredProgression);
  learnClassCard(registries, run, 'starseer');
  equipClassCard(registries, run, 'starseer');
  assert.equal(deferredOtherClassRewardCount(run), 4);
  for (const source of ['normal', 'character']) {
    const { available, deferred } = partitionProgressionRewards(mergeProgressionRewards(run.deferredProgression, { cinders: 7 }, run), run);
    run.pendingReward = pendingRewardCheckpoint(available, { source, after: 'map' });
    run.deferredProgression = deferred;
    assert.equal(available.classDrafts, undefined, 'a different class never enters the active reward checkpoint');
    saves.saveRun(run);
    run = saves.loadRun(registries);
    assert.ok(run, 'the real load door must accept the checkpoint without quarantine');
    assert.deepEqual(saves.listArchives(), []);
    run.deferredProgression = mergeProgressionRewards(run.deferredProgression, unclaimedProgressionRewards(run.pendingReward), run);
    delete run.pendingReward;
    assert.deepEqual(run.deferredProgression, original, 'leaving another class screen cannot spend or reroll the saved offer');
  }
  equipClassCard(registries, run, 'reaver');
  const restored = partitionProgressionRewards(run.deferredProgression, run);
  assert.deepEqual(restored.available, original);
  assert.deepEqual(restored.deferred, {});
  run.pendingReward = pendingRewardCheckpoint(restored.available, { source: 'character', after: 'map' });
  delete run.deferredProgression;
  saves.saveRun(run);
  assert.ok(saves.loadRun(registries), 'restored offers also pass the original class tree reference validator');
});

test('empty core retains class offers while character feats remain claimable', () => {
  const run = makeRun();
  const offers = mergeProgressionRewards({}, {
    classDrafts: [{ classId: 'reaver', level: 1, nodeIds: [classTreeRows(registries, 'reaver')[0].nodeId] }],
    levelChoices: [{ options: [{ kind: 'feat', id: 'fieldStudy' }] }],
  }, run);
  equipClassCard(registries, run, null);
  const { available, deferred } = partitionProgressionRewards(offers, run);
  assert.equal(available.levelChoices.length, 1);
  assert.equal(available.classDrafts, undefined);
  assert.equal(deferred.classDrafts.length, 1);
  run.deferredProgression = deferred;
  assert.equal(deferredOtherClassRewardCount(run), 1);
  equipClassCard(registries, run, 'reaver');
  assert.equal(partitionProgressionRewards(deferred, run).available.classDrafts.length, 1);
});
