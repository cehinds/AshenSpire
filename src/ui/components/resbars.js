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
// NOTHING IS TYPED. The track is whatever flexbox leaves after the two top-row
// buttons take their fixed size; the trough is a percentage of that. Law 2's
// "names its container and is proven inside it" is satisfied by construction —
// a percentage of a derived track cannot overflow it — and tools/hudbars.mjs
// measures it anyway rather than trusting the argument.

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
  for (const bar of plan) {
    const el = document.createElement('div');
    el.className = `bar resbar resbar-${bar.weight}`;
    el.dataset.res = bar.id;
    // THE TROUGH LENGTH — the one line that is his whole instruction.
    el.style.width = `${bar.lengthPct.toFixed(3)}%`;
    el.style.setProperty('--res-tint', bar.tint);
    // THE MACHINE-READABLE HOME, and it is not decoration. The label degrades
    // to a glyph on a short bar, so `.textContent` is neither stable nor a fair
    // reading of what the bar says — three variants ride in the DOM and hidden
    // ones still land in textContent. Instruments and assistive tech read these
    // instead: tools/veil-owns-input.mjs and tools/hudbars.mjs both do.
    el.dataset.cur = String(bar.cur);
    el.dataset.max = String(bar.max);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${bar.name} ${bar.cur} of ${bar.max}`);

    // THE MINIMUM-WIDTH CLAUSE, and it is declared here rather than computed.
    // `min-width: var(--resbar-min)` in CSS does the flooring; this flag exists
    // so the trough can SAY it is floored. See the CSS for the justification —
    // a floored bar is drawn dashed, which is the broken-axis mark, because two
    // different maxima below the floor render the same length and a bar that is
    // no longer to scale must not look like one that is.
    //
    // Whether the floor FIRED is a rendered fact, not a computed one (it depends
    // on the track, the zoom and the floor together), so it is stamped after
    // layout by markFlooredBars() rather than guessed at here.
    el.dataset.res = bar.id;

    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${bar.pct.toFixed(2)}%`;
    el.appendChild(fill);

    // THE LABEL DEGRADES BY MEASURED FIT, not by a typed threshold. The compact
    // form keeps the resource glyph beside its numbers: a bare `20/40` still
    // reports quantity, but on a two-row HUD it withholds WHICH pool it is.
    // Marina rendered `maxMana = 2` at 48 px and watched "MANA" collide with
    // "1/2". Three variants ride in the DOM and CSS container queries pick the
    // widest that fits — in `em`, so the choice tracks the player's Text size
    // setting, which is exactly what "does the word fit" depends on. This is
    // NOT Law 4 chrome-scaling: the BOX is text-independent (px under zoom);
    // only the question "can a word fit in it" answers to text size.
    const label = document.createElement('div');
    label.className = 'label';
    label.innerHTML =
      `<span class="l-full">${esc(bar.name)} ${bar.cur}/${bar.max}</span>` +
      `<span class="l-num">${esc(bar.glyph)} ${bar.cur}/${bar.max}</span>` +
      `<span class="l-glyph">${esc(bar.glyph)}</span>`;
    el.appendChild(label);

    attachTooltip(el, () => {
      const extra = (tooltipExtra && tooltipExtra(bar)) || '';
      // The tooltip is the floor of legibility for this bar: whatever the
      // trough is too short to print, this always says. Including the maximum,
      // which is the number a floored bar has stopped encoding.
      return `<div class="tt-title">${esc(bar.name)}</div>${bar.cur} / ${bar.max}. ${extra}`;
    });
    wrap.appendChild(el);
  }
  return wrap;
}

/**
 * markFlooredBars(root) — stamp `data-floored` on every bar the minimum-width
 * clause caught, by MEASURING the rendered trough against the floor.
 *
 * Called after layout. A bar is floored when its rendered width is wider than
 * the width its own lengthPct asked for — which is precisely what `min-width`
 * winning looks like, and it needs no second copy of the floor's value.
 */
export function markFlooredBars(root, track) {
  const bars = root.querySelectorAll('.resbar');
  const trackW = track ? track.getBoundingClientRect().width : 0;
  for (const el of bars) {
    const asked = parseFloat(el.style.width); // percent
    if (!Number.isFinite(asked) || !trackW) continue;
    const wanted = (asked / 100) * trackW;
    const got = el.getBoundingClientRect().width;
    if (got > wanted + 0.5) el.dataset.floored = '1';
    else delete el.dataset.floored;
  }
}
