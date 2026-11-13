// Multi-action preview (SPEC §4.9; owner decision 2026-10-12). An enemy plans its next moves with the same weighted
// pick, seeded from the enemyAI stream, so the plan is the moves it plays. In a Core fight the intent box shows the
// current action and its follow-ups as symbols beside it at the same size; the old per-run toggle went with the combat-rounds system
// (cleanup 3i-A), so a legacy fight shows none.
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
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { enemyPlanActions, multiActionOn } from '../src/engine/normalPreview.js';
import { readFileSync } from 'node:fs';
import * as Screen from '../src/ui/models/CombatRoundsScreenModel.js';

// The fixture soldier carries stats for a pool of 3 (SPEC §4.6a: base 1, +1 Dexterity 4, +1 Constitution 4), so its plan
// holds follow-ups; the shipped soldier is a 1-SP minion (owner, 2026-10-13).
const POOL_STATS = { strength: 6, dexterity: 4, constitution: 4, wisdom: 2, intelligence: 2 };
const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === 'wanderingSoldier' ? { ...e, attributes: POOL_STATS, equipmentSp: 0 } : e)) });
const ENEMY = 'wanderingSoldier';
const SEED = 5;

// A legacy (pre-Core) fight: no multi-action preview.
function fight(_settings, { seed = SEED, enemyIds = [ENEMY] } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries });
  return createRunCombat({ registries, rng: createRng(seed), run, enemyIds, settings: {} });
}
// A Core fight: the multi-action preview is on. The Fell Warden's pool holds a follow-up (the soldier's holds one move).
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const coreContent = { ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === ENEMY ? { ...e, attributes: POOL_STATS, equipmentSp: 0 } : e)) };
const coreRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(coreContent, profile)), profile);
function coreFight({ seed = SEED, enemyIds = ['fellWarden'] } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries: coreRegistries });
  return createRunCombat({ registries: coreRegistries, rng: createRng(seed), run, enemyIds, settings: {} });
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

test('a legacy fight still plans its pool of moves (action costs are always on), but no follow-up symbol shows', () => {
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
  const c = coreFight({ seed: SEED });
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
  const c = coreFight();
  const enemy = c.enemies[0];
  const first = enemy.intent.moveId;
  const plan = enemy.plannedMoves.map((p) => p.moveId);
  assert.deepEqual(enemy.movesHistory.slice(-(plan.length + 1)), [first, ...plan], 'the head and its follow-ups were picked in play order');
});

test('the plan is shown as the enemy\'s actions: the head at full size, follow-ups as symbols, the beyond-count ones as ?', () => {
  const c = coreFight();
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
  const c = coreFight();
  const enemy = c.enemies[0];
  enemy.intent = { kind: 'staggered', moveId: null };
  assert.deepEqual(enemyPlanActions(c, enemy), []);
  enemy.intent = { kind: 'attack', moveId: 'slash' };
  enemy.alive = false;
  assert.deepEqual(enemyPlanActions(c, enemy), []);
});

test('a save keeps the plan: the restored enemy plays the same next move', () => {
  const c = coreFight();
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(SEED), snapshot: saved });
  assert.deepEqual(restored.enemies[0].plannedMoves, c.enemies[0].plannedMoves);
});

// --- The intent node carries its own follow-up symbols (combat.js followUpsFor), by mode and Perception -------------

test('the player-turn follow-up symbols follow the plan and the Perception rule, and a legacy fight has none', () => {
  const on = coreFight();
  const enemy = on.enemies[0];
  const actions = enemyPlanActions(on, enemy);
  assert.ok(actions.length >= 2, 'the fixture plans at least one follow-up');
  const unknown = actions.slice(1).map(() => ({ kind: 'unknown' }));
  assert.deepEqual(Screen.followUpSymbols(actions, 0, Screen.READ_EXACT), unknown, 'Perception 0: every follow-up is a ?');
  const one = Screen.followUpSymbols(actions, 1, Screen.READ_EXACT);
  assert.equal(one[0].kind, 'action', 'Perception 1 with an exact read: the first follow-up shows its icon');
  assert.deepEqual(one.slice(1), unknown.slice(1));
  assert.deepEqual(Screen.followUpSymbols(actions, 2, Screen.READ_HIDDEN), unknown, 'a hidden read: every follow-up is a ?');
  assert.equal(multiActionOn(fight({})), false, 'legacy: no follow-up symbols');
});

test('the rounds layer no longer appends follow-ups; the intent node draws them from the screen helper', () => {
  const layer = readFileSync(new URL('../src/ui/components/combatRoundsScreen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(layer, /cr-followup|decorateFollowUps|followUpSymbols/);
  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(screen, /function followUpsFor\(enemy\)/);
  assert.match(screen, /seed\) for \(const \[id, symbols\] of seed\)/, 'a player action snapshot freezes the follow-up rows before the dispatch');
  assert.match(screen, /disp = takeSnapshot\(false\);\s*let out;\s*try \{\s*heldTurnHand/, 'the end-turn snapshot does not seed player-turn rows');
  assert.match(screen, /if \(live \|\| enemyPlayback\) return disp\?\.ents/, 'the enemy-phase row serves only enemy phase or enemy playback');
  assert.doesNotMatch(screen, /kept != null \|\| live \|\| disp/, 'the player card playback (disp) no longer short-circuits the plan');
  assert.match(screen, /const followUps = followUpsFor\(enemy\);/, 'the intent node takes its follow-ups from the helper');
  assert.match(screen, /followUps = showIntent \? followUpsFor\(enemy\)/, 'the leading-slot key includes them, so a plan change rebuilds the node');
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
