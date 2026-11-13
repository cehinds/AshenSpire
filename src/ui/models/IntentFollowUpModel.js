// The "?" rule for an actor's remaining actions (owner, 2026-10-18): once an actor has played a move this turn and can
// still act, each remaining planned move shows its icon if the observer's Perception read of THAT move succeeded, else
// "?". Headless: no DOM, no rolls.
//
// Per-move read: the engine rolls the read once per move, as the move is presented (presentIntent), and records it with
// the move's outcome in `combat.followTrace[enemyId]` ([{ read, outcome }] in play order, no move id). This model only reads that
// trace, so it never re-rolls. The icon of a move is looked up ONLY for an entry whose own read succeeded; a failed
// read never reaches a symbol, the DOM, a data attribute, an aria label or a tooltip.
//
// Nothing about a move's fate shows before its own event: every remaining PLANNED follow-up stays in the row (icon if its
// own read passed, else "?") until its event plays in playback (played, refused for SP) or the turn ends / a stagger
// breaks it. The phase resolves before playback, so a charge, a refusal or a halt known to the trace is not used to
// drop an entry early. A move whose read is not recorded yet (a reaction window paused the phase before it) is "?".
import { stanceFor, moveKind } from '../../engine/combatRounds/stance.js';
import { iconForStance } from './CombatRoundsScreenModel.js';
import { enemyMoveCarrier } from '../../engine/combatCardTactics.js';
import { combatIntentStance } from '../../model/combatIntentVisibility.js';
import { combatIntentPresentation } from './CombatIntentModel.js';

/**
 * followUpPlan({ queue, def }) → the actor's turn plan, taken before its phase. queue: its planned follow-ups
 * ({ moveId }) in play order, the head excluded; def: its enemy definition, read for an icon only on a read entry.
 */
export function followUpPlan({ queue = [], def = null, enemyId = null, combat = null, offset = 0 } = {}) {
  const ids = Array.isArray(queue) ? queue.map(entry => entry?.moveId ?? null) : [];
  // `offset`: trace entries already made for follow-ups presented before this plan's slot 0 (a screen remounted
  // mid-turn rebuilds the plan from the remaining queue, while the live trace still holds the earlier moves).
  return { ids, def, enemyId, combat, offset: Math.max(0, Number(offset) || 0), total: ids.length, cursor: 0, headDone: false };
}

// The symbol is what the current-intent presentation draws for that move (same function, same profile), so a read
// follow-up shows exactly the icon it would show as the current intent: counter for a counter authored as a block,
// buff for a buff, cast for a spell. Called only for a slot whose read passed.
function iconFor(plan, index) {
  const move = plan.def?.moves?.[plan.ids[index]];
  if (!move) return 'prepare';
  const enemy = plan.combat?.enemies?.find(row => row.id === plan.enemyId);
  if (enemy) {
    try {
      const profile = enemyMoveCarrier(enemy, move, plan.ids[index], plan.combat).combatProfile || {};
      const intent = { kind: move.intent, moveId: plan.ids[index], combatProfile: profile, profile, hidden: false };
      intent.stance = combatIntentStance(intent, profile);
      return combatIntentPresentation(intent).parts[0]?.icon || 'prepare';
    } catch { /* fall through to the tags */ }
  }
  return iconForStance(stanceFor(moveKind(move), Array.isArray(move.tags) ? move.tags : []));
}

/**
 * remainingFollowUps(plan, trace) → the symbols for the planned moves after the cursor, in play order:
 * [{ kind: 'unknown' } | { kind: 'action', icon }]. An icon only where that slot's own recorded read passed.
 */
export function remainingFollowUps(plan, trace) {
  if (!plan) return [];
  const out = [];
  for (let i = plan.cursor; i < plan.total; i++) {
    out.push(Array.isArray(trace) && trace[(plan.offset || 0) + i]?.read === true ? { kind: 'action', icon: iconFor(plan, i) } : { kind: 'unknown' });
  }
  return out;
}

/**
 * advanceFollowUps(plan, trace) → the symbols after the next action event of one actor's turn. Call it once per
 * `enemyMoveStarted` (not a reaction), `enemyMoveUnavailable` or `enemyBurdenBlocked` of that actor, in order. The first call is the head
 * move, or the move whose reaction window a reload interrupted (its event comes after the resume), which owns no slot;
 * each later call consumes one slot. A charge emits none either, so its slot stays until the
 * turn ends. `trace` is the engine's `combat.followTrace[enemyId]`, possibly partial or absent.
 */
