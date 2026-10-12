// Enemy action pool (owner decision, 2026-10-12; SPEC §4.6, §4.11): each enemy move costs SP from the action-cost
// table by its stance, an enemy spends its per-turn pool until it is empty, a move it cannot afford is not picked,
// and an enemy always plays at least one move. Normal combat and the rounds preview share the pool.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { COMBAT_ROUNDS_KEY, MULTI_ACTION_KEY } from '../src/model/combatRounds.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';

const ENEMY = 'wanderingSoldier';
const base = createRegistries(contentBundle);

// wanderingSoldier with a smash move added (tagged maneuver:smash, so it costs 2) and an optional per-enemy pool.
function registriesWith({ pool, extraMoves } = {}) {
  const orig = base.enemies;
  const enemies = {
    ...orig,
    get: (id) => {
      const def = orig.get(id);
      if (id !== ENEMY) return def;
      const moves = { ...def.moves, ...(extraMoves || {}) };
      return { ...def, moves, ...(pool === undefined ? {} : { spPool: pool }) };
    },
  };
  return { ...base, enemies };
}

const SMASH = { intent: 'attack', damage: 9, weight: 40, maxConsecutive: 1, tags: ['maneuver:smash'] };

function fight({ reg = base, seed = 5, settings = {}, rounds = false } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries: reg, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: rounds, ...settings } } });
  return createRunCombat({ registries: reg, rng: createRng(seed), run, enemyIds: [ENEMY], settings: {} });
}

const planOf = (enemy) => [enemy.intent.moveId, ...(enemy.plannedMoves ?? []).map((e) => e.moveId)];
const spentOf = (plan, reg) => plan.reduce((sum, id) => sum + Rounds.enemyMoveSp(reg.enemies.get(ENEMY).moves[id]), 0);

test('a move costs SP from the table by its stance; an untagged move costs the 1 SP default', () => {
  const def = base.enemies.get(ENEMY);
  assert.equal(Rounds.enemyMoveSp({ intent: 'attack', damage: 5 }), 1, 'attack');
  assert.equal(Rounds.enemyMoveSp({ intent: 'block', block: 4 }), 1, 'block');
  assert.equal(Rounds.enemyMoveSp(SMASH), 2, 'smash');
  assert.equal(Rounds.enemyMoveSp({ intent: 'attack', damage: 5, tags: ['maneuver:sweep'] }), 2, 'sweep');
  assert.equal(Rounds.enemyMoveSp({ intent: 'attack', damage: 5, tags: ['maneuver:counter'] }), 2, 'counter');
  assert.equal(Rounds.enemyMoveSp({ intent: 'buff', effects: [] }), 1, 'an unclassified move keeps the 1 SP default');
  assert.equal(Rounds.enemyMoveSp({ intent: 'attack', damage: 5, sp: 3 }), 3, 'a move that says its own sp keeps it');
  assert.ok(def.moves.slash, 'fixture: the soldier has a slash');
});

test('the enemy pool is 2 by default, and a per-enemy spPool overrides it', () => {
  assert.equal(Rounds.enemyPool(base.enemies.get(ENEMY)), 2);
  assert.equal(Rounds.enemyPool({ spPool: 4 }), 4);
  assert.equal(Rounds.enemyPool({ spPool: 0 }), 0, 'a zero pool is a real override');
});

test('an enemy spends its pool until it is empty, deterministically for a seed', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  const def = reg.enemies.get(ENEMY);
  for (const seed of [1, 2, 3, 7, 11, 19, 42, 99]) {
    const runOnce = () => {
      const rng = createRng(seed);
      const enemy = { movesHistory: [] };
      const queue = Rounds.buildEnemyQueue(enemy, def, { pick: (e, d, maxSp) => pickWithin(d, maxSp, rng) });
      return queue.map((q) => q.moveId);
    };
    const first = runOnce();
    assert.deepEqual(runOnce(), first, `seed ${seed} repeats`);
    const spent = first.reduce((sum, id) => sum + Rounds.enemyMoveSp(def.moves[id]), 0);
    assert.equal(spent, 2, `seed ${seed} spends its pool of 2 exactly, got ${first}`);
  }
});

// The real weighted pick over the affordable moves, from a seeded stream: a stand-in for combat.js's
// weightedMovePick, used only to check the pool's spend rule.
function pickWithin(def, maxSp, rng) {
  const entries = Object.entries(def.moves).filter(([, m]) => Rounds.enemyMoveSp(m) <= maxSp);
  if (!entries.length) return null;
  const total = entries.reduce((a, [, m]) => a + m.weight, 0);
  let r = rng.float('enemyAI') * total;
  for (const [id, m] of entries) { r -= m.weight; if (r < 0) return id; }
  return entries[entries.length - 1][0];
}

