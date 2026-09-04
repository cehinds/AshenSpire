// Shared Load-slot surface for Title and the in-run Quick Menu. Selection is
// projected by SaveSlotSelectionModel; callers only decide what a confirmed
// exact slot means. The component never reads or mutates save storage.
//
// THE DOOR IS THE KIT'S. A slot is an OptionCard (glyph + name + the climb's
// facts + a state pill), the list is `options`, the delete is the one
// IconButton box, the chrome is modalHead + modalFooter, and the review is
// body C (Title·L + Ornament + DetailCard + prompt). Title's NEW GAME door is
// built from the same builders below (`slotDoor`), so the two doors cannot
// drift — one home for what a save slot looks like.

import { saveSlotSelectionModel } from '../models/SaveSlotSelectionModel.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { focusElement } from '../input.js';
import { armHold, beatArmer } from '../../framework/optionDecision.js';
import { hideTooltip } from './tooltip.js';
import { mountTitleSaveSlotTooltip } from './titleSaveSlotTooltip.js';
import {
  el, html, modalHead, modalFooter, button, iconButton, optionCard, optionRow, options, decide, detailCard, ornament, pill,
} from '../kit/index.js';

let activeSelector = null;

/** slotFacts(summary) → the one line of facts a slot card and its review share. */
export function slotFacts(summary) {
  return summary ? `Act ${summary.actNumber} · Floor ${summary.floor} · ${summary.hp}/${summary.maxHp} HP` : 'No climb saved here';
}

/**
 * slotOption({ slot, summary, selected, selectable, deletable, hint }) → the
 * OptionCard row for one save slot, with the delete box (or its spacer) so
 * every row ends on the same edge.
 */
export function slotOption({ slot, summary, selected = false, selectable = true, deletable = false, hint = '' }) {
  const card = optionCard({
    glyph: summary ? '▣' : '▢',
    name: summary ? summary.className : 'Empty',
    badge: pill({ label: `Slot ${slot}`, attrs: { class: 'title-slot-tag' } }),
    description: slotFacts(summary),
    meta: summary ? `Seed ${summary.seedString}` : '',
    trail: pill({ label: summary ? 'Ready' : 'Empty', on: !!summary, attrs: { class: 'title-slot-state', 'data-component': UI.titleSaveSlotState } }),
    selected,
    disabled: !selectable,
    arrow: false,
    className: `title-slot-pick${summary ? ' is-filled' : ''}`,
    attrs: {
      dataset: { slotPick: slot },
      ...(hint ? { title: hint.title, 'aria-label': hint.label } : {}),
    },
  });
  card.querySelector('.ob').classList.add('title-slot-copy');
  card.querySelector('.ob').dataset.component = UI.titleSaveSlotCopy;
  const trailing = deletable
    ? iconButton({ glyph: '✕', label: `Delete slot ${slot}`, className: 'title-slot-delete', attrs: { dataset: { slotDelete: slot, component: UI.titleSaveSlotDelete } } })
    : iconButton({ glyph: '✕', label: 'No save to delete', className: 'title-slot-delete', attrs: { dataset: { slotSpacer: '' }, tabindex: '-1', disabled: true, 'aria-hidden': 'true', style: { visibility: 'hidden' } } });
  const rowEl = optionRow(card, trailing, {
    class: `title-slot-row${selected ? ' is-selected' : ''}${!selectable ? ' is-empty' : ''}`,
    'data-component': UI.titleSaveSlot,
  });
  return rowEl;
}

/**
 * slotDoor({ eyebrow, title, closeLabel, rows, backLabel, continueLabel, canContinue, actionSlot, backAction })
 * → the <section class="modal"> for a slot list — LOAD GAME and NEW GAME wear
 * exactly this. The caller wraps it in its own veil and wires by delegation.
 */
export function slotDoor({ eyebrow, title, closeLabel, rows, backLabel = 'Back', continueLabel = 'Continue', canContinue = false, actionSlot = null, backAction = 'back', className = '' }) {
  const head = modalHead({ eyebrow, title, titleId: 'title-modal-heading', closeLabel });
  const close = head.querySelector('.modal-close');
  close.classList.add('title-modal-close');
  close.dataset.component = UI.titleModalCloseControl;
  close.dataset.titleAction = 'close-modal';
  head.querySelector('#title-modal-heading').dataset.component = UI.titleModalHeading;

  const back = button({ label: backLabel, className: 'title-modal-back', attrs: { dataset: { titleAction: backAction, component: UI.titleModalBackControl } } });
  const forward = button({ label: continueLabel, weight: 'primary', className: 'title-modal-continue', disabled: !canContinue, attrs: { dataset: { titleAction: 'modal-continue', actionSlot: actionSlot ?? '', component: UI.titleModalContinueControl } } });
  const foot = modalFooter({ secondary: [back], primary: forward, size: 'medium' });
  foot.querySelector('.modal-foot-actions').dataset.component = UI.titleModalActions;

  const body = el('div', { class: 'modal-body' }, decide({
    children: [
      ornament({ 'data-component': UI.titleModalDivider }),
      options(rows, { class: 'title-slot-list', 'data-component': UI.titleSaveSlotList, 'aria-label': 'Save slots' }),
    ],
  }));
  return el('section', {
    class: `modal title-menu-modal${className ? ` ${className}` : ''}`,
    dataset: { size: 'sm', component: UI.titleMenuModal },
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-modal-heading',
  }, [head, body, foot]);
}

