import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { formationMovePlan } from '../src/model/formationMovement.js';
const settings = { 'gameConfig.presentation.movementEnabled': true };
function fixture() {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 896, classId: 'reaver', registries });
  return createCombat({ registries, rng: createRng(896), enemyIds: [contentBundle.enemies[0].id], player: { ...structuredClone(run), classId: run.class, relicIds: run.relics } });
}
// The player's own cell, read from the plan rather than hard-coded: the default
// perspective grid has three lanes, so the preferred last row F clamps to C.
const spawn = formationMovePlan(fixture(), 'A1', settings).current;
test('the player spawns on the shipped grid\'s last row', () => {
  assert.equal(spawn, 'C1');
  // A saved classicAppearance setting is ignored: the grid is the only layout.
  assert.equal(formationMovePlan(fixture(), 'A1', { ...settings, classicAppearance: true }).current, 'C1');
});
// Owner, 2026-11-05: formation movement is retired (movementEnabled and its siblings are retired
// stored keys), so a stored true no longer enables it: every move is refused and nothing mutates.
test('movement stays disabled whatever is stored: moves are refused and nothing mutates', () => {
  assert.equal(formationMovePlan(fixture(), 'A1', settings).ok, false);
  assert.match(formationMovePlan(fixture(), 'A1', settings).reason, /disabled/);
  for (const cell of ['A1', spawn, 'C3', 'Z1']) {
    const combat = fixture(); const energy = combat.player.energy;
    assert.throws(() => dispatch(combat, { type: 'moveCharacter', cell, settings }));
    assert.equal(combat.player.energy, energy); assert.equal(combat.player.formationCell, undefined);
  }
});
