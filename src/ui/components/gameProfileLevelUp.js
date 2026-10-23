import { mountRewardDoor } from './rewardDoor.js';
import { el, button, modalFooter } from '../kit/index.js';
import { t } from '../strings.js';
import { skillLevelNotices } from '../../model/gameProfileProgression.js';

// Uses the reward door's existing modal shell. This is a receipt of earned
// class/weapon-group levels, not a second reward or equipment-upgrade system.
export function mountGameProfileLevelUp(app, { rows, registries, run, onContinue }) {
  // Old pending receipts did not save effect details. Reconstruct card changes
  // from their saved levels and current owned cards; never award progression.
  const fallback = registries && run && rows.some(row => !row.effects) ? skillLevelNotices(registries,
    rows.map(row => ({ ...row, levelUps: row.after - row.before })), { run }) : [];
  const summaries = rows.map((row, index) => {
    const effects = row.effects || fallback[index]?.effects;
    const title = `${row.weapons?.length ? `${row.weapons.join(', ')} (${row.label} group)` : row.label} · Level ${row.before} → ${row.after}`;
    const lines = effects?.changes?.length ? effects.changes.map(change => `${change.label}: ${change.before} → ${change.after}`)
      : [effects?.unavailable || !effects ? 'Effect details were not saved for this level.' : 'No stat bonus or unlock at this level.'];
    const cap = effects?.maxLevel;
    const meter = cap > 0 ? el('div', { class: 'reward-skill-meter', role: 'progressbar',
      aria: { label: `${row.label} skill level`, valuemin: 0, valuemax: cap, valuenow: row.after,
        valuetext: `Level ${row.before} → ${row.after} of ${cap}` } },
    el('span', { class: 'reward-skill-fill', style: `--skill-before:${100 * row.before / cap}%;width:${100 * row.after / cap}%` })) : null;
    return el('section', { class: 'reward-skill-summary' }, [
      el('p', { class: 'reward-level-summary', dataset: { skill: row.skillId }, text: title }), meter,
      el('ul', { class: 'reward-level-log reward-skill-effects' }, lines.map(text => el('li', { text }))),
      effects?.nextMilestone ? el('p', { class: 'reward-skill-next',
        text: `Next benefit at level ${effects.nextMilestone.level}: ${effects.nextMilestone.labels.join('; ')}` }) : null,
    ]);
  });
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
    title: t('reward.level.button'),
    attrs: { dataset: { size: 'md', rewardLevel: 'skills' } },
    body: el('div', { class: 'reward-level-claim' }, summaries),
    foot: modalFooter({ primary: done, className: 'reward-foot', size: 'medium' }),
  });
}
