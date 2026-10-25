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
import { enemyMoveSp, enemyMoveQuote, buildEnemyQueue, extendEnemyQueue } from '../src/engine/combatRoundsAdapter.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';

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

test('charge preparation pays once and its saved receipt prevents payment again on resolution', () => {
  const combat = fight('bellKeeper'), enemy = combat.enemies[0];
  const before = enemy.stamina;
  dispatch(combat, { type: 'endTurn' });
  assert.deepEqual(enemy.pendingMove.spPayment, { sp: 1, advanceSp: 0, totalSp: 1 });
  assert.equal(enemy.stamina, before - 1, 'preparation pays before granting its Block');
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const invalid = structuredClone(snapshot);
  invalid.enemies[0].pendingMove.spPayment.totalSp += 1;
  assert.ok(combatSnapshotProblems(invalid).some(message => message.includes('spPayment')));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot });
  dispatch(restored, { type: 'endTurn' });
  assert.ok(restored.pendingReaction, 'the paid charge reaches its first contact');
  assert.equal(restored.enemies[0].stamina, enemy.maxStamina, 'the resolving payload does not charge its base again');
  settle(restored);
  assert.equal(restored.enemies[0].performedMoves.filter(id => id === 'bronzeToll').length, 1);
});

test('a charged move prepays its full Advance quote without paying it again on resolution', () => {
  const combat = fight('bellKeeper'), enemy = combat.enemies[0];
  const pair = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState.engagements[pair] = 2;
  const def = registries.enemies.get(enemy.enemyId);
  const quote = enemyMoveQuote(def.moves.bronzeToll, { enemy, moveId: 'bronzeToll', combat });
  assert.ok(quote.advanceSp > 0);
  assert.ok(quote.totalSp <= enemy.maxStamina);
  dispatch(combat, { type: 'endTurn' });
  assert.equal(enemy.stamina, enemy.maxStamina - quote.totalSp);
  assert.equal(enemy.pendingMove.spPayment.totalSp, quote.totalSp);
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  assert.equal(enemy.stamina, enemy.maxStamina, 'both base and the accepted Advance were paid at preparation');
  assert.equal(enemy.performedMoves.filter(id => id === 'bronzeToll').length, 1);
});

test('an execution-time loss can refuse a charge before any preparation effects', () => {
  const combat = fight('bellKeeper'), enemy = combat.enemies[0];
  enemy.pendingStaminaLoss = enemy.maxStamina;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(enemy.pendingMove, null);
  assert.equal(enemy.stamina, 0);
  assert.ok(combat.eventLog.some(row => row.type === 'enemyMoveUnavailable' && row.moveId === 'bronzeToll'));
});

test('native enemy reaction pays on enqueue, retains payment if it fizzles, and refuses at zero SP', () => {
  for (const available of [0, 2]) {
    const combat = fight('gildedKnight'), enemy = combat.enemies[0];
    enemy.stamina = available;
    const card = combat.piles.hand.find(row => row.cardId === 'core.strike');
    assert.ok(card);
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
    const stacked = combat.eventLog.filter(row => row.type === 'combatEnemyReactionStacked');
    assert.equal(stacked.length, available ? 1 : 0);
    assert.equal(enemy.stamina, available ? 1 : 0);
    if (available) {
      assert.ok(combat.pendingReaction);
      enemy.skipNextTurn = true;
      settle(combat);
      assert.equal(enemy.stamina, 1, 'a committed reaction that fizzles does not refund its SP');
    }
  }
});

test('a native ranged enemy reaction pays base and Advance before its stacked event and never pays twice after restore', () => {
  const combat = fight('gildedKnight'), enemy = combat.enemies[0];
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
  const move = registries.enemies.get(enemy.enemyId).moves.gildedGuard;
  const quote = enemyMoveQuote(move, { enemy, moveId: 'gildedGuard', combat });
  assert.deepEqual([quote.sp, quote.advanceSp, quote.totalSp], [1, 1, 2]);
  const before = enemy.stamina, observed = [];
  // dispatch runs on a transactional candidate. Observe the real event seam
  // there, before its state is copied back to the combat object.
  const emit = combat._emitEvent;
  combat._emitEvent = (ctx, type, event) => {
    if (type === 'combatEnemyReactionStacked') {
      const actor = ctx.enemies.find(row => row.id === event.sourceId);
      observed.push({ stamina: actor.stamina, remaining: actor.fixCoreStaminaRemaining,
        payment: structuredClone(ctx.reactionStack.entries.at(-1).spPayment) });
    }
    return emit(ctx, type, event);
  };
  const card = combat.piles.hand.find(row => row.cardId === 'core.strike');
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  assert.ok(observed.length > 0);
  for (const state of observed) {
    // The player's Strike already paid and committed its Advance, so the reaction owes base SP only.
    assert.equal(state.stamina, before - quote.sp, 'the base quote is paid before the stacked event');
    assert.equal(state.remaining, state.stamina);
    assert.deepEqual(state.payment, { sp: quote.sp, advanceSp: 0, totalSp: quote.sp });
  }
  assert.ok(combat.pendingReaction);
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot });
  settle(combat); settle(restored);
  assert.equal(combat.enemies[0].stamina, before - quote.sp);
  assert.equal(restored.enemies[0].stamina, combat.enemies[0].stamina);
  assert.deepEqual(restored.enemies[0].performedMoves, combat.enemies[0].performedMoves);
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('an old active fight keeps its free enemy reaction and charge-time payment behavior', () => {
  const combat = fight('gildedKnight'), enemy = combat.enemies[0];
  delete combat.core2ActionRulesVersion;
  const card = combat.piles.hand.find(row => row.cardId === 'core.strike');
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  settle(combat);
  assert.equal(enemy.stamina, enemy.maxStamina);
  assert.ok(combat.eventLog.some(row => row.type === 'enemyMoveStarted' && row.moveId === 'gildedGuard'));
  const charge = fight('bellKeeper');
  delete charge.core2ActionRulesVersion;
  dispatch(charge, { type: 'endTurn' });
  assert.equal(charge.enemies[0].stamina, charge.enemies[0].maxStamina);
  assert.equal(charge.enemies[0].pendingMove.spPayment, undefined);
});


