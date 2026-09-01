// One interaction contract for state-changing options:
//   short click/press -> review the exact consequence and optional cost
//   deliberate hold  -> commit the same validated action without the modal
// Navigation and disclosure controls do not use this component.

import { armHold, holdMs } from './holdconfirm.js';
import { openConfirmationModal } from './confirmationModal.js';

export function armOptionDecision(control, {
  meta,
  registries,
  id,
  title,
  message,
  consequence = '',
  detailsHtml = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Back',
  tone = 'normal',
  onCommit,
  canCommit = () => true,
  blockedTitle = title,
  blockedMessage = message,
  blockedDetailsHtml = detailsHtml,
  returnFocusElement = control,
} = {}) {
  if (!(control instanceof HTMLElement)) throw new Error('option decision needs a control element');
  if (typeof onCommit !== 'function') throw new Error('option decision needs one commit callback');
  const allowed = () => Boolean(canCommit());
  const duration = allowed() ? holdMs((meta && meta.settings) || {}, registries.balance.ui.holdConfirm) : 0;
  control.dataset.optionDecision = id || 'state-change';
  control.dataset.optionTap = 'modal';
  control.dataset.optionHold = duration > 0 ? 'commit' : (allowed() ? 'disabled' : 'blocked');

  const commit = () => { if (allowed()) onCommit(); };
  const review = () => openConfirmationModal({
    title: allowed() ? title : blockedTitle,
    message: allowed() ? message : blockedMessage,
    consequence,
    detailsHtml: allowed() ? detailsHtml : blockedDetailsHtml,
    confirmLabel,
    cancelLabel,
    tone,
    confirmEnabled: allowed(),
    onConfirm: commit,
    returnFocusElement,
  });

  const disarm = armHold(control, {
    ms: duration,
    id,
    onTap: review,
    onConfirm: commit,
    tapOnEarlyRelease: true,
  });
  return Object.assign(disarm, { review });
}
