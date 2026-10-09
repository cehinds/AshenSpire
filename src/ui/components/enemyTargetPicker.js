import { tFull } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom } from '../fx.js';
import { enemyTargetGrid } from '../models/EnemyTargetGridModel.js';
import { currentSpriteArtBounds } from './combatSpriteGeometry.js';
import { focusElement } from '../input.js';

// Placement follows fitted figures without intercepting inspection controls.
function watchTargetPlacement(host, picker) {
  let queued = null;
  let resize;
  let changes;
  const dispose = () => {
    if (queued != null) cancelAnimationFrame(queued);
    queued = null;
    resize?.disconnect();
    changes?.disconnect();
    picker.placement = null;
  };
  const place = () => {
    queued = null;
    if (!host.isConnected || picker.hidden) { dispose(); return; }
    const box = host.getBoundingClientRect();
    const zoom = uiZoom();
    const combat = host.closest('.combat');
    const localRect = rect => ({ left: rect.left - box.left, top: rect.top - box.top, width: rect.width, height: rect.height });
    const obstacles = [combat?.querySelector('.combat-hud'), host.querySelector('.turn-ribbon'),
      ...host.querySelectorAll('.combatant-leading, .meters')]
      .filter(Boolean).map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height).map(localRect);
    const playerRect = host.querySelector('.combatant.player .sprite')?.getBoundingClientRect();
    const hardObstacles = [playerRect,
      ...[...combat.querySelectorAll('.combat-tools, .combat-action-row button, .hand .card')].map(node=>node.getBoundingClientRect())]
      .filter(rect=>rect?.width && rect?.height).map(localRect);
    const targets = [...picker.children].map(button => {
      const figure = [...host.querySelectorAll('.combatant.enemy')].find(node => node.dataset.eid === button.dataset.eid);
      const sprite = figure?.querySelector('.sprite');
      const rect = sprite ? currentSpriteArtBounds(sprite, schedule) : figure?.getBoundingClientRect();
      return { id: button.dataset.eid, x: rect ? (rect.left + rect.right) / 2 - box.left : box.width / 2,
        y: rect ? (rect.top + rect.bottom) / 2 - box.top : box.height / 2 };
    });
    const geometry = { width: box.width, height: box.height, targets, obstacles, hardObstacles };
    const key = JSON.stringify(geometry, (_, value) => typeof value === 'number' ? Math.round(value * 4) / 4 : value);
    if (picker.placementKey === key) return;
    picker.placementKey = key;
    const placements = enemyTargetGrid(geometry);
    for (const placement of placements) {
      const button = [...picker.children].find(node => node.dataset.eid === placement.id);
      const local = anchorLocalBox(host, { left: box.left + placement.left, top: box.top + placement.top,
        width: placement.width, height: placement.height }, { zoom });
      Object.assign(button.style, { left: `${local.left}px`, top: `${local.top}px`, width: `${local.width}px`, height: `${local.height}px` });
    }
  };
  const schedule = () => { if (queued == null) queued = requestAnimationFrame(place); };
  if (globalThis.ResizeObserver) {
    resize = new ResizeObserver(schedule);
    resize.observe(host);
    resize.observe(picker);
  }
  changes = new MutationObserver(records => {
    if (records.some(record => !picker.contains(record.target))) schedule();
  });
  changes.observe(host, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
  picker.placement = { schedule, dispose };
  schedule();
}

// Sprite artwork may overlap without making a living enemy unreachable. This
// independent target grid uses the same legal IDs and command as the figures.
// Reuse its buttons so combat repaints do not discard keyboard focus.
export function renderEnemyTargetPicker(host, { targets = [], disabled = false, onActivate, onPreview } = {}) {
  let picker = host.querySelector(':scope > .enemy-target-picker');
  if (!picker && !targets.length) return null;
  if (!picker) {
    picker = document.createElement('div');
    picker.className = 'enemy-target-picker';
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', tFull('combat.enemyTarget.choose'));
    markUiComponent(picker, UI.enemyTargetPicker);
    host.appendChild(picker);
  }
  picker.hidden = !targets.length;
  const present = new Set(targets.map(target => target.id));
  for (const button of [...picker.children]) if (!present.has(button.dataset.eid)) button.remove();
  targets.forEach((target, index) => {
    let button = [...picker.children].find(node => node.dataset.eid === target.id);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'enemy-target-button';
      button.dataset.eid = target.id;
      button.dataset.focusable = '';
      button.innerHTML = '<span class="enemy-target-name"></span><span class="enemy-target-health"></span>';
      button.addEventListener('click', event => {
        event.stopPropagation();
        if (!button.disabled) picker.activate?.(button.dataset.eid);
      });
      for (const event of ['pointerenter', 'focus']) button.addEventListener(event, () => picker.preview?.(button.dataset.eid));
      button.addEventListener('focus', () => focusElement(button));
      for (const event of ['pointerleave', 'blur']) button.addEventListener(event, () => picker.preview?.(null));
      picker.appendChild(button);
    }
    button.disabled = disabled;
    button.dataset.number = String(index + 1);
    button.querySelector('.enemy-target-name').textContent = `${index + 1}. ${target.name}`;
    button.querySelector('.enemy-target-health').textContent = tFull('combat.enemyTarget.health', { hp: target.hp, maxHp: target.maxHp });
    button.setAttribute('aria-label', tFull('combat.enemyTarget.label', { number: index + 1, name: target.name, hp: target.hp, maxHp: target.maxHp }));
  });
  picker.activate = onActivate;
  picker.preview = onPreview;
  picker.placementKey = null;
  if (picker.hidden) picker.placement?.dispose();
  else if (picker.placement) picker.placement.schedule();
  else watchTargetPlacement(host, picker);
  return picker;
}
