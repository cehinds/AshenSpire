// src/ui/components/holdbeat.js — THE HOLD HAS A BEAT.
//
// THE DEFECT, and it is a measurement rather than a taste. A press-and-hold
// whose only feedback is a fill is a gesture you cannot tell is working the
// moment your hand is on top of the fill. On the event screen the bar is
// 378x44 at 390x844 and a thumb covers a fraction of it, so the fill reads.
// END TURN IS 190.2x50.4 AT y=784.6 OF AN 844 px VIEWPORT — a control about
// the size of the contact patch, in the bottom 60 px, approached from below.
// The hand that presses it is on top of the only thing saying the press was
// received. A hold with no beat is then indistinguishable from a tap that did
// not register: the player presses again, and the thing they were being
// protected from fires twice. THAT IS WORSE THAN NO CONFIRMATION.
//
// (The occlusion sentence is REASONED, not measured. The two rects are real
// numbers from a real render; nobody in this family has watched a thumb.)
//
// WHAT IT DOES. Three quiet ticks during the fill and one arrival at the end,
// as one phrase — the score, the note choices and the levels are written out
// in src/content/sfx.js (`holdTick` / `holdCommit`), and WHERE in the fill
// they land is balance.ui.holdBeat. Nothing about the sound lives here.
//
// HOW IT ATTACHES, AND WHY THIS SHAPE. It listens to the DOM. `armHold`
// already publishes two facts on the held element every frame —
// `data-hold` (idle|holding|done) and `data-hold-progress` — because an
// instrument and a screenshot both needed to read them. So the beat DERIVES
// from the state the control already describes (Law 0 clause 1) and needs no
// call in holdconfirm.js, no argument threaded through, and no edit at any
// call site. Two consequences worth stating plainly:
//
//   * It works on every control that holds, TODAY AND LATER. The event screen
//     is the only caller at this ref; the day "takes a second beat" becomes a
//     characteristic of an action rather than a list of call sites, End Turn
//     and the Smith arrive with a beat and NOBODY EDITS THIS FILE.
//   * The per-action flourish is a data attribute, not a parameter. A control
//     carrying `data-hold-action="endTurn"` composes `holdCommit_endTurn`,
//     which resolves exact -> family -> default in content/sfx.js. With the
//     attribute absent — which is every control at this ref — the family row
//     answers, and that is the correct sound rather than a fallback blip.
//
// THE ABORT IS SILENT ON PURPOSE. Releasing early is the feature and it is the
// COMMON case, so a cue there would be the most-fired sound in the game and it
// would be reporting that nothing happened. The train stopping says it.
//
// WHAT THIS IS NOT. It is not the floor. A muted phone, a silent room and an
// iPhone with the ringer off all get nothing from this file, so the VISIBLE
// beat is still the thing a player must be able to rely on — and on End Turn
// the visible beat is under the thumb. That gap is named in the report and is
// not closed here; sound is the channel that is not occluded by a hand, not
// the channel that is always on.

import { sfx } from '../sfx.js';

/** The attributes `armHold` publishes. Named once — a typo here is silence. */
const ATTRS = ['data-hold', 'data-hold-progress'];

/**
 * installHoldBeat({ root, at, play }) -> uninstall()
 *
 * `at` is balance.ui.holdBeat.at — fractions of the fill, ascending, 1.0
 * excluded (the arrival is `holdCommit`, not a tick). An empty or missing list
 * means no ticks and a commit that still lands: turning the train off is a
 * tuning decision the row is allowed to express.
 */
export function installHoldBeat({ root = document, at = [], play = (id) => sfx.play(id) } = {}) {
  // Copy, and drop anything the validator would have refused. The validator is
  // the loud gate (model/validate.js, balance.ui.holdBeat); this is the quiet
  // one, and it exists because a beat that THROWS mid-hold takes the fill's
  // animation frame down with it and breaks the confirm itself. Fail small.
  const marks = (Array.isArray(at) ? at : []).filter((f) => typeof f === 'number' && f >= 0 && f < 1);

  // Per-element cursor: how many marks this hold has already sounded. A
  // WeakMap so a screen that unmounts takes its state with it.
  const cursor = new WeakMap();

  const idFor = (el, phase) => {
    const action = el.dataset ? el.dataset.holdAction : null;
    return action ? `${phase}_${action}` : phase;
  };

  // Fire every mark the fill has passed since the last frame. A slow frame can
  // cross two at once — they are sounded in order rather than collapsed,
  // because collapsing them would make a stutter sound like progress.
  function advance(el, p) {
    let n = cursor.get(el) || 0;
    while (n < marks.length && p >= marks[n]) {
      play(idFor(el, 'holdTick'));
      n++;
    }
    cursor.set(el, n);
  }

  function transition(el, was, now) {
    if (now === 'holding' && was !== 'holding') {
      // The press report does NOT wait for the first painted frame. `begin()`
      // sets 'holding' and the first progress paint is one rAF later; on a busy
      // frame that is the difference between "instant" and "did it take my
      // press?", which is the whole question this file answers.
      cursor.set(el, 0);
      advance(el, 0);
    } else if (now === 'done' && was === 'holding') {
      play(idFor(el, 'holdCommit'));
      cursor.set(el, marks.length);
    } else if (now === 'idle' && was === 'holding') {
      // The abort. Deliberately nothing. See the header.
      cursor.set(el, marks.length);
    }
  }

  // A MutationObserver record carries only `oldValue`, and by the time the
  // callback runs the DOM HAS ALREADY MOVED ON — possibly several steps.
  //
  // THIS IS NOT A HYPOTHETICAL AND IT IS THE BUG THIS FUNCTION EXISTS FOR.
  // A completed hold does three things in ONE task: armHold sets 'done', calls
  // onConfirm, and the screen's commit disarms every bar, which sets 'idle'.
  // Reading `el.dataset.hold` in the callback therefore returns 'idle' for the
  // record whose oldValue is 'holding' — so the arrival was scored as an ABORT
  // and the commit sound never played, on the one screen that actually holds
  // today. The synthetic control in tools/holdbeat.mjs never disarms, so it
  // sounded perfect while the real one was missing its last note.
  //
  // So the chain is RECONSTRUCTED: values are [r0.old, r1.old, ..., current],
  // and every adjacent pair is a real transition that happened, in order.
  function flush(records) {
    const chain = new Map();
    for (const r of records) {
      if (r.attributeName !== 'data-hold') continue;
      if (!chain.has(r.target)) chain.set(r.target, []);
      chain.get(r.target).push(r.oldValue);
    }
    for (const [el, olds] of chain) {
      if (!el.dataset) continue;
      const seq = olds.concat([el.dataset.hold]);
      for (let i = 1; i < seq.length; i++) transition(el, seq[i - 1], seq[i]);
    }
    // Progress is replayed once per target, from the CURRENT value, and only
    // while the element is still holding. `advance` is monotonic, so replaying
    // every intermediate frame would sound exactly the same ticks; and a target
    // whose hold ended in this same batch has already been resolved above.
    const moved = new Set();
    for (const r of records) if (r.attributeName === 'data-hold-progress') moved.add(r.target);
    for (const el of moved) {
      if (!el.dataset || el.dataset.hold !== 'holding') continue;
      const p = Number(el.dataset.holdProgress);
      if (Number.isFinite(p)) advance(el, p);
    }
  }

  const obs = new MutationObserver(flush);
  const target = root.body || root;
  obs.observe(target, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ATTRS });
  return function uninstall() { obs.disconnect(); };
}
