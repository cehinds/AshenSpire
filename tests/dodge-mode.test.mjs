// The dodge reads Dexterity on the scale the run was made on (plan A3,
// mechanics.dodgeRoll.dexterityCentreByMode): a lean run centres on 3, a run
// made under an older creation mode keeps the d20-scale 10, and the mode rides
// the fight, its save and its restore.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const registries = createRegistries(contentBundle);

function fight(attributeMode) {
  const run = createRunState({ seed: 21, classId: 'rogue', registries, ...(attributeMode ? { attributeMode } : {}) });
  return { run, combat: createRunCombat({ registries, rng: createRng(21), run, enemyIds: ['wanderingSoldier'] }) };
}

test('a fight carries the creation mode its run was made under', () => {
  assert.equal(fight().combat.attributeMode, 'lean', 'the default mode');
  assert.equal(fight('standard').combat.attributeMode, 'standard');
});

test('the dodge term follows the mode: lean centres on 3, an older mode on 10', () => {
  const { framework } = registries;
  const weightClass = { evasionModifier: 0, temporaryGuardModifier: 0, dodgeStaminaCost: 1, dodgeActionCost: 0 };
  const lean = framework.dodgeRoll({ roll: 10, dexterity: 7, attributeMode: 'lean', weightClass });
  const standard = framework.dodgeRoll({ roll: 10, dexterity: 7, attributeMode: 'standard', weightClass });
  assert.equal(lean.check, 12, 'lean DEX 7 reads +2');
  assert.equal(standard.check, 8, 'standard DEX 7 reads -2, as it always did');
});

test('the mode rides a mid-fight save; an older snapshot reads the run', () => {
  const { run, combat } = fight('standard');
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  assert.equal(restoreCombatSnapshot({ registries, rng: createRng(22), snapshot: saved }).attributeMode, 'standard');
  delete saved.attributeMode;
  const older = restoreCombatSnapshot({ registries, rng: createRng(22), snapshot: saved, fallbackAttributeMode: run.attributeMode });
  assert.equal(older.attributeMode, 'standard');
});
