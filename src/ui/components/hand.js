// src/ui/components/hand.js — THE hand strip. One renderer, two surfaces.
//
// Until 2026-08-15 the hand was rendered TWICE: combat.js's template (the
// machinery — inspect hold, overlap arm, key hints, the mode word) and
// coop.js's own `.hand` (a snapshot-fed twin with none of it). That fork is
// how the co-op hand shipped at 27-device-px nodes' little sibling: no
// inspect hold, no overlap arm, an unscoped Law 5 exemption whose why-string
// named this collapse as the debt (Bjorn: "coop.js is two laws deep in
// undelivered fixes — the map then, the hand"). Same ruling as the map
// (mapboard.js): the STRIP is a property of the game — one renderer; WHO is
// looking supplies only viewer data. What is legitimately different per
// surface enters as parameters, never as a second template:
//
//   cards     — the viewer's list: { inst, preview?, affordable, reason?,
//               name?, selected? }. Solo passes live previewCard numbers off
//               the paced snapshot; co-op passes the host snapshot's hand
//               with a spelled-out unavailability reason (its player cannot
//               hover the engine for one).
//   wireCard  — what a card DOES. Solo wires local dispatch (drag,
//               click-to-target, self-arm); co-op wires network intents
//               (send playCard / arm an ally target). The strip itself never
//               plays a card — rendering and committing stay two hands.
//   emptyHtml — the viewer's empty state (co-op's spectator note). Solo never
//               renders a hand it cannot act in, so it passes nothing.
//
// Everything else — fan transform, z-order, key-hint badges (both surfaces
// honor 1-9/Q positionally), the inspect hold (armInspect BEFORE wireCard, in
// registration order, so a completed read can never become a play), the Law 5
// exemption (applied from its one home, src/ui/handAxis.js), and the OVERLAP
// arm of balance.ui.handLayout — is the strip's own truth and lives here once.
//
// THE OVERLAP ARM (C2), moved verbatim from combat.js:
// The word's one home is balance.ui.handLayout; main.js derives it onto
// <html data-hand-layout>; this module reads the ATTRIBUTE and nothing else.
// When the word is 'paging' (the default), the arm is inert and the render
// loop is byte-for-byte the shipped strip. Under 'overlap' on the narrow
// shape the whole hand lays inside the strip's own width: THE OVERLAP IS
// DERIVED, NEVER TYPED — measured container width, measured card width, hand
// size, so ten cards at Text XL fit exactly where five at S spread out.
// Law 5 clause 1 is the constraint the arithmetic serves: horizontal travel
// ZERO in this mode. The narrow fan is flattened on purpose: the exposed
// sliver of every card but the top IS its tap target, so it stays
// rectangular and measurable; the compensating reader is the inspect hold —
// which is exactly why the hold rides this component and not one caller: an
// overlap hand without its reader is the combination validateContent refuses.
//
// The word has no settings row, so mount-time is the exemption's lifetime —
// if a live toggle ever ships, callers must re-mount (or this must re-derive)
// on flip; the same warning rides handAxis.js.

import { renderCard } from './card.js';
import { armInspect } from '../../framework/optionDecision.js';
import { stickTooltip } from './tooltip.js';
import { applyHandExemption } from '../handAxis.js';

// The custom property this component publishes so the stylesheets can reserve
// room for the fan's upward lift without knowing how it is computed. Named here
// because the value has exactly one author; tools/hintstrip.mjs reads the NAME
// out of this file rather than typing it, so a rename cannot leave a check
// asserting a property nobody writes.
export const FAN_LIFT_PROP = '--fan-lift';

