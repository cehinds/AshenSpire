// src/ui/components/iconTray.js — THE ONE ROW OF ROUND ICONS.
//
// Owner, 2026-09-14: "I want the relics, potion mini icons, and status effects,
// to share the same parent wireframe. use the combatant card status effect as
// the reference". So the combatant card's status row is lifted out of combat
// and every row of small round things with a count is this component:
//
//   · status effects on a combatant card (screens/combat.js)
//   · the relic rail under the run HUD (components/relicRail.js, every screen)
//   · the Potions minis over the combat footer's Potions control (combat.js)
//
// What a child inherits, all of it from here and none of it restated:
//   · THE LOOK — the kit Pip (styles/kit.css `.as-pip`), its count a round
//     StatePill on the corner, sized by the tray (styles/kit.css § ICON TRAY).
//   · THE HORIZONTAL GRID — one row that never wraps or scrolls. Icon size and
//     gap come from planIconTray (models/IconTrayModel.js, wireframeUi.iconTray);
//     what does not fit collapses into a final `+N` tile.
//   · THE TOOLTIP — hover and focus explain after the shared delay; a tap
//     explains at once (a tap IS the question on a phone, where the hover clock
//     never runs). An icon that also DOES something — a relic opens its card, a
//     potion opens its Potions entry — does it on the second tap, or on
//     Enter/Space. `yieldTap` lets a host hand the tap on (combat: a card or
//     flask is armed, so a tap on an enemy's pip is a play on that enemy).
import { planIconTray } from '../models/IconTrayModel.js';
import { attachTooltip, hideTooltip, showTooltipFor } from './tooltip.js';
import { pip, pips } from '../kit/index.js';
import { t, tFull } from '../strings.js';
import { layoutMetrics } from '../layoutMetrics.js';
import { wireframeUi } from '../../content/wireframeUi.js';

const trays = new WeakMap();
const overflowActions = new WeakMap();
const bridged = new WeakSet();
// The icon size a host asked for, kept across a refit that is not handed one (refreshIconTray, a rebuilt tray's children).
const iconSizes = new WeakMap();
// How many things the host hid beside the tray (the HUD's squeezed defense badges): the +N tile counts them and is always drawn.
const extras = new WeakMap();
// Each observed tray's ResizeObserver, so a board that throws its tray away
// (co-op, per snapshot) can stop it with unobserveIconTray (#1436 review).
const observed = new WeakMap();

// The icon whose explanation a tap last opened: its next tap acts. A press
// anywhere else forgets it, so a later tap on it explains again first.
let answered = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (event) => {
    if (answered && !answered.contains(event.target)) answered = null;
  }, true);
}

function explain(node, tip) {
  answered = node;
  showTooltipFor(node, tip(), { intent: 'above', align: 'center' });
}

/** iconTray({ label, attrs }) → the empty row; fill it with setIconTrayItems. */
export function iconTray({ label = '', attrs = {} } = {}) {
  const row = pips([], { ...attrs, class: ['icon-tray', attrs.class].filter(Boolean).join(' ') });
  if (label) row.setAttribute('aria-label', label);
  return row;
}

/**
 * trayIcon(opts) → one icon of a tray.
 *   glyph | art   the face: text, or a node (a flask's painted identity)
 *   count         the corner pill; null draws none
 *   tone, ring    the Pip's accent and ring-fill look
 *   label         the accessible name
 *   tip()         the tooltip HTML, computed when shown
 *   activate(el)  what a second tap or Enter does; absent → it explains again
 *   yieldTap()    true → the tap is not the icon's (the event travels on)
 *   disabled      drawn spent; still explains and still activates
 */
