import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';

// Initialize through shipped main: a direct engine entry and native ESM both
// hide the reaction -> adapter cycle's captured, partially initialized imports.
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = require('src/model/gameProfile.js');
const { createRunState } = require('src/model/state.js');
const { createRng } = require('src/engine/rng.js');
const { createRunCombat } = require('src/engine/runCombat.js');
const { dispatch } = require('src/engine/combat.js');
const { enemyMoveQuote } = require('src/engine/combatRoundsAdapter.js');
const { enemyPlanActions } = require('src/engine/normalPreview.js');
const { serializeCombatSnapshot, restoreCombatSnapshot } = require('src/engine/combatSnapshot.js');
const plain = value => JSON.parse(JSON.stringify(value));
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(id) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: `bundled-policy1-${id}` });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [id] });
  assert.equal(combat.core2ActionRulesVersion, 2, 'exercise the new policy, not Current or an old active fight');
  return combat;
}
function settle(combat) {
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 30, 'native reaction continuation terminates');
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
}

test('bundled policy1 enemy reaction pays base at commit (after the player Advance persisted) and survives restore without double payment', () => {
  const combat = fight('gildedKnight'), enemy = combat.enemies[0];
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
  const quote = enemyMoveQuote(registries.enemies.get(enemy.enemyId).moves.gildedGuard, { enemy, moveId: 'gildedGuard', combat });
  assert.deepEqual([quote.sp, quote.advanceSp, quote.totalSp], [1, 1, 2]);
  const observed = [], emit = combat._emitEvent;
  combat._emitEvent = (ctx, type, event) => {
    if (type === 'combatEnemyReactionStacked') observed.push({
      stamina: ctx.enemies.find(row => row.id === event.sourceId).stamina,
      payment: plain(ctx.reactionStack.entries.at(-1).spPayment),
    });
    return emit(ctx, type, event);
  };
  const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  assert.ok(observed.length, 'the actual bundled reaction was committed');
  // The player's own Strike paid its Advance first and committed distance 0, so the reaction owes none.
  for (const state of observed) assert.deepEqual(state, { stamina: 1, payment: { sp: 1, advanceSp: 0, totalSp: 1 } });
  assert.ok(combat.pendingReaction);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot: plain(serializeCombatSnapshot(combat)) });
  settle(combat); settle(restored);
  assert.equal(enemy.stamina, 1);
  assert.equal(restored.enemies[0].stamina, 1);
  assert.ok(enemy.performedMoves.includes('gildedGuard'), 'the paid reaction actually resolves');
  assert.deepEqual(plain(restored.enemies[0].performedMoves), plain(enemy.performedMoves));
  assert.deepEqual(plain(restored.rng.getCounters()), plain(combat.rng.getCounters()));
});

test('bundled policy1 authored charge prepays its full range quote and resolves exactly once', () => {
  const combat = fight('bellKeeper'), enemy = combat.enemies[0];
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 2;
  const quote = enemyMoveQuote(registries.enemies.get(enemy.enemyId).moves.bronzeToll, { enemy, moveId: 'bronzeToll', combat });
  assert.ok(quote.advanceSp > 0);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(enemy.stamina, enemy.maxStamina - quote.totalSp);
  assert.deepEqual(plain(enemy.pendingMove.spPayment), { sp: quote.sp, advanceSp: quote.advanceSp, totalSp: quote.totalSp });
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot: plain(serializeCombatSnapshot(combat)) });
  dispatch(restored, { type: 'endTurn' });
  settle(restored);
  assert.equal(restored.enemies[0].stamina, enemy.maxStamina);
  assert.equal(restored.enemies[0].performedMoves.filter(id => id === 'bronzeToll').length, 1);
});

test('bundled policy1 Fell Warden exposes and executes its affordable committed queue through the paid charge', () => {
  const combat = fight('fellWarden'), enemy = combat.enemies[0];
  combat.normalPreview = { ...combat.normalPreview, multiAction: false };
  const before = JSON.stringify({ enemy, counters: combat.rng.getCounters() });
  const plan = enemyPlanActions(combat, enemy);
  assert.deepEqual(plain(plan.map(row => [row.id, row.sp])), [['caneStrike', 1], ['caneStrike', 1], ['heldBlade', 1]]);
  assert.equal(JSON.stringify({ enemy, counters: combat.rng.getCounters() }), before, 'quoting neither spends nor draws');
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  assert.deepEqual(plain(enemy.performedMoves), ['caneStrike', 'caneStrike']);
  assert.equal(enemy.pendingMove.moveId, 'heldBlade');
  assert.equal(enemy.pendingMove.spPayment.totalSp, 1);
  assert.equal(enemy.stamina, 0);
});
