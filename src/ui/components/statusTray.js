// Reuse each status pip and its existing inspection listeners when space changes.
const trays = new WeakMap();
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
    const overflow = document.createElement('details'); overflow.className = 'status-overflow';
    const summary = document.createElement('summary');
    const list = document.createElement('div'); list.className = 'status-overflow-list';
    overflow.append(summary, list);
    overflow.addEventListener('click', event => event.stopPropagation());
    state = { items, overflow, summary, list, count: -1 }; trays.set(row, state);
    row.setAttribute('aria-label', 'Status effects');
  }
  const { items, overflow, summary, list } = state;
  const capacity = Math.max(1, Math.floor(width / 24));
  const shown = items.length <= capacity ? items.length : Math.max(0, capacity - 1);
  if (state.count === shown) return;
  state.count = shown; row.replaceChildren(...items.slice(0, shown));
  if (shown < items.length) {
    summary.textContent = `+${items.length - shown}`;
    summary.setAttribute('aria-label', `${items.length - shown} more status effects`);
    list.replaceChildren(...items.slice(shown)); row.append(overflow);
  }
}
