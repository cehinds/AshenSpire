import { combatHealthModel } from '../models/CombatHealthModel.js';
import { tFull } from '../strings.js';
import { attachTooltip, esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

// Keep the shared resource renderer's HP amount, fill and total trough length.
// Badges use space inside that length; removing one gives it back to health.
export function combatHealthRow(hp, values, { tooltips = true, blockHelp = tFull('combat.protection.block'), wardHelp = tFull('combat.protection.ward') } = {}) {
  if (!hp) return null;
  const model = combatHealthModel(values);
  const row = document.createElement('div');
  row.className = 'combat-health-row';
  row.dataset.meterRow = 'hp';
  row.dataset.defense = String(model.shield);
  row.dataset.ward = String(model.ward);
  const track = hp.querySelector('.m-track');
  // The row retains max-HP/domain scaling. Its HP child fills only the space
  // left by live badges, keeping the right edge stable through shield breaks.
  row.style.width = track.style.width || '100%';
  track.style.width = '100%';
  hp.classList.add('combat-health-meter');
  hp.dataset.protected = String(model.protected);
  hp.dataset.warded = String(model.warded);
  const healthValue = hp.querySelector('.m-value');
  if (healthValue) {
    // Narrow phone lanes show current HP; the full fraction remains the
    // accessible label, tooltip, and wide-layout text.
    healthValue.dataset.currentHp = healthValue.textContent.split('/')[0].trim();
    healthValue.setAttribute('aria-label', healthValue.textContent);
  }
  for (const badge of model.badges) {
    const node = document.createElement('span');
    node.className = `combat-health-badge combat-health-${badge.kind}`;
    node.dataset.defenseKind = badge.kind;
    node.setAttribute('aria-label', `${badge.label} ${badge.value}`);
    const value = document.createElement('span');
    value.className = 'combat-health-badge-value';
    value.textContent = String(badge.value);
    node.append(value);
    markUiComponent(node, UI.blockBadge, badge.kind);
    if (tooltips) {
      node.tabIndex = 0;
      attachTooltip(node, () => `<div class="tt-title">${esc(badge.label)} ${badge.value}</div>${esc(badge.kind === 'shield' ? blockHelp : wardHelp)}`);
    }
    row.append(node);
  }
  row.append(hp);
  return row;
}