export function advanceFollowUps(plan, trace) {
  if (!plan) return [];
  if (!plan.headDone) plan.headDone = true;
  else {
    plan.cursor = Math.min(plan.total, plan.cursor + 1);
  }
  return remainingFollowUps(plan, trace);
}

/**
 * trimFollowUps(plan, dropped) → the symbols after an `enemyPlanTrimmed` receipt. The right-most `dropped` moves leave the
 * plan itself (ids and total), so a later advanceFollowUps can never bring a cancelled action back; the row only shrinks.
 */
export function trimFollowUps(plan, dropped = 0, trace = null) {
  if (!plan) return [];
  const count = Math.max(0, Math.min(Math.floor(Number(dropped) || 0), plan.total - plan.cursor));
  plan.ids = plan.ids.slice(0, plan.total - count);
  plan.total = plan.ids.length;
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
    planFor(id) { return plans.get(id) ?? null; },
    setRow(id, symbols) { rows.set(id, symbols); return symbols; },
    row(id, live = true) { return live ? rows.get(id) ?? null : null; },
    clearRow(id) { rows.delete(id); },
    clear() { rows.clear(); },
  };
}

/** Reduces each follow-up receipt once across playback and skip for this mount. */
export function CreateFollowUpReduction(followMemo)
{
    const followReduced = new WeakSet();
    return function reduceFollowRows(events, disp, followTrace)
    {
        for (const e of events)
        {
            if (followReduced.has(e))
            {
                continue;
            }
            const row = (id, symbols) =>
            {
                const symbolsNow = followMemo.setRow(id, symbols);
                if (disp?.ents[id])
                {
                    disp.ents[id].followUps = symbolsNow;
                }
            };
            switch (e.type)
            {
                case 'enemyMoveStarted':
                    if (e.reaction)
                    {
                        continue;
                    }
                    // The actor has acted and may still have SP: its remaining queue is "?" unless the read passed.
                    row(
                        e.sourceId,
                        advanceFollowUps(
                            disp?.followPlans?.[e.sourceId] ?? followMemo.planFor(e.sourceId),
                            followTrace?.[e.sourceId],
                        ),
                    );
                    break;
                case 'enemyBurdenBlocked':
                case 'enemyMoveUnavailable':
                {
                    const id = e.sourceId ?? e.targetId;
                    row(
                        id,
                        advanceFollowUps(
                            disp?.followPlans?.[id] ?? followMemo.planFor(id),
                            followTrace?.[id],
                        ),
                    );
                    break;
                }
                case 'enemyPlanTrimmed':
                {
                    // The right-most planned moves leave the row; the row only shrinks during the enemy turn.
                    // The underlying plan (ids and total) shrinks too, so a later enemyMoveStarted cannot rebuild a cancelled intent.
                    const plan = disp?.followPlans?.[e.sourceId] ?? followMemo.planFor(e.sourceId);
                    if (plan)
                    {
                        row(
                            e.sourceId,
                            trimFollowUps(plan, e.dropped?.length || 0, followTrace?.[e.sourceId]),
                        );
                    }
                    else
                    {
                        const now = followMemo.row(e.sourceId, true)
                            ?? disp?.ents[e.sourceId]?.followUps ?? [];
                        row(
                            e.sourceId,
                            now.slice(0, Math.max(0, now.length - (e.dropped?.length || 0))),
                        );
                    }
                    break;
                }
                case 'enemyStaggered':
                    // A stagger breaks the rest of that enemy's plan: its remaining moves leave the row with the event.
                    if (followMemo.row(e.targetId, true)?.length || disp?.ents[e.targetId]?.followUps?.length)
                    {
                        row(e.targetId, []);
                    }
                    break;
                case 'enemyTurnEnd':
                case 'playerTurnStart':
                    // The turn is over: a charge or a halt that sent no event of its own leaves the row now.
                    followMemo.clear();
                    for (const id of Object.keys(disp?.ents || {}))
                    {
                        if (disp.ents[id].followUps?.length)
                        {
                            disp.ents[id].followUps = [];
                        }
                    }
                    break;
                case 'enemyActorTurnStarted':
                    // Nothing goes: the seeded row (snapshot and memo) stays until the head move or a stagger speaks, so "??" does
                    // not blink out and back. Rows of an earlier turn are already gone (enemyTurnEnd / playerTurnStart clear them).
                    break;
                default:
                    continue;
            }
            followReduced.add(e);
        }
    };
}
