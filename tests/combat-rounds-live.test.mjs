// Combat Rounds Preview, solo adapter (SPEC §4.11, PREVIEW-PLAN P3a): queueing, unqueueing, the
// End Turn commit that runs the timeline with live effects, and the preview-off golden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { cardKind } from '../src/model/tree.js';
import { COMBAT_ROUNDS_KEY, MOMENTUM_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { enemyPoolOf } from '../src/model/actionCosts.js';
import { handRow, scaledCards } from '../src/model/handRules.js';
import { applyStatus } from '../src/engine/statuses.js';
import { triggerOwnerKey } from '../src/engine/triggers.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const SEED = 5;

// A registry whose enemy moves carry the given speeds (the copy is local to the test).
function registriesWithMoveSpeeds(speeds) {
  const base = createRegistries(contentBundle);
  const orig = base.enemies;
  const enemies = { ...orig, get: (id) => {
    const def = orig.get(id);
    if (id !== ENEMY) return def;
    return { ...def, moves: Object.fromEntries(Object.entries(def.moves).map(([k, m]) => [k, speeds[k] === undefined ? m : { ...m, speed: speeds[k] }])) };
  } };
  return { ...base, enemies };
}

// Expanded (v2) runs route endTurn through a foundation transaction, which rebuilds the RNG from its
// counters, so the roll fixtures below use the legacy (v1) expansion. The adapter is the same for both.
function fight({ preview = true, seed = SEED, classId = 'reaver', reg = registries, expansion = 1, momentum = false } = {}) {
  // Momentum is its own toggle (SPEC §4.11), off by default: a fight that tests momentum turns it on.
  const run = createRunState({ seed, classId, registries: reg, combatExpansionVersion: expansion, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: preview, [MOMENTUM_KEY]: momentum } } });
  return createRunCombat({ registries: reg, rng: createRng(seed), run, enemyIds: [ENEMY], settings: {} });
}

// Every combatant roll reads `u`: 0.999 gives d4 4 and a natural 20 (every attack lands), 0 gives d4 1
// and a natural 1 (every attack misses). Other streams are untouched.
function fixRoundRoll(c, u) {
  const base = c.rng;
  c.rng = new Proxy(base, {
    get(target, key) {
      if (key === 'float') return (stream) => (stream === 'combatRounds' ? u : target.float(stream));
      const v = target[key];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return c;
}

const handCard = (c, cardId) => c.piles.hand.find((card) => card.cardId === cardId);
const attackCard = (c) => c.piles.hand.find((card) => cardKind(resolveCard(registries, card)) === 'attack');
const liveEnemy = (c) => c.enemies.find((e) => e.alive);

test('queueing a card pays its Stamina and Mana, keeps the card in hand, and deals nothing yet', () => {
  const c = fight();
  const card = attackCard(c);
  const enemy = liveEnemy(c);
  const cost = cardPlayCosts(c, card.instanceId);
  const energy = c.player.energy;
  const mana = c.player.mana;
  const hp = enemy.hp;
  const handSize = c.piles.hand.length;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  assert.equal(c.player.energy, energy - cost.energy, 'Stamina (SP) is paid at queue time');
  assert.equal(c.player.mana, mana - cost.mana, 'Mana (MP) is paid at queue time');
  assert.equal(c.piles.hand.length, handSize, 'the card stays in hand');
  assert.ok(c.piles.hand.some((x) => x.instanceId === card.instanceId));
  assert.equal(enemy.hp, hp, 'no effect resolves at queue time');
  assert.deepEqual(c.combatRounds.playerQueue.map((r) => r.instanceId), [card.instanceId]);
  assert.deepEqual(c.combatRounds.playerQueue[0].paid, { energy: cost.energy, mana: cost.mana, stamina: cost.stamina });
});

test('a queued card with a Mana cost pays that Mana at queue time', () => {
  let found = null;
  // Several seeds: under the cost formula (SPEC §4.3a) seed 5's opening hands hold no affordable Mana card.
  for (const seed of [SEED, 1, 2, 3, 4, 6, 7, 8]) for (const classId of ['starseer', 'reaver', 'rogue', 'herald']) {
    if (found) break;
    const c = fight({ classId, expansion: 2, seed });
    for (const card of c.piles.hand) {
      const cost = cardPlayCosts(c, card.instanceId);
      if (cost.mana > 0 && cost.energy <= c.player.energy && cost.mana <= c.player.mana) { found = { c, card, cost }; break; }
    }
  }
  assert.ok(found, 'a Mana card is in some opening hand');
  const { c, card, cost } = found;
  const mana = c.player.mana;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: c.enemies.find((e) => e.alive)?.id ?? undefined });
  assert.equal(c.player.mana, mana - cost.mana);
});

test('unqueueing a card refunds exactly what it paid and returns it to the queue pool', () => {
  const c = fight();
  const card = attackCard(c);
  const enemy = liveEnemy(c);
  const energy = c.player.energy;
  const mana = c.player.mana;
  const stamina = c.player.counters.staminaSpentThisTurn || 0;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  dispatch(c, { type: 'unqueueCard', cardInstanceId: card.instanceId });
  assert.equal(c.player.energy, energy, 'Stamina refunded');
  assert.equal(c.player.mana, mana, 'Mana refunded');
  assert.equal(c.player.counters.staminaSpentThisTurn || 0, stamina, 'the turn counter is restored');
  assert.deepEqual(c.combatRounds.playerQueue, []);
  assert.ok(c.piles.hand.some((x) => x.instanceId === card.instanceId), 'the card is still in hand');
  assert.throws(() => dispatch(c, { type: 'unqueueCard', cardInstanceId: card.instanceId }), /not queued/);
});

test('a card cannot be queued twice, and a queued card cannot be discarded', () => {
  const c = fight();
  const card = attackCard(c);
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: liveEnemy(c).id });
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: liveEnemy(c).id }), /already queued/);
  assert.throws(() => dispatch(c, { type: 'endTurn', discardIds: [card.instanceId] }), /Unqueue/);
  assert.equal(c.phase, 'player', 'the refused discard leaves the turn open');
});

// Replaced rule: a flat 2 SP pool. The pool is the enemy's stats now (SPEC §4.6a).
test('each enemy queues its moves from its stat SP pool (owner 2026-10-12), SP per move from the action-cost table', () => {
  const pool = Rounds.enemyPool(registries.enemies.get(ENEMY));
  assert.equal(pool, enemyPoolOf(registries.enemies.get(ENEMY)), 'the stat pool (a 1-SP minion, owner 2026-10-13)');
  const c = fight();
  for (const enemy of c.enemies.filter((e) => e.alive)) {
    const queue = c.combatRounds.enemyQueues[enemy.id];
    assert.ok(queue.length >= 1, `${enemy.id} queues at least one move`);
    const spent = queue.reduce((sum, e) => sum + e.sp, 0);
    assert.ok(spent <= pool, `${enemy.id} spends ${spent} SP of ${pool}`);
    assert.equal(enemy.intent.moveId, queue[0].moveId, 'slot 0 is the intent the existing code reads');
  }
});

