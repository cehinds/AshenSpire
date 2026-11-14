// The stance-change flash (owner, 2026-11-13): when a beat changes the actor's stance, the new stance's sigil shows large and
// centred over the actor's sprite for a moment (fade in, hold, fade out; durations are data, actionPacing.json stanceFlash),
// then the small overhead stance icon updates. Presentation only, never blocks input (pointer-events none).
import { intentIcon, INTENT_ICON_SHAPES } from './components/intentIcon.js';
import { ACTION_PACING } from '../model/autoCombatPolicy.js';

/** stanceFlashPlan(config, { reduced }) -> { fadeInMs, holdMs, fadeOutMs, opacity, totalMs }, or null when it is skipped (Instant, Reduced motion, no time). */
export function stanceFlashPlan(config = ACTION_PACING.stanceFlash, { reduced = false } = {}) {
  if (reduced || !config) return null;
  const num = value => Math.max(0, Number(value) || 0);
  const fadeInMs = num(config.fadeInMs), holdMs = num(config.holdMs), fadeOutMs = num(config.fadeOutMs);
  const opacity = Math.min(1, Math.max(0, Number.isFinite(Number(config.opacity)) ? Number(config.opacity) : 0.6));
  const totalMs = fadeInMs + holdMs + fadeOutMs;
  return totalMs > 0 ? { fadeInMs, holdMs, fadeOutMs, opacity, totalMs } : null;
}

/** The sigil id a stance change shows: the maneuver it enters (attack, defend, counter, smash, sweep, evade...). */
export const stanceFlashIcon = event => {
  const id = event?.maneuver || event?.stance;
  return typeof id === 'string' && Object.hasOwn(INTENT_ICON_SHAPES, id) ? id : null;
};

/**
 * showStanceFlash(anchor, event, { reduced, config }) -> the overlay element, or null when nothing is drawn.
 * The overlay is a child of the actor's sprite, removed when the fade out ends.
 */
export function showStanceFlash(anchor, event, { reduced = false, config = ACTION_PACING.stanceFlash } = {}) {
  const plan = stanceFlashPlan(config, { reduced });
  const icon = stanceFlashIcon(event);
  if (!plan || !icon || !anchor?.appendChild) return null;
  const el = document.createElement('div');
  el.className = 'stance-flash';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.stance = icon;
  Object.assign(el.style, {
    position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', opacity: '0', zIndex: '6', transition: `opacity ${plan.fadeInMs}ms linear`,
  });
  const svg = intentIcon(icon);
  Object.assign(svg.style, { width: '60%', height: '60%', maxWidth: '160px', maxHeight: '160px', fill: 'none', stroke: 'currentColor', strokeWidth: '1.4' });
  el.appendChild(svg);
  anchor.appendChild(el);
  setTimeout(() => { el.style.opacity = String(plan.opacity); }, 0);
  setTimeout(() => { el.style.transition = `opacity ${plan.fadeOutMs}ms linear`; el.style.opacity = '0'; }, plan.fadeInMs + plan.holdMs);
  setTimeout(() => el.remove(), plan.totalMs + 20);
  return el;
}
