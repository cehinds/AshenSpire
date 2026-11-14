// src/ui/models/CombatRoundsScreenModel.js — the combat screen's follow-up rules (SPEC §4.9, §4.6a).
// Headless: no DOM. combatRoundsScreen.js draws what these return.
//
// Perception and reads: an enemy's visible actions are 1 + the player's perception level. The first is
// today's intent, which the engine already reads exact or hidden (previewIntent). A follow-up has no read
// of its own (the engine rolls one read per enemy per round), so it takes that same read: exact shows its
// icon at stage 3, a hidden read shows `?`. Actions beyond the read count always show `?`.

// Stage 3 is the whole action; stage 0 is hidden. Today's read is all-or-nothing.
import { FixCorePerceptionRollOff } from '../../model/fixCoreMechanics.js';

export const READ_EXACT = 3;
export const READ_HIDDEN = 0;

/** perceptionLevel(combat) → the player's perception level (0 when none). With the perception roll off (owner, 2026-11-14) every action is read, so no level caps the row. */
export function perceptionLevel(combat) {
  if (FixCorePerceptionRollOff(combat?.fixCoreRules || combat?.gameProfile?.fixCoreRules)) return Infinity;
  const level = Number(combat?.skills?.perception?.level);
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

/** readStage(intent) → READ_EXACT when today's intent read is exact, READ_HIDDEN otherwise. */
export function readStage(intent) {
  return intent && intent.hidden !== true ? READ_EXACT : READ_HIDDEN;
}

/** Intent icon id (intentIcon.js) for an action's timeline stance. */
export function iconForStance(stance) {
  if (stance === 'attack' || stance === 'sweep') return 'attack';
  if (stance === 'smash') return 'smash';
  if (stance === 'block' || stance === 'evade') return 'defend';
  if (stance === 'counter') return 'counter';
  return 'prepare';
}

/**
 * followUpSymbols(queue, perception, stage) → the follow-up symbols of one enemy's intent box, in play order.
 * queue: the enemy's queued actions as timeline cards ({ stance }), first entry = the current action.
 * Returns [{ kind: 'action', icon } | { kind: 'unknown' }], one per follow-up.
 */
export function followUpSymbols(queue = [], perception = 0, stage = READ_HIDDEN) {
  const read = Math.max(0, Math.floor(Number(perception) || 0));
  return queue.slice(1).map((card, i) => (i < read && stage >= READ_EXACT
    ? { kind: 'action', icon: iconForStance(card?.stance) }
    : { kind: 'unknown' }));
}
