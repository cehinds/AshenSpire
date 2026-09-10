// src/ui/components/tooltip.js — ONE tooltip service: one panel per level,
// one placer, one timing machine (kit §08 Tooltips, §09 Three tiers).
//
// WHAT EVERY SURFACE INHERITS BY ATTACHING (attachTooltip) OR BY WRITING A
// `title` ATTRIBUTE — the second is adopted, so the native yellow box never
// shows and every hint in the game opens on the same clock:
//
//   Hover, handover, nested terms and focus use the authored delay with the
//   player's preference applied. Leaving early cancels. The owner and panel
//   form one region; its closing delay is independently configurable. Explicit actions remain
//   available without manufacturing hover from a touch pointer.
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

import { resolveTooltipSettings } from '../../model/tooltipSettings.js';
let tooltipSettings = resolveTooltipSettings();

export function configureTooltipSettings(settings) {
  tooltipSettings = resolveTooltipSettings(settings);
  hideTooltip();
}
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
let nestedOpenTimer = null;
let nestedCloseTimer = null;
let nestedPending = null;
let tooltipDecorator = () => {};
export function registerTooltipDecorator(fn) { tooltipDecorator = fn; }

function cancelOpen(el = null) {
  if (el && pending?.el !== el) return;
  clearTimeout(openTimer); openTimer = null; pending = null;
}
function cancelNested() { clearTimeout(nestedOpenTimer); nestedPending = null; }
function closeNestedLater() {
  clearTimeout(nestedCloseTimer);
  nestedCloseTimer = setTimeout(() => conceal(1), tooltipSettings.close);
}
function queueNested(term) {
  clearTimeout(nestedCloseTimer);
  if (term === state[1].target || term === nestedPending) return;
  cancelNested(); nestedPending = term;
  nestedOpenTimer = setTimeout(() => {
    nestedPending = null;
    if (term.isConnected && state[0].open) showNested(term);
  }, tooltipSettings.open);
}

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
    el.addEventListener('pointerenter', () => {
      cancelOpen(); clearTimers();
      if (level === 1) clearTimeout(nestedCloseTimer);
    });
    el.addEventListener('focusin', clearTimers);
    el.addEventListener('focusout', (ev) => { if (!el.contains(ev.relatedTarget)) scheduleClose(); });
    el.addEventListener('pointerleave', (ev) => {
      if (level === 0) cancelNested();
      if (level === 1 && !state[1].target?.contains(ev.relatedTarget)) closeNestedLater();
      if (panels.some((p) => p && p !== el && p.contains(ev.relatedTarget))) return;
      if (state[0].target && state[0].target.contains?.(ev.relatedTarget)) return;
      scheduleClose();
    });
    el.addEventListener('pointerover', (ev) => {
      if (level !== 0) return;
      const term = nestedTarget(ev.target, el);
      if (tooltipSettings.hoverEnabled && ev.pointerType !== 'touch' && term) queueNested(term);
    });
    el.addEventListener('pointerout', (ev) => {
      if (level !== 0) return;
      const term = nestedTarget(ev.target, el);
      if (term && !term.contains(ev.relatedTarget)) {
        cancelNested();
        if (!panels[1]?.contains(ev.relatedTarget)) closeNestedLater();
      }
    });
    el.addEventListener('focusin', ev => {
      const term = level === 0 && nestedTarget(ev.target, el);
      if (term) queueNested(term);
    });
    el.addEventListener('focusout', ev => {
      if (level === 0 && nestedTarget(ev.target, el)) { cancelNested(); closeNestedLater(); }
    });
    document.body.appendChild(el);
  }
  return panels[level] = panels[level] || document.getElementById(level ? 'tooltip-2' : 'tooltip');
}
let tipEl = null; // level 0, kept under its old name for the stick logic below

function conceal(level = 0) {
  if (level === 1) { cancelNested(); clearTimeout(nestedCloseTimer); }
  if (level === 0) hoverCloseCallback = null;
  const el = panels[level];
  if (!el) return;
  el.style.display = 'none';
  el.dataset.open = 'false';
  el.classList.remove('is-fading');
  el.setAttribute('aria-hidden', 'true');
  const owner = state[level].target;
  if (owner?.getAttribute) {
    const ids = (owner.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== el.id);
    if (ids.length) owner.setAttribute('aria-describedby', ids.join(' '));
    else owner.removeAttribute('aria-describedby');
  }
  state[level].target?.removeAttribute?.('data-tip-open');
  state[level].target = null;
  state[level].open = false;
}
function hide(level) { conceal(level); }

