// src/ui/components/resbars.js — the ONE renderer for every resource bar.
//
// It knows nothing about health, poise, stamina or mana. It is handed a plan
// (model/resources.js resourceBarPlan) and draws it. That is the whole point:
// the day a resource exists, its bar is a row in content/resources.js and this
// file does not change.
//
// TWO GEOMETRIES, and only one of them is new:
//   the FILL   — width = cur/max. Every bar this game has ever drawn did this.
//   the TROUGH — width = scale(max)/scale(domain). HIS ASK. The trough's own
//                length encodes the maximum, so a bar cannot lie about a stat.
//
// TWO STRUCTURES, keyed on the surface — the approved hybrid (2026-08-13,
// claude-family falk-family: hybrid-confirmation/output/selection-record.json,
// owner pixels owners/F1-resource-health.png, F2-resource-mana.png,
// F2-resource-stamina.png):
//
//   'main'  — the HYBRID shape. Each bar is a bordered UNIT: a label plate
//             ("HP 86/86") to the LEFT of a pill trough. Bars sharing a row's
//             `band` sit side by side on one line (F2's Mana+Stamina row);
//             a bar with no band takes a line alone (F1's Health row). The
//             trough's track is its unit's remaining width, derived by flex —
//             nothing types a ceiling, so a bar cannot overflow its cell
//             (Law 2 by construction; tools/hudbars.mjs measures it anyway).
//   'model' — unchanged: the under-model strip keeps its inside label, which
//             is also what the approved combat mock draws under the fighters.
//
// NOTHING IS TYPED. The line splits into equal unit cells by flex; the trough
// track is unit minus plate, derived; the trough is a percentage of that.

import { attachTooltip, esc } from './tooltip.js';

/**
 * resourceBars(plan, { surface, tooltipExtra }) → HTMLElement (.resbars)
 *
 * `tooltipExtra(bar)` may return extra tooltip HTML for a bar (the poise bar
 * wants Stagger's own text, which is content and not this file's to know).
 */
