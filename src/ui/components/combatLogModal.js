// src/ui/components/combatLogModal.js — the whole combat log, as a full-screen door.
//
// The drawer under the Combat log button shows the last few lines. This door
// lists every public entry of the combat, newest at the bottom, and is one more
// door on modalShell: Escape, the veil, focus return and the house chrome are
// the shell's, not copied here. It reads the same model the drawer does and
// draws entries with the same renderer, so the two cannot disagree.

import { damageReceiptLines } from './damageReceipt.js';
import { el, button } from '../kit/index.js';
import { openModal } from './modalShell.js';
import { t, tFull } from '../strings.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { openConsoleLog } from '../debuglog.js';
import { combatLogPalette } from '../models/CombatLogPaletteModel.js';

function appendEntryText(item, entry) {
  if (!Array.isArray(entry.segments) || entry.segments.length === 0) {
    item.textContent = entry.text;
    return;
  }
  for (const segment of entry.segments) {
    const text = typeof segment?.text === 'string' ? segment.text : '';
    const side = segment?.id != null && (segment.side === 'player' || segment.side === 'enemy')
      ? segment.side : null;
    item.append(el('span', side
      ? { class: 'combat-log-actor', 'data-combat-log-side': side, text }
      : { text }));
  }
}

/** Draw the public log into `container`, grouped by round. The drawer and the door share this face. */
export function renderCombatLogEntries(container, entries, { detailed = false, palette: settings = {}, legend = false } = {}) {
  const palette = combatLogPalette(settings);
  container.setAttribute('style', `--combat-log-player-color:${palette.player};--combat-log-enemy-color:${palette.enemy}`);
  const nodes = [];
  if (legend) {
    const roleLegend = el('div', { class: 'combat-log-role-legend', 'aria-label': t('combat.log.roles') });
    for (const side of ['player', 'enemy']) {
      const role = el('span', { class: `combat-log-role combat-log-role--${side}` });
      role.append(el('span', { class: 'combat-log-role-swatch', 'aria-hidden': 'true' }),
        el('span', { text: t(`combat.log.role.${side}`) }));
      roleLegend.append(role);
    }
    nodes.push(roleLegend);
  }
  let round, items = null;
  for (const entry of entries) {
    if (entry.round !== round) {
      round = entry.round;
      items = el('ol', {});
      nodes.push(el('h3', { text: t('combat.log.round', { round }) }), items);
    }
    const item = el('li', {});
    appendEntryText(item, entry);
    if (detailed) {
      const lines = damageReceiptLines(entry.damageReceipt);
      if (lines.length) item.append(el('div', { class: 'combat-log-calculation', text: lines.join('\n') }));
    }
    items.append(item);
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
export function openCombatLogModal({ entries = [], opener = document.activeElement, onClose = null, detailed = true, palette = {}, showConsole = false } = {}) {
  const list = el('div', { class: 'combat-log-modal-entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  let currentEntries = entries;
  renderCombatLogEntries(list, entries, { detailed, palette, legend: true });
  const detailButton = button({ label: detailed ? 'Compact log' : 'Full detail', attrs: { 'aria-pressed': String(detailed) } });
  detailButton.addEventListener('click', () => {
    detailed = !detailed;
    detailButton.textContent = detailed ? 'Compact log' : 'Full detail';
    detailButton.setAttribute('aria-pressed', String(detailed));
    renderCombatLogEntries(list, currentEntries, { detailed, palette, legend: true });
  });
  const consoleButton = button({ label: 'Console', attrs: { 'aria-haspopup': 'dialog', 'data-console-shortcut': '' } });
  let consoleModal = null;
  consoleButton.addEventListener('click', () => {
    if (!consoleModal) consoleModal = openConsoleLog({ opener: consoleButton, onClose: () => { consoleModal = null; } });
  });
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
    titleId: 'combat-log-modal-title', body: list, secondary: [closeButton, detailButton, consoleButton], opener: openerRef, onClose: () => { consoleModal?.close(); onClose?.(); },
  });
  let consoleEnabled = null;
  const setConsoleEnabled = enabled => {
    if (consoleEnabled === !!enabled) return;
    consoleEnabled = !!enabled;
    consoleButton.hidden = !enabled;
    modal.foot.querySelector('.modal-foot-actions').dataset.actionCount = enabled ? '3' : '2';
  };
  setConsoleEnabled(showConsole);
  markUiComponent(modal.panel, UI.combatLogModal);
  // Reading the log must not skip the attack that is playing: fx.js's
  // click-to-skip ignores anything under [data-combat-read-only].
  modal.veil.setAttribute('data-combat-read-only', '');
  closeButton.addEventListener('click', () => modal.close());
  modal.body.scrollTop = modal.body.scrollHeight;
  return Object.freeze({
    panel: modal.panel,
    setConsoleEnabled,
    setEntries(next, nextPalette = palette) {
      const { body } = modal;
      const atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 4;
      currentEntries = next;
      palette = nextPalette;
      renderCombatLogEntries(list, next, { detailed, palette, legend: true });
      if (atEnd) body.scrollTop = body.scrollHeight;
    },
    /** Closing returns focus to `node` from now on (the button a remount just drew). */
    setOpener(node) { currentOpener = node; },
    close: () => modal.close(),
  });
}
