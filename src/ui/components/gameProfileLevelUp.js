import { mountRewardDoor } from './rewardDoor.js';
import { el, button, modalFooter } from '../kit/index.js';
import { t } from '../strings.js';

// Uses the reward door's existing modal shell. This is a receipt of earned
// class/weapon-group levels, not a second reward or equipment-upgrade system.
export function mountGameProfileLevelUp(app, { rows, onContinue }) {
  const done = button({ label: t('common.continue'), weight: 'primary', id: 'reward-level-continue' });
  let acknowledged = false;
  done.addEventListener('click', () => {
    if (acknowledged) return;
    onContinue();
    acknowledged = true;
  });
  return mountRewardDoor(app, {
    owner: rows,
    eyebrow: t('reward.level.eyebrow'),
    title: 'Level up',
    attrs: { dataset: { rewardLevel: 'skills' } },
    body: el('div', { class: 'reward-level-claim' }, rows.map(row =>
      el('p', { class: 'reward-level-summary', dataset: { skill: row.skillId },
        text: `${row.label} · Level ${row.before} → ${row.after}` }))),
    foot: modalFooter({ primary: done, className: 'reward-foot', size: 'medium' }),
  });
}
