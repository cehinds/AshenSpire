import { openModal, button, cardGrid, el } from '../kit/index.js';
import { renderCard } from './card.js';
import { resolveCard } from '../../model/registries.js';

// Selection is local until Confirm; closing the shared modal cancels the turn.
export function openHandDiscard(registries, plan, onConfirm, opener) {
  const selected = new Set();
  const confirm = button({ label: 'Keep all & end turn', weight: 'primary', className: 'hand-discard-confirm' });
  const keep = button({ label: 'Keep all', className: 'hand-discard-keep', disabled: plan.minimum > 0 });
  const count = el('p', { 'aria-live': 'polite' });
  const controls = [];
  const refresh = () => {
    count.textContent = `${selected.size} selected · ${plan.minimum ? `Choose at least ${plan.minimum}, up to ${plan.maximum}.` : `Choose up to ${plan.maximum}, or keep all.`} Cards resolve before the next draw.`;
    confirm.textContent = selected.size ? `Discard ${selected.size} & end turn` : 'Keep all & end turn';
    confirm.disabled = selected.size < plan.minimum;
    controls.forEach(([input, id]) => { input.disabled = !selected.has(id) && selected.size >= plan.maximum; });
  };
  const shell = openModal({ title: 'Choose cards to discard', size: 'xl', className: 'hand-discard-modal', opener,
    bodyClassName: 'pile-body', body: host => {
      host.append(count);
      const grid = cardGrid([], { class: 'grid' });
      for (const card of plan.cards) {
        const item = el('div', { class: 'hand-discard-item' });
        const label = el('label', { class: 'as-btn' });
        const input = el('input', { type: 'checkbox', 'aria-label': `Discard ${resolveCard(registries, card).name}` });
        input.dataset.discardId = card.instanceId;
        input.addEventListener('change', () => {
          if (input.checked) selected.add(card.instanceId); else selected.delete(card.instanceId);
          refresh();
        });
        label.append(input, document.createTextNode(' Discard'));
        item.append(renderCard(registries, card, { small: true, inspectReadOnly: true }), label);
        controls.push([input, card.instanceId]);
        grid.append(item);
      }
      host.append(grid);
    }, primary: confirm, secondary: [keep],
  });
  confirm.addEventListener('click', () => { if (confirm.disabled) return; shell.close(); onConfirm([...selected]); });
  keep.addEventListener('click', () => { if (keep.disabled) return; shell.close(); onConfirm([]); });
  refresh();
  return shell;
}