test('the queue builder respects the opener, costs, and stops when the next move would overspend', () => {
  // Stats for a pool of 3 (SPEC §4.6a: base 1, +1 Dexterity 4, +1 Constitution 4).
  const def = { firstMove: 'open', attributes: { dexterity: 4, constitution: 4 }, moves: { open: {}, a: {}, b: { sp: 2 } } };
  const picks = ['a', 'b', 'a', 'a'];
  const enemy = { movesHistory: [] };
  const queue = Rounds.buildEnemyQueue(enemy, def, { isFirstTurn: true, pick: () => picks.shift() ?? null });
  assert.deepEqual(queue, [{ moveId: 'open', sp: 1 }, { moveId: 'a', sp: 1 }]);
  assert.deepEqual(enemy.movesHistory, ['open', 'a'], 'each queued move is recorded as a roll');
  // A zero-cost move cannot run the pool dry: the queue is capped.
  const free = Rounds.buildEnemyQueue({ movesHistory: [] }, { moves: { z: { sp: 0 } } }, { pick: () => 'z' });
  assert.equal(free.length, 16);
});

test('speed comes from the card or the speed-mods table, and a move kind comes from its intent', () => {
  assert.equal(Rounds.speedModDefaults().get('strike'), 1);
  assert.equal(Rounds.speedModDefaults().get('counter'), 3);
  assert.equal(Rounds.speedModDefaults().has('gorefireSlash'), false, 'a choice cell (1|2|3) is not a default');
  assert.equal(Rounds.cardSpeed({}, 'strike'), 1);
  assert.equal(Rounds.cardSpeed({ speed: 4 }, 'strike'), 4, 'a card speed field wins');
  assert.equal(Rounds.cardSpeed({}, 'unknownCard'), 0);
  assert.equal(Rounds.moveKind({ intent: 'attack', damage: 7 }), 'attack');
  assert.equal(Rounds.moveKind({ intent: 'block', block: 6 }), 'guard');
  assert.equal(Rounds.moveKind({ intent: 'buff' }), 'other');
  assert.equal(Rounds.stanceFor('attack', ['smash']), 'smash');
});

test('an attack that misses applies no damage, and its card still leaves the hand', () => {
  const c = fixRoundRoll(fight(), 0);
  const card = attackCard(c);
  const enemy = liveEnemy(c);
  const enemyHp = enemy.hp;
  const playerHp = c.player.hp;
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  const { events } = dispatch(c, { type: 'endTurn' });
  assert.equal(enemy.hp, enemyHp, 'the missed Strike deals nothing');
  assert.equal(c.player.hp, playerHp, 'the enemy attacks miss too');
  assert.ok(!events.some((e) => e.type === 'damageDealt'), 'no damage event in the round');
  assert.ok(!c.piles.hand.some((x) => x.instanceId === card.instanceId), 'the card left the hand');
  assert.ok([...c.piles.discard, ...c.piles.exhaust].some((x) => x.instanceId === card.instanceId), 'it went to a pile');
});

test('a landed Strike deals the same live damage a live play would', () => {
  const live = fight({ preview: false });
  const liveCard = attackCard(live);
  const liveTarget = liveEnemy(live);
  const liveBefore = liveTarget.hp;
  const liveEvents = dispatch(live, { type: 'playCard', cardInstanceId: liveCard.instanceId, targetId: liveTarget.id }).events;
  const liveDamage = liveEvents.filter((e) => e.type === 'damageDealt' && e.targetId === liveTarget.id).reduce((n, e) => n + e.amount, 0);
  assert.ok(liveDamage > 0, 'fixture: the live card deals damage');
  assert.equal(liveTarget.hp, liveBefore - liveDamage);

  const c = fixRoundRoll(fight(), 0.999);
  const card = handCard(c, liveCard.cardId);
  const target = liveEnemy(c);
  const hp = target.hp;
  const { events } = (() => {
    dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.id });
    return dispatch(c, { type: 'endTurn' });
  })();
  const damage = events.filter((e) => e.type === 'damageDealt' && e.targetId === target.id && e.sourceId === c.player.id).reduce((n, e) => n + e.amount, 0);
  assert.equal(damage, liveDamage, 'the preview Strike deals its live damage');
  assert.equal(target.hp, hp - damage);
});

test('a faster enemy move acts before a slower Strike, and a slower one after it', () => {
  // Player Strike: speed 0 + DEX initiative floor(1 / 2) = 0 + d4 4 = 4 (gorefireSlash has no speed-mods row). Every
  // enemy move gets the same speed S, so an enemy action totals S + its DEX initiative floor(4 / 2) = 2 + 4 and a later
  // move never passes an earlier one. The queue is whatever the enemy rolled; only the order against the Strike is
  // asserted. (Before the timeline read live attributes, both initiatives were 0 and the slow speed was 0.)
  const order = (speed) => {
    const speeds = { slash: speed, guard: speed, warcry: speed };
    const c = fixRoundRoll(fight({ reg: registriesWithMoveSpeeds(speeds) }), 0.999);
    const card = attackCard(c);
    const enemy = liveEnemy(c);
    dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
    const { events } = dispatch(c, { type: 'endTurn' });
    return events
      .filter((e) => (e.type === 'cardPlayed' && e.sourceId === c.player.id) || (e.type === 'enemyMoveStarted' && e.sourceId === enemy.id))
      .map((e) => (e.type === 'cardPlayed' ? 'strike' : 'enemy'));
  };
  const slow = order(-3);
  assert.equal(slow[0], 'strike', `slow enemy moves: the Strike goes first (${slow})`);
  assert.ok(slow.includes('enemy'), `slow enemy moves still act (${slow})`);
  const fast = order(9);
  const strike = fast.indexOf('strike');
  assert.ok(strike > 0, `fast enemy moves: the Strike is not first (${fast})`);
  assert.ok(fast.slice(0, strike).every((x) => x === 'enemy'), `fast enemy moves act before the Strike (${fast})`);
});

test('after the commit the hand matches a live fight that played the same card', () => {
  const live = fight({ preview: false });
  const liveCard = attackCard(live);
  dispatch(live, { type: 'playCard', cardInstanceId: liveCard.instanceId, targetId: liveEnemy(live).id });
  dispatch(live, { type: 'endTurn' });

  const c = fixRoundRoll(fight(), 0.999);
  const card = handCard(c, liveCard.cardId);
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: liveEnemy(c).id });
  dispatch(c, { type: 'endTurn' });

  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) {
    assert.equal(c.piles[pile].length, live.piles[pile].length, `${pile} size matches a live fight`);
  }
  assert.equal(c.phase, 'player');
  assert.equal(c.turn, live.turn);
  assert.deepEqual(c.combatRounds.playerQueue, [], 'the queue is empty after the commit');
});

