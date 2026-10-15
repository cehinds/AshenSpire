import { el, modalHead } from '../kit/index.js';
import { t } from '../strings.js';

// Shared reward modal: preserves the open door across views and owns no reward policy.
export function mountRewardDoor(app, { owner, eyebrow = '', title, body, foot, attrs = {}, status = null }) {
  const head = modalHead({ eyebrow, title, closeLabel: t('reward.close'), extras: status });
  head.querySelector('.modal-close').hidden = true;
  const content = [head, el('div', { class: 'modal-body reward-body' }, body), foot];
  const open = app.querySelector('.reward-veil .reward-door');
  if (open && open.rewardDoorOwner === owner) {
    for (const key of ['rewardDetail', 'victoryCompact', 'rewardLevel']) {
      open.removeAttribute(`data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
      delete open.dataset[key];
    }
    const { dataset = {}, ...rest } = attrs;
    Object.assign(open.dataset, { size: 'md' }, dataset);
    for (const [key, value] of Object.entries(rest)) open.setAttribute(key, value);
    open.setAttribute('aria-label', title);
    open.replaceChildren(...content.filter(Boolean));
    return open;
  }
  app.querySelector('.reward-veil')?.remove();
  if (!app.firstElementChild) app.appendChild(el('div', { class: 'screen reward-backdrop' }));
  const modal = el('section', {
    class: 'modal reward-door', dataset: { size: 'md' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': title, ...attrs,
  }, content);
  modal.rewardDoorOwner = owner;
  const veil = el('div', { class: 'modal-veil reward-veil' }, modal);
  app.appendChild(veil);
  return modal;
}
