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
//
//      ⚠ THIS RULE IS NOW A LIVE BREACH OF S7 AND IT IS UNRESOLVED. Constantine,
//      2026-08-17: "if press to hold is active for certain things for mouse or
//      game pad, it shoudl apply to everything including keyboard as well for
//      those same buttons." End Turn's hold SHIPPED, so at b968e28 a mouse must
//      hold End Turn for 600 ms and a single `e` ends the turn — measured, not
//      argued. Rule 3's reasoning above is good and it is not what settles this;
//      his word does, and whether the beat is owed on every input is Sunna's
//      read. THE FIX IS ONE LINE — the source guard at the top of armHold's
//      `begin`, which the press door below already makes sufficient. It is
//      deliberately not taken in the act that built the door, because it changes
//      COMMIT semantics on shipped controls and that is not this act's lane.
//      armInspect, whose stakes are `nothing`, serves all three inputs today.
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
// so on a line of its own (armHold does — see rule 3 above).
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

  function begin(origin, track) {
    // ─── THE ONE LINE THAT REFUSES S7, AND IT IS A KNOWN LIVE BREACH ────────
    // Rule 3 above: a focus cursor selects a NAMED element and cannot fall into
    // the 9 px gap this form exists for, so keyboard and pad commit on one
    // press. That reasoning is unchanged and it is not mine to overturn —
    // BUT IT IS NOW IN TENSION WITH A RULE CONSTANTINE STATED IN HIS OWN WORDS
    // (S7, 2026-08-17, `commons/decisions/directions.md`), and the tension is
    // not hypothetical: End Turn's hold SHIPPED, so at this commit a mouse must
    // hold End Turn for 600 ms and a single `e` ends the turn. MEASURED at
    // b968e28, ?shot=combat: data-beat="hold", data-hold-ms="600", turn 1 -> 2
    // on one keypress.
    // The door below serves all three inputs. Deleting this line is the whole
    // of the fix, and it is deliberately not deleted here: it changes COMMIT
    // semantics on shipped controls (End Turn, flasks, event choices, the
    // shrine), which is Sunna's read and Marina's lane, not this act's.
    // REMOVAL: the day that lane is dealt, or the day Sunna's read says the
    // beat is owed on every input — one line, no other edit.
    if (origin.source !== 'pointer') return false;
    heldThisPress = false;
    const ms0 = msOf();
    // The dial is off, or this state of this action owes no beat. Let the
    // click through untouched — that is the pre-hold behaviour, byte for byte.
    if (!(ms0 > 0)) return false;
    if (fired || armed) return false;
    heldThisPress = true;
    armed = true;
    btn.dataset.hold = 'holding';
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
      onEnd: () => { if (armed) stop('idle'); },
    });
    return true;
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
//   once open, movement does NOTHING here, and the caller is expected to
//   refuse to start a drag while `data-inspect="open"` (combat does): the
//   alternative — collapse into a live drag — lets a 13 px reading drift end
//   with a no-target card PLAYED on release over the field. A read must not
//   be able to become a commit; lift and aim again.
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
        // hand's scroll) — theirs, silently. Once open, movement is the
        // finger drifting while reading and changes nothing here.
        if (phase === 'pending' && Math.hypot(mv.clientX - x0, mv.clientY - y0) > SLOP) close();
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
