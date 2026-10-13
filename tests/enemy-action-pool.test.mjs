// Enemy action pool (owner decisions, 2026-10-12; SPEC §4.6a, §4.11): each enemy move costs its own `sp`, else SP from
// the action-cost table by its stance; an enemy's per-turn pool is its stats (the stamina row on its attributes, plus
// its equipment SP; 3 with no stats), it spends the pool until it is empty, a move it cannot afford is not picked, and
// it always plays at least one move. Normal combat and the rounds preview share the pool.
// Replaced rule: a flat pool of 2 (ENEMY_SP_POOL); the expectations that read 2 now read the stat pool, 3.
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
// The fixture soldier carries Dexterity 4 and Constitution 4: a pool of 3 (ENEMY_SP_ROW base 1, +1, +1), so the pool's
// spending rules have room to show. The shipped soldier is a 1-SP minion (owner, 2026-10-13).
const POOL = 3;
const FIXTURE_STATS = { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 };

// wanderingSoldier with a smash move added (tagged maneuver:smash, so it costs 2) and an optional per-enemy pool.
function registriesWith({ pool, extraMoves } = {}) {
  const orig = base.enemies;
  const enemies = {
    ...orig,
    get: (id) => {
      const def = orig.get(id);
      if (id !== ENEMY) return def;
      const moves = { ...def.moves, ...(extraMoves || {}) };
      return { ...def, attributes: FIXTURE_STATS, moves, ...(pool === undefined ? {} : { spPool: pool }) };
    },
  };
  return { ...base, enemies };
}

const SMASH = { intent: 'attack', damage: 9, weight: 40, maxConsecutive: 1, tags: ['maneuver:smash'] };

function fight({ reg = registriesWith(), seed = 5, settings = {}, rounds = false } = {}) {
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

test('the enemy pool is its stats, and a fixture spPool overrides it', () => {
  assert.equal(Rounds.enemyPool(base.enemies.get(ENEMY)), 1, 'the shipped soldier is a 1-SP minion');
  assert.equal(Rounds.enemyPool(registriesWith().enemies.get(ENEMY)), POOL, 'the fixture soldier');
  assert.equal(Rounds.enemyPool({ attributes: { dexterity: 8, constitution: 8 } }), 1 + 2 + 2, 'dexterity and constitution weigh 0.25 each');
  assert.equal(Rounds.enemyPool({ attributes: { dexterity: 8 }, equipmentSp: 1 }), 1 + 2 + 1, 'equipment SP adds on top');
  assert.equal(Rounds.enemyPool({ attributes: { strength: 20 } }), 1, 'strength is not on the SP row');
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
    assert.equal(spent, POOL, `seed ${seed} spends its pool of ${POOL} exactly, got ${first}`);
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

test('a move costing more than the remaining pool is never picked: a 2-SP smash fits only with 2 SP left', () => {
  const reg = registriesWith({ extraMoves: { crush: { ...SMASH, weight: 1000 } } });
  for (const seed of [5, 6, 7, 8]) {
    const combat = fight({ reg, seed });
    for (const enemy of combat.enemies.filter((e) => e.alive)) {
      const plan = planOf(enemy);
      assert.ok(spentOf(plan, reg) <= POOL, `${plan} fits the pool`);
      let left = POOL;
      for (const id of plan) {
        const sp = Rounds.enemyMoveSp(reg.enemies.get(ENEMY).moves[id]);
        assert.ok(sp <= left, `${id} (${sp} SP) is picked only with ${sp} SP left, had ${left}: ${plan}`);
        left -= sp;
      }
    }
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
  assert.equal(spentOf(planOf(offEnemy), reg), POOL, 'toggle off: the follow-ups are planned all the same, and held back from the box');
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
  assert.ok(planned.every((p) => spentOf(p, reg) === POOL), `every plan spends the pool of ${POOL}: ${JSON.stringify(planned)}`);
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  combat.enemies.forEach((enemy, i) => {
    if (!enemy.alive) return;
    assert.deepEqual(enemy.performedMoves.slice(-planned[i].length), planned[i], `${enemy.id} played its plan in order`);
  });
});

test('rounds mode uses the same pool: the rounds enemy SP is the pool, and each queue fits it', () => {
  const reg = registriesWith({ extraMoves: { crush: SMASH } });
  assert.equal(Rounds.enemyPool(reg.enemies.get(ENEMY)), POOL);
  const combat = fight({ reg, seed: 5, rounds: true });
  for (const enemy of combat.enemies.filter((e) => e.alive)) {
    const queue = combat.combatRounds.enemyQueues[enemy.id];
    assert.ok(queue.length >= 1, 'at least one move');
    assert.ok(queue.reduce((s, q) => s + q.sp, 0) <= POOL, `within the pool of ${POOL}`);
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
