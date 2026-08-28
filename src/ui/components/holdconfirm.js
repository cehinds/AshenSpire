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
//   3. BE A MOUSE FEATURE. THE DIAL IS THE SWITCH AND IT GOVERNS EVERY INPUT.
//      Constantine, 2026-08-17: "if hold is toggled, then it should be the
//      same, in all instances. for ending turn, using flask, event choice,
//      shrine rest." So `balance.ui.holdConfirm` — the dial that already
//      existed — is the one switch, and when it is on, every one of those four
//      actions holds on pointer, keyboard AND gamepad; when it is `off`, all
//      four commit on one press on all three. There is no per-input rule and no
//      per-action rule left to drift.
//
//      WHAT IT REPLACED, kept because the reasoning was good and is no longer
//      the ruling. This form used to refuse every non-pointer source on the
//      argument that it answers a POINTING failure — a 9 px gap only a finger
//      can fall into — and a focus cursor selects a NAMED element and cannot
//      mis-point. True, and beside the point his sentence settles: he asked for
//      one dial with one meaning, not for the beat to be owed only where the
//      hazard is. His word outranks the derivation; the derivation is recorded
//      here rather than deleted, because the cost is real — a pad player who
//      cannot mis-point now pays 600 ms per End Turn, and `off` is where they
//      go.
//
//      MEASURED AT b83bda1, 390x844, dial `normal`, before this act — the
//      breach was EIGHT cells, not one:
//        endTurn      key `e` tap  turn 1 -> 2   ·  pad btn2 tap  turn 1 -> 2
//        eventChoice  Enter tap    3 bars -> 1   ·  pad btn0 tap  3 bars -> 1
//        useFlask     Enter tap    hpCurrent 2 -> 1 · pad btn0 tap  2 -> 1
//        shrineRest   Enter tap    shrine gone   ·  pad btn0 tap  shrine gone
//      Every pointer cell aborted correctly in the same run.
//
//      AND "THE FIX IS ONE LINE" — the sentence this comment used to carry —
//      WAS WRONG, in the two ways a reader could not see from here:
//        (a) `.end-turn` matches input.js's CHROME list, so THE FOCUS CURSOR
//            CANNOT REACH IT. Enter and pad-Confirm never arrive at End Turn at
//            all; its keyboard door is `e`, a `kind: 'key'` binding that reaches
//            the button as a synthetic click. Deleting the source guard alone
//            would have changed nothing whatsoever for the one action with a
//            measured live breach behind it. The other half of this act is in
//            ui/input.js: a `key`-kind action that has an armed control presses
//            it through the same door instead of clicking it.
//        (b) `onEnd` returned nothing, and input.js reads that return as "did
//            the gesture consume the activation?". With only the guard deleted,
//            an ABORTED key hold would have activated on release (the abort
//            commits — rule 1, inverted) and a COMPLETED one would have fired
//            at full and then activated again on release. Watched, both.
//   4. TRAP A SCROLL. Moving more than SLOP px abandons, so a drag that was
//      trying to scroll the screen never becomes a commit.
//   5. GO INVISIBLE. The fill is state, not decoration, so it survives
//      reduced-motion; it is a width driven per frame, not an animation.
//
// Cancellation is not hand-rolled: armPress / trackGesture (#22, ui/gesture.js)
// calls onEnd exactly once however the gesture ended — pointerup, pointercancel,
// palm rejection, focus loss, a key or pad button coming back up — pointerId-
// scoped on the pointer path, listeners on the element, nothing on window. Vira
// measured the hole that module exists to fill; a hold that reinvented it would
// reinvent the hole.
//
// AND NEITHER FORM BINDS `pointerdown` ANY MORE, which is the S7 fix in one
// sentence: both go through `armPress`, the ONE door a press-shaped gesture
// begins at, and that door has pointer, keyboard and gamepad behind it. A form
// that wants a hold gets all three by construction; a form that refuses one says
// so on a line of its own. NEITHER FORM REFUSES ONE ANY MORE (rule 3 above).
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

