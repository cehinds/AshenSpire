// src/ui/components/holdconfirm.js — THE SECOND BEAT, in both its forms.
//
// Constantine, asked whether to build it: "yes press and hold" — and the same
// sentence ended "same with ending turn."
//
// WHAT THIS FILE IS NOW, AND WHY IT CHANGED. It used to export `armHold` and
// nothing else, and `armHold` had exactly ONE caller in the whole tree: the
// event screen. That is how the second half of his sentence was lost — not by
// anyone deciding End Turn should commit on a tap, but because giving a second
// action a second beat meant REMEMBERING A SECOND CALL. Marina's ruling, and it
// is the design of this module:
//
//     WHICH ACTIONS TAKE A SECOND BEAT IS A CHARACTERISTIC ON THE ACTION,
//     NEVER A LIST OF CALL SITES.
//
// So `applyBeat` is the door now, and no screen picks a form. A screen names
// its action and hands over the commit; `model/secondbeat.js` says whether a
// beat is owed and which one, and this file performs it. A screen CANNOT wire a
// hold to something the table has not ruled on — `beatFor` throws on an unknown
// id — and it cannot quietly skip one either, because the control it draws
// marks itself and an instrument reads the page back against the table.
//
// ---------------------------------------------------------------------------
// TWO FORMS, BECAUSE THEY ANSWER TWO DIFFERENT MISTAKES.
//
//   HOLD  — the finger missed. The control FILLS UNDER THE FINGER: the player
//           reads the words that are filling, sees they are the wrong ones, and
//           LETS GO. The correction happens inside the same gesture as the
//           mistake. A modal asks "are you sure?" after the commit, when the
//           eye has already moved to the next screen and the answer is always
//           yes.
//   CONFIRM — the finger landed where it aimed and THE OBJECT WAS WRONG.
//           Holding is useless: a held wrong card still upgrades the wrong
//           card. What the player needs is to SEE WHAT IT BECOMES and then say
//           yes — which is exactly what Constantine asked for at the Smith, and
//           what a hover-only preview never gave a phone.
//
// THE FIVE THINGS THE HOLD MUST NEVER DO, each one a way this shape goes wrong:
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
//      keyboard players get no confirm step. (The CONFIRM form is different and
//      deliberately so — see armConfirm.)
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
//
// ---------------------------------------------------------------------------
// THE SEAM FOR VEGA — a hold with no feedback is a gesture you cannot tell is
// working, and I am not the seat who authors sound.
//
// Hold boundaries deliberately make no sound here. Vega's hold-beat observer
// owns `data-hold` / `data-hold-progress` and is the one sound path for start,
// progress, completion and abort. Confirm panels are a different form with no
// hold transition, so their three cues remain here without double-firing.
// ---------------------------------------------------------------------------

import { trackGesture } from '../gesture.js';
import { beatFor } from '../../model/secondbeat.js';
import { sfx } from '../sfx.js';

/** How far a finger may wander before the hold is read as a drag. */
const SLOP = 12;

/**
 * THE CUE VOCABULARY — six phases, one family. Exported so Vega can author
 * against a list rather than against a grep, and so an instrument can assert
 * the wiring is live off `sfx.recent` without shipping any audio.
 */
export const BEAT_CUES = Object.freeze([
  'beat_confirmArm', 'beat_confirmCommit', 'beat_confirmCancel',
]);

/**
 * THE ONE PLACE A BEAT ANNOUNCES ITSELF. Sound today; haptics belong here too.
 * `phase` is one of BEAT_CUES' suffixes; `id` and `form` are passed so a future
 * pattern can differ per action without a second call site being invented.
 */
export function beatCue(phase, id, form) {
  const cue = `beat_${phase}`;
  sfx.play(cue);
  // VEGA'S SEAM. `navigator.vibrate` goes here — one call, every form, every
  // action, with `id` and `form` already in hand. Nothing else in the tree
  // should ever learn that a beat has a body.
  return { cue, id, form };
}