/**
 * THE SLOT DECISION DOOR — body C, one shape for the four questions a slot
 * can ask (Constantine, 2026-09-04: "a dynamic modal for loading, overwriting
 * or starting a new game confirmation"). The head asks the question, the
 * body shows what is at stake (the DetailCard of the save, when there is
 * one) and the foot answers it: Back, or the one committing action.
 *
 *   load + occupied → "Load slot n?"       Load Save     (review-load)
 *   load + empty    → "Slot n is empty"    New Game      (review-new)
 *   new  + empty    → "Start in slot n?"   Start         (review-new)
 *   new  + occupied → "Overwrite slot n?"  Overwrite     (review-new, danger)
 *
 * `.title-load-review` and `data-variant` are the hooks the instruments read;
 * `title-modal-heading` is the door's one heading.
 */
const SLOT_DECISIONS = {
  'load:occupied': { eyebrow: 'Load game', closeLabel: 'Close Load Game', variant: 'load-review', title: (n) => `Load slot ${n}?`, prompt: 'Load this saved climb now?', back: 'Back to Saves', confirm: 'Load Save', action: 'review-load', card: true, danger: false },
  'load:empty': { eyebrow: 'Load game', closeLabel: 'Close Load Game', variant: 'load-empty', title: (n) => `Slot ${n} is empty`, prompt: 'Nothing is saved here yet. Start a new climb in this slot?', back: 'Back to Saves', confirm: 'New Game', action: 'review-new', card: false, danger: false },
  'new:empty': { eyebrow: 'New game', closeLabel: 'Close New Game', variant: 'new-start', title: (n) => `Start in slot ${n}?`, prompt: 'This slot is empty. The new climb will be saved here.', back: 'Back to Slots', confirm: 'Start', action: 'review-new', card: false, danger: false },
  'new:occupied': { eyebrow: 'New game', closeLabel: 'Close New Game', variant: 'new-overwrite', title: (n) => `Overwrite slot ${n}?`, prompt: 'Starting here erases this saved climb. There is no way back.', back: 'Back to Slots', confirm: 'Overwrite', action: 'review-new', card: true, danger: true },
};