export function trayIcon({
  glyph = '', art = null, count = null, tone = '', ring = false, label = '',
  tip = null, activate = null, yieldTap = null, disabled = false, attrs = {},
} = {}) {
  const node = pip({ glyph: art ? '' : glyph, count, tone, ring, attrs: { ...attrs, class: ['tray-icon', attrs.class].filter(Boolean).join(' ') } });
  if (art) node.prepend(art);
  // Status pips can use a text glyph, an engraved icon, or caller-supplied
  // artwork. Give only those pips a stable box so the HUD can size and center
  // the glyph independently from its count pill.
  if (node.classList.contains('status-icon')) {
    const countPill = node.querySelector('.stk');
    const glyphNodes = [...node.childNodes].filter(child => child !== countPill);
    if (glyphNodes.length) {
      const glyph = document.createElement('span');
      glyph.className = 'status-icon-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      node.insertBefore(glyph, countPill || null);
      glyph.append(...glyphNodes);
    }
  }
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  if (label) node.setAttribute('aria-label', label);
  if (disabled) node.setAttribute('aria-disabled', 'true');
  if (!tip) return node;
  attachTooltip(node, tip);
  // The tooltip's content lives in a hook so a node kept across a rebuild (domWrite.morph) explains with its newest text.
  const liveTip = () => (node.__hooks?.tip || tip)();
  const yields = () => typeof yieldTap === 'function' && yieldTap();
  node.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || yields()) return;
    event.preventDefault(); event.stopPropagation();
    if (activate) { hideTooltip(); activate(node); } else explain(node, liveTip);
  });
  node.addEventListener('click', (event) => {
    if (yields()) return;
    event.stopPropagation();
    if (activate && answered === node) { answered = null; hideTooltip(); activate(node); return; }
    explain(node, liveTip);
  });
  return node;
}

/** A host that can show every icon (the combatant inspector) registers it
 *  here; the `+N` tile then opens it. Without one the tile keeps its popover. */
export function setIconTrayOverflow(row, action) {
  if (row && typeof action === 'function') overflowActions.set(row, action);
}

/** A tray's children were changed under it (a status gained or lost, reconciled in place by domWrite): drop the fit's
 *  cached items and overflow, take over the rebuilt row's overflow action, and refit to the width it last had. Without
 *  this a later fit plans from the old items: it resurrects removed icons, misses new ones, and skips a recompute when the
 *  shown count happens to match. `fresh` is the rebuilt tray the children were taken from. */
export function refreshIconTray(row, fresh = null) {
  if (!row) return;
  const width = trays.get(row)?.width;
  trays.delete(row);
  if (fresh && overflowActions.has(fresh)) overflowActions.set(row, overflowActions.get(fresh));
  if (width != null) fitIconTray(row, width);
}

/** Replace a tray's icons and fit them to the width it last had. */
export function setIconTrayItems(row, items = []) {
  if (!row) return;
  const width = trays.get(row)?.width;
  trays.delete(row);
  row.replaceChildren(...items);
  if (width != null) fitIconTray(row, width);
}

/** Fit a tray to its own box whenever that box changes size. */
export function observeIconTray(row) {
  if (!row || observed.has(row) || typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => { if (row.isConnected) fitIconTray(row, row.getBoundingClientRect().width); });
  observer.observe(row);
  observed.set(row, observer);
}

/** Stop the observer observeIconTray started on this tray. */
export function unobserveIconTray(row) {
  observed.get(row)?.disconnect();
  observed.delete(row);
}

// Reuse each icon and its listeners when space changes; only what shows moves.
// Body zoom and the root font size are computed-style reads, and every tray
// fit is followed by style writes, so each read after the first tray's write
// flushed style again (a render fits a tray per combatant). They come from the
// shared layout-constants cache, which is dropped when the page's scale writes.
function trayMetrics() {
  const { zoom, rem } = layoutMetrics();
  return { zoom, rem };
}

