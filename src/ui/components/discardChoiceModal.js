import { t } from '../strings.js';
import { openModal, button, el } from '../kit/index.js';

// This choice happens after a paid card's draw has resolved. Closing the
// dialog postpones the selection; the engine keeps the action paused.
export function openDiscardChoiceModal({ cards, count, cardName, onChoose, onClosed, title, prompt, confirmLabel, ordered = false }) {
  const selected = new Set();
  let answer = null;
  const confirm = button({ label: confirmLabel || `${t('combat.discard')} ${count}`, weight: 'primary', disabled: true });
  const shell = openModal({
    title: title || t('combat.discard.title',{count,noun:count===1?'card':'cards'}), eyebrow: cardName || t('combat.discard.resolving'),
    size: 'md', className: 'discard-choice', closeLabel: t('combat.discard.later'),
    body: host => {
      host.appendChild(el('p', { text: prompt || t('combat.discard.prompt') }));
      for (const card of cards) {
        const pick = button({ label: card.name, attrs: { 'data-discard-id': card.instanceId, 'aria-pressed': 'false' } });
        pick.addEventListener('click', () => {
          if (selected.has(card.instanceId)) selected.delete(card.instanceId);
          else if (selected.size < count) selected.add(card.instanceId);
          pick.setAttribute('aria-pressed', String(selected.has(card.instanceId)));
          if (ordered) for (const node of host.querySelectorAll('[data-discard-id]')) { const position = [...selected].indexOf(node.dataset.discardId); node.textContent = `${position < 0 ? '' : `${position + 1}. `}${cards.find(c => c.instanceId === node.dataset.discardId).name}`; }
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
