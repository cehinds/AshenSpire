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
// TWO RENDERERS, ONE DERIVATION (Bjorn's refused gate, 2026-08-14): the hand
// is rendered by combat.js AND by coop.js's own template. #169 derived the
// exemption inside combat.js's template and the coop hand shipped undeclared —
// one fact, two renderers, one home. The string is built HERE, once, and both
// renderers call in; neither may retype it. The two exports differ because the
// two renderers' truths differ, and a declaration states the truth of the
// renderer that carries it:
//
//   modeScopedHandExemption() — combat.js. That renderer READS the hand-layout
//     word (its overlap arm lays the whole hand inside the strip at zero
//     travel), so its exemption exists only under 'paging' and says so
//     (data-scroll-axis-mode). axisfit's A5 fails the declaration found under
//     any other word.
//
//   pagerOnlyHandExemption() — coop.js. That renderer implements ONLY the
//     paging strip: no overlap arm, no reader of the word, so its hand travels
//     identically under either mode (measured: H 211px at 390x844 under BOTH
//     words, axisfit 411b89c). A mode-scoped declaration would lie twice —
//     conditional, it vanishes under overlap while the travel stays
//     (undeclared red); copied verbatim, it sits scoped to a word the page
//     contradicts (A5 red). So it is UNSCOPED: true in every mode, and it
//     SAYS it is renderer-scoped. Its wake is in the instrument, not here:
//     axisfit sweeps coop under both modes, and the day coop.js grows an
//     overlap arm, the coop[overlap] cells reach zero travel and A4 fires on
//     this declaration, forcing a person to re-scope it.
//
// STANDING DEBT, named (Bjorn: "coop.js is now two laws deep in undelivered
// fixes" — the map then, the hand now): the honest end state is ONE hand
// renderer — coop's combat board mounting the same hand component as solo, the
// way its map now mounts ui/components/mapboard.js. That is a real refactor of
// an entangled render path (selection, targeting, network intents vs local
// dispatch), not one act; until it lands, this module is the seam that keeps
// the fact single-homed across the split.
//
// The word's one home is balance.ui.handLayout; main.js derives it onto
// <html data-hand-layout>; this file reads the ATTRIBUTE and nothing else.
// The word has no settings row, so mount-time is the declaration's lifetime —
// if a live toggle ever ships, both callers must re-derive on flip.

const D19 = "his word, D19 2026-08-13: 'overlap and paging'";

// The attribute string has one shape and it is built in one place. `why` must
// not contain double quotes — it lands inside an HTML attribute.
function attrs(why, mode) {
  return ` data-scroll-axis="x"${mode ? ` data-scroll-axis-mode="${mode}"` : ''}`
    + ` data-scroll-axis-why="${why}"`;
}

/** combat.js — mode-scoped: present only while the page's word is 'paging'. */
export function modeScopedHandExemption() {
  return document.documentElement.dataset.handLayout === 'paging'
    ? attrs(`paging is the designed horizontal pager — ${D19}; scoped to this mode, absent under overlap`, 'paging')
    : '';
}

/** coop.js — renderer-scoped: this renderer pages in every mode, and says so. */
export function pagerOnlyHandExemption() {
  return attrs(`the co-op hand is the same designed pager — ${D19} — and this renderer (coop.js)`
    + ' implements only the paging strip: no overlap arm, no reader of the hand-layout word,'
    + ' so the exemption is unscoped and true in every mode; collapsing the two hand renderers'
    + ' into one is named standing debt (src/ui/handAxis.js)');
}
