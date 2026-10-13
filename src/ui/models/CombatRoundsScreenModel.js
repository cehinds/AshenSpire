// src/ui/models/CombatRoundsScreenModel.js — the Combat Rounds Preview's screen rules (SPEC §4.11,
// PREVIEW-PLAN "Screen"). Headless: no DOM. combatRoundsScreen.js draws what these return, and only when
// combat.combatRounds is present.
//
// Perception and reads: an enemy's visible actions are 1 + the player's perception level. The first is
// today's intent, which the engine already reads exact or hidden (previewIntent). A follow-up has no read
// of its own (the engine rolls one read per enemy per round), so it takes that same read: exact shows its
// icon at stage 3, a hidden read shows `?`. Actions beyond the read count always show `?`.

import { clampMomentum } from '../../engine/combatRounds/resolver.js';

// Stage 3 is the whole action (speed included); stage 0 is hidden. Today's read is all-or-nothing.
export const READ_EXACT = 3;
export const READ_HIDDEN = 0;

// Target outline colours (PREVIEW-PLAN, Screen). combat-rounds-preview.css draws them as a 1px filter.
export const OUTLINE_COLOURS = Object.freeze({ green: '#5ccf6a', yellow: '#e7c65c', red: '#ef4949' });

/** perceptionLevel(combat) → the player's perception level (0 when none). */
export function perceptionLevel(combat) {
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

/**
 * speedHint(cardSpeed, foeSpeed) → { glyph, tone } for a hand card against the target, or null.
 * faster: › (>= 1) and » (>= 2) in green; slower: ‹ and « in red. Equal speeds show nothing.
 */
export function speedHint(cardSpeed, foeSpeed) {
  if (!Number.isFinite(cardSpeed) || !Number.isFinite(foeSpeed)) return null;
  const delta = cardSpeed - foeSpeed;
  if (delta >= 2) return { glyph: '»', tone: 'faster' };
  if (delta >= 1) return { glyph: '›', tone: 'faster' };
  if (delta <= -2) return { glyph: '«', tone: 'slower' };
  if (delta <= -1) return { glyph: '‹', tone: 'slower' };
  return null;
}

/**
 * momentumTab(m) → { tone, tab } for the turn banner, or null at 0.
 * +2/+3 good (green, "++"); ±1 warn (orange, "+-"); −2/−3 bad (red, "--").
 */
export function momentumTab(momentum) {
  const m = clampMomentum(Number(momentum) || 0);
  if (m >= 2) return { tone: 'good', tab: '++' };
  if (m === 1 || m === -1) return { tone: 'warn', tab: '+-' };
  if (m <= -2) return { tone: 'bad', tab: '--' };
  return null;
}

/**
 * targetedEnemyId(combat, lastTargetId) → the enemy the banner reads: the last one aimed at while it lives,
 * else the first living enemy (the same pick the target grid makes). null when none lives.
 */
export function targetedEnemyId(combat, lastTargetId = null) {
  const living = (combat?.enemies || []).filter((e) => e.alive);
  return (lastTargetId && living.find((e) => e.id === lastTargetId)?.id) || living[0]?.id || null;
}
