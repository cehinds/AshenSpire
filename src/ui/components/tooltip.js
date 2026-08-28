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
//
// BESIDE THE ANCHOR, NEVER OVER IT — and the anchor is a BOX, because a point
// is a box with no extent and that is the only difference between the two ways
// a tooltip gets summoned.
//
// This function had two callers giving it two different answers for the same
// question. Hover passed the POINTER, so the tooltip appeared 14px inside a
// card the pointer was sitting on and covered the thing it was explaining; the
// gamepad focus cursor passed the ELEMENT'S RIGHT EDGE and did not. One
// tooltip, one element, two positions depending on which device you held.
// Measured on the Smith preview at 1200x730: the hover tooltip covered 16.53%
// of the card face on 15 of 20 candidates.
//
// So there is one answer now: put the box beside the anchor's box. A tap has no
// element — refusal.js answers a finger at the point it pressed — and passes a
// zero-size box, for which every line below reduces to exactly the arithmetic
// that was here before (left = x + pad, top = y + pad, and both flips
// subtracting the pad). That is deliberate: the tap path is unchanged, and it
// is unchanged by ARITHMETIC rather than by a second branch.
function place(anchor) {
  const el = ensure();
  const pad = 14;
  const view = viewportLocalBox();
  // MEASURE ITS NATURAL BOX, NOT THE ONE ITS LAST POSITION SQUEEZED IT INTO.
  // #tooltip is `position: fixed` with a max-width and no width, so it is laid
  // out in the space between style.left and the right edge: parked at left 384
  // in a 433-wide room it gets 49px, wraps tall and narrow, and THAT is the box
  // the next placement is computed from. Where it was decided how big it is,
  // which decided where it goes next — the same tooltip measured 280x220 or
  // 171x384 depending only on what you hovered before it. Predates this change
  // (the old code read the same rect the same way) and it only became visible
  // once placement started depending on the box's size on both axes. Zeroing
  // first costs one layout and makes the measurement a property of the CONTENT.
  el.style.left = '0px';
  el.style.top = '0px';
  const b = anchorLocalBox(VIEWPORT_ORIGIN, el);
  const a = anchorLocalBox(VIEWPORT_ORIGIN, anchor);
  const fits = (p) => p.left >= 4 && p.top >= 4
    && p.left + b.width <= view.width - 8 && p.top + b.height <= view.height - 8;

  let at0;
  if (a.width || a.height) {
    // FOUR sides, not two. "Beside it" is not a special case of right-and-left:
    // at 390 the tooltip is 252 local px wide and a card is ~104, so for most of
    // the hand there is no horizontal room on EITHER side and a left/right-only
    // rule lands back on the card via the clamp. Measured: 5 of 80 tooltips
    // still covered their control until below/above were in the list.
    //
    // ONLY THE SEPARATING AXIS IS PINNED. A tooltip below a control has to be
    // below it; it does not have to be left-aligned with it, and pinning the
    // free axis as well is what made three of them fail — the below/above
    // candidates were being rejected for horizontal overflow while the vertical
    // room they existed to use was sitting there empty.
    const slideX = Math.min(Math.max(4, a.left), Math.max(4, view.width - 8 - b.width));
    const slideY = Math.min(Math.max(4, a.top), Math.max(4, view.height - 8 - b.height));
    at0 = [
      { left: a.left + a.width + pad, top: slideY },      // right of it
      { left: a.left - b.width - pad, top: slideY },      // left of it
      { left: slideX, top: a.top + a.height + pad },      // below it
      { left: slideX, top: a.top - b.height - pad },      // above it
    ].find(fits) || { left: a.left + a.width + pad, top: slideY };
  } else {
    // A POINT has no sides to be outside of, so "outside the anchor" degenerates
    // to the offset-from-the-pointer rule — which is what a tap wants anyway
    // (refusal.js answers the finger where it pressed). The four lines below are
    // the ORIGINAL arithmetic, unchanged, including the independent per-axis
    // flip: this path is not being retuned, and keeping it verbatim is how that
    // is checkable rather than asserted.
    let left = a.left + pad;
    let top = a.top + pad;
    if (left + b.width > view.width - 8) left = a.left - b.width - pad;
    if (top + b.height > view.height - 8) top = a.top - b.height - pad;
    at0 = { left, top };
  }
  // …and then bound it regardless, so a wrong answer above is a misplaced tooltip
  // and never an absent one. keep defaults to the whole box: this is text to read.
  // When no side fits, this is what puts it back on screen — ON the control,
  // which is the right trade: unreadable beats misplaced, absent beats neither.
  const at = clampBox({ left: at0.left, top: at0.top, width: b.width, height: b.height }, view);
  el.style.left = `${at.left}px`;
  el.style.top = `${at.top}px`;
}

/**
 * The one way the tooltip is ever shown: fill it, reveal it, place it beside
 * its anchor. Both entry points below are this function plus an anchor — the
 * element for hover and the focus cursor, a zero-size box for a tap — so the
 * "how" cannot drift between them while the "where" differs.
 */
function showWith(html, anchor) {
  if (!html) return false;
  const t = ensure();
  t.innerHTML = html;
  t.style.display = 'block';
  place(anchor);
  return true;
}

/**
 * attachTooltip(el, contentFn) — contentFn() → HTML string (computed at show
 * time so numbers are always live). Shows on pointer hover AND on the
 * keyboard/gamepad focus cursor (input.js dispatches gpfocus/gpblur when the
 * gp-focus cursor lands on / leaves an element), so controller players get
 * every tooltip a mouse would.
 */
export function attachTooltip(el, contentFn) {
  // Both input paths anchor to the ELEMENT, which is what they are both
  // explaining. The pointermove listener that used to drag the tooltip back
  // under the cursor is gone with the pointer anchor it served: a tooltip that
  // follows the pointer across a card is a tooltip that sits on the card.
  const show = () => showWith(contentFn(), el.getBoundingClientRect());
  el.addEventListener('pointerenter', () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(show, 140);
  });
  el.addEventListener('pointerleave', () => {
    clearTimeout(showTimer);
    if (tipEl) tipEl.style.display = 'none';
  });
  el.addEventListener('gpfocus', () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(show, 160);
  });
  el.addEventListener('gpblur', hideTooltip);
}

/**
 * showTooltipAt(x, y, html) — put the one tooltip at a point, now.
 *
 * A TAP has no element to sit beside, and a tap is the whole of a phone:
 * components/refusal.js calls this so a control that refuses can answer the
 * finger that pressed it, at the place it was pressed. The point becomes a
 * zero-size anchor box, which place() resolves to the exact offsets this path
 * has always used. Empty html shows nothing rather than an empty box.
 *
 * Hover and the focus cursor no longer come through here — they anchor to their
 * element inside attachTooltip. This entry point is the POINT case only.
 */
export function showTooltipAt(x, y, html) {
  return showWith(html, { left: x, top: y, width: 0, height: 0 });
}

export function hideTooltip() {
  clearTimeout(showTimer);
  if (tipEl) tipEl.style.display = 'none';
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
