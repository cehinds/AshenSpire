import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { beginTacticalAction } from '../src/engine/combatMatchups.js';
import { combatCounterProblems } from '../src/model/combatTacticsRules.js';

test('real armed and spent v2 Counter snapshots retain authored Smash bonus without legacy return fields', () => {
  const registries = createRegistries(contentBundle), seed = 11;
  const run = createRunState({ registries, seed, classId: 'reaver' });
  run.deck.unshift({ instanceId: 'counter-save', cardId: 'shieldBash', upgraded: false });
  const rng = createRng(seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'counter-save' });
  assert.equal(combat.player.combatCounter.version, 2);
  assert.equal(combat.player.combatCounter.payload.smashPoiseBonus, 2);
  assert.equal(combat.player.combatCounter.damage, undefined);
  assert.deepEqual(combatCounterProblems(combat.player.combatCounter, 'counter'), []);
  for (const spent of [false, true]) {
    if (spent) beginTacticalAction(combat, combat.enemies[0], combat.player,
      { combatProfile: { camp: 'physical', maneuver: 'attack', reach: 'contact', targeting: 'single' } }, [{ amount: 8 }]);
    const before = rng.getCounters(), saved = serializeCombatSnapshot(combat);
    const restored = restoreCombatSnapshot({ registries, rng: createRng(seed, before), snapshot: JSON.parse(JSON.stringify(saved)) });
    assert.deepEqual(restored.player.combatCounter, JSON.parse(JSON.stringify(combat.player.combatCounter)));
    assert.equal(restored.player.combatCounter.charges, spent ? 0 : 1);
    assert.equal(restored.player.combatCounter.payload.smashPoiseBonus, 2);
    assert.deepEqual(restored.rng.getCounters(), before);
  }
});
