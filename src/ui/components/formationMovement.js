import { presentationConfig } from '../../model/advancedConfig.js';
import { armHold, holdMs } from './holdconfirm.js';

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
  const usable = cell => available() && plan(cell).ok
    && !tiles.some(tile => tile.dataset.cell === cell && tile.dataset.occupied === 'true');
  const commit = cell => {
    if (!usable(cell)) { selected = null; refresh(); return; }
    selected = null; move(cell); refresh();
  };
  const releases = tiles.map(tile => armHold(tile, {
    ms: () => duration('tileActivation'), showHint: false,
    onConfirm: () => {
      const cell = tile.dataset.cell;
      if (!usable(cell)) return;
      if (!config().movementNeedsSelection) return commit(cell);
      selected = selected === cell ? null : cell; refresh();
    },
  }));
  releases.push(armHold(confirm, { ms: () => duration('moveActivation'), onConfirm: () => commit(selected) }));
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
  refresh();
  return { refresh, release() { released = true; observer.disconnect(); releases.forEach(release => release()); field.removeEventListener('keydown', escape); tray.remove(); } };
}