/**
 * armHold(btn, { ms, onConfirm, id }) -> disarm() (with .refresh())
 *
 * `ms` may be a NUMBER or a FUNCTION returning one, read at the moment the
 * finger lands. The function form remains available to rows whose state can
 * change while a screen is mounted; End Turn itself is deliberately constant.
 *
 * `ms <= 0` is the "off" position of the dial and it is the pre-hold behaviour
 * byte for byte: one tap commits. Not a hold with a zero timer.
 */
export function armHold(btn, { ms, onConfirm, id = null }) {
  const msOf = typeof ms === 'function' ? ms : () => ms;

  let raf = 0;
  let armed = false;
  let fired = false;
  // Set at pointerdown, read at the click that follows it: did this press start
  // a hold? Rule 1 lives on this flag, and so does the ms<=0 passthrough.
  let heldThisPress = false;

  const paint = (p) => {
    btn.style.setProperty('--hold', String(p));
    btn.dataset.holdProgress = p.toFixed(3);
  };

  /**
   * The two states an instrument and a screenshot can both read, so a tool
   * never re-derives what the screen already knows (Law 0 clause 4). Re-applied
   * on refresh() because a screen that repaints its own innerHTML — combat's
   * End Turn does, every render — drops the hint and nothing else notices.
   */
  function dress() {
    const now = msOf();
    if (now > 0) {
      btn.classList.add('beat-hold');
      if (id) btn.dataset.holdAction = id;
      if (!btn.dataset.hold) btn.dataset.hold = 'idle';
      btn.dataset.holdMs = String(now);
      if (btn.style.getPropertyValue('--hold') === '') btn.style.setProperty('--hold', '0');
      if (!btn.querySelector('.hold-hint')) {
        // THE INSTRUCTION IS ON SCREEN, not announced and not discovered. A
        // gesture a tired player has to find is a gesture they will fight; the
        // word is three letters and it costs the control nothing.
        const hint = document.createElement('span');
        hint.className = 'hold-hint';
        hint.textContent = 'HOLD';
        btn.appendChild(hint);
      }
    } else {
      btn.classList.remove('beat-hold');
      delete btn.dataset.hold;
      delete btn.dataset.holdAction;
      delete btn.dataset.holdMs;
      delete btn.dataset.holdProgress;
      btn.style.removeProperty('--hold');
      const hint = btn.querySelector('.hold-hint');
      if (hint) hint.remove();
    }
  }

  function stop(state) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    armed = false;
    if (btn.dataset.hold) btn.dataset.hold = state;
    paint(0);
  }

  function begin(ev) {
    heldThisPress = false;
    const ms0 = msOf();
    // The dial is off, or this state of this action owes no beat. Let the
    // click through untouched — that is the pre-hold behaviour, byte for byte.
    if (!(ms0 > 0)) return;
    if (fired || armed) return;
    heldThisPress = true;
    armed = true;
    btn.dataset.hold = 'holding';
    const t0 = performance.now();
    const x0 = ev.clientX;
    const y0 = ev.clientY;

    const tick = (now) => {
      if (!armed) return;
      const p = Math.min(1, (now - t0) / ms0);
      paint(p);
      if (p >= 1) {
        // FIRE AT FULL, not at release. The player feels it land while their
        // thumb is still down, which is the confirmation; waiting for the lift
        // would make a completed hold feel like it did nothing.
        fired = true;
        stop('done');
        onConfirm(ev);
        // A control that survives its own commit (End Turn does — the screen
        // stays and the next turn begins) must be pressable again.
        fired = false;
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

  // A pointer click never commits WHEN A HOLD WAS ARMED. See rule 1 — the early
  // release IS the abort, so the click it generates must die here rather than
  // become a second door. When no hold was armed (the dial is off, or this
  // state owes no beat) the click is the whole action and passes straight
  // through.
  const onClick = (ev) => {
    if (ev.detail === 0) { onConfirm(ev); return; } // rule 3: keyboard / pad cursor
    if (!heldThisPress) { onConfirm(ev); return; }
    heldThisPress = false;
    ev.preventDefault();
    ev.stopPropagation();
  };

  const onKeyEsc = (ev) => { if (ev.key === 'Escape' && armed) stop('idle'); };

  dress();
  btn.addEventListener('pointerdown', begin);
  btn.addEventListener('click', onClick);
  addEventListener('keydown', onKeyEsc);

  const disarm = function disarm() {
    stop('idle');
    fired = true;
    btn.removeEventListener('pointerdown', begin);
    btn.removeEventListener('click', onClick);
    removeEventListener('keydown', onKeyEsc);
  };
  // Re-read the dial and the action's state. Cheap, idempotent, and the only
  // way a control whose own screen rewrites its innerHTML keeps its dressing.
  disarm.refresh = dress;
  return disarm;
}

// ---------------------------------------------------------------------------
// THE CONFIRM FORM.
//
// ONE ARMED CONTROL AT A TIME, HELD HERE. Arming a second card must disarm the
// first, and that mutual exclusion is a property of the FORM, not of any
// screen — the Smith and the merchant would otherwise each hand-roll it and
// drift. This is the one piece of module state in the file and it exists so
// that no screen owns it.
let activeConfirm = null;

/**
 * armConfirm(el, { question, detailHtml, confirmLabel, onConfirm, id })
 *   -> disarm()
 *
 * The first press ARMS: the control is marked, and a panel appears beside it
 * carrying the answer to "what does this actually do" — for the Smith, the
 * upgrade preview that until now only ever existed on hover, which a phone does
 * not have. The second press, on CONFIRM, commits.
 *
 * WHY THE PAD IS NOT EXEMPTED HERE AND IS EXEMPTED FROM THE HOLD. The hold
 * answers a pointing failure a focus cursor cannot make, so charging a pad
 * player for it is ceremony. This answers a CHOOSING failure — picking the
 * wrong object — and a pad player picks objects exactly like everyone else.
 * Same mistake, same beat.
 */
export function armConfirm(el, { question, detailHtml = '', confirmLabel = 'CONFIRM', onConfirm, id = null }) {
  let panel = null;

  function close(phase) {
    if (!panel) return;
    panel.remove();
    panel = null;
    el.classList.remove('beat-armed');
    el.removeAttribute('data-beat-armed');
    if (activeConfirm === close) activeConfirm = null;
    if (phase) beatCue(phase, id, 'confirm');
  }

  function open() {
    if (panel) return;
    if (activeConfirm) activeConfirm(null);
    el.classList.add('beat-armed');
    el.dataset.beatArmed = '1';
    panel = document.createElement('div');
    panel.className = 'beat-confirm';
    panel.dataset.beatFor = id || '';
    // The question is TEXT and the detail is HTML the caller already built with
    // the game's own escaping helpers (upgradePreviewHtml does). Nothing here
    // interpolates a player-supplied string.
    const q = document.createElement('p');
    q.className = 'beat-q';
    q.textContent = question;
    panel.appendChild(q);
    if (detailHtml) {
      const d = document.createElement('div');
      d.className = 'beat-detail';
      d.innerHTML = detailHtml;
      panel.appendChild(d);
    }
    const row = document.createElement('div');
    row.className = 'beat-actions';
    const yes = document.createElement('button');
    yes.className = 'beat-yes';
    yes.textContent = confirmLabel;
    const no = document.createElement('button');
    no.className = 'subtle beat-no';
    no.textContent = 'CANCEL';
    row.appendChild(yes);
    row.appendChild(no);
    panel.appendChild(row);
    el.insertAdjacentElement('afterend', panel);
    activeConfirm = close;
    beatCue('confirmArm', id, 'confirm');

    yes.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const commit = onConfirm;
      close(null);
      beatCue('confirmCommit', id, 'confirm');
      commit(ev);
    });
    no.addEventListener('click', (ev) => { ev.stopPropagation(); close('confirmCancel'); });
    yes.focus({ preventScroll: true });
  }

  const onKeyEsc = (ev) => { if (ev.key === 'Escape' && panel) close('confirmCancel'); };
  const onPress = (ev) => { ev.stopPropagation(); if (panel) close('confirmCancel'); else open(); };

  el.addEventListener('click', onPress);
  // ESCAPE CANCELS, same key the hold answers to — a player who has learned one
  // way out of a beat has learned both. Bound ONCE per armed control, not once
  // per open: a listener added in open() and removed only in disarm() stacks a
  // copy every time the player changes their mind, which is the leak #22 exists
  // to be careful about.
  addEventListener('keydown', onKeyEsc);
  return function disarm() {
    close(null);
    el.removeEventListener('click', onPress);
    removeEventListener('keydown', onKeyEsc);
  };
}

