// Combat Rounds Preview (SPEC §4.11), P3b: reactions. Round-level rules first (liveDefence), then the
// solo adapter's pause, answer, decline, save/restore and toggle behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFight } from '../src/engine/combatRounds/timeline.js';
import { startRound, stepRound, finishRound } from '../src/engine/combatRounds/round.js';
import { parseEvasionArmor, parseEvasionCards, parseEvadeBonus, parseStanceAdvantage } from '../src/engine/combatRounds/resolver.js';
import * as content from '../src/content/combatRounds.js';

const TABLES = { armor: parseEvasionArmor(content.EVASION_ARMOR_CSV), cards: parseEvasionCards(content.EVASION_CARDS_CSV) };
const STANCE = parseStanceAdvantage(content.STANCE_ADVANTAGE_CSV);
const EVADE = parseEvadeBonus(content.EVADE_BONUS_CSV);
const HOOKS = { rng: () => 0.999, evadeTable: EVADE, stanceAdvantage: STANCE };

const card = (id, kind, target, extra = {}) => ({ id, kind, target, speed: 0, sp: 1, momentumGain: 1, tags: [], stance: null, ...extra });

// Runs one round to its end and returns every event, in order.
function runRound(queues, { liveDefence = true } = {}) {
  const state = makeFight([
    { id: 'player', side: 'player', name: 'P', attrs: {}, hp: 50, sp: 3, hand: [] },
    { id: 'e1', side: 'enemy', name: 'A', attrs: {}, hp: 50, sp: 3 },
    { id: 'e2', side: 'enemy', name: 'B', attrs: {}, hp: 50, sp: 3 },
  ], TABLES);
  const round = startRound(state, { queues, rng: HOOKS.rng, liveDefence });
  const events = [];
  for (let guard = 0; guard < 50; guard += 1) {
    const step = stepRound(round, HOOKS);
    events.push(...step.events);
    if (step.done) break;
  }
  events.push(...finishRound(round).events);
  return events;
}

// Each enemy's attacks aim at the player. The player's Counter is the fastest action, so it acts first.
const QUEUES = {
  player: [card('counter', 'counter', 'e1', { speed: 9 })],
  e1: [card('a1', 'attack', 'player', { speed: 5, damage: 1 }), card('a2', 'attack', 'player', { speed: 3, damage: 1 })],
  e2: [card('b1', 'attack', 'player', { speed: 4, damage: 1 })],
};

test('a queued Counter answers only the next attack from its target, then is spent', () => {
  const events = runRound(QUEUES);
  const actions = events.filter((e) => e.type === 'action').map((e) => e.cardId);
  assert.deepEqual(actions, ['counter', 'a1', 'b1', 'a2'], 'the Counter takes its place at its speed, ahead of the attacks it can answer');
  const fired = events.filter((e) => e.type === 'counterFired');
  assert.equal(fired.length, 1, 'one attack is answered: the next attack from the Counter\'s target (A), and no other');
  assert.equal(fired[0].target, 'e1');
  assert.equal(fired[0].cardId, 'counter');
  // The attack that comes just before the reply is A's first attack, not B's or A's second.
  const i = events.indexOf(fired[0]);
  const before = events.slice(0, i).filter((e) => e.type === 'hit').at(-1);
  assert.equal(before.by, 'e1', 'the reply follows the attack from the Counter\'s target');
});

test('under liveDefence a faster queued Counter does not cancel the attack it answers', () => {
  const events = runRound(QUEUES);
  assert.equal(events.filter((e) => e.type === 'countered' && e.cancelled).length, 0, 'the timeline does not cancel attacks');
  assert.equal(events.filter((e) => e.type === 'hit' && e.by === 'e1').length, 2, 'both of A\'s attacks still roll to hit');
});

test('the timeline keeps its own Counter cancel without liveDefence (the preview rules do not change it)', () => {
  const events = runRound(QUEUES, { liveDefence: false });
  assert.ok(events.some((e) => e.type === 'countered' && e.cancelled === true), 'a faster Counter cancels its attack when liveDefence is off');
});

// --- The solo adapter: the End Turn commit pauses for a reaction (SPEC §4.10, §4.11) -------------------

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { COMBAT_ROUNDS_KEY } from '../src/model/combatRounds.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';

const registries = createRegistries(contentBundle);
const ENEMY = 'wanderingSoldier';
const SEED = 5;

