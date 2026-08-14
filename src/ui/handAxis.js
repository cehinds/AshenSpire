// src/ui/handAxis.js — THE ONE HOME of the hand strip's Law 5 exemption.
//
// One fact lives here: under PAGING the hand strip scrolls sideways BY DESIGN —
// Constantine's own word, D19 (2026-08-13, commons/decisions/directions.md),
// verbatim: "overlap and paging" — so the strip is Law 5 clause 2's honest
// case: the horizontal run IS the content. The declaration attributes
// (data-scroll-axis / -mode / -why, read by tools/axisfit.mjs) name that at
// the container, with his word as the reason.
//
// HISTORY, so nobody reads this as convenience: D17 msg 3 (2026-08-08) is him
// ANNOYED at this exact scroller — "I'm annoyed that in mobile, that the
// default hand size requires me to scroll left and right" — and on that word
// axisfit refused `.hand` an exemption by name from 2026-08-08 to 2026-08-14.
// D19's later word is what makes this writable. It cites him, not us; if
// either word moves, this file moves with it.
//
// ONE RENDERER NOW (2026-08-15). From 2026-08-14 to 2026-08-15 this file held
// TWO exports because the hand had two renderers: combat.js's mode-scoped
// declaration, and coop.js's own `.hand` — a pager-only twin with no overlap
// arm — carrying an UNSCOPED one whose why-string named the renderer collapse
// as standing debt. That debt is paid: both surfaces mount
// src/ui/components/hand.js (the way both maps mount components/mapboard.js),
// the component reads the hand-layout word on either surface, and the
// unscoped exemption died with the fork — its A4 wake (axisfit sweeping coop
// under both modes) was observed firing on the day the overlap arm arrived,
// exactly as designed, and the coop[overlap] cells now assert ZERO like any
// undeclared container. The mode-scoped declaration below is the whole story.
//
// The word's one home is balance.ui.handLayout; main.js derives it onto
// <html data-hand-layout>; this file reads the ATTRIBUTE and nothing else.
// The word has no settings row, so mount-time is the declaration's lifetime —
// if a live toggle ever ships, the component must re-derive on flip.

const D19 = "his word, D19 2026-08-13: 'overlap and paging'";

/**
 * Apply (or clear) the mode-scoped exemption on the hand container itself.
 * Present only while the page's word is 'paging'; absent under 'overlap',
 * where components/hand.js lays the strip at zero travel and axisfit asserts
 * it. Attribute order (axis, mode, why) is fixed: it is the order the old
 * template string carried, and it keeps the paging DOM byte-identical across
 * the renderer collapse (tools/handlayout.mjs hashes .hand-area to hold that).
 */
export function applyHandExemption(el) {
  if (document.documentElement.dataset.handLayout === 'paging') {
    el.setAttribute('data-scroll-axis', 'x');
    el.setAttribute('data-scroll-axis-mode', 'paging');
    el.setAttribute('data-scroll-axis-why',
      `paging is the designed horizontal pager — ${D19}; scoped to this mode, absent under overlap`);
  } else {
    el.removeAttribute('data-scroll-axis');
    el.removeAttribute('data-scroll-axis-mode');
    el.removeAttribute('data-scroll-axis-why');
  }
}
