// Combat Rounds Preview, solo adapter (SPEC §4.11, PREVIEW-PLAN P3a): queueing, unqueueing, the
// End Turn commit that runs the timeline with live effects, and the preview-off golden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { cardKind } from '../src/model/tree.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';

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
function fight({ preview = true, seed = SEED, classId = 'reaver', reg = registries, expansion = 1 } = {}) {
  const run = createRunState({ seed, classId, registries: reg, combatExpansionVersion: expansion, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: preview } } });
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
  for (const classId of ['starseer', 'reaver', 'rogue', 'herald']) {
    const c = fight({ classId, expansion: 2 });
    for (const card of c.piles.hand) {
      const cost = cardPlayCosts(c, card.instanceId);
      if (cost.mana > 0 && cost.energy <= c.player.energy && cost.mana <= c.player.mana) { found = { c, card, cost }; break; }
    }
    if (found) break;
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

test('each enemy queues its moves from a 3 SP pool, one SP per move unless the move says otherwise', () => {
  assert.equal(Rounds.ENEMY_SP, 3);
  const c = fight();
  for (const enemy of c.enemies.filter((e) => e.alive)) {
    const queue = c.combatRounds.enemyQueues[enemy.id];
    assert.ok(queue.length >= 1, `${enemy.id} queues at least one move`);
    const spent = queue.reduce((sum, e) => sum + e.sp, 0);
    assert.ok(spent <= Rounds.ENEMY_SP, `${enemy.id} spends ${spent} SP of ${Rounds.ENEMY_SP}`);
    assert.equal(enemy.intent.moveId, queue[0].moveId, 'slot 0 is the intent the existing code reads');
  }
});

test('the queue builder respects the opener, costs, and stops when the next move would overspend', () => {
  const def = { firstMove: 'open', moves: { open: {}, a: {}, b: { sp: 2 } } };
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
  // Player Strike: speed 0 + DEX base 5 + d4 4 = 9 (gorefireSlash has no speed-mods row). Every enemy
  // move gets the same speed S, so an enemy action totals S + 4 and a later move never passes an earlier
  // one. The queue is whatever the enemy rolled; only the order against the Strike is asserted.
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
  const slow = order(0);
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
  const c = fixRoundRoll(fight(), 0.999);
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
// living enemy, reactions set off).
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
  assert.equal(createHash('sha256').update(all).digest('hex'), 'df909d59130b26ab1523191b0e1386835bcf2ad7c944e32f8de5ffc6addb5d12');
  assert.equal(all.length, 289603);
});
