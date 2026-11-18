// Review fix: an elite's armament chance is rolled once, directly after the relic step; level doors never re-roll it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { ArmamentRewardStep } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const run = () => createRunState({ seed: 1, classId: 'reaver', registries: reg, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });

test('a failed elite armament roll is spent: N level doors never roll again', () => {
  const r = run();
  let rolls = 0;
  const failing = { int: () => { rolls++; return 100; }, pick: (_, list) => list[0] };
  let rest = { offerId: '1:n:combat', source: 'combat', levelOffers: 4, armamentReward: 'elite' };
  for (let door = 0; door < 5; door++) {
    const step = ArmamentRewardStep(reg, r, failing, rest);
    assert.equal(step.next, null);
    assert.equal(step.rest.armamentReward, '');
    // The level door copies the record forward under a new offer id.
    rest = { ...step.rest, offerId: `1:n:combat:level:${door}` };
  }
  assert.equal(rolls, 1);
});