test('a default (expanded) fight commits a round and hands the turn back to the player', () => {
  const c = fight({ expansion: 2 });
  const card = attackCard(c);
  dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: liveEnemy(c).id });
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.phase, 'player');
  assert.deepEqual(c.combatRounds.playerQueue, []);
  assert.deepEqual(c.combatRounds.enemyQueues[ENEMY_ID_OF(c)].length >= 1, true, 'the next round is queued');
});

test('the round state is written back: momentum is kept per enemy and stays within -3..3', () => {
  const c = fixRoundRoll(fight({ momentum: true }), 0.999);
  dispatch(c, { type: 'playCard', cardInstanceId: attackCard(c).instanceId, targetId: liveEnemy(c).id });
  dispatch(c, { type: 'endTurn' });
  const momentum = c.combatRounds.momentum[ENEMY_ID_OF(c)];
  assert.ok(Number.isInteger(momentum) && momentum >= -3 && momentum <= 3, `momentum ${momentum}`);
});

function ENEMY_ID_OF(c) {
  return c.enemies[0].id;
}

// The preview-off event log is byte-identical to the one recorded before P3a (the same scripted
// fights as the golden in the P3a commit: three seeds, four turns, each card played on the first
// living enemy, reactions set off). Re-recorded at the dev merge (2026-10-12): dev's combatReactionUnavailable
// receipts (SPEC §4.10) are in the log now, and this equals origin/dev's own output for the same script.
// Re-recorded for the cost formula and the stat-driven enemy pool (SPEC §4.3a, §4.6a; owner 2026-10-12, 2026-10-13): card
// costs and the enemy's stat pool change what the script plays. The previous hash came from the replaced stance-table rule.
function scriptedLog(seed, classId = 'reaver', enemyIds = [ENEMY]) {
  const run = createRunState({ seed, classId, registries });
  const c = createRunCombat({ registries, rng: createRng(seed), run, enemyIds, settings: {} });
  const log = [];
  if (c.pendingReaction) log.push(['pending', c.pendingReaction.kind ?? 'x']);
  try { dispatch(c, { type: 'setReactions', enabled: false }); } catch (e) { log.push(['noreact', String(e.message)]); }
  for (let turn = 0; turn < 4 && !c.result; turn++) {
    for (let k = 0; k < 6 && !c.result; k++) {
      const card = c.piles.hand.find((x) => { try { const r = dispatch(c, { type: 'playCard', cardInstanceId: x.instanceId, targetId: c.enemies.find((e) => e.alive)?.id }); log.push(['play', x.cardId, r.events]); return true; } catch { return false; } });
      if (!card) break;
    }
    if (c.result) break;
    const r = dispatch(c, { type: 'endTurn' });
    log.push(['end', r.events]);
  }
  log.push(['state', c.result ?? null, c.player.hp, c.enemies.map((e) => [e.id, e.hp, e.alive]), c.turn]);
  return JSON.stringify(log);
}

test('with the preview off, a scripted fight event log is byte-identical to the recorded golden', () => {
  const all = [1, 2, 3].map((s) => scriptedLog(s)).join('\n');
  // Re-recorded for the retuned Wandering Soldier (2 SP, HP 31-36, Slash 8; owner 2026-10-13: harder tier-1 normals).
  // Re-recorded at the origin/dev merge of 2026-10-13 (#1931, #1896 and the rest): dev's combat changes (reaction rules
  // version 2, split hits, Silenced, the damage-type tags the cost formula prices) change what the script plays.
  // Re-recorded at the origin/dev merge 1ab0ff716 (#1945, the combat log's event receipts): the log is the 18560cde5
  // log with keys added and nothing else changed: moveId on each enemy move's events, incoming and base on damageDealt,
  // source 'defendStance' on a stance block, triggeredBy on a triggered stagger. The PR #1953 review fixes (a mid-turn
  // stagger, a charge in a round, normal momentum per exchange) do not reach this preview-off script.
  assert.equal(createHash('sha256').update(all).digest('hex'), 'b0e575b620cccace23b5bbb263eca69d8489014670dcad278b7809a9f5272e4a');
  assert.equal(all.length, 407839);
});

// Review finding 1: a queued card that an earlier queued card removed from hand never resolves.
// The hand is replaced with the cards a test names; instances are cloned from the opening hand.
function handWith(c, cards) {
  c.piles.hand = cards.map(([instanceId, cardId]) => ({ instanceId, cardId, upgraded: false }));
  return c;
}

test('a queued card an earlier queued card discarded is skipped and refunded at commit; End Turn succeeds', () => {
  // Pilfer draws 2 and discards 1 at random. Over these seeds it discards the queued Low Blow in some
  // of them; in those the commit must skip Low Blow (refund its SP and MP) instead of throwing.
  let skipped = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const c = fixRoundRoll(fight({ classId: 'rogue', seed }), 0.999);
    handWith(c, [['pf', 'pilfer'], ['lb', 'lowBlow']]);
    const enemy = liveEnemy(c);
    const pilfer = cardPlayCosts(c, 'pf');
    const lowBlow = cardPlayCosts(c, 'lb');
    const turn = c.turn;
    dispatch(c, { type: 'playCard', cardInstanceId: 'pf' });
    dispatch(c, { type: 'playCard', cardInstanceId: 'lb', targetId: enemy.id });
    const { events } = dispatch(c, { type: 'endTurn' });
    assert.equal(c.phase, 'player', `seed ${seed}: the next turn opens`);
    assert.equal(c.turn, turn + 1, `seed ${seed}: one turn passed`);
    assert.deepEqual(c.combatRounds.playerQueue, [], `seed ${seed}: the queue is empty after the commit`);
    const skip = events.find((e) => e.type === 'combatRoundCardSkipped' && e.cardInstanceId === 'lb');
    if (skip) {
      skipped++;
      assert.deepEqual(skip.refund, { energy: lowBlow.energy, mana: lowBlow.mana, stamina: lowBlow.stamina }, `seed ${seed}: the skipped card's SP and MP are refunded`);
      assert.ok(!events.some((e) => e.type === 'damageDealt' && e.targetId === enemy.id && e.sourceId === c.player.id), `seed ${seed}: the skipped Low Blow deals nothing`);
    }
    void pilfer;
  }
  assert.ok(skipped > 0, 'fixture: some seed has Pilfer discard the queued Low Blow');
});

