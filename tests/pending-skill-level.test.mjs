import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { bankSkillXp, claimBankedSkillLevel, pendingSkillLevelCount, xpToNext } from '../src/model/skills.js';
import { chooseFeat, featMultiplier, featStacks } from '../src/model/feats.js';

const registries = createRegistries(contentBundle);

test('skill XP waits at each threshold and keeps excess XP after a claim', () => {
  const run = createRunState({ seed: 0x7170, classId: 'reaver', registries });
  const first = xpToNext(registries, 'weapon', 0);
  const second = xpToNext(registries, 'weapon', 1);
  const award = bankSkillXp(registries, run, 'item:blade', first + second + 7);
  assert.equal(award.levelUps, 0);
  assert.equal(run.skills['item:blade'].level, 0);
  assert.equal(pendingSkillLevelCount(registries, run, 'item:blade'), 2);
  assert.equal(claimBankedSkillLevel(registries, run, 'item:blade').after, 1);
  assert.equal(run.skills['item:blade'].xp, second + 7);
  assert.equal(pendingSkillLevelCount(registries, run, 'item:blade'), 1);
  assert.equal(claimBankedSkillLevel(registries, run, 'item:blade').after, 2);
  assert.equal(run.skills['item:blade'].xp, 7);
  assert.equal(claimBankedSkillLevel(registries, run, 'item:blade'), null);
});

test('a selected feat and pending skill claim survive the save door', () => {
  const run = createRunState({ seed: 0x7171, classId: 'reaver', registries });
  bankSkillXp(registries, run, 'item:blade', xpToNext(registries, 'weapon', 0));
  assert.equal(chooseFeat(run, 'fieldStudy'), true);
  assert.equal(chooseFeat(run, 'fieldStudy'), true);
  assert.equal(featStacks(run, 'fieldStudy'), 2);
  assert.equal(featMultiplier(run, 'characterXp'), 1.2);
  run.pendingReward = {
    schemaVersion: 1, source: 'normal', after: 'map', expanded: true,
    rewards: { title: 'VICTORY', levelChoices: [{ ordinal: 0, options: [
      { kind: 'feat', id: 'vitalRenewal' }, { kind: 'classNode', id: 'ironFooting' },
    ] }] },
    states: {}, skillClaims: { 'item:blade': 0 }, chosenCardId: null,
    chosenDraftCardIds: {}, chosenDraftNodeIds: {},
  };
  assert.deepEqual(validateRunShape(run), []);
  const restored = deserializeRun(serializeRun(run));
  assert.deepEqual(restored.feats, ['fieldStudy', 'fieldStudy']);
  assert.equal(pendingSkillLevelCount(registries, restored, 'item:blade'), 1);
  assert.deepEqual(restored.pendingReward.rewards.levelChoices, run.pendingReward.rewards.levelChoices);
});
