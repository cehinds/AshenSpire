// Combat rounds preview (PREVIEW-PLAN P1): a pausable round whose whole state is plain JSON.
//
// startRound() returns plain data. stepRound() resolves one timeline entry. When a player-targeted
// attack has a reaction on offer, stepRound stops before that attack and returns awaitingReaction;
// answerReaction() resumes it with the card played (or null). finishRound() settles momentum.
//
// The rng and the Map tables (stanceAdvantage, evadeTable) are passed on every call and never
// stored, so JSON.parse(JSON.stringify(round)) is a complete save at any boundary. The rules are
// the ones createRound() in timeline.js applies; this file only splits the same steps across calls.
// Headless: no DOM, no storage, no timers, no node: imports.
import {
  beginRound,
  chooseReaction,
  enterEntry,
  reactionOffer,
  resolveAttackEntry,
  settleRound,
  assertDefenceNumbers,
} from './timeline.js';

const KIND = 'combatRound';
const VERSION = 1;

function requireRng(rng) {
  if (typeof rng !== 'function') throw new TypeError('rng must be a function returning [0, 1)');
}

function assertRound(round) {
  if (!round || typeof round !== 'object' || round.kind !== KIND || round.v !== VERSION) {
    throw new TypeError('not a combat round from startRound()');
  }
}

// The per-call context. The rng and the tables come from the hooks of this call only.
function callContext(round, hooks) {
  assertRound(round);
  if (!hooks || typeof hooks !== 'object') throw new TypeError('hooks must be an object');
  requireRng(hooks.rng);
  return {
    options: { rng: hooks.rng, evadeTable: hooks.evadeTable },
    run: { queuedIds: round.queuedIds, pending: round.pending, stanceTable: hooks.stanceAdvantage ?? null },
  };
}

// The start events (momentum decay) come out once, with the first call that returns events.
function takeStartEvents(round) {
  const events = round.startEvents;
  round.startEvents = [];
  return events;
}

// The fight state as plain data. makeFight() keeps the evasion-cards.csv table as a Map on each
// combatant; a round keeps it as a plain object so the round can be saved as JSON. evadeCardBonus()
// reads both the same way.
function plainState(state) {
  if (!state || typeof state !== 'object' || !state.combatants) return state;
  const combatants = Object.fromEntries(Object.keys(state.combatants).map((id) => {
    const c = state.combatants[id];
    return [id, c.evadeCards instanceof Map ? { ...c, evadeCards: Object.fromEntries(c.evadeCards) } : c];
  }));
  return { ...state, combatants };
}

// Starts a round from a fight state (makeFight() or a finished round's state).
// opts: { queues, rng, merge?, decay? }. The rng is used for the d4 rolls here only.
export function startRound(state, opts = {}) {
  if (!opts || typeof opts !== 'object') throw new TypeError('opts must be an object');
  requireRng(opts.rng);
  const started = beginRound(plainState(state), opts);
  return {
    kind: KIND,
    v: VERSION,
    timeline: started.timeline,
    idx: 0,
    settled: false,
    startEvents: started.startEvents,
    cur: started.cur,
    queuedIds: started.run.queuedIds,
    pending: started.run.pending,
    awaiting: null,
  };
}

// Resolves the next timeline entry. hooks: { rng, stanceAdvantage?, evadeTable?, }.
// Returns { events, awaitingReaction, done }:
//   awaitingReaction  null, or { attack, eligible } when a player-targeted attack has a reaction on
//                     offer. That attack is not resolved yet: answerReaction() resolves it.
//   done              true once every entry has resolved. finishRound() then settles the round.
export function stepRound(round, hooks = {}) {
  const ctx = callContext(round, hooks);
  if (round.awaiting) throw new TypeError('the round is waiting for a reaction: call answerReaction() first');
  const events = takeStartEvents(round);
  if (round.settled) return { events, awaitingReaction: null, done: true };
  const entries = round.timeline.entries;
  if (round.idx < entries.length) {
    const entry = entries[round.idx];
    const index = round.idx;
    round.idx += 1;
    if (enterEntry(round.cur, entry, events) === 'attack') {
      const offer = reactionOffer(round.cur, entry, ctx.run);
      if (offer) {
        const eligible = offer.eligible.map((c) => ({ ...c }));
        const attack = { ...offer.attack };
        round.awaiting = { index, attack, eligible };
        return {
          events,
          awaitingReaction: { attack: { ...attack }, eligible: eligible.map((c) => ({ ...c })) },
          done: false,
        };
      }
      resolveAttackEntry(round.cur, entry, events, ctx.options, ctx.run, null);
    }
  }
  return { events, awaitingReaction: null, done: round.idx >= entries.length };
}

// Answers the reaction that stepRound() paused for. cardId is one of the eligible card ids, or
// null for no reaction. A card that was not eligible throws and changes nothing.
// Returns { events, awaitingReaction, done } like stepRound().
export function answerReaction(round, cardId, hooks = {}) {
  const ctx = callContext(round, hooks);
  if (!round.awaiting) throw new TypeError('the round is not waiting for a reaction');
  const { index, eligible } = round.awaiting;
  const pick = cardId === null || cardId === undefined ? null : { id: cardId };
  const chosen = chooseReaction(eligible, pick);
  // Validate before the pause is cleared, so a bad card throws and the round still waits.
  if (chosen) assertDefenceNumbers(chosen);
  const entry = round.timeline.entries[index];
  round.awaiting = null;
  const events = [];
  resolveAttackEntry(round.cur, entry, events, ctx.options, ctx.run, chosen);
  return { events, awaitingReaction: null, done: round.idx >= round.timeline.entries.length };
}

// Settles the round once every entry has resolved: each enemy's momentum delta is added once and
// clamped, and the round-scoped effects are cleared. Returns { events, state }, where `state` is
// the fight state after the round, as createRound().resolveAll() returns it. A second call
// returns the same state with no new events.
export function finishRound(round) {
  assertRound(round);
  if (round.awaiting) throw new TypeError('the round is waiting for a reaction: call answerReaction() first');
  if (round.idx < round.timeline.entries.length) throw new TypeError('the round has entries left to step');
  const events = takeStartEvents(round);
  if (!round.settled) {
    round.settled = true;
    settleRound(round.cur, round.pending, events);
  }
  return { events, state: structuredClone(round.cur) };
}
