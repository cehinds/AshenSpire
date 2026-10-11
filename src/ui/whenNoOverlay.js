// src/ui/whenNoOverlay.js — run a screen redraw only when nothing is open over
// the screen (docs/EXTERNAL-ASSETS-PLAN.md step 5, review of #1471).
//
// A Retry or a tier switch that loads the art after a failed boot redraws the
// title. Redrawn under an open dialog (Settings, the title's Load/New door), it
// would replace the control that dialog returns focus to, and closing it would
// leave focus on <body>. So the redraw waits until the last dialog has closed.

import { modalOpen, onModalsClosed } from './modalState.js';

/** What counts as open over the screen: any modal dialog, or the title's own door. */
export const OVERLAY_SELECTOR = '[aria-modal="true"], .title-modal-veil';

/**
 * True when a dialog or the title's door is open. The registered modals
 * (modalState.js) are asked first; the DOM check stays for the ad-hoc modals
 * that do not register yet.
 */
export function overlayOpen(doc = globalThis.document) {
  if (modalOpen()) return true;
  try { return !!doc?.querySelector?.(OVERLAY_SELECTOR); } catch { return false; }
}

/**
 * whenNoOverlay(run, { doc, Observer }) — `run` now when nothing is open, else
 * once the page has changed so that nothing is (a MutationObserver on the
 * body). Returns a canceller. Without an observer the run is dropped: the
 * screen keeps its re-pointed images rather than being redrawn under a dialog.
 *
 * The observer stays the authority on the DOM. The modal registry adds a
 * second trigger: when the last registered modal closes, the redraw is checked
 * at once. A check that still finds an overlay in the DOM leaves the observer
 * to finish the job after the veil is removed.
 */
export function whenNoOverlay(run, { doc = globalThis.document, Observer = globalThis.MutationObserver } = {}) {
  if (!overlayOpen(doc)) { run(); return () => {}; }
  if (typeof Observer !== 'function' || !doc?.body) return () => {};
  let done = false;
  let cancelWait = () => {};
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    cancelWait();
    run();
  };
  const observer = new Observer(() => {
    if (done || overlayOpen(doc)) return;
    finish();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'class'] });
  cancelWait = onModalsClosed(() => {
    if (done || overlayOpen(doc)) return;
    finish();
  });
  return () => { done = true; observer.disconnect(); cancelWait(); };
}