// ---------------------------------------------------------------------------

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

/**
 * beatArmer(meta, registries) -> arm(el, actionId, opts) -> disarm
 *
 * THE ONE DOOR. A screen calls this once, then names actions. It never names a
 * form, never reads the dial twice, and cannot arm something the table has not
 * ruled on.
 *
 * opts:
 *   ctx          the action's state, for a row whose characteristics depend on
 *                it. A key the row declares and the caller omits THROWS by name
 *                (secondbeat.js) rather than resolving to a plausible 'none'.
 *   onConfirm    the commit. Called once, whichever form ran.
 *   question     confirm form only — the sentence above the buttons.
 *   detailHtml   confirm form only — what the action actually does.
 *   confirmLabel confirm form only.
 *
 * EVERY ARMED CONTROL MARKS ITSELF, including the ones that owe no beat:
 * `data-beat="none|hold|confirm"` and `data-beat-action="<id>"`. That is not
 * decoration — it is the only way an instrument can read the page back against
 * the table IN BOTH DIRECTIONS: a declared action that draws no control is a
 * lie, and a control whose action nobody declared is a gap. Neither is visible
 * from a source tree.
 */
export function beatArmer(meta, registries) {
  const dialMs = holdMs((meta && meta.settings) || {}, registries.balance.ui.holdConfirm);

  return function arm(el, actionId, { ctx = {}, onConfirm, question, detailHtml, confirmLabel } = {}) {
    // `ctxOf` so a row whose stakes move with the game state (End Turn) is
    // evaluated at the moment the finger lands, not at the moment the screen
    // mounted. A screen passes a function; a static action passes an object.
    const ctxOf = typeof ctx === 'function' ? ctx : () => ctx;
    const formNow = () => beatFor(actionId, ctxOf()).form;

    el.dataset.beatAction = actionId;
    const initial = beatFor(actionId, ctxOf());
    el.dataset.beat = initial.form;

    if (initial.form === 'confirm') {
      // A confirm is a screen-state change, not a timer, so the dial does not
      // set its length — but `off` is still off: the player asked for one tap.
      if (dialMs <= 0) {
        const off = function disarmOff() { el.removeEventListener('click', onConfirm); };
        off.refresh = () => {};
        el.addEventListener('click', onConfirm);
        return off;
      }
      const c = armConfirm(el, { question: question || `${initial.of}?`, detailHtml, confirmLabel, onConfirm, id: actionId });
      c.refresh = () => {};
      return c;
    }

    // HOLD and NONE share one path, because for a state-dependent action they
    // are the SAME CONTROL at two moments. `armHold` reads the duration at
    // pointerdown; a 0 means this press owes no beat and the click commits.
    const ms = () => (formNow() === 'hold' ? dialMs : 0);
    const disarm = armHold(el, { ms, onConfirm, id: actionId });
    const wrapped = function disarmBeat() { disarm(); };
    // A screen that repaints the control (combat's End Turn, every render) calls
    // this; it re-reads the state and re-dresses. Nothing else changes.
    wrapped.refresh = () => { el.dataset.beat = formNow(); disarm.refresh(); };
    return wrapped;
  };
}
