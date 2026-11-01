import { desktopHandLayout } from '../models/DesktopCombatFooter.js';
import { handLayout, responsiveHandLayout, handGeometryKey, reconcileHandOrder, moveHandInstance } from '../models/HandLayout.js';
import { mountHandInspectionOverlay } from './handInspectionOverlay.js';
// src/ui/components/hand.js — THE hand strip. One renderer.
//
// The hand was rendered twice until 2026-08-15 (combat.js's template and a
// snapshot-fed twin); the collapse made the STRIP a property of the game: one
// renderer, and WHO is looking supplies only viewer data. What differs per
// caller enters as parameters, never as a second template:
//
//   cards     — the viewer's list: { inst, preview?, affordable, reason?,
//               name?, selected?, stacked? }. Combat passes live previewCard
//               numbers off the paced snapshot.
//   wireCard  — what a card DOES: local dispatch (drag, click-to-target,
//               self-arm). The strip itself never plays a card — rendering
//               and committing stay two hands.
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

import { reducedMotionRequested } from '../motion.js';
import { renderCard, refreshCard, setHandFaceBudget } from './card.js';
import { armInspect } from '../../framework/optionDecision.js';
import { stickTooltip, watchHeldTriggers } from './tooltip.js';
import { applyHandExemption } from '../handAxis.js';
import { keycap, pill } from '../kit/index.js';
import { layoutMetrics } from '../layoutMetrics.js';

// Whether this browser lays out CSS `zoom` at all (hand.js reads card widths
// against it). Asked once; the answer does not change while the page lives.
const ZOOM_SUPPORTED = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('zoom', '1');

// The custom property this component publishes so the stylesheets can reserve
// room for the fan's upward lift without knowing how it is computed. Named here
// because the value has exactly one author; tools/hintstrip.mjs reads the NAME
// out of this file rather than typing it, so a rename cannot leave a check
// asserting a property nobody writes.
export const FAN_LIFT_PROP = '--fan-lift';

export function measureHandUpcastHeight(controls, { zoom, width, cache }) {
  const style = getComputedStyle(controls);
  const inputs = [...(controls.querySelectorAll?.('button,select') || [])].map(node => {
    const input = getComputedStyle(node);
    return [input.font, input.minHeight, input.minWidth, input.paddingTop, input.paddingBottom,
      input.borderTopWidth, input.borderBottomWidth];
  });
  const key = JSON.stringify([zoom, width, style.font, style.paddingTop, style.paddingBottom,
    style.borderTopWidth, style.borderBottomWidth, style.gap, controls.textContent, inputs]);
  const prior = cache.get(controls);
  if (prior?.key === key) return prior.height;
  const sample = controls.cloneNode(true);
  sample.setAttribute('aria-hidden', 'true');
  sample.inert = true;
  Object.assign(sample.style, { display: 'flex', visibility: 'hidden', pointerEvents: 'none', minWidth: '0', maxWidth: `${width}px` });
  sample.querySelectorAll('[hidden]').forEach(node => { node.hidden = false; });
  controls.parentElement.appendChild(sample);
  // offsetHeight is already local layout px and excludes the owning fan's
  // rotation/zoom. Its reserve cannot change when selection flattens that fan.
  const height = sample.offsetHeight;
  sample.remove();
  cache.set(controls, { key, height });
  return height;
}

