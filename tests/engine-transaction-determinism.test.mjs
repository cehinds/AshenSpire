// A seeded fight plays to the same log, state and RNG position whatever caches
// sit under the engine's per-action transaction (candidate clone, profile
// separation walk, binding queries). The pinned digests were taken before the
// transaction-cost work (docs/PERF-MOBILE-BASELINE.md fix 2); they change only
// when the rules change, never because a cache was added or removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { candidateState } from '../src/engine/combatRules.js';

function fight([seed, classId]) {
  const profile = resolveGameProfile('default');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId, seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  for (const enemy of combat.enemies) enemy.hp = enemy.maxHp = 5000;
  return combat;
}
function answerReactions(combat) {
  for (let guard = 0; combat.pendingReaction && guard < 20; guard++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
}
function play(combat, turns) {
  for (let turn = 0; turn < turns && !combat.result; turn++) {
    answerReactions(combat);
    for (const card of [...combat.piles.hand]) {
      previewCard(combat, card.instanceId);
      try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }); } catch { /* an unaffordable card is refused, as in play */ }
      if (combat.result) break;
    }
    if (!combat.result) dispatch(combat, { type: 'endTurn' });
    answerReactions(combat);
  }
  return combat;
}
const replacer = (key, value) => value instanceof Map ? { map: [...value] } : value;
export function digest(combat) {
  const data = Object.fromEntries(Object.entries(combat).filter(([key, value]) => typeof value !== 'function' && !['registries', 'rng', 'gameProfile'].includes(key)));
  const text = JSON.stringify({ data, rng: combat.rng.getCounters() }, replacer);
  return { log: createHash('sha256').update(JSON.stringify(combat.eventLog, replacer)).digest('hex').slice(0, 16),
    state: createHash('sha256').update(text).digest('hex').slice(0, 16), events: combat.eventLog.length, turn: combat.turn };
}

// Re-pinned 2026-10-31 after merging dev cf6417b4d9: the same fights on the dev tree
// (no transaction caches) give these digests, so the rules moved, not the caches.
// Core 2 accuracy: Precision = 1 + stat mix + stacks, Evasion = 8 + DEX + 2/stack moves the seeded hit rolls.
// Re-recorded again for #2434: the roll receipts add six events to each log on top of the #2436 Core 2 accuracy base (turn unchanged).
const PINNED = [
  [['PERF1', 'reaver'], { log: 'e02c9e3ed73ab0ed', state: '3955f498c6dd4ecf', events: 196, turn: 6 }],
  [[4242, 'reaver'], { log: '2b753f0dbf095cf7', state: 'b32b43c9723233a6', events: 234, turn: 6 }],
];
for (const [setup, expected] of PINNED) {
  const seed = `${setup[0]}/${setup[1]}`;
  test(`seeded fight ${seed} reproduces its log, final state and RNG position`, () => {
    const first = digest(play(fight(setup), 5));
    const second = digest(play(fight(setup), 5));
    assert.deepEqual(second, first, 'two plays of one seed agree');
    assert.ok(first.events > 40 && first.turn >= 4, 'the fight did real work');
    assert.deepEqual(first, expected, 'digest matches the pre-optimisation engine');
  });
}

test('the shared-profile decision follows the live state, not an earlier answer', () => {
  const combat = fight(['PERF1', 'reaver']);
  assert.equal(candidateState(combat, { detached: true }).gameProfile, combat.gameProfile, 'a private profile is shared');
  const key = Object.keys(combat.gameProfile.modules).find(name => combat.gameProfile.modules[name] && typeof combat.gameProfile.modules[name] === 'object');
  combat.leakedModule = combat.gameProfile.modules[key];
  const aliased = candidateState(combat, { detached: true });
  assert.notEqual(aliased.gameProfile, combat.gameProfile, 'state now aliasing a profile node is cloned with it');
  assert.equal(aliased.leakedModule, aliased.gameProfile.modules[key], 'the alias survives inside the clone');
  delete combat.leakedModule;
  assert.equal(candidateState(combat, { detached: true }).gameProfile, combat.gameProfile, 'removing the alias shares again');
});
