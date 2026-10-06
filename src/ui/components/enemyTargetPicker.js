import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

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
    picker.setAttribute('aria-label', 'Choose an enemy target');
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
    button.querySelector('.enemy-target-health').textContent = `${target.hp}/${target.maxHp} HP`;
    button.setAttribute('aria-label', `Target ${index + 1}: ${target.name}, ${target.hp} of ${target.maxHp} HP`);
  });
  picker.activate = onActivate;
  picker.preview = onPreview;
  return picker;
}
