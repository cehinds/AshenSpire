import { tFull } from '../strings.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom } from '../fx.js';

// Overhead controls move with the fitted figures. Reserve a separate measured
// band for targets instead of trading target access for intent inspection.
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
    // Read the authored starting position anew so a resize may move the row
    // back up after an intent has left its former place.
    picker.style.removeProperty('top');
    const box = picker.getBoundingClientRect();
    if (!box.height) return;
    const zoom = uiZoom();
    const gap = parseFloat(getComputedStyle(picker).gap) * zoom;
    const combat = host.closest('.combat');
    const hud = combat?.querySelector('.combat-hud')?.getBoundingClientRect();
    const ribbon = host.querySelector('.turn-ribbon')?.getBoundingClientRect();
    let top = Math.max(box.top, hud ? hud.bottom + gap : box.top, ribbon ? ribbon.bottom + gap : box.top);
    const overheads = [...host.querySelectorAll('.combatant-leading')]
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height)
      .sort((a, b) => a.top - b.top);
    for (const rect of overheads) {
      if (top < rect.bottom + gap && top + box.height > rect.top - gap) top = rect.bottom + gap;
    }
    const local = anchorLocalBox(host, { left: box.left, top, width: box.width, height: box.height }, { zoom });
    picker.style.top = `${local.top}px`;
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
// independent target strip uses the same legal IDs and command as the figures.
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
      for (const event of ['pointerleave', 'blur']) button.addEventListener(event, () => picker.preview?.(null));
      picker.appendChild(button);
    }
    button.disabled = disabled;
    button.querySelector('.enemy-target-name').textContent = `${index + 1}. ${target.name}`;
    button.querySelector('.enemy-target-health').textContent = tFull('combat.enemyTarget.health', { hp: target.hp, maxHp: target.maxHp });
    button.setAttribute('aria-label', tFull('combat.enemyTarget.label', { number: index + 1, name: target.name, hp: target.hp, maxHp: target.maxHp }));
  });
  picker.activate = onActivate;
  picker.preview = onPreview;
  if (picker.hidden) picker.placement?.dispose();
  else if (picker.placement) picker.placement.schedule();
  else watchTargetPlacement(host, picker);
  return picker;
}
