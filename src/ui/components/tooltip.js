// src/ui/components/tooltip.js — ONE tooltip service: one panel per level,
// one placer, one timing machine (kit §08 Tooltips, §09 Three tiers).
//
// WHAT EVERY SURFACE INHERITS BY ATTACHING (attachTooltip) OR BY WRITING A
// `title` ATTRIBUTE — the second is adopted, so the native yellow box never
// shows and every hint in the game opens on the same clock:
//
//   TIMING (Constantine, 2026-09-03: "delayed fade in (0.5s by default), and
//   then fades out after (5-10 s by default) or 2s when mouse moves"):
//     open after 500ms of intent; leaving before that cancels with no flash.
//     once open, leaving starts a 2s close that RE-ENTERING CANCELS — and the
//     panel itself counts as on-target, which is what makes a tooltip's
//     tooltip reachable. Dwell (7s) runs only after the pointer has left.
//     a new target hands over WITHOUT paying the open delay again.
//
//   FOUR RUNGS, BY HEIGHT: small · medium · large · expanded. The rung is
//     derived from the content, then MEASURED: the panel steps up while it
//     overflows. A tooltip never scrolls and never clips; past `expanded` the
//     answer belongs to the `full` tier (a body-B modal), which a click on a
//     non-button target opens (`expand: true`).
//
//   TWO LEVELS AND NO MORE. A term inside the panel that carries `data-tip`
//     or `title` opens the second panel; two is a player asking "and what is
//     that?", three is a maze. Escape closes the topmost first.
//
//   INPUT PARITY. Focus (the pad cursor's gpfocus) is the hover equivalent.
//     Touch: double tap → the tooltip; press-and-hold → the expanded modal,
//     UNLESS the target is a button (hold-to-confirm already owns that
//     gesture there); a single tap is always the element's own action.
//
// The public entry points below are the ones 23 surfaces already call; their
// shape is unchanged so nothing had to be re-wired to inherit the machine.

import { placeAnchored, viewportLocalBox } from '../fx.js';
import { tooltipPlacementIntent } from '../models/TooltipPlacementModel.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

export const TOOLTIP_TIMING = Object.freeze({ open: 500, handover: 120, focus: 160, close: 2000, dwell: 7000, hold: 420, doubleTap: 300 });
const RUNGS = ['small', 'medium', 'large', 'expanded'];

// ---- the two panels ---------------------------------------------------------
const panels = [null, null];
const state = [{ target: null, open: false }, { target: null, open: false }];
let openTimer = null;
let closeTimer = null;
let dwellTimer = null;
let fadeTimer = null;
let expander = null; // the `full` tier opener, injected to avoid a circular import
let pending = null;  // { el, show } — the show an open timer is counting down to

function panel(level) {
  if (!panels[level]) {
    const el = document.createElement('div');
    el.id = level ? 'tooltip-2' : 'tooltip';
    el.className = 'as-tip';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    el.dataset.open = 'false';
    el.dataset.level = String(level);
    if (level === 0) markUiComponent(el, UI.tooltip);
    // The panel is part of the target while open: entering it cancels the
    // close, leaving it schedules one, and a term inside it may open level 2.
    el.addEventListener('pointerenter', () => { clearTimeout(closeTimer); clearTimeout(dwellTimer); });
    el.addEventListener('pointerleave', (ev) => {
      if (panels.some((p) => p && p !== el && p.contains(ev.relatedTarget))) return;
      if (state[0].target && state[0].target.contains?.(ev.relatedTarget)) return;
      scheduleClose();
    });
    el.addEventListener('pointerover', (ev) => {
      if (level !== 0) return;
      const term = nestedTarget(ev.target, el);
      if (term && term !== state[1].target) showNested(term);
    });
    el.addEventListener('pointerout', (ev) => {
      if (level !== 0 || !state[1].open) return;
      const term = nestedTarget(ev.target, el);
      if (term && !term.contains(ev.relatedTarget) && !(panels[1] && panels[1].contains(ev.relatedTarget))) hide(1);
    });
    document.body.appendChild(el);
  }
  return panels[level] = panels[level] || document.getElementById(level ? 'tooltip-2' : 'tooltip');
}
let tipEl = null; // level 0, kept under its old name for the stick logic below

function conceal(level = 0) {
  const el = panels[level];
  if (!el) return;
  el.style.display = 'none';
  el.dataset.open = 'false';
  el.classList.remove('is-fading');
  el.setAttribute('aria-hidden', 'true');
  state[level].target?.removeAttribute?.('data-tip-open');
  state[level].target = null;
  state[level].open = false;
}
function hide(level) { conceal(level); }