// A preview fight (expanded rules, so reactions are on). The enemy's round is fixed to one attack on the player.
function fight({ reactions = true, enemyIds = [ENEMY] } = {}) {
  const run = createRunState({ seed: SEED, classId: 'reaver', registries, profileMeta: { settings: { [COMBAT_ROUNDS_KEY]: true } } });
  const c = createRunCombat({ registries, rng: createRng(SEED), run, enemyIds, settings: {} });
  for (const enemy of c.enemies.filter((e) => e.alive)) {
    const def = registries.enemies.get(enemy.enemyId);
    const attackMove = Object.keys(def.moves).find((id) => def.moves[id].damage != null || def.moves[id].intent === 'attack');
    assert.ok(attackMove, 'fixture: the enemy has an attack move');
    c.combatRounds.enemyQueues[enemy.id] = [{ moveId: attackMove, sp: 1 }];
  }
  if (!reactions) dispatch(c, { type: 'setReactions', enabled: false });
  return c;
}

// Puts a card in hand, under a known instance id.
function addToHand(c, cardId, instanceId) {
  c.piles.hand.push({ instanceId, cardId, upgraded: false });
  return c.piles.hand.at(-1);
}

const playedCount = (c, instanceId) => c.eventLog.filter((e) => e.type === 'cardPlayed' && e.cardInstanceId === instanceId).length;
const cardPlayedEvent = (c, instanceId) => c.eventLog.find((e) => e.type === 'cardPlayed' && e.cardInstanceId === instanceId);

test('pause and answer with Counter: the commit waits, the chosen Counter is paid and played, then the turn ends', () => {
  const c = fight();
  assert.equal(c.reactionRulesVersion, 1, 'fixture: reactions are on in an expanded fight');
  addToHand(c, 'guardCounter', 'rx-counter');
  const cost = cardPlayCosts(c, 'rx-counter');
  const turn = c.turn;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.phase, 'player', 'the turn is still open while the commit waits');
  assert.ok(c.combatRounds.paused, 'the round record holds the pause');
  assert.ok(c.pendingReaction, 'the reaction choice is offered through the existing modal');
  const offered = c.pendingReaction.options.find((o) => o.id === 'rx-counter');
  assert.ok(offered, 'the added Counter is on offer');
  assert.equal(offered.staminaCost, cost.stamina, 'the offer shows the Stamina the Counter pays');
  assert.equal(playedCount(c, 'rx-counter'), 0, 'nothing is played before the choice');
  dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'rx-counter' });
  assert.equal(playedCount(c, 'rx-counter'), 1, 'the Counter is played once');
  assert.equal(cardPlayedEvent(c, 'rx-counter').staminaSpent, cost.stamina, 'it pays its Stamina cost as SP');
  assert.equal(c.pendingReaction, undefined);
  assert.equal(c.combatRounds.paused, undefined, 'the pause is cleared');
  assert.equal(c.turn, turn + 1, 'the rest of the turn ran after the answer');
});

test('pause and answer with Evade: the chosen Evade is played as a reaction, then the turn ends', () => {
  const c = fight();
  addToHand(c, 'evasiveGuard', 'rx-evade');
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction.options.some((o) => o.id === 'rx-evade'), 'the Evade is on offer');
  dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'rx-evade' });
  assert.equal(playedCount(c, 'rx-evade'), 1, 'the Evade is played once');
  assert.ok(c.combatRounds.paused === undefined && c.pendingReaction === undefined);
});

test('decline: Back resolves the attack with no reaction, and the card stays unplayed', () => {
  const c = fight();
  addToHand(c, 'guardCounter', 'rx-counter');
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction, 'a reaction is offered');
  const turn = c.turn;
  dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: null });
  assert.equal(playedCount(c, 'rx-counter'), 0, 'declining plays nothing');
  assert.equal(c.eventLog.find((e) => e.type === 'combatReactionChosen')?.cardInstanceId, null);
  assert.equal(c.pendingReaction, undefined);
  assert.equal(c.turn, turn + 1, 'the turn ends');
});

