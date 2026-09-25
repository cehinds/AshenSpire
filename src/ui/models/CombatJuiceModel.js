// src/ui/models/CombatJuiceModel.js — hit-stop, kill cam and damage-number
// scale: the DECISIONS (SPEC §7.4 "Combat juice").
//
// Pure: no DOM, no timers, no settings store. src/ui/fx.js asks these
// functions what to play and plays it; tests/combat-juice.test.mjs asks them
// directly. Every number is authored in
// content/config/ui/presentation/combatJuiceModel.json — none lives here.
import { uiConfig } from '../../config/generated/ui.js';

export const COMBAT_JUICE = uiConfig.presentation.combatJuiceModel;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const num = (v) => Math.max(0, Number(v) || 0);

/** damageTier(amount) → 'chip' | 'normal' | 'heavy' | 'crit' (residual HP damage). */
export function damageTier(amount, cfg = COMBAT_JUICE) {
  const a = num(amount);
  const T = cfg.sizing.damageTiers;
  if (a >= T.critAt) return 'crit';
  if (a >= T.heavyAt) return 'heavy';
  if (a < T.chipBelow) return 'chip';
  return 'normal';
}

/**
 * damageNumberScale(amount) → multiplier on the tier's font size, continuous
 * inside the tier: 1 at the tier's floor, 1 + boost at its ceiling. Chip never
 * scales; crit's span ends at capAt and clamps there.
 */
export function damageNumberScale(amount, cfg = COMBAT_JUICE) {
  const a = num(amount);
  const T = cfg.sizing.damageTiers;
  const S = cfg.sizing.damageScale;
  const tier = damageTier(a, cfg);
  // [floor, top, boost]: top is the tier's last whole value (crit tops out at capAt).
  const span = {
    chip: null,
    normal: [T.chipBelow, T.heavyAt - 1, S.normalBoost],
    heavy: [T.heavyAt, T.critAt - 1, S.heavyBoost],
    crit: [T.critAt, T.capAt, S.critBoost],
  }[tier];
  if (!span) return 1;
  const [lo, top, boost] = span;
  const t = top > lo ? clamp01((a - lo) / (top - lo)) : 0;
  return Math.round((1 + boost * t) * 1000) / 1000;
}

/** hitStopMs(amount) → freeze length for a residual hit; 0 below heavy. */
export function hitStopMs(amount, cfg = COMBAT_JUICE) {
  const a = num(amount);
  const T = cfg.sizing.damageTiers;
  const H = cfg.motion.hitStop;
  const tier = damageTier(a, cfg);
  if (tier === 'heavy') {
    const t = clamp01((a - T.heavyAt) / (T.critAt - T.heavyAt));
    return Math.round(H.minMs + (H.critMs - H.minMs) * t);
  }
  if (tier === 'crit') {
    const t = clamp01((a - T.critAt) / (T.capAt - T.critAt));
    return Math.round(H.critMs + (H.maxMs - H.critMs) * t);
  }
  return 0;
}

/**
 * hitStopForEvent(event, gates) → ms to freeze for this combat event (0 = none).
 *   gates.paced  — the paced timeline is running (false for instant speed)
 *   gates.reducedMotion — in-game or OS reduced motion
 * Only the HP residual of a hit counts: guard-absorbed damage never stops time.
 */
export function hitStopForEvent(event, gates = {}, cfg = COMBAT_JUICE) {
  if (!event || gates.paced === false || gates.reducedMotion) return 0;
  if (event.type === 'enemyStaggered') return cfg.motion.hitStop.staggerMs;
  if (event.type !== 'damageDealt') return 0;
  const amount = num(event.amount);
  const blocked = Math.min(amount, num(event.blocked));
  return hitStopMs(amount - blocked, cfg);
}

/** rankForStature('large'|'huge'|…) → 'elite' | 'boss' | null. */
export function rankForStature(stature, cfg = COMBAT_JUICE) {
  return cfg.behavior.killCam.rankByStature[stature] || null;
}

/** killCamGatesOpen(gates) → may a kill cam play at all under these settings? */
export function killCamGatesOpen(gates = {}) {
  // Deliberately NOT gated on Screen shake: a player who dislikes the kick may
  // still want the close-up, and each has its own switch.
  return gates.paced !== false && !gates.reducedMotion && gates.killCam !== false;
}

/**
 * killCamPlan({ rank, lastEnemy }, gates) → { reason, ms, slowRate, zoom, zoomInMs, vignetteOpacity } | null.
 * rank is 'boss' | 'elite' | null; lastEnemy = this kill wins the fight.
 */
