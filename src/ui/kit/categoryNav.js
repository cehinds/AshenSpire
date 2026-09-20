// src/ui/kit/categoryNav.js — THE ONE W1 CATEGORY NAVIGATION (kit NavRail).
//
// FRONTEND-WIREFRAMES rule 11: a menu with several categories is W1 — a left
// rail beside the pane on wide hosts, and on compact hosts the same navigation
// above the pane as one `[Category ▾]` selector that opens the list under it.
// Never a horizontal strip of tabs, never an accordion. Settings, the Shop, the
// Armoury, the Compendium, Profile and the pile viewer all draw it with this.
//
// WHICH ONE is models/CategoryNavModel.js's answer from this host's own box
// (`categoryNavPlan`), written as `data-cat-nav="rail|selector"` on the
// `.as-railed` host; kit.css keys off that attribute and measures nothing.
// The open list is `data-cat-open="true"`.
//
// THE RAIL ITEMS ARE THE SURFACE'S OWN, untouched: they keep `role=tab`,
// `aria-selected`, `data-member` and any `data-modal-tab` / `data-shop-category`
// hooks, and the compact list IS the rail, so every tool reads one set at every
// width. The selector's face follows `aria-selected` on its own.
//
// KEYS AND THE PAD ARE input.js's. Its capture-phase router moves the one
// cursor (`.gp-focus`) with the arrows and the d-pad and presses what it is on
// with Enter / A, so a category is reached the way every other control is.
// This file adds only Home / End, and Escape while the compact list is open.
// Every focus it moves goes through focusElement, so the cursor and DOM focus
// stay on the same control.
//
// ESCAPE CLOSES THE LIST, NEVER THE DOOR. A door listens for Escape on
// `document` (modalShell), on `window` in the capture phase (the in-run
// overlay), or on `document` in the bubble phase (the Armoury), and the pad's
// B arrives as a synthetic Escape on `window`. One `window` capture listener,
// installed when this module loads and so ahead of every door's, claims an
// Escape while a list is open and stops it there.
//
// This module builds its own two elements rather than importing the kit's
// builders: kit/index.js re-exports it, and a cycle is not worth two lines.

import { focusElement } from '../input.js';
import { t } from '../strings.js';
import {
  categoryNavPlan, categoryNavKey, categoryNavLanding, categoryNavAfterPick, categoryNavFace,
} from '../models/CategoryNavModel.js';
import { resolveCategoryNavMode } from '../models/WireframeChoiceModel.js';
import { activeWireframeChoice } from '../wireframeChoices.js';

const OPEN = new Set();
// Every attached navigation, so a Menus choice (Settings → Advanced →
// Wireframes) reaches the menus already on the page instead of only the next
// one opened. Membership ends at `release()`, the same lifetime as the host.
const LIVE = new Set();
let serial = 0;

function onEscape(event) {
  if (event.key !== 'Escape' || !OPEN.size) return;
  for (const nav of [...OPEN]) if (!nav.connected()) nav.release();
  const nav = [...OPEN].at(-1);
  if (!nav || categoryNavKey('Escape', { mode: nav.mode(), open: nav.isOpen() }) !== 'close') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  nav.close(true);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('keydown', onEscape, true);
}

/** landControl(control) — put the unified cursor and DOM focus on one control. */
export function landControl(control) {
  if (!control || !control.isConnected) return;
  focusElement(control);
  if (document.activeElement !== control) control.focus({ preventScroll: true });
}

const node = (tag, attrs = {}, children = []) => {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key === 'text') element.textContent = value;
    else element.setAttribute(key, value === true ? '' : String(value));
  }
  element.append(...children.filter(Boolean));
  return element;
};

