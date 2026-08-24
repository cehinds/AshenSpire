// src/ui/components/resbars.js — the ONE renderer for every resource bar.

import { anchorLocalBox } from '../fx.js';
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
//             ("HP 86/86") to the LEFT of a pill trough. The canonical main
//             HUD gives HP, MP and SP one vertical line each, in that order.
//             Generic band support remains for other authored surfaces. The
//             trough's track is its unit's remaining width, derived by flex —
//             nothing types a ceiling, so a bar cannot overflow its cell
//             (Law 2 by construction; tools/hudbars.mjs measures it anyway).
//   'model' — unchanged: the under-model strip keeps its inside label, which
//             is also what the approved combat mock draws under the fighters.
//
// NOTHING IS TYPED. The line splits into equal unit cells by flex; the trough
// track is unit minus plate, derived; the trough is a percentage of that.

import { attachTooltip, esc } from './tooltip.js';

const cardFrameObservers = new Map();
let detachedFrameCleanup = null;

function observeCardFrames(wrap) {
  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => syncCardFrames(wrap));
  observer.observe(wrap);
  cardFrameObservers.set(wrap, observer);
  wrap._cardFrameObserver = observer;

  if (!detachedFrameCleanup && typeof MutationObserver !== 'undefined') {
    detachedFrameCleanup = new MutationObserver(() => {
      for (const [candidate, candidateObserver] of cardFrameObservers) {
        if (candidate.isConnected) continue;
        candidateObserver.disconnect();
        cardFrameObservers.delete(candidate);
      }
      if (!cardFrameObservers.size) {
        detachedFrameCleanup.disconnect();
        detachedFrameCleanup = null;
      }
    });
    detachedFrameCleanup.observe(document.documentElement, { childList: true, subtree: true });
  }
}

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
    // THE HYBRID LINES. Main-HUD content currently supplies no bands: HP, MP
    // and SP each own one vertical line. Generic consecutive band support stays
    // available for another authored surface. Consecutive-only is deliberate:
    // the plan is already in `order` order, and a band split across the stack
    // would be a row author asking for two contradictory things at once —
    // rendering it as two lines keeps the order authoritative.
    for (const group of groupByBand(plan)) {
      const line = document.createElement('div');
      line.className = 'resline';
      for (const bar of group) line.appendChild(hybridUnit(bar, tooltipExtra));
      wrap.appendChild(line);
    }
    // The full unit is the invisible reference track. The bordered card behind
    // its plate + trough ends just after the scaled trough. A ResizeObserver
    // keeps that visual frame aligned when the viewport or UI scale changes.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => syncCardFrames(wrap));
    observeCardFrames(wrap);
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

  const frame = document.createElement('div');
  frame.className = 'rescard-frame';
  frame.setAttribute('aria-hidden', 'true');
  unit.appendChild(frame);

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
  //
  // THE CEILING IS `labelMax`, NOT `domain`, AND THE DIFFERENCE IS THE WHOLE
  // POINT (E9 / #254, 2026-08-22). `domain` is now the REFERENCE his ruling
  // set — 200 HP, 20 MP, 20 SP — an upper mark far above anything the content can
  // reach. The plate must reserve the widest LABEL it can ever draw, which is
  // set by the largest max the CONTENT can produce (96, 4, 4). Reserving from
  // the reference put three digits where two will ever print and crushed the
  // banded pool cells to 5.81 px at 320x640, clipping "◆ 2/2" — measured, and
  // the derivation of `labelMax` is in model/resources.js resourceLabelCeilings.
  // The fallback chain keeps a legacy plan (no labelMax) rendering as before.
  const ceiling = Number.isFinite(bar.labelMax) ? bar.labelMax : (bar.domain || bar.max);
  const digits = String(Math.trunc(Math.max(bar.max, ceiling, 1))).length;
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

/** Align the visible card to the scaled trough; the unit stays full-width. */
function syncCardFrames(root) {
  const RIGHT_PAD = 6;
  for (const unit of root.querySelectorAll('.resunit')) {
    const frame = unit.querySelector(':scope > .rescard-frame');
    const bar = unit.querySelector('.restrack > .resbar');
    if (!frame || !bar) continue;
    const unitBox = anchorLocalBox(unit, unit);
    const barBox = anchorLocalBox(unit, bar);
    const width = Math.min(unitBox.width, Math.max(0, barBox.left + barBox.width + RIGHT_PAD));
    frame.style.width = `${width}px`;
  }
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

  // There is deliberately no absolute minimum width. `width` remains the
  // rendered max/reference percentage even when the result is only a few
  // pixels wide; a floor would make different maxima draw the same length.
  const fill = document.createElement('div');
  fill.className = 'fill';
  fill.style.width = `${bar.pct.toFixed(2)}%`;
  el.appendChild(fill);
  return el;
}

function tooltipHtml(bar, tooltipExtra) {
  const extra = (tooltipExtra && tooltipExtra(bar)) || '';
  // Whatever the plate is too narrow to print, the tooltip always says.
  return `<div class="tt-title">${esc(bar.name)}</div>${bar.cur} / ${bar.max}. ${extra}`;
}
