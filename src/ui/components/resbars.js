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

/**
 * resourceBars(plan, { surface, tooltipExtra }) → HTMLElement (.resbars)
 *
 * `tooltipExtra(bar)` may return extra tooltip HTML for a bar (the poise bar
 * wants Stagger's own text, which is content and not this file's to know).
 */
export function resourceBars(plan, { surface, tooltipExtra, tooltips = true } = {}) {
  const which = surface || 'main';
  const wrap = meters([], { class: 'resbars', dataset: { surface: which } });
  if (which === 'main') {
    // The plan is already in `order` order; consecutive rows that share a
    // `band` sit on one line. A band split across the stack would be a row
    // author asking for two contradictory things — two lines keep the order.
    for (const group of groupByBand(plan)) {
      const line = el('div', { class: 'resline as-band-row' });
      for (const bar of group) line.appendChild(unit(bar, which, tooltipExtra, tooltips));
      wrap.appendChild(line);
    }
  } else {
    wrap.classList.add('tight');
    for (const bar of plan) wrap.appendChild(unit(bar, which, tooltipExtra, tooltips));
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
function unit(bar, surface, tooltipExtra, tooltips) {
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
  return node;
}

function tooltipHtml(bar, tooltipExtra) {
  const extra = (tooltipExtra && tooltipExtra(bar)) || '';
  // Whatever the plate is too narrow to print, the tooltip always says.
  return `<div class="tt-title">${esc(bar.name)}</div>${bar.cur} / ${bar.max}. ${extra}`;
}