function clearTimers() {
  clearTimeout(closeTimer); clearTimeout(dwellTimer); clearTimeout(fadeTimer);
  closeTimer = null; dwellTimer = null; fadeTimer = null;
}
function scheduleClose() {
  if (stuck) return;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(() => hideTooltip(), TOOLTIP_TIMING.close);
  clearTimeout(dwellTimer);
  dwellTimer = setTimeout(() => hideTooltip(), TOOLTIP_TIMING.dwell);
}
function scheduleAutoHide(autoHideMs) {
  if (!(autoHideMs > 0)) return;
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    if (!tipEl) return;
    const systemReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.body.classList.contains('reduced-motion') || systemReducedMotion) { hideTooltip(); return; }
    tipEl.classList.add('is-fading');
    fadeTimer = setTimeout(() => hideTooltip(), 160);
  }, autoHideMs);
}

// ---------------------------------------------------------------------------
// E8 — THE TOOLTIP STAYS UP UNTIL SOMETHING REPLACES IT. A tooltip a COMPLETED
// HOLD summoned is STUCK: it outlives the pointer leaving. It ends when the
// card it explains leaves the DOM (the watch is on the document, because
// co-op replaces `.hand` instead of emptying it), or when anything else calls
// hideTooltip(). The floor: the panel is pointer-events: none while closed
// and any other tooltip replaces it, so it can never be un-dismissable.
// ---------------------------------------------------------------------------
let stuck = false;
let stuckWatch = null;
function unstick() {
  stuck = false;
  if (tipEl) tipEl.dataset.stuck = 'false';
  if (stuckWatch) { stuckWatch.disconnect(); stuckWatch = null; }
}

function ensure() {
  tipEl = panel(0);
  return tipEl;
}
/** Ensure the singleton exists before a control references it with aria-describedby. */
export function ensureTooltip() { return ensure(); }

/** registerTooltipExpander(fn) — the `full` tier: fn(html, { title, eyebrow }) opens a body-B modal. */
export function registerTooltipExpander(fn) { expander = fn; }

// ---- the rung ---------------------------------------------------------------
function derivedRung(el) {
  const text = el.textContent || '';
  const hasList = !!el.querySelector('ul, ol, table');
  const detail = el.querySelector('.ti-detail, .tt-kw');
  if (hasList || text.length > 420) return 'large';
  if (detail && text.length > 220) return 'large';
  if (detail || text.length > 90) return 'medium';
  return 'small';
}
/** Step the panel up the ladder until its content fits; true when it does. */
function fitRung(el, pinned) {
  let at = RUNGS.indexOf(pinned || el.dataset.size || derivedRung(el));
  if (at < 0) at = 1;
  el.dataset.size = RUNGS[at];
  while (el.scrollHeight > el.clientHeight + 1 && at < RUNGS.length - 1) {
    at += 1;
    el.dataset.size = RUNGS[at];
  }
  const fits = el.scrollHeight <= el.clientHeight + 1;
  el.dataset.overflow = fits ? 'false' : 'true';
  return fits;
}

/**
 * The one way the tooltip is ever shown: fill it, reveal it, size it by rung,
 * place it beside its anchor. Every entry point is this function plus an
 * anchor, so the "how" cannot drift while the "where" differs.
 */
// ---- A TOOLTIP DIES WITH THE SURFACE IT WAS ON (Constantine, 2026-09-04:
// "in modal changes tool tips from the previous screen should auto close").
// One observer: when the level-0 anchor leaves the document, or a veil that
// does not contain it is raised over it, the tooltip closes at once — no
// surface has to remember to call hideTooltip() on its way out.
let sceneWatch = null;
let sceneAnchor = null;
function watchScene() {
  if (sceneWatch) return;
  sceneWatch = new MutationObserver((records) => {
    if (!sceneAnchor) return;
    if (!sceneAnchor.isConnected) { hideTooltip(); return; }
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const veil = node.matches?.('.modal-veil') ? node : node.querySelector?.('.modal-veil');
        if (veil && !veil.contains(sceneAnchor)) { hideTooltip(); return; }
      }
    }
  });
  sceneWatch.observe(document.documentElement, { childList: true, subtree: true });
}

