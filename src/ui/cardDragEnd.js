// CARD DRAG END — what a hand card's drag does when its gesture ends.
//
// combat.js hands this to trackGesture (src/ui/gesture.js) as the drag's
// onEnd. It lives here, DOM-free, so tests drive the exact decision the combat
// screen makes (tests/visibility-resume.test.mjs) instead of a copy of it: a
// phone backgrounded mid-drag ends the gesture CANCELLED, and a cancelled drag
// must drop nothing.
//
// `ops` is the screen's side of it:
//   teardown()       clear the drag visuals; returns whether a drag had begun
//   overHand(up)     is the release point inside the hand strip
//   reorder(up)      move the card within the hand to the release point
//   dropPlan(up)     { legal, targetId } for a release at that point
//   play(targetId)   play the card (targetId null for no-target cards)
// Returns what happened: 'click' | 'cancelled' | 'reorder' | 'played' | 'no-target'.
export function finishCardDrag(up, { cancelled } = {}, ops) {
  const wasDragging = ops.teardown();
  if (!wasDragging) return 'click'; // plain click handled by 'click'
  // A CANCELLED DRAG DROPS NOTHING — AND COSTS NOTHING. The cancelled
  // return sits ABOVE the suppressClick arm, and the order is Vira's
  // gate finding on this very fix: suppressClick guards a COMPLETED
  // drag against double-firing as a click, but no click follows a
  // cancel — armed here, the flag sat live and ate the card's next
  // real tap (one tap swallowed, self-recovering, both shapes;
  // introduced by the first version of this fix, on exactly the
  // gesture the fix exists to make safe). A drop plan on a cancel
  // would aim the card at wherever the finger happened to die.
  if (cancelled) return 'cancelled';
  // armHold consumes the trailing click of a moved press.
  if (ops.overHand(up)) { ops.reorder(up); return 'reorder'; }
  const plan = ops.dropPlan(up);
  if (!plan?.legal) return 'no-target';
  ops.play(plan.targetId || null);
  return 'played';
}
