// Multi-action preview (SPEC §4.9, §4.11; owner decision 2026-10-12). In normal combat an enemy plans its next moves
// with the same weighted pick, seeded from the enemyAI stream, so the plan is the moves it plays. The intent box
// shows the current action and its follow-ups as smaller symbols. In rounds mode the follow-ups follow their toggle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { controlRestrictions } from '../src/engine/combatStatusControl.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { COMBAT_ROUNDS_KEY, MOMENTUM_KEY, MULTI_ACTION_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { enemyPlanActions, multiActionOn } from '../src/engine/normalPreview.js';
import { decorateCombatRoundsScreen } from '../src/ui/components/combatRoundsScreen.js';
import * as Screen from '../src/ui/models/CombatRoundsScreenModel.js';

// The fixture soldier carries stats for a pool of 3 (SPEC §4.6a: base 1, +1 Dexterity 4, +1 Constitution 4), so its plan
// holds follow-ups; the shipped soldier is a 1-SP minion (owner, 2026-10-13).
const POOL_STATS = { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 };
const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === 'wanderingSoldier' ? { ...e, attributes: POOL_STATS } : e)) });
const ENEMY = 'wanderingSoldier';
const SEED = 5;

function fight(settings, { seed = SEED, enemyIds = [ENEMY] } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries, profileMeta: { settings } });
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds, settings: {} });
}
// Ends the player's turn and answers any reaction pause the enemy phase raises (declined).
function endTurn(c) {
  dispatch(c, { type: 'endTurn' });
  while (c.pendingReaction) dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
}

test('the plan is picked to the SP pool: as many moves as one enemy SP pool holds (SPEC §4.6a), each recorded in its history', () => {
  const enemy = { id: 'e1', movesHistory: [] };
  const def = { attributes: POOL_STATS, moves: { a: { weight: 1 }, b: { weight: 1, sp: 2 } } };
  const picks = ['a', 'a', 'b'];
  const queue = Rounds.extendEnemyQueue(enemy, def, [], { pick: () => picks.shift() });
  assert.deepEqual(queue.map((e) => e.moveId), ['a', 'a'], 'a 2-SP move does not fit after two 1-SP moves');
  assert.deepEqual(enemy.movesHistory, ['a', 'a'], 'each pick is recorded as it is made');
  const more = Rounds.extendEnemyQueue(enemy, def, queue, { pick: () => 'a' });
  assert.equal(more, queue, 'an existing plan is extended in place');
  assert.equal(more.length, 3, 'a pool of 3 holds three 1-SP moves (the replaced rule was a flat 2)');
});

test('with the toggle off, the pool still plans its moves (action costs are always on), but no follow-up symbol shows', () => {
  const c = fight({});
  assert.equal(multiActionOn(c), false);
  for (const enemy of c.enemies) {
    const plan = [enemy.intent.moveId, ...(enemy.plannedMoves ?? []).map((p) => p.moveId)];
    const spent = plan.reduce((sum, id) => sum + Rounds.enemyMoveSp(registries.enemies.get(enemy.enemyId).moves[id]), 0);
    assert.equal(spent, Rounds.enemyPool(registries.enemies.get(enemy.enemyId)), 'the plan spends the pool, so the enemy plays it all in its turn');
  }
  assert.deepEqual(enemyPlanActions(c, c.enemies[0]), []);
});

