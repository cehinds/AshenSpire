// The stance-change flash (owner, 2026-11-13): when a beat changes the actor's stance, the new stance's sigil shows large and
// centred over the actor's sprite for a moment (fade in, hold, fade out; durations are data, actionPacing.json stanceFlash),
// then the small overhead stance icon updates. Presentation only, never blocks input (pointer-events none).
import { intentIcon, INTENT_ICON_SHAPES } from './components/intentIcon.js';
import { ACTION_PACING } from '../model/autoCombatPolicy.js';
import { reducedMotionRequested } from './motion.js';
import { getAnimSpeed } from './animationPace.js';

/** stanceFlashPlan(config, { reduced }) -> { fadeInMs, holdMs, fadeOutMs, opacity, totalMs }, or null when it is skipped (Instant, Reduced motion, no time). */
export function stanceFlashPlan(config = ACTION_PACING.stanceFlash, { reduced = false } = {}) {
  if (reduced || !config) return null;
  const num = value => Math.max(0, Number(value) || 0);
  const fadeInMs = num(config.fadeInMs), holdMs = num(config.holdMs), fadeOutMs = num(config.fadeOutMs);
  const opacity = Math.min(1, Math.max(0, Number.isFinite(Number(config.opacity)) ? Number(config.opacity) : 0.6));
  const totalMs = fadeInMs + holdMs + fadeOutMs;
  return totalMs > 0 ? { fadeInMs, holdMs, fadeOutMs, opacity, totalMs } : null;
}

/**
 * overlayPlan(config, { reduced }) -> the player's selection overlay: { style, opacity, fadeInMs, fadeOutMs, enlargeScale, enlargeOpacity },
 * or null (Instant, Reduced motion). style 'enlarge' (default) animates the held sigil from scale 1 / opacity to enlargeScale /
 * enlargeOpacity over the swing clip; 'linger' holds it unchanged until the clip ends. Either way it then fades out.
 */
export function overlayPlan(config = ACTION_PACING.stanceOverlay, { reduced = false } = {}) {
  if (reduced || !config) return null;
  const num = value => Math.max(0, Number(value) || 0);
  const unit = (value, fallback) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback));
  return {
    style: config.style === 'linger' ? 'linger' : 'enlarge',
    opacity: unit(config.opacity, 0.6), fadeInMs: num(config.fadeInMs), fadeOutMs: num(config.fadeOutMs),
    enlargeScale: Math.max(1, Number(config.enlargeScale) || 1.4), enlargeOpacity: unit(config.enlargeOpacity, 0.3),
  };
}

/** The sigil id a stance change shows: the maneuver it enters (attack, defend, counter, smash, sweep, evade...). */
export const stanceFlashIcon = event => {
  const id = event?.maneuver || event?.stance;
  return typeof id === 'string' && Object.hasOwn(INTENT_ICON_SHAPES, id) ? id : null;
};

function buildOverlay(icon, transitionMs) {
  const el = document.createElement('div');
  el.className = 'stance-flash';
  el.setAttribute('aria-hidden', 'true');
  el.dataset.stance = icon;
  el.dataset.tone = 'idle';
  Object.assign(el.style, {
    position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', opacity: '0', zIndex: '6', color: 'var(--stance-sigil-idle)', transformOrigin: '50% 50%', transform: 'scale(1)', transition: `opacity ${transitionMs}ms linear`,
  });
  el.appendChild(sigil(icon));
  return el;
}
function sigil(icon) {
  const svg = intentIcon(icon);
  Object.assign(svg.style, { width: '60%', height: '60%', maxWidth: '160px', maxHeight: '160px', fill: 'none', stroke: 'currentColor', strokeWidth: '1.4' });
  return svg;
}

/**
 * showStanceFlash(anchor, event, { reduced, config }) -> the overlay element, or null when nothing is drawn.
 * A timed flash (an enemy's stance change): fade in, hold, fade out, then removed.
 */
export function showStanceFlash(anchor, event, { reduced = false, config = ACTION_PACING.stanceFlash } = {}) {
  const plan = stanceFlashPlan(config, { reduced });
  const icon = stanceFlashIcon(event);
  if (!plan || !icon || !anchor?.appendChild) return null;
  const el = buildOverlay(icon, plan.fadeInMs);
  anchor.appendChild(el);
  setTimeout(() => { el.style.opacity = String(plan.opacity); }, 0);
  setTimeout(() => { el.style.transition = `opacity ${plan.fadeOutMs}ms linear`; el.style.opacity = '0'; }, plan.fadeInMs + plan.holdMs);
  setTimeout(() => el.remove(), plan.totalMs + 20);
  return el;
}