export function mountHand(handEl, { registries, wireCard = null, animateArrival = false, fitFan = false, inspectHold = true, reuseCards = false,
  // liveWiring: the host's wireCard reads a live record that updateCard refreshes, so a card whose preview,
  // affordability or availability moved keeps its element and listeners (refreshCard). rebuildKey(entry) is a string
  // that, when it moves, still forces a new card (the host's own controls on it, built from the preview).
  liveWiring = false, updateCard = null, rebuildKey = null }) {
  // The one home of the duration is balance.ui.inspectHold; the Number()||0
  // shape is why model/validate.js checks that row loud — an unreadable
  // value here would silently turn the gesture off.
  const inspectMs = Number((registries.balance.ui.inspectHold || {}).ms) || 0;
  // The Law 5 exemption, derived from ITS one home (handAxis.js): present and
  // mode-scoped under 'paging', absent under 'overlap'. Attribute order
  // (axis, mode, why) is the order the old template carried, so the paging
  // DOM stays byte-identical across the collapse.
  applyHandExemption(handEl);
  watchHeldTriggers(handEl);
  const releaseInspectionOverlay = fitFan ? mountHandInspectionOverlay(handEl) : null;

  // Snapshot clients remount this strip; arrivals are opt-in for persistent mounts.
  let previousCards = new Set();
  let handEls = []; // the rendered cards, in hand order (filled by render)
  let fanMeasurement = null;
  let fanApplied = false; // a fan plan has been applied to the cards now in the strip
  let handFan = []; // each card's shipped fan transform, same index
  const renderedCards = new Map();
  let presentationOrder = [];
  let lastRender = null;
  const upcastMeasurements = new WeakMap();
  const handLayoutWord = () => document.documentElement.dataset.handLayout;
  let publishedGeometry = null;
  const publishGeometry = key => {
    if (publishedGeometry === key) return;
    publishedGeometry = key;
    handEl.dispatchEvent(new Event('handlayoutchange', { bubbles: true }));
  };

  // A layout pass repeats the same numbers on most renders; a style a card
  // already holds is not written again (each write dirties style, and the next
  // measure then forces a layout).
  const setVar = (target, name, value) => { if (target.style.getPropertyValue(name) !== value) target.style.setProperty(name, value); };
  // The hand strip's own box facts. Reading them forces a layout when card DOM
  // was just written, so a render reads them BEFORE it touches the strip and
  // hands them to applyHandLayout (nothing about the strip's box depends on the
  // cards: they are absolutely placed by the plan).
  const readStripBox = () => {
    const rect = handEl.getBoundingClientRect();
    return { rect, clientWidth: handEl.clientWidth, clientHeight: handEl.clientHeight, fontSize: layoutMetrics().fontSize };
  };
  const stripReadable = () => fitFan && fanApplied && handEl.isConnected && handEl.dataset.wireframeHand === 'true';
  // A full combat render writes the topbar, the stage and the controls before it
  // reaches the hand, and none of those move the strip. The screen primes the
  // strip's box at the top of the render, while layout is still clean, so the
  // hand's own read is not the flush that pays for every write in between.
  let primedBox = null;
  const primeStripBox = (on = true) => { primedBox = on && stripReadable() ? readStripBox() : null; };
  function applyHandLayout(box = null) {
    if (fitFan) {
      const cards = handEls.filter(el => el.parentNode === handEl);
      if (!handEl.isConnected) return;
      if (!cards.length) { publishGeometry('empty'); return; }
      // Scoped physical touch targets must apply on the very first measure.
      if (handEl.dataset.wireframeHand !== 'true') handEl.dataset.wireframeHand = 'true';
      const measured = box || readStripBox();
      const rect = measured.rect, clientWidth = measured.clientWidth, clientHeight = measured.clientHeight;
      const zoom = rect.width / clientWidth || 1;
      const fontSize = measured.fontSize;
      const rem = Math.max(16 / zoom, parseFloat(fontSize) || 16);
      const compact = handEl.closest('.combat')?.dataset.compactCombat === 'true';
      // The HUD form factor main.js writes to <html>. Read the live root first: the
      // combat root's mirror (combatLayout) can lag a debounced change.
      const formFactor = document.documentElement.dataset.formFactor || handEl.closest('.combat')?.dataset.formFactor || null;
      // Log and reactions are below the resting fan on every form factor.
      const toolsHeight = 0;
      setVar(handEl, '--hand-controls-max-width', `${Math.max(0, clientWidth - 2 / zoom)}px`);
      // Measure the complete row, including the normally hidden native picker.
      // Hidden, inert clones reserve its space before a press selects a face;
      // selection must never resize the fan underneath that pointer.
      let controlsHeight = 0;
      const controlled = [];
      cards.forEach((card, index) => {
        const controls = card.querySelector('.card-upcast-controls');
        if (!controls) return;
        controlled.push(index);
        controlsHeight = Math.max(controlsHeight, measureHandUpcastHeight(controls,
          { zoom, width: Math.max(0, clientWidth - 2 / zoom), cache: upcastMeasurements }));
      });
      // On a phone the selected card's lift rises over the tool row (it paints
      // above the row), so no empty lift band separates the row from the fan.
      const layoutHand = handEl.closest('.combat')?.dataset.desktopFooter === 'true' ? desktopHandLayout : handLayout;
      const input = { width: clientWidth, height: clientHeight - toolsHeight,
        count: cards.length, rem, zoom, compact, controlsHeight, controlled, headroom: compact ? toolsHeight : 0, formFactor };
      const plan = responsiveHandLayout(input, layoutHand(input));
      if (handEl.dataset.wireframeHand !== 'true') handEl.dataset.wireframeHand = 'true';
      setVar(handEl, '--hand-card-zoom', '1');
      setVar(handEl, '--hand-span', plan.span + 'px');
      setVar(handEl, '--hand-rest-left', plan.restLeft + 'px');
      setVar(handEl, '--hand-rest-top', (toolsHeight + plan.restTop) + 'px');
      setVar(handEl, '--hand-clearance-top', (toolsHeight + plan.clearanceTop) + 'px');
      const geometryKey = handGeometryKey({ width: clientWidth, height: clientHeight, zoom, fontSize, left: rect.left });
      if (handEl.dataset.handGeometry !== geometryKey) handEl.dataset.handGeometry = geometryKey;
      setVar(handEl, '--hand-selection-lift', plan.lift + 'px');
      cards.forEach((el, i) => {
        const slot = plan.cards[i];
        setVar(el, '--hand-card-width', plan.cardWidth + 'px');
        setVar(el, '--hand-card-height', plan.cardHeight + 'px');
        setVar(el, '--hand-card-x', slot.x + 'px');
        setVar(el, '--hand-card-y', (toolsHeight + plan.top + slot.y) + 'px');
        setVar(el, '--hand-card-angle', slot.angle + 'deg');
        setVar(el, '--hand-card-arc', slot.y + 'px');
        setVar(el, '--hand-hit-width', (i === cards.length - 1 ? plan.cardWidth : plan.step) + 'px');
        let lane = el.querySelector('.hand-hit-lane');
        if (!lane) {
          lane = document.createElement('span');
          lane.className = 'hand-hit-lane';
          lane.setAttribute('aria-hidden', 'true');
          el.appendChild(lane);
        }
        setVar(el, '--card-fan-transform', 'rotate(' + slot.angle + 'deg)');
        if (el.style.marginLeft !== '0px') el.style.marginLeft = '0px';
        const turn = 'rotate(' + slot.angle + 'deg)';
        if (el.style.transform !== turn) el.style.transform = turn;
      });
      // A preview can replace a face without moving the fan. Keep its new
      // styles and hit lane, but do not refit the battlefield for the same plan.
      publishGeometry(JSON.stringify([input, plan, fontSize,
        rect.left, rect.top, rect.width, rect.height, cards.map(card => card.dataset.instanceId)]));
      return;
    }
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
    const zoom = layoutMetrics().zoom;
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
  // replaced (a re-mounting screen disposes it; solo replaces the screen wholesale).
  let ro = null;
  let mo = null;
  const observedCards = new Set();
  const observeCards = () => {
    if (!ro) return;
    const current = new Set(handEls);
    for (const card of observedCards) if (!current.has(card)) {
      ro.unobserve(card); observedCards.delete(card);
    }
    for (const card of current) if (!observedCards.has(card)) {
      ro.observe(card); observedCards.add(card);
    }
  };
  let layoutFrame = 0;
  const scheduleHandLayout = () => {
    if (layoutFrame) return;
    // ResizeObserver delivers during layout. Defer writes to the next frame
    // so changing the fan cannot resize another observed box in that delivery.
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      if (!handEl.isConnected) { ro?.disconnect(); mo?.disconnect(); return; }
      applyHandLayout();
    });
  };
  if (typeof ResizeObserver !== 'undefined' && (fitFan || handLayoutWord() === 'overlap')) {
    const alive = () => document.body.contains(handEl);
    // A render lays the fan out itself, and observing the cards it just made
    // delivers their first size at once. That first size, and a delivery that
    // repeats a size already seen, is not a change: only a real one re-fits.
    const seenSizes = new WeakMap();
    ro = new ResizeObserver(entries => {
      if (!alive()) { ro.disconnect(); return; }
      let moved = false;
      for (const entry of entries) {
        const box = entry.contentRect;
        const prior = seenSizes.get(entry.target);
        seenSizes.set(entry.target, [box.width, box.height]);
        if (!prior ? entry.target === handEl : prior[0] !== box.width || prior[1] !== box.height) moved = true;
      }
      if (moved) scheduleHandLayout();
    });
    mo = new MutationObserver(() => { if (alive()) scheduleHandLayout(); else mo.disconnect(); });
    // data-form-factor re-lays the hand too (the tool row reserve differs by form factor).
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-layout', 'data-form-factor'] });
    ro.observe(handEl);
  }

  // The shipped fan angle of slot i of n (the legacy transform fan; the fitted
  // hand overwrites it in applyHandLayout).
  function slotTransform(i, n) {
    const spread = Math.min(6, n) * 1.2;
    const mid = (n - 1) / 2;
    return `rotate(${(i - mid) * (spread / Math.max(n - 1, 1))}deg) translateY(${(Math.abs(i - mid) - mid) * 6}px)`;
  }
  // A kept card that moved: its positional key badge (1-9, then Q), fan angle and stacking.
  function syncSlot(record, i, n) {
    const el = record.el;
    record.slot = i + '/' + n;
    const badge = el.querySelector(':scope > .key-hint');
    if (i < 10) {
      const text = i < 9 ? String(i + 1) : 'Q';
      if (badge && badge.textContent === text) { /* already right */ }
      else { badge?.remove(); el.appendChild(keycap(text, { class: 'float key-hint' })); }
    } else badge?.remove();
    el.style.transform = slotTransform(i, n);
    el.style.setProperty('--card-fan-transform', el.style.transform);
    el.style.zIndex = i;
  }

  // Returns what the pass did to the strip: `reshaped` (the fan plan was re-applied, so the hand's
  // geometry may have moved) and `rebuilt` (how many card faces were built from scratch).
  function render(args) {
    const result = renderCards(args);
    // `data-has-selection` stands in for `.hand:has(.selected)` in combat.css.
    const on = String(!!handEl.querySelector('.selected'));
    if (handEl.getAttribute('data-has-selection') !== on) handEl.setAttribute('data-has-selection', on);
    return result;
  }
  // The options renderCard is given above, for refreshCard (tests/hand-keeps-cards-on-refresh.test.mjs holds the two equal).
  const cardOpts = entry => ({ preview: entry.preview, affordable: entry.affordable, actionOwnsTouch: true, range: true,
    surface: entry.surface, availability: entry.availability, commands: entry.commands, faceLineLimit: 3 });
  // A card that keeps its element while its look changes runs without transitions for the frame that paints the
  // change, so it lands as a rebuilt card did. The second frame callback restores the stylesheet's own.
  const quieted = new Set();
  function quiet(el) {
    if (!quieted.size) {
      const restore = () => { for (const node of quieted) node.style.removeProperty('transition'); quieted.clear(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(restore)); else restore();
    }
    if (quieted.has(el)) return;
    quieted.add(el);
    el.style.setProperty('transition', 'none');
  }
  function renderCards({ cards = [] }) {
    lastRender = { cards };
    presentationOrder = reconcileHandOrder(presentationOrder, cards.map(entry => entry.inst.instanceId));
    const entries = new Map(cards.map(entry => [entry.inst.instanceId, entry]));
    cards = presentationOrder.map(id => entries.get(id));
    const n0 = handEls.length;
    // The strip's box, read while layout is still clean (before any card is
    // written): the layout pass at the end of this render then needs no read
    // and so forces no layout. Only once the strip is set up (first render
    // writes the wireframe attribute the box depends on) and attached.
    const preBox = primedBox || (stripReadable() ? readStripBox() : null);
    primedBox = null;
    const wanted = new Set(cards.map(entry => entry.inst.instanceId));
    // Whether this pass changed anything the fan plan reads: a card made or
    // dropped, or the order. A pure selection change keeps every element, so the
    // plan (and its forced layout) is the one already applied.
    let reshaped = !fanApplied || n0 !== cards.length;
    let rebuilt = 0;
    for (const [id, record] of renderedCards) if (!reuseCards || !wanted.has(id)) {
      record.release?.(); record.el.remove(); renderedCards.delete(id); reshaped = true;
    }
    const drawn = new Set(cards.filter(entry => !previousCards.has(entry.inst.instanceId)).map(entry => entry.inst.instanceId));
    previousCards = new Set(cards.map(entry => entry.inst.instanceId));
    fanMeasurement = null;
    if (!renderedCards.size) handEl.replaceChildren();
    handEls = [];
    handFan = [];
    const n = cards.length;
    // The legacy transform fan publishes its lift for CSS to reserve. The
    // fitted wireframe hand instead gives every card an absolute top position
    // inside its own box; it has no transform lift for padding to reserve.
    handEl.style.setProperty(FAN_LIFT_PROP, fitFan ? '0px' : `${((n - 1) / 2) * 6}px`);
    cards.forEach((entry, i) => {
      const id = entry.inst.instanceId;
      // Solo action callbacks resolve current combat state by instance ID. A
      // preview/affordability change invalidates both the face and its inputs.
      // The slot (index, count) is NOT in it: a card that only changes place
      // (a neighbour was played) keeps its element and takes its new key badge
      // and fan angle in place (syncSlot below).
      // The signature carries the ACTION STATE too. A card whose play becomes
      // refused mid-turn — the energy spent, the target gone — keeps its face
      // otherwise, and with it a door that still says the act is available.
      // `commands` is deliberately absent: those are closures that resolve the
      // live combat by instance id when pressed, so a kept one is never stale,
      // and JSON.stringify would drop them anyway.
      const signature = JSON.stringify([entry.inst, entry.preview, entry.affordable, entry.reason, entry.name, entry.surface, entry.availability]);
      // What a refresh cannot change: the instance, the viewer's reason and name, the surface, whether the card is wired
      // at all (it has a preview), and the host's own controls.
      const structure = liveWiring ? JSON.stringify([entry.inst, entry.reason, entry.name, entry.surface, !!entry.preview, rebuildKey ? rebuildKey(entry) : '']) : '';
      let record = renderedCards.get(id);
      if (record && record.signature !== signature && liveWiring && !entry.reason && record.structure === structure
          && refreshCard(record.el, cardOpts(entry))) {
        updateCard?.(record.el, entry);
        record.signature = signature;
        // A rebuilt card appeared in place with no transition; the kept one must not animate the same change.
        quiet(record.el);
      }
      // A face rebuilt in place (its preview or affordability moved, same slot,
      // same count) keeps the fan plan already applied to its predecessor.
      let predecessor = null;
      // The face of the card this one replaces (its preview or affordability moved): the new card takes
      // it over when the markup is the same, or the same with other numbers in its text rows.
      let donor = null;
      if (record && record.signature !== signature) {
        donor = record.el;
        predecessor = fitFan && fanApplied && n0 === cards.length && handEl.children[i] === record.el ? record : null;
        if (predecessor) predecessor.controls = predecessor.el.querySelector('.card-upcast-controls');
        if (predecessor) predecessor.controlsHtml = predecessor.controls ? predecessor.controls.outerHTML : '';
        record.release?.(); record.el.remove(); renderedCards.delete(id); record = null;
      }
      if (record) {
        record.el.classList.toggle('selected', !!entry.selected);
        setHandFaceBudget(record.el, !!entry.selected);
        record.el.classList.toggle('is-stacked', !!entry.stacked);
        if (handEl.children[i] !== record.el) { handEl.insertBefore(record.el, handEl.children[i] || null); reshaped = true; }
        if (record.slot !== i + '/' + n) { syncSlot(record, i, n); reshaped = true; }
        return;
      }
      if (!predecessor) reshaped = true;
      // THE SURFACE HAS TO REACH THE DOOR, AND FOR ONE RELEASE IT DID NOT.
      // #1000 replaced the inspect door's inherited verb with a triple the
      // surface supplies: `surface` names the place, `availability` says
      // whether the act is offered and why not, `commands` carries the commit.
      // combat.js builds all three per hand card — and this call, the ONLY
      // path from there to renderCard, went on forwarding the field #1000
      // retired. So every card in a combat hand reached the inspect door as
      // surface `none`, and the door that exists to offer `Play card` offered
      // nothing at all. Caught in review on the promotion, not by a test,
      // which is why tests/hand-forwards-surface.test.mjs now exists.
      rebuilt++;
      const el = renderCard(registries, entry.inst,
        { preview: entry.preview, affordable: entry.affordable, actionOwnsTouch: true, range: true,
          surface: entry.surface, availability: entry.availability, commands: entry.commands, faceLineLimit: 3,
          reuseFace: donor });
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
      el.style.transform = slotTransform(i, n);
      el.style.setProperty('--card-fan-transform', el.style.transform);
      el.style.zIndex = i;
      if (animateArrival && drawn.has(entry.inst.instanceId) && !reducedMotionRequested()) {
        el.classList.add('card-drawn');
        el.addEventListener('animationend', event => {
          if (event.target === el) el.classList.remove('card-drawn');
        });
      }
      if (entry.selected) el.classList.add('selected');
      setHandFaceBudget(el, !!entry.selected);
      // Already committed to an open reaction stack: muted until it resolves.
      if (entry.stacked) el.classList.add('is-stacked');
      // The spelled-out unavailability reason is VIEWER data (a host-driven screen could supply
      // it; solo's player reads live previews and the hint bar instead). When
      // present it rides the card as a badge and as assistive text.
      if (entry.reason) {
        el.dataset.unavailableReason = entry.reason;
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('aria-label', `${entry.name || ''} unavailable: ${entry.reason}`);
        el.appendChild(pill({ label: entry.reason, attrs: { class: 'foot card-unavailable-reason', 'data-tone': 'danger' } }));
      }
      // Positional quick-play key badge: 1-9 then Q, tied to the slot not the
      // card — BOTH surfaces map those keys to the same slots. Hidden while a
      // gamepad drives (body.pad-mode via refreshHintBars).
      if (i < 10) el.appendChild(keycap(i < 9 ? String(i + 1) : 'Q', { class: 'float key-hint' }));
      // The reading hold — EVERY card, before the play wiring on purpose:
      // affordability gates playing, never reading (the card you cannot pay
      // for is the one you most need to read), and same-element listeners run
      // in registration order, which is what lets a completed read's lift die
      // in armInspect's click handler instead of selecting or playing below.
      // E8, and it is the one line of his ask that lives outside tooltip.js:
      // the zoom used to HIDE the tooltip here. Now the completed hold KEEPS
      // it — same moment, opposite verb — and tooltip.js owns what ends it.
      // A card that carries its own commit owns its hold: the generic reading
      // hold is for cards with no act behind them. This read `entry.inspectionAction`,
      // which nothing sets any more, so the hold had quietly been arming on
      // every hand card as well.
      if (inspectHold && !entry.commands) armInspect(el, { ms: inspectMs, onOpen: () => stickTooltip(el) });
      const releaseInput = wireCard?.(el, entry, i);
      renderedCards.set(id, { el, signature, structure, slot: i + '/' + n, release: typeof releaseInput === 'function' ? releaseInput : null });
      handEl.insertBefore(el, handEl.children[i] || null);
      if (predecessor) {
        // Same controls (so the same reserved height): take over the placement
        // the plan wrote on the old element instead of re-fitting the fan.
        const controls = el.querySelector('.card-upcast-controls');
        const sameControls = (controls ? controls.outerHTML : '') === predecessor.controlsHtml;
        if (!sameControls) reshaped = true;
        else {
          const lane = predecessor.el.querySelector(':scope > .hand-hit-lane');
          for (const prop of Array.from(predecessor.el.style)) {
            if (prop.startsWith('--hand-') || prop === '--card-fan-transform') el.style.setProperty(prop, predecessor.el.style.getPropertyValue(prop));
          }
          el.style.marginLeft = predecessor.el.style.marginLeft;
          el.style.transform = predecessor.el.style.transform;
          if (lane) el.appendChild(lane);
          if (controls && predecessor.controls && upcastMeasurements.has(predecessor.controls)) upcastMeasurements.set(controls, upcastMeasurements.get(predecessor.controls));
        }
      }
    });
    // The overlap arm: record what this render made, then reconcile. Inert —
    // including the observer re-point — unless the layout word is 'overlap';
    // in 'paging' the loop above was the whole render, unchanged.
    handEls = [...handEl.children];
    handFan = handEls.map((el) => el.style.transform);
    // Re-observing an unchanged card requests a fresh initial size delivery,
    // which used to schedule another fan and battlefield fit after every render.
    observeCards();
    if (reshaped) { applyHandLayout(preBox); fanApplied = true; }
    return { reshaped, rebuilt };
  }

  function teardown() {
    releaseInspectionOverlay?.();
    for (const record of renderedCards.values()) record.release?.();
    renderedCards.clear();
    cancelAnimationFrame(layoutFrame);
    layoutFrame = 0;
    if (ro) ro.disconnect();
    observedCards.clear();
    if (mo) mo.disconnect();
  }

  function reorderAt(id, clientX) {
    const others = handEls.filter(el => el.dataset.instanceId !== id);
    const slot = others.filter(el => {
      const rect = el.getBoundingClientRect();
      return clientX > rect.left + rect.width / 2;
    }).length;
    presentationOrder = moveHandInstance(presentationOrder, id, slot);
    if (lastRender) render(lastRender);
  }
  return { render, teardown, reorderAt, primeStripBox };
}