test('a commit that throws part way leaves the fight exactly as it was before End Turn (legacy fight)', () => {
  const c = fixRoundRoll(fight({ expansion: 1 }), 0.999);
  handWith(c, [['a1', 'strike'], ['a2', 'strike']]);
  const enemy = liveEnemy(c);
  dispatch(c, { type: 'playCard', cardInstanceId: 'a1', targetId: enemy.id });
  dispatch(c, { type: 'playCard', cardInstanceId: 'a2', targetId: enemy.id });
  // The second landed card throws after the first has dealt its damage.
  // Both emit paths are wrapped: the live combat.emit, and the _emitEvent a transaction candidate uses.
  let played = 0;
  const failSecond = (type) => { if (type === 'cardPlayed' && ++played === 2) throw new Error('injected mid-commit'); };
  const realEmit = c.emit;
  c.emit = (type, payload) => { failSecond(type); return realEmit(type, payload); };
  const realEventBus = c._emitEvent;
  c._emitEvent = (ctx, type, payload) => { failSecond(type); return realEventBus(ctx, type, payload); };
  const state = () => JSON.stringify({
    enemies: c.enemies, player: c.player, piles: c.piles, phase: c.phase, turn: c.turn, result: c.result ?? null,
    combatRounds: c.combatRounds, rng: c.rng.getCounters(), eventLog: c.eventLog.length,
  });
  const before = state();
  assert.throws(() => dispatch(c, { type: 'endTurn' }), /injected mid-commit/);
  assert.equal(state(), before, 'a throw restores the pre-commit combat state, queues and RNG included');
});

// Review finding 2: one Mana-discount charge is consumed only at commit, so each queued card read it at queue
// time and every queued card got the discount. A charge a queued card claims is not offered to a later card.
function manaCardFixture() {
  for (const classId of ['starseer', 'reaver', 'rogue', 'herald']) {
    for (let seed = 1; seed <= 20; seed++) {
      const c = fight({ classId, seed, expansion: 2 });
      const card = c.piles.hand.find((x) => cardPlayCosts(c, x.instanceId).mana >= 1);
      if (card) return { classId, seed, cardId: card.cardId };
    }
  }
  return null;
}

test('two queued cards cannot both use one Mana-discount charge; unqueueing hands the claim back', () => {
  const found = manaCardFixture();
  assert.ok(found, 'fixture: a Mana card is in some opening hand');
  const c = fight({ classId: found.classId, seed: found.seed, expansion: 2 });
  const first = c.piles.hand.find((x) => x.cardId === found.cardId);
  c.piles.hand = [first, { ...first, instanceId: 'second' }];
  const targetId = c.enemies.find((e) => e.alive)?.id;
  const base = cardPlayCosts(c, first.instanceId).mana;
  assert.ok(base >= 1, 'fixture: the Mana card costs Mana');
  c.player.abilityRiders = { ...(c.player.abilityRiders || {}), charges: { ...(c.player.abilityRiders?.charges || {}), discount: { manaDiscount: 1 } } };
  assert.equal(cardPlayCosts(c, first.instanceId).mana, base - 1, 'fixture: the charge discounts the first card');

  const mana0 = c.player.mana;
  dispatch(c, { type: 'playCard', cardInstanceId: first.instanceId, targetId });
  assert.equal(c.player.mana, mana0 - (base - 1), 'the first queued card pays the discounted Mana');
  assert.equal(cardPlayCosts(c, 'second').mana, base, 'the charge is claimed: the second card prices at full Mana');
  dispatch(c, { type: 'playCard', cardInstanceId: 'second', targetId });
  assert.equal(c.player.mana, mana0 - (base - 1) - base, 'the second queued card pays full Mana');

  dispatch(c, { type: 'unqueueCard', cardInstanceId: first.instanceId });
  assert.equal(c.player.mana, mana0 - base, 'unqueueing the first refunds its discounted Mana');
  assert.equal(cardPlayCosts(c, first.instanceId).mana, base - 1, 'the released charge is offered again');
  dispatch(c, { type: 'playCard', cardInstanceId: first.instanceId, targetId });
  assert.equal(c.player.mana, mana0 - base - (base - 1), 'requeued, the first card takes the discount again');
});

// Review finding 4: the hand-size discard check ran before the commit, so queued cards counted toward
// overflow. A queued card leaves the hand in the commit (it resolves or is discarded), so it must not count.
test('queued cards do not count toward hand-size overflow; a full unqueued hand still has to discard', () => {
  const retaining = (c) => { c.handRules = { ...c.handRules, retain: true }; return c; };
  const padded = (c) => {
    const cap = scaledCards(handRow(c.handRules, 'handSize'), c.attributes, c.characterLevel);
    for (let i = 0; c.piles.hand.length < cap + 1; i++) c.piles.hand.push({ ...c.piles.hand[0], instanceId: `pad${i}` });
    return c;
  };
  const c = padded(retaining(fight({ expansion: 1 })));
  let queued = 0;
  for (const card of [...c.piles.hand]) {
    if (queued === 2) break;
    const targetId = liveEnemy(c).id;
    for (const attempt of [{ targetId }, {}]) {
      try { dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, ...attempt }); queued++; break; } catch { /* not playable this way */ }
    }
  }
  assert.equal(queued, 2, 'fixture: two cards are queued');
  const hand = c.piles.hand.length;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.phase, 'player', 'the queued cards leave the hand in the commit, so no discard is owed');
  assert.ok(hand > scaledCards(handRow(c.handRules, 'handSize'), c.attributes, c.characterLevel) - 1);

  const unqueued = padded(retaining(fight({ expansion: 1 })));
  assert.throws(() => dispatch(unqueued, { type: 'endTurn' }), /Select 1/, 'without queued cards the overflow is still owed');
});

// Review finding 5: an enemy's turn-start effects (its DoT ticks, the block reset) run before its moves, as
// the live enemy phase does. A fight with two enemies keeps the round going when one of them dies.
function twoEnemyFight(seed, expansion = 1) {
  const run = createRunState({ seed, classId: 'reaver', registries, combatExpansionVersion: expansion, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  return fixRoundRoll(createRunCombat({ registries, rng: createRng(seed), run, enemyIds: [ENEMY, ENEMY], settings: {} }), 0.999);
}

test('a lethal turn-start tick kills the enemy before its queued moves: it does not act in the round', () => {
  let found = null;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const c = twoEnemyFight(seed);
    const [dying, living] = c.enemies;
    const def = registries.enemies.get(dying.enemyId);
    const queue = c.combatRounds.enemyQueues[dying.id] || [];
    if (queue.some((entry) => Rounds.moveKind(def.moves[entry.moveId]) === 'attack')) found = { c, dying, living };
  }
  assert.ok(found, 'fixture: an enemy queues an attack');
  const { c, dying, living } = found;
  dying.hp = 1;
  applyStatus(c, dying, 'crimsonBlight', 3, living);
  const { events } = dispatch(c, { type: 'endTurn' });
  assert.equal(dying.alive, false, 'the DoT tick kills the enemy');
  assert.ok(!events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === dying.id), 'the dead enemy starts no move');
  assert.ok(!events.some((e) => e.type === 'damageDealt' && e.sourceId === dying.id), 'its queued attack deals nothing');
  assert.ok(living.alive, 'fixture: the other enemy lives');
  assert.equal(c.combatRounds.enemyQueues[dying.id], undefined, 'its queue is dropped');
  assert.equal(c.phase, 'player', 'the fight goes on');
});

