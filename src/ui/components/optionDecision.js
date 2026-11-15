import { t } from '../strings.js';
// One interaction contract for state-changing options:
//   short click/press -> review the exact consequence and optional cost
//   (owner, 2026-11-14: the chooser's Confirm is a plain click. A hold used to
//   commit the same action without the modal; it no longer does, so the hold
//   dial neither lengthens nor shortens anything here.)
// Navigation and disclosure controls do not use this component.

import { armHold } from './holdconfirm.js';
import { openConfirmationModal } from './confirmationModal.js';
import { ACTIONS, beatFor } from '../../model/secondbeat.js';

export function armOptionDecision(control, {
  meta,
  registries,
  id,
  title,
  message,
  consequence = '',
  detailsHtml = '',
  detailsNode = null,
  blockedDetailsNode = null,
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.back'),
  tone = 'normal',
  onCommit,
  canCommit = () => true,
  blockedTitle = title,
  blockedMessage = message,
  blockedDetailsHtml = detailsHtml,
  returnFocusElement = control,
  ctx = {},
} = {}) {
  if (!(control instanceof HTMLElement)) throw new Error('option decision needs a control element');
  if (typeof onCommit !== 'function') throw new Error('option decision needs one commit callback');
  const allowed = () => Boolean(canCommit());
  const duration = 0;
  control.dataset.optionDecision = id || 'state-change';
  control.dataset.optionTap = 'modal';
  control.dataset.optionHold = duration > 0 ? 'commit' : (allowed() ? 'disabled' : 'blocked');
  // EVERY ARMED CONTROL MARKS ITSELF (holdconfirm.js beatArmer): a declared
  // action that draws no `data-beat-action` reads as "not wired" to the
  // census in tools/holdconfirm.mjs, which is what the Smith's Confirm read as
  // for as long as this door existed ('11 claimed, 3 absent: … smithUpgrade').
  // Marked only for an id the table declares — an undeclared id would be the
  // other lie the census reads for, a control nobody declared.
  if (id && Object.hasOwn(ACTIONS, id)) {
    control.dataset.beatAction = id;
    control.dataset.beat = beatFor(id, ctx).form;
  }

  const commit = () => { if (allowed()) onCommit(); };
  const review = () => openConfirmationModal({
    title: allowed() ? title : blockedTitle,
    message: allowed() ? message : blockedMessage,
    consequence,
    detailsHtml: allowed() ? detailsHtml : blockedDetailsHtml,
    // A function is called at each opening, so a re-opened review gets fresh live nodes (inspection handlers intact).
    detailsNode: (() => { const make = allowed() ? detailsNode : blockedDetailsNode; return typeof make === 'function' ? make() : make; })(),
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