// `iconPx` (viewport px, optional): the icon size the host's own stylesheet draws, for a tray that shares a row with
// badges of a fixed size (the combat HUD's badge row). Capacity is planned from that size and the tray's custom
// property carries it; without it the plan's size is used.
export function fitIconTray(row, width, { iconPx = iconSizes.get(row) || 0, extraHidden = extras.get(row) || 0 } = {}) {
  if (!row) return;
  if (iconPx > 0) iconSizes.set(row, iconPx);
  extras.set(row, extraHidden);
  let state = trays.get(row);
  if (!state) {
    const items = [...row.children];
    for (const item of items) {
      item.tabIndex = 0;
      if (bridged.has(item)) continue; // a refit of a kept icon must not stack another listener pair
      bridged.add(item);
      // The tooltips listen to the game's focus events. Bridge native keyboard
      // focus so every visible or overflow icon remains readable.
      item.addEventListener('focus', () => item.dispatchEvent(new Event('gpfocus')));
      item.addEventListener('blur', () => item.dispatchEvent(new Event('gpblur')));
    }
    const action = overflowActions.get(row);
    let overflow, summary, list = null;
    if (action) {
      overflow = summary = document.createElement('button');
      overflow.type = 'button';
      overflow.className = 'status-overflow status-overflow-more';
      // The action returns false when it yields (a card or flask is armed and
      // the tap is a play on the target); the event then travels on untouched.
      overflow.addEventListener('click', event => { if (action(overflow) !== false) event.stopPropagation(); });
      // Keyboard activation is explicit, as on the icons: a screen's own
      // Enter/Space shortcuts must not also run, and the tile answers once.
      overflow.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (action(overflow) === false) return;
        event.preventDefault(); event.stopPropagation();
      });
    } else {
      overflow = document.createElement('details'); overflow.className = 'status-overflow';
      summary = document.createElement('summary');
      list = document.createElement('div'); list.className = 'status-overflow-list';
      overflow.append(summary, list);
      overflow.addEventListener('click', event => event.stopPropagation());
    }
    state = { items, overflow, summary, list, count: -1, width: null }; trays.set(row, state);
  }
  state.width = width;
  const { items, overflow, summary, list } = state;
  // `width` arrives in viewport px; the tray is laid out in local (pre-zoom) px.
  // A reference rem is at least 16 physical px, as in the hand and footer plans.
  const { zoom, rem } = trayMetrics();
  const plan = planIconTray({ count: items.length, width: width / zoom, rem },
    iconPx > 0 ? { ...wireframeUi.iconTray, iconRem: iconPx / zoom / rem } : wireframeUi.iconTray);
  row.style.setProperty('--icon-tray-size', `${plan.size}px`);
  row.style.setProperty('--icon-tray-gap', `${plan.gap}px`);
  const shown = extraHidden > 0 ? Math.min(items.length, Math.max(0, plan.capacity - 1)) : plan.shown;
  const hidden = items.length - shown + extraHidden;
  const key = `${shown}/${extraHidden}`;
  if (state.count === key) return;
  state.count = key; row.replaceChildren(...items.slice(0, shown));
  if (hidden) {
    summary.textContent = t('iconTray.more', { count: hidden });
    summary.setAttribute('aria-label', tFull(list ? 'iconTray.more' : 'iconTray.moreOpen', { count: hidden }));
    list?.replaceChildren(...items.slice(shown));
    row.append(overflow);
  }
}

/** Fit a status tray that shares the combat HUD's badge row with the defense badges: one capacity, the row's own width. The tray
 *  always keeps room for a whole icon or +N tile; when the visible badges leave less, the last badges are squeezed out
 *  (data-squeezed) and counted in the +N. The icon size is the row's height, the badges' own diameter. */
export function fitBadgeRowTray(tray) {
  const row = tray?.closest?.('.combat-health-badges');
  if (!row) return;
  const iconPx = row.getBoundingClientRect().height;
  const badges = [...row.children].filter(node => node.classList.contains('combat-health-badge'));
  for (const badge of badges) if (badge.dataset.squeezed) delete badge.dataset.squeezed;
  let squeezed = 0;
  if (tray.children.length && iconPx > 0) {
    const shown = badges.filter(badge => !badge.hidden);
    while (tray.getBoundingClientRect().width < iconPx - 0.5 && shown.length) { shown.pop().dataset.squeezed = 'true'; squeezed++; }
  }
  fitIconTray(tray, tray.getBoundingClientRect().width, { iconPx, extraHidden: squeezed });
}