test('a stagger that lands after an enemy has acted persists into its next turn, as it does live', () => {
  const c = twoEnemyFight(7);
  const [enemy] = c.enemies;
  // The stagger lands on the enemy's first move: it is applied after that move has acted.
  let landed = false;
  const realEmit = c.emit;
  c.emit = (type, payload) => {
    const out = realEmit(type, payload);
    if (!landed && type === 'enemyMoveStarted' && payload.sourceId === enemy.id) { landed = true; enemy.skipNextTurn = true; }
    return out;
  };
  dispatch(c, { type: 'endTurn' });
  assert.equal(landed, true, 'fixture: the enemy acted in the round');
  assert.equal(enemy.skipNextTurn, true, 'the stagger persists past the round it landed in');

  const { events } = dispatch(c, { type: 'endTurn' });
  assert.ok(!events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id), 'the staggered enemy starts no move on its next turn');
  assert.equal(enemy.skipNextTurn, false, 'the stagger is spent on that turn');
  assert.equal(c.phase, 'player');
});

// Review finding 2a: a missed card paid the discounted Mana, so the charge it claimed is spent with it.
// A Mana attack (it claims the charge) and a later non-attack card that the same charge would also match.
function missFixture() {
  for (const classId of ['starseer', 'reaver', 'rogue', 'herald']) {
    for (let seed = 1; seed <= 40; seed++) {
      const c = fight({ classId, seed, expansion: 1 });
      const attack = c.piles.hand.find((x) => cardKind(resolveCard(registries, x)) === 'attack' && cardPlayCosts(c, x.instanceId).mana >= 1);
      if (!attack) continue;
      const block = c.piles.hand.find((x) => x.instanceId !== attack.instanceId && cardKind(resolveCard(registries, x)) !== 'attack' && cardPlayCosts(c, x.instanceId).mana === 0);
      if (block) return { classId, seed, attackId: attack.instanceId, blockId: block.instanceId };
    }
  }
  return null;
}

// Review finding 2a: the attack misses and leaves the hand. Its claimed charge must be consumed then, not
// left in the round, where the non-attack queued after it (which the charge also matches) would take it.
test('a card that misses consumes the Mana-discount charge it claimed, so a later card in the round cannot take it', () => {
  const found = missFixture();
  assert.ok(found, 'fixture: a Mana attack and a 0-Mana skill are in some opening hand');
  const c = fixRoundRoll(fight({ classId: found.classId, seed: found.seed, expansion: 1 }), 0);
  const targetId = liveEnemy(c).id;
  c.player.abilityRiders = { ...(c.player.abilityRiders || {}), charges: { ...(c.player.abilityRiders?.charges || {}), discount: { manaDiscount: 1 } } };
  dispatch(c, { type: 'playCard', cardInstanceId: found.attackId, targetId });
  assert.deepEqual(c.combatRounds.playerQueue.find((r) => r.instanceId === found.attackId).claims, ['discount'], 'fixture: the attack claims the charge');
  const blockCardId = c.piles.hand.find((x) => x.instanceId === found.blockId).cardId;
  try { dispatch(c, { type: 'playCard', cardInstanceId: found.blockId }); } catch { dispatch(c, { type: 'playCard', cardInstanceId: found.blockId, targetId }); }
  const { events } = dispatch(c, { type: 'endTurn' });
  assert.ok(!events.some((e) => e.type === 'cardChargeConsumed' && e.cardId === blockCardId), 'the later card does not take the missed card\'s charge');
});

// Review finding 2b: a queued card's charge claim is respected at the commit. A charge granted during the turn
// (after an earlier card was queued) matches that earlier 0-Mana attack; the Mana attack queued after it claims
// the charge. The earlier card resolves first and must not consume the charge (with its damage rider) that
// the later card paid for.
function claimPairFixture() {
  for (const classId of ['starseer', 'reaver', 'rogue', 'herald']) {
    for (let seed = 1; seed <= 40; seed++) {
      const c = fight({ classId, seed, expansion: 1 });
      const free = c.piles.hand.find((x) => cardKind(resolveCard(registries, x)) === 'attack' && cardPlayCosts(c, x.instanceId).mana === 0);
      const mana = c.piles.hand.find((x) => x.instanceId !== free?.instanceId && cardKind(resolveCard(registries, x)) === 'attack' && cardPlayCosts(c, x.instanceId).mana >= 1);
      if (free && mana) return { classId, seed, freeId: free.instanceId, manaId: mana.instanceId, freeCardId: free.cardId, manaCardId: mana.cardId };
    }
  }
  return null;
}

test('an earlier queued card cannot take a Mana-discount charge that a later queued card claimed', () => {
  const found = claimPairFixture();
  assert.ok(found, 'fixture: a 0-Mana attack and a Mana attack are in some opening hand');
  const c = fixRoundRoll(fight({ classId: found.classId, seed: found.seed, expansion: 1 }), 0.999);
  const targetId = liveEnemy(c).id;
  dispatch(c, { type: 'playCard', cardInstanceId: found.freeId, targetId });
  c.player.abilityRiders = { ...(c.player.abilityRiders || {}), charges: { ...(c.player.abilityRiders?.charges || {}), discount: { manaDiscount: 1, damage: 2 } } };
  dispatch(c, { type: 'playCard', cardInstanceId: found.manaId, targetId });
  assert.deepEqual(c.combatRounds.playerQueue.find((r) => r.instanceId === found.manaId).claims, ['discount'], 'fixture: the later card claims the charge');
  const { events } = dispatch(c, { type: 'endTurn' });
  assert.ok(!events.some((e) => e.type === 'cardChargeConsumed' && e.cardId === found.freeCardId), 'the earlier card does not consume the claimed charge');
  assert.ok(events.some((e) => e.type === 'cardChargeConsumed' && e.cardId === found.manaCardId), 'the later card consumes its own claimed charge');
});