function showWith(html, anchor, clear = null, intent = 'beside', appearance = null, placementModel = null, autoHideMs = 0, align = 'start', level = 0, target = null) {
  if (!html) return false;
  // `anchor` is a rect; `target` is the element it was measured from (null
  // for a caller-owned rect — then there is no surface to watch).
  if (level === 0) { sceneAnchor = target instanceof Node ? target : null; watchScene(); }
  if (level === 0) { unstick(); hide(1); }
  clearTimers();
  const t = level === 0 ? ensure() : panel(1);
  t.innerHTML = html;
  t.style.removeProperty('width');
  t.style.removeProperty('max-width');
  t.style.removeProperty('max-height');
  t.dataset.tooltipVariant = appearance?.variant || '';
  delete t.dataset.size;
  const room = viewportLocalBox();
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  if (appearance?.widthRem) {
    const widthPx = Math.max(0, Math.min(appearance.widthRem * rootFontPx, room.width - 16));
    t.style.width = `${widthPx}px`;
    t.style.maxWidth = `${Math.max(0, room.width - 16)}px`;
  }
  if (appearance?.maxWidthRem) {
    t.style.maxWidth = `${Math.max(0, Math.min(appearance.maxWidthRem * rootFontPx, room.width - 16))}px`;
  }
  t.style.display = 'block';
  t.dataset.open = 'true';
  t.setAttribute('aria-hidden', 'false');
  fitRung(t, appearance?.rung);
  if (appearance?.maxHeightRatio) t.style.maxHeight = `${Math.max(0, room.height * appearance.maxHeightRatio)}px`;
  const resolvedIntent = placementModel
    ? tooltipPlacementIntent(anchor, { width: innerWidth, height: innerHeight }, placementModel, {
      narrow: document.documentElement.dataset.layout === 'narrow',
    })
    : intent;
  t.dataset.tooltipPlacement = resolvedIntent;
  placeAnchored(t, anchor, { intent: resolvedIntent, clear, align });
  state[level].target?.removeAttribute?.('data-tip-open');
  state[level].target = target;
  state[level].open = true;
  if (target?.setAttribute) target.setAttribute('data-tip-open', 'true');
  scheduleAutoHide(autoHideMs);
  return true;
}

// ---- the nested level -------------------------------------------------------
function nestedTarget(node, within) {
  const el = node?.closest?.('[data-tip], [title]');
  if (!el || !within.contains(el) || el === within) return null;
  adoptTitle(el);
  return el.dataset.tip && el.dataset.tip !== 'off' ? el : null;
}
function showNested(term) {
  showWith(`<div>${esc(term.dataset.tip)}</div>`, term.getBoundingClientRect(), panels[0], 'above', null, null, 0, 'start', 1, term);
}
/** A `title` is adopted into the machine and removed, so the native box never races the panel. */
function adoptTitle(el) {
  if (!el?.hasAttribute?.('title')) return;
  const title = el.getAttribute('title');
  if (title && !el.dataset.tip) el.dataset.tip = title;
  el.removeAttribute('title');
}

// ---- attaching --------------------------------------------------------------
/**
 * attachTooltip(el, contentFn, options) — contentFn() → HTML string (computed at
 * show time so numbers are always live). Shows on pointer hover AND on the
 * keyboard/gamepad focus cursor. `expand: true` lets a click (or a touch hold
 * on a non-button) open the same content in the `full` tier.
 */
export function attachTooltip(el, contentFn, {
  intent = 'beside', align = 'start', clear = null, delayMs = TOOLTIP_TIMING.open, focusDelayMs = TOOLTIP_TIMING.focus,
  appearance = null, placementModel = null, autoHideMs = 0, expand = false, expandTitle = null,
} = {}) {
  adoptTitle(el);
  el.dataset.tipAttached = 'true';
  const show = () => { pending = null; return showWith(contentFn(), el.getBoundingClientRect(), clear || el.parentElement, intent, appearance, placementModel, autoHideMs, align, 0, el); };
  el.addEventListener('pointerenter', () => {
    clearTimeout(closeTimer); clearTimeout(dwellTimer);
    clearTimeout(openTimer);
    pending = { el, show };
    // A new target hands over without re-paying the open delay — but not
    // instantly: a transient enter (the zoom copy landing under a held finger,
    // gone on the next frame) must not replace a STUCK tooltip. The short
    // timer is what pointerleave cancels.
    if (state[0].open && state[0].target !== el) { openTimer = setTimeout(show, TOOLTIP_TIMING.handover); return; }
    // Re-entering the stuck tooltip's own target is a fresh hover: it takes
    // ownership back from the hold, so the next leave hides it (E8's floor).
    if (state[0].open) { if (stuck) unstick(); return; }
    openTimer = setTimeout(show, delayMs);
  });
  el.addEventListener('pointerleave', (ev) => {
    clearTimeout(openTimer);
    if (stuck) return; // E8: a completed hold outlives the pointer leaving
    if (panels.some((p) => p && p.contains(ev.relatedTarget))) return;
    scheduleClose();
  });
  el.addEventListener('gpfocus', () => {
    clearTimeout(openTimer);
    pending = { el, show };
    openTimer = setTimeout(show, focusDelayMs);
  });
  el.addEventListener('gpblur', () => {
    clearTimeout(openTimer);
    if (stuck) return;
    hideTooltip();
  });
  if (expand) {
    const isControl = () => !!el.closest('button, [role="button"], a, input, select, [data-hold]');
    const open = () => { hideTooltip(); expander?.(contentFn(), { title: expandTitle || el.dataset.tipTitle || '', eyebrow: el.dataset.tipType || 'Detail' }); };
    if (!isControl()) el.addEventListener('click', (ev) => { ev.preventDefault(); open(); });
    let holdTimer = null;
    let lastTap = 0;
    el.addEventListener('touchstart', () => {
      if (isControl()) return;
      holdTimer = setTimeout(() => { holdTimer = null; open(); }, TOOLTIP_TIMING.hold);
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      const now = Date.now();
      if (now - lastTap < TOOLTIP_TIMING.doubleTap) { show(); lastTap = 0; return; }
      lastTap = now;
    }, { passive: true });
  }
}

