import { t } from '../strings.js';
import { openModal, button, el } from '../kit/index.js';
import { optionRowList, markOptionRows } from './optionRowList.js';
import { summarizeCardOption } from '../models/CardOptionSummaryModel.js';

// This choice happens after a paid card's draw has resolved. Closing the
// dialog postpones the selection; the engine keeps the action paused.
export function openDiscardChoiceModal({ cards, count, cardName, onChoose, onClosed, title, prompt, confirmLabel, ordered = false, summarize = null }) {
  const selected = new Set();
  let answer = null;
  let bodyHost = null;
  const confirm = button({ label: confirmLabel || `${t('combat.discard')} ${count}`, weight: 'primary', disabled: true });
  const shell = openModal({
    title: title || t('combat.discard.title',{count,noun:count===1?'card':'cards'}), eyebrow: cardName || t('combat.discard.resolving'),
    size: 'md', className: 'option-choice discard-choice', closeLabel: t('combat.discard.later'), deferFocus: true,
    initialFocus: () => bodyHost?.querySelector('[data-discard-id]') || null,
    body: host => {
      bodyHost = host;
      host.appendChild(el('p', { text: prompt || t('combat.discard.prompt') }));
      const summaries = cards.map(card => {
        let summary = null;
        try { summary = summarize?.(card) ?? null; } catch { summary = null; }
        return summary || summarizeCardOption(null, null, { id: card.instanceId, name: card.name });
      });
      const grid = optionRowList(summaries, { idAttr: 'data-discard-id', onSelect: (id, row) => {
        if (selected.has(id)) selected.delete(id);
        else if (selected.size < count) selected.add(id);
        row?.focus?.({ preventScroll: true });
        markOptionRows(grid, 'data-discard-id', [...selected]);
        // An ordered pick shows its position on the row.
        if (ordered) for (const item of grid.querySelectorAll('[data-discard-id]')) {
          item.querySelector?.('.co-order')?.remove?.();
          const position = [...selected].indexOf(item.getAttribute('data-discard-id'));
          if (position >= 0) item.insertBefore?.(el('span', { class: 'co-order', text: String(position + 1) }), item.firstChild);
        }
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
