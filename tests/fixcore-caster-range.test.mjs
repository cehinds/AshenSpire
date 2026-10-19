// Owner bug, 2026-10-18 (Core 2): "all my attacks to some enemies (casters) result in an automatic miss".
// Every Core starter card has no authored range, so it resolves as melee. An enemy spell or reach move gets the
// stance range 'reach', and stanceHit.js made that range a hard gate for any attacker, so 14 of 33 enemies were 0%.
// A spell stance at Reach is how a caster casts, not a held distance; a physical Reach stance (Crawling Shot) or any Far stance still holds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(enemyId, seed = 511, classId = 'reaver') {
  const run = createRunState({ registries: reg, classId, seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: [enemyId] });
}
const MANEUVERS = ['attack', 'smash', 'sweep'];
const reachEnemies = contentBundle.enemies.map(e => e.id).filter(id => {
  const stance = live(id).enemies[0].combatStance;
  return stance?.range === 'reach' && stance.camp === 'spell';
});

test('the sweep finds the spell casters the owner reported', () => {
  assert.ok(reachEnemies.includes('graveWisp') && reachEnemies.includes('wyrmAspirant'), reachEnemies.join());
});
test('a melee Core card is never a range miss against an enemy whose stance is a Reach spell', () => {
  for (const id of reachEnemies) {
    const combat = live(id), target = combat.enemies[0];
    for (const maneuver of MANEUVERS) {
      const carrier = { combatProfile: { camp: 'physical', maneuver, range: 'melee' } };
      const preview = attackHitPreview(combat, combat.player, target, carrier);
      assert.equal(preview.inRange, true, `${id} ${maneuver} preview ${preview.hitChance}% ${preview.missReason}`);
      assert.ok(preview.hitChance > 0, `${id} ${maneuver}`);
      const misses = Array.from({ length: 50 }, () => resolveAttackHit(combat, combat.player, target, carrier, { suppressOutcomeEvent: true })).filter(r => r.missReason === 'range');
      assert.equal(misses.length, 0, `${id} ${maneuver}: ${misses.length}/50 range misses`);
    }
  }
});
test('a real Strike played at a Reach-spell caster rolls Accuracy, not range', () => {
  const combat = live('graveWisp'); combat.player.energy = 9;
  const strike = [...combat.piles.hand, ...combat.piles.draw].find(card => card.cardId === 'core.strike');
  if (!combat.piles.hand.includes(strike)) { combat.piles.draw = combat.piles.draw.filter(card => card !== strike); combat.piles.hand.push(strike); }
  const n = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: combat.enemies[0].id });
  const outcome = combat.eventLog.slice(n).filter(event => event.type === 'attackHit' || event.type === 'attackMissed');
  assert.ok(outcome.length > 0);
  assert.ok(outcome.every(event => event.missReason !== 'range'), JSON.stringify(outcome.map(e => e.missReason)));
});
test('a physical Reach stance or a Far stance still keeps melee out of range', () => {
  const combat = live('wanderingSoldier'), target = combat.enemies[0];
  const carrier = { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  for (const stance of [{ maneuver: 'attack', camp: 'physical', range: 'reach' }, { maneuver: 'evade', camp: 'physical', range: 'ranged' }, { maneuver: 'casting', camp: 'spell', range: 'ranged' }]) {
    target.combatStance = stance;
    const preview = attackHitPreview(combat, combat.player, target, carrier);
    assert.equal(preview.hitChance, 0, JSON.stringify(stance)); assert.equal(preview.missReason, 'range');
  }
});