test('a save taken during the pause restores the round and the offer, and the answer resumes from there', () => {
  const c = fight();
  addToHand(c, 'guardCounter', 'rx-counter');
  dispatch(c, { type: 'endTurn' });
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(c)));
  const counters = c.rng.getCounters();
  assert.ok(saved.combatRounds.paused, 'the pause is in the save');
  assert.equal(saved.pendingReaction.id, c.pendingReaction.id);
  // The caller's rng carries the run's stream counters (main.js restores it the same way).
  const restored = restoreCombatSnapshot({ registries, rng: createRng(SEED, counters), snapshot: saved });
  assert.deepEqual(restored.combatRounds, c.combatRounds, 'the round record survives the save unchanged');
  assert.deepEqual(restored.pendingReaction, c.pendingReaction);
  const turn = restored.turn;
  dispatch(restored, { type: 'chooseReaction', offerId: restored.pendingReaction.id, optionId: 'rx-counter' });
  assert.equal(playedCount(restored, 'rx-counter'), 1, 'the restored fight plays the Counter once');
  assert.equal(restored.turn, turn + 1, 'and ends the turn');
});

test('with reactions off, the commit never pauses', () => {
  const c = fight({ reactions: false });
  addToHand(c, 'guardCounter', 'rx-counter');
  const turn = c.turn;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.pendingReaction, undefined, 'no offer');
  assert.equal(c.combatRounds.paused, undefined, 'no pause');
  assert.equal(c.turn, turn + 1, 'the turn runs straight through');
  assert.equal(playedCount(c, 'rx-counter'), 0);
});

test('a reaction the player cannot pay for is not offered', () => {
  const c = fight();
  addToHand(c, 'guardCounter', 'rx-counter');
  c.player.energy = 0;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.pendingReaction, undefined, 'no Stamina left, no offer');
  assert.equal(c.combatRounds.paused, undefined);
});

test('a card queued this turn is not offered as a reaction, and it resolves once', () => {
  const c = fight();
  const attack = c.piles.hand.find((card) => {
    const cost = cardPlayCosts(c, card.instanceId);
    return cost.energy <= c.player.energy && cost.mana <= c.player.mana && resolveCard(registries, card).type === 'attack';
  });
  assert.ok(attack, 'fixture: an attack is in hand');
  dispatch(c, { type: 'playCard', cardInstanceId: attack.instanceId, targetId: c.enemies.find((e) => e.alive).id });
  addToHand(c, 'guardCounter', 'rx-counter');
  dispatch(c, { type: 'endTurn' });
  if (c.pendingReaction) {
    assert.ok(!c.pendingReaction.options.some((o) => o.id === attack.instanceId), 'a queued card is never an option');
    dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'rx-counter' });
  }
  const pile = [...c.piles.discard, ...c.piles.exhaust].filter((x) => x.instanceId === attack.instanceId).length;
  assert.equal(pile, 1, 'the queued card leaves hand once, whether it landed or missed');
  assert.ok(playedCount(c, attack.instanceId) <= 1, 'its effects run at most once');
  assert.equal(c.combatRounds.playerQueue.length, 0, 'the queue is empty after the commit');
});

// --- P3b fix 1 (SPEC §4.10, §4.11): the Mana of each reaction is paid from what is left at its pause --------

test('two pauses cannot overspend Mana: the second Counter is not offered once the first has used the Mana', () => {
  const c = fight({ enemyIds: [ENEMY, 'blightHound'] });
  addToHand(c, 'frostCounter', 'fc1');
  addToHand(c, 'frostCounter', 'fc2');
  c.player.mana = 1;
  assert.equal(cardPlayCosts(c, 'fc1').mana, 1, 'fixture: a frostCounter costs 1 Mana');
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction.options.some((o) => o.id === 'fc1') && c.pendingReaction.options.some((o) => o.id === 'fc2'), 'fixture: both Counters are on offer at the first pause');
  dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'fc1' });
  assert.equal(c.player.mana, 0, 'the first Counter is paid');
  if (c.pendingReaction) {
    assert.ok(!c.pendingReaction.options.some((o) => o.id === 'fc2'), 'the second pause no longer offers a Counter the Mana cannot pay for');
    assert.throws(() => dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'fc2' }), /available reaction/);
  }
  assert.ok(c.player.mana >= 0, 'Mana never goes negative');
  assert.equal(playedCount(c, 'fc2'), 0, 'the unaffordable Counter is not played');
});

test('a stale offer is refused by playRoundReaction with a clear error, and nothing is paid', () => {
  const c = fight({ enemyIds: [ENEMY, 'blightHound'] });
  addToHand(c, 'frostCounter', 'fc1');
  c.player.mana = 1;
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction.options.some((o) => o.id === 'fc1'), 'fixture: the Counter is on offer');
  c.player.mana = 0; // the Mana is gone since the offer was made
  assert.throws(() => dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'fc1' }), /Mana/);
  assert.equal(c.player.mana, 0, 'nothing is paid');
  assert.equal(playedCount(c, 'fc1'), 0, 'nothing is played');
});

