// A relic with the maxMana1 property (Azure Sigil, Pearl of Sagacity, Graduate) must raise run.maxMana the moment it is
// collected, on every path that adds a relic to a run, and the next combat must open with that max Mana.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { RUN_OPCODE_HANDLERS } from '../src/engine/actions.js';

const shipped = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, shipped)), shipped);
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const RELICS = ['azureSigil', 'pearlOfSagacity', 'graduate'];
const fresh = () => createRunState({ registries, classId: 'reaver', seed: 31, profileMeta: META });
const nextCombatMaxMana = (run) => createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] }).player.maxMana;

function assertRaised(run, before, mana, relic) {
  assert.ok(run.relics.includes(relic), `${relic} is held`);
  assert.equal(run.maxMana, before.maxMana + 1, `${relic} raises run.maxMana by 1`);
  assert.equal(run.mana, mana + 1, `${relic} adds the +1 to current Mana only as the vessel grows`);
  assert.equal(run.hp, before.hp, 'current HP is unchanged');
  assert.equal(nextCombatMaxMana(run), nextCombatMaxMana(before) + 1, `${relic}: the next combat opens with the higher max Mana`);
}

for (const relic of RELICS) {
  test(`claiming ${relic} as a reward raises max Mana by 1`, () => {
    const run = fresh(), before = structuredClone(run), mana = run.mana;
    run.gameProfileRewardOffers = { grant: { id: 'grant', source: 'combat', options: [{ kind: 'relics', id: relic }], takeCount: 1, taken: [], claimed: null } };
    const cls = run.class;
    claimGameProfileReward(registries, run, 'grant', 0);
    assert.equal(run.class, cls);
    assertRaised(run, before, mana, relic);
  });

  test(`the addRelic opcode (event, chest, boss grant) with ${relic} raises max Mana by 1`, () => {
    const run = fresh(), before = structuredClone(run), mana = run.mana;
    RUN_OPCODE_HANDLERS.addRelic({ run, registries, rng: createRng(5), emit() {} }, {}, { op: 'addRelic', id: relic });
    assertRaised(run, before, mana, relic);
  });
}
