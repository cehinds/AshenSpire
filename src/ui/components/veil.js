// src/ui/components/veil.js — IS A VEIL STANDING, AND WHICH ONE. One question,
// one home, asked by everything that needs the answer.
//
// WHY THIS FILE EXISTS. The question had two homes and they disagreed:
//
//   overlay.js  overlayIsOpen()  ->  !!openVeil        ONE named veil — the
//                                                      in-run menu overlay, and
//                                                      only because that module
//                                                      happened to hold its
//                                                      element in a variable
//   input.js    scopeRoot()      ->  '.modal-veil'     EVERY veil, asked of the
//                                                      DOM, which is where the
//                                                      answer actually lives
//
// Six veils in this game are `.modal-veil`: the menu overlay, the pile viewer,
// the settings modal, the debug log, the quick-nav list and the in-combat
// Armoury. `overlayIsOpen()` had heard of exactly one of them, and combat.js
// guarded its whole keyboard handler on it. So: OPEN THE DRAW PILE, PRESS E,
// AND THE TURN ENDS UNDER THE PANEL YOU ARE READING. Hand 5 -> 0, discard
// 0 -> 5, measured at aa7bc49 on both shapes — and the same on the discard pile
// and on the in-combat Armoury, which nobody had named.
//
// That is not a missing `||`. It is one fact with two definitions, arriving
// from two directions, and it is the same defect this seat removed from
// `equipPiece` and `cycleSet` — the second copy that nothing keeps in sync.
// The fix is not to widen the narrow one; it is to DELETE it, so no caller can
// ever again pick the answer that knows about one veil.
//
// `veilIsOpen()` IS `topVeil() !== null` — not two implementations checked to
// agree, one branch that cannot differ. Same shape as `has` being
// `why(piece) === null` in model/loadout.js, and for the same reason.
//
// ---- WHAT COUNTS AS A VEIL, AND WHY `.tut-veil` DOES NOT --------------------
//
// The subject of this predicate is INPUT OWNERSHIP: is there a layer standing
// that owns the keyboard, so the screen beneath must not act on this key. The
// class `.modal-veil` is how a layer DECLARES that, and every one of the six
// carries it deliberately (two of them — `.qn-veil` and `.armoury-overlay` —
// carry it for the scoping alone and say so in their own files).
//
// `.tut-veil` is NOT one, it is `pointer-events: none` at z-index 800, and that
// is CORRECT rather than an oversight. The tutorial coaches the player THROUGH
// playing the board: it takes no pointer, and the board beneath it must keep
// answering keys or the coach marks would freeze the game they are teaching. It
// is not a subject of this predicate — IT IS A CALLER OF IT (tutorial.js asks
// before it answers Escape, so a veil over the tutorial wins). Ruled out loud,
// with the reason, because "absent from the selector" and "ruled out of the
// selector" look identical to the next reader — and the next reader is the one
// who would widen it and freeze the board.
//
// ---- TOPMOST IS PAINT ORDER, NOT DOM ORDER ---------------------------------
//
// `scopeRoot()` took `.modal-veil`'s LAST element in DOM order. Bjorn named the
// hazard: `.armoury-overlay` paints at z-index 60 while every other veil is
// 500, so a z500 veil standing FIRST and the Armoury opened after it makes DOM
// order and paint order disagree — and the focus cursor then drives the panel
// the player cannot see. He measured that shape: 60 presses, 12 controls on the
// buried layer. He also confirmed all four shipped routes agree today, so it
// was latent, and it stays latent only until someone opens two.
//
// A home that answers "which is topmost" with a rule known to be wrong is a
// graceful fallback with a defect living in it. So the rule here is the one the
// player's eye uses: HIGHER z-index WINS; equal z-index falls back to DOM
// order, which is what the browser itself does. All six veils are children of
// <body> with `position: fixed`, so they share the root stacking context and
// their z-indices are directly comparable — that is the precondition, and it is
// stated because the rule is wrong the day a veil mounts inside a transformed
// or filtered ancestor.
//
// ---- WHY IT COSTS NOTHING TODAY — AND MY FIRST ANSWER WAS THE WRONG REASON ---
//
// I wrote: *"one veil standing returns early and reads no style, so every
// shipped route is unchanged."* THE CONCLUSION HOLDS AND THE REASON IS FALSE.
// BJORN MEASURED IT: `overlay.js:295` opens the quick-nav FROM INSIDE the
// standing overlay, so there are FOUR REACHABLE STATES WITH TWO VEILS UP — and
// `.qn-veil` overrides only `background` and `display`, never `z-index`, so both
// are 500 and the loop below DOES read style. His sweep: 26/26 states agree
// with the old DOM-order answer, four of them two-veil.
//
// WHAT ACTUALLY SAVES THOSE FOUR IS THE `>=` ON THE COMPARISON, NOT THE EARLY
// RETURN. A mutant proves it: with `>`, a z500 tie keeps the FIRST veil and
// input goes to the overlay underneath the open list. So `>=` is load-bearing
// on a live path, not a tidy default — it is corrected here, in the file, rather
// than only in a log, because a true-looking comment over different code is the
// thing this house keeps finding and cannot catch by reading carefully.
//
// The early return is a cost saving on the common case and nothing more. It is
// the tie rule that makes today's answer identical to yesterday's.

/** Every veil currently standing, in DOM order. */
function standing() {
  return document.querySelectorAll('.modal-veil');
}

function zOf(el) {
  // `auto` and any unparseable value are treated as 0 — the same number CSS
  // gives a positioned element with no z-index, so an un-styled veil sorts
  // below the six that declare one rather than above them.
  const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : 0;
}

/**
 * topVeil() → the veil that owns input right now, or null.
 * Topmost by paint order: z-index first, DOM order to break a tie.
 */
export function topVeil() {
  const els = standing();
  if (!els.length) return null;
  // A cost saving on the common case, and ONLY that — it is not what keeps the
  // two-veil states answering the way they did (see the header).
  if (els.length === 1) return els[0];
  let best = els[0];
  let bestZ = zOf(best);
  for (let i = 1; i < els.length; i++) {
    const z = zOf(els[i]);
    // `>=`, NOT `>`, AND IT IS LOAD-BEARING ON A LIVE PATH. The quick-nav opens
    // from inside the standing overlay and both are z500, so this tie is
    // reachable in four states. `>` would keep the FIRST veil and hand input to
    // the overlay under the open list; `>=` keeps DOM order, which is what the
    // browser paints and what this game did before the rule changed.
    if (z >= bestZ) { best = els[i]; bestZ = z; }
  }
  return best;
}

/** True if any veil is standing — so a screen beneath it can refuse a key. */
export function veilIsOpen() {
  return topVeil() !== null;
}