test('the planned moves are the moves the enemy plays, in order, turn after turn', () => {
  // Owner 2026-10-12: an enemy spends its pool in its turn, so the head and every follow-up play in the enemy phase,
  // in plan order. Each turn's performed moves are the plan the enemy held when the turn began.
  const c = fight({ [MULTI_ACTION_KEY]: true }, { seed: SEED });
  const enemy = c.enemies[0];
  assert.ok(Array.isArray(enemy.plannedMoves) && enemy.plannedMoves.length >= 1, 'the first roll plans the follow-ups');
  let turns = 0;
  for (let turn = 0; turn < 6 && !c.result; turn++) {
    const live = c.enemies.find((e) => e.alive);
    if (!live) break;
    const plan = [live.intent.moveId, ...live.plannedMoves.map((p) => p.moveId)];
    const before = live.performedMoves?.length ?? 0;
    endTurn(c);
    const played = (live.performedMoves ?? []).slice(before);
    assert.ok(played.length >= 1, `turn ${turn}: the enemy plays at least one move`);
    assert.deepEqual(played, plan.slice(0, played.length), `turn ${turn}: the plan plays in order`);
    turns++;
  }
  assert.ok(turns >= 3, 'the fixture plays several turns');
  // The intent is the move that plays: the moves the event log records as started are the moves performed, in order.
  const started = c.eventLog.filter((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id).map((e) => e.moveId);
  assert.deepEqual(started, enemy.performedMoves, 'every move the enemy starts is one it performed, in order');
});

test('the planned moves are the weighted picks from the enemyAI stream, so the plan is what the enemy will do', () => {
  const c = fight({ [MULTI_ACTION_KEY]: true });
  const enemy = c.enemies[0];
  const first = enemy.intent.moveId;
  const plan = enemy.plannedMoves.map((p) => p.moveId);
  assert.deepEqual(enemy.movesHistory.slice(-(plan.length + 1)), [first, ...plan], 'the head and its follow-ups were picked in play order');
});

test('the plan is shown as the enemy\'s actions: the head at full size, follow-ups as symbols, the beyond-count ones as ?', () => {
  const c = fight({ [MULTI_ACTION_KEY]: true });
  const enemy = c.enemies[0];
  const actions = enemyPlanActions(c, enemy);
  assert.equal(actions.length, 1 + enemy.plannedMoves.length, 'the current action and every planned follow-up');
  assert.equal(actions[0].id, enemy.intent.moveId);
  const followUps = Screen.followUpSymbols(actions, 1, Screen.READ_EXACT);
  assert.equal(followUps[0].kind, 'action', 'one perception shows the first follow-up');
  if (followUps.length > 1) assert.equal(followUps[1].kind, 'unknown', 'past the read count it shows ?');
  assert.deepEqual(Screen.followUpSymbols(actions, 9, Screen.READ_HIDDEN).map((s) => s.kind), followUps.map(() => 'unknown'), 'a hidden read shows ?');
});

test('a staggered enemy shows no plan; a dead enemy shows none either', () => {
  const c = fight({ [MULTI_ACTION_KEY]: true });
  const enemy = c.enemies[0];
  enemy.intent = { kind: 'staggered', moveId: null };
  assert.deepEqual(enemyPlanActions(c, enemy), []);
  enemy.intent = { kind: 'attack', moveId: 'slash' };
  enemy.alive = false;
  assert.deepEqual(enemyPlanActions(c, enemy), []);
});

test('a save keeps the plan: the restored enemy plays the same next move', () => {
  const c = fight({ [MULTI_ACTION_KEY]: true });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(SEED), snapshot: saved });
  assert.deepEqual(restored.enemies[0].plannedMoves, c.enemies[0].plannedMoves);
});

// --- The decorator: follow-up symbols in the intent box, by mode -------------------------------

function fakeDom(combat) {
  const made = [];
  const intentEl = { children: [], append(n) { this.children.push(n); } };
  const box = { querySelector: (sel) => (sel === '.intent' ? intentEl : null), querySelectorAll: () => [] };
  const root = {
    dataset: {},
    querySelectorAll: () => [],
    querySelector: (sel) => (sel.startsWith('.combatant.enemy') ? box : null),
  };
  globalThis.CSS = { escape: (s) => String(s) };
  globalThis.document = { createElement: () => { const node = { children: [], dataset: {}, className: '', textContent: '', append(n) { this.children.push(n); }, setAttribute() {} }; made.push(node); return node; } };
  return { root, intentEl, made, combat };
}
function decorate(combat) {
  const dom = fakeDom(combat);
  decorateCombatRoundsScreen(dom.root, combat, { targetedId: combat.enemies[0].id });
  return dom;
}
const followUpCount = (dom) => {
  const wrap = dom.intentEl.children.find((n) => n.className === 'cr-followups');
  return wrap ? wrap.children.length : 0;
};

test('the decorator draws the follow-ups of a normal fight whose multi-action toggle is on, and nothing when off', () => {
  const on = fight({ [MULTI_ACTION_KEY]: true });
  assert.equal(followUpCount(decorate(on)), on.enemies[0].plannedMoves.length);
  const off = fight({});
  assert.equal(followUpCount(decorate(off)), 0, 'off: no follow-up symbols');
});