test('a move costing more than the remaining pool is never picked; the 2-cost move only ever fills an empty pool', () => {
  const reg = registriesWith({ extraMoves: { crush: { ...SMASH, weight: 1000 } } });
  const combat = fight({ reg });
  for (const enemy of combat.enemies.filter((e) => e.alive)) {
    const plan = planOf(enemy);
    assert.ok(spentOf(plan, reg) <= 2, `${plan} fits the pool`);
    const at = plan.indexOf('crush');
    if (at >= 0) assert.equal(plan.length, at + 1, 'a smash ends the plan, it is never followed by a 1-SP move it cannot afford');
  }
});

test('the minimum of one move: an enemy whose pool is below every move cost still plays one move', () => {
  const reg = registriesWith({ pool: 1, extraMoves: { crush: SMASH } });
  const enemyDef = { ...reg.enemies.get(ENEMY), moves: { crush: SMASH } };
  // The pick is offered only the affordable moves: with a 1-SP pool nothing is affordable (null), so the enemy
  // takes the minimum-one fallback, an unlimited pick (maxSp Infinity).
  const offered = [];
  const queue = Rounds.buildEnemyQueue({ movesHistory: [] }, enemyDef, { pick: (e, d, maxSp) => { offered.push(maxSp); return maxSp >= 2 ? 'crush' : null; } });
  assert.deepEqual(offered, [1, Infinity], 'the affordable pick found nothing, then the fallback asked with no limit');
  assert.equal(queue.length, 1, 'one move, though a 2-SP move is more than the 1-SP pool');
  assert.equal(queue[0].moveId, 'crush');
});

test('normal combat: the intent is the first move, and follow-ups show only with the multi-action toggle', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  const off = fight({ reg, seed: 9 });
  const offEnemy = off.enemies[0];
  assert.ok(offEnemy.intent.moveId, 'the enemy has a first move');
  assert.equal(enemyPlanActions(off, offEnemy).length, 0, 'toggle off: no follow-up symbols');
  assert.equal(spentOf(planOf(offEnemy), reg), 2, 'toggle off: the follow-ups are planned all the same, and held back from the box');
  const on = fight({ reg, seed: 9, settings: { [MULTI_ACTION_KEY]: true } });
  const onEnemy = on.enemies[0];
  assert.equal(onEnemy.intent.moveId, off.enemies[0].intent.moveId, 'the same first move with or without the toggle');
  const shown = enemyPlanActions(on, onEnemy);
  assert.equal(shown[0].id, onEnemy.intent.moveId, 'the first shown symbol is the main intent');
  assert.equal(shown.length, planOf(onEnemy).length, 'toggle on: every planned move is a symbol');
});

test('normal combat: an enemy plays every move of its pool in its turn, one at a time, and reveals each as it plays', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  const combat = fight({ reg, seed: 13 });
  const planned = combat.enemies.map((e) => planOf(e));
  assert.ok(planned.every((p) => spentOf(p, reg) === 2), `every plan spends the pool of 2: ${JSON.stringify(planned)}`);
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  combat.enemies.forEach((enemy, i) => {
    if (!enemy.alive) return;
    assert.deepEqual(enemy.performedMoves.slice(-planned[i].length), planned[i], `${enemy.id} played its plan in order`);
  });
});

test('rounds mode uses the same pool: the rounds enemy SP is the pool, and each queue fits it', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  assert.equal(Rounds.ENEMY_SP, 2);
  const combat = fight({ reg, seed: 5, rounds: true });
  for (const enemy of combat.enemies.filter((e) => e.alive)) {
    const queue = combat.combatRounds.enemyQueues[enemy.id];
    assert.ok(queue.length >= 1, 'at least one move');
    assert.ok(queue.reduce((s, q) => s + q.sp, 0) <= 2, 'within the pool of 2');
  }
});

test('save and restore mid-turn keeps the enemy plan and the intent', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  const combat = fight({ reg, seed: 21 });
  const before = combat.enemies.map((e) => ({ intent: e.intent, plannedMoves: e.plannedMoves ?? [] }));
  assert.ok(before.every((b) => b.plannedMoves.length >= 1), 'fixture: each enemy holds planned follow-ups mid-turn');
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: reg, rng: createRng(21), snapshot: saved });
  restored.enemies.forEach((e, i) => {
    assert.deepEqual(e.intent, before[i].intent, 'the intent survives');
    assert.deepEqual(e.plannedMoves ?? [], before[i].plannedMoves, 'the planned follow-ups survive');
  });
});
