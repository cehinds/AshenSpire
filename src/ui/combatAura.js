// Silhouette effects are applied to the image alpha, never the sprite box.
//
// Every number and colour below lives in
// content/config/ui/presentation/combatAura.json. The three glow strengths the
// filter chooses between are named there — `lit` for an active cast, `faded`
// for a resting outline, and the per-power frames — rather than appearing as
// bare fallbacks inside the expression that picks them.
import { COMBAT_POSE_STATES } from '../content/combatPoseStates.js';
import { uiConfig } from '../config/generated/ui.js';
import { shallowFrozen } from '../config/authored.js';

const { components, behavior, sizing } = uiConfig.presentation.combatAura;

export const POWER_FRAMES = shallowFrozen(components.powerFrames);
const colors = components.colors;

export function resourceAura(card = {}, receipt) {
  const result = [];
  if ((receipt?.staminaSpent ?? card.staminaCost ?? 0) > 0) result.push('stamina');
  if ((receipt?.manaSpent ?? card.manaCost ?? 0) > 0) result.push('mana');
  // Only immediate self-payment; delayed status damage and enemy damage do not
  // turn the casting outline red. Receipts suppress payment prevented in play.
  const selfPayment = (card.effects || []).some(e => e.op === 'loseHp' && e.target === 'self' && (typeof e.amount !== 'number' || e.amount > 0));
  if ((card.hpCost > 0 || selfPayment) && (receipt?.hpSpent ?? 1) > 0) result.push('hp');
  return result;
}
export function auraFilter(pose, rest = 'idle', resources = [], active = false) {
  const state = COMBAT_POSE_STATES[rest];
  if (state && !active) {
    const { innerBlurPx, outerBlurPx, innerAlphaHex, outerAlphaHex } = sizing.restingGlow;
    return `drop-shadow(0 0 ${innerBlurPx}px ${state.color}${innerAlphaHex}) drop-shadow(0 0 ${outerBlurPx}px ${state.color}${outerAlphaHex})`;
  }
  const phase = POWER_FRAMES[pose];
  const guarded = behavior.guardedRestPoses.includes(rest);
  const palette = active && resources.length ? resources
    : phase ? [behavior.defaultPalette]
      : guarded ? [behavior.guardedPalette] : [];
  if (!palette.length) return 'none';
  const glow = !active && !phase ? sizing.faded : sizing.lit;
  const radius = phase?.radius ?? glow.radius;
  const alpha = phase?.alpha ?? glow.alpha;
  const blur = phase?.blur ?? glow.blur;
  const filters = palette.flatMap((key, i) => {
    const color = `rgba(${colors[key] || colors[behavior.defaultPalette]},${alpha})`;
    const r = radius + i * sizing.spread;
    return [`drop-shadow(${r}px 0 0 ${color})`, `drop-shadow(${-r}px 0 0 ${color})`, `drop-shadow(0 ${r}px ${blur}px ${color})`];
  });
  if (phase) filters.push(`brightness(${phase.brightness})`);
  return filters.join(' ');
}