/** Show the shared tooltip for a non-hover gesture, using the same placement. */
export function showTooltipFor(el, html, { intent = 'beside', align = 'start', clear = null, appearance = null, placementModel = null, autoHideMs = 0 } = {}) {
  if (!el) return false;
  return showWith(html, el.getBoundingClientRect(), clear || el.parentElement, intent, appearance, placementModel, autoHideMs, align, 0, el);
}
/** Show the shared tooltip against a caller-owned measured subject rectangle. */
export function showTooltipForRect(anchor, html, { intent = 'beside', align = 'start', clear = null, appearance = null, placementModel = null, autoHideMs = 0 } = {}) {
  if (!anchor) return false;
  return showWith(html, anchor, clear, intent, appearance, placementModel, autoHideMs, align);
}
/**
 * stickTooltip(el) → boolean — keep the tooltip that is on screen NOW until
 * something replaces it or `el` leaves the DOM. It refuses when nothing could
 * ever end it (not connected, no MutationObserver), so a refusal is a tooltip
 * that behaves as before rather than one a player cannot get rid of.
 */
export function stickTooltip(el) {
  // A hold can complete BEFORE the 500ms open delay has shown the tooltip it
  // wants to keep: then the pending show for this element fires now, so the
  // stick has something to hold and the later timer cannot unstick it.
  if ((!tipEl || tipEl.style.display !== 'block') && pending?.el === el) { clearTimeout(openTimer); pending.show(); }
  if (!tipEl || tipEl.style.display !== 'block') return false;
  if (!el || !el.isConnected || typeof MutationObserver === 'undefined') return false;
  unstick();
  clearTimers();
  stuckWatch = new MutationObserver(() => { if (!el.isConnected) hideTooltip(); });
  stuckWatch.observe(document.documentElement, { childList: true, subtree: true });
  stuck = true;
  tipEl.dataset.stuck = 'true';
  return true;
}
/** showTooltipAt(x, y, html) — put the one tooltip at a point, now (a tap's answer). */
export function showTooltipAt(x, y, html) {
  return showWith(html, { left: x, top: y, width: 0, height: 0 });
}
export function hideTooltip() {
  sceneAnchor = null;
  unstick();
  clearTimers();
  clearTimeout(openTimer);
  conceal(1);
  conceal(0);
}
export function esc(s) {
  return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

// ---- `title` everywhere is the same machine ---------------------------------
// A hint written as a title attribute (24 in src/ui alone) opens on the same
// clock, in the same panel, at the same rung as an attached tooltip. Adopted
// on first hover and removed, so the native box never shows two answers.
let titleWired = false;
function wireTitles() {
  if (titleWired || typeof document === 'undefined') return;
  titleWired = true;
  document.addEventListener('pointerover', (ev) => {
    const el = ev.target?.closest?.('[title]');
    if (!el || panels.some((p) => p && p.contains(el))) return;
    // A title INSIDE an attached target (a card's cost badge) is that target's
    // business — it must not open a second, competing tooltip over the first.
    if (el.closest('[data-tip-attached]') && el.closest('[data-tip-attached]') !== el) return;
    adoptTitle(el);
    if (!el.dataset.tip || el.dataset.tip === 'off' || el.dataset.tipAdopted === 'true') return;
    el.dataset.tipAdopted = 'true';
    attachTooltip(el, () => `<div>${esc(el.dataset.tip)}</div>`, { intent: 'above', align: 'center' });
    el.dispatchEvent(new Event('pointerenter'));
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (state[1].open) hide(1);
    else if (state[0].open && !stuck) hideTooltip();
  }, true);
  const replace = () => { for (const [i, st] of state.entries()) if (st.open && st.target?.getBoundingClientRect && panels[i]) placeAnchored(panels[i], st.target.getBoundingClientRect(), { intent: panels[i].dataset.tooltipPlacement || 'beside' }); };
  addEventListener('resize', replace);
}
wireTitles();
