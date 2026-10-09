import { openModal, button, el } from '../kit/index.js';

export function openReactionChoiceModal({ pending, onAnswer, onClosed }) {
  let selected = null;
  let settled = false;
  let dismissed = false;
  const play = button({ label: 'Play', weight: 'primary', disabled: true });
  const decline = button({ label: 'Back', role: 'exit' });
  const shell = openModal({
    title: 'Respond to the incoming action', eyebrow: 'Defensive reaction', size: 'md',
    className: 'reaction-choice', closeLabel: 'Back', secondary: [decline], primary: play,
    body(host) {
      host.append(el('p', { text: 'Choose a card to play before this action resolves. Back skips this reaction.' }));
      for (const option of pending.options) {
        const tier = option.play.upcastTier;
        const pick = button({ label: `${option.name}${tier ? ` · Upcast ${tier}` : ''}${option.choiceName ? ` · ${option.choiceName}` : ''} · ${option.staminaCost} SP${option.manaCost ? ` · ${option.manaCost} MP` : ''}`,
          attrs: { 'data-reaction-option': option.id, 'aria-pressed': 'false' } });
        pick.addEventListener('click', () => {
          selected = option.id;
          host.querySelectorAll('[data-reaction-option]').forEach(node => node.setAttribute('aria-pressed', String(node === pick)));
          play.disabled = false;
        });
        host.append(pick);
      }
    },
    onClose() { onClosed?.(); if (!dismissed) onAnswer({ offerId: pending.id, optionId: settled ? selected : null }); },
  });
  play.addEventListener('click', () => { if (!selected) return; settled = true; shell.close(); });
  decline.addEventListener('click', () => shell.close());
  shell.body.querySelector('[data-reaction-option]')?.focus({ preventScroll: true });
  return { ...shell, dismiss() { dismissed = true; shell.close(); } };
}
