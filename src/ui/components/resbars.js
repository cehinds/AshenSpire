// src/ui/components/resbars.js — the ONE renderer for every resource bar.
//
// It knows nothing about health, poise, stamina or mana. It is handed a plan
// (model/resources.js resourceBarPlan) and draws it with the kit's Meter atom
// (styles/kit.css `.as-meter`, src/ui/kit/index.js meter()). That is the whole
// point: the day a resource exists, its bar is a row in content/resources.js
// and this file does not change.
//
// TWO GEOMETRIES, and the atom draws both:
//   the FILL   — width = cur/max. Every bar this game has ever drawn did this.
//   the TROUGH — width = scale(max)/scale(domain). HIS ASK. The trough's own
//                length encodes the maximum, so a bar cannot lie about a stat.
//
// TWO SURFACES, one atom:
//   'main'  — the HUD stack: label and value on the plate beside the track.
//   'model' — the under-model strip: the value rides INSIDE the track (the
//             kit's `.inset` meter), because there is no room beside it.
//
// The hook classes (.resbars, .resline, .resunit, .resplate, .restrack,
// .resbar, .fill) and data-res/data-cur/data-max stay on the kit elements —
// the plate's `.m-label` / `.m-value` are the kit's own names for the words:
// tools/hudbars.mjs, hudparity.mjs and veil-owns-input.mjs read them, and
// assistive tech reads the track's role=img label. kit.css draws nothing for
// the hook names.

import { attachTooltip, esc } from './tooltip.js';
import { el, meter, meters } from '../kit/index.js';
import { reducedMotionRequested } from '../motion.js';
import { getAnimSpeed } from '../fx.js';

// ---------------------------------------------------------------------------
// THE GHOST BAR (SPEC §7.4 impact). When health drops, a pale trail stays at
// the old value for `lagMs`, then drains to the new one over `drainMs`, so a
// hit's size is readable after the number has gone. Bars are rebuilt on every
// render, so the trail cannot live on the element: it lives here, per
// `ghost` key (an entity id), as a timeline — and each rebuild draws the trail
// as it stands NOW, so a re-render mid-drain carries on rather than restarts,
// and a second hit during the lag holds the trail at its top.
// Off under Reduced motion and at Instant speed: the bar simply jumps.
// ---------------------------------------------------------------------------
export const GHOST_BAR = Object.freeze({ ids: Object.freeze(['hp']), lagMs: 260, drainMs: 420 });
const ghostMemory = new Map(); // key -> { pct, cur, trail: { from, to, at } | null }

/** The trail's level at `now`: `from` through the lag, then a linear drain to `to`. */
export function ghostLevel(trail, now, cfg = GHOST_BAR) {
  const t = now - trail.at - cfg.lagMs;
  if (t <= 0) return trail.from;
  if (t >= cfg.drainMs) return trail.to;
  return trail.from + (trail.to - trail.from) * (t / cfg.drainMs);
}

/**
 * ghostStep(prev, pct, now, { enabled, cur }) → { state, ghost }
 * Pure. `prev` is the last { pct, cur, trail } for this bar (or undefined);
 * `ghost` is what to draw now — { fromPct, toPct, delayMs, drainMs } — or null.
 * A trail starts only when the VALUE drops (`cur`, when given): a raised
 * maximum lowers the percentage without anything being lost.
 */
export function ghostStep(prev, pct, now, { enabled = true, cfg = GHOST_BAR, cur } = {}) {
  if (!enabled || !prev) return { state: { pct, cur, trail: null }, ghost: null };
  const live = prev.trail && now - prev.trail.at < cfg.lagMs + cfg.drainMs ? prev.trail : null;
  const top = live ? ghostLevel(live, now, cfg) : prev.pct;
  const lost = Number.isFinite(cur) && Number.isFinite(prev.cur) ? cur < prev.cur : pct < prev.pct - 1e-6;
  let trail = live;
  if (lost && pct < prev.pct - 1e-6) trail = { from: Math.max(top, prev.pct), to: pct, at: now }; // a new loss
  else if (trail && pct > top) trail = null; // healed past the trail
  if (!trail) return { state: { pct, cur, trail: null }, ghost: null };
  // A heal under the trail re-aims it at the bar as it now stands, from where
  // it is: the rest of its lag if it is still holding, a fresh drain if not.
  if (pct !== trail.to) trail = { from: top, to: pct, at: now - Math.min(now - trail.at, cfg.lagMs) };
  const elapsed = now - trail.at;
  const delayMs = Math.max(0, cfg.lagMs - elapsed);
  const drainMs = Math.max(0, Math.min(cfg.drainMs, cfg.lagMs + cfg.drainMs - elapsed));
  return { state: { pct, cur, trail }, ghost: { fromPct: ghostLevel(trail, now, cfg), toPct: pct, delayMs, drainMs } };
}

