// Shared Load-slot surface for Title and the in-run Quick Menu. Selection is
// projected by SaveSlotSelectionModel; callers only decide what a confirmed
// exact slot means. The component never reads or mutates save storage.

import { saveSlotSelectionModel } from '../models/SaveSlotSelectionModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { focusElement } from '../input.js';
import { armHold, beatArmer } from '../../framework/optionDecision.js';
import { esc, hideTooltip } from './tooltip.js';
import { mountTitleSaveSlotTooltip } from './titleSaveSlotTooltip.js';

let activeSelector = null;

export function saveSlotCopyHtml({ slot, summary }) {
  if (!summary) {
    return `<span class="title-slot-tag">SLOT ${slot}</span><span class="title-slot-empty">Empty</span>`;
  }
  return `<span class="title-slot-tag">SLOT ${slot}</span>
    <span class="title-slot-name">${esc(summary.className)}</span>
    <span class="title-slot-meta">Act ${summary.actNumber} · Floor ${summary.floor} · ${summary.hp}/${summary.maxHp} HP</span>
    <span class="title-slot-seed">SEED ${esc(summary.seedString)}</span>`;
}

export function closeSaveSlotSelector({ restoreFocus = true } = {}) {
  activeSelector?.close({ restoreFocus });
}

export function openSaveSlotSelector({
  host = document.body,
  slots = [],
  meta = null,
  registries,
  returnFocusElement = null,
  inlineReview = false,
  onRequestLoad,
  onDelete = null,
} = {}) {
  closeSaveSlotSelector({ restoreFocus: false });

  const veil = document.createElement('div');
  veil.className = 'modal-veil title-modal-veil';
  veil.dataset.titleModalScrim = '';
  let selectedSlot = saveSlotSelectionModel(slots, { kind: 'load' }).properties.selectedSlot;
  let activatedLoadSlot = null;
  let loadReviewSlot = null;
  let closed = false;
  let holdCleanups = [];
  let tooltipCleanup = null;

  const clearSlotHolds = () => {
    for (const cleanup of holdCleanups.splice(0)) cleanup();
  };

  const model = () => saveSlotSelectionModel(slots, { kind: 'load', selectedSlot });
  const selectedButton = () => veil.querySelector(`[data-slot-pick="${selectedSlot}"]`);
  const focus = (selector = '.title-slot-pick:not([disabled]), .title-modal-back') => {
    const control = veil.querySelector(selector);
    if (!control) return false;
    control.focus({ preventScroll: true });
    focusElement(control);
    return document.activeElement === control;
  };
  const restoreLauncher = () => {
    if (!returnFocusElement?.isConnected) return;
    returnFocusElement.focus({ preventScroll: true });
    focusElement(returnFocusElement);
  };
  const close = ({ restoreFocus = true } = {}) => {
    if (closed) return;
    closed = true;
    clearSlotHolds();
    tooltipCleanup?.();
    tooltipCleanup = null;
    hideTooltip();
    veil.remove();
    if (activeSelector?.veil === veil) activeSelector = null;
    if (restoreFocus) queueMicrotask(restoreLauncher);
  };
  const requestLoad = (slot, trigger) => {
    const record = slots.find((candidate) => candidate.slot === slot);
    if (!record?.summary || typeof onRequestLoad !== 'function') return;
    close({ restoreFocus: false });
    onRequestLoad(slot, { trigger, returnFocusElement });
  };

  const slotRows = (selection) => selection.children
    .filter((child) => child.component === UI.titleSaveSlot)
    .map(({ properties }) => {
      const { slot, selectable, selected } = properties;
      const record = slots.find((candidate) => candidate.slot === slot);
      const summary = record?.summary || null;
      const hint = summary
        ? ` title="Select slot ${slot}. Hold to ${inlineReview ? 'load now' : 'review this load'}; activate the selected slot again to review." aria-label="Slot ${slot}, ${esc(summary.className)}. Hold to ${inlineReview ? 'load now' : 'review this load'}; activate twice to review."`
        : '';
      return `<div class="title-slot-row${selected ? ' is-selected' : ''}${!selectable ? ' is-empty' : ''}" data-component="title-save-slot">
        <button class="title-slot-pick${summary ? ' is-filled' : ''}" type="button" data-slot-pick="${slot}" aria-pressed="${selected}"${hint}${selectable ? '' : ' disabled'}>
          <span class="title-slot-copy" data-component="title-save-slot-copy">${saveSlotCopyHtml({ slot, summary })}</span>
          <span class="title-slot-state" data-component="title-save-slot-state">${summary ? 'READY' : 'EMPTY'}</span>
        </button>
        ${onDelete ? (summary
          ? `<button class="subtle title-slot-delete" data-component="title-save-slot-delete" type="button" data-slot-delete="${slot}" aria-label="Delete slot ${slot}">✕</button>`
          // An empty slot has nothing to delete and still holds the gutter open,
          // so every row in the list ends on the same edge. Hidden, disabled and
          // aria-hidden: furniture, not a control (styles/ui.css).
          : '<button class="subtle title-slot-delete" data-slot-spacer type="button" tabindex="-1" disabled aria-hidden="true">✕</button>') : ''}
      </div>`;
    }).join('');

  const render = () => {
    if (closed) return;
    clearSlotHolds();
    tooltipCleanup?.();
    tooltipCleanup = null;
    if (inlineReview && loadReviewSlot != null) {
      const record = slots.find(({ slot }) => slot === loadReviewSlot);
      if (record?.summary) {
        veil.innerHTML = `<section class="modal title-menu-modal title-load-review" data-component="title-menu-modal" data-variant="load-review" role="dialog" aria-modal="true" aria-labelledby="title-modal-heading">
          <button class="subtle modal-close title-modal-close" data-component="title-modal-close-control" type="button" data-title-action="close-modal" aria-label="Close Load Game" title="Close Load Game (Esc)">✕</button>
          <h2 id="title-modal-heading" data-component="title-modal-heading">LOAD SLOT ${record.slot}?</h2>
          <div class="title-modal-rule" data-component="title-modal-divider" aria-hidden="true"><span></span></div>
          <article class="title-load-review-slot" data-component="title-save-slot" aria-label="Selected save summary">
            <span class="title-slot-copy" data-component="title-save-slot-copy">${saveSlotCopyHtml(record)}</span>
          </article>
          <p class="title-load-review-copy">Load this saved climb now?</p>
          <div class="title-modal-actions" data-component="title-modal-actions">
            <button class="title-modal-back title-load-review-back" data-component="title-modal-back-control" type="button" data-title-action="review-back">BACK TO SAVES</button>
            <button class="primary title-load-review-confirm" data-component="title-modal-continue-control" type="button" data-title-action="review-load">LOAD SAVE</button>
          </div>
        </section>`;
        return;
      }
      loadReviewSlot = null;
    }

    const selection = model();
    veil.innerHTML = `<section class="modal title-menu-modal" data-component="title-menu-modal" role="dialog" aria-modal="true" aria-labelledby="title-modal-heading">
      <button class="subtle modal-close title-modal-close" data-component="title-modal-close-control" type="button" data-title-action="close-modal" aria-label="Close Load Game" title="Close Load Game (Esc)">✕</button>
      <h2 id="title-modal-heading" data-component="title-modal-heading">LOAD GAME</h2>
      <div class="title-modal-rule" data-component="title-modal-divider" aria-hidden="true"><span></span></div>
      <div class="title-slot-list" data-component="title-save-slot-list" aria-label="Save slots">${slotRows(selection)}</div>
      <div class="title-modal-actions" data-component="title-modal-actions">
        <button class="title-modal-back" data-component="title-modal-back-control" type="button" data-title-action="back">BACK</button>
        <button class="primary title-modal-continue" data-component="title-modal-continue-control" type="button" data-title-action="modal-continue" data-action-slot="${selection.properties.actionSlot ?? ''}"${selection.properties.canContinue ? '' : ' disabled'}>CONTINUE</button>
      </div>
    </section>`;

    const duration = Number(registries?.balance?.ui?.titleLoadHold?.ms);
    const holdMs = Number.isFinite(duration) && duration > 0 ? duration : 600;
    veil.querySelectorAll('.title-slot-pick.is-filled').forEach((button) => {
      const slot = Number(button.dataset.slotPick);
      let clearPendingRelease = null;
      const disarmHold = armHold(button, {
        ms: holdMs,
        id: 'loadSave',
        pointerOnly: true,
        hintHost: button,
        onTap: () => activateSlot(slot),
        onConfirm: (startEvent) => {
          hideTooltip();
          if (inlineReview) {
            requestLoad(slot, 'hold');
            return;
          }

          // armHold completes while the pointer is still down. Opening the
          // Quick Menu confirmation at that instant lets the trailing touch
          // release hit-test the new veil and cancel it. Retain this selector
          // as the input owner until the same pointer ends, then cross the
          // navigation boundary on the next task after its click is swallowed.
          const pointerId = startEvent?.pointerId;
          if (!Number.isInteger(pointerId)) return;
          const clear = () => {
            button.removeEventListener('pointerup', release);
            button.removeEventListener('pointercancel', cancel);
            if (clearPendingRelease === clear) clearPendingRelease = null;
          };
          const release = (endEvent) => {
            if (endEvent.pointerId !== pointerId) return;
            clear();
            setTimeout(() => { if (!closed) requestLoad(slot, 'hold'); }, 0);
          };
          const cancel = (endEvent) => {
            if (endEvent.pointerId === pointerId) clear();
          };
          clearPendingRelease?.();
          clearPendingRelease = clear;
          button.addEventListener('pointerup', release);
          button.addEventListener('pointercancel', cancel);
        },
      });
      holdCleanups.push(() => {
        clearPendingRelease?.();
        disarmHold();
      });
    });

    if (onDelete && meta && registries) {
      const arm = beatArmer(meta, registries);
      veil.querySelectorAll('.title-slot-delete').forEach((button) => {
        arm(button, 'deleteSave', {
          onConfirm: () => {
            const slot = Number(button.dataset.slotDelete);
            close({ restoreFocus: false });
            onDelete(slot);
          },
        });
        button.title = button.dataset.holdMs ? 'Hold to delete this run' : 'Delete this run';
      });
    }

    tooltipCleanup = mountTitleSaveSlotTooltip({
      root: veil,
      owner: selectedButton(),
    });
  };

  const activateSlot = (slot) => {
    hideTooltip();
    if (selectedSlot === slot && activatedLoadSlot === slot) {
      if (inlineReview) {
        loadReviewSlot = slot;
        render();
        focus('[data-title-action="review-load"]');
      } else {
        requestLoad(slot, 'repeat');
      }
      return;
    }
    selectedSlot = slot;
    activatedLoadSlot = slot;
    render();
    focus(`[data-slot-pick="${selectedSlot}"]`);
  };

  veil.addEventListener('click', (event) => {
    if (event.target === veil) return close();
    const button = event.target.closest('[data-title-action], [data-slot-pick]');
    if (!button || !veil.contains(button)) return;
    const action = button.dataset.titleAction;
    if (action === 'close-modal' || action === 'back') close();
    else if (action === 'review-back') {
      const slot = loadReviewSlot;
      loadReviewSlot = null;
      render();
      focus(`[data-slot-pick="${slot}"]`);
    } else if (action === 'review-load') requestLoad(loadReviewSlot, 'review');
    else if (action === 'modal-continue') requestLoad(model().properties.actionSlot, 'continue');
    else if (button.dataset.slotPick && !button.classList.contains('is-filled')) activateSlot(Number(button.dataset.slotPick));
  });
  veil.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (loadReviewSlot != null) {
        const slot = loadReviewSlot;
        loadReviewSlot = null;
        render();
        focus(`[data-slot-pick="${slot}"]`);
      } else close();
    } else if (event.key === 'Tab') {
      const controls = [...veil.querySelectorAll('.title-menu-modal button:not([disabled])')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    }
  });

  host.appendChild(veil);
  activeSelector = { veil, close };
  render();
  queueMicrotask(() => focus(selectedSlot == null ? undefined : `[data-slot-pick="${selectedSlot}"]`));
  return activeSelector;
}