for (const replay of [false, true]) test(`native Core planning projects persistent Advance ${replay ? 'already accepted in its queue' : 'before selecting follow-ups'}`, () => {
  const combat = fight(), enemy = combat.enemies[0], def = registries.enemies.get(enemy.enemyId);
  const pair = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState.engagements[pair] = 1;
  enemy.maxStamina = enemy.stamina = 3;
  enemy.movesHistory = [];
  delete enemy.combatStance;
  const range = structuredClone(combat.rangeState), counters = combat.rng.getCounters();
  let index = replay ? 1 : 0;
  const moves = ['advance', 'caneStrike', 'caneStrike'];
  const queue = replay ? [{ moveId: 'advance', sp: 1 }] : [];
  extendEnemyQueue(enemy, def, queue, { combat, pick: (actor, row, available, pricing = combat) => {
    const moveId = moves[index++];
    return moveId && enemyMoveQuote(row.moves[moveId], { enemy: actor, moveId, combat: pricing }).totalSp <= available ? moveId : null;
  } });
  assert.deepEqual(queue, moves.map(moveId => ({ moveId, sp: 1 })));
  assert.deepEqual(combat.rangeState, range, 'forecasting never moves the live pair');
  assert.deepEqual(combat.rng.getCounters(), counters, 'projection consumes no extra random draws');
  assert.equal(enemy.stamina, 3);
  // Commit the accepted normal-combat plan, then resume the same snapshot.
  enemy.intent = { ...enemy.intent, kind: 'buff', moveId: 'advance' };
  enemy.plannedMoves = queue.slice(1);
  enemy.planDue = true;
  combat.player.reactionsEnabled = false;
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, counters), snapshot });
  for (const ctx of [combat, restored]) {
    dispatch(ctx, { type: 'endTurn' });
    assert.deepEqual(ctx.enemies[0].performedMoves, moves);
    assert.equal(ctx.enemies[0].stamina, 0, 'all three real one-SP actions fit the pool');
    assert.equal(ctx.rangeState.engagements[pair], 0);
    assert.equal(ctx.eventLog.filter(row => row.type === 'combatEngagementMoved').length, 1);
    assert.equal(ctx.eventLog.filter(row => row.type === 'enemyMoveUnavailable').length, 0);
  }
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('an attack approach persists: the next planned attack is not charged an Advance', () => {
  const combat = fight(), enemy = combat.enemies[0], def = registries.enemies.get(enemy.enemyId);
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 1;
  enemy.maxStamina = 4;
  enemy.movesHistory = [];
  delete enemy.combatStance;
  const queue = buildEnemyQueue(enemy, def, { combat, pick: () => 'caneStrike' });
  assert.deepEqual(queue, [{ moveId: 'caneStrike', sp: 2 }, { moveId: 'caneStrike', sp: 1 }, { moveId: 'caneStrike', sp: 1 }]);
});


test('native intent selection and acceptance use the same projected range after an owned Advance', () => {
  const original = registries.enemies.get('fellWarden');
  const def = { ...original, startingRange: 'reach', firstMove: 'advance', moves: {
    advance: original.moves.advance, caneStrike: { ...original.moves.caneStrike, weight: 100 },
  } };
  const reg = { ...registries, enemies: { ...registries.enemies, get: id => id === def.id ? def : registries.enemies.get(id) } };
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511 });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['fellWarden'] });
  const enemy = combat.enemies[0];
  assert.equal(enemy.maxStamina, 3);
  assert.equal(combat.combatRounds, undefined, 'the normal Core route owns this plan');
  assert.equal(enemy.intent.moveId, 'advance');
  assert.deepEqual(enemy.plannedMoves, [{ moveId: 'caneStrike', sp: 1 }, { moveId: 'caneStrike', sp: 1 }]);
  assert.equal(combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]], 1, 'constructing the plan does not execute Advance');
});

