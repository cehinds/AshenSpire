import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigSnapshot, configuredContentBundle, updatedXpSnapshot, xpSnapshotFromProfile } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { xpToNext as skillXpToNext } from '../src/model/skills.js';
import { xpToNext as characterXpToNext } from '../src/model/levelup.js';

const xpKey = 'gameConfig.balance.level.xp.base';
const linearKey = 'gameConfig.balance.level.xp.linear';

for (const [growth, expectedSkill, expectedCharacter] of [[1.025, 100, 105], [1.275, 125, 130]]) {
  test(`legacy skill and class exponential rounding stays exact at growth ${growth}`, () => {
    const overrides = {};
    for (const path of ['level.xp', 'skill.xp', 'skill.class.xp']) {
      Object.assign(overrides, {
        [`gameConfig.balance.${path}.base`]: 100,
        [`gameConfig.balance.${path}.growth`]: growth,
        [`gameConfig.balance.${path}.roundTo`]: 5,
      });
    }
    const registries = createRegistries(configuredContentBundle(contentBundle, { schemaVersion: 1, overrides }));
    assert.equal(skillXpToNext(registries, 'weapon', 1), expectedSkill, 'the saved weapon threshold retains its original rounding');
    assert.equal(skillXpToNext(registries, 'class', 1), expectedSkill, 'the saved class threshold retains its original rounding');
    assert.equal(characterXpToNext(registries, 2), expectedCharacter, 'character exponential curves retain their existing epsilon');
    const linear = createRegistries(configuredContentBundle(contentBundle, advancedConfigSnapshot({})));
    // Skill and class default to the owner's ×1.75 curve (2026-10-02).
    assert.equal(skillXpToNext(linear, 'weapon', 1), 175);
    assert.equal(skillXpToNext(linear, 'class', 1), 175);
  });
}

test('new snapshots use the authored curve while legacy XP edits preserve their exponential curve', () => {
  const current = advancedConfigSnapshot({});
  const old = { schemaVersion: 1, overrides: { [xpKey]: 100, 'gameConfig.balance.level.xp.growth': 1.2 } };
  const currentBundle = configuredContentBundle(contentBundle, current);
  assert.equal(current.xpCurveVersion, 1);
  // The authored character curve is exponential ×1.75 (owner, 2026-10-02).
  assert.equal(currentBundle.balance.level.xp.linear, false);
  assert.equal(currentBundle.balance.level.xp.growth, 1.75);
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
