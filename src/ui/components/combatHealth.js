import { tagSymbolSvg } from './cardTagSymbols.js';
import { combatHealthModel, visibleBadges } from '../models/CombatHealthModel.js';
import { t, tFull } from '../strings.js';
import { attachTooltip, esc } from './tooltip.js';
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
// The kinds a persistent row holds a node for, in the order the model lists them.
// Owner 2026-11-07: Poise and AC are hidden on the combat HUDs (the inspect panel still lists them).
const BADGE_KINDS = Object.freeze(['shield', 'evade', 'ward', 'precision', 'counter', 'reflect']);
export function combatHealthRow(hp, values, { tooltips = true, blockHelp = tFull('combat.protection.block'), wardHelp = tFull('combat.protection.ward'), poiseHelp = tFull('combat.protection.poise'), evadeHelp = null, persistent = false } = {}) {
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
  // The fill's colour: the highest layer still standing (see healthGuardTone). No Poise trim or overlay on the HUD (owner 2026-11-07).
  hp.dataset.guard = model.guard;
  hp.dataset.poised = 'false';
  hp.dataset.wardActive = String(model.wardActive);
  const healthValue = hp.querySelector('.m-value');
  if (healthValue) {
    // Narrow phone lanes show current HP; the full fraction remains the
    // accessible label, tooltip, and wide-layout text.
    healthValue.dataset.currentHp = healthValue.textContent.split('/')[0].trim();
    healthValue.setAttribute('aria-label', healthValue.textContent);
  }
  const { shown, overflow } = visibleBadges(model.badges.filter(badge => badge.kind !== 'poise'));
  // Owner (2026-11-06): a HUD row (`persistent`) carries one node for every badge kind, in a fixed order, and a kind with
  // nothing to show is a hidden `placeholder`. A badge appearing or going then writes an attribute and a number; it adds or removes no node.
  const slots = persistent ? [...BADGE_KINDS.map(kind => shown.find(badge => badge.kind === kind) || { kind, label: '', value: 0, placeholder: true }),
    overflow || { kind: 'overflow', label: '', value: '', names: [], text: '', placeholder: true }] : (overflow ? [...shown, overflow] : shown);
  // The player's Block (owner 2026-11-02) takes the square slot left of the bar (AC is no longer drawn, owner 2026-11-07); enemies (no `values.ac`) keep it in the stack.
  let blockSquare = null;
  for (const badge of slots) {
    const node = document.createElement('span');
    node.className = `combat-health-badge combat-health-${badge.kind}${badge.ward ? ' combat-health-poise-ward' : ''}`;
    if (badge.ward) node.dataset.ward = String(badge.wardStacks);
    node.dataset.defenseKind = badge.kind;
    // Only an empty persistent slot is hidden. (`badge.hidden` on the +N overflow is its list of summarized badges.)
    if (badge.placeholder) node.hidden = true;
    node.setAttribute('aria-label', badge.kind === 'overflow' ? badge.text : `${badge.label} ${badge.value}`);
    if (badge.help) node.title = badge.help; // native hover help for the stack badges, same text as the tooltip
    const value = document.createElement('span');
    value.className = 'combat-health-badge-value';
    value.textContent = String(badge.value);
    if (['evade', 'precision', 'counter', 'reflect'].includes(badge.kind)) {
      const icon = document.createElement('span');
      icon.className = `combat-health-${badge.kind}-icon`;
      icon.setAttribute('aria-hidden', 'true');
      const mark = tagSymbolSvg(`effect:${badge.glyph || badge.kind}`);
      if (mark) icon.append(mark);
      node.append(icon);
    }
    node.append(value);
    markUiComponent(node, UI.blockBadge, badge.kind);
    if (tooltips) {
      node.tabIndex = 0;
      attachTooltip(node, () => badgeTipHtml(badge, { blockHelp, poiseHelp, wardHelp, evadeHelp }));
    }
    if (values?.ac && badge.kind === 'shield') {
      node.classList.add('combat-health-block-slot');
      blockSquare = node;
    } else row.append(node);
  }
  // A sibling just before the meter, which stays a direct child of the row so its row-scoped styling still applies.
  if (blockSquare) row.append(blockSquare);
  row.append(hp);
  return row;
}
