import { tagSymbolSvg } from './cardTagSymbols.js';
import { setAttr, setData, setStyle } from '../domWrite.js';
import { combatHealthModel, visibleBadges } from '../models/CombatHealthModel.js';
import { t, tFull } from '../strings.js';
import { attachTooltip, esc } from './tooltip.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

// The combat HUD's one layout for every combatant (owner, 2026-11-07, backlog #11/#4/#5/#6): a Block shield on the
// left, as tall as the HP and Poise rows (its slot is reserved at Block 0), then three stacked rows: the HP bar (number to its right), the Poise bar (the
// same width and height) and one badge row. The badge row holds every badge kind and the combatant's status tray, so
// buffs, Precision, Evade, Ward, Counter and Reflect are one family of round count badges. The row's width is a layout
// token (`--hud-mini-bar-width`), never a function of max HP, Block or badge count.
/** The badge tooltip's HTML; supplied holder text overrides generic Evade or Core Precision wording. */
export function badgeTipHtml(badge, { blockHelp, poiseHelp, wardHelp, evadeHelp = null, precisionHelp = null }) {
  // The +N overflow badge lists the hidden badges, each as "label value" (the same text its own aria-label would carry).
  if (badge.kind === 'overflow') return `<div class="tt-title">${esc(badge.label)}</div>${badge.names.map(esc).join('<br>')}`;
  return `<div class="tt-title">${esc(badge.label)} ${badge.value}${badge.barrier > 0 ? ` (${esc(t('combat.protection.barrier'))} ${badge.barrier})` : ''}</div>${esc(badge.kind === 'shield' ? blockHelp : badge.help ? badge.help : badge.kind === 'evade' ? (evadeHelp || 'Active Evasion stacks. Each stack contributes to the attack roll defense.') : badge.kind === 'precision' ? (precisionHelp || tFull('card.tags.precision')) : badge.kind === 'poise' ? poiseHelp : wardHelp)}${badge.barrier > 0 ? `<br>${esc(tFull('combat.protection.barrier'))}` : ''}${badge.wardBlock > 0 ? `<br>${esc(t('combat.protection.wardBlock'))} ${badge.wardBlock}: ${esc(tFull('combat.protection.wardBlock'))}` : ''}`;
}
// The kinds a persistent row holds a node for, in the order the model lists them.
// Owner 2026-11-07: Poise is a plain bar row under HP (no Poise badge, no HP-bar overlay or trim); AC is not drawn.
const BADGE_KINDS = Object.freeze(['shield', 'evade', 'ward', 'precision', 'counter', 'reflect']);
export function combatHealthRow(hp, values, { tooltips = true, blockHelp = tFull('combat.protection.block'), wardHelp = tFull('combat.protection.ward'), poiseHelp = tFull('combat.protection.poise'), evadeHelp = null, precisionHelp = null, persistent = false, poise = null, statuses = null } = {}) {
  if (!hp) return null;
  const model = combatHealthModel(values);
  const row = document.createElement('div');
  row.className = 'combat-health-row';
  row.dataset.meterRow = 'hp';
  row.dataset.defense = String(model.shield);
  row.dataset.ward = String(model.ward);
  // The row's width is a layout token, not the max-HP trough length: the HP and Poise bars fill the same fixed column.
  const track = hp.querySelector('.m-track');
  setStyle(track, 'width', '');
  const poiseTrack = poise?.querySelector('.m-track');
  if (poiseTrack) setStyle(poiseTrack, 'width', '');
  const poiseWell = poise?.querySelector('.m-well'); if (poiseWell) setStyle(poiseWell, 'width', '');
  const hpWell = hp.querySelector('.m-well'); if (hpWell) setStyle(hpWell, 'width', '');
  if (!hp.classList.contains('combat-health-meter')) hp.classList.add('combat-health-meter');
  setData(hp, 'protected', model.protected);
  setData(hp, 'warded', model.warded);
  // The fill's colour: the highest layer still standing (see healthGuardTone). No Poise trim or overlay on the HUD (owner 2026-11-07).
  setData(hp, 'guard', model.guard);
  setData(hp, 'poised', 'false');
  setData(hp, 'wardActive', model.wardActive);
  const healthValue = hp.querySelector('.m-value');
  if (healthValue) {
    // Narrow phone lanes show current HP; the full fraction remains the
    // accessible label, tooltip, and wide-layout text.
    setData(healthValue, 'currentHp', healthValue.textContent.split('/')[0].trim());
    setAttr(healthValue, 'aria-label', healthValue.textContent);
  }
  const { shown, overflow } = visibleBadges(model.badges.filter(badge => badge.kind !== 'poise'));
  // Owner (2026-11-06): a HUD row (`persistent`) carries one node for every badge kind, in a fixed order, and a kind with
  // nothing to show is a hidden `placeholder`. A badge appearing or going then writes an attribute and a number; it adds or removes no node.
  const slots = persistent ? [...BADGE_KINDS.map(kind => shown.find(badge => badge.kind === kind) || { kind, label: '', value: 0, placeholder: true }),
    overflow || { kind: 'overflow', label: '', value: '', names: [], text: '', placeholder: true }] : (overflow ? [...shown, overflow] : shown);
  // Block is the tall shield left of the bars (every combatant); the other badges and the status tray share the badge row.
  let shieldNode = null;
  const badges = document.createElement('div');
  badges.className = 'combat-health-badges';
  for (const badge of slots) {
    const node = document.createElement('span');
    node.className = `combat-health-badge combat-health-${badge.kind}${badge.ward ? ' combat-health-poise-ward' : ''}`;
    if (badge.ward) node.dataset.ward = String(badge.wardStacks);
    node.dataset.defenseKind = badge.kind;
    // The +N overflow stands for several effects; a squeezed row counts all of them, not the one node.
    if (badge.kind === 'overflow') node.dataset.count = String(badge.count || 0);
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
      attachTooltip(node, () => badgeTipHtml(badge, { blockHelp, poiseHelp, wardHelp, evadeHelp, precisionHelp }));
    }
    if (badge.kind === 'shield') {
      node.classList.add('combat-health-block-slot');
      shieldNode = node;
    } else badges.append(node);
  }
  if (statuses) badges.append(statuses);
  // The meters stay direct children of the row so their row-scoped styling still applies.
  if (shieldNode) row.append(shieldNode);
  row.append(hp);
  if (poise) { poise.classList.add('combat-health-poise-bar'); row.append(poise); }
  row.append(badges);
  return row;
}

