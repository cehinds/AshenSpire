import { t } from '../strings.js';
import { openModal, button, el } from '../kit/index.js';
import { cardOptionGrid, markCardOptions } from './cardOptionGrid.js';
import { summarizeCardOption } from '../models/CardOptionSummaryModel.js';

// This choice happens after a paid card's draw has resolved. Closing the
// dialog postpones the selection; the engine keeps the action paused.
export function openDiscardChoiceModal({ cards, count, cardName, onChoose, onClosed, title, prompt, confirmLabel, ordered = false, summarize = null }) {
  const selected = new Set();
  let answer = null;
  const confirm = button({ label: confirmLabel || `${t('combat.discard')} ${count}`, weight: 'primary', disabled: true });
  const shell = openModal({
    title: title || t('combat.discard.title',{count,noun:count===1?'card':'cards'}), eyebrow: cardName || t('combat.discard.resolving'),
    size: 'md', className: 'discard-choice', closeLabel: t('combat.discard.later'),
    body: host => {
      host.appendChild(el('p', { text: prompt || t('combat.discard.prompt') }));
      const summaries = cards.map(card => {
        let summary = null;
        try { summary = summarize?.(card) ?? null; } catch { summary = null; }
        return summary || summarizeCardOption(null, null, { id: card.instanceId, name: card.name });
      });
      const grid = cardOptionGrid(summaries, { idAttr: 'data-discard-id', onSelect: id => {
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < count) selected.add(id);
        markCardOptions(grid, 'data-discard-id', [...selected], { ordered });
        confirm.disabled = selected.size !== count;
      } });
      host.appendChild(grid);
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
