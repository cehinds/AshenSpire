// src/ui/components/tooltip.js — one shared tooltip, ≤150 ms hover (SPEC §7.3)

import { anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';

let tipEl = null;
let showTimer = null;

// ---------------------------------------------------------------------------
// E8 — THE TOOLTIP STAYS UP UNTIL SOMETHING REPLACES IT. Constantine, verbatim:
//
//   "when selecting and holding on a card the tool tip pops up for a second and
//    then the zoom in card replaces it. instead keep the tooltip up after
//    holding the card for a set period of time and disappears once another card
//    is selected or it is played or another menu or game state activates"
//
// So a tooltip a COMPLETED HOLD summoned is STUCK: it outlives the thing that
// used to kill it — the zoom card opening, and then the pointer leaving on the
// lift, which on a phone is the same instant. Nothing else changes. A hover
// tooltip, a focus-cursor tooltip and the tap refusal keep today's behaviour to
// the line, because he was talking about the hold and about nothing else.
//
// WHAT ENDS IT — his three, on TWO wires, and the split is measured.
// He named: another card selected · it is played · another menu or game state
// activates.
//   · PLAYED, END TURN, a flask, Escape, arming a self card, a menu opening —
//     every one of those ALREADY calls hideTooltip(), from combat.js, quicknav
//     and disclosure. They keep working with no edit at all, because
//     hideTooltip() is still the unconditional off switch. Two thirds of his
//     ask turned out to be wired before he asked for it; only the zoom was
//     fighting it.
//   · ANOTHER CARD SELECTED had NO wire. Merely selecting a targetable card
//     hides no tooltip anywhere in the tree — invisible until now, because the
//     pointer leaving killed it first. That one is carried below: A STUCK
//     TOOLTIP ENDS WHEN THE CARD IT EXPLAINS LEAVES THE DOM, and combat
//     rebuilds `.hand` wholesale on every state change (hand.js: `innerHTML =
//     ''`). Derived from the screen instead of restated at each select site —
//     click, keyboard and flask all re-render, so all three are covered by one
//     watch rather than by three lines nobody will keep in sync.
//     THE WATCH IS ON THE DOCUMENT, NOT ON THE CARD'S PARENT, and the reason is
//     measured: co-op replaces `.hand` instead of emptying it, which a parent
//     watch cannot see. See stickTooltip() — the sentence that used to stand
//     here was true of combat.js and false of the other screen that mounts
//     this same hand. (Bjorn, gating this commit.)
// I WROTE "ALL THREE ARE ONE MECHANISM" HERE FIRST AND IT WAS WRONG:
// tooltippersist --selftest P3 cuts the watch and only the SELECT case goes
// red. The sentence now says what the plant showed.
//
// AND THE FLOOR, WHICH IS THE HALF THAT COULD HURT SOMEONE: a tooltip that
// cannot be got rid of is a worse bug than one that vanishes too soon. Three
// things hold it down. (1) `#tooltip` is `pointer-events: none` (ui.css:5), so
// however long it stays it can never swallow a tap meant for the game. (2) Any
// other tooltip replaces it — hover anything and the stick is gone with it.
// (3) stickTooltip() REFUSES to stick at all unless the thing that will end it
// is watchable; see there. Persistence is granted only where an exit exists.
//
// WHAT IS DELIBERATELY NOT HERE: no timeout — his sentence gives a closed list
// of endings and a clock is not on it; no dismissal on a press elsewhere — he
// did not say that, and inventing it is how a silence becomes a rule.
// ---------------------------------------------------------------------------
let stuck = false;
let stuckWatch = null;

function unstick() {
  stuck = false;
  if (stuckWatch) { stuckWatch.disconnect(); stuckWatch = null; }
}

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
  // "…until SOMETHING REPLACES IT." This is that something, and it is the only
  // place the word is spoken: whatever was stuck is now gone, and what takes its
  // place is an ordinary tooltip again unless its own hold sticks it.
  unstick();
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
    // The timer is cleared either way — that is today's behaviour and a stuck
    // tooltip is no reason to let a half-started hover fire behind it.
    clearTimeout(showTimer);
    if (stuck) return; // E8: a completed hold outlives the pointer leaving
    if (tipEl) tipEl.style.display = 'none';
  });
  el.addEventListener('gpfocus', () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(show, 160);
  });
  el.addEventListener('gpblur', () => {
    // Same guard, and it can only ever fire on a tooltip the pad did not
    // summon: the hold is a pointer gesture, so nothing the focus cursor shows
    // is ever stuck. Guarded for consistency, not for a case we have seen.
    if (stuck) return;
    hideTooltip();
  });
}

