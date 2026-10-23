import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { enemyMoveSp, enemyMoveQuote, buildEnemyQueue } from '../src/engine/combatRoundsAdapter.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(id = 'fellWarden') {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [id] });
  combat.player.hp = combat.player.maxHp = 10000;
  return combat;
}
const settle = combat => { for (let i = 0; combat.pendingReaction && i < 50; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };

test('multi-hit floors apply after discounts to authored and derived prices, including repeated effects', () => {
  const combat = fight(), enemy = combat.enemies[0], def = registries.enemies.get(enemy.enemyId);
  const options = { enemy, moveId: 'hammerToss', combat };
  assert.equal(enemyMoveSp(def.moves.hammerToss, options), 2);
  assert.equal(enemyMoveSp({ ...def.moves.caneStrike, hits: 2, sp: 0 }, options), 2);
  assert.equal(enemyMoveSp({ ...def.moves.caneStrike, hits: 1, magicShare: 0.5 }, options), 1, 'split physical/magical damage is one contact');
  assert.equal(enemyMoveSp({ ...def.moves.caneStrike, damage: undefined, effects: [{ op: 'damage', target: 'player', amount: 1, repeat: 2 }] }, options), 2);
  assert.equal(enemyMoveSp({ ...def.moves.caneStrike, damage: undefined, effects: [{ op: 'damage', target: 'player', amount: 1 }, { op: 'damage', target: 'player', amount: 1 }] }, options), 2);
  assert.equal(enemyMoveSp({ ...def.moves.caneStrike, damage: undefined, effects: [{ op: 'damage', target: 'allEnemies', amount: 1 }] }, options), 1, 'one contact per target is not multi-hit');
  delete combat.core2ActionRulesVersion;
  assert.equal(enemyMoveSp(def.moves.hammerToss, options), 1, 'an old active fight retains its old price');
});

test('native Core plans use actual maxima, include Advance and expose every committed follow-up', () => {
  for (const id of ['wanderingSoldier', 'fellWarden', 'thornMatriarch', 'ashheartDragon', 'glassRegent']) {
    const combat = fight(id), enemy = combat.enemies[0], def = registries.enemies.get(id);
    const plan = enemyPlanActions(combat, enemy);
    const entries = enemy.intent.moveId ? [enemy.intent.moveId, ...enemy.plannedMoves.map(entry => entry.moveId)] : [];
    assert.deepEqual(plan.map(entry => entry.id), entries, id);
    const total = entries.reduce((sum, moveId) => sum + enemyMoveQuote(def.moves[moveId], { enemy, moveId, combat }).totalSp, 0);
    assert.ok(total <= enemy.maxStamina, `${id}: ${entries} costs ${total}, actual pool ${enemy.maxStamina}`);
    assert.equal(enemy.stamina, enemy.maxStamina, 'forecasting spends nothing');
  }
});

test('Core rejects unaffordable forced openers and the minimum-one fallback, including pending debt', () => {
  const combat = fight(), enemy = { ...combat.enemies[0], maxStamina: 2, pendingStaminaLoss: 1, movesHistory: [] };
  const def = { ...registries.enemies.get(enemy.enemyId), firstMove: 'hammerToss', moves: { hammerToss: registries.enemies.get(enemy.enemyId).moves.hammerToss } };
  const offered = [];
  const queue = buildEnemyQueue(enemy, def, { combat, isFirstTurn: true, pick: (e, d, available) => { offered.push(available); return available >= 2 ? 'hammerToss' : null; } });
  assert.deepEqual(queue, []);
  assert.deepEqual(offered, [1]);
});

test('normal Core plans stop at the first charge', () => {
  const combat = fight('bellKeeper'), enemy = combat.enemies[0];
  assert.equal(enemy.intent.moveId, 'bronzeToll');
  assert.deepEqual(enemy.plannedMoves, []);
});

test('native reaction pause restore preserves one payment per move and committed contact order', () => {
  const combat = fight();
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.pendingReaction);
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot });
  settle(combat); settle(restored);
  const project = ctx => ({ stamina: ctx.enemies[0].stamina, remaining: ctx.enemies[0].fixCoreStaminaRemaining,
    moves: ctx.enemies[0].performedMoves, contacts: ctx.eventLog.filter(row => ['enemyMoveStarted', 'attackHit'].includes(row.type)).map(row => [row.type, row.moveId]), counters: ctx.rng.getCounters() });
  assert.deepEqual(project(restored), project(combat));
  assert.ok(combat.enemies[0].stamina >= 0);
});
