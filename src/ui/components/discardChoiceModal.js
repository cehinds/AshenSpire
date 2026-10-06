import { t } from '../strings.js';
import { openModal, button, el } from '../kit/index.js';

// This choice happens after a paid card's draw has resolved. Closing the
// dialog postpones the selection; the engine keeps the action paused.
export function openDiscardChoiceModal({ cards, count, cardName, onChoose, onClosed }) {
  const selected = new Set();
  let answer = null;
  const confirm = button({ label: `${t('combat.discard')} ${count}`, weight: 'primary', disabled: true });
  const shell = openModal({
    title: `Choose ${count} card${count === 1 ? '' : 's'} to discard`, eyebrow: cardName || 'Resolving card',
    size: 'md', className: 'discard-choice', closeLabel: 'Choose later',
    body: host => {
      host.appendChild(el('p', { text: 'Select cards from your current hand to finish this play.' }));
      for (const card of cards) {
        const pick = button({ label: card.name, attrs: { 'data-discard-id': card.instanceId, 'aria-pressed': 'false' } });
        pick.addEventListener('click', () => {
          if (selected.has(card.instanceId)) selected.delete(card.instanceId);
          else if (selected.size < count) selected.add(card.instanceId);
          pick.setAttribute('aria-pressed', String(selected.has(card.instanceId)));
          confirm.disabled = selected.size !== count;
        });
        host.appendChild(pick);
      }
    },
    primary: confirm,
    onClose: () => { onClosed?.(); if (answer) onChoose(answer); },
  });
  confirm.addEventListener('click', () => {
    if (selected.size !== count) return;
    answer = [...selected]; shell.close();
  });
  return shell;
}
