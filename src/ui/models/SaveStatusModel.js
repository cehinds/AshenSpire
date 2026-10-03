// src/ui/models/SaveStatusModel.js — W1r, WHAT THE SAVE STATUS DOOR SAYS, DOM-free.
//
// RESPONSIVE-WIREFRAMES.md W1r: "Save game" over the run's identity, its
// destination (the active slot), when that slot was last written, and the
// status — Saved, or what went wrong — with Back and Save (Retry). Retry saves
// storage; it never repeats a gameplay transaction. The door is drawn by the
// shared confirmation frame (components/saveSlotSelector.js
// openSaveStatusReview); this file owns every word and the time formatting,
// so the words live in content/source/uiStrings.csv like the rest.

import { t } from '../strings.js';
import { runIdentity } from './ConfirmationReviewModel.js';

/**
 * savedAtLabel(iso, { locale, now }) → the moment a slot was last written, as a
 * player reads it: the time alone when it was today, the date and time
 * otherwise. Not relative ("5 minutes ago"): a relative label is wrong the
 * moment the door stays open, and the slot list is read at a glance.
 * An unreadable stamp prints nothing rather than "Invalid Date".
 */
export function savedAtLabel(iso, { locale = undefined, now = new Date() } = {}) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const sameDay = at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
  if (sameDay) return time;
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(at);
  return `${day}, ${time}`;
}

/**
 * saveStatusReview({ slot, className, facts, savedAt, error }) → the W1r slots.
 * `error` null means the save landed; an Error (or its message) means it did
 * not, the run is still in memory, and the primary is Retry.
 */
export function saveStatusReview({ slot, className, facts, savedAt = null, error = null }) {
  const slotNumber = Number(slot);
  if (!Number.isInteger(slotNumber) || slotNumber < 1) throw new Error(`saveStatusReview: '${slot}' is not a save slot`);
  const failed = error != null;
  const reason = failed ? String(error?.message ?? error) : '';
  const when = savedAt ? savedAtLabel(savedAt) : '';
  return Object.freeze({
    question: t('save.status.title'),
    target: runIdentity({ className: String(className ?? ''), slot: slotNumber, facts: String(facts ?? '') }),
    destination: t('save.status.destination', { slot: slotNumber }),
    lastSaved: when ? t('save.status.lastSaved', { when }) : t('save.status.neverSaved'),
    message: failed ? t('save.status.failed', { reason }) : t('save.status.saved'),
    confirmLabel: failed ? t('save.status.retry') : t('save.status.save'),
    failed,
  });
}