function clearTimers() {
  clearTimeout(closeTimer); clearTimeout(dwellTimer); clearTimeout(fadeTimer);
  closeTimer = null; dwellTimer = null; fadeTimer = null;
}
let hoverCloseCallback = null;
function closeAfterHover() {
  if (panels.some(p => p?.contains(document.activeElement))) return;
  const callback = hoverCloseCallback;
  hoverCloseCallback = null;
  // The old owner's close and a new owner's open can expire on the same tick.
  // Dismiss only the old panels; do not cancel the new owner's pending hover.
  sceneAnchor = null; unstick(); clearTimers(); conceal(1); conceal(0);
  callback?.();
}
function scheduleClose() {
  if (stuck) return;
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeAfterHover, tooltipSettings.close);
}
function scheduleAutoHide(autoHideMs) {
  if (!(autoHideMs > 0)) return;
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    if (!tipEl) return;
    const systemReducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.body.classList.contains('reduced-motion') || systemReducedMotion) { hideTooltip(); return; }
    tipEl.classList.add('is-fading');
    fadeTimer = setTimeout(() => hideTooltip(), tooltipSettings.fade);
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
  if (hasList || text.length > tooltipSettings.textLengths.large) return 'large';
  if (detail && text.length > tooltipSettings.textLengths.detailedLarge) return 'large';
  if (detail || text.length > tooltipSettings.textLengths.medium) return 'medium';
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
    if (pending && !pending.el.isConnected) cancelOpen();
    if (!sceneAnchor && !pending) return;
    if (sceneAnchor && !sceneAnchor.isConnected) { hideTooltip(); return; }
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        const veil = node.matches?.('.modal-veil') ? node : node.querySelector?.('.modal-veil');
        if (veil && !veil.contains(sceneAnchor || pending?.el)) { hideTooltip(); return; }
      }
    }
  });
  sceneWatch.observe(document.documentElement, { childList: true, subtree: true });
}

function showWith(html, anchor, clear = null, intent = 'above', appearance = null, placementModel = null, autoHideMs = 0, align = 'start', level = 0, target = null, action = null) {
  if (!html) return false;
  // `anchor` is a rect; `target` is the element it was measured from (null
  // for a caller-owned rect — then there is no surface to watch).
  if (level === 0) { sceneAnchor = target instanceof Node ? target : null; watchScene(); }
  if (level === 0) { cancelOpen(); unstick(); hide(1); }
  clearTimers();
  const t = level === 0 ? ensure() : panel(1);
  t.style.setProperty('--tooltip-fade-duration', `${tooltipSettings.fade}ms`);
  conceal(level);
  t.innerHTML = html;
  // At the second level definitions are terminal: no unreachable third panel.
  if (level === 0) tooltipDecorator(t);
  t.setAttribute('role', action ? 'dialog' : 'tooltip');
  if (action) {
    t.setAttribute('aria-label', action.getAttribute('aria-label') || action.textContent);
    t.appendChild(action);
  } else t.removeAttribute('aria-label');
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
  hoverCloseCallback = null;
  state[level].target = target;
  state[level].open = true;
  if (target?.setAttribute) target.setAttribute('data-tip-open', 'true');
  if (target?.setAttribute) target.setAttribute('aria-describedby', [...new Set([...(target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), t.id])].join(' '));
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
  intent = 'above', align = 'start', clear = null, delayMs = null, focusDelayMs = null,
  appearance = null, placementModel = null, autoHideMs = 0, expand = false, expandTitle = null, showFn = null, tapToExplain = false,
} = {}) {
  adoptTitle(el);
  el.dataset.tipAttached = 'true';
  const show = () => {
    pending = null;
    if (!el.isConnected || el.closest('[inert], [hidden]')) return false;
    const information = el.querySelector('.card-info-button');
    const avoid = clear || (information ? [el.parentElement, information] : el.parentElement);
    return showFn ? showFn() : showWith(contentFn(), el.getBoundingClientRect(), avoid, intent, appearance, placementModel, 0, align, 0, el);
  };
  const queue = delay => {
    cancelOpen();
    if (state[0].open && state[0].target === el) { clearTimers(); if (stuck) unstick(); return; }
    pending = { el, show };
    watchScene();
    openTimer = setTimeout(show, delay);
  };
  el.addEventListener('pointerover', ev => {
    if (!tooltipSettings.hoverEnabled || ev.pointerType === 'touch' || ev.target?.closest('[data-tip-attached], [data-tip]') !== el) return;
    const previous = ev.relatedTarget?.closest?.('[data-tip-attached], [data-tip]');
    if (previous && previous !== el && el.contains(previous)) queue(delayMs ?? tooltipSettings.handover);
  });
  el.addEventListener('pointerenter', ev => {
    if (!tooltipSettings.hoverEnabled || ev.pointerType === 'touch') return;
    const child = ev.clientX != null ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-tip-attached], [data-tip]') : null;
    if (child && child !== el && el.contains(child)) return;
    queue(delayMs ?? tooltipSettings.open);
  });
  el.addEventListener('pointerleave', (ev) => {
    cancelOpen(el);
    if (stuck) return; // E8: a completed hold outlives the pointer leaving
    if (panels.some((p) => p && p.contains(ev.relatedTarget))) return;
    if (state[0].target === el) scheduleClose();
  });
  const focus = ev => { if (ev.target === el) queue(focusDelayMs ?? tooltipSettings.focus); };
  el.addEventListener('gpfocus', focus);
  el.addEventListener('focus', ev => { if (el.matches(':focus-visible')) focus(ev); });
  const blur = ev => {
    if (ev.target !== el) return;
    cancelOpen(el);
    if (stuck) return;
    if (state[0].target === el && !panels.some(p => p?.contains(ev.relatedTarget))) scheduleClose();
  };
  el.addEventListener('gpblur', blur);
  el.addEventListener('blur', blur);
  if (tapToExplain) {
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    const answer = ev => {
      if (typeof tapToExplain === 'function' && !tapToExplain()) return;
      if (ev.type === 'keydown' && !['Enter', ' '].includes(ev.key)) return;
      ev.preventDefault(); ev.stopPropagation(); cancelOpen(); show();
    };
    el.addEventListener('click', answer); el.addEventListener('keydown', answer);
  }
  if (expand) {
    const isControl = () => !!el.closest('button, [role="button"], a, input, select, [data-hold]');
    const open = () => { hideTooltip(); expander?.(contentFn(), { title: expandTitle || el.dataset.tipTitle || '', eyebrow: el.dataset.tipType || 'Detail' }); };
    if (!isControl()) el.addEventListener('click', (ev) => { ev.preventDefault(); open(); });
    let holdTimer = null;
    let lastTap = 0;
    el.addEventListener('touchstart', () => {
      if (isControl()) return;
      holdTimer = setTimeout(() => { holdTimer = null; open(); }, tooltipSettings.hold);
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      const now = Date.now();
      if (now - lastTap < tooltipSettings.doubleTap) { show(); lastTap = 0; return; }
      lastTap = now;
    }, { passive: true });
  }
}

