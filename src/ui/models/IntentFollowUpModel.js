// The "?" rule for an actor's remaining actions (owner, 2026-10-18): once an actor has played a move this turn and can
// still act, each remaining planned move shows its icon if the observer's Perception read of THAT move succeeded, else
// "?". Headless: no DOM, no rolls.
//
// Per-move read: the engine rolls the read once per move, as the move is presented (presentIntent), and records it with
// the move's outcome in `combat.followTrace[enemyId]` ([{ read, outcome }] in play order, no move id). This model only reads that
// trace, so it never re-rolls. The icon of a move is looked up ONLY for an entry whose own read succeeded; a failed
// read never reaches a symbol, the DOM, a data attribute, an aria label or a tooltip.
//
// Only moves that can still play count: outcome 'played'. A follow-up that turned into a charge, was refused for SP or
// by a burden, or sits after a stagger halt, is not shown (the trace never holds moves past a halt or a charge).
import { stanceFor, moveKind } from '../../engine/combatRounds/stance.js';
import { iconForStance } from './CombatRoundsScreenModel.js';

const SKIPPED = new Set(['charging', 'blocked']);

/**
 * followUpPlan({ queue, def }) → the actor's turn plan, taken before its phase. queue: its planned follow-ups
 * ({ moveId }) in play order, the head excluded; def: its enemy definition, read for an icon only on a read entry.
 */
export function followUpPlan({ queue = [], def = null } = {}) {
  const ids = Array.isArray(queue) ? queue.map(entry => entry?.moveId ?? null) : [];
  return { ids, def, total: ids.length, cursor: 0, headDone: false };
}

function iconFor(plan, index) {
  const move = plan.def?.moves?.[plan.ids[index]];
  return move ? iconForStance(stanceFor(moveKind(move), Array.isArray(move.tags) ? move.tags : [])) : 'prepare';
}

/**
 * remainingFollowUps(plan, trace) → the symbols for the moves still to play after the cursor, in play order:
 * [{ kind: 'unknown' } | { kind: 'action', icon }]. [] when no trace exists (nothing is planned or it has not run).
 */
export function remainingFollowUps(plan, trace) {
  if (!plan || !Array.isArray(trace)) return [];
  const out = [];
  for (let i = plan.cursor; i < trace.length; i++) {
    const entry = trace[i];
    if (entry?.outcome !== 'played') continue;
    out.push(entry.read === true ? { kind: 'action', icon: iconFor(plan, i) } : { kind: 'unknown' });
  }
  return out;
}

/**
 * advanceFollowUps(plan, trace) → the symbols after the next action event of one actor's turn. Call it once per
 * `enemyMoveStarted` (not a reaction) or `enemyMoveUnavailable` of that actor, in order. The first call is the head
 * move, which is not in the trace; each later call consumes one trace entry (skipping charges and burden stops, which
 * emit no action event). `trace` is the engine's `combat.followTrace[enemyId]`.
 */
export function advanceFollowUps(plan, trace) {
  if (!plan) return [];
  if (!plan.headDone) plan.headDone = true;
  else {
    while (trace?.[plan.cursor] && SKIPPED.has(trace[plan.cursor].outcome)) plan.cursor++;
    plan.cursor++;
  }
  return remainingFollowUps(plan, trace);
}

/**
 * createFollowMemo() → the per-screen memory that outlives the playback record. A reaction window opens mid-turn with
 * the playback state cleared and the resumed dispatch snapshots again, so the plan (built once, before the phase) and
 * the row on screen are kept here per enemy until the turn ends.
 *   plan(id, { resuming, build }): the kept plan while the same turn resumes, else a fresh one from build().
 *   setRow / row(id, live) / clearRow / clear: the symbols on screen; row() answers only while the enemy phase is live.
 */
export function createFollowMemo() {
  const plans = new Map(), rows = new Map();
  return {
    plan(id, { resuming = false, build }) {
      const kept = resuming ? plans.get(id) : null;
      const plan = kept || build?.() || null;
      if (plan) plans.set(id, plan); else plans.delete(id);
      return plan;
    },
    setRow(id, symbols) { rows.set(id, symbols); return symbols; },
    row(id, live = true) { return live ? rows.get(id) ?? null : null; },
    clearRow(id) { rows.delete(id); },
    clear() { rows.clear(); },
  };
}
