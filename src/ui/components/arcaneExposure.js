// Pure projection and renderer for host-owned per-enemy Arcane Exposure state.
// It never derives carriers, applies damage, or mutates a meter.

import { esc, attachTooltip } from './tooltip.js';
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
    label: registries.statuses.get('magicVulnerable').name,
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
    const status = registries.statuses.get(event.status);
    return `<div class="arcane-exposure-event arcane-break-receipt"><b>Break</b> · ${esc(status.name)} ${event.value}% · ${event.duration} turns</div>`;
  }
  if (event.type === 'arcaneExposureRefused') {
    return `<div class="arcane-exposure-event arcane-refusal-receipt"><b>Refused</b> · ${esc(event.reason)} · ${esc(event.school)} ${event.attempted}</div>`;
  }
  return '';
}

export function renderArcaneExposure(registries, enemySnapshot, recentEvents = []) {
  const receipt = arcaneExposureReceipt(registries, enemySnapshot, recentEvents);
  if (!receipt) return null;
  const el = document.createElement('div');
  if (receipt.mode === 'immune') {
    el.className = 'arcane-exposure-immune';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${receipt.label} — ${receipt.badge}`);
    el.innerHTML = `<span class="arcane-exposure-glyph" aria-hidden="true">${receipt.glyph}</span><span>${esc(receipt.label)} — ${esc(receipt.badge)}</span>${eventHtml(receipt.event, registries)}`;
    markUiComponent(el, UI.arcaneExposureBar, 'immune');
    attachTooltip(el, () => esc(receipt.tooltip));
    return el;
  }
  el.className = `arcane-exposure-meter${receipt.locked ? ' locked' : ''}`;
  markUiComponent(el, UI.arcaneExposureBar, receipt.locked ? 'locked' : 'active');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${receipt.label}: ${receipt.value} of ${receipt.threshold}${receipt.locked ? ', locked' : ''}`);
  el.innerHTML = `<div class="arcane-exposure-head"><span class="arcane-exposure-glyph" aria-hidden="true">${receipt.glyph}</span><span class="arcane-exposure-label">${esc(receipt.label)}</span><strong>${receipt.value} / ${receipt.threshold}</strong>${receipt.locked ? '<em>Locked</em>' : ''}</div>`
    + `<div class="arcane-exposure-track"><span style="width:${receipt.fillPercent}%"></span></div>`
    + (receipt.status ? `<div class="magic-vulnerable-receipt">${esc(receipt.status.label)} ${receipt.status.value}% · ${receipt.status.duration} turns</div>` : '')
    + eventHtml(receipt.event, registries);
  attachTooltip(el, () => esc(receipt.tooltip));
  return el;
}
