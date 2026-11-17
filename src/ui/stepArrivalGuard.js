// src/ui/stepArrivalGuard.js — a step change must not take the press that caused it twice.
//
// Character creation's footer re-lays out when a step changes: on a phone, Customise (class step) gives way to a
// wider Begin on the Review step, under the same finger. A second tap of a double tap, or the touch target that
// Chromium snaps a tap to, then landed on Begin and started the climb, so Review flashed and was skipped (owner,
// 2026-11-17, item 38). The guard notes when a press changed the step, and the forward control ignores presses
// that arrive within the window after it.
export const STEP_ARRIVAL_GUARD_MS = 450;

/** CreateStepArrivalGuard({ now, windowMs }) → { arrived(), allows() }. `now` defaults to performance.now. */
export function CreateStepArrivalGuard({ now = () => performance.now(), windowMs = STEP_ARRIVAL_GUARD_MS } = {}) {
  let arrivedAt = -Infinity;
  return {
    /** A press just changed the step. */
    arrived() { arrivedAt = now(); },
    /** May a forward press act now? */
    allows() { return now() - arrivedAt >= windowMs; },
  };
}