// End Turn, declining any reaction the commit offers (Back), so the turn runs to its end. Returns the events.
function endTurnDeclining(c) {
  const out = dispatch(c, { type: 'endTurn' });
  const events = [...out.events];
  while (c.pendingReaction) events.push(...dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null }).events);
  return { events };
}

// Review finding 3: in an expanded (v2) fight a queued enemy honours control action loss as live does: one
// Frozen stack takes the enemy's action at its entry, once per round. Baseline first: the seed's enemy acts.
test('in an expanded fight, a Frozen stack takes a queued enemy\'s action at its entry, once per round', () => {
  let seed = null;
  for (let s = 1; s <= 40 && seed === null; s++) {
    const c = fight({ seed: s, expansion: 2 });
    const enemy = liveEnemy(c);
    const { events } = dispatch(c, { type: 'endTurn' });
    if (events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id)) seed = s;
  }
  assert.ok(seed !== null, 'fixture: the enemy acts in an expanded fight');

  const c = fight({ seed, expansion: 2 });
  const enemy = liveEnemy(c);
  applyStatus(c, enemy, 'frozen', 2, c.player);
  const acted = (events) => events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id);
  const first = dispatch(c, { type: 'endTurn' });
  assert.equal(acted(first.events), false, 'the frozen enemy loses its action this round');
  const lost = first.events.filter((e) => e.type === 'statusRemoved' && e.targetId === enemy.id && e.reason === 'actionDenied');
  assert.equal(lost.length, 1, 'one action is lost, and only one');
  assert.equal(enemy.statuses?.frozen?.stacks, 1, 'one stack is spent, the other remains');

  // A player-targeted attack can pause the commit for a reaction (SPEC §4.11); this test declines any offer.
  const second = endTurnDeclining(c);
  assert.equal(second.events.filter((e) => e.type === 'statusRemoved' && e.targetId === enemy.id && e.reason === 'actionDenied').length, 1, 'the second stack takes the next round');
  assert.equal(acted(second.events), false, 'the next round is lost to the second stack');
  const third = endTurnDeclining(c);
  assert.equal(acted(third.events), true, 'with no stack left the enemy acts again');
});

// Review finding 1: a stagger that lands before the enemy's first entry skips its moves for the round. The
// flag must be spent with that round, not carried into the next one: exactly one round is lost.
test('a stagger that lands before the enemy acts costs that enemy exactly one round', () => {
  const c = fixRoundRoll(fight({ seed: 7 }), 0.999);
  const enemy = liveEnemy(c);
  enemy.skipNextTurn = true;
  const acted = [];
  for (let round = 0; round < 4 && c.phase === 'player'; round++) {
    const { events } = dispatch(c, { type: 'endTurn' });
    acted.push(events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id));
  }
  assert.deepEqual(acted, [false, true, true, true], 'round 1 is lost, and only round 1');
  assert.equal(enemy.skipNextTurn, false, 'the stagger is spent');
});

// Review nit: unqueuing with the preview off names the cause, not a TypeError from a missing record.
test('unqueueing with the preview off throws a clear error, not a TypeError', () => {
  const c = fight({ preview: false });
  assert.throws(() => dispatch(c, { type: 'unqueueCard', cardInstanceId: attackCard(c).instanceId }), (err) => {
    assert.ok(!(err instanceof TypeError), 'not a TypeError');
    assert.match(err.message, /combat rounds preview is not on/);
    return true;
  });
});

// --- PR #1953 review: a delayed (charging) move in a round -------------------------------------------------------

// The soldier with a 1-SP charging attack added (weight 0, so it is only ever queued by hand here).
const CHARGE = 'heavyCharge';
const chargeRegistries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === ENEMY
  ? { ...e, moves: { ...e.moves, [CHARGE]: { intent: 'attack', damage: 12, weight: 0, sp: 1, delay: { turns: 1, whileCharging: { block: 5 } } } } }
  : e)) });
// A legacy fight whose enemy queues the charge and then a Slash this round.
function chargeFight(u) {
  const c = fixRoundRoll(fight({ reg: chargeRegistries, expansion: 1 }), u);
  const enemy = liveEnemy(c);
  c.combatRounds.enemyQueues[enemy.id] = [{ moveId: CHARGE, sp: 1 }, { moveId: 'slash', sp: 1 }];
  return { c, enemy };
}

test('a charging move takes the enemy\'s round: its later queued moves do not play after the charge starts', () => {
  const { c, enemy } = chargeFight(0.999);
  const { events } = endTurnDeclining(c);
  assert.equal(enemy.pendingMove?.moveId, CHARGE, 'the charge starts');
  assert.ok(events.some((e) => e.type === 'blockGained' && e.targetId === enemy.id && e.amount === 5), 'its whileCharging block lands');
  assert.ok(!events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id && e.moveId === 'slash'), 'the Slash queued after it does not start');
  assert.ok(!events.some((e) => e.type === 'damageDealt' && e.sourceId === enemy.id), 'nothing hits the player this round');
  const second = endTurnDeclining(c);
  assert.equal(enemy.pendingMove, null, 'the charge resolves on its turn');
  assert.ok(second.events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id && e.moveId === CHARGE), 'the landed charge plays its payload');
});

test('a charging attack whose hit roll misses still starts its charge; the miss applies when the payload resolves', () => {
  const { c, enemy } = chargeFight(0);
  const first = endTurnDeclining(c);
  assert.equal(enemy.pendingMove?.moveId, CHARGE, 'the charge starts although the roll missed');
  assert.ok(first.events.some((e) => e.type === 'blockGained' && e.targetId === enemy.id && e.amount === 5), 'the whileCharging block lands');
  const second = endTurnDeclining(c);
  assert.equal(enemy.pendingMove, null, 'the charge resolves on its turn');
  assert.ok(!second.events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id && e.moveId === CHARGE), 'the missed charge plays no payload');
  assert.ok(!second.events.some((e) => e.type === 'damageDealt' && e.sourceId === enemy.id), 'and deals nothing');
});

// Exact-head review P2: the round settles a delayed entry when its charge starts, but its Poise damage lands on the
// later turn. The spent momentum multiplier must travel with that pending move until its ordinary payload drains.
const delayedPoiseRegistries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === ENEMY
  ? { ...e, moves: { ...e.moves, [CHARGE]: { intent: 'attack', damage: 12, weight: 0, sp: 1,
    effects: [{ op: 'poiseDamage', target: 'player', amount: 4 }], delay: { turns: 1, whileCharging: { block: 5 } } } } }
  : e)) });

