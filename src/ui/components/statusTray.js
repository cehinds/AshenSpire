import { planIconTray } from '../models/CombatantStackModel.js';

// Reuse each status pip and its existing inspection listeners when space changes.
const trays = new WeakMap();
const overflowActions = new WeakMap();

/** A host that can show every effect (the combatant inspector) registers it
 *  here; the `+N` tile then opens it. Without one the tile keeps its popover. */
export function setStatusTrayOverflow(row, action) {
  if (row && typeof action === 'function') overflowActions.set(row, action);
}

export function fitStatusTray(row, width) {
  if (!row) return;
  let state = trays.get(row);
  if (!state) {
    const items = [...row.children];
    for (const item of items) {
      item.tabIndex = 0;
      // Existing pip tooltips listen to the game's focus events. Bridge native
      // keyboard focus so every visible or overflow effect remains readable.
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
      // Keyboard activation is explicit, as on the pips: the combat screen's
      // own Enter/Space shortcuts must not also run, and the tile answers once.
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
    state = { items, overflow, summary, list, count: -1 }; trays.set(row, state);
    row.setAttribute('aria-label', 'Status effects');
  }
  const { items, overflow, summary, list } = state;
  // `width` arrives in viewport px; the tray is laid out in local (pre-zoom) px.
  // A reference rem is at least 16 physical px, as in the hand and footer plans.
  const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
  const rem = Math.max(16 / zoom, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  const plan = planIconTray({ count: items.length, width: width / zoom, rem });
  row.style.setProperty('--status-icon-size', `${plan.size}px`);
  row.style.setProperty('--status-icon-gap', `${plan.gap}px`);
  if (state.count === plan.shown) return;
  state.count = plan.shown; row.replaceChildren(...items.slice(0, plan.shown));
  if (plan.hidden) {
    summary.textContent = `+${plan.hidden}`;
    summary.setAttribute('aria-label', `${plan.hidden} more status effects${list ? '' : '; view all'}`);
    list?.replaceChildren(...items.slice(plan.shown));
    row.append(overflow);
  }
}