/**
 * categoryNav({ items, ariaLabel, rail, railAttrs, choose, label, face,
 *               onChange, toggleClass, toggleId, config })
 *   → { toggle, rail, items, attach(host), start(), sync(text), plan(),
 *       mode(), isOpen(), setOpen(open, refocus), close(refocus), release() }
 *
 * `items` are the surface's rail items (kit railItem or equivalent markup).
 * `rail` is an existing list to adopt (Settings draws its own); otherwise one
 * is built from `railAttrs`. `choose(member)` switches the pane, if the
 * surface does not already do that in its own click handler. `label(face)` is
 * the selector's accessible name; `face(item)` its visible text (default: the
 * item's label and status). `onChange({ mode, open })` mirrors state for a
 * surface that has its own attribute to keep true.
 *
 * `attach(host)` puts the selector before the rail inside the `.as-railed`
 * host and starts measuring it; kit `railed(nav, pane)` does that for you.
 */
/**
 * replanCategoryNavs() → how many attached navigations re-asked the question.
 *
 * Called when a Menus wireframe choice changes. A navigation whose host has
 * left the document releases itself here rather than being re-measured — the
 * same sweep `onEscape` runs, and the same contract: a host that is detached
 * and put back must be `attach`ed again, which is what every door that keeps a
 * nav already does. The rest re-run `plan()`, which is the call their
 * ResizeObserver makes, so nothing can happen here that a window resize could
 * not already do.
 */
export function replanCategoryNavs() {
  let replanned = 0;
  for (const nav of [...LIVE]) {
    if (!nav.connected()) { nav.release(); continue; }
    nav.plan();
    replanned += 1;
  }
  return replanned;
}