export function mountHand(handEl, { registries, wireCard = null }) {
  // The one home of the duration is balance.ui.inspectHold; the Number()||0
  // shape is why model/validate.js checks that row loud — an unreadable
  // value here would silently turn the gesture off.
  const inspectMs = Number((registries.balance.ui.inspectHold || {}).ms) || 0;
  // The Law 5 exemption, derived from ITS one home (handAxis.js): present and
  // mode-scoped under 'paging', absent under 'overlap'. Attribute order
  // (axis, mode, why) is the order the old template carried, so the paging
  // DOM stays byte-identical across the collapse.
  applyHandExemption(handEl);

  let handEls = []; // the rendered cards, in hand order (filled by render)
  let handFan = []; // each card's shipped fan transform, same index
  const handLayoutWord = () => document.documentElement.dataset.handLayout;

  function applyHandLayout() {
    if (handLayoutWord() !== 'overlap') return;
    if (!handEl.isConnected) return;
    const els = handEls.filter((el) => el.parentNode === handEl);
    const n = els.length;
    if (!n) return;
    const narrow = document.documentElement.getAttribute('data-layout') === 'narrow';
    if (!narrow) {
      // wide: the shipped fan, exactly — undo anything the narrow arm wrote.
      els.forEach((el, i) => { el.style.transform = handFan[i]; el.style.marginLeft = ''; });
      return;
    }
    // Flatten first so the measurement below reads border-box widths, not the
    // axis-aligned box of a rotated card.
    els.forEach((el) => { el.style.transform = 'none'; });
    const cs = getComputedStyle(handEl);
    // ONE COORDINATE SPACE, or the arithmetic lies (Law 2's whole subject).
    // The app scales under `body { zoom: var(--ui-zoom) }`, and the two rulers
    // available here disagree about it: clientWidth / scrollWidth / the margin
    // this writes are LOCAL px (pre-zoom), getBoundingClientRect is the zoomed
    // viewport. First cut mixed them and shipped 115 px of travel at 390x844 —
    // observed, not hypothetical. Everything below is LOCAL: the card's bcr
    // width is divided back through the body zoom it rendered under.
    const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
    // clientWidth is integer-rounded; solving against it exactly can leave the
    // content edge a sub-pixel past it, which scrollWidth then rounds UP into
    // one pixel of travel. One px is donated to certainty instead: the row is
    // solved to fit clientWidth - 1, so travel is zero by construction and
    // the instrument (tools/handlayout.mjs) can hold it at zero, not "small".
    const W = handEl.clientWidth - 1 - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const gap = parseFloat(cs.columnGap) || 0;
    const C = els[0].getBoundingClientRect().width / zoom;
    const need = n * C + (n - 1) * gap;
    const o = n > 1 ? Math.max(0, (need - W) / (n - 1)) : 0;
    els.forEach((el, i) => { el.style.marginLeft = i && o ? `${-o}px` : ''; });
  }

  // Re-derive when the measured facts move: container width (window resize),
  // card width (Text size), and the narrow/wide word main.js writes. All three
  // observers reconcile through the same function, are attached only when the
  // layout word asks for them, and dispose themselves when the strip's DOM is
  // replaced (co-op re-mounts per snapshot; solo replaces the screen wholesale).
  let ro = null;
  let mo = null;
  if (typeof ResizeObserver !== 'undefined' && handLayoutWord() === 'overlap') {
    const alive = () => document.body.contains(handEl);
    ro = new ResizeObserver(() => { if (alive()) applyHandLayout(); else ro.disconnect(); });
    mo = new MutationObserver(() => { if (alive()) applyHandLayout(); else mo.disconnect(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout'] });
    ro.observe(handEl);
  }

  function render({ cards = [], emptyHtml = null }) {
    handEl.innerHTML = '';
    handEls = [];
    handFan = [];
    // An empty hand fans nothing, so it reserves nothing — stated rather than
    // left at the last render's value.
    if (emptyHtml != null) { handEl.style.setProperty(FAN_LIFT_PROP, '0px'); handEl.innerHTML = emptyHtml; return; }
    const n = cards.length;
    // ONE HOME FOR THE FAN'S OWN HEIGHT COST. The lift is derived here, so the
    // room for it is published here too and the stylesheets READ it — they never
    // restate it (Law 0 clause 4). Both `.hand` rules reserve
    // var(--fan-lift) in padding-top; a stylesheet that forgets falls back to
    // 0px and the defect is visible, not plausible (Law 0 clause 5).
    handEl.style.setProperty(FAN_LIFT_PROP, `${((n - 1) / 2) * 6}px`);
    cards.forEach((entry, i) => {
      const el = renderCard(registries, entry.inst,
        entry.preview ? { preview: entry.preview, affordable: entry.affordable } : { affordable: entry.affordable });
      const spread = Math.min(6, n) * 1.2;
      // THE FAN HANGS UPWARD FROM ITS DEEPEST CARD, NOT DOWNWARD FROM ITS
      // CENTRE. Same arc, same step, same look — translated so the LOWEST card
      // sits on the strip's own baseline and nothing is pushed below it.
      //
      // WHY, and it is his ask plus a defect the ask uncovered. He asked for the
      // control strip to sit "at the bottom under the cards ... perhaps shift
      // the cards up a bit to make space". The strip is now the last row of the
      // .combat column (styles/ui.css .hint-bar.hint-combat), so the column
      // supplies the space. But the old expression pushed the OUTER cards DOWN
      // by |i-mid| * 6, and the outermost card's box therefore ended 5.65 local
      // px BELOW .hand — measured identical, to two decimals, on all eight wide
      // shapes at db09846, which is a constant and not a coincidence of one
      // window. Off the bottom of the viewport before this change; onto the
      // strip after it. A gap constant on the strip would have hidden that
      // instead of removing it, and would have been re-tuned by the next hand
      // change: the fan's own overflow is the fan's to not have.
      //
      // max|i-mid| is mid, at i = 0 and i = n-1, so subtracting mid puts those
      // two at 0 and lifts the centre by mid * 6. DERIVED from the same mid the
      // rotation already uses — no second constant, and n = 1 stays 0.
      //
      // THE LIFT HAS TO BE RESERVED, AND IT IS RESERVED FROM HERE — see
      // FAN_LIFT_PROP below. Measured at 390x844 with the shipped hand of five:
      // mid * 6 = 12 px and the narrow strip's padding-top is 1.2rem = 12 px, so
      // the centre card's top landed EXACTLY on .hand's border edge, clearance
      // 0.00. That is an accident of n = 5, not a fit: at n = 6 the lift is 15 px
      // against the same 12 and the phone's scroller starts clipping the card it
      // is meant to feature. A number that is only right for today's hand size.
      const mid = (n - 1) / 2;
      el.style.transform = `rotate(${(i - mid) * (spread / Math.max(n - 1, 1))}deg) translateY(${(Math.abs(i - mid) - mid) * 6}px)`;
      el.style.zIndex = i;
      if (entry.selected) el.classList.add('selected');
      // The spelled-out unavailability reason is VIEWER data (co-op supplies
      // it; solo's player reads live previews and the hint bar instead). When
      // present it rides the card as a badge and as assistive text.
      if (entry.reason) {
        el.dataset.unavailableReason = entry.reason;
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('aria-label', `${entry.name || ''} unavailable: ${entry.reason}`);
        const badge = document.createElement('div');
        badge.className = 'card-unavailable-reason';
        badge.textContent = entry.reason;
        el.appendChild(badge);
      }
      // Positional quick-play key badge: 1-9 then Q, tied to the slot not the
      // card — BOTH surfaces map those keys to the same slots. Hidden while a
      // gamepad drives (body.pad-mode via refreshHintBars).
      if (i < 10) {
        const hint = document.createElement('span');
        hint.className = 'key-hint';
        hint.textContent = i < 9 ? i + 1 : 'Q';
        el.appendChild(hint);
      }
      // The reading hold — EVERY card, before the play wiring on purpose:
      // affordability gates playing, never reading (the card you cannot pay
      // for is the one you most need to read), and same-element listeners run
      // in registration order, which is what lets a completed read's lift die
      // in armInspect's click handler instead of selecting or playing below.
      // E8, and it is the one line of his ask that lives outside tooltip.js:
      // the zoom used to HIDE the tooltip here. Now the completed hold KEEPS
      // it — same moment, opposite verb — and tooltip.js owns what ends it.
      armInspect(el, { ms: inspectMs, onOpen: () => stickTooltip(el) });
      if (wireCard) wireCard(el, entry, i);
      handEl.appendChild(el);
    });
    // The overlap arm: record what this render made, then reconcile. Inert —
    // including the observer re-point — unless the layout word is 'overlap';
    // in 'paging' the loop above was the whole render, unchanged.
    handEls = [...handEl.children];
    handFan = handEls.map((el) => el.style.transform);
    if (ro && handLayoutWord() === 'overlap') {
      ro.disconnect();
      ro.observe(handEl);
      handEls.forEach((el) => ro.observe(el));
    }
    applyHandLayout();
  }

  function teardown() {
    if (ro) ro.disconnect();
    if (mo) mo.disconnect();
  }

  return { render, teardown };
}
