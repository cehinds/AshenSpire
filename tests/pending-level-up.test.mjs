import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { awardLevelXp, bankLevelXp, claimBankedLevel, pendingLevelCount, xpToNext } from '../src/model/levelup.js';

const registries = createRegistries(contentBundle);

test('XP crosses a threshold without advancing a level or granting its points', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 41 });
  const cost = xpToNext(registries, 1);
  const beforePoints = run.level.unspentPoints;
  const result = bankLevelXp(registries, run, cost + 25);
  assert.equal(result.gained, cost + 25);
  assert.equal(result.pendingLevelUps, 1);
  assert.deepEqual([run.level.level, run.level.xp, run.level.unspentPoints], [1, cost + 25, beforePoints]);
  const restored = deserializeRun(serializeRun(run));
  assert.deepEqual(validateRunShape(restored), []);
  assert.equal(pendingLevelCount(registries, restored), 1);
  const claim = claimBankedLevel(registries, restored);
  assert.deepEqual([claim.after, restored.level.xp, restored.level.unspentPoints], [2, 25, beforePoints + claim.points]);
  assert.equal(claimBankedLevel(registries, restored), null, 'a second press cannot mint another level');
});

test('several earned levels are claimed one at a time with the rest banked', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 42 });
  const first = xpToNext(registries, 1);
  const second = xpToNext(registries, 2);
  bankLevelXp(registries, run, first + second + 7);
  assert.equal(pendingLevelCount(registries, run), 2);
  assert.equal(claimBankedLevel(registries, run).remaining, 1);
  assert.equal(run.level.level, 2);
  assert.equal(claimBankedLevel(registries, run).remaining, 0);
  assert.deepEqual([run.level.level, run.level.xp], [3, 7]);
});

test('level reward settings can omit stat points without losing the level or excess XP', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 43 });
  bankLevelXp(registries, run, xpToNext(registries, 1) + 9);
  const claim = claimBankedLevel(registries, run, { grantStats: false });
  assert.deepEqual([claim.after, claim.points, run.level.xp, run.level.unspentPoints], [2, 0, 9, 0]);
  assert.deepEqual(validateRunShape(deserializeRun(serializeRun(run))), []);
});

test('the per-fight level cap still bounds banked XP and reports discarded XP', () => {
  const capped = { ...registries, balance: { ...registries.balance, level: { ...registries.balance.level, maxLevelsPerFight: 1 } } };
  const run = createRunState({ registries, classId: 'reaver', seed: 44 });
  const amount = xpToNext(capped, 1) + xpToNext(capped, 2) + 40;
  const receipt = bankLevelXp(capped, run, amount);
  assert.equal(receipt.pendingLevelUps, 1);
  assert.ok(receipt.discarded > 0);
  assert.equal(run.level.xp, amount - receipt.discarded);
  claimBankedLevel(capped, run);
  assert.equal(pendingLevelCount(capped, run), 0);
});

test('the automatic-level preference can still grant a level without stat points', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 45 });
  const receipt = awardLevelXp(registries, run, xpToNext(registries, 1) + 4, { grantStats: false });
  assert.deepEqual([receipt.levelUps, receipt.points, run.level.level, run.level.xp], [1, 0, 2, 4]);
});
