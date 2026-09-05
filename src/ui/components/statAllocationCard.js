// Shared attribute-allocation card. Character creation and shrine levelling
// provide policy (limits, remaining points, commit); this component owns the
// common card, controls, semantics, and interaction shape.
//
// ON THE KIT: a Pane — Eyebrow + Title·S, a StatPair for the pool, a Flavour
// note, one Row·setting per attribute (the attribute's fold face on the left,
// a Segmented stepper −/value/+ on the right, the reveal dropping under the
// whole row) and a ButtonRow for Clear/Done. In modal form the same body is
// the md door's body and the ButtonRow is the door's own foot, through the
// one door-opener — the head, the close control, Escape and focus return are
// the shell's. The hooks the instruments read (`.se-pool`, `.se-row`,
// `.se-step`, `.se-value`, `.se-controls`, `[data-stat-action]`,
// `[data-stat-done]`, `[data-stat-cancel]`, `#cc-stat-title`, `.cc-stat-modal`,
// `.cc-stat-overlay`) ride on the kit elements.
import { primaryStatCards } from './creationCards.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import {
  el, eyebrow, titleS, flavour, hairline, statPair, row, button, buttonRow, openModal,
} from '../kit/index.js';

function stepperFor(rowModel, { onDecrease, onIncrease }) {
  const step = (glyph, action, allowed, label) => {
    const control = el('button', {
      type: 'button', class: 'se-step', text: glyph,
      dataset: { statId: rowModel.id, statAction: action },
      'aria-label': `${label} ${rowModel.label}`,
      'aria-disabled': allowed ? 'false' : 'true',
    });
    control.addEventListener('click', () => { if (allowed) (action === 'decrease' ? onDecrease : onIncrease)?.(rowModel.id); });
    return control;
  };
  return el('span', { class: 'as-seg stepper se-controls' }, [
    step('−', 'decrease', rowModel.canDecrease, 'Decrease'),
    el('span', { class: 'seg-value se-value', text: String(rowModel.value) }),
    step('+', 'increase', rowModel.canIncrease, 'Increase'),
  ]);
}

function drawRows(rowsHost, rows, handlers) {
  const attributes = primaryStatCards(rows.map((rowModel) => ({
      ...rowModel.card,
      face: { ...rowModel.card.face, value: '' },
  })));
  rowsHost.replaceChildren(...rows.map((rowModel, index) => {
    const attribute = attributes[index];
    attribute.classList.add('se-attribute-card');
    const line = row({
      tag: 'div', setting: true, className: 'se-row',
      labelNode: attribute,
      trail: stepperFor(rowModel, handlers),
    });
    return markUiComponent(line, UI.statAllocationRow);
  }));
}

/**
 * renderStatAllocationCard(host, spec) → { card, rowsHost, cancel, done, close, update }
 *
 * `modal: false` draws the Pane into `host` (the shrine's level fold).
 * `modal: true` opens the md door over `host` and returns its panel as the
 * card; `update({ remaining, rows, doneDisabled })` redraws the rows and the
 * pool in place, so a stepper press never re-opens the door.
 */
export function renderStatAllocationCard(host, {
  title = 'Assign points',
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
  onClose = null,
} = {}) {
  let disabled = doneDisabled;
  const pool = statPair({ key: remainingLabel, value: String(remaining), attrs: { class: 'se-pool' } });
  const rowsHost = el('div', { class: 'as-stack tight cc-allocation-rows' });
  drawRows(rowsHost, rows, { onDecrease, onIncrease });
  const cancel = button({ label: cancelLabel, attrs: { 'data-stat-cancel': '' } });
  const done = button({ label: doneLabel, weight: 'primary', attrs: { 'data-stat-done': '', 'aria-disabled': disabled ? 'true' : 'false' } });
  cancel.addEventListener('click', () => onCancel && onCancel());
  done.addEventListener('click', () => { if (!disabled && onDone) onDone(); });

  const body = [pool, note ? flavour(note, { class: 'stat-allocation-note' }) : null, hairline(), rowsHost];
  let card;
  let close = () => {};
  if (modal) {
    const door = openModal({
      size: 'md', className: 'cc-stat-modal', eyebrow: 'Attributes', title, titleId: 'cc-stat-title',
      body: el('div', { class: 'as-pane stat-allocation-card' }, body),
      secondary: [cancel], primary: done, footSize: 'medium', host, onClose,
    });
    door.veil.classList.add('cc-stat-overlay');
    card = door.panel;
    close = door.close;
  } else {
    card = el('section', { class: 'as-pane flush stat-allocation-card', tabindex: '-1' }, [
      eyebrow('Attributes'),
      titleS(title, { tag: 'h3', id: 'cc-stat-title' }),
      ...body,
      buttonRow({ size: 'medium', buttons: [cancel, done], className: 'cc-stat-actions' }),
    ]);
    host.innerHTML = '';
    host.appendChild(card);
  }

  return {
    card, rowsHost, cancel, done, close,
    update({ remaining: nextRemaining = remaining, rows: nextRows = rows, doneDisabled: nextDisabled = disabled } = {}) {
      pool.querySelector('.sp-v').textContent = String(nextRemaining);
      drawRows(rowsHost, nextRows, { onDecrease, onIncrease });
      disabled = nextDisabled;
      done.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    },
  };
}