export function slotDecisionDoor({ kind, slot, summary = null }) {
  const spec = SLOT_DECISIONS[`${kind}:${summary ? 'occupied' : 'empty'}`];
  if (!spec) throw new Error(`slotDecisionDoor: no decision for kind '${kind}'`);
  const head = modalHead({ eyebrow: spec.eyebrow, title: spec.title(slot), titleId: 'title-modal-heading', closeLabel: spec.closeLabel });
  const close = head.querySelector('.modal-close');
  close.classList.add('title-modal-close');
  close.dataset.component = UI.titleModalCloseControl;
  close.dataset.titleAction = 'close-modal';
  head.querySelector('#title-modal-heading').dataset.component = UI.titleModalHeading;
  let card = null;
  if (spec.card && summary) {
    card = detailCard({ eyebrow: `Slot ${slot}`, name: summary.className, line: slotFacts(summary), meta: `Seed ${summary.seedString}` });
    card.classList.add('title-load-review-slot');
    if (spec.danger) card.classList.add('muted');
    card.dataset.component = UI.titleSaveSlot;
    card.setAttribute('aria-label', 'Selected save summary');
  }
  const body = el('div', { class: 'modal-body' }, decide({
    children: [ornament({ 'data-component': UI.titleModalDivider }), card],
    prompt: spec.prompt,
  }));
  const back = button({ label: spec.back, className: 'title-modal-back title-load-review-back', attrs: { dataset: { titleAction: 'review-back', component: UI.titleModalBackControl } } });
  const confirm = button({
    label: spec.confirm, weight: 'primary', className: `title-load-review-confirm${spec.danger ? ' danger' : ''}`,
    attrs: { dataset: { titleAction: spec.action, component: UI.titleModalContinueControl, actionSlot: slot } },
  });
  const foot = modalFooter({ secondary: [back], primary: confirm, size: 'medium' });
  foot.querySelector('.modal-foot-actions').dataset.component = UI.titleModalActions;
  return el('section', {
    class: 'modal title-menu-modal title-load-review',
    dataset: { size: 'sm', component: UI.titleMenuModal, variant: spec.variant },
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'title-modal-heading',
  }, [head, body, foot]);
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
  onRequestNew = null,
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
  // An empty slot's one answer: start a new climb there (the title's onNew).
  const requestNew = (slot, trigger) => {
    if (slot == null || typeof onRequestNew !== 'function') return;
    close({ restoreFocus: false });
    onRequestNew(slot, { trigger, returnFocusElement });
  };
  const openReview = (slot) => {
    if (slot == null) return;
    loadReviewSlot = slot;
    render();
    focus('[data-title-action="review-load"], [data-title-action="review-new"]');
  };

  const slotRows = (selection) => selection.children
    .filter((child) => child.component === UI.titleSaveSlot)
    .map(({ properties }) => {
      const { slot, selectable, selected } = properties;
      const record = slots.find((candidate) => candidate.slot === slot);
      const summary = record?.summary || null;
      const hint = summary ? {
        title: `Select slot ${slot}. Hold to ${inlineReview ? 'load now' : 'review this load'}; activate the selected slot again to review.`,
        label: `Slot ${slot}, ${summary.className}. Hold to ${inlineReview ? 'load now' : 'review this load'}; activate twice to review.`,
      } : {
        title: `Slot ${slot} is empty. Select it, then Continue to start a new climb here.`,
        label: `Slot ${slot}, empty. Activate twice to start a new game here.`,
      };
      return slotOption({ slot, summary, selected, selectable, deletable: !!(onDelete && summary), hint });
    });

  const render = () => {
    if (closed) return;
    clearSlotHolds();
    tooltipCleanup?.();
    tooltipCleanup = null;
    veil.innerHTML = '';
    if (inlineReview && loadReviewSlot != null) {
      const record = slots.find(({ slot }) => slot === loadReviewSlot);
      veil.appendChild(slotDecisionDoor({ kind: 'load', slot: loadReviewSlot, summary: record?.summary || null }));
      return;
    }

    const selection = model();
    veil.appendChild(slotDoor({
      eyebrow: 'Load game',
      title: 'Choose a slot',
      closeLabel: 'Close Load Game',
      rows: slotRows(selection),
      backLabel: 'Back',
      continueLabel: 'Continue',
      canContinue: !!selection.properties.canContinue,
      actionSlot: selection.properties.actionSlot,
    }));

    const duration = Number(registries?.balance?.ui?.titleLoadHold?.ms);
    const holdMs = Number.isFinite(duration) && duration > 0 ? duration : 600;
    veil.querySelectorAll('.title-slot-pick.is-filled').forEach((slotButton) => {
      const slot = Number(slotButton.dataset.slotPick);
      let clearPendingRelease = null;
      const disarmHold = armHold(slotButton, {
        ms: holdMs,
        id: 'loadSave',
        pointerOnly: true,
        hintHost: slotButton,
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
            slotButton.removeEventListener('pointerup', release);
            slotButton.removeEventListener('pointercancel', cancel);
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
          slotButton.addEventListener('pointerup', release);
          slotButton.addEventListener('pointercancel', cancel);
        },
      });
      holdCleanups.push(() => {
        clearPendingRelease?.();
        disarmHold();
      });
    });

    if (onDelete && meta && registries) {
      const arm = beatArmer(meta, registries);
      veil.querySelectorAll('.title-slot-delete[data-slot-delete]').forEach((deleteButton) => {
        arm(deleteButton, 'deleteSave', {
          onConfirm: () => {
            const slot = Number(deleteButton.dataset.slotDelete);
            close({ restoreFocus: false });
            onDelete(slot);
          },
        });
        deleteButton.title = deleteButton.dataset.holdMs ? 'Hold to delete this run' : 'Delete this run';
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
      if (inlineReview) openReview(slot);
      else requestLoad(slot, 'repeat');
      return;
    }
    selectedSlot = slot;
    activatedLoadSlot = slot;
    render();
    focus(`[data-slot-pick="${selectedSlot}"]`);
  };

  veil.addEventListener('click', (event) => {
    if (event.target === veil) return close();
    const control = event.target.closest('[data-title-action], [data-slot-pick]');
    if (!control || !veil.contains(control)) return;
    const action = control.dataset.titleAction;
    if (action === 'close-modal' || action === 'back') close();
    else if (action === 'review-back') {
      const slot = loadReviewSlot;
      loadReviewSlot = null;
      render();
      focus(`[data-slot-pick="${slot}"]`);
    } else if (action === 'review-load') requestLoad(loadReviewSlot, 'review');
    else if (action === 'review-new') requestNew(loadReviewSlot, 'review');
    else if (action === 'modal-continue') {
      // Continue asks before it acts: the decision door is the confirmation.
      if (inlineReview) openReview(model().properties.actionSlot);
      else requestLoad(model().properties.actionSlot, 'continue');
    }
    else if (control.dataset.slotPick && !control.classList.contains('is-filled')) activateSlot(Number(control.dataset.slotPick));
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

// Kept for the title screen's string renderer: the same card, serialised.
export function saveSlotCopyHtml({ slot, summary }) {
  return html(slotOption({ slot, summary }).querySelector('.title-slot-copy'));
}