test('a control status that lands while a Counter is on offer makes the offer stale: playRoundReaction refuses it', () => {
  const c = fight();
  addToHand(c, 'guardCounter', 'gc1');
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction.options.some((o) => o.id === 'gc1'), 'fixture: the Counter is on offer');
  // A lock (Paralysis) lands on the player after the offer was made: the Counter is no longer playable.
  c.player.statuses = { ...(c.player.statuses || {}), paralysis: { stacks: 1 } };
  const energy = c.player.energy;
  assert.throws(() => dispatch(c, { type: 'chooseReaction', offerId: c.pendingReaction.id, optionId: 'gc1' }), /no longer be played as a reaction/);
  assert.equal(c.player.energy, energy, 'nothing is paid');
  assert.equal(playedCount(c, 'gc1'), 0, 'nothing is played');
});

// --- P3b fix 2 (SPEC §4.10, §4.11): a reaction is offered only when live would offer it -----------------

// The distinct card ids a fight offers at End Turn, with the preview on or off (live is the reference).
function offeredIds(enemyId, cardIds, { preview }) {
  const run = createRunState({ seed: SEED, classId: 'reaver', registries, profileMeta: { settings: preview ? { [COMBAT_ROUNDS_KEY]: true } : {} } });
  const c = createRunCombat({ registries, rng: createRng(SEED), run, enemyIds: [enemyId], settings: {} });
  cardIds.forEach((cardId, i) => addToHand(c, cardId, `${cardId}-${i}`));
  c.player.mana = 9;
  c.player.energy = 9;
  dispatch(c, { type: 'endTurn' });
  assert.ok(c.pendingReaction, `fixture: ${enemyId} offers a reaction at End Turn (preview ${preview ? 'on' : 'off'})`);
  return [...new Set(c.pendingReaction.options.map((o) => o.cardId))].sort();
}

test('a Counter whose coverage does not reach the attack is not offered (melee Counter vs a spell attack)', () => {
  // graveWisp's Drain is a spell attack at Near reach: the melee guardCounter does not cover it (SPEC §4.10).
  const ids = offeredIds('graveWisp', ['guardCounter', 'fireCounter'], { preview: true });
  assert.ok(!ids.includes('guardCounter'), 'the melee Counter is not on offer against a spell');
  assert.ok(ids.includes('fireCounter'), 'the spell Counter covers it');
});

test('a spell Counter is not offered against a melee attack', () => {
  // blightHound's Smash is a physical melee attack: fireCounter (spell coverage) does not cover it.
  const ids = offeredIds('blightHound', ['guardCounter', 'fireCounter'], { preview: true });
  assert.ok(ids.includes('guardCounter'), 'the melee Counter covers a melee attack');
  assert.ok(!ids.includes('fireCounter'), 'the spell Counter does not cover a melee attack');
});

test('the preview offers the same Counter and Evade cards as live, against a melee and a spell attack', () => {
  const cards = ['guardCounter', 'fireCounter', 'evasiveGuard', 'dodgeRoll'];
  for (const enemyId of ['blightHound', 'graveWisp']) {
    assert.deepEqual(offeredIds(enemyId, cards, { preview: true }), offeredIds(enemyId, cards, { preview: false }), `${enemyId}: preview matches live`);
  }
});

test('Evade is offered as a reaction only where live offers it: as a melee Counter (its resolved maneuver is counter)', () => {
  // Live v2 resolves evasiveGuard and dodgeRoll as maneuver:counter, melee coverage, so they answer a melee attack only.
  assert.ok(offeredIds('blightHound', ['evasiveGuard'], { preview: false }).includes('evasiveGuard'), 'live: an Evade answers a melee attack');
  assert.ok(!offeredIds('graveWisp', ['guardCounter', 'fireCounter', 'evasiveGuard'], { preview: false }).includes('evasiveGuard'), 'live: an Evade does not answer a spell');
  const onMelee = offeredIds('blightHound', ['evasiveGuard'], { preview: true });
  assert.ok(onMelee.includes('evasiveGuard'), 'preview: the Evade answers a melee attack, as live does');
});
