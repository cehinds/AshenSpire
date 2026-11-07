// src/engine/normalPreview.js — what a Core fight shows about an enemy's plan (SPEC §4.6, §4.9).
//
// The multi-action preview (the planned follow-up moves in the intent box) and the stance outline's reads.
// Momentum, which this file once tracked beside the combat-rounds system, was removed with it (cleanup 3i-A).
//
// Engine code only: no DOM.
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import { parseStanceAdvantage } from './combatRounds/resolver.js';
import { enemyTimelineCard, enemyMoveQuote, moveKind, stanceFor } from './combatRoundsAdapter.js';
import { STANCE_ADVANTAGE_CSV } from '../content/combatRounds.js';

const STANCE_TABLE = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);

/** The stance-advantage table (stance-advantage.csv) the target outline reads. */
export function normalStanceTable() {
  return STANCE_TABLE;
}

/** True when the fight shows the multi-action preview: a Core fight always does. */
export function multiActionOn(combat) {
  return fixCoreEnabled(combat);
}

/**
 * The enemy's planned actions as timeline cards, in play order: the current action first, then its planned
 * follow-ups (combat.enemies[].plannedMoves). [] when the toggle is off, or the enemy has no action to play.
 */
export function enemyPlanActions(combat, enemy) {
  if (!multiActionOn(combat) || !enemy?.alive) return [];
  const intent = enemy.intent;
  if (!intent?.moveId || intent.kind === 'staggered') return [];
  const def = combat.registries.enemies.get(enemy.enemyId);
  const head = { moveId: intent.moveId, sp: fixCoreEnabled(combat) ? enemyMoveQuote(def.moves[intent.moveId], { enemy, moveId: intent.moveId, combat }).totalSp : 1 };
  return [head, ...(enemy.plannedMoves ?? [])].map((entry, i) => enemyTimelineCard(enemy, entry, i, def));
}

/** The timeline stance of an enemy's current action, or null when it has none (none, or staggered). */
export function enemyIntentStance(combat, enemy) {
  const intent = enemy?.intent;
  if (!intent?.moveId || intent.kind === 'staggered') return null;
  const def = combat.registries.enemies.get(enemy.enemyId);
  const move = def?.moves?.[intent.moveId];
  return move ? stanceFor(moveKind(move), Array.isArray(move.tags) ? move.tags : []) : null;
}
