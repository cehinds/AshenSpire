// src/ui/components/saveWipeNotice.js — the title's one-line "old saves were
// cleared" notice (owner, 2026-11-18; src/engine/buildWipe.js). A plain polite
// status line at the top of the title; it takes no focus and blocks nothing.

export const SAVE_WIPE_NOTICE_TEXT = 'Saves from an older build were cleared.';

/** Draws (or removes) the notice as the first child of the title root. */
export function DrawSaveWipeNotice(root, show) {
  if (!root || typeof root.querySelector !== 'function') return null;
  const existing = root.querySelector(':scope > .save-wipe-notice');
  if (!show) { existing?.remove(); return null; }
  if (existing) return existing;
  root.insertAdjacentHTML('afterbegin', `<p class="save-wipe-notice" role="status" aria-live="polite" data-save-wipe-notice>${SAVE_WIPE_NOTICE_TEXT}</p>`);
  return root.querySelector(':scope > .save-wipe-notice');
}