/** Forget every trail: a fight's mount and teardown (solo and co-op), so a
 *  loss between fights never draws on the next fight's first render. */
export function resetGhostBars() { ghostMemory.clear(); }

const clock = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const ghostsEnabled = () => !reducedMotionRequested() && getAnimSpeed() !== 'instant';

function drawGhost(node, bar, key) {
  if (!key || !GHOST_BAR.ids.includes(bar.id)) return;
  const id = `${key}:${bar.id}`;
  const { state, ghost } = ghostStep(ghostMemory.get(id), bar.pct, clock(), { enabled: ghostsEnabled(), cur: Number(bar.cur) });
  ghostMemory.set(id, state);
  if (!ghost) return;
  const track = node.querySelector('.m-track');
  const fill = track && track.querySelector('.m-fill');
  if (!fill) return;
  const trail = el('i', { class: 'm-ghost', 'aria-hidden': 'true' });
  trail.style.width = `${ghost.fromPct.toFixed(2)}%`;
  trail.style.setProperty('--ghost-to', `${ghost.toPct.toFixed(2)}%`);
  trail.style.animation = `ghost-drain ${Math.round(ghost.drainMs)}ms linear ${Math.round(ghost.delayMs)}ms forwards`;
  track.insertBefore(trail, fill); // under the fill: only the lost span shows
}

/**
 * resourceBars(plan, { surface, tooltipExtra }) → HTMLElement (.resbars)
 *
 * `tooltipExtra(bar)` may return extra tooltip HTML for a bar (the poise bar
 * wants Stagger's own text, which is content and not this file's to know).
 */
export function resourceBars(plan, { surface, tooltipExtra, tooltips = true, ghost = null } = {}) {
  const which = surface || 'main';
  const wrap = meters([], { class: 'resbars', dataset: { surface: which } });
  if (which === 'main') {
    // The plan is already in `order` order; consecutive rows that share a
    // `band` sit on one line. A band split across the stack would be a row
    // author asking for two contradictory things — two lines keep the order.
    for (const group of groupByBand(plan)) {
      const line = el('div', { class: 'resline as-band-row' });
      for (const bar of group) line.appendChild(unit(bar, which, tooltipExtra, tooltips, ghost));
      wrap.appendChild(line);
    }
  } else {
    wrap.classList.add('tight');
    for (const bar of plan) wrap.appendChild(unit(bar, which, tooltipExtra, tooltips, ghost));
  }
  return wrap;
}

function groupByBand(plan) {
  const groups = [];
  for (const bar of plan) {
    const prev = groups[groups.length - 1];
    if (bar.band && prev && prev[0].band === bar.band) prev.push(bar);
    else groups.push([bar]);
  }
  return groups;
}

/** One meter: plate (name · cur/max) + well (the trough, at its data length). */
function unit(bar, surface, tooltipExtra, tooltips, ghost) {
  const skinny = bar.weight === 'skinny';
  const node = meter({
    id: bar.id,
    label: surface === 'main' ? bar.name : '',
    value: `${bar.cur}/${bar.max}`,
    cur: bar.cur, max: bar.max,
    pct: bar.pct, lengthPct: bar.lengthPct,
    skinny,
    inset: surface === 'model',
    ariaLabel: `${bar.name} ${bar.cur} of ${bar.max}`,
    attrs: { class: 'resunit', style: { '--meter-tone': bar.tint } },
    trackAttrs: { class: `bar resbar resbar-${bar.weight}` },
  });
  // The plate and the well carry the names the instruments read.
  node.querySelector('.m-plate')?.classList.add('resplate');
  node.querySelector('.m-well').classList.add('restrack');
  // There is deliberately no absolute minimum width on the track: `width`
  // stays the rendered max/reference percentage even when it is a few pixels;
  // a floor would make different maxima draw the same length.
  if (tooltips) attachTooltip(node, () => tooltipHtml(bar, tooltipExtra));
  drawGhost(node, bar, ghost);
  return node;
}

function tooltipHtml(bar, tooltipExtra) {
  const extra = (tooltipExtra && tooltipExtra(bar)) || '';
  // Whatever the plate is too narrow to print, the tooltip always says.
  return `<div class="tt-title">${esc(bar.name)}</div>${bar.cur} / ${bar.max}. ${extra}`;
}
