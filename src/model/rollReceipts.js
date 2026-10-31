// Roll receipts (owner, 2026-10-31): every roll in the combat log is "total vs DC", and the
// full-detail log itemises it. A receipt is plain data built from a public event, never from
// hidden state, and never draws a number:
//   { kind, die, dice?, mode?, parts: [{label, value, note?}], total, dcParts: [{label, value}], dc,
//     success, chance?, compare? }
// `compare` is how the total meets the DC: 'gte' (default, d20 rolls), 'lte' (a d100 under a
// percentage chance) or 'lt' (a crit roll under its chance).
import { t } from '../ui/strings.js';
import { attributes as ATTRIBUTES } from '../content/generated/attributes.js';

const finite = value => Number.isFinite(Number(value)) && value !== null && value !== '';
const num = value => (finite(value) ? Number(value) : 0);
const attr = id => ATTRIBUTES.find(row => row.id === id)?.shortLabel || String(id || '');

export function accuracyRollReceipt(event) {
  const dice = Array.isArray(event.dice) ? event.dice.filter(finite) : [];
  if (!dice.length) return null; // automatic outcome: nothing was rolled
  const success = event.type === 'attackHit';
  const mode = event.mode || 'normal';
  const itemised = [event.precisionParts, event.accuracyParts].find(list => Array.isArray(list) && list.length);
  const precision = itemised ? itemised.map(({ label, value, note }) => ({ label, value: num(value), ...(note ? { note } : {}) }))
    : [{ label: 'Precision', value: num(event.accuracy) }];
  const base = { kind: 'accuracy', die: 'd20', dice, mode, success, ...(finite(event.hitChance) ? { chance: num(event.hitChance) } : {}) };
  if (event.evasionDie != null && finite(event.attackTotal)) {
    return { ...base, parts: precision, total: num(event.attackTotal),
      dcParts: [{ label: 'd20', value: num(event.evasionDie) }, { label: 'Evasion', value: num(event.evasion) }], dc: num(event.evasionTotal) };
  }
  if (event.fixedDefense && finite(event.attackTotal)) {
    return { ...base, parts: precision, total: num(event.attackTotal), dcParts: [{ label: 'Evasion', value: num(event.evasion) }], dc: num(event.evasionTotal ?? event.evasion) };
  }
  if (!finite(event.need)) return null;
  // Legacy: the used die must reach the number Precision and Evasion leave it needing.
  const used = mode === 'disadvantage' ? Math.min(...dice) : mode === 'advantage' ? Math.max(...dice) : dice[0];
  return { ...base, parts: [], total: used, dcParts: [{ label: 'Needed (8 + Evasion − Precision)', value: num(event.need) }], dc: num(event.need) };
}

export function contestRollReceipt(event) {
  const c = event.contest || event;
  if (!finite(c.roll) || !finite(c.total) || !finite(c.dc)) return null;
  const parts = (c.parts || []).map(part => ({ label: attr(part.id), value: num(part.value) }));
  const rank = finite(c.rank) ? num(c.rank) : 1;
  if (rank) parts.push({ label: 'rank', value: rank });
  const dcParts = (c.dcParts || []).map(part => ({ label: part.id === 'poise' ? 'Poise' : part.id === 'level' ? 'level' : attr(part.id), value: num(part.value) }));
  return { kind: 'contest', die: 'd20', dice: [num(c.roll)], parts, total: num(c.total), dcParts, dc: num(c.dc), success: event.type === 'contestPassed' };
}

// A crit rolls a float under its chance; shown as a percentile (12.4 against 15).
export function critRollReceipt(event) {
  if (!finite(event.roll) || !finite(event.chance)) return null;
  return { kind: 'crit', die: 'd100', dice: [num(event.roll)], parts: [], total: num(event.roll), compare: 'lt',
    dcParts: [{ label: 'Crit chance %', value: num(event.chance) }], dc: num(event.chance), success: !!event.success };
}

export function perceptionRollReceipt(event) {
  if (!finite(event.roll) || !finite(event.dc)) return null;
  return { kind: 'perception', die: 'd20', dice: [num(event.roll)], parts: [{ label: 'WIS', value: num(event.wisdom) }], total: num(event.total ?? num(event.roll) + num(event.wisdom)),
    dcParts: (event.dcParts || []).map(({ label, value }) => ({ label, value: num(value) })), dc: num(event.dc), success: !!event.passed };
}

// A d100 that must land at or under a percentage (status buildup chance, status recovery).
export function percentRollReceipt(event, kind) {
  if (!finite(event.roll) || !finite(event.chance)) return null;
  const rolls = Array.isArray(event.rolls) && event.rolls.length ? event.rolls.map(num) : [num(event.roll)];
  return { kind, die: 'd100', dice: rolls, ...(rolls.length > 1 ? { mode: event.effectiveChance > event.chance ? 'advantage' : 'disadvantage' } : {}),
    parts: [], total: num(event.roll), compare: 'lte', dcParts: [{ label: 'Chance %', value: num(event.chance) }], dc: num(event.chance),
    ...(finite(event.effectiveChance) && event.effectiveChance !== event.chance ? { chance: Math.round(event.effectiveChance * 10) / 10 } : {}), success: !!event.success };
}

export function dodgeRollReceipt(event) {
  const total = event.check ?? event.roll;
  if (!finite(total) || !finite(event.difficulty)) return null;
  return { kind: 'dodge', die: 'd20', dice: finite(event.roll) ? [num(event.roll)] : [], parts: finite(event.roll) && num(event.check) !== num(event.roll)
    ? [{ label: 'Dexterity + Weight Class', value: num(event.check) - num(event.roll) }] : [], total: num(total), dcParts: [], dc: num(event.difficulty), success: !!event.success };
}

export function evadeRollReceipt(evade) {
  if (!finite(evade?.roll) || !finite(evade.difficulty)) return null;
  const total = finite(evade.total) ? num(evade.total) : num(evade.roll);
  return { kind: 'evade', die: 'd20', dice: [num(evade.roll)], parts: total !== num(evade.roll) ? [{ label: 'bonus', value: total - num(evade.roll) }] : [],
    total, dcParts: [], dc: num(evade.difficulty), success: !!evade.success };
}

const VERDICT = { accuracy: ['hit', 'miss'], contest: ['success', 'fail'], crit: ['crit', 'noCrit'], perception: ['read', 'unread'] };
export const rollVerdictWord = (kind, success) => t(`combat.roll.${(VERDICT[kind] || ['success', 'fail'])[success ? 0 : 1]}`);
/** The compact log line: "Strike: 18 vs 9 · hit". */
export const rollCompactText = (what, receipt) => t('combat.log.roll', { what, total: Number(receipt.total.toFixed(2)), dc: Number(receipt.dc.toFixed(2)), verdict: rollVerdictWord(receipt.kind, receipt.success) });