/**
 * stickTooltip(el) → boolean — keep the tooltip that is on screen NOW until
 * something replaces it or `el` leaves the DOM. Returns whether it stuck.
 *
 * The one caller is the hand's completed reading hold (hand.js), which is the
 * gesture E8 is about; `el` is the card being read.
 *
 * IT REFUSES MORE THAN IT ACCEPTS, ON PURPOSE. No tooltip on screen → nothing
 * to keep. An element that is not in the document, or no MutationObserver in
 * this runtime → NOTHING COULD EVER END IT, so it does not begin: the tooltip
 * stays ordinary and hides on the next leave, exactly as it does today. A
 * refusal here is a tooltip that behaves like dev's; the alternative is one a
 * player cannot get rid of, and between those two the choice is not close.
 *
 * THE REFUSAL IS SILENT AND THAT IS A KNOWN BOUNDARY, NOT A CLAIM: hand.js
 * ignores the return value, nothing renders it, and no check plants a runtime
 * without MutationObserver. A refused stick is indistinguishable from dev's
 * behaviour from the outside — which is the point of the floor and also the
 * reason it cannot currently be observed. (Bjorn, gating 87a8ad2.)
 */
export function stickTooltip(el) {
  if (!tipEl || tipEl.style.display !== 'block') return false;
  // `isConnected`, not `parentNode`: the predicate the watch below tests IS
  // `el.isConnected`, and a detached subtree has a parentNode. One fact, one
  // reading — the guard and the watch can no longer disagree.
  if (!el || !el.isConnected || typeof MutationObserver === 'undefined') return false;
  unstick();
  // WATCHED AT THE DOCUMENT, NOT AT THE CARD'S PARENT, AND THE DIFFERENCE IS A
  // MEASURED DEFECT rather than a preference. The predicate is `isConnected`,
  // so the watch has to fire on every change that can falsify it. A childList
  // observer on the card's own parent fires when that parent's CHILDREN change
  // and NEVER when the PARENT ITSELF is removed — and both topologies ship:
  // combat.js empties `.hand` in place (`handEl.innerHTML = ''`, hand.js), so
  // the parent watch worked there, while coop.js rebuilds the whole screen
  // (`app.innerHTML = …`) and REPLACES `.hand`, so the watched node was
  // detached, the callback never ran, and the tooltip outlived the card.
  // Measured 2026-08-17 on `?shot=coop` at 390x844, before this line changed:
  // after the hold, "another card selected", END TURN and three further taps
  // ALL left it standing, naming a card that had left the DOM three renders
  // ago — all three of his endings dead on that surface, because coop.js also
  // carries zero hideTooltip() calls of its own. One watch that cannot be
  // wrong about which parent, instead of two screens that must agree.
  // Cost, stated: one `isConnected` test per structural mutation anywhere, and
  // only while a tooltip is stuck. Held by tools/tooltippersist.mjs plant P4.
  stuckWatch = new MutationObserver(() => { if (!el.isConnected) hideTooltip(); });
  stuckWatch.observe(document.documentElement, { childList: true, subtree: true });
  stuck = true;
  return true;
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
  // Still the unconditional off switch, and deliberately so: every screen that
  // already calls it — play, flask, end turn, Escape, self-arm, drag start,
  // quicknav, disclosure — is one of his endings, and none of them had to
  // change. A stuck tooltip is not a stronger tooltip; it is one that ignores
  // the pointer leaving, and nothing else.
  unstick();
  clearTimeout(showTimer);
  if (tipEl) tipEl.style.display = 'none';
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
