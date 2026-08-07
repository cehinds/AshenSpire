// src/ui/components/tooltip.js — one shared tooltip, ≤150 ms hover (SPEC §7.3)

import { anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';

let tipEl = null;
let showTimer = null;

function ensure() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'tooltip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

// Container: THE VIEWPORT. #tooltip is `position: fixed` (ui.css:5), so the
// viewport is its containing block — the right bound for this one element, which
// must be readable wherever the pointer is. That is not the default answer for a
// positioned element and it is written down because it is a decision.
//
// EldenSpire#15 — and read the fix as an ORDER, not as an addition. The four
// clamps below were already here, on both axes in both directions, and they were
// arithmetically correct: they compared `innerWidth`/`innerHeight` against a
// `getBoundingClientRect()`, all visual px, like with like. Then the result was
// written into `style.left`, which <body>'s `zoom: var(--ui-zoom)` reads in LOCAL
// px, and multiplied it back up. At 1920×1080 (zoom 1.48) the tooltip landed at
// top 1406 in a 1080px viewport with not one pixel on screen: the hover fired, the
// card lifted, and the explanation was simply nowhere the player could look. Right
// arithmetic, wrong room.
//
// So every number below is converted to local FIRST, once, and only then compared.
// `viewportLocalBox()` replaces the raw `innerWidth`/`innerHeight`, `b` replaces
// the raw rect, and `pad`/`8`/`4` stay exactly the numbers they were — they were
// always local px and always meant to be (Marina's Rule 3: px is admissible where
// a value must not answer to the text-size setting; a hover gap is not read text).
function position(x, y) {
  const el = ensure();
  const pad = 14;
  const view = viewportLocalBox();
  const b = anchorLocalBox(VIEWPORT_ORIGIN, el);
  const c = anchorLocalBox(VIEWPORT_ORIGIN, { left: x, top: y, width: 0, height: 0 });
  let left = c.left + pad;
  let top = c.top + pad;
  // Flip to the other side of the pointer rather than overhang the edge.
  if (left + b.width > view.width - 8) left = c.left - b.width - pad;
  if (top + b.height > view.height - 8) top = c.top - b.height - pad;
  // …and then bound it regardless, so a wrong answer above is a misplaced tooltip
  // and never an absent one. keep defaults to the whole box: this is text to read.
  const at = clampBox({ left, top, width: b.width, height: b.height }, view);
  el.style.left = `${at.left}px`;
  el.style.top = `${at.top}px`;
}

/**
 * attachTooltip(el, contentFn) — contentFn() → HTML string (computed at show
 * time so numbers are always live). Shows on pointer hover AND on the
 * keyboard/gamepad focus cursor (input.js dispatches gpfocus/gpblur when the
 * gp-focus cursor lands on / leaves an element), so controller players get
 * every tooltip a mouse would.
 */
export function attachTooltip(el, contentFn) {
  const show = (x, y) => showTooltipAt(x, y, contentFn());
  el.addEventListener('pointerenter', (ev) => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => show(ev.clientX, ev.clientY), 140);
  });
  el.addEventListener('pointermove', (ev) => {
    if (tipEl && tipEl.style.display === 'block') position(ev.clientX, ev.clientY);
  });
  el.addEventListener('pointerleave', () => {
    clearTimeout(showTimer);
    if (tipEl) tipEl.style.display = 'none';
  });
  el.addEventListener('gpfocus', () => {
    clearTimeout(showTimer);
    const r = el.getBoundingClientRect();
    showTimer = setTimeout(() => show(r.right, r.top), 160);
  });
  el.addEventListener('gpblur', hideTooltip);
}

/**
 * showTooltipAt(x, y, html) — put the one tooltip at a point, now.
 *
 * Hover and the focus cursor both arrive here through attachTooltip. A TAP has
 * neither, and a tap is the whole of a phone: components/refusal.js calls this
 * so a control that refuses can answer the finger that pressed it, at the place
 * it was pressed. Empty html shows nothing rather than an empty box.
 */
export function showTooltipAt(x, y, html) {
  if (!html) return false;
  const t = ensure();
  t.innerHTML = html;
  t.style.display = 'block';
  position(x, y);
  return true;
}

export function hideTooltip() {
  clearTimeout(showTimer);
  if (tipEl) tipEl.style.display = 'none';
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
