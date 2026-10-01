import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigSnapshot, configuredContentBundle, updatedXpSnapshot, xpSnapshotFromProfile } from '../src/model/advancedConfig.js';

const xpKey = 'gameConfig.balance.level.xp.base';
const linearKey = 'gameConfig.balance.level.xp.linear';

test('new snapshots use linear costs while legacy XP edits preserve their exponential curve', () => {
  const current = advancedConfigSnapshot({});
  const old = { schemaVersion: 1, overrides: { [xpKey]: 100, 'gameConfig.balance.level.xp.growth': 1.2 } };
  const currentBundle = configuredContentBundle(contentBundle, current);
  assert.equal(current.xpCurveVersion, 1);
  assert.equal(currentBundle.balance.level.xp.linear, true);
  const edited = updatedXpSnapshot(old, { [xpKey]: 200 });
  assert.equal(Object.hasOwn(edited, 'xpCurveVersion'), false);
  const legacy = configuredContentBundle(contentBundle, edited);
  assert.equal(legacy.balance.level.xp.linear, false);
  assert.equal(legacy.balance.level.xp.growth, 1.2);
  assert.equal(legacy.balance.level.xp.base, 200);
  const adopted = configuredContentBundle(contentBundle, updatedXpSnapshot(old, { [linearKey]: true }));
  assert.equal(adopted.balance.level.xp.linear, true);
  assert.equal(adopted.balance.level.xp.multScaler, 1.3);
  assert.equal(updatedXpSnapshot(current, { [xpKey]: 200 }).xpCurveVersion, 1);
});
const ratingsKey = 'gameConfig.balance.combatRatings.enabled';

test('XP edits and profile synchronization retain the immutable snapshot contract', () => {
  for (const original of [null, { schemaVersion: 1, sourceRevision: 'saved-rules', overrides: {} }, advancedConfigSnapshot({})]) {
    for (const next of [updatedXpSnapshot(original, { [xpKey]: 200 }), xpSnapshotFromProfile(original, { [xpKey]: 200 })]) {
      assert.equal(Object.isFrozen(next), true);
      assert.throws(() => { next.schemaVersion = 2; }, TypeError);
      assert.equal(next.schemaVersion, 1);
    }
  }
});

test('a live XP edit preserves legacy ratings behavior and snapshot metadata', () => {
  const original = { schemaVersion: 1, sourceRevision: 'saved-rules', overrides: { [ratingsKey]: true } };
  const before = JSON.stringify(original);
  const next = JSON.parse(JSON.stringify(updatedXpSnapshot(original, { [xpKey]: 200, [ratingsKey]: false })));
  assert.equal(configuredContentBundle(contentBundle, original).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, next).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, next).balance.level.xp.base, 200);
  assert.equal(next.sourceRevision, 'saved-rules');
  assert.equal(Object.hasOwn(next, 'ratingsVersion'), false);
  assert.equal(next.overrides[ratingsKey], true);
  assert.equal(JSON.stringify(original), before);
});

test('a run without an advanced snapshot stays on legacy non-XP rules', () => {
  const next = updatedXpSnapshot(null, { [xpKey]: 200 });
  assert.equal(next.schemaVersion, 1);
  assert.equal(Object.hasOwn(next, 'ratingsVersion'), false);
  assert.equal(configuredContentBundle(contentBundle, next).balance.combatRatings.enabled, false);
});

test('current snapshots retain their ratings marker when XP overrides reset', () => {
  const original = advancedConfigSnapshot({ [xpKey]: 200, [ratingsKey]: true });
  const next = updatedXpSnapshot(original, { [xpKey]: undefined });
  assert.equal(next.ratingsVersion, original.ratingsVersion);
  assert.equal(configuredContentBundle(contentBundle, next).balance.combatRatings.enabled, true);
  assert.equal(Object.hasOwn(next.overrides, xpKey), false);
});

test('profile XP synchronization preserves legacy rules and removes stale XP overrides', () => {
  const original = { schemaVersion: 1, sourceRevision: 'saved-rules', overrides: {
    [ratingsKey]: true, [xpKey]: 150, 'gameConfig.balance.xp.quest': 400,
  } };
  const before = JSON.stringify(original);
  const next = JSON.parse(JSON.stringify(xpSnapshotFromProfile(original, { [xpKey]: 200, [ratingsKey]: false })));
  assert.equal(next.sourceRevision, 'saved-rules');
  assert.equal(Object.hasOwn(next, 'ratingsVersion'), false);
  assert.equal(configuredContentBundle(contentBundle, next).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, next).balance.level.xp.base, 200);
  assert.equal(next.overrides[ratingsKey], true);
  assert.equal(Object.hasOwn(next.overrides, 'gameConfig.balance.xp.quest'), false);
  assert.equal(JSON.stringify(original), before);
});

test('profile XP synchronization retains current markers and handles missing snapshots', () => {
  const current = advancedConfigSnapshot({ [ratingsKey]: true });
  const next = xpSnapshotFromProfile(current, { [xpKey]: 200 });
  assert.equal(next.ratingsVersion, current.ratingsVersion);
  assert.equal(configuredContentBundle(contentBundle, next).balance.combatRatings.enabled, true);
  const legacy = xpSnapshotFromProfile(null, { [xpKey]: 200 });
  assert.equal(Object.hasOwn(legacy, 'ratingsVersion'), false);
  assert.equal(configuredContentBundle(contentBundle, legacy).balance.combatRatings.enabled, false);
});
