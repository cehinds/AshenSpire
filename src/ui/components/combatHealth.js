import { tagSymbolSvg } from './cardTagSymbols.js';
import { combatHealthModel, visibleBadges } from '../models/CombatHealthModel.js';
import { t, tFull } from '../strings.js';
import { attachTooltip, esc } from './tooltip.js';
import { acBadgeText } from '../models/acBadge.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

// Keep the shared resource renderer's HP amount, fill and total trough length.
// Badges use space inside that length; removing one gives it back to health.
// Poise has a gold numeric badge and retains the HP trim, tooltip and aria-label.
/** The badge tooltip's HTML; the Evade badge shows the holder's own Evade text when given, else the generic line. */
export function badgeTipHtml(badge, { blockHelp, poiseHelp, wardHelp, evadeHelp = null }) {
  // The +N overflow badge lists the hidden badges, each as "label value" (the same text its own aria-label would carry).
  if (badge.kind === 'overflow') return `<div class="tt-title">${esc(badge.label)}</div>${badge.names.map(esc).join('<br>')}`;
  return `<div class="tt-title">${esc(badge.label)} ${badge.value}${badge.barrier > 0 ? ` (${esc(t('combat.protection.barrier'))} ${badge.barrier})` : ''}</div>${esc(badge.kind === 'shield' ? blockHelp : badge.help ? badge.help : badge.kind === 'evade' ? (evadeHelp || 'Active Evasion stacks. Each stack contributes to the attack roll defense.') : badge.kind === 'precision' ? tFull('card.tags.precision') : badge.kind === 'poise' ? poiseHelp : wardHelp)}${badge.barrier > 0 ? `<br>${esc(tFull('combat.protection.barrier'))}` : ''}${badge.wardBlock > 0 ? `<br>${esc(t('combat.protection.wardBlock'))} ${badge.wardBlock}: ${esc(tFull('combat.protection.wardBlock'))}` : ''}`;
}
export function combatHealthRow(hp, values, { tooltips = true, blockHelp = tFull('combat.protection.block'), wardHelp = tFull('combat.protection.ward'), poiseHelp = tFull('combat.protection.poise'), evadeHelp = null } = {}) {
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
    attachTooltip(hp, () => `<div class="tt-title">${esc(model.poiseLabel)}</div>${esc(poiseHelp)}`);
  }
  const { shown, overflow } = visibleBadges(model.badges);
  for (const badge of overflow ? [...shown, overflow] : shown) {
    const node = document.createElement('span');
    node.className = `combat-health-badge combat-health-${badge.kind}${badge.barrier > 0 ? ' combat-health-ward-barrier' : ''}`;
    if (badge.barrier > 0) node.dataset.barrier = String(badge.barrier);
    node.dataset.defenseKind = badge.kind;
    node.setAttribute('aria-label', badge.kind === 'overflow' ? badge.text : badge.kind === 'stance' ? badge.help : `${badge.label} ${badge.value}`);
    if (badge.help) node.title = badge.help; // native hover help for the stack badges, same text as the tooltip
    const value = document.createElement('span');
    value.className = 'combat-health-badge-value';
    value.textContent = String(badge.value);
    if (['evade', 'precision', 'counter', 'reflect', 'stance'].includes(badge.kind)) {
      const icon = document.createElement('span');
      icon.className = `combat-health-${badge.kind}-icon`;
      icon.setAttribute('aria-hidden', 'true');
      const mark = tagSymbolSvg(`effect:${badge.glyph || badge.kind}`);
      if (badge.tone) node.dataset.stance = badge.tone;
      if (mark) icon.append(mark);
      node.append(icon);
    }
    node.append(value);
    markUiComponent(node, UI.blockBadge, badge.kind);
    if (tooltips) {
      node.tabIndex = 0;
      attachTooltip(node, () => badgeTipHtml(badge, { blockHelp, poiseHelp, wardHelp, evadeHelp }));
    }
    row.append(node);
  }
  // The player's AC (owner 2026-11-01): a square left of the bar on the bar's line, with a small "AC" caption under it at the head
  // of the badge row. `values.ac` is { value, evade, base } from acFor; enemies never carry it.
  if (values?.ac) {
    const line = document.createElement('div');
    line.className = 'combat-health-bar-line';
    const text = acBadgeText(values.ac);
    const square = document.createElement('span');
    square.className = 'combat-health-badge combat-health-ac';
    square.dataset.defenseKind = 'ac';
    square.dataset.ac = String(values.ac.value);
    square.setAttribute('aria-label', [text.title, ...text.lines].join('. '));
    const number = document.createElement('span');
    number.className = 'combat-health-badge-value';
    number.textContent = String(values.ac.value);
    square.append(number);
    if (tooltips) {
      square.tabIndex = 0;
      attachTooltip(square, () => `<div class="tt-title">${esc(text.title)}</div>${text.lines.map(esc).join('<br>')}`);
    }
    const caption = document.createElement('span');
    caption.className = 'combat-health-badge combat-health-ac-caption';
    caption.dataset.defenseKind = 'ac-caption';
    caption.setAttribute('aria-hidden', 'true');
    caption.textContent = 'AC';
    row.insertBefore(caption, row.firstChild);
    line.append(square, hp);
    row.append(line);
    return row;
  }
  row.append(hp);
  return row;
}