test('rounds mode: follow-ups follow the rounds toggle, not the rounds queue being there', () => {
  const rounds = (multi) => fight({ [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: false, [MULTI_ACTION_KEY]: multi });
  const withFollowUps = rounds(true);
  const queueLength = withFollowUps.combatRounds.enemyQueues[withFollowUps.enemies[0].id].length;
  assert.equal(followUpCount(decorate(withFollowUps)), queueLength - 1, 'toggle on: every rounds follow-up shows');
  const without = rounds(false);
  assert.equal(without.combatRounds.rules.followUps, false);
  assert.equal(followUpCount(decorate(without)), 0, 'toggle off: the rounds queue is still there, but no follow-ups show');
});

// --- PR #1953 review: a stagger or Control lock that lands mid-turn ends the plan for that turn ---------------

// Ends the turn with `land(ctx, enemy)` run once, when the enemy's first move starts (a Counter, thorns or any other
// mid-turn break would land there). Hooks the event bus every candidate copies, so it reaches the live enemy.
// Returns the enemy's intent kind at the turn's end and the moves it started after the hook.
function endTurnLandingMidTurn(c, land) {
  const real = c._emitEvent;
  let landed = false;
  let after = null;
  let intentAtEnd = null;
  c._emitEvent = (ctx, type, payload) => {
    const out = real(ctx, type, payload);
    const enemy = ctx.enemies[0];
    if (type === 'enemyMoveStarted' && payload.sourceId === enemy.id) {
      if (landed) after.push(payload.moveId);
      else { landed = true; after = []; land(ctx, enemy); }
    }
    if (type === 'enemyTurnEnd') intentAtEnd = enemy.intent?.kind ?? null;
    return out;
  };
  try { endTurn(c); } finally { c._emitEvent = real; }
  return { landed, after, intentAtEnd };
}

test('normal combat: a stagger that lands during the enemy\'s first move plays none of the rest of its plan that turn', () => {
  const c = fight({});
  const before = c.enemies[0].plannedMoves.map((p) => p.moveId);
  assert.ok(before.length >= 1, 'fixture: the enemy has planned follow-ups');
  const { landed, after, intentAtEnd } = endTurnLandingMidTurn(c, (ctx, enemy) => {
    // What a Poise break does (combatRatings.js applyRatingImpact).
    enemy.skipNextTurn = true;
    enemy.pendingMove = null;
    enemy.intent = { kind: 'staggered', moveId: null };
  });
  assert.equal(landed, true, 'fixture: the enemy started its first move');
  assert.deepEqual(after, [], 'no follow-up starts after the stagger (SPEC §4.6a)');
  assert.equal(intentAtEnd, 'staggered', 'the Staggered intent is not overwritten by a follow-up');
  const enemy = c.enemies[0];
  assert.deepEqual(enemy.plannedMoves.map((p) => p.moveId), before, 'the staggered enemy keeps its plan (SPEC §4.11)');
  assert.equal(enemy.skipNextTurn, true, 'the stagger landed after it acted, so it carries to its next turn');
  assert.equal(enemy.pendingMove, null, 'no follow-up started a charge');
});

test('normal combat: a Control lock that lands during the enemy\'s first move ends its plan for that turn', () => {
  const c = fight({});
  const before = c.enemies[0].plannedMoves.map((p) => p.moveId);
  assert.ok(before.length >= 1, 'fixture: the enemy has planned follow-ups');
  let locked = false;
  const { landed, after } = endTurnLandingMidTurn(c, (ctx, enemy) => {
    applyStatus(ctx, enemy, 'paralysis', 1, ctx.player);
    locked = controlRestrictions(ctx, enemy).locked;
  });
  assert.equal(landed, true, 'fixture: the enemy started its first move');
  assert.equal(locked, true, 'fixture: Paralysis locks the enemy');
  assert.deepEqual(after, [], 'a locked enemy starts no follow-up');
  // A held enemy keeps its plan (SPEC §4.11): the next roll's head is the first follow-up it did not play.
  const enemy = c.enemies[0];
  assert.equal(enemy.intent.moveId, before[0], 'its follow-ups were not spent: the next turn opens with the first one');
  assert.deepEqual(enemy.plannedMoves.map((p) => p.moveId).slice(0, before.length - 1), before.slice(1), 'and the rest follow in order');
});
