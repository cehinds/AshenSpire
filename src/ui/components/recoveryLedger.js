import { t } from '../strings.js';
import { esc } from './tooltip.js';
import { engravedIconHtml } from './engravedIcon.js';

/**
 * The recovery ledger, projected from the final transaction (`after`) against the live run. Only
 * pools that change draw a row (with their gain); when nothing changes one line says so.
 */
export function recoveryLedgerHtml(run, after) {
  const rows = [
    ['health', t('gameProfile.rest.pool.hp'), run.hp, after.hp],
    ['mana', t('gameProfile.rest.pool.mp'), run.mana, after.mana],
    ['stamina', t('gameProfile.rest.pool.sp'), run.stamina, after.stamina],
    ...(run.flaskCharges ? [
      ['flask-health', t('gameProfile.rest.pool.healingFlask'), run.flaskCharges.hpCurrent, after.flaskCharges.hpCurrent],
      ['flask-mana', t('gameProfile.rest.pool.mpFlask'), run.flaskCharges.manaCurrent, after.flaskCharges.manaCurrent],
    ] : []),
  ];
  const changed = rows.filter(([, , before, next]) => next !== before);
  const body = changed.length
    ? changed.map(([icon, label, before, next]) => `<div class="rest-recovery-row">${engravedIconHtml(icon)}<span>${esc(label)}</span><span>${before} → <strong>${next}</strong></span><span class="rest-recovery-gain">${next > before ? '+' : ''}${next - before}</span></div>`).join('')
    : `<p class="rest-recovery-none">${esc(t('rest.recovery.none'))}</p>`;
  return `<section class="rest-recovery" aria-label="${esc(t('rest.recovery.heading'))}">${body}</section>`;
}
