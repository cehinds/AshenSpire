// The Blacksmith's choice (W25 steps 4-5): two or three rolled options for one item upgrade, or the properties to
// keep when a weapon changes category. One dialog, one tile per option (the uniform card-option tiles), the price
// beside the title, Cancel changes nothing. `onChoose(optionId)` runs once, after the dialog closes.
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { cardOptionGrid } from './cardOptionGrid.js';

/**
 * OpenSmithOptionsModal({ title, eyebrow, price, options, opener, onChoose, onClosed }) -> the modal shell.
 * `options` are { id, name, text, disabled? }; `price` is the line that says what the work costs.
 */
export function OpenSmithOptionsModal({ title, eyebrow = '', price = '', options, opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md',
    className: 'card-choice smith-options',
    opener,
    eyebrow,
    title,
    closeLabel: t('common.cancel'),
    bodyClassName: 'as-pane card-choice-body',
    body: (host) => {
      if (price) host.append(Object.assign(document.createElement('p'), { className: 'smith-options-price', textContent: price }));
      const summaries = options.map((option) => ({ id: option.id, className: 'card-choice-option smith-option', name: option.name, text: option.text || '', line: [], costs: [], disabled: !!option.disabled }));
      host.appendChild(cardOptionGrid(summaries, { idAttr: 'data-smith-option', onSelect: (id) => { chosen = id; shell.close(); } }));
    },
    primary: cancel,
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  cancel.addEventListener('click', shell.close);
  return shell;
}
