import { presentationConfig } from '../../model/advancedConfig.js';
import { armHold, holdMs } from './holdconfirm.js';
import { openConfirmationModal } from './confirmationModal.js';
import { veilIsOpen } from './veil.js';

export function wireFormationMovement(field, { readSettings, holdConfig, available, plan, move }) {
  const grid = field.querySelector('.formation-grid');
  const tiles = [...grid.querySelectorAll('.formation-grid-cell')];
  const tray = document.createElement('div');
  tray.className = 'formation-move-controls'; tray.hidden = true;
  const confirm = document.createElement('button');
  confirm.type = 'button'; confirm.dataset.formationMove = '';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = 'Cancel';
  tray.append(confirm, cancel); field.append(tray);
  let selected = null;
  let released = false;
  const config = () => presentationConfig(readSettings());
  const duration = key => config()[key] === 'hold' ? holdMs(readSettings(), holdConfig) : 0;
  const usable = (cell, fromReview = false) => field.isConnected && (!veilIsOpen() || fromReview) && available() && plan(cell).ok
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
      confirmLabel: 'Move', cancelLabel: 'Cancel', returnFocusElement: control,
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
  function refresh() {
    if (released) return;
    const enabled = config().movementEnabled;
    if (!enabled || !config().movementNeedsSelection || (selected && !usable(selected))) selected = null;
    grid.setAttribute('aria-hidden', String(!enabled));
    for (const tile of tiles) {
      tile.disabled = !enabled || !usable(tile.dataset.cell);
      tile.tabIndex = tile.disabled ? -1 : 0;
      tile.setAttribute('aria-label', `Position ${tile.dataset.cell}${config().tileActivation === 'hold' ? '. Hold to move; release to review.' : ''}`);
      tile.setAttribute('aria-pressed', String(selected === tile.dataset.cell));
      tile.classList.toggle('formation-selected', selected === tile.dataset.cell);
    }
    tray.hidden = !selected;
    confirm.disabled = !selected || !usable(selected);
    if (selected) confirm.textContent = `Move to ${selected}${plan(selected).cost ? ' · 1 action' : ' · free'}`;
    for (const release of releases) release.refresh();
  }
  const observer = new MutationObserver(refresh);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-formation-settings'] });
  observer.observe(document.body, { childList: true });
  refresh();
  return { refresh, release() { released = true; observer.disconnect(); releases.forEach(release => release()); field.removeEventListener('keydown', escape); tray.remove(); } };
}