/** Show the shared tooltip for a non-hover gesture, using the same placement. */
export function showTooltipFor(el, html, { intent = 'above', align = 'start', clear = null, appearance = null, placementModel = null, autoHideMs = 0 } = {}) {
  if (!el) return false;
  return showWith(html, el.getBoundingClientRect(), clear || el.parentElement, intent, appearance, placementModel, autoHideMs, align, 0, el);
}
/** Show the shared tooltip against a caller-owned measured subject rectangle. */
export function showTooltipForRect(anchor, html, { intent = 'above', align = 'start', clear = null, appearance = null, placementModel = null, autoHideMs = 0, target = null, action = null } = {}) {
  if (!anchor) return false;
  return showWith(html, anchor, clear, intent, appearance, placementModel, autoHideMs, align, 0, target, action);
}
/** Give a measured subject the same pointer-to-panel grace as attached hints. */
export function scheduleTooltipClose(target, onClose = null) {
  if (state[0].target === target) { hoverCloseCallback = onClose; scheduleClose(); }
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
  cancelOpen();
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
  const adopt = ev => {
    const el = ev.target?.closest?.('[title], [data-tip]');
    if (!el || panels.some((p) => p && p.contains(el))) return;
    // A title INSIDE an attached target (a card's cost badge) is that target's
    // business — it must not open a second, competing tooltip over the first.
    adoptTitle(el);
    if (!el.dataset.tip || el.dataset.tip === 'off' || el.dataset.tipAttached === 'true') return;
    // A native label inside a card must not race its attached explanation.
    const owner = el.parentElement?.closest('[data-tip-attached]');
    if (owner && !el.matches('[role="button"], .ctag, .epc-tag')) return;
    el.dataset.tipAdopted = 'true';
    attachTooltip(el, () => `<div>${esc(el.dataset.tip)}</div>`, { intent: 'above', align: 'center' });
    if (ev.type === 'pointerover' && ev.pointerType !== 'touch') el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: ev.pointerType || 'mouse', clientX: ev.clientX, clientY: ev.clientY }));
    if (ev.type === 'focusin') el.dispatchEvent(new Event('gpfocus'));
  };
  document.addEventListener('pointerover', adopt, true);
  document.addEventListener('focusin', adopt, true);
  const explain = ev => {
    const term = ev.target?.closest?.('.tooltip-keyword[data-tip], .inspection-tag[data-tip], .as-tip [data-tip][role="button"]');
    if (!term || panels[1]?.contains(term)) return;
    if (ev.type === 'keydown' && !['Enter', ' '].includes(ev.key)) return;
    ev.preventDefault(); ev.stopPropagation();
    if (panels[0]?.contains(term)) { cancelNested(); showNested(term); }
    else showTooltipFor(term, `<div>${esc(term.dataset.tip)}</div>`);
  };
  document.addEventListener('click', explain, true);
  document.addEventListener('keydown', explain, true);
  document.addEventListener('pointerdown', ev => {
    if (!panels.some(p => p?.contains(ev.target)) && !state[0].target?.contains(ev.target)) hideTooltip();
  }, true);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (state[1].open) { hide(1); ev.stopImmediatePropagation(); }
    else if (state[0].open) { hideTooltip(); ev.stopImmediatePropagation(); }
    else { cancelOpen(); cancelNested(); }
  }, true);
  const replace = () => { for (const [i, st] of state.entries()) if (st.open && st.target?.getBoundingClientRect && panels[i]) placeAnchored(panels[i], st.target.getBoundingClientRect(), { intent: panels[i].dataset.tooltipPlacement || 'above' }); };
  addEventListener('resize', replace);
}
wireTitles();