import { armPress } from '../gesture.js';
import { setActionControl, releaseActionControl } from '../input.js';
import { beatFor } from '../../model/secondbeat.js';
import { sfx } from '../sfx.js';
import { anchorLocalBox, viewportLocalBox, VIEWPORT_ORIGIN } from '../fx.js';

/** How far a finger may wander before the hold is read as a drag. */
const SLOP = 12;

/**
 * THE CUE VOCABULARY — six phases, one family. Exported so Vega can author
 * against a list rather than against a grep, and so an instrument can assert
 * the wiring is live off `sfx.recent` without shipping any audio.
 */
const BEAT_CUES = Object.freeze([
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

// A completed pointer hold can redraw its control before the finger lifts.
// The browser then targets the replacement element with the trailing click,
// which would otherwise be interpreted as a fresh activation. Keep the
// one-shot lift eater at document scope so it survives that redraw; cancel
// clears it, and a bounded timeout prevents a missing click from poisoning a
// later unrelated tap.
let pendingPointerLift = null;
let liftListenersReady = false;

function clearPendingPointerLift() {
  if (pendingPointerLift && pendingPointerLift.timer) clearTimeout(pendingPointerLift.timer);
  pendingPointerLift = null;
}

function ensureLiftListeners() {
  if (liftListenersReady || typeof document === 'undefined') return;
  liftListenersReady = true;
  document.addEventListener('pointercancel', (ev) => {
    if (pendingPointerLift && pendingPointerLift.pointerId === ev.pointerId) clearPendingPointerLift();
  }, true);
  document.addEventListener('click', (ev) => {
    if (!pendingPointerLift || ev.detail === 0) return;
    clearPendingPointerLift();
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true);
}

function swallowCompletedPointerLift(pointerId) {
  ensureLiftListeners();
  clearPendingPointerLift();
  pendingPointerLift = {
    pointerId,
    timer: setTimeout(clearPendingPointerLift, 1000),
  };
}

/**
 * armHold(btn, { ms, onConfirm, id, onState, onAbort }) -> disarm() (with .refresh())
 *
 * `ms` may be a NUMBER or a FUNCTION returning one, read at the moment the
 * finger lands. The function form remains available to rows whose state can
 * change while a screen is mounted; End Turn itself is deliberately constant.
 *
 * `ms <= 0` is the "off" position of the dial and it is the pre-hold behaviour
 * byte for byte: one tap commits. Not a hold with a zero timer.
 */
export function armHold(btn, {
  ms,
  onConfirm,
  id = null,
  onState = null,
  // Optional second meaning for an early, still press-shaped release. The
  // hold remains the commit gate; callers may use this callback for the
  // non-mutating tap that shares the same surface (for example, a folded card
  // opens on a short press but equips only after the hold reaches full).
  onAbort = null,
}) {
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
    if (onState) onState(state);
  }

  function begin(origin, track) {
    // NO SOURCE IS REFUSED. Rule 3 above is the whole reasoning; what is left
    // here is the ONE condition that decides whether this press is a hold, and
    // it is the dial — read fresh, for every press, on every input.
    //
    // `heldThisPress` IS A POINTER FACT AND ONLY A POINTER FACT. It exists so
    // the `click` a lifted finger generates can be swallowed (rule 1). A key or
    // pad press generates NO click — input.js holds the activation and asks
    // `onEnd` directly — so setting it for those sources would leave a live
    // swallow flag with no click to eat, and the next real TAP would pay for
    // it. That is F3's shape, which armInspect below learned once already.
    heldThisPress = false;
    const ms0 = msOf();
    // The dial is off, or this state of this action owes no beat. Let the
    // click through untouched — that is the pre-hold behaviour, byte for byte.
    if (!(ms0 > 0)) return false;
    if (fired || armed) return false;
    heldThisPress = origin.source === 'pointer';
    armed = true;
    btn.dataset.hold = 'holding';
    if (onState) onState('holding');
    const t0 = performance.now();
    const x0 = origin.x;
    const y0 = origin.y;
    const ev = origin.ev;

    const tick = (now) => {
      if (!armed) return;
      const p = Math.min(1, (now - t0) / ms0);
      paint(p);
      if (p >= 1) {
        // FIRE AT FULL, not at release. The player feels it land while their
        // thumb is still down, which is the confirmation; waiting for the lift
        // would make a completed hold feel like it did nothing.
        fired = true;
        if (origin.source === 'pointer') swallowCompletedPointerLift(origin.ev.pointerId);
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

    track({
      onMove: (mv) => {
        if (!armed) return;
        if (Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) stop('idle');
      },
      // However it ended — lift, cancel, palm, focus loss. If the fill never
      // reached the end, nothing happened, and that IS the feature.
      //
      // THE RETURN IS THE WHOLE OF RULE 1 ON A KEY OR A PAD, and it is `true`
      // WHICHEVER WAY THIS PRESS ENDED. input.js reads it as "did the gesture
      // consume the activation?", and both answers are yes for opposite
      // reasons: a completed hold ALREADY committed at full (firing again on
      // the release would commit twice), and an early release IS the abort
      // (activating on it would make the safety step a second way to fire the
      // thing — rule 1, inverted, which is the failure that looks exactly like
      // working software). Reaching here at all means `begin` took the press,
      // so there is no third case to answer.
      onEnd: (endEv, info = {}) => {
        const wasArmed = armed;
        if (wasArmed) stop('idle');
        // A cancelled gesture or a drag is not a tap. An ordinary early
        // release is: let the caller open/inspect the shared surface, while
        // armHold still consumes the trailing synthetic activation so it can
        // never become a second commit door.
        if (wasArmed && !info.cancelled && onAbort) onAbort(endEv);
        return true;
      },
    });
    return true;
  }

  // A pointer click never commits WHEN A HOLD WAS ARMED. See rule 1 — the early
  // release IS the abort, so the click it generates must die here rather than
  // become a second door. When no hold was armed (the dial is off, or this
  // state owes no beat) the click is the whole action and passes straight
  // through.
  const onClick = (ev) => {
    // `detail === 0` IS A SYNTHETIC CLICK, AND ITS MEANING HAS CHANGED WITH
    // RULE 3. It is no longer "keyboard and pad skip the beat" — they do not.
    // It is now the ONE case that reaches here: an activation that did NOT come
    // through the press door, which happens when the press door already asked
    // and this form declined (`begin` returned false — the dial is off, or this
    // state of this action owes no beat). input.js activates immediately in
    // exactly that case, so the click IS the whole action and must commit.
    //
    // NAMED BOUNDARY: a screen that calls `el.click()` on an armed control from
    // some path input.js does not route still lands here and still skips the
    // beat. Combat's `e` key was such a path until this act; nothing in this
    // file can see the next one. What sees it is the page — every armed control
    // carries `data-beat-action`, and tools/holdconfirm.mjs drives the real
    // keys and the real pad rather than trusting this comment.
    if (ev.detail === 0) { onConfirm(ev); return; }
    if (!heldThisPress) { onConfirm(ev); return; }
    heldThisPress = false;
    ev.preventDefault();
    ev.stopPropagation();
  };

  const onKeyEsc = (ev) => { if (ev.key === 'Escape' && armed) stop('idle'); };

  dress();
  const disarmPress = armPress(btn, begin);
  btn.addEventListener('click', onClick);
  addEventListener('keydown', onKeyEsc);

  const disarm = function disarm() {
    stop('idle');
    fired = true;
    disarmPress();
    btn.removeEventListener('click', onClick);
    removeEventListener('keydown', onKeyEsc);
  };
  // Re-read the dial and the action's state. Cheap, idempotent, and the only
  // way a control whose own screen rewrites its innerHTML keeps its dressing.
  disarm.refresh = dress;
  return disarm;
}

// ---------------------------------------------------------------------------
// THE INSPECT FORM — press-and-hold to READ, and it is deliberately not a beat.
//
// Constantine, 2026-08-08: hold a card and it "expands" and comes "in front".
// This is the gesture half of that ask, built against the hand as it ships;
// the LAYOUT half (overlap vs paging — C2) is held and lands on top of this
// later without touching it.
//
// WHY IT LIVES IN THIS FILE AND IS NOT A ROW IN model/secondbeat.js. The table
// rules on COMMITS — what a mis-press writes. An inspect writes nothing:
// stakes `nothing`, and the table's own derivation already answers `none` for
// that. So it takes no row, calls no `beatFor`, and no control marks itself
// `data-beat` for it. What it SHARES with the hold form is the machinery —
// SLOP, trackGesture's lifecycle, the fire-at-full shape — which is why it is
// a neighbour and not a copy.
//
// WHY IT IS SILENT, and this is Vega's call to make and sign. Three reasons,
// each sufficient:
//   1. The hold-beat phrase (holdbeat.js) is authored to MEAN "an irreversible
//      commit is approaching" — the accelerating train, the arrival note. An
//      inspect commits nothing, so playing that phrase here would teach the
//      arrival note a second meaning and the cue would start lying about
//      system state on the controls where it matters.
//   2. Frequency. Inspecting is reading; it will fire more than any hold in
//      the game. The cost of a charming sound is paid at hold #200.
//   3. Unlike End Turn, the confirmation is not occluded: the expanded card is
//      most of the screen and nowhere near the thumb. The eye already has it.
// So: no BEAT_CUES entry, no `data-hold` (holdbeat.js filters on that name and
// stays silent), its own attributes. If a soft page-turn is ever wanted, it is
// one `sfx.play` at ONE call site — `open()` below — and Sunna's read decides,
// not this comment.
//
// WHAT IT PUBLISHES, because an instrument and a screenshot must read the
// gesture without becoming its finger: `data-inspect` = idle | pending | open,
// and `data-inspect-progress` while pending. A mid-hold check reads the
// attribute; it never has to time a camera against a 400 ms window.
//
// THREE INPUTS, ONE GESTURE (S7) — added 2026-08-17, and the defect it closed
// was an accessibility one: a player who could not use a pointer could not READ
// A CARD. Measured at b968e28, the focus cursor on a hand card, Enter held 750 ms
// against a 400 ms dial: `data-inspect` never left `idle`, zero copies, and the
// card was SELECTED on keydown. The gesture now begins at `armPress`
// (ui/gesture.js), so a held Confirm key and a held Confirm pad button run the
// same timer, the same fill, the same fire-at-full and the same restore as a
// finger. What differs, and only this: a focus cursor has no coordinates, so the
// origin is the control's own centre and the 12 px boundary below can never fire
// — there is no drag to yield to and no scroll to trap. Watched red per input
// (tools/inspecthold.mjs P3/P4/P5).
//
// DISAMBIGUATION AGAINST TAP AND DRAG — one shared boundary, one timer:
//   move > SLOP px, any time  -> a DRAG (or the narrow hand's pan-x scroll).
//                                The inspect abandons silently; whoever owns
//                                drags proceeds. Same 12 px the drag itself
//                                uses to start, so there is no gap band.
//   still, release < ms       -> a TAP. The click passes through untouched.
//   still, past ms            -> the INSPECT. Expands at full, front, under
//                                the finger; RELEASE closes it and the click
//                                that follows is swallowed exactly once —
//                                a completed read must never become a play.
//   once open, movement STILL abandons the read — the boundary above says "any
//   time" and now means it. It did not: the abandon was scoped to `pending`,
//   and since the timer starts at pointerdown, ANY press slower than the dial
//   to its first 12 px (a hesitation, or simply aiming slowly) opened the read
//   and then never yielded it. Constantine reported the visible half of that
//   ("if a card is selected and the enemy is highlighted, I can't drag the
//   card on the enemy to use it"); measured at 5 shapes, 5/5 dead. The caller
//   still refuses to start a drag while `data-inspect="open"` (combat does),
//   and that is now a backstop rather than the mechanism.
//   WHAT THAT GUARD PROTECTED STILL HOLDS, and it is watched at both edges: a
//   13 px reading DRIFT commits nothing, because a drift ends in the hand and
//   `.hand-area` is not `.field` (siblings; combat's drop needs
//   `closest('.field')`). Crossing 12 px and then carrying the card onto the
//   battlefield is not a drift — it is the drag this boundary exists to name.
//
// LAW 4 / RESTORE: the expanded copy is `pointer-events: none`, steals no
// focus, covers no tap floor it can eat, and release removes it entirely —
// the hand under it is byte-for-byte untouched. On cancel (browser claims the
// gesture) the click swallow is NOT armed — no click follows a cancel, and a
// stale swallow eats the next real tap (Vira's F3, learned once already).
// ---------------------------------------------------------------------------

/** One expanded card at a time — a property of the form, not of any screen. */
let activeInspect = null;

/**
 * armInspect(el, { ms, onOpen }) -> disarm()
 *
 * `ms` <= 0 is the off position: no listeners' worth of behaviour changes —
 * the tap and the drag are exactly the pre-inspect tree. `onOpen` runs at the
 * moment the copy appears (combat passes hideTooltip so a mouse hold does not
 * stack the hover tooltip under the expansion).
 */
export function armInspect(el, { ms, onOpen = null } = {}) {
  let raf = 0;
  let phase = 'idle'; // idle | pending | open
  let ghost = null;
  let swallowClick = false;

  const setState = (s) => {
    phase = s;
    el.dataset.inspect = s;
    if (s !== 'pending') delete el.dataset.inspectProgress;
  };

  function buildGhost() {
    // All values in LOCAL px, converted once — the dragGhost's #15 lesson:
    // clientX is visual px and style.left is local px, and writing one into
    // the other runs away from the finger at every zoom but 1.00.
    const view = viewportLocalBox();
    const r = anchorLocalBox(VIEWPORT_ORIGIN, el);
    // Big enough to read, never past the screen: capped by width, by the top
    // ~60% of the height (so it clears the hand it came from), and at 2.6x.
    const k = Math.min((view.width * 0.78) / r.width, (view.height * 0.6) / r.height, 2.6);
    const g = el.cloneNode(true);
    g.classList.add('card-inspect');
    g.classList.remove('selected');
    // ...and the focus ring, for the same reason `selected` goes: it is a state
    // of the ORIGINAL, and a copy wearing it is a second cursor. Unreachable
    // until the gesture gained keyboard and pad (S7) — a pointer hold never had
    // a ring to clone. MEASURED: two `.gp-focus` elements on screen mid-read,
    // now one (tools/inspecthold.mjs, the kbd cell).
    g.classList.remove('gp-focus');
    g.removeAttribute('data-inspect');
    g.removeAttribute('data-inspect-progress');
    // The positional quick-play badge is a fact about a SLOT in the hand; a
    // copy floating mid-screen has no slot and the badge would lie.
    const hint = g.querySelector('.key-hint');
    if (hint) hint.remove();
    // Explicit width/height from the measured box: the clone leaves the
    // `.hand`-scoped sizing rules behind when it moves to <body>, and WYSIWYG
    // beats whatever the base class thinks a card is.
    g.style.cssText = 'position:fixed;z-index:630;pointer-events:none;margin:0;'
      + `left:${(view.width - r.width * k) / 2}px;top:${(view.height - r.height * k) / 2}px;`
      + `width:${r.width}px;height:${r.height}px;transform:scale(${k});transform-origin:top left;`;
    document.body.appendChild(g);
    return g;
  }

  function close() {
    if (ghost) { ghost.remove(); ghost = null; }
    if (activeInspect === close) activeInspect = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    setState('idle');
  }

  function open() {
    if (activeInspect) activeInspect();
    activeInspect = close;
    setState('open');
    ghost = buildGhost();
    if (onOpen) onOpen();
    // Deliberately no sound. See the header — the reasons are numbered.
  }

  function begin(origin, track) {
    swallowClick = false;
    if (!(ms > 0)) return false;
    // A non-primary MOUSE button is not a press. There is no such thing to get
    // wrong on the other two inputs — the press door only ever publishes the
    // Confirm button — so the guard stays scoped to the source that has one.
    if (origin.source === 'pointer' && origin.ev.button !== 0) return false;
    if (phase !== 'idle') return false;
    setState('pending');
    const t0 = performance.now();
    const x0 = origin.x;
    const y0 = origin.y;

    const tick = (now) => {
      // A screen that re-renders its hand mid-gesture (combat rewrites
      // .hand's innerHTML on every state change) detaches this element and
      // its listeners with it — pointerup can never arrive, so the watch
      // closes the copy rather than stranding it on <body> forever.
      if (!el.isConnected) { close(); return; }
      if (phase === 'pending') {
        const p = Math.min(1, (now - t0) / ms);
        el.dataset.inspectProgress = p.toFixed(3);
        if (p >= 1) { open(); }
      }
      if (phase !== 'idle') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    track({
      onMove: (mv) => {
        // Past the shared boundary this press is a drag (or the narrow
        // hand's scroll) — theirs, silently, AT ANY PHASE. The `pending`
        // scope that used to sit here is the reported defect: measured on
        // this tree at 1200x730, hold 350 ms then drag PLAYED, hold 450 ms
        // played NOTHING, and a steady 1.5 px / 60 ms aim — moving the whole
        // time — played NOTHING. See the disambiguation block in the header.
        if (Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();
      },
      onEnd: (up, { cancelled, source }) => {
        const completed = phase === 'open' && !cancelled;
        // Swallow only what a completed read's LIFT produces. A cancel is
        // followed by no click, and arming the swallow there eats the next
        // real tap instead (F3's shape).
        //
        // A KEY OR PAD RELEASE PRODUCES NO CLICK EITHER — input.js is holding
        // the activation and asks this question directly (the return below).
        // Arming the pointer swallow for it would leave a live flag with no
        // click to eat, and the next real TAP would pay for it: F3's shape
        // again, one input over. Same reason, different door.
        if (completed && source === 'pointer') swallowClick = true;
        close();
        // For a key/pad press this IS the answer to "does the release
        // activate?". A completed read must never also select or play.
        return completed;
      },
    });
    return true;
  }

  // Registered BEFORE the screen's own click wiring (the caller's job, and
  // combat's renderHand does) so a read's lift dies here and never selects or
  // plays.
  //
  // `detail === 0` is a SYNTHETIC click — the one input.js dispatches when a
  // Confirm press did not become a gesture. It is still passed through, and the
  // reason has changed: it is not "keyboard is not a press" (it is one, and
  // this gesture now serves it — S7). It is that a synthetic click only ever
  // arrives when the release ALREADY decided this press was a tap. There is
  // nothing here to swallow, and swallowing it would eat that tap.
  const onClick = (ev) => {
    if (ev.detail === 0) return;
    if (!swallowClick) return;
    swallowClick = false;
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };

  // Marked at rest, so an instrument can enumerate what is inspectable and a
  // screenshot of the idle hand carries its state — same reason armHold
  // dresses its button. With the row at 0 nothing is marked and nothing runs.
  if (ms > 0) setState('idle');
  const disarmPress = armPress(el, begin);
  el.addEventListener('click', onClick);
  return function disarm() {
    close();
    disarmPress();
    el.removeEventListener('click', onClick);
  };
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
 * reveal(panel, actions) — bring a freshly-opened confirm panel ON SCREEN.
 *
 * ⚠ WHY THIS EXISTS, AND THE MEASUREMENT IS THE WHOLE ARGUMENT. The panel is
 * inserted `afterend` of the control it asks about, so where it LANDS is decided
 * by however tall the screen above it happens to be. At `db09846`, tapping a
 * Smith candidate put both answers at
 *
 *     390x844   .beat-yes / .beat-no  top 1000.22 .. 1044.22   0% on screen
 *     360x640   .beat-yes / .beat-no  top  938.66 ..  982.66   0% on screen
 *
 * — 156 px and 299 px below the fold respectively (`node tools/uprightgate.mjs`,
 * both shapes, and `tools/holdconfirm.mjs` red on two cells because a CDP touch
 * at y=1022 lands on nothing).
 *
 * IT IS A LEGIBILITY DEFECT AND NOT A STRANDING, and getting that distinction
 * right cost two seats a measurement each. I read `document.scrollHeight === 844`
 * and concluded the panel could not be answered at all. **The DOCUMENT does not
 * scroll; `.screen` does** — `overflow-y: auto`, real travel — so the player CAN
 * reach it, by scrolling 156 px that nothing on the screen advertises (Vira
 * re-measured on `b30e624` and corrected my conclusion while confirming my
 * position; the reach word her probe prints is `scrollable`, not `unreachable`).
 * A question the player has to go looking for is not a question, so this scrolls
 * it into view for them.
 *
 * NEAREST, NOT CENTRE, AND NOT SMOOTH. `block: 'nearest'` is the least scroll
 * that makes the thing visible, which keeps the ARMED CARD — `.beat-armed`, one
 * row above — on screen with it: the player must be able to see which card the
 * question is about, and a centred or `start` scroll pushes it off. Instant
 * rather than smooth because a 300 ms animation is a window in which the buttons
 * are still off screen and a fast second tap lands on nothing, and because a
 * reduced-motion player is owed no animation at all.
 *
 * THE PANEL FIRST, THE ANSWERS SECOND, AND THE SECOND CALL IS NOT BELT-AND-BRACES.
 * A panel TALLER than the viewport cannot be brought wholly into view, and
 * `nearest` on the panel would align its TOP — leaving the buttons, which are at
 * its bottom, exactly where they were. So the actions row is asked for after the
 * panel, and it is the one that must win. At Text XL on a 360x640 phone the
 * question, the preview and a wrapped button row are what make that reachable
 * rather than hypothetical.
 *
 * NOTHING IS POSITIONED. This is a scroll, not a placement: the panel keeps the
 * rect the stylesheet gave it, and Law 2's container/coordinate rules have no
 * new subject. That also means the fix is INVISIBLE to any probe that refuses to
 * scroll on principle — see the note in tools/uprightgate.mjs, whose whole
 * reason for clicking through the Smith by hand is that it will not
 * scrollIntoView a target itself. Its clause R gates `unreachable` only, so it
 * was GREEN on this defect and is GREEN on this fix; the cells that can tell the
 * two apart are in tools/holdconfirm.mjs.
 */
function reveal(panel, actions) {
  if (!panel || typeof panel.scrollIntoView !== 'function') return;
  panel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (actions && typeof actions.scrollIntoView === 'function') {
    actions.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

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
    reveal(panel, row);
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
    // THE OTHER HALF OF "ALL INSTANCES" (S7 wide), and it is a REGISTRATION,
    // never a list. Some actions are reached without the focus cursor at all —
    // End Turn is the shipped one: `.end-turn` matches input.js's CHROME
    // selector, so no Enter and no pad Confirm can ever arrive on it, and its
    // only non-pointer door is the rebindable `e` / pad button 2 of the
    // `endTurn` row in input.js's own ACTIONS. Telling input.js WHICH ELEMENT
    // this action id draws lets that key open the same press this file already
    // serves, instead of a synthetic click that skips the beat.
    //
    // EVERY armed control registers, not a chosen few. input.js answers only
    // for ids that are also a `kind: 'key'` row over there, so the pairing is
    // the INTERSECTION OF TWO TABLES and nobody maintains a third: give
    // `shrineRest` a hotkey tomorrow and its hold is already on that key.
    setActionControl(actionId, el);
    const wrapped = function disarmBeat() { releaseActionControl(actionId, el); disarm(); };
    // A screen that repaints the control (combat's End Turn, every render) calls
    // this; it re-reads the state and re-dresses. Nothing else changes.
    wrapped.refresh = () => { el.dataset.beat = formNow(); disarm.refresh(); };
    return wrapped;
  };
}
