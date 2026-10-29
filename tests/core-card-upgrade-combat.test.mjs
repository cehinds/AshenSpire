// Card upgrades 4/7: stored steps survive state validation, combat start and the snapshot, and combat plays what the face shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { upgradeStepsProblems } from '../src/model/cardUpgrade.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';

const STEPS = [{ k: 'authored' }, { k: 'dmg', n: 3 }];

test('upgradeStepsProblems: absent is fine; unknown kinds, bad fields, cap and consistency are refused', () => {
  const p = (card) => upgradeStepsProblems(card, 'deck[0]');
  assert.deepEqual(p({ upgraded: false }), []);
  assert.deepEqual(p({ upgraded: true, upgradeSteps: STEPS }), []);
  assert.match(p({ upgraded: true, upgradeSteps: 'x' })[0], /must be an array/);
  assert.match(p({ upgraded: true, upgradeSteps: [{ k: 'bogus' }] })[0], /known step kind/);
  assert.match(p({ upgraded: true, upgradeSteps: [{ k: 'dmg' }] })[0], /\.n is not valid/);
  assert.match(p({ upgraded: true, upgradeSteps: [{ k: 'dmg', n: 1 }, { k: 'authored' }] })[0], /first step/);
  assert.match(p({ upgraded: true, upgradeSteps: [{ k: 'cost', pool: 'xp' }] })[0], /pool/);
  assert.match(p({ upgraded: false, upgradeSteps: STEPS })[0], /requires upgraded/);
  assert.match(p({ upgraded: true, upgradeSteps: Array.from({ length: 11 }, () => ({ k: 'dmg', n: 1 })) })[0], /at most 10/);
});

import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

// A real Core combat whose deck's first Strike carries `upgradeSteps`; every pile is then searched for it.
function fightWith(upgradeSteps) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const index = run.deck.findIndex((c) => c.cardId === 'core.strike');
  Object.assign(run.deck[index], { upgraded: true, ...(upgradeSteps ? { upgradeSteps } : {}) });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const all = () => Object.values(combat.piles).flat();
  return { run, combat, card: () => all().find((c) => c.instanceId === run.deck[index].instanceId) };
}

test('combat start copies upgradeSteps onto the combat card (a fresh copy)', () => {
  const { run, card } = fightWith(STEPS);
  assert.deepEqual(card().upgradeSteps, STEPS);
  assert.notEqual(card().upgradeSteps, run.deck.find((c) => c.instanceId === card().instanceId).upgradeSteps);
  assert.equal(fightWith(null).card().upgradeSteps, undefined, 'a card without steps gains no field');
});

test('combat plays exactly the face the steps give', () => {
  const play = (upgradeSteps) => {
    const { combat, card } = fightWith(upgradeSteps);
    const instance = card();
    for (const pile of Object.values(combat.piles)) { const at = pile.indexOf(instance); if (at >= 0) pile.splice(at, 1); }
    combat.piles.hand.push(instance);
    const enemy = combat.enemies[0];
    Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, persistentPoise: { value: 0, max: 0 } });
    combat.player.stamina = combat.player.maxStamina = 20;
    primeAccuracyRolls(combat, { count: 3 });
    const face = resolveCombatCard(combat, instance);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: enemy.id });
    return { hit: combat.eventLog.slice(start).find((e) => e.type === 'damageDealt' && e.targetId === enemy.id), face };
  };
  const faceAmount = (r) => r.face.effects.find((e) => e.op === 'damage').amount;
  const authored = play([{ k: 'authored' }]), more = play(STEPS), rolled = play([{ k: 'dmg', n: 3 }]);
  assert.equal(faceAmount(more), faceAmount(authored) + 3);
  assert.equal(faceAmount(rolled), faceAmount(play([{ k: 'dmg', n: 0 }])) + 3, 'a rolled first step starts from the base');
  // Attribute bonuses add the same flat amount to every copy, so dealt - face is constant: combat plays the face.
  const offset = authored.hit.amount - faceAmount(authored);
  for (const r of [authored, more, rolled]) assert.equal(r.hit.amount - faceAmount(r), offset, 'dealt damage tracks the face');
  assert.ok(more.hit.amount > authored.hit.amount);
});

test('steps survive a combat snapshot round trip and the validator checks them', () => {
  const { combat, card } = fightWith(STEPS);
  const saved = serializeCombatSnapshot(combat);
  assert.deepEqual(combatSnapshotProblems(saved), []);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(5), snapshot: saved });
  assert.deepEqual(Object.values(restored.piles).flat().find((c) => c.instanceId === card().instanceId).upgradeSteps, STEPS);
  const pile = Object.keys(saved.piles).find((name) => saved.piles[name].some((c) => c.instanceId === card().instanceId));
  saved.piles[pile].find((c) => c.instanceId === card().instanceId).upgradeSteps = [{ k: 'bogus' }];
  assert.ok(combatSnapshotProblems(saved).some((p) => p.includes('upgradeSteps')));
});
