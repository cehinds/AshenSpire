import { presentationConfig } from '../../model/advancedConfig.js';
import { armHold, holdMs } from './holdconfirm.js';
import { openConfirmationModal } from './confirmationModal.js';
import { veilIsOpen } from './veil.js';
import { t } from '../strings.js';

// refresh() runs on every selection and visits every grid cell; writing a
// value the node already holds still dirties style, so compare first.
const setAttr = (node, name, value) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const setClass = (node, name, on) => { if (node.classList.contains(name) !== on) node.classList.toggle(name, on); };

export function wireFormationMovement(field, { readSettings, holdConfig, available, plan, move }) {
  const grid = field.querySelector('.formation-grid');
  const tiles = [...grid.querySelectorAll('.formation-grid-cell')];
  const tray = document.createElement('div');
  tray.className = 'formation-move-controls'; tray.hidden = true;
  const confirm = document.createElement('button');
  confirm.type = 'button'; confirm.dataset.formationMove = '';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = t('common.cancel');
  tray.append(confirm, cancel); field.append(tray);
  let selected = null;
  let released = false;
  // One reading per refresh pass. The pass asks for the config per tile and per
  // hold control (seventy-odd times) and nothing in it can change the settings,
  // so it reads them once; outside a pass every call reads them fresh.
  let passConfig = null;
  const config = () => passConfig || presentationConfig(readSettings());
  const duration = key => config()[key] === 'hold' ? holdMs(readSettings(), holdConfig) : 0;
  const usable = (cell, fromReview = false) => field.isConnected && tiles.some(tile => tile.dataset.cell === cell && !tile.hidden) && (!veilIsOpen() || fromReview) && available() && plan(cell).ok
    && !tiles.some(tile => tile.dataset.cell === cell && tile.dataset.occupied === 'true');
  const commit = (cell, fromReview = false) => {
    if (!usable(cell, fromReview)) { selected = null; refresh(); return; }
    selected = null; move(cell); refresh();
  };
  const review = (cell, control) => {
    if (!usable(cell)) return;
    selected = cell;
    refresh();
    openConfirmationModal({ title: `Move to ${cell}?`,
      message: plan(cell).cost ? 'Move to this position for 1 action.' : 'Move to this position for free.',
      confirmLabel: t('formation.move.confirm'), cancelLabel: t('common.cancel'), returnFocusElement: control,
      onConfirm: () => commit(cell, true), onCancel: () => { selected = null; refresh(); },
    });
  };
  const activate = tile => {
    const cell = tile.dataset.cell;
    if (!usable(cell)) return;
    if (!config().movementNeedsSelection) return commit(cell);
    selected = selected === cell ? null : cell; refresh();
  };
  const releases = tiles.map(tile => armHold(tile, {
    ms: () => duration('tileActivation'), showHint: false,
    tapOnEarlyRelease: true,
    onConfirm: () => config().tileActivation === 'hold' ? commit(tile.dataset.cell) : activate(tile),
    onTap: () => config().tileActivation === 'hold' ? review(tile.dataset.cell, tile) : activate(tile),
  }));
  releases.push(armHold(confirm, { ms: () => duration('moveActivation'), onConfirm: () => commit(selected),
    tapOnEarlyRelease: true, onTap: () => config().moveActivation === 'hold' ? review(selected, confirm) : commit(selected) }));
  cancel.addEventListener('click', () => { selected = null; refresh(); });
  const escape = event => { if (event.key === 'Escape') { selected = null; refresh(); } };
  field.addEventListener('keydown', escape);
  field.addEventListener('formationlayoutchange', refresh);
  function refresh() {
    if (released) return;
    passConfig = presentationConfig(readSettings());
    try { refreshPass(); } finally { passConfig = null; }
  }
  function refreshPass() {
    const enabled = config().movementEnabled;
    if (!enabled || !config().movementNeedsSelection || (selected && !usable(selected))) selected = null;
    setAttr(grid, 'aria-hidden', String(!enabled));
    const holdLabel = config().tileActivation === 'hold' ? '. Hold to move; release to review.' : '';
    for (const tile of tiles) {
      const disabled = !enabled || !usable(tile.dataset.cell);
      if (tile.disabled !== disabled) tile.disabled = disabled;
      const tabIndex = disabled ? -1 : 0;
      if (tile.tabIndex !== tabIndex) tile.tabIndex = tabIndex;
      setAttr(tile, 'aria-label', `Position ${tile.dataset.cell}${holdLabel}`);
      setAttr(tile, 'aria-pressed', String(selected === tile.dataset.cell));
      setClass(tile, 'formation-selected', selected === tile.dataset.cell);
    }
    const trayHidden = !selected;
    if (tray.hidden !== trayHidden) tray.hidden = trayHidden;
    const confirmDisabled = !selected || !usable(selected);
    if (confirm.disabled !== confirmDisabled) confirm.disabled = confirmDisabled;
    if (selected) {
      const label = `Move to ${selected}${plan(selected).cost ? ' · 1 action' : ' · free'}`;
      if (confirm.textContent !== label) confirm.textContent = label;
    }
    for (const release of releases) release.refresh();
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-formation-settings'] });
  observer.observe(document.body, { childList: true });
  refresh();
  return { refresh, release() { released = true; observer.disconnect(); releases.forEach(release => release()); field.removeEventListener('keydown', escape); field.removeEventListener('formationlayoutchange', refresh); tray.remove(); } };
}
