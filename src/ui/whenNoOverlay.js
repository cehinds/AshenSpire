// src/ui/whenNoOverlay.js — run a screen redraw only when nothing is open over
// the screen (docs/EXTERNAL-ASSETS-PLAN.md step 5, review of #1471).
//
// A Retry or a tier switch that loads the art after a failed boot redraws the
// title. Redrawn under an open dialog (Settings, the title's Load/New door), it
// would replace the control that dialog returns focus to, and closing it would
// leave focus on <body>. So the redraw waits until the last dialog has closed.

/** What counts as open over the screen: any modal dialog, or the title's own door. */
export const OVERLAY_SELECTOR = '[aria-modal="true"], .title-modal-veil';

/** True when a dialog or the title's door is open. */
export function overlayOpen(doc = globalThis.document) {
  try { return !!doc?.querySelector?.(OVERLAY_SELECTOR); } catch { return false; }
}

/**
 * whenNoOverlay(run, { doc, Observer }) — `run` now when nothing is open, else
 * once the page has changed so that nothing is (a MutationObserver on the
 * body). Returns a canceller. Without an observer the run is dropped: the
 * screen keeps its re-pointed images rather than being redrawn under a dialog.
 */
export function whenNoOverlay(run, { doc = globalThis.document, Observer = globalThis.MutationObserver } = {}) {
  if (!overlayOpen(doc)) { run(); return () => {}; }
  if (typeof Observer !== 'function' || !doc?.body) return () => {};
  let done = false;
  const observer = new Observer(() => {
    if (done || overlayOpen(doc)) return;
    done = true;
    observer.disconnect();
    run();
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'class'] });
  return () => { done = true; observer.disconnect(); };
}