// A neutral warm gold from the theme tokens, for a card with no element or motif; the glow ramps in over 120 ms at play.
const GLOW_FALLBACK = 'var(--gold)';
const GLOW_RAMP_MS = 120;

/**
 * createStanceOverlay({ reduced, config }): the player's stance sigil while a stance-changing card is selected (owner, 2026-11-13).
 *   bind(getAnchor)  where the overlay lives (the player's sprite element, looked up on each use)
 *   select(stance)   the selection's stance when it differs from the held one, else null: shows, switches or fades out the sigil
 *   hold(glow)       the card was played: the sigil stays up (selection changes no longer touch it) and glows in `glow`
 *   begin(clipMs)    the swing starts: 'enlarge' grows and dims the sigil over the clip, 'linger' leaves it as it is
 *   release()        the actor's action animation ended: fade out
 *   clear()          a refused or cancelled play: removed at once
 * Instant and Reduced motion draw nothing. The overlay never blocks input.
 */
export function createStanceOverlay({ reduced = () => false, config = () => ACTION_PACING.stanceOverlay } = {}) {
  let getAnchor = () => null, el = null, icon = null, held = false;
  const drop = fade => {
    const node = el, plan = overlayPlan(config(), { reduced: reduced() });
    el = null; icon = null; held = false;
    if (!node) return;
    if (fade && plan) {
      node.style.transition = `opacity ${plan.fadeOutMs}ms linear`; node.style.opacity = '0';
      setTimeout(() => node.remove(), plan.fadeOutMs + 20);
    } else node.remove();
  };
  return {
    bind(fn) { getAnchor = typeof fn === 'function' ? fn : () => null; },
    get active() { return !!el; },
    get held() { return held; },
    select(stance) {
      if (held) return;
      const plan = overlayPlan(config(), { reduced: reduced() });
      const id = stance && Object.hasOwn(INTENT_ICON_SHAPES, stance) ? stance : null;
      const anchor = getAnchor();
      if (!id || !plan || !anchor?.appendChild) { drop(!!plan); return; }
      if (el && icon === id) { if (el.parentNode !== anchor) anchor.appendChild(el); return; }
      if (el) { el.replaceChildren(sigil(id)); el.dataset.stance = id; icon = id; if (el.parentNode !== anchor) anchor.appendChild(el); return; }
      el = buildOverlay(id, plan.fadeInMs); icon = id;
      anchor.appendChild(el);
      const node = el;
      setTimeout(() => { if (el === node) node.style.opacity = String(plan.opacity); }, 0);
    },
    // The card was played: keep the sigil and glow it in the card's motif colour (`--stance-glow`; a neutral gold when it has none).
    hold(glow = null) {
      if (!el) return;
      held = true;
      const colour = glow || GLOW_FALLBACK;
      el.style.setProperty('--stance-glow', colour);
      el.dataset.glowColor = colour;
      el.style.color = 'var(--stance-glow)'; // idle grey while selected (--stance-sigil-idle), the motif colour once played
      el.dataset.tone = 'played';
      const svg = el.querySelector('svg');
      if (!svg) return;
      const full = globalThis.document?.documentElement?.dataset?.performance === 'full';
      const tight = 'drop-shadow(0 0 3px var(--stance-glow))', wide = 'drop-shadow(0 0 12px var(--stance-glow))';
      svg.style.transition = `filter ${GLOW_RAMP_MS}ms linear`;
      svg.style.filter = full ? `${tight} ${wide}` : wide;
      el.dataset.glow = '1';
    },
    begin(clipMs) {
      const plan = overlayPlan(config(), { reduced: reduced() });
      if (!el || !plan || plan.style !== 'enlarge' || !(clipMs > 0)) return;
      el.style.transition = `opacity ${clipMs}ms linear, transform ${clipMs}ms linear`;
      el.style.transform = `scale(${plan.enlargeScale})`;
      el.style.opacity = String(plan.enlargeOpacity);
    },
    // Put the overlay back on the figure if a redraw replaced it.
    attach() { const anchor = getAnchor(); if (el && anchor?.appendChild && el.parentNode !== anchor) anchor.appendChild(el); },
    release() { drop(true); },
    clear() { drop(false); },
  };
}

/** The player's overlay: combat.js binds its anchor and drives select / hold / clear; fx.js releases it when the swing ends. */
export const playerStanceOverlay = createStanceOverlay({ reduced: () => reducedMotionRequested() || getAnimSpeed() === 'instant' });
