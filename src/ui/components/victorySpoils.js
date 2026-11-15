// The spoils strip of the one victory screen: what a won fight paid, drawn above the card choice.
// Presentation only. Every number comes from the saved victory receipt (cinders, stones, XP gains),
// so a reload shows the same strip and nothing is paid or recomputed here.
import { el, button } from '../kit/index.js';
import { t } from '../strings.js';
import { rewardProgress } from '../../model/rewardprogress.js';
import { orderedXpRows, scopeXpProgress } from '../../model/rewardXpPresentation.js';
import { smithingStoneRowCopy, smithingStonesPaid } from '../../model/rewardplan.js';
import { StatAllocationSection } from './statAllocation.js';

function xpRow(row) {
  const shown = Math.min(row.xp, row.xpToNext || row.xp);
  const total = row.xpToNext || row.xp;
  const target = Math.max(0, Math.min(100, row.fraction * 100));
  const under = el('span', { class: 'rp-under' });
  const over = el('span', { class: 'rp-over' });
  under.style.width = `${target}%`; over.style.width = `${target}%`;
  const bar = el('div', {
    class: `rp-bar rp-layered-bar${row.fraction >= 1 ? ' rp-bar-ready' : ''}`, role: 'progressbar',
    'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(shown),
    'aria-label': t('reward.progress.xp', { xp: shown, next: total, level: row.level + 1 }),
    dataset: { animate: '0', target: String(target), track: row.id, kind: row.kind },
  }, [under, over, el('span', { class: 'rp-bar-text', text: `${shown} / ${total}` })]);
  return el('li', { class: 'reward-progress-row', dataset: { kind: row.kind, track: row.id, gained: String(row.gained) } }, [
    el('span', { class: 'rp-name', text: t('reward.progress.character') }),
    el('span', { class: 'rp-level', text: t('reward.progress.level', { level: row.level }) }),
    bar,
    el('span', { class: 'rp-next', text: row.capped ? t('reward.progress.capped') : t('reward.progress.next', { level: row.level + 1 }) }),
    row.gained ? el('span', { class: 'rp-gain', text: t('reward.progress.gained', { xp: row.gained }) }) : null,
  ]);
}

/**
 * VictorySpoils(registries, run, receipt, { settings, onAllocateStat, onPersist }) → the strip element.
 * Lines, in order: Cinders +n (total), the Smithing Stone when one dropped, the Character XP bar, and a compact
 * "n points to spend" control that opens the receipt's allocation UI when the run holds unspent points.
 */
export function VictorySpoils(registries, run, receipt, { settings = {}, onAllocateStat = null, onPersist = null } = {}) {
  const lines = [];
  if (receipt.cinders && Number.isFinite(receipt.cinders.gained)) {
    lines.push(el('p', { class: 'spoils-line spoils-cinders', dataset: { gained: String(receipt.cinders.gained) },
      text: t('reward.spoils.cinders', { gained: receipt.cinders.gained, total: receipt.cinders.total }) }));
  }
  if (smithingStonesPaid(receipt.smithingStoneReceipt)) {
    lines.push(el('p', { class: 'spoils-line spoils-stone', text: smithingStoneRowCopy(receipt.smithingStoneReceipt, t).title }));
  }
  const progress = receipt.xpGains ? scopeXpProgress(rewardProgress(registries, run, receipt.xpGains, { maxSkills: Infinity })) : null;
  const rows = progress ? orderedXpRows(progress) : [];
  const strip = el('section', { class: 'victory-spoils', 'aria-label': t('reward.spoils.aria') }, [
    ...lines,
    rows.length ? el('section', { class: 'reward-progress', 'aria-label': t('reward.progress.heading') }, [
      el('ul', { class: 'reward-progress-list' }, rows.map(xpRow)),
    ]) : null,
  ]);
  // The attribute points: a compact control, never a gate. Ignoring it banks the points (the Armoury spends them later).
  const spender = el('div', { class: 'spoils-points' });
  const draw = () => {
    const count = run.level?.unspentPoints || 0;
    if (!onAllocateStat || count < 1) { spender.replaceChildren(); return; }
    const toggle = button({ label: t('reward.spoils.points', { count, plural: count === 1 ? '' : 's' }), id: 'spoils-points', className: 'spoils-points-button' });
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      if (spender.querySelector('.reward-stat-allocation')) { draw(); return; }
      const section = StatAllocationSection(registries, run, { settings, onAllocateStat, onChange: () => { onPersist?.(); } });
      if (!section) return draw();
      const done = button({ label: t('reward.spoils.pointsDone'), id: 'spoils-points-done', className: 'spoils-points-done' });
      done.addEventListener('click', draw);
      toggle.setAttribute('aria-expanded', 'true');
      spender.replaceChildren(toggle, section, done);
    });
    spender.replaceChildren(toggle);
  };
  draw();
  strip.append(spender);
  return strip;
}