export function categoryNav({
  items = [], ariaLabel = '', rail = null, railAttrs = {}, choose = null, label = null, face = null,
  onChange = null, toggleClass = '', toggleId = '', config,
} = {}) {
  const list = rail || node('div', {
    ...railAttrs, class: ['as-rail', railAttrs.class].filter(Boolean).join(' '),
    role: railAttrs.role || 'tablist', 'aria-label': railAttrs['aria-label'] || ariaLabel || null,
  }, items);
  if (!list.id) list.id = `as-catnav-list-${++serial}`;
  const faceNode = node('span', { class: 'as-catnav-face' });
  const toggle = node('button', {
    type: 'button', id: toggleId || null, class: ['as-railitem as-catnav-toggle', toggleClass].filter(Boolean).join(' '),
    'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': list.id,
  }, [faceNode, node('span', { class: 'as-catnav-caret', 'aria-hidden': 'true', text: '▾' })]);

  let host = null;
  let mode = 'rail';
  let open = false;
  let sizeObserver = null;
  let selectionObserver = null;

  const selected = () => items.find((item) => item.getAttribute('aria-selected') === 'true') || items[0] || null;
  const faceOf = face || ((item) => categoryNavFace([...item.childNodes].map((child) => child.textContent)));
  const labelOf = label || ((text) => t('nav.categorySelector', { categories: ariaLabel, current: text }));
  const notify = () => { if (onChange) onChange({ mode, open }); };

  const sync = (text) => {
    const current = selected();
    const value = text ?? (current ? faceOf(current) : '');
    faceNode.textContent = value;
    toggle.setAttribute('aria-label', labelOf(value));
  };

  const setOpen = (next, refocus = false) => {
    open = !!next && mode === 'selector';
    if (host) host.dataset.catOpen = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) OPEN.add(api); else OPEN.delete(api);
    notify();
    if (refocus) landControl(open ? selected() : toggle);
  };

  const apply = (next) => {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const cursor = typeof document !== 'undefined' ? document.querySelector('.gp-focus') : null;
    const onItem = items.includes(active) || items.includes(cursor);
    const onToggle = active === toggle || cursor === toggle;
    mode = next;
    open = false;
    OPEN.delete(api);
    host.dataset.catNav = mode;
    host.dataset.catOpen = 'false';
    toggle.setAttribute('aria-expanded', 'false');
    notify();
    // The control under the cursor may have just been hidden: hand it over.
    if (mode === 'selector' && onItem) landControl(toggle);
    else if (mode === 'rail' && onToggle) landControl(selected());
  };

  /** Ask the model with this host's own box, in local CSS px (rects are post-zoom). */
  const plan = () => {
    if (!host || !host.isConnected) return mode;
    const root = document.documentElement;
    const rootStyle = getComputedStyle(root);
    const zoom = parseFloat(rootStyle.getPropertyValue('--ui-zoom')) || 1;
    const result = categoryNavPlan({
      hostWidthPx: host.getBoundingClientRect().width / zoom,
      viewportHeightPx: window.innerHeight / zoom,
      rootFontPx: parseFloat(rootStyle.fontSize),
      itemMinHeightPx: items[0] ? parseFloat(getComputedStyle(items[0]).minHeight) : 0,
      categoryCount: items.length,
      current: mode,
    }, config);
    // The model answers what FITS; the player answers what they want to look
    // at, and their answer wins — including the case the model never returns,
    // a rail on a host it has to squeeze into. `auto` leaves the measured
    // answer exactly as it was, and an unmeasured host then keeps its mode
    // (the plan hands `current` back). A CHOSEN mode does not wait for a box,
    // because nothing about it needs measuring: the `result.measured ||` arm is
    // only reached when the choice disagrees with the mode on screen.
    const wanted = resolveCategoryNavMode(result.mode, activeWireframeChoice('wireframeMenuNav', root));
    if ((result.measured || wanted !== result.mode) && wanted !== mode) apply(wanted);
    return mode;
  };

  const release = () => {
    sizeObserver?.disconnect();
    selectionObserver?.disconnect();
    sizeObserver = null;
    selectionObserver = null;
    OPEN.delete(api);
    LIVE.delete(api);
  };

  toggle.addEventListener('click', () => setOpen(!open, true));
  for (const item of items) {
    item.addEventListener('click', () => {
      const after = categoryNavAfterPick({ mode, open });
      if (choose) choose(item.dataset.member);
      if (after.close) setOpen(false, after.focus === 'selector');
    });
    item.addEventListener('keydown', (event) => {
      const action = categoryNavKey(event.key, { mode, open });
      if (action !== 'first' && action !== 'last') return;
      event.preventDefault();
      event.stopPropagation();
      const target = action === 'first' ? items[0] : items.at(-1);
      // Wide: the rail is the selection, so Home / End select. Compact: the
      // list is open under the selector and Enter picks, so they only move.
      if (mode === 'rail') target.click();
      landControl(target);
    });
  }
  // The list closes when the pad's cursor leaves it, or when DOM focus does
  // (Tab, a click elsewhere); each is judged on its own, because the two are
  // allowed to stand in different places.
  for (const control of [toggle, ...items]) {
    control.addEventListener('gpblur', () => setTimeout(() => {
      const cursor = document.querySelector('.gp-focus');
      if (open && host && !(cursor && host.contains(cursor))) setOpen(false);
    }, 0));
  }

  const attach = (hostNode) => {
    host = hostNode;
    LIVE.add(api);
    if (list.parentElement !== host) host.prepend(list);
    host.insertBefore(toggle, list);
    host.dataset.catNav = mode;
    host.dataset.catOpen = 'false';
    host.addEventListener('focusout', (event) => {
      if (open && !(event.relatedTarget && host.contains(event.relatedTarget))) setOpen(false);
    });
    if (typeof ResizeObserver !== 'undefined') {
      sizeObserver = new ResizeObserver(() => { if (!host.isConnected) release(); else plan(); });
      sizeObserver.observe(host);
    }
    if (typeof MutationObserver !== 'undefined') {
      selectionObserver = new MutationObserver(() => sync());
      selectionObserver.observe(list, { attributes: true, attributeFilter: ['aria-selected'], childList: true, characterData: true, subtree: true });
    }
    sync();
    notify();
    plan();
    return host;
  };

  /** The control a door should open on: the selector (compact) or the selected item (wide). */
  const start = () => {
    plan();
    return categoryNavLanding({ mode, open }) === 'selector' ? toggle : selected();
  };

  const api = {
    isCategoryNav: true,
    toggle, rail: list, items,
    attach, start, sync, plan, release, setOpen,
    close: (refocus = false) => setOpen(false, refocus),
    mode: () => mode,
    isOpen: () => open,
    connected: () => !!host && host.isConnected,
  };
  return api;
}
