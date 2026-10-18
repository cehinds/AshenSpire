import { tagSymbolSvg } from './cardTagSymbols.js';
import { combatHealthModel } from '../models/CombatHealthModel.js';
import { t, tFull } from '../strings.js';
import { attachTooltip, esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

// Keep the shared resource renderer's HP amount, fill and total trough length.
// Badges use space inside that length; removing one gives it back to health.
// Poise has a gold numeric badge and retains the HP trim, tooltip and aria-label.
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
  // The fill's colour: the highest layer still standing (see healthGuardTone). Poise trims the bar in gold while it lasts.
  hp.dataset.guard = model.guard;
  hp.dataset.poised = String(model.poised);
  const healthValue = hp.querySelector('.m-value');
  if (healthValue) {
    // Narrow phone lanes show current HP; the full fraction remains the
    // accessible label, tooltip, and wide-layout text.
    healthValue.dataset.currentHp = healthValue.textContent.split('/')[0].trim();
    healthValue.setAttribute('aria-label', model.poiseLabel ? `${healthValue.textContent}. ${model.poiseLabel}` : healthValue.textContent);
  }
  if (tooltips && model.poised) {
    hp.tabIndex = 0;
    attachTooltip(hp, () => `<div class="tt-title">${esc(model.poiseLabel)}</div>${esc(tFull('combat.protection.poise'))}`);
  }
  for (const badge of model.badges) {
    const node = document.createElement('span');
    node.className = `combat-health-badge combat-health-${badge.kind}${badge.barrier > 0 ? ' combat-health-ward-barrier' : ''}`;
    if (badge.barrier > 0) node.dataset.barrier = String(badge.barrier);
    node.dataset.defenseKind = badge.kind;
    node.setAttribute('aria-label', `${badge.label} ${badge.value}`);
    const value = document.createElement('span');
    value.className = 'combat-health-badge-value';
    value.textContent = String(badge.value);
    if (badge.kind === 'evade') {
      const icon = document.createElement('span');
      icon.className = 'combat-health-evade-icon';
      icon.setAttribute('aria-hidden', 'true');
      const mark = tagSymbolSvg('effect:evade');
      if (mark) icon.append(mark);
      node.append(icon);
    }
    node.append(value);
    markUiComponent(node, UI.blockBadge, badge.kind);
    if (tooltips) {
      node.tabIndex = 0;
      attachTooltip(node, () => `<div class="tt-title">${esc(badge.label)} ${badge.value}${badge.barrier > 0 ? ` (${esc(t('combat.protection.barrier'))} ${badge.barrier})` : ''}</div>${esc(badge.kind === 'shield' ? blockHelp : badge.kind === 'evade' ? 'Evasion rating, including active Evade stacks.' : badge.kind === 'poise' ? tFull('combat.protection.poise') : wardHelp)}${badge.barrier > 0 ? `<br>${esc(tFull('combat.protection.barrier'))}` : ''}${badge.wardBlock > 0 ? `<br>${esc(t('combat.protection.wardBlock'))} ${badge.wardBlock}: ${esc(tFull('combat.protection.wardBlock'))}` : ''}`);
    }
    row.append(node);
  }
  row.append(hp);
  return row;
}
