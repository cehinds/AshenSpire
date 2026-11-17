// Owner playtest 2026-11-17, theme A (combat math): docs/feedback/2026-11-17-playtest.md items 1-7.
// Each rule is checked against the shipped default game profile (Core 2), not against copied numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { gameProfileEffectiveAttributes } from '../src/model/gameProfileRun.js';

const profile = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const newRun = (classId, seed = 7) => createRunState({ registries, classId, seed, profileMeta: META });

test('item 3: Core player HP is 30 + 5 x (CON + level), relic HP on top', () => {
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const run = newRun(classId);
    const attributes = gameProfileEffectiveAttributes(registries, run);
    const relicFlat = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', { attributes, classDef: registries.classes.get(classId), level: 1 }).value
      - (30 + 5 * (attributes.constitution + 1));
    assert.ok(relicFlat >= 0, `${classId}: a starting relic never lowers HP`);
    assert.equal(run.maxHp, 30 + 5 * (attributes.constitution + 1) + relicFlat, `${classId} level 1`);
    for (const level of [5, 10]) {
      for (const constitution of [1, 3]) {
        const hp = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', { attributes: { ...attributes, constitution }, classDef: registries.classes.get(classId), level }).value;
        assert.equal(hp, 30 + 5 * (constitution + level) + relicFlat, `${classId} level ${level} CON ${constitution}`);
      }
    }
  }
});
