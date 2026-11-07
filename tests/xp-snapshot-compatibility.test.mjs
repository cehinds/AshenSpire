import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { advancedConfigSnapshot, configuredContentBundle } from '../src/model/advancedConfig.js';
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
    // Skill and class default to SPEC §13.4o's curves (2026-10-04): ×1.995 from 100, ×1.224 from 400.
    assert.equal(skillXpToNext(linear, 'weapon', 1), 200);
    assert.equal(skillXpToNext(linear, 'class', 1), 490);
  });
}

test('new snapshots use the authored curve while legacy XP edits preserve their exponential curve', () => {
  const current = advancedConfigSnapshot({});
  const old = { schemaVersion: 1, overrides: { [xpKey]: 100, 'gameConfig.balance.level.xp.growth': 1.2 } };
  const currentBundle = configuredContentBundle(contentBundle, current);
  assert.equal(current.xpCurveVersion, 1);
  // The authored character curve is exponential ×1.5 from 200 (SPEC §13.4o, owner 2026-11-05).
  assert.equal(currentBundle.balance.level.xp.linear, false);
  assert.equal(currentBundle.balance.level.xp.growth, 1.5);
  const edited = { ...old, overrides: { ...old.overrides, [xpKey]: 200 } };
  assert.equal(Object.hasOwn(edited, 'xpCurveVersion'), false);
  const legacy = configuredContentBundle(contentBundle, edited);
  assert.equal(legacy.balance.level.xp.linear, false);
  assert.equal(legacy.balance.level.xp.growth, 1.2);
  assert.equal(legacy.balance.level.xp.base, 200);
  const adopted = configuredContentBundle(contentBundle, { ...old, overrides: { ...old.overrides, [linearKey]: true } });
  assert.equal(adopted.balance.level.xp.linear, true);
  assert.equal(adopted.balance.level.xp.multScaler, 1.3);
});
const ratingsKey = 'gameConfig.balance.combatRatings.enabled';

test('a saved snapshot without a ratings marker stays on legacy non-XP rules; a current one keeps its marker', () => {
  const saved = { schemaVersion: 1, sourceRevision: 'saved-rules', overrides: { [xpKey]: 200, [ratingsKey]: true } };
  assert.equal(Object.hasOwn(saved, 'ratingsVersion'), false);
  assert.equal(configuredContentBundle(contentBundle, saved).balance.combatRatings.enabled, false);
  assert.equal(configuredContentBundle(contentBundle, saved).balance.level.xp.base, 200);
  const current = advancedConfigSnapshot({ [ratingsKey]: true });
  assert.equal(current.ratingsVersion, 1);
  assert.equal(configuredContentBundle(contentBundle, current).balance.combatRatings.enabled, true);
});