test('movement projection resolves authored repeat formulas without granting other effects', () => {
  const combat = fight(), enemy = combat.enemies[0], original = registries.enemies.get(enemy.enemyId);
  const def = { ...original, moves: { ...original.moves, advance: { ...original.moves.advance, effects: [
    { op: 'block', target: 'self', amount: 999 },
    { op: 'moveEngagement', target: 'enemy', bands: -1, repeat: { f: 'add', args: [1, 1] } },
  ] } } };
  combat.registries = { ...registries, enemies: { ...registries.enemies, get: id => id === enemy.enemyId ? def : registries.enemies.get(id) } };
  combat.rangeState.engagements[Object.keys(combat.rangeState.engagements)[0]] = 2;
  enemy.maxStamina = 3;
  const before = { range: structuredClone(combat.rangeState), block: enemy.block, counters: combat.rng.getCounters() };
  let index = 0;
  const queue = buildEnemyQueue(enemy, def, { combat, pick: () => ['advance', 'caneStrike', 'caneStrike'][index++] });
  assert.deepEqual(queue, [{ moveId: 'advance', sp: 1 }, { moveId: 'caneStrike', sp: 1 }, { moveId: 'caneStrike', sp: 1 }]);
  assert.deepEqual({ range: combat.rangeState, block: enemy.block, counters: combat.rng.getCounters() }, before);
});

test('a multi-hit move costs 1 SP per hit; finesse and Mana moves floor at max(hits - 1, 1) and max(hits - 2, 1) (owner, 2026-10-25)', () => {
  const combat = fight(), enemy = combat.enemies[0], def = registries.enemies.get(enemy.enemyId);
  const options = { enemy, moveId: 'hammerToss', combat };
  const hits = n => ({ ...def.moves.caneStrike, damage: undefined, sp: 1, effects: [{ op: 'damage', target: 'player', amount: 1, hits: n }] });
  assert.equal(enemyMoveSp(hits(1), options), 1);
  assert.equal(enemyMoveSp(hits(2), options), 2);
  assert.equal(enemyMoveSp(hits(3), options), 3, '3 hits cost 3 SP');
  assert.equal(enemyMoveSp(hits(5), options), 5, 'no cap');
  assert.equal(enemyMoveSp({ ...hits(3), mp: 1 }, options), 1, 'a Mana move: max(3 - 2, 1)');
  assert.equal(enemyMoveSp({ ...hits(5), mp: 1 }, options), 3, 'a Mana move: max(5 - 2, 1)');
  assert.equal(enemyMoveSp({ ...hits(3), tags: [...(hits(3).tags || []), 'finesse'] }, options), 2, 'a finesse move: max(3 - 1, 1)');
  assert.equal(enemyMoveSp({ ...hits(3), sp: 6 }, options), enemyMoveSp({ ...hits(1), sp: 6 }, options), 'an authored price above the hit count is never lowered');
  const staggered = { p: 'hasStatus', of: 'target', status: 'staggered' };
  const branches = effects => ({ ...hits(1), effects });
  assert.equal(enemyMoveSp(branches([{ op: 'damage', target: 'player', amount: 10, if: { p: 'not', pred: staggered } }, { op: 'damage', target: 'player', amount: 25, if: staggered }]), options), 1, 'an either/or pair is one hit');
  assert.equal(enemyMoveSp(branches([{ op: 'damage', target: 'player', amount: 1, hits: 3 }, { op: 'damage', target: 'player', amount: 1, hits: 3, if: staggered }]), options), 3, 'a guarded bonus volley is its own branch, not added');
});

test('an enemy that cannot afford a multi-hit move never picks it', () => {
  const combat = fight(), enemy = combat.enemies[0], def = registries.enemies.get(enemy.enemyId);
  const three = { ...def.moves.caneStrike, damage: undefined, sp: 1, weight: 1000, effects: [{ op: 'damage', target: 'player', amount: 1, hits: 3 }] };
  const crowded = { ...def, moves: { ...def.moves, tripleCut: three } };
  enemy.maxStamina = 2; enemy.movesHistory = [];
  const picked = new Set();
  for (let i = 0; i < 20; i++) for (const row of buildEnemyQueue(enemy, crowded, { combat, pick: (e, d, maxSp, pricing) => Object.keys(d.moves).find(id => id === 'tripleCut' && enemyMoveQuote(d.moves[id], { enemy: e, moveId: id, combat: pricing }).totalSp <= maxSp) ?? 'caneStrike' })) picked.add(row.moveId);
  assert.ok(!picked.has('tripleCut'), 'a 3 SP move is not queued from a 2 SP pool');
});