test('a delayed round hit keeps its Poise multiplier until the payload lands', () => {
  const poiseDealt = (doubled) => {
    const c = fixRoundRoll(fight({ reg: delayedPoiseRegistries, expansion: 1, momentum: true }), 0.999);
    const enemy = liveEnemy(c);
    c.combatRounds.enemyQueues[enemy.id] = [{ moveId: CHARGE, sp: 1 }];
    c.player.poiseMeter.max = 100;
    if (doubled) c.combatRounds.poiseDouble = { [enemy.id]: true };
    endTurnDeclining(c);
    assert.equal(enemy.pendingMove?.moveId, CHARGE, 'the flagged landed entry starts its charge');
    const before = c.player.poiseMeter.value;
    endTurnDeclining(c);
    assert.equal(enemy.pendingMove, null, 'the delayed payload lands on the following enemy turn');
    return c.player.poiseMeter.value - before;
  };
  const plain = poiseDealt(false);
  assert.equal(plain, 6, 'fixture: the hit adds 2 Poise and its rider adds 4');
  assert.equal(poiseDealt(true), plain * 2, 'the delayed hit and its Poise rider are both doubled');
});

// Review follow-up: the timeline has no delay handling, so the round's queue itself ends at a charge. Otherwise the
// timeline resolved a Slash the live round skipped: it credited that Slash's momentum, and a queued Counter fired on it.
// The soldier opens with the charge, and Slash is its only weighted move, so before the fix the queue was charge, Slash.
const openerRegistries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === ENEMY
  ? { ...e, firstMove: CHARGE, moves: { ...e.moves, guard: { ...e.moves.guard, weight: 0 }, warcry: { ...e.moves.warcry, weight: 0 },
    [CHARGE]: { intent: 'attack', damage: 12, weight: 0, sp: 1, delay: { turns: 1, whileCharging: { block: 5 } } } } }
  : e)) });

test('a round\'s queue ends at a charging move: no later entry is queued, credited or answered by a Counter', () => {
  const round = (withCounter) => {
    const c = fixRoundRoll(fight({ reg: openerRegistries, expansion: 1, momentum: true }), 0.999);
    const enemy = liveEnemy(c);
    assert.deepEqual(c.combatRounds.enemyQueues[enemy.id].map((e) => e.moveId), [CHARGE], 'the queue ends at the charge, though the pool has SP left');
    if (withCounter) {
      c.piles.hand.push({ instanceId: 'rx-counter', cardId: 'guardCounter', upgraded: false });
      dispatch(c, { type: 'playCard', cardInstanceId: 'rx-counter' });
      assert.deepEqual(c.combatRounds.playerQueue.map((r) => r.cardId), ['guardCounter'], 'fixture: the Counter is queued');
    }
    const { events } = endTurnDeclining(c);
    assert.equal(enemy.pendingMove?.moveId, CHARGE, 'the charge starts');
    assert.ok(!events.some((e) => e.type === 'enemyMoveStarted' && e.sourceId === enemy.id), 'nothing else plays');
    return c.combatRounds.momentum[enemy.id] ?? 0;
  };
  const plain = round(false);
  assert.equal(plain, -1, 'the charge entry is the enemy\'s only exchange: one credit, no Slash credit after it');
  assert.equal(round(true), plain, 'a queued Counter answers no phantom entry: the round\'s momentum is unchanged by it');
});

// Codex P1 on PR #1953: the timeline reads STR / DEX / WIS / INT (resolver.js attributeBonus, evasionFor; timeline.js
// initiativeBase), so the live attributes (strength, dexterity, ...) must reach it in that shape: the player's
// effective attributes, and each enemy's authored ones (blight-shifted, actionCosts.js enemyAttributesOf).
test('the timeline reads live attributes: DEX initiative moves the player\'s and the enemy\'s planned speeds', () => {
  const withEnemyDex = (dex) => createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map((e) => (e.id === ENEMY
    ? { ...e, attributes: { ...e.attributes, dexterity: dex } } : e)) });
  const foeSpeed = (dex) => {
    const c = fight({ reg: withEnemyDex(dex), expansion: 1 });
    return Rounds.screenForecast(c, liveEnemy(c).id).foeSpeed;
  };
  assert.equal(foeSpeed(8) - foeSpeed(0), 4, 'enemy DEX 8 adds floor(8 / 2) initiative over DEX 0');
  const cardSpeed = (dex) => {
    const c = fight({ expansion: 1 });
    c.attributes = { ...(c.attributes ?? {}), dexterity: dex };
    const card = attackCard(c);
    dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: liveEnemy(c).id });
    const record = c.combatRounds.playerQueue[0];
    return Rounds.screenForecast(c, liveEnemy(c).id, { ...Rounds.timelineCardFor(record), instanceId: record.instanceId }).cardSpeed;
  };
  assert.equal(cardSpeed(6) - cardSpeed(0), 3, 'player Dexterity 6 adds floor(6 / 2) initiative over 0');
});

// Codex P2 on PR #1953 (SPEC §4.11: "the side's next landed hit carries doubled poise damage"): the timeline marks the
// landed hit that spends a side's poiseDouble flag with poiseMultiplier 2; the live card or move must apply it. Bashing
// Blow keeps its authored 4 Poise damage here (costRule 'fixed').
const bashRegistries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map((card) => (card.id === 'bashingBlow' ? { ...card, costRule: 'fixed' } : card)) });
test('a momentum overflow doubles the Poise damage of the side\'s next landed hit, live', () => {
  const poiseDealt = (doubled) => {
    const c = fixRoundRoll(fight({ reg: bashRegistries, expansion: 1, momentum: true }), 0.999);
    const enemy = liveEnemy(c);
    c.combatRounds.enemyQueues[enemy.id] = [];
    // A wide meter, so no break (the Reaver's relic adds Poise on a hit too) resets the reading.
    enemy.poiseMeter.max = 100;
    if (doubled) c.combatRounds.poiseDouble = { player: true };
    c.piles.hand.push({ instanceId: 'bash', cardId: 'bashingBlow', upgraded: false });
    dispatch(c, { type: 'playCard', cardInstanceId: 'bash', targetId: enemy.id });
    const before = enemy.poiseMeter.value;
    endTurnDeclining(c);
    assert.equal(c.combatRounds.poiseDouble.player ?? false, false, 'the flag is spent');
    return enemy.poiseMeter.value - before;
  };
  const plain = poiseDealt(false);
  assert.ok(plain >= 4, `fixture: Bashing Blow deals its 4 Poise damage (${plain} with the relic)`);
  assert.equal(poiseDealt(true), plain * 2, 'the flagged side\'s landed hit deals double, its riders included');
});