export function resourceBars(plan, { surface, tooltipExtra } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'resbars';
  wrap.dataset.surface = surface || 'main';
  if ((surface || 'main') === 'main') {
    // THE HYBRID LINES. Consecutive plan bars with the same truthy band share
    // a line; everything else lines alone. Consecutive-only is deliberate:
    // the plan is already in `order` order, and a band split across the stack
    // would be a row author asking for two contradictory things at once —
    // rendering it as two lines keeps the order authoritative.
    for (const group of groupByBand(plan)) {
      const line = document.createElement('div');
      line.className = 'resline';
      for (const bar of group) line.appendChild(hybridUnit(bar, tooltipExtra));
      wrap.appendChild(line);
    }
  } else {
    for (const bar of plan) wrap.appendChild(stripBar(bar, tooltipExtra));
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

/** The hybrid unit: [plate "HP 86/86"][track > pill trough]. */
function hybridUnit(bar, tooltipExtra) {
  const unit = document.createElement('div');
  unit.className = 'resunit';
  unit.dataset.res = bar.id;

  // THE PLATE. The label lives BESIDE the trough now, not inside it — the
  // owner pixels put "HP 86/86" on the unit's ground, left of the pill — so a
  // short trough can no longer collide with its own words. The three variants
  // still ride the DOM and degrade by measured fit, but the container is the
  // UNIT (whose width flex sets), not the plate (whose width its own content
  // sets — a container query there would be circular).
  //
  // THE PLATE IS RESERVED, AND THIS IS LOAD-BEARING, NOT POLISH. The trough's
  // track is the unit minus the plate — so if the plate's width followed its
  // own digits, crossing 99 -> 100 max HP would WIDEN the plate, NARROW the
  // track, and the bar for the BIGGER pool would render SHORTER. Observed,
  // not hypothesised: before this reserve, sweeping max 88 -> 120 through
  // ?shotMaxHp shrank the health bar 92.91 -> 88.53 px (tools/hudbars.mjs A1,
  // 2026-08-13). So the plate reserves the width of its own resource's DOMAIN
  // ceiling — derived per bar from data, never typed — in `ch` with tabular
  // numerals, so the reservation tracks the Text-size setting like the text
  // it is. Each degradation variant reserves its own width (a full-name
  // reservation applied while only the glyph shows would steal track for a
  // label that is not there); the CSS applies each var in the same container
  // window that shows its variant.
  const digits = String(Math.trunc(Math.max(bar.max, bar.domain || bar.max, 1))).length;
  const plate = document.createElement('div');
  plate.className = 'resplate';
  plate.style.setProperty('--plate-reserve-full', `${bar.name.length + 2 * digits + 2.5}ch`);
  plate.style.setProperty('--plate-reserve-num', `${2 * digits + 4}ch`);
  plate.innerHTML =
    `<span class="l-full">${esc(bar.name)} ${bar.cur}/${bar.max}</span>` +
    `<span class="l-num">${esc(bar.glyph)} ${bar.cur}/${bar.max}</span>` +
    `<span class="l-glyph">${esc(bar.glyph)}</span>`;
  unit.appendChild(plate);

  const track = document.createElement('div');
  track.className = 'restrack';
  track.appendChild(troughEl(bar));
  unit.appendChild(track);

  attachTooltip(unit, () => tooltipHtml(bar, tooltipExtra));
  return unit;
}

/** The under-model strip bar: trough with the label inside (unchanged shape). */
function stripBar(bar, tooltipExtra) {
  const el = troughEl(bar);
  const label = document.createElement('div');
  label.className = 'label';
  label.innerHTML =
    `<span class="l-full">${esc(bar.glyph)} ${esc(bar.name)} ${bar.cur}/${bar.max}</span>` +
    `<span class="l-num">${esc(bar.glyph)} ${bar.cur}/${bar.max}</span>` +
    `<span class="l-glyph">${esc(bar.glyph)}</span>`;
  el.appendChild(label);
  attachTooltip(el, () => tooltipHtml(bar, tooltipExtra));
  return el;
}

/** The trough itself — the one element whose LENGTH is the data. */
function troughEl(bar) {
  const el = document.createElement('div');
  el.className = `bar resbar resbar-${bar.weight}`;
  el.dataset.res = bar.id;
  // THE TROUGH LENGTH — the one line that is his whole instruction.
  el.style.width = `${bar.lengthPct.toFixed(3)}%`;
  el.style.setProperty('--res-tint', bar.tint);
  // THE MACHINE-READABLE HOME, and it is not decoration. The label degrades
  // to a glyph on a short unit, so `.textContent` is neither stable nor a fair
  // reading of what the bar says. Instruments and assistive tech read these
  // instead: tools/veil-owns-input.mjs and tools/hudbars.mjs both do.
  el.dataset.cur = String(bar.cur);
  el.dataset.max = String(bar.max);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${bar.name} ${bar.cur} of ${bar.max}`);

  // THE MINIMUM-WIDTH CLAUSE — `min-width: var(--resbar-min)` in CSS does the
  // flooring; whether the floor FIRED is a rendered fact (it depends on the
  // track, the zoom and the floor together), so it is stamped after layout by
  // markFlooredBars() rather than guessed at here. A floored trough is drawn
  // DASHED — the broken-axis mark — because two different maxima below the
  // floor render the same length, and a bar that is no longer to scale must
  // not look like one that is.
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.width = `${bar.pct.toFixed(2)}%`;
  el.appendChild(fill);
  return el;
}

function tooltipHtml(bar, tooltipExtra) {
  const extra = (tooltipExtra && tooltipExtra(bar)) || '';
  // The tooltip is the floor of legibility for this bar: whatever the plate is
  // too narrow to print, this always says. Including the maximum, which is the
  // number a floored bar has stopped encoding.
  return `<div class="tt-title">${esc(bar.name)}</div>${bar.cur} / ${bar.max}. ${extra}`;
}

/**
 * markFlooredBars(root) — stamp `data-floored` on every bar the minimum-width
 * clause caught, by MEASURING the rendered trough against the floor.
 *
 * Called after layout. A bar is floored when its rendered width is wider than
 * the width its own lengthPct asked for — which is precisely what `min-width`
 * winning looks like, and it needs no second copy of the floor's value.
 *
 * The track each percentage resolves against is the bar's own CONTAINING BLOCK
 * (`.restrack` on the hybrid HUD, the strip on the model surface) — measured
 * per bar rather than passed in, because since the hybrid two bars on one line
 * no longer share a track and a single passed-in width would be wrong for one
 * of them. The old second parameter is accepted and ignored.
 */
export function markFlooredBars(root) {
  const bars = root.querySelectorAll('.resbar');
  for (const el of bars) {
    const asked = parseFloat(el.style.width); // percent
    const trackW = el.parentElement ? el.parentElement.getBoundingClientRect().width : 0;
    if (!Number.isFinite(asked) || !trackW) continue;
    const wanted = (asked / 100) * trackW;
    const got = el.getBoundingClientRect().width;
    if (got > wanted + 0.5) el.dataset.floored = '1';
    else delete el.dataset.floored;
  }
}
