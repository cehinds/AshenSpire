import { uiConfig } from '../../config/generated/ui.js';

export const targetHudConfig = () => uiConfig.components.combatTargetHud;
export function targetHudEnabled({ formFactor, layout = 'formation' }, config = targetHudConfig()) {
  return layout === 'formation' && config.behavior.formFactors.includes(formFactor);
}
const clamp = (value, low, high) => Math.min(Math.max(low, high), Math.max(low, value));
// ---- Fixed mini HUD placement (owner, 2026-11-06) ----------------------------------------------------------
// "Keep enemy mini HUDs above them in a fixed position. Keep player hud anchored to the right and fixed." Each mini HUD
// is placed from its own figure alone, once per layout pass: no avoidance, no packing, no movement on select, hover,
// intent or damage. The only clamp is the screen edge. Physical pixels, like the rest of this model.
const miniHudConfig = () => uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.miniHud;

/** miniHudScale({ cellWidth }): the font scale that fits the HUD's contents to a cell-wide box, never below the readable
 *  minimum font. `scale` multiplies the HUD's design sizes (font, bars, badges); `fontPx` is the base text size at it. */
export function miniHudScale({ cellWidth, config = miniHudConfig() }) {
  const { designWidthPx, baseFontPx, minFontPx, maxScale } = config;
  const floor = minFontPx / baseFontPx;
  const scale = Math.min(maxScale, Math.max(floor, cellWidth / designWidthPx));
  return { scale, fontPx: baseFontPx * scale };
}

/** enemyHudPlacement: centred on the figure, its bottom edge at `bottom` (the head), grown upward; clamped to `bounds`. */
export function enemyHudPlacement({ centerX, bottom, width, height, bounds }) {
  return { left: clamp(centerX - width / 2, bounds.left, bounds.left + bounds.width - width),
    top: Math.max(bounds.top, bottom - height) };
}

/** playerHudPlacement: immediately right of the body at its top, clamped to `bounds`; it never moves above, down or around. */
export function playerHudPlacement({ anchor, width, height, gap, bounds }) {
  return { left: clamp(anchor.left + anchor.width + gap, bounds.left, bounds.left + bounds.width - width),
    top: clamp(anchor.top, bounds.top, bounds.top + bounds.height - height) };
}

// One stable-target clock, including leave grace. Updating content for the
// same IDs does not restart dwell; a switch is one delay, never exit+enter.
// Owner 2026-11-05: the player's selected HUD is on at all times and the mini overhead bar never shows for the player.
// Presentation only: a pinned player is not an eligible or focused target, and enemies keep mini-until-selected.
export const targetHudPinnedIds = entries => [...entries].filter(entry => entry.role === 'player').map(entry => entry.id);
export function targetHudDesiredIds({ entries: all, eligible = [], focused = null, hover = null, focusWithin = null }) {
  const entries = [...all], known = new Set(entries.map(entry => entry.id));
  return [...new Set([...targetHudPinnedIds(entries), ...eligible, focused, hover, focusWithin].filter(id => known.has(id)))];
}
// True while a player frame shows its panel only because it is pinned: its sprite glow and floor tint stay off.
export const targetHudPinnedOnly = ({ entries, id, eligible = [], focused = null, hover = null, focusWithin = null }) =>
  targetHudPinnedIds([...entries]).includes(id) && ![...eligible, focused, hover, focusWithin].includes(id);
// The floor tint marks a target being acted on or read, so the pinned panel alone adds none.
export function targetHudTintIds({ entries: all, shown = [], eligible = [], focused = null, hover = null, focusWithin = null }) {
  const pinned = targetHudPinnedIds([...all]), asked = [...eligible, focused, hover, focusWithin];
  return [...new Set([...shown, ...eligible, focused].filter(Boolean))].filter(id => !pinned.includes(id) || asked.includes(id));
}

export function createTargetHudDwell({ onChange, delay = targetHudConfig().motion.dwellMs, schedule = setTimeout, cancel = clearTimeout }) {
  let current = [], pending = [], timer = null, disposed = false;
  const key = ids => [...ids].sort().join('\u0000');
  return {
    request(ids) {
      if (disposed || key(ids) === key(pending)) return;
      pending = [...ids];
      if (timer !== null) cancel(timer);
      timer = null;
      if (key(pending) === key(current)) return;
      timer = schedule(() => { timer = null; if (disposed) return; current = [...pending]; onChange(current); }, delay);
    },
    get current() { return [...current]; },
    reset() { if (timer !== null) cancel(timer); timer = null; current = []; pending = []; },
    dispose() { disposed = true; if (timer !== null) cancel(timer); timer = null; },
  };
}

export const TARGET_HUD_AURA = Object.freeze({ advantage: '#72d78c', neutral: '#e4cd59', disadvantage: '#f07870' });
export function targetHudMatchup(action, intent, rules = {}) {
  if (!action || !intent || intent.hidden || intent.revealed === false) return 'neutral';
  const normalize = value => ({ casting: 'prepared', preparing: 'prepared', cast: 'prepared', ranged: 'attack', attacking: 'attack', smashing: 'smash', sweeping: 'sweep', defending: 'defend', countering: 'counter', evading: 'evade', block: 'defend' })[value] || value;
  const attack = normalize(action.maneuver || 'prepared'), defense = normalize(intent.profile?.maneuver || intent.stance);
  const table = rules?.matchups || {};
  if (table[attack]?.includes(defense)) return 'advantage';
  if (table[defense]?.includes(attack)) return 'disadvantage';
  return 'neutral';
}

// Body landmarks exclude raised weapons and transparent stage canvas. Both
// readouts retain a fixed physical gap when a true pose changes its head.
export function targetBodyHudPlacement({ body, frame, groupHeight = 61, intentHeight = 37, gap = 5, zoom = 1 }) {
  const head = Number.isFinite(body.headY) ? body.headY : body.top;
  return { miniTop: (head - frame.top - gap - groupHeight) / zoom,
    selectedTop: (head - frame.top - gap - intentHeight) / zoom,
    center: ((body.left + body.right) / 2 - frame.left) / zoom };
}