// Codex P2 on PR #1953: a queued card is priced as a live play prices it, after its cardPreparing triggers. A feat that
// grants a Mana discount as the card prepares makes a Mana card free in cardPlayCosts; the queue must agree, and the
// commit must not charge it again or leave the discount charge behind.
test('the queue prices a card after its cardPreparing triggers, as cardPlayCosts does; the commit pays nothing more', () => {
  let found = null;
  for (const classId of ['starseer', 'herald', 'reaver', 'rogue']) {
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const c = fight({ classId, seed, expansion: 1 });
      const card = c.piles.hand.find((x) => cardKind(resolveCard(registries, x)) === 'attack' && cardPlayCosts(c, x.instanceId).mana >= 1);
      if (card) found = { classId, seed, id: card.instanceId };
    }
    if (found) break;
  }
  assert.ok(found, 'fixture: a Mana attack in some opening hand');
  const c = fixRoundRoll(fight({ classId: found.classId, seed: found.seed, expansion: 1 }), 0.999);
  const discount = { op: 'grantCardCharge', target: 'self', key: 'feat:prep-discount', manaDiscount: 9 };
  c.propertyMounts[triggerOwnerKey(c, c.player)].prepDiscount = { kind: 'feat', id: 'prep-discount',
    rules: [{ triggers: [{ on: 'cardPreparing', if: { p: 'eventSourceIsOwner' }, do: [discount] }] }] };
  c.player.mana = 0;
  assert.equal(cardPlayCosts(c, found.id).mana, 0, 'fixture: the preview prices it free');
  dispatch(c, { type: 'playCard', cardInstanceId: found.id, targetId: liveEnemy(c).id });
  const record = c.combatRounds.playerQueue.find((r) => r.instanceId === found.id);
  assert.equal(record?.paid.mana, 0, 'the queue pays the preview price');
  endTurnDeclining(c);
  assert.ok(c.eventLog.some((e) => e.type === 'cardPlayed' && e.cardInstanceId === found.id), 'the card resolves at the commit');
  assert.equal(c.player.abilityRiders?.charges?.['feat:prep-discount'], undefined, 'the discount the card prepared is spent by it, once');
});

// Review follow-up: a queued card's cardPreparing fires at the commit, before any later queued card. Pricing a later
// card must count it as fired: with a once-a-turn preparing discount and two Mana cards queued, only the first is free.
test('a once-per-turn preparing discount prices only the first of two queued Mana cards free', () => {
  let found = null;
  for (const classId of ['starseer', 'herald', 'reaver', 'rogue']) {
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const c = fight({ classId, seed, expansion: 1 });
      const mana = c.piles.hand.filter((x) => cardPlayCosts(c, x.instanceId).mana >= 1);
      if (mana.length >= 2) found = { classId, seed, ids: mana.slice(0, 2).map((x) => x.instanceId) };
    }
    if (found) break;
  }
  assert.ok(found, 'fixture: two Mana cards in some opening hand');
  const c = fixRoundRoll(fight({ classId: found.classId, seed: found.seed, expansion: 1 }), 0.999);
  const full = found.ids.map((id) => cardPlayCosts(c, id).mana);
  const discount = { op: 'grantCardCharge', target: 'self', key: 'feat:prep-once', manaDiscount: 9 };
  c.propertyMounts[triggerOwnerKey(c, c.player)].prepOnce = { kind: 'feat', id: 'prep-once',
    rules: [{ triggers: [{ on: 'cardPreparing', limitPerTurn: 1, if: { p: 'eventSourceIsOwner' }, do: [discount] }] }] };
  c.player.mana = 20;
  c.player.energy = 20;
  const queue = (id) => {
    const card = c.piles.hand.find((x) => x.instanceId === id);
    const needsTarget = cardKind(resolveCard(registries, card)) === 'attack';
    try { dispatch(c, { type: 'playCard', cardInstanceId: id, ...(needsTarget ? { targetId: liveEnemy(c).id } : {}) }); }
    catch { dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: liveEnemy(c).id }); }
    return c.combatRounds.playerQueue.find((r) => r.instanceId === id).paid.mana;
  };
  assert.equal(queue(found.ids[0]), 0, 'the first queued card takes the once-a-turn discount');
  assert.equal(queue(found.ids[1]), full[1], 'the second pays its full Mana: the trigger has fired for the first');
});

// Codex P2 on PR #1953: the round's own combatants keep the HP they started with. An enemy a live card kills while
// another lives on must not act in the timeline after that: no exchange is credited for its queued attack.
test('an enemy a queued card kills mid-round takes no later timeline entry: its attack is not credited', () => {
  const momentumOf = (killedQueues) => {
    const reg = registriesWithMoveSpeeds({ slash: -5, guard: -5, warcry: -5 });
    const run = createRunState({ seed: SEED, classId: 'reaver', registries: reg, combatExpansionVersion: 1,
      profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true, [MOMENTUM_KEY]: true } } });
    const c = fixRoundRoll(createRunCombat({ registries: reg, rng: createRng(SEED), run, enemyIds: [ENEMY, ENEMY], settings: {} }), 0.999);
    const [doomed, other] = c.enemies;
    doomed.hp = 1;
    c.combatRounds.enemyQueues[doomed.id] = killedQueues ? [{ moveId: 'slash', sp: 1 }] : [];
    c.combatRounds.enemyQueues[other.id] = [];
    dispatch(c, { type: 'playCard', cardInstanceId: attackCard(c).instanceId, targetId: doomed.id });
    endTurnDeclining(c);
    assert.equal(doomed.alive, false, 'fixture: the queued card kills it before its Slash');
    assert.ok(other.alive, 'fixture: the other enemy lives, so the round goes on');
    return c.combatRounds.momentum[doomed.id] ?? 0;
  };
  assert.equal(momentumOf(true), momentumOf(false), 'the dead enemy\'s queued Slash credits nothing');
});

test('scopes the delayed Poise multiplier to payload completion, not reaction attacks', () => {
  const source = readFileSync(new URL('../src/engine/combat.js', import.meta.url), 'utf8');
  const expansionSource = readFileSync(new URL('../src/engine/combatExpansionActions.js', import.meta.url), 'utf8');
  assert.match(source, /action\.meta\?\.roundPoiseMultiplier/, 'the queue reads scope from the action being executed');
  assert.match(source, /action\.meta = \{ \.\.\.action\.meta, roundPoiseMultiplier:/, 'each delayed payload action carries the scope');
  assert.match(source, /completionMeta = roundPoiseMultiplier/, 'the payload carries its scope through completion');
  assert.match(expansionSource, /meta: \{ \.\.\.completionMeta, expansionGroup: group \}/,
    'guard-break and trait completion run under the delayed payload scope');
  assert.match(source, /executeMovePayload\(combat, enemy, move, moveId, \{ roundPoiseMultiplier \}\)/, 'the delayed move passes its saved scope to its payload');
  assert.doesNotMatch(source, /cursor\.roundPoiseMultiplier/, 'the whole reaction drain is never globally scoped');
});
