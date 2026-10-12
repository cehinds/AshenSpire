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
