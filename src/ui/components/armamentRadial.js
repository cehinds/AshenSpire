import { focusElement } from '../input.js';
import { popover, row } from '../kit/index.js';

let activeRadial = null;

export function closeArmamentRadial({ restoreFocus = false } = {}) {
  if (!activeRadial) return false;
  activeRadial.close({ restoreFocus });
  return true;
}

/**
 * One lifecycle owner for the combat Armaments shortcuts. Callers supply
 * existing actions; this component only presents, focuses, and dismisses them.
 */
export function mountArmamentRadial(anchor, {
  mode = 'radial', placement = 'left', onFullArmaments = null,
} = {}) {
  if (!anchor) throw new Error('mountArmamentRadial requires an anchor');
  closeArmamentRadial();

  // NOTHING MOUNTS THIS TODAY — combat.js dropped its Armaments rail control
  // (tools/combat-action-row.mjs asserts the absence), so this component is
  // reachable only from a caller that does not exist yet. It is composed from
  // the kit's Popover and Buttons rather than from a bespoke shape, so the day
  // a caller returns it looks like the rest of the game and needs no CSS of its
  // own; styles/combat.css's old `.armament-radial*` block went with the rail.
  const root = popover({ className: 'armament-radial', attrs: { role: 'menu', 'aria-label': 'Armaments shortcuts' } });
  root.hidden = true;
  anchor.closest('.combat')?.appendChild(root);

  let currentMode = mode;
  let currentPlacement = placement;
  let open = false;
  let holdTimer = null;
  let focusTimer = null;
  let openedByHold = false;
  let items = [];
  let observer = null;

  const buttons = () => [...root.querySelectorAll('button:not([disabled])')];
  const sync = () => {
    const radial = currentMode === 'radial';
    anchor.dataset.armamentsMode = currentMode;
    anchor.setAttribute('aria-haspopup', radial ? 'menu' : 'dialog');
    anchor.setAttribute('aria-expanded', String(radial && open));
    root.dataset.placement = currentPlacement;
    root.hidden = !(radial && open);
  };
  const close = ({ restoreFocus = false } = {}) => {
    if (!open && root.hidden) return;
    clearTimeout(focusTimer);
    open = false;
    sync();
    if (restoreFocus && anchor.isConnected) {
      anchor.focus();
      focusElement(anchor);
    }
  };
  const openMenu = () => {
    if (currentMode !== 'radial') return false;
    open = true;
    sync();
    // Native click/keyboard activation is still completing here. Moving the
    // unified cursor synchronously can make that same gesture activate the
    // first radial target. Defer entry until the opener's gesture is finished.
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      if (!open) return;
      const first = buttons()[0];
      first?.focus();
      if (first) focusElement(first);
    }, 0);
    return true;
  };
  const toggle = () => (open ? close({ restoreFocus: true }) : openMenu());

  const draw = () => {
    root.innerHTML = '';
    for (const item of items) {
      // A kit Row per destination: the label, and what it costs as its status.
      const button = row({
        label: item.label, status: item.detail || '',
        disabled: item.disabled === true,
        className: 'armament-radial-target',
        attrs: {
          role: 'menuitem', 'aria-label': item.ariaLabel || item.label,
          dataset: {
            radialTarget: item.target, focusable: 'true',
            ...(item.hotkeySlot != null ? { flaskHotkeySlot: String(item.hotkeySlot) } : {}),
          },
        },
      });
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (item.target === 'full') {
          close();
          onFullArmaments?.();
          return;
        }
        item.activate?.(button);
      });
      root.appendChild(button);
    }
  };

  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (openedByHold) {
      openedByHold = false;
      return;
    }
    if (currentMode === 'fixed') onFullArmaments?.();
    else toggle();
  });
  anchor.addEventListener('pointerdown', () => {
    clearTimeout(holdTimer);
    openedByHold = false;
    holdTimer = setTimeout(() => {
      openedByHold = openMenu();
    }, 360);
  });
  const cancelHold = () => clearTimeout(holdTimer);
  anchor.addEventListener('pointerup', cancelHold);
  anchor.addEventListener('pointercancel', cancelHold);
  anchor.addEventListener('pointerleave', cancelHold);

  const onDocumentPointer = (event) => {
    // Contextual action menus opened by a radial shortcut temporarily own
    // pointer input. They are siblings of the radial in the combat surface,
    // so containment alone cannot identify them as a child interaction.
    if (!open || root.contains(event.target) || anchor.contains(event.target)
      || event.target.closest?.('.flask-action-menu')) return;
    close();
  };
  const onKey = (event) => {
    if (!open) return;
    // A radial destination may open and focus a child menu. Once focus has
    // crossed that boundary, the child owns every key, including Cancel, and
    // restores focus to its still-visible originating radial target.
    if (!root.contains(document.activeElement)) return;
    if (event.key === 'Escape' || event.key === 'Backspace') {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    const list = buttons();
    if (!list.length || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const at = Math.max(0, list.indexOf(document.activeElement));
    const next = event.key === 'Home' ? list[0]
      : event.key === 'End' ? list.at(-1)
        : list[(at + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + list.length) % list.length];
    next?.focus();
    if (next) focusElement(next);
  };
  document.addEventListener('pointerdown', onDocumentPointer, true);
  window.addEventListener('keydown', onKey);
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => {
      if (anchor.isConnected && root.isConnected) return;
      document.removeEventListener('pointerdown', onDocumentPointer, true);
      window.removeEventListener('keydown', onKey);
      clearTimeout(focusTimer);
      observer?.disconnect();
      if (activeRadial?.root === root) activeRadial = null;
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  const api = {
    anchor,
    root,
    close,
    open: openMenu,
    setItems(nextItems) {
      items = Array.isArray(nextItems) ? nextItems : [];
      draw();
    },
    update(next = {}) {
      if (next.mode) currentMode = next.mode;
      if (next.placement) currentPlacement = next.placement;
      if (currentMode !== 'radial') open = false;
      sync();
    },
  };
  activeRadial = api;
  sync();
  return api;
}
