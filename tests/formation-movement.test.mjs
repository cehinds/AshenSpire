import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
const settings = { 'gameConfig.presentation.movementEnabled': true };
function fixture() {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 896, classId: 'reaver', registries });
  return createCombat({ registries, rng: createRng(896), enemyIds: [contentBundle.enemies[0].id], player: { ...structuredClone(run), classId: run.class, relicIds: run.relics } });
}
test('movement spends one action, emits a receipt and survives combat save/restore', () => {
  const combat = fixture();
  const energy = combat.player.energy;
  const out = dispatch(combat, { type: 'moveCharacter', cell: 'A1', settings });
  assert.equal(combat.player.formationCell, 'A1');
  assert.equal(combat.player.energy, energy - 1);
  assert(out.events.some(e => e.type === 'characterMoved' && e.to === 'A1'));
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(896), snapshot: serializeCombatSnapshot(combat) });
  assert.equal(restored.player.formationCell, 'A1');
});
test('disabled, unaffordable, invalid, occupied and out-of-turn moves do not mutate state', () => {
  for (const [cell, opts, phase, energy] of [['A1', {}, 'player', 3], ['C2', settings, 'player', 3], ['C3', settings, 'player', 3], ['Z1', settings, 'player', 3], ['A1', settings, 'enemy', 3], ['A1', settings, 'player', 0]]) {
    const combat = fixture(); combat.phase = phase; combat.player.energy = energy;
    assert.throws(() => dispatch(combat, { type: 'moveCharacter', cell, settings: opts }));
    assert.equal(combat.player.energy, energy); assert.equal(combat.player.formationCell, undefined);
  }
});
test('free movement works with zero actions', () => {
  const combat = fixture(); combat.player.energy = 0;
  dispatch(combat, { type: 'moveCharacter', cell: 'B2', settings: { ...settings, 'gameConfig.presentation.movementCostsAction': false } });
  assert.equal(combat.player.energy, 0); assert.equal(combat.player.formationCell, 'B2');
});
