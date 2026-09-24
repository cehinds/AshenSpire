// src/ui/services/stageClock.js — the pausable clock JS-timer pose stages run on.
//
// WHY THIS EXISTS (SPEC §7.4 combat juice, hit-stop). A CSS or Web Animation
// can be paused through getAnimations(); a painted fighter cannot. Painted
// stages (PoseAnimator, paintedOutfits, enemyPoseStage, the equipped figure,
// the Reaver attack strip) step their frames with setTimeout, so a hit-stop
// that only paused animations left every painted figure swinging straight
// through the freeze. Each of those stages schedules its frame steps HERE,
// keyed by the element it draws into, and fx.js freezes the figure: every
// pending step under it stops, remembers how long it had left, and resumes
// with exactly that remainder when the freeze lets go. Nothing is skipped and
// nothing fires early, so a sequence's total length grows by the hold — the
// same amount the paced timeline waits.
//
// Pure scheduling: a host is only ever asked `contains`, so a test can drive
// it with plain objects and a fake timer pair.

const pending = new Set();
const frozen = new Map(); // figure → freeze count (nested freezes stack)
let clock = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id), now: () => Date.now() };

/** Test seam: swap the underlying timer functions. Returns the previous clock. */
export function setStageClock(next) {
  const prev = clock;
  clock = { ...clock, ...next };
  return prev;
}

const isFrozen = (host) => {
  for (const fig of frozen.keys()) {
    if (fig === host || (fig && typeof fig.contains === 'function' && host && fig.contains(host))) return true;
  }
  return false;
};

function arm(handle, ms) {
  handle.due = clock.now() + ms;
  handle.id = clock.set(() => {
    pending.delete(handle);
    handle.id = null;
    handle.fn();
  }, ms);
}

/** stageTimeout(host, fn, ms) → handle. setTimeout, but freezable through its host. */
export function stageTimeout(host, fn, ms) {
  const handle = { host, fn, id: null, due: 0, remaining: null };
  const delay = Math.max(0, Number(ms) || 0);
  pending.add(handle);
  if (isFrozen(host)) handle.remaining = delay;
  else arm(handle, delay);
  return handle;
}

/** clearStageTimeout(handle) — clearTimeout for a stageTimeout handle; null-safe. */
export function clearStageTimeout(handle) {
  if (!handle || typeof handle !== 'object') return;
  if (handle.id != null) clock.clear(handle.id);
  handle.id = null;
  handle.remaining = null;
  pending.delete(handle);
}

/**
 * freezeStageTimers(figures, ms) → release. Holds every pending stage step
 * drawn inside any of `figures` for ms (Infinity = until released). The
 * release is idempotent and resumes each held step with its own remainder.
 */
export function freezeStageTimers(figures, ms) {
  const figs = [...new Set((figures || []).filter(Boolean))];
  if (!figs.length || !(ms > 0)) return () => {};
  for (const fig of figs) frozen.set(fig, (frozen.get(fig) || 0) + 1);
  for (const handle of pending) {
    if (handle.id == null || !isFrozen(handle.host)) continue;
    clock.clear(handle.id);
    handle.id = null;
    handle.remaining = Math.max(0, handle.due - clock.now());
  }
  let released = false;
  let timer = null;
  const release = () => {
    if (released) return;
    released = true;
    if (timer != null) clock.clear(timer);
    for (const fig of figs) {
      const n = (frozen.get(fig) || 1) - 1;
      if (n > 0) frozen.set(fig, n); else frozen.delete(fig);
    }
    for (const handle of [...pending]) {
      if (handle.id != null || handle.remaining == null || isFrozen(handle.host)) continue;
      const left = handle.remaining;
      handle.remaining = null;
      arm(handle, left);
    }
  };
  if (Number.isFinite(ms)) timer = clock.set(release, ms);
  return release;
}

/** How many stage steps are waiting (armed or held) — for tests and debugging. */
export function pendingStageSteps() {
  return pending.size;
}
