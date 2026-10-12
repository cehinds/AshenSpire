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
import { handRow, scaledCards } from '../src/model/handRules.js';
import { applyStatus } from '../src/engine/statuses.js';

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
