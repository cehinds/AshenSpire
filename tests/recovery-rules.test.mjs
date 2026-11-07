// After-combat and at-rest recovery (owner, 2026-09-27; in-combat rules and stored
// `recovery.*` settings removed in cleanup 3i-A). Both read the authored defaults only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createLocationVisit, previewRest, restAt } from '../src/engine/locations.js';
import { applyAfterCombatRecovery, applyPercentRecovery, restRecoveryBonus } from '../src/model/recoveryRules.js';
import { recoveryRules } from '../src/content/recoveryRules.js';
import { mechanics } from '../src/framework/data/mechanics.js';

const registries = createRegistries(contentBundle);
const LEGACY = {
  'recovery.hp.afterCombat': 50, 'recovery.hp.atRest': 100, 'recovery.hp.perTurn': 5,
  'recovery.mana.afterCombat': 100, 'recovery.mana.atRest': 100, 'recovery.stamina.atRest': 100,
};

test('the authored defaults restore nothing after a fight or at a Rest, and a fight builds no recovery state', () => {
  assert.equal(recoveryRules.defaults.stamina.perTurn, mechanics.stamina.idleRecoveryPerTurn);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const combat = createRunCombat({ registries, rng: createRng(7), run, enemyIds: ['wanderingSoldier'], settings: LEGACY });
  assert.equal(combat.recovery, undefined);
  assert.equal(serializeCombatSnapshot(combat).recovery, undefined);
  assert.deepEqual(restRecoveryBonus(), { hp: 0, stamina: 0, mana: 0 });
});

test('a stored legacy recovery.* key has no effect on after-combat or Rest healing', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.hp = 1; run.mana = 0;
  const gained = applyAfterCombatRecovery(run, LEGACY);
  assert.deepEqual(gained, { hp: 0, stamina: 0, mana: 0 });
  assert.equal(run.hp, 1);

  const visit = createLocationVisit({ run, registries, rng: createRng(4) }, 'camp', { restBonus: restRecoveryBonus(LEGACY) });
  const plain = createLocationVisit({ run: structuredClone(run), registries, rng: createRng(4) }, 'camp', { restBonus: null });
  assert.equal(previewRest(visit).hp, previewRest(plain).hp, 'the Rest preview is the same with or without the stored keys');
});

test('the percent applier restores each pool by its percent of the maximum', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  run.hp = 1; run.mana = 0;
  const gained = applyPercentRecovery(run, { hp: 50 });
  assert.equal(gained.hp, Math.floor(run.maxHp / 2));
  assert.equal(gained.mana, 0);

  run.hp = 1;
  const visit = createLocationVisit({ run, registries, rng: createRng(4) }, 'camp', { restBonus: { hp: 100, stamina: 0, mana: 0 } });
  const preview = previewRest(visit);
  assert.equal(preview.hp, run.maxHp, 'the preview includes the bonus');
  assert.equal(restAt(visit).hp, preview.hp, 'the Rest gives what the preview said');
});

test('Stamina between fights is inert while fights open with it full', () => {
  assert.equal(mechanics.stamina.combatStartRefill, 'full');
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  run.stamina = 0;
  assert.equal(applyAfterCombatRecovery(run).stamina, 0);
});
