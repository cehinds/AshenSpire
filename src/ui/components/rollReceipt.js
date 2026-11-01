// The full-detail combat log's itemised roll (owner, 2026-10-31): one line per part, then the DC and verdict.
// Presentation only: every number comes from the receipt (src/model/rollReceipts.js).
import { t } from '../strings.js';
import { rollVerdictWord } from '../../model/rollReceipts.js';

const fmt = value => (Number.isFinite(value) ? String(Number(value.toFixed(2))) : '?');
const signed = (value, label, note) => `${value < 0 ? '−' : '+'} ${label} ${fmt(Math.abs(value))}${note ? ` (${note})` : ''}`;
export function rollReceiptLines(receipt) {
  if (!receipt || !Number.isFinite(receipt.total)) return [];
  const lines = [];
  const dice = (receipt.dice || []).map(fmt).join(', ');
  const parts = receipt.parts || [];
  const spent = parts.reduce((sum, part) => sum + (Number.isFinite(part.value) ? part.value : 0), 0);
  const multi = (receipt.dice || []).length > 1;
  const kept = multi ? receipt.total - spent : null;
  const mode = receipt.mode && receipt.mode !== 'normal' ? ` · ${receipt.mode}` : '';
  lines.push(`${receipt.die} [${dice}]${multi ? ` → ${fmt(kept)}` : ''}${mode}${receipt.note ? ` · ${receipt.note}` : ''}`);
  for (const part of parts) lines.push(signed(part.value, part.label, part.note));
  lines.push(`= ${fmt(receipt.total)}`);
  const dcParts = receipt.dcParts || [];
  const needs = { lte: '≤', lt: '<' }[receipt.compare];
  if (receipt.compare === 'gte' && dcParts.some(part => part.label === 'Chance %')) {
    // A percentage chance rolled as a d20: "Needs ≥ 18 (Chance 15%)".
    const chance = dcParts.find(part => part.label === 'Chance %');
    lines.push(`${t('combat.roll.needs')} ≥ ${fmt(receipt.dc)} (Chance ${fmt(chance.value)}%)`);
  } else if (needs) lines.push(`${t('combat.roll.needs')} ${needs} ${dcParts.length ? dcParts.map(part => `${part.label} ${fmt(part.value)}`).join(' + ') : fmt(receipt.dc)}`);
  else if (dcParts.length) {
    dcParts.forEach((part, index) => lines.push(index ? signed(part.value, part.label) : `vs ${part.label} ${fmt(part.value)}`));
    if (dcParts.length > 1) lines.push(`= ${fmt(receipt.dc)}`);
  } else lines.push(`vs DC ${fmt(receipt.dc)}`);
  lines.push(`${rollVerdictWord(receipt.kind, receipt.success)}${Number.isFinite(receipt.chance) ? ` · ${fmt(receipt.chance)}%` : ''}`);
  return lines;
}
