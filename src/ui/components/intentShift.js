import { reducedMotionRequested } from '../motion.js';
import { ANIM_SPEEDS, getAnimSpeed } from '../animationPace.js';

// The shift an enemy's intent row makes when a move resolves and the next planned move is promoted into the head slot
// (owner, 2026-11-13). Pure presentation: Web Animations on nodes the screen already built, nothing awaited, no
// input blocked, no state read or written. The old head fades and shrinks away, the first follow-up glyph moves from
// its place in the row to the head slot and grows to head size, and the rest of the row slides left.
export const INTENT_SHIFT_MS = 220;

/** The shift's length: 0 (skip) under reduced motion or the Instant pace. */
export function intentShiftMs() {
  if (reducedMotionRequested() || !ANIM_SPEEDS[getAnimSpeed()]) return 0;
  return INTENT_SHIFT_MS;
}

const rectOf = node => {
  const r = node?.getBoundingClientRect?.();
  return r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/**
 * snapshotIntentShift(intentNode) → what the old node looked like, taken BEFORE it is replaced: the rect and a clone of
 * its head, and the rect of each follow-up glyph in its compact row. The old node is detached by the rebuild, so
 * its rects cannot be read afterwards.
 */
export function snapshotIntentShift(node) {
  const head = node?.querySelector?.('.intent-compact .intent-actions');
  if (!head) return null;
  const rows = [...node.querySelectorAll('.intent-compact .intent-followup')];
  return { head: rectOf(head), ghost: head.cloneNode(true), followUps: rows.map(rectOf) };
}

const fromRect = (from, to) => {
  const dx = from.left - to.left, dy = from.top - to.top;
  return `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
};
const play = (node, keyframes, duration, extra = {}) => {
  try { return node.animate?.(keyframes, { duration, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards', ...extra }) ?? null; }
  catch { return null; }
};

/**
 * animateIntentShift(before, newNode, { duration }) → true when it started. `before` is snapshotIntentShift of the old
 * node, `newNode` the live node now showing the promoted head. Old follow-up i becomes the head (i = 0) or the new
 * follow-up i - 1; each moves from its old rect to its new one. Anything that cannot be measured is skipped.
 */
export function animateIntentShift(before, newNode, { duration = intentShiftMs() } = {}) {
  if (!before || !newNode || !(duration > 0) || typeof newNode.animate !== 'function') return false;
  const compact = newNode.querySelector('.intent-compact');
  const head = compact?.querySelector('.intent-actions');
  if (!head) return false;
  let started = false;
  // The old head: a ghost over its old place, fading and shrinking away.
  if (before.head && before.ghost && globalThis.document?.body) {
    const ghost = before.ghost;
    ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { position: 'fixed', left: `${before.head.left}px`, top: `${before.head.top}px`,
      width: `${before.head.width}px`, height: `${before.head.height}px`, margin: '0', pointerEvents: 'none', zIndex: '60' });
    document.body.append(ghost);
    const anim = play(ghost, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }], duration, { fill: 'forwards' });
    if (anim) { anim.onfinish = anim.oncancel = () => ghost.remove(); started = true; } else ghost.remove();
  }
  // The first follow-up glyph moves into the head slot and grows to head size.
  const headRect = rectOf(head);
  if (before.followUps[0] && headRect) {
    const grow = play(head, [{ transform: fromRect(before.followUps[0], headRect), transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], duration);
    started ||= !!grow;
  }
  // The rest of the row slides left, one place each.
  const items = [...compact.querySelectorAll('.intent-followup')];
  items.forEach((item, i) => {
    const from = before.followUps[i + 1], to = rectOf(item);
    if (!from || !to) return;
    const slide = play(item, [{ transform: fromRect(from, to), transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], duration);
    started ||= !!slide;
  });
  return started;
}
