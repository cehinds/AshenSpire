// src/ui/components/combatLogModal.js — the whole combat log, as a full-screen door.
//
// The drawer under the Combat log button shows the last few lines. This door
// lists every public entry of the combat, newest at the bottom, and is one more
// door on modalShell: Escape, the veil, focus return and the house chrome are
// the shell's, not copied here. It reads the same model the drawer does and
// draws entries with the same renderer, so the two cannot disagree.

import { el, button } from '../kit/index.js';
import { openModal } from './modalShell.js';
import { t, tFull } from '../strings.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';

/** Draw the public log into `container`, grouped by round. The drawer and the door share this face. */
export function renderCombatLogEntries(container, entries) {
  const nodes = [];
  let round, items = null;
  for (const entry of entries) {
    if (entry.round !== round) {
      round = entry.round;
      items = el('ol', {});
      nodes.push(el('h3', { text: t('combat.log.round', { round }) }), items);
    }
    items.append(el('li', { text: entry.text }));
  }
  if (!entries.length) nodes.push(el('p', { text: tFull('combat.log.empty') }));
  container.replaceChildren(...nodes);
}

/**
 * openCombatLogModal({ entries, opener, onClose }) → { panel, setEntries, close }.
 * Opens scrolled to the newest entry. Closing returns focus to `opener`.
 * `setEntries` redraws in place and keeps the reader at the bottom only when
 * they already were there, so reading back in the log is never yanked away.
 */
export function openCombatLogModal({ entries = [], opener = document.activeElement, onClose = null } = {}) {
  const list = el('div', { class: 'combat-log-modal-entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  renderCombatLogEntries(list, entries);
  const closeButton = button({ label: t('common.close'), role: 'exit', attrs: { 'data-back': '' } });
  // The shell reads the opener only at close, so hand it a live reference that
  // setOpener can repoint when the Full log button it came from is replaced.
  let currentOpener = opener;
  const openerRef = {
    get isConnected() { return !!currentOpener?.isConnected; },
    focus(options) { currentOpener?.focus?.(options); },
  };
  const modal = openModal({
    name: 'combat-log', size: 'xl', className: 'combat-log-modal', title: t('combat.log.title'),
    titleId: 'combat-log-modal-title', body: list, secondary: [closeButton], opener: openerRef, onClose,
  });
  markUiComponent(modal.panel, UI.combatLogModal);
  // Reading the log must not skip the attack that is playing: fx.js's
  // click-to-skip ignores anything under [data-combat-read-only].
  modal.veil.setAttribute('data-combat-read-only', '');
  closeButton.addEventListener('click', () => modal.close());
  modal.body.scrollTop = modal.body.scrollHeight;
  return Object.freeze({
    panel: modal.panel,
    setEntries(next) {
      const { body } = modal;
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
      renderCombatLogEntries(list, next);
      if (atEnd) body.scrollTop = body.scrollHeight;
    },
    /** Closing returns focus to `node` from now on (the button a remount just drew). */
    setOpener(node) { currentOpener = node; },
    close: () => modal.close(),
  });
}
