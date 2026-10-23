import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { core2ActionPolicyEnabled } from '../src/model/core2ActionPolicy.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(reg = registries) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511 });
  return createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['fellWarden'] });
}

test('new Core fights freeze action policy and round-trip it without changing their plan', () => {
  const combat = fight();
  assert.equal(combat.core2ActionRulesVersion, 1);
  assert.equal(core2ActionPolicyEnabled(combat), true);
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511), snapshot: saved });
  assert.equal(core2ActionPolicyEnabled(restored), true);
  assert.deepEqual(restored.enemies, saved.enemies);
});

test('an older active Core snapshot does not acquire the new policy on restore', () => {
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(fight())));
  delete saved.core2ActionRulesVersion;
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511), snapshot: saved });
  assert.equal(core2ActionPolicyEnabled(restored), false);
  assert.equal(Object.hasOwn(serializeCombatSnapshot(restored), 'core2ActionRulesVersion'), false);
  assert.deepEqual(restored.enemies, saved.enemies);
});

test('Current fights stay outside the Core policy and invalid saved versions are refused', () => {
  const combat = fight(createRegistries(contentBundle));
  assert.equal(Object.hasOwn(combat, 'core2ActionRulesVersion'), false);
  assert.equal(core2ActionPolicyEnabled(combat), false);
  const saved = serializeCombatSnapshot(fight());
  saved.core2ActionRulesVersion = 2;
  assert.ok(combatSnapshotProblems(saved).some(message => message.includes('core2ActionRulesVersion')));
});