/**
 * Draws Bonus Poise on a Poise meter (owner, 2026-11-15): the number reads "8/8" in yellow followed by "+5" in blue, and the bonus part of the
 * bar is a blue segment past the base maximum. `view` is PoiseBonusView(pool); the meter was drawn from the pool's full max, so the segment
 * sits at base/max of the track. Idempotent.
 */
export function ApplyPoiseBonus(meter, view) {
  if (!meter || !view) return;
  meter.dataset.bonus = String(view.bonus);
  const track = meter.querySelector('.m-track');
  if (track && !track.querySelector('.m-bonus-seg') && view.max > 0) {
    const seg = document.createElement('span');
    seg.className = 'm-bonus-seg';
    seg.setAttribute('aria-hidden', 'true');
    const from = `${Math.round(1000 * view.base / view.max) / 10}%`, width = `${Math.round(1000 * view.bonus / view.max) / 10}%`;
    seg.dataset.from = from; seg.dataset.width = width;
    seg.style.setProperty('--bonus-from', from);
    seg.style.setProperty('--bonus-width', width);
    track.append(seg);
  }
  const value = meter.querySelector('.m-value');
  if (value) {
    const label = t('combat.protection.poiseBonusAria', { value: view.shown, max: view.base, bonus: view.bonus });
    value.textContent = `${view.shown}/${view.base}`;
    const extra = document.createElement('span');
    extra.className = 'm-bonus';
    extra.textContent = ` +${view.bonus}`;
    value.append(extra);
    value.setAttribute('aria-label', label);
  }
  meter.setAttribute('aria-label', t('combat.protection.poiseBonusAria', { value: view.shown, max: view.base, bonus: view.bonus }));
}

/**
 * Draws the Ward health buffer on an HP meter (owner, 2026-11-24): the number reads "hp/maxHp" followed by "+N" in purple,
 * and the Ward part of the bar is a purple segment immediately after current HP. Idempotent.
 */
export function ApplyHealthWard(meter, view) {
  if (!meter || !view) return;
  meter.dataset.wardBonus = String(view.ward);
  const fill = meter.querySelector('.m-fill');
  if (fill) setStyle(fill, 'width', `${view.hpPct}%`);
  const track = meter.querySelector('.m-track');
  if (track && view.totalMax > 0) {
    let seg = track.querySelector('.m-ward-seg');
    if (!seg) {
      seg = document.createElement('span');
      seg.className = 'm-ward-seg';
      seg.setAttribute('aria-hidden', 'true');
      track.append(seg);
    }
    const from = `${view.wardFromPct}%`, width = `${view.wardWidthPct}%`;
    seg.dataset.from = from;
    seg.dataset.width = width;
    seg.style.setProperty('--ward-from', from);
    seg.style.setProperty('--ward-width', width);
  }
  const value = meter.querySelector('.m-value');
  const label = t('combat.protection.hpWardAria', { hp: view.hp, maxHp: view.maxHp, ward: view.ward });
  if (value) {
    value.textContent = `${view.hp}/${view.maxHp}`;
    const extra = document.createElement('span');
    extra.className = 'm-ward-bonus';
    extra.textContent = ` +${view.ward}`;
    value.append(extra);
    setAttr(value, 'aria-label', label);
    setData(value, 'currentHp', String(view.hp));
  }
  setAttr(meter, 'aria-label', label);
}