export function killCamPlan({ rank = null, lastEnemy = false } = {}, gates = {}, cfg = COMBAT_JUICE) {
  if (!killCamGatesOpen(gates)) return null;
  const M = cfg.motion.killCam;
  const reason = rank === 'boss' ? 'boss'
    : rank === 'elite' ? 'elite'
      : (lastEnemy && cfg.behavior.killCam.lastEnemy ? 'lastEnemy' : null);
  if (!reason) return null;
  return {
    reason,
    ms: M[`${reason}Ms`],
    slowRate: M.slowRate,
    zoomInMs: M.zoomInMs,
    zoomOutMs: M.zoomOutMs,
    zoom: cfg.sizing.killCam.zoom,
    vignetteOpacity: cfg.sizing.killCam.vignetteOpacity,
  };
}

const PRIORITY = { boss: 3, elite: 2, lastEnemy: 1 };

/**
 * pickKillCam(events, { rankOf(targetId), won }, gates) → { event, plan } | null
 * At most one kill cam per dispatch: boss > elite > the fight-winning kill,
 * the latest kill winning a tie. `won` = this dispatch ended the fight in a
 * victory, which makes its last enemyDied the fight-winning kill.
 */
export function pickKillCam(events, { rankOf = () => null, won = false } = {}, gates = {}, cfg = COMBAT_JUICE) {
  if (!Array.isArray(events) || !killCamGatesOpen(gates)) return null;
  const deaths = events.filter((e) => e && e.type === 'enemyDied');
  let best = null;
  deaths.forEach((event, i) => {
    const plan = killCamPlan({ rank: rankOf(event.targetId), lastEnemy: won && i === deaths.length - 1 }, gates, cfg);
    if (plan && (!best || PRIORITY[plan.reason] >= PRIORITY[best.plan.reason])) best = { event, plan };
  });
  return best;
}

/** The longest hold one kill cam can add — the watchdog budget reads it. */
export function maxKillCamMs(cfg = COMBAT_JUICE) {
  const M = cfg.motion.killCam;
  return Math.max(M.bossMs, M.eliteMs, M.lastEnemyMs);
}

// ---------------------------------------------------------------------------
// Co-op (SPEC §7.4 "Co-op"): no paced timeline — a snapshot's receipts play at
// once (coop.js spawnCombatFx) — so the same decisions are gathered per receipt.
// ---------------------------------------------------------------------------

/** The figure a receipt event struck: a seat id for a player, else the entity id. */
function struckId(e) {
  if (e.targetPlayerId) return e.targetPlayerId;
  if (e.targetId === 'player') return e.playerId || null;
  return e.targetId || null;
}

/**
 * receiptJuicePlan(events, { rankOf, won }, gates) → { stops, killCam }
 *   stops   — [{ targetId, sourceIds, ms }]: one freeze per struck figure, its
 *             length the LONGEST hitStopForEvent among the receipt's hits and
 *             staggers on it (a figure freezes once; stops never stack), with
 *             the seats/enemies that struck it.
 *   killCam — pickKillCam over the receipt's deaths, or null.
 * Gates are solo's: instant speed (paced false) and reduced motion skip both.
 */
export function receiptJuicePlan(events, { rankOf = () => null, won = false } = {}, gates = {}, cfg = COMBAT_JUICE) {
  const byTarget = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    const ms = hitStopForEvent(e, gates, cfg);
    if (!(ms > 0)) continue;
    const targetId = struckId(e);
    if (!targetId) continue;
    const row = byTarget.get(targetId) || { targetId, sourceIds: [], ms: 0 };
    row.ms = Math.max(row.ms, ms);
    const sourceId = e.sourcePlayerId || (e.sourceId && e.sourceId !== 'player' ? e.sourceId : null);
    if (sourceId && sourceId !== targetId && !row.sourceIds.includes(sourceId)) row.sourceIds.push(sourceId);
    byTarget.set(targetId, row);
  }
  return { stops: [...byTarget.values()], killCam: pickKillCam(events, { rankOf, won }, gates, cfg) };
}

/**
 * coopFinaleHoldMs(killCam, gates) → how long a co-op client holds a fight's
 * last frame before the next scene: the kill cam's length when one plays,
 * else motion.coopFinaleHoldMs; 0 at instant speed.
 */
export function coopFinaleHoldMs(killCam, gates = {}, cfg = COMBAT_JUICE) {
  if (gates.paced === false) return 0;
  return killCam && killCam.plan ? killCam.plan.ms : cfg.motion.coopFinaleHoldMs;
}
