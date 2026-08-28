// src/ui/gesture.js — ONE answer to "the gesture ended, however it ended."
//
// EldenSpire#22, widened across combat.js and map.js after Vira measured the
// blast radius (gamedesign/vira/log/2026/2026-08-01_combat-pointer-handling-
// measured.md — the numbers there are this module's observed red):
//
//   A CANCELLED DRAG PLAYED A CARD ON THE NEXT TAP. combat's wireCardInput
//   added pointermove/pointerup to WINDOW per drag and removed them only in
//   onUp; there was no pointercancel path in the file. After the browser
//   cancelled a drag, the stale onUp waited armed; one unrelated tap on an
//   enemy — a DIFFERENT pointerId — fired it, elementFromPoint found the
//   enemy, and the card the player had declined to play was played: discard
//   0->1, energy 3->2, both shapes, reproduced twice. Five cancelled drags
//   leaked window pairs 1->6. The map's pan had the same shape with a
//   different consequence (pan roughens; .grabbing sticks).
//
// The three rules, each one a measured hole:
//   1. CLEANUP RUNS ON pointerup AND pointercancel — "however it ended". A
//      cancel is not an error; on a phone it is the NORMAL end of any drag the
//      browser decides is a scroll, on the exact surface where card plays begin.
//   2. POINTERID-SCOPED, every handler. The misplay fired from pointerId 2
//      against the drag's pointerId 1 — an unscoped end handler answers to
//      whichever finger arrives next.
//   3. THE GESTURE OWNS THE POINTER: setPointerCapture on the element, so
//      moves route to it even off-element and the listeners live on the
//      ELEMENT, not window. Nothing is added to window, so there is nothing to
//      leak when a teardown races a gesture — the element's listeners die with
//      the element.
//
// What this module is NOT: a drag-and-drop framework. It does not know about
// ghosts, thresholds, targets or scrolling. The caller keeps its own gesture
// state; this owns only the lifecycle — begin, move, end-with-a-verdict.
//
// onEnd(ev, { cancelled }) is ALWAYS called exactly once, with cancelled: true
// when the browser took the gesture (scroll claim, focus loss, touch palm
// rejection…). The caller decides what a cancelled end abandons.

export function trackGesture(startEv, { onMove, onEnd } = {}) {
  const id = startEv.pointerId;
  const el = startEv.currentTarget;
  // Capture can throw on a detached node or an exotic target; a gesture that
  // cannot capture still gets scoped listeners and still cleans up — weaker
  // (off-element moves may not arrive), never leaky.
  try { el.setPointerCapture(id); } catch { /* tracked without capture */ }
  let done = false;
  const move = (ev) => {
    if (ev.pointerId !== id || done) return;
    if (onMove) onMove(ev);
  };
  const finish = (cancelled) => (ev) => {
    if (ev.pointerId !== id || done) return;
    done = true;
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    try { el.releasePointerCapture(id); } catch { /* already released */ }
    if (onEnd) onEnd(ev, { cancelled });
  };
  const up = finish(false);
  const cancel = finish(true);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
}
