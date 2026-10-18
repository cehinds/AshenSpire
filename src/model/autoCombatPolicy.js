// Pure policy over an explicitly public candidate list. No combat state,
// intents, preview execution or RNG enters the chooser.
import { uiConfig } from '../config/generated/ui.js';
export const ACTION_PACING = uiConfig.presentation.actionPacing.motion;
export const AUTOMATION_DEFAULTS = uiConfig.presentation.actionPacing.behavior;
const bounded = (value, fallback, minimum, maximum) => Number.isFinite(Number(value)) && value !== null && value !== ''
  ? Math.min(maximum, Math.max(minimum, Number(value))) : fallback;
export function resolveCombatAutomation(settings = {}) {
  return {
    enabled: settings.autoCombat === true,
    speed: bounded(settings.combatSpeed, AUTOMATION_DEFAULTS.combatSpeed, AUTOMATION_DEFAULTS.speedMinimum, AUTOMATION_DEFAULTS.speedMaximum),
    preference: settings.combatPreference === 'defense' ? 'defense' : AUTOMATION_DEFAULTS.combatPreference,
    delayMs: bounded(settings.combatActionDelay, ACTION_PACING.intentDelayMs, 0, AUTOMATION_DEFAULTS.delayMaximumMs),
  };
}
// Auto-combat (owner ruling D12, 2026-10-18) automates the player's REACTION choices only.
// It never plays a card and never ends a turn. The chooser is pure and deterministic and reads
// only what the seat itself can see: the intent as that seat perceives it (a hidden or
// unrevealed intent is treated as unknown), the maneuver of its last stance, and its own manual
// reaction picks. Seats never share any of these, so each co-op seat decides on its own read.
const MANEUVER = { casting: 'prepared', preparing: 'prepared', cast: 'prepared', ranged: 'attack', attacking: 'attack',
  smashing: 'smash', sweeping: 'sweep', defending: 'defend', countering: 'counter', evading: 'evade', block: 'defend' };
const normalize = value => MANEUVER[value] || value || null;

// The incoming maneuver as the seat perceives it, or null when it is not known.
export function perceivedManeuver(intent) {
  if (!intent || intent.hidden || intent.revealed === false) return null;
  return normalize(intent.profile?.maneuver || intent.stance);
}

// 2 = the reaction counters the perceived action, 1 = neutral, 0 = the action counters it.
function matchupRank(kind, incoming, table) {
  if (!kind || !incoming) return 1;
  if (table?.[kind]?.includes(incoming)) return 2;
  if (table?.[incoming]?.includes(kind)) return 0;
  return 1;
}

const beats = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };

/**
 * Pick one reaction option, or null to decline.
 * state.matchups: the stance matchup table ({ attacker: [defeated maneuvers] }).
 * state.seats[seat]: { intent, lastStance, picks } where intent is the seat's own previewed
 * intent (unread = hidden), lastStance the maneuver of the seat's last stance, and picks a
 * { maneuver: count } tally of the seat's manual reaction picks this run.
 * options: each { id, kind } where kind is the reaction card's maneuver.
 * Order: counters the perceived action, then (only while the action is unknown) matches the
 * last stance, then the most often manually picked kind, then source order.
 */
export function chooseReaction(state = {}, seat, options = []) {
  const own = state.seats?.[seat] || {};
  const incoming = perceivedManeuver(own.intent);
  const last = normalize(own.lastStance);
  let best = null;
  options.forEach(option => {
    const kind = normalize(option?.kind);
    const rank = matchupRank(kind, incoming, state.matchups);
    const stance = !incoming && last && kind === last ? 1 : 0;
    const picks = Math.max(0, Number(own.picks?.[kind]) || 0);
    const signal = rank === 2 || stance === 1 || picks > 0;
    const key = [rank, stance, picks];
    if (!best || beats(key, best.key)) best = { option, key, signal };
  });
  return best?.signal ? best.option : null;
}

// Manual reaction picks, per run and per seat. Memory only: they never enter a save, so they
// cannot change gameplay; a reloaded run starts its tally again.
const tallies = new WeakMap();
export function recordManualReaction(run, seat, kind) {
  const key = normalize(kind);
  if (!run || typeof run !== 'object' || !key) return;
  const bySeat = tallies.get(run) || {};
  tallies.set(run, bySeat);
  const own = bySeat[seat || 'player'] ||= {};
  own[key] = (own[key] || 0) + 1;
}
export function manualReactionPicks(run, seat) {
  return { ...(tallies.get(run)?.[seat || 'player'] || {}) };
}

// The answer to submit for a chooseReaction result: a null choice is a deliberate decline
// (optionId null), never "do nothing", so the prompt always resolves.
export const reactionAnswer = (pending, picked) => ({ offerId: pending.id, optionId: picked?.id ?? null });
