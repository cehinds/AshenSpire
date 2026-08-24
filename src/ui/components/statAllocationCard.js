// Shared attribute-allocation card. Character creation and shrine levelling
// provide policy (limits, remaining points, commit); this component owns the
// common card, controls, semantics, and interaction shape.
import { esc } from './tooltip.js';

export function renderStatAllocationCard(host, {
  title = 'ASSIGN POINTS',
  remaining = 0,
  remainingLabel = 'Points to assign',
  note = '',
  rows = [],
  modal = false,
  cancelLabel = 'Cancel',
  doneLabel = 'Done',
  doneDisabled = false,
  onDecrease = null,
  onIncrease = null,
  onCancel = null,
  onDone = null,
} = {}) {
  host.innerHTML = `<section class="${modal ? 'modal cc-stat-modal' : 'stat-allocation-card'}" tabindex="-1">`
    + `<h3 id="cc-stat-title">${esc(title)}</h3>`
    + `<p class="se-pool">${esc(remainingLabel)}: ${esc(String(remaining))}</p>`
    + (note ? `<p class="stat-allocation-note">${esc(note)}</p>` : '')
    + '<div class="cc-allocation-rows"></div>'
    + `<div class="cc-stat-actions"><button type="button" class="subtle" data-stat-cancel>${esc(cancelLabel)}</button>`
    + `<button type="button" data-stat-done aria-disabled="${doneDisabled ? 'true' : 'false'}">${esc(doneLabel)}</button></div>`
    + '</section>';

  const card = host.firstElementChild;
  const rowsHost = card.querySelector('.cc-allocation-rows');
  for (const rowModel of rows) {
    const row = document.createElement('div');
    row.className = 'se-row';
    row.innerHTML = `<span class="se-name" title="${esc(rowModel.label)}">${esc(rowModel.shortLabel || rowModel.label)}</span>`;
    const minus = document.createElement('button');
    minus.type = 'button'; minus.className = 'se-step'; minus.textContent = '−';
    minus.dataset.statId = rowModel.id; minus.dataset.statAction = 'decrease';
    minus.setAttribute('aria-label', `Decrease ${rowModel.label}`);
    minus.setAttribute('aria-disabled', rowModel.canDecrease ? 'false' : 'true');
    const number = document.createElement('span');
    number.className = 'se-value'; number.textContent = rowModel.value;
    const plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'se-step'; plus.textContent = '+';
    plus.dataset.statId = rowModel.id; plus.dataset.statAction = 'increase';
    plus.setAttribute('aria-label', `Increase ${rowModel.label}`);
    plus.setAttribute('aria-disabled', rowModel.canIncrease ? 'false' : 'true');
    minus.addEventListener('click', () => {
      if (rowModel.canDecrease && onDecrease) onDecrease(rowModel.id);
    });
    plus.addEventListener('click', () => {
      if (rowModel.canIncrease && onIncrease) onIncrease(rowModel.id);
    });
    row.append(minus, number, plus);
    rowsHost.appendChild(row);
  }

  const cancel = card.querySelector('[data-stat-cancel]');
  const done = card.querySelector('[data-stat-done]');
  cancel.addEventListener('click', () => onCancel && onCancel());
  done.addEventListener('click', () => {
    if (!doneDisabled && onDone) onDone();
  });
  return { card, rowsHost, cancel, done };
}
