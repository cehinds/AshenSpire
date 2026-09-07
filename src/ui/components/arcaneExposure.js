// Pure projection and renderer for host-owned per-enemy Arcane Exposure state.
// It never derives carriers, applies damage, or mutates a meter.

import { esc, attachTooltip } from './tooltip.js';
import { meter, pill, glyph, statusText } from '../kit/index.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

const EVENT_TYPES = new Set(['arcaneExposureChanged', 'arcaneExposureRefused', 'arcaneBreak']);

export function arcaneExposureReceipt(registries, enemySnapshot, recentEvents = []) {
  const state = enemySnapshot && enemySnapshot.arcaneExposure;
  if (!state) return null;
  const label = registries.balance.arcaneExposure.label;
  const event = [...(recentEvents || [])].reverse().find((row) => (
    EVENT_TYPES.has(row.type) && row.targetId === enemySnapshot.id
  )) || null;
  if (state.mode === 'immune') {
    return {
      mode: 'immune', label, badge: 'Immune', glyph: '✧',
      tooltip: `${label} buildup is refused for this enemy.`,
      event: event ? { ...event } : null,
    };
  }
  if (state.mode !== 'configured') return null;
  const value = Number.isFinite(state.value) ? state.value : 0;
  const threshold = state.threshold;
  const percent = threshold > 0 ? value / threshold * 100 : 0;
  const vulnerable = enemySnapshot.statuses && enemySnapshot.statuses.magicVulnerable;
  const locked = state.lockPolicy === 'whileMagicVulnerable'
    && Boolean(vulnerable && vulnerable.stacks > 0);
  const status = vulnerable && vulnerable.stacks > 0 ? {
    id: 'magicVulnerable',
    label: registries.frameworkTerms.withStatusWords(registries.statuses.get('magicVulnerable')).name,
    value: vulnerable.stacks,
    duration: vulnerable.duration,
  } : null;
  return {
    mode: 'configured', label, glyph: '✧', value, threshold,
    percent, fillPercent: Math.max(0, Math.min(100, percent)),
    locked, status, event: event ? { ...event } : null,
    tooltip: `${value} / ${threshold}${locked ? ' · Locked while Magic Vulnerable is active.' : ''}`,
  };
}

function eventHtml(event, registries) {
  if (!event) return '';
  if (event.type === 'arcaneBreak') {
    const status = registries.frameworkTerms.withStatusWords(registries.statuses.get(event.status));
    return `<div class="arcane-exposure-event arcane-break-receipt"><b>Break</b> · ${esc(status.name)} ${event.value}% · ${event.duration} turns</div>`;
  }
  if (event.type === 'arcaneExposureRefused') {
    return `<div class="arcane-exposure-event arcane-refusal-receipt"><b>Refused</b> · ${esc(event.reason)} · ${esc(event.school)} ${event.attempted}</div>`;
  }
  return '';
}

export function renderArcaneExposure(registries, enemySnapshot, recentEvents = [], { tooltips = true } = {}) {
  const receipt = arcaneExposureReceipt(registries, enemySnapshot, recentEvents);
  if (!receipt) return null;
  const el = document.createElement('div');
  if (receipt.mode === 'immune') {
    // Immune is a StatePill: a state, scannable, in the gold tone.
    el.className = 'arcane-exposure-immune';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${receipt.label} — ${receipt.badge}`);
    const chip = pill({ label: `${receipt.label} — ${receipt.badge}`, attrs: { dataset: { tone: 'gold' } } });
    chip.prepend(glyph(receipt.glyph, { class: 'arcane-exposure-glyph' }));
    el.appendChild(chip);
    const immuneEvent = eventHtml(receipt.event, registries);
    if (immuneEvent) el.insertAdjacentHTML('beforeend', immuneEvent);
    markUiComponent(el, UI.arcaneExposureBar, 'immune');
    if (tooltips) attachTooltip(el, () => esc(receipt.tooltip));
    return el;
  }
  // The exposure meter is the kit's Meter: its glyph and name on the plate, its
  // value beside them, the build-up as the fill. Locked dims the whole meter.
  el.className = `arcane-exposure-meter${receipt.locked ? ' locked' : ''}`;
  markUiComponent(el, UI.arcaneExposureBar, receipt.locked ? 'locked' : 'active');
  const label = `${receipt.label}: ${receipt.value} of ${receipt.threshold}${receipt.locked ? ', locked' : ''}`;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  const bar = meter({
    id: 'arcane', tone: 'arcane', stack: true,
    label: receipt.label,
    value: `${receipt.value} / ${receipt.threshold}`,
    cur: receipt.value, max: receipt.threshold, pct: receipt.fillPercent,
    ariaLabel: label,
    attrs: { class: `arcane-exposure-head${receipt.locked ? ' locked' : ''}` },
    trackAttrs: { class: 'arcane-exposure-track' },
  });
  // HUE IS NEVER THE ONLY CHANNEL: the school's own mark leads the plate.
  bar.querySelector('.m-plate').prepend(glyph(receipt.glyph, { class: 'arcane-exposure-glyph' }));
  el.appendChild(bar);
  if (receipt.locked) el.appendChild(pill({ label: 'Locked', attrs: { class: 'arcane-exposure-lock', dataset: { tone: 'gold' } } }));
  if (receipt.status) {
    el.appendChild(statusText(`${receipt.status.label} ${receipt.status.value}% · ${receipt.status.duration} turns`, { class: 'magic-vulnerable-receipt' }));
  }
  const event = eventHtml(receipt.event, registries);
  if (event) el.insertAdjacentHTML('beforeend', event);
  if (tooltips) attachTooltip(el, () => esc(receipt.tooltip));
  return el;
}
