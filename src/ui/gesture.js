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

// ---------------------------------------------------------------------------
// THE PRESS DOOR — one gesture, three inputs (S7).
//
// Constantine, 2026-08-17, his words: "if press to hold is active for certain
// things for mouse or game pad, it shoudl apply to everything including
// keyboard as well for those same buttons."
//
// WHAT WAS WRONG. A hold began at `el.addEventListener('pointerdown', …)`, and
// that is the whole of it: a pointerdown is the only press a browser gives you
// for free. Keyboard and pad activation arrived as ONE synthetic click with no
// down and no up, so a control could only ever be TAPPED without a mouse.
// Nobody decided that. It is what "bind pointerdown" means, and every control
// built on that line inherited it.
//
// SO THE PRESS IS THE ABSTRACTION, NOT THE HOLD. `armPress` is the one place a
// press-shaped gesture begins, and it already has three inputs behind it:
//
//   pointer  pointerdown … trackGesture … pointerup/pointercancel
//   keyboard the Confirm key down … up          } published by ui/input.js as
//   gamepad  the Confirm button down … up       } gppress / gprelease
//
// A control that arms a hold through this door gains it on every input BY
// CONSTRUCTION — there is no per-input wiring to remember and no list to keep
// in step (Law 1 clause 7). PARITY IS THE DEFAULT AND A REFUSAL IS EXPLICIT: a
// form that will not serve a source says so by returning false from its own
// `begin`, in its own file, on a line a reader can find.
//
// WHICH BUTTONS — derived, never listed. `ui/input.js` owns the answer: the
// press is the CONFIRM action, which is by definition the button that activates
// the focused control, i.e. the one whose pointer twin is a press on it. A
// rebind moves the hold with it because the binding is read at press time.
//
// WHAT A KEY PRESS DOES NOT HAVE, said out loud rather than faked: coordinates
// of its own, and therefore movement. The origin handed to `begin` is the
// control's own centre, so a slop test written for a finger can never fire and
// never has to be special-cased — a focus cursor cannot wander off the element
// it is standing on. `onMove` simply never arrives.
//
// NOTHING IS ADDED TO window (rule 3 above): the two custom events are
// dispatched ON THE ELEMENT by input.js, which already owns the keyboard and
// the pad poller, and the listeners here die with the element.

/** The two ends of a non-pointer press. One home for the names — input.js
 *  dispatches them, this module listens, and nobody types the string twice. */
export const PRESS_EVENT = 'gppress';
export const RELEASE_EVENT = 'gprelease';

/**
 * armPress(el, begin) -> disarm()
 *
 * `begin(origin, track)` is called once per press and RETURNS WHETHER IT TOOK
 * THE PRESS:
 *   origin  { source: 'pointer' | 'key' | 'pad', x, y, ev }
 *   track({ onMove, onEnd })  subscribe to the rest of THIS press.
 *           onEnd(ev, { cancelled, source }) is called exactly once, and its
 *           return value answers ONE question for a key/pad press: did this
 *           gesture consume the activation? True and no click follows (a
 *           completed read must not also play the card); false and the release
 *           IS the tap, exactly as an early pointer release is.
 *
 * A falsy return means the form declined — the dial is off, this state owes no
 * beat, the source is refused — and the activation then happens immediately,
 * byte for byte the pre-door behaviour.
 */
export function armPress(el, begin) {
  const onPointerDown = (ev) => {
    begin({ source: 'pointer', x: ev.clientX, y: ev.clientY, ev }, (h = {}) => trackGesture(ev, {
      onMove: h.onMove,
      onEnd: h.onEnd ? (e, info) => h.onEnd(e, { ...info, source: 'pointer' }) : undefined,
    }));
  };

  // One key/pad press at a time. `live` holds the subscription between the two
  // halves; there is no timer and no window listener keeping it alive.
  let live = null;

  const onPress = (ev) => {
    if (live) return;
    const source = (ev.detail && ev.detail.source) || 'key';
    // A focus cursor has no coordinates. The control's own centre is where it
    // is standing — see the header: this makes the slop test inert, not wrong.
    const r = el.getBoundingClientRect();
    let sink = null;
    const took = begin({ source, x: r.left + r.width / 2, y: r.top + r.height / 2, ev }, (h) => { sink = h; });
    if (!took) return;
    live = { source, h: sink || {} };
    // The activation now waits for the release. input.js reads this.
    ev.preventDefault();
  };

  const onRelease = (ev) => {
    if (!live) return;
    const { source, h } = live;
    live = null;
    const cancelled = !!(ev.detail && ev.detail.cancelled);
    if (h.onEnd && h.onEnd(ev, { cancelled, source })) ev.preventDefault();
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener(PRESS_EVENT, onPress);
  el.addEventListener(RELEASE_EVENT, onRelease);
  return function disarmPress() {
    live = null;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener(PRESS_EVENT, onPress);
    el.removeEventListener(RELEASE_EVENT, onRelease);
  };
}

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
