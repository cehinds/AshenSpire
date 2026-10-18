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
const score = value => Number.isFinite(value) ? Math.max(0, value) : 0;
export function chooseAutoCombatAction({ settings = {}, phase, result, busy = false, pendingReaction = false,
  modalOpen = false, targetUnresolved = false, deckEditing = false, queued = false,
  candidates = [], canEndTurn = true } = {}) {
  const policy = resolveCombatAutomation(settings);
  if (!policy.enabled || phase !== 'player' || result || busy || pendingReaction || modalOpen || targetUnresolved || deckEditing || queued) return null;
  const primary = policy.preference === 'defense' ? 'defense' : 'offense';
  const secondary = primary === 'defense' ? 'offense' : 'defense';
  // Stable source order is the tie-break; selecting a card cannot consume RNG.
  const legal = candidates.filter(candidate => candidate.legal === true && candidate.affordable === true && candidate.cardInstanceId);
  const ranked = legal.map((candidate, index) => ({ candidate, index,
    score: score(candidate[primary]) * 4 + score(candidate[secondary]) + score(candidate.stanceAdvantage)
      + (Number.isFinite(candidate.knownHitChance) ? Math.max(0, Math.min(1, candidate.knownHitChance)) : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!ranked.length) return canEndTurn ? { type: 'endTurn' } : null;
  const { cardInstanceId, targetId } = ranked[0].candidate;
  return { type: 'playCard', cardInstanceId, targetId: targetId ?? null };
}
