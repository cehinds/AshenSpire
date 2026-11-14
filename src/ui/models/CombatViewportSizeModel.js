import { uiConfig } from '../../config/generated/ui.js';

// One sizing rule for every combatant (owner, 2026-11-02): the figure's measured
// body (head to feet) is a fixed share of the game viewport's height, times its
// stature multiplier. Nothing else sets size: not the enemy count, the HUD band or
// the overhead stack. Only a common last-resort factor may shrink everyone, when
// figures would overlap past the allowance or a lone player's feet would enter the
// hand area. The shares and caps are tunable
// in content/config/ui/presentation/combatFormationModel.json (sizing.viewportScale).
const CONFIG = uiConfig.presentation.combatFormationModel.sizing.viewportScale;

export function bodyHeightFraction(portraitPhone, config = CONFIG) {
  return portraitPhone ? config.bodyHeightFraction.portraitPhone : config.bodyHeightFraction.landscape;
}

// combatSpriteRatio gives large 1.75, huge 2 and the Ashheart Dragon 3; the cap
// keeps a boss from towering over the party (now 1.15).
export function statureMultiplier(ratio, config = CONFIG) {
  return Math.min(config.statureCap, Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
}

// Row, depth, display and the Settings player / enemy sprite scales do not
// resize a figure: the enemy scale defaults to 1.5, which is exactly the kind of
// hidden multiplier this rule replaces.
//
// Every figure (the player, allies and enemies alike) takes `combatantScale` on
// top (owner, 2026-11-04: every figure at 80%), so relative sizes are unchanged.
export function targetBodyHeight({ viewportHeight, portraitPhone, ratio }, config = CONFIG) {
  return viewportHeight * bodyHeightFraction(portraitPhone, config) * statureMultiplier(ratio, config)
    * config.combatantScale;
}

// Spread one row (same side and depth band) left to right: clamp to the field
// edges, push apart to the overlap allowance, then pull back from the right
// edge. Rows carry `x` and `width`; returns false if the left edge cannot be kept.
// `unit` is the real px per authored (canvas) px of the caller's coordinates: the combat stage measures in scaled real
// px under the combat canvas, so its authored margins take the canvas fit (1 everywhere else).
export function separateRow(group, width, config = CONFIG, unit = 1) {
  const margin = config.edgeMarginPx * unit;
  group.sort((p, q) => p.x - q.x);
  const gap = (p, q) => (p.width + q.width) / 2 * (1 - config.overlapAllowance);
  const clampEdge = r => { r.x = Math.max(margin + r.width / 2, Math.min(width - margin - r.width / 2, r.x)); };
  group.forEach(clampEdge);
  for (let i = 1; i < group.length; i++) group[i].x = Math.max(group[i].x, group[i - 1].x + gap(group[i - 1], group[i]));
  for (let i = group.length - 1; i >= 0; i--) {
    const last = group[i];
    if (last.x > width - margin - last.width / 2) last.x = width - margin - last.width / 2;
    if (i > 0) group[i - 1].x = Math.min(group[i - 1].x, last.x - gap(group[i - 1], last));
  }
  return !group.length || group[0].x >= margin + group[0].width / 2 - 1e-6;
}

// Fit every actor at its percentage size. Positions may move sideways to clear a
// neighbour in the same row and side; only if a figure still cannot fit (it would
// overlap, or stand taller than its ground) is every combatant scaled by one
// common factor, so relative sizes never change. The returned array carries
// `lastResort` (the common factor, or null) so callers and tests can report it.
//
// Option that mirrors what composition does after the fit, so the fit judges the
// final positions: `handTop` (with `solo`) is the floor for the lone player's feet.
export function fitViewportSprites({ width, actors, viewportHeight, portraitPhone = false, config = CONFIG,
  handTop = null, solo = false, unit = 1 }) {
  const valid = actors.filter(a => a.visibleHeight > 0 && a.visibleWidth > 0);
  const margin = config.edgeMarginPx * unit;
  const targets = valid.map(a => ({ a, height: targetBodyHeight({ viewportHeight, portraitPhone, ratio: a.ratio }, config) }));
  // A row is one depth band on one side (visualBand); lanes within it share the floor.
  const floor = a => solo && Number.isFinite(handTop) && handTop > 0 && (a.side ?? a.slot.side) === 'player' ? handTop : Infinity;
  const rowOf = a => `${a.side ?? a.slot.side}:${a.slot.visualBand ?? a.slot.row ?? Math.round(a.slot.ground / 10)}`;
  const solve = factor => {
    const rows = targets.map(({ a, height }) => ({ a, height: height * factor, width: height * factor * a.visibleWidth / a.visibleHeight, x: a.slot.x }));
    let ok = rows.every(r => r.height <= (r.a.slot.fitGround ?? r.a.slot.ground) - 2 * unit &&
      r.height + (r.a.leading ?? 0) + 6 * unit <= floor(r.a) && r.width <= width - 2 * margin);
    const groups = new Map();
    for (const r of rows) groups.set(rowOf(r.a), [...(groups.get(rowOf(r.a)) || []), r]);
    for (const group of groups.values()) {
      if (!separateRow(group, width, config, unit)) ok = false;
    }
    return { rows, ok };
  };
  let factor = 1, solved = solve(1);
  if (!solved.ok) {
    let lo = config.minCommonFactor, hi = 1;
    if (solve(lo).ok) {
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (solve(mid).ok) lo = mid; else hi = mid; }
      factor = lo;
    } else factor = lo;
    solved = solve(factor);
  }
  const result = solved.rows.map(r => ({ id: r.a.slot.id, scale: r.height / r.a.visibleHeight, visibleHeight: r.height,
    multiplier: 1, x: r.x, ...(Math.abs(r.x - r.a.slot.x) > .5 ? { slid: true } : {}) }));
  result.lastResort = factor < 1 ? factor : null;
  return result;
}
