import { esc, attachTooltip, showTooltipFor } from './tooltip.js';
import { t } from '../strings.js';

const number = value => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '?';

/** Presentation only: every quantity and named source comes from the engine receipt. */
export function damageReceiptLines(receipt) {
  if (!Array.isArray(receipt?.hits)) return [];
  const lines = [];
  for (const [index, hit] of receipt.hits.entries()) {
    lines.push(`Hit ${index + 1}: ${number(hit.incoming)} incoming → ${number(hit.hpLoss)} HP damage`);
    if (Number.isFinite(hit.physical) && Number.isFinite(hit.magical)) lines.push(`Components: ${number(hit.physical)} physical + ${number(hit.magical)} magical`);
    for (const source of hit.sources || []) {
      const operation = source.operation === 'multiply' || Number.isFinite(source.multiplier)
        ? `×${number(source.multiplier ?? source.amount)}`
        : `${source.amount >= 0 ? '+' : '−'}${number(Math.abs(source.amount))}`;
      lines.push(`${source.label || source.id}: ${operation}${source.stage ? ` (${source.stage})` : ''}`);
    }
    const reductions = [['wardReduced', 'Ward'], ['poiseReduced', t('statsPreview.overview.poise')], ['blocked', 'Block']]
      .filter(([key]) => Number.isFinite(hit[key]) && hit[key] > 0)
      .map(([key, label]) => `${label} −${number(hit[key])}`);
    if (reductions.length) lines.push(reductions.join('; '));
    lines.push(`Final HP damage: ${number(hit.hpLoss)}${hit.rounding ? ` (${hit.rounding})` : ''}`);
  }
  lines.push(`${receipt.hits.length} hit${receipt.hits.length === 1 ? '' : 's'} · ${number(receipt.totalDamage)} total HP damage`);
  return lines;
}

export function damageReceiptHtml(receipt, { targetName = null } = {}) {
  const lines = damageReceiptLines(receipt);
  if (!lines.length) return '';
  const scope = receipt.targetId ? `Against ${targetName || receipt.targetId}; on successful hits` : 'Before target defenses; on successful hits';
  return `<div class="damage-receipt"><div class="tt-title">Damage calculation</div><p>${esc(scope)}</p>${lines.map(line => `<div>${esc(line)}</div>`).join('')}</div>`;
}

export function cardDamageReceipt(preview) {
  const receipts = (preview?.values || []).filter(entry => entry.op === 'damage' && entry.damageReceipt).map(entry => entry.damageReceipt);
  if (!receipts.length) return null;
  return { ...receipts[0], hits: receipts.flatMap(receipt => receipt.hits || []),
    totalDamage: receipts.reduce((total, receipt) => total + (receipt.totalDamage || 0), 0) };
}

export function damageNumberUnderLane(event) {
  const lane = event.target?.closest?.('.hand-hit-lane');
  if (!lane?.parentElement) return null;
  return [...lane.parentElement.querySelectorAll('[data-damage-receipt]')].find(node => {
    const box = node.getBoundingClientRect();
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  }) || null;
}

let routedDocument = null;
function routeHandDamageInspection() {
  if (routedDocument === document) return;
  routedDocument = document;
  let hovered = null;
  document.addEventListener('pointermove', event => {
    const next = event.pointerType === 'touch' ? null : damageNumberUnderLane(event);
    if (next === hovered) return;
    hovered?.dispatchEvent(new PointerEvent('pointerleave', { pointerType: event.pointerType || 'mouse' }));
    hovered = next;
    hovered?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: event.pointerType || 'mouse', clientX: event.clientX, clientY: event.clientY }));
  }, true);
  document.addEventListener('pointerdown', event => {
    if (damageNumberUnderLane(event)) event.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', event => {
    const number = damageNumberUnderLane(event);
    if (!number) return;
    event.preventDefault(); event.stopImmediatePropagation();
    number.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, true);
}

/** Mouse, focus and touch share the exact same engine calculation. */
export function bindDamageReceipt(card, preview) {
  const receipt = cardDamageReceipt(preview);
  if (!receipt) return;
  routeHandDamageInspection();
  const html = () => damageReceiptHtml(receipt, { targetName: preview.targetName });
  const numbers = card.querySelectorAll('[data-face-kind="damage"] .val');
  for (const node of numbers) {
    node.tabIndex = 0;
    node.dataset.damageReceipt = 'true';
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${node.textContent}. Inspect damage calculation`);
    attachTooltip(node, html);
    const inspect = event => {
      event.stopPropagation();
      if (event.type === 'keydown') { if (!['Enter', ' '].includes(event.key)) return; event.preventDefault(); }
      showTooltipFor(node, html(), { intent: 'above', align: 'center' });
    };
    node.addEventListener('pointerdown', event => event.stopPropagation());
    node.addEventListener('click', inspect);
    node.addEventListener('keydown', inspect);
  }
}
