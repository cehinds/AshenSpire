// src/ui/components/holdconfirm.js — PRESS AND HOLD, for the choices a run
// cannot take back. Constantine, asked whether to build it: "yes press and
// hold".
//
// THE DEFECT IT ANSWERS, in one number. The event screen's three bars are
// 44/44/44 across sixteen cells — the SIZE was fixed and it did not help,
// because the GAPS are 9-9.7 px at every dial setting and nothing in this game
// reads a gap. A thumb that lands 9 px low lands on the neighbour, and on that
// screen the neighbour is a permanent curse with no confirm and no undo.
//
// WHY A HOLD RATHER THAN A MODAL, and this is the whole design rather than a
// preference: the control FILLS UNDER THE FINGER. The player reads the words
// that are filling, sees they are the wrong ones, and LETS GO — the correction
// happens inside the same gesture as the mistake. A modal asks "are you sure?"
// after the commit, when the eye has already moved to the next screen and the
// answer is always yes.
//
// THE FIVE THINGS IT MUST NEVER DO, each one a way this shape goes wrong:
//
//   1. COMMIT ON A RELEASE. Releasing early is the abort, so a pointer `click`
//      on a held control NEVER commits — the completed hold is the only pointer
//      path there is. Get this backwards and the safety feature becomes a
//      second way to fire the thing.
//   2. COMMIT TWICE. It fires the instant the fill lands, then disarms; the
//      trailing pointerup and its click find nothing armed.
//   3. LOCK ANYONE OUT. `ev.detail === 0` — a keyboard Enter on a focused
//      button, and the synthetic click ui/input.js dispatches for the gamepad
//      cursor — commits immediately, with no hold. That is not a loophole, it
//      is the scope: this answers a POINTING failure, a 9 px gap only a finger
//      can fall into. A focus cursor selects a NAMED element and cannot land
//      between two bars, so charging it a hold would be ceremony billed to a
//      player who cannot make the mistake. Named boundary, not silence: pad and
//      keyboard players get no confirm step.
//   4. TRAP A SCROLL. Moving more than SLOP px abandons, so a drag that was
//      trying to scroll the screen never becomes a commit.
//   5. GO INVISIBLE. The fill is state, not decoration, so it survives
//      reduced-motion; it is a width driven per frame, not an animation.
//
// Cancellation is not hand-rolled: trackGesture (#22, ui/gesture.js) calls
// onEnd exactly once however the gesture ended — pointerup, pointercancel,
// palm rejection, focus loss — pointerId-scoped, listeners on the element,
// nothing on window. Vira measured the hole that module exists to fill; a hold
// that reinvented it would reinvent the hole.

import { trackGesture } from '../gesture.js';

/** How far a finger may wander before the hold is read as a drag. */
const SLOP = 12;

/**
 * armHold(btn, { ms, onConfirm }) -> disarm()
 *
 * `ms <= 0` wires a plain click and returns: the "off" position of the dial is
 * the pre-hold behaviour byte for byte, not a hold with a zero timer.
 */
export function armHold(btn, { ms, onConfirm }) {
  if (!(ms > 0)) {
    btn.addEventListener('click', onConfirm);
    return () => btn.removeEventListener('click', onConfirm);
  }

  btn.classList.add('ev-hold');
  // Two states an instrument and a screenshot can both read, so the tool never
  // re-derives what the screen already knows (Law 0 clause 4).
  btn.dataset.hold = 'idle';
  btn.dataset.holdMs = String(ms);
  btn.style.setProperty('--hold', '0');

  let raf = 0;
  let armed = false;
  let fired = false;

  const paint = (p) => {
    btn.style.setProperty('--hold', String(p));
    btn.dataset.holdProgress = p.toFixed(3);
  };

  function stop(state) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    armed = false;
    btn.dataset.hold = state;
    paint(0);
  }

  function begin(ev) {
    if (fired || armed) return;
    armed = true;
    fired = false;
    btn.dataset.hold = 'holding';
    const t0 = performance.now();
    const x0 = ev.clientX;
    const y0 = ev.clientY;

    const tick = (now) => {
      if (!armed) return;
      const p = Math.min(1, (now - t0) / ms);
      paint(p);
      if (p >= 1) {
        // FIRE AT FULL, not at release. The player feels it land while their
        // thumb is still down, which is the confirmation; waiting for the lift
        // would make a completed hold feel like it did nothing.
        fired = true;
        stop('done');
        onConfirm(ev);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    trackGesture(ev, {
      onMove: (mv) => {
        if (!armed) return;
        if (Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) stop('idle');
      },
      // However it ended — lift, cancel, palm, focus loss. If the fill never
      // reached the end, nothing happened, and that IS the feature.
      onEnd: () => { if (armed) stop('idle'); },
    });
  }

  // A pointer click never commits. See rule 1 — the early release IS the abort,
  // so the click it generates must die here rather than become a second door.
  const onClick = (ev) => {
    if (ev.detail === 0) { onConfirm(ev); return; } // rule 3: keyboard / pad cursor
    ev.preventDefault();
    ev.stopPropagation();
  };

  const onKeyEsc = (ev) => { if (ev.key === 'Escape' && armed) stop('idle'); };

  btn.addEventListener('pointerdown', begin);
  btn.addEventListener('click', onClick);
  addEventListener('keydown', onKeyEsc);

  return function disarm() {
    stop('idle');
    fired = true;
    btn.removeEventListener('pointerdown', begin);
    btn.removeEventListener('click', onClick);
    removeEventListener('keydown', onKeyEsc);
  };
}

/**
 * The dial position -> milliseconds, in one place, reading the one home
 * (`balance.ui.holdConfirm`). An unknown stored value resolves to the DEFAULT
 * rather than to 0: a settings string nobody recognises must not quietly
 * disable a safety step.
 */
export function holdMs(settings, holdConfirm) {
  const steps = (holdConfirm && holdConfirm.steps) || {};
  const raw = settings && settings.holdConfirm;
  const key = Object.prototype.hasOwnProperty.call(steps, raw) ? raw : holdConfirm.def;
  return Number(steps[key]) || 0;
}
