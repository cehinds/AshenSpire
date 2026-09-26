// src/ui/components/iconTray.js — THE ONE ROW OF ROUND ICONS.
//
// Owner, 2026-09-14: "I want the relics, potion mini icons, and status effects,
// to share the same parent wireframe. use the combatant card status effect as
// the reference". So the combatant card's status row is lifted out of combat
// and every row of small round things with a count is this component:
//
//   · status effects on a combatant card (screens/combat.js, screens/coop.js)
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

const trays = new WeakMap();
const overflowActions = new WeakMap();
const observed = new WeakSet();

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
  node.tabIndex = 0;
  node.setAttribute('role', 'button');
  if (label) node.setAttribute('aria-label', label);
  if (disabled) node.setAttribute('aria-disabled', 'true');
  if (!tip) return node;
  attachTooltip(node, tip);
  const yields = () => typeof yieldTap === 'function' && yieldTap();
  node.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key) || yields()) return;
    event.preventDefault(); event.stopPropagation();
    if (activate) { hideTooltip(); activate(node); } else explain(node, tip);
  });
  node.addEventListener('click', (event) => {
    if (yields()) return;
    event.stopPropagation();
    if (activate && answered === node) { answered = null; hideTooltip(); activate(node); return; }
    explain(node, tip);
  });
  return node;
}

/** A host that can show every icon (the combatant inspector) registers it
 *  here; the `+N` tile then opens it. Without one the tile keeps its popover. */
export function setIconTrayOverflow(row, action) {
  if (row && typeof action === 'function') overflowActions.set(row, action);
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
  observed.add(row);
  new ResizeObserver(() => { if (row.isConnected) fitIconTray(row, row.getBoundingClientRect().width); }).observe(row);
}

// Reuse each icon and its listeners when space changes; only what shows moves.
export function fitIconTray(row, width) {
  if (!row) return;
  let state = trays.get(row);
  if (!state) {
    const items = [...row.children];
    for (const item of items) {
      item.tabIndex = 0;
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
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const rem = Math.max(16 / zoom, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const plan = planIconTray({ count: items.length, width: width / zoom, rem });
  row.style.setProperty('--icon-tray-size', `${plan.size}px`);
  row.style.setProperty('--icon-tray-gap', `${plan.gap}px`);
  if (state.count === plan.shown) return;
  state.count = plan.shown; row.replaceChildren(...items.slice(0, plan.shown));
  if (plan.hidden) {
    summary.textContent = t('iconTray.more', { count: plan.hidden });
    summary.setAttribute('aria-label', tFull(list ? 'iconTray.more' : 'iconTray.moreOpen', { count: plan.hidden }));
    list?.replaceChildren(...items.slice(plan.shown));
    row.append(overflow);
  }
}
