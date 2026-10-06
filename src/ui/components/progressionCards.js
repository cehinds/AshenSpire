import { t } from '../strings.js';
import { resolveTooltipSettings } from '../../model/tooltipSettings.js';
import { el, button, openModal, prose, titleS } from '../kit/index.js';
import { primaryStatCards, classResourceGrid } from './creationCards.js';
import { renderStatAllocationCard } from './statAllocationCard.js';
import { attachTooltip, esc, hideTooltip, showTooltipFor } from './tooltip.js';
import { progressionStats } from '../models/ProgressionInspectionModel.js';
import { levelUpPlan, applyLevelUp } from '../../model/levelup.js';

export function progressionTip(node, text) {
  const content = () => `<div class="tt-title">${esc(typeof text === 'function' ? text() : text)}</div>`;
  attachTooltip(node, content, { intent: 'above', align: 'center', focusDelayMs: 0 });
  // A tap activates normally; a stationary touch hold explains without
  // activating. Scrolling and cancelled gestures never open a tooltip.
  let timer = null, origin = null, explained = false;
  const cancel = () => { clearTimeout(timer); timer = null; origin = null; };
  node.addEventListener('pointerdown', event => {
    cancel(); explained = false;
    if (event.pointerType !== 'touch') return;
    origin = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      if (node.isConnected && origin) { explained = true; showTooltipFor(node, content(), { intent: 'above', align: 'center' }); }
      timer = null;
    }, resolveTooltipSettings().hold);
  });
  node.addEventListener('pointermove', event => {
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) { cancel(); if (explained) hideTooltip(); }
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) node.addEventListener(type, cancel);
  node.addEventListener('pointercancel', () => { if (explained) hideTooltip(); explained = false; });
  node.addEventListener('contextmenu', event => { if (explained) event.preventDefault(); });
  node.addEventListener('click', event => {
    cancel();
    if (explained) { explained = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    hideTooltip();
  }, true);
  return node;
}

const summaryLine = rows => el('span', { class: 'progression-summary-line' }, rows.map(row =>
  el('span', {}, [el('span', { text: `${row.faceLabel || row.face.label}: ` }),
    el('strong', { text: String(row.value ?? row.face.value) })])));

export function openStatsInspection({ registries, run, settings = {}, opener }) {
  const { rows, attributes } = progressionStats(registries, run, settings);
  const grid = classResourceGrid(rows);
  grid.setAttribute('aria-label', t('progression.currentResources'));
  for (const node of grid.querySelectorAll('[data-stat]')) {
    const entry = rows.find(row => row.id === node.dataset.stat);
    node.tabIndex = 0;
    progressionTip(node, `${entry.label}: ${entry.formula || entry.value}`);
  }
  let shell;
  const back = button({ label: t('common.back') });
  back.addEventListener('click', () => shell.close());
  shell = openModal({ size: 'lg', title: t('progression.sheet'), eyebrow: registries.classes.get(run.class)?.name,
    className: 'progression-inspection', opener, showMenuButton: false, secondary: [back], onClose: hideTooltip,
    body: el('article', { class: 'as-pane cc-class-preview progression-stat-card' }, [
      titleS(t('progression.currentStats')), grid, prose(t('progression.sheet.note')),
      ...primaryStatCards(attributes),
    ]) });
  return shell;
}

export function characterStatsButton({ registries, run, settings = {} }) {
  const { rows } = progressionStats(registries, run, settings);
  const node = el('button', { type: 'button', class: 'progression-summary progression-sheet-button', 'aria-haspopup': 'dialog' }, [
    el('span', { class: 'progression-banner-title', text: t('progression.sheet') }), summaryLine(rows),
  ]);
  progressionTip(node, 'Inspect character stats');
  node.addEventListener('click', () => openStatsInspection({ registries, run, settings, opener: node }));
  return node;
}

export function openProgressionAllocation({ registries, run, settings = {}, onChange }) {
  const plan = levelUpPlan(registries, run);
  if (!plan.offerable) return null;
  const pending = Object.fromEntries(plan.attributes.map(attr => [attr.id, 0]));
  const count = () => Object.values(pending).reduce((sum, value) => sum + value, 0);
  let allocation;
  const spec = () => {
    const preview = { ...run, attributes: Object.fromEntries(plan.attributes.map(attr => [attr.id, run.attributes[attr.id] + pending[attr.id]])) };
    const cards = progressionStats(registries, preview, settings).attributes;
    return { remaining: plan.points - count(), doneDisabled: !count(), rows: plan.attributes.map(attr => ({
      id: attr.id, label: attr.label, value: preview.attributes[attr.id], card: cards.find(card => card.id === attr.id),
      canDecrease: pending[attr.id] > 0, canIncrease: count() < plan.points,
    })) };
  };
  allocation = renderStatAllocationCard(document.body, { ...spec(), modal: true, title: t('reward.level.button'),
    note: t('progression.allocate.note'),
    onIncrease: id => { if (count() < plan.points) { pending[id]++; allocation.update(spec()); } },
    onDecrease: id => { if (pending[id]) { pending[id]--; allocation.update(spec()); } },
    onCancel: () => allocation.close(),
    onClose: hideTooltip,
    onDone: () => {
      if (!count() || count() > levelUpPlan(registries, run).points) return;
      for (const attr of plan.attributes) for (let n = 0; n < pending[attr.id]; n++) applyLevelUp(registries, run, attr.id);
      allocation.close();
      onChange?.();
    },
  });
  return allocation;
}

export function attributesCard({ registries, run, settings = {}, onChange = null }) {
  const { attributes } = progressionStats(registries, run, settings);
  const points = levelUpPlan(registries, run).points;
  const reveal = el('div', { class: 'progression-attributes-detail', hidden: true }, [
    prose(t('progression.attribute.note')),
    ...primaryStatCards(attributes),
  ]);
  const expand = el('button', { type: 'button', class: 'progression-attributes-toggle', 'aria-expanded': 'false' }, [
    el('span', { class: 'progression-banner-title', text: t('progression.attributes') }), summaryLine(attributes),
  ]);
  progressionTip(expand, () => reveal.hidden ? 'Expand all attributes' : 'Collapse attributes');
  expand.addEventListener('click', () => { reveal.hidden = !reveal.hidden; expand.setAttribute('aria-expanded', String(!reveal.hidden)); });
  const assign = el('button', { type: 'button', class: `progression-points${points && onChange ? ' available' : ''}`,
    text: `${points} ${points === 1 ? 'point' : 'points'} available`, 'aria-disabled': !points || !onChange ? 'true' : 'false', 'aria-haspopup': 'dialog' });
  progressionTip(assign, !onChange ? 'Attribute allocation is unavailable here' : points ? 'Open level up to assign your attribute points' : 'Earn attribute points by claiming level rewards');
  assign.addEventListener('click', () => { if (points && onChange) openProgressionAllocation({ registries, run, settings, onChange }); });
  return el('section', { class: 'progression-summary progression-attributes' }, [
    el('div', { class: 'progression-attributes-banner' }, [expand, assign]), reveal,
  ]);
}
