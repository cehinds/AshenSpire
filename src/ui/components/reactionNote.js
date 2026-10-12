// The "no reaction: why" note (owner, 2026-10-11): when a Counter or Sweep in
// hand could not be offered, a small toast just above the Reaction switch says
// why, in the combat log's own words (model/combatLog.js). One at a time — the
// newest replaces the last — for ~2.5 s; polite to a screen reader; never takes
// a click. Only the local seat's notes show (co-op passes its local seat ids).
import { reactionUnavailableNote } from '../../model/combatLog.js';
import { anchorLocalBox, clampBox } from '../fx.js';

export const REACTION_NOTE_MS = 2500;

// The hero's HP readout (owner, 2026-10-11): on a phone the switch sits right
// under the hero's mini HUD, so the note would cover the HP bar and value.
const AVOID_SELECTOR = '.combatant.player .combatant-mini-hud';

/**
 * avoidRects(box, rects, gap) → box. When `box` overlaps any of `rects` (all in
 * one coordinate space), move it up until its bottom sits `gap` px above the
 * highest overlapping rect's top; repeats if the moved box meets another rect.
 */
export function avoidRects(box, rects = [], gap = 6) {
  const hits = (a, b) => a.left < b.left + b.width && b.left < a.left + a.width
    && a.top < b.top + b.height && b.top < a.top + a.height;
  let out = { ...box };
  for (let pass = 0; pass <= rects.length; pass++) {
    const over = rects.filter((r) => r && r.width > 0 && r.height > 0 && hits(out, r));
    if (!over.length) break;
    const top = Math.min(...over.map((r) => r.top));
    out = { ...out, top: top - gap - out.height };
  }
  return out;
}

/**
 * The newest combatReactionUnavailable in `events` (from index `after` + 1)
 * that belongs to a local seat → { index, text } | null. `isLocal(ownerId)`.
 */
export function latestReactionNote(events = [], { after = -1, isLocal = () => true, registries, players, enemies } = {}) {
  for (let i = events.length - 1; i > after; i--) {
    const event = events[i];
    if (event?.type !== 'combatReactionUnavailable' || !isLocal(event.ownerId)) continue;
    return { index: i, text: reactionUnavailableNote(event, { registries, players, enemies }) };
  }
  return null;
}

/**
 * One note controller per combat screen. `attach(combatEl)` (re)places the
 * note in the combat box — co-op rebuilds its DOM per render, so the same node
 * is re-attached while it still has time left; `show(text)` replaces it.
 */
export function createReactionNote({ now = () => Date.now() } = {}) {
  let node = null, until = 0, timer = null, host = null;
  const place = () => {
    if (!node || !host || !node.isConnected) return;
    const toggle = host.querySelector('.reaction-switch');
    if (!toggle) { node.hidden = true; return; }
    node.hidden = false;
    const box = anchorLocalBox(host, toggle);
    const right = box.left + box.width;
    const bottom = box.top - 6;
    const width = node.offsetWidth || 0, height = node.offsetHeight || 0;
    const avoid = [...host.querySelectorAll(AVOID_SELECTOR)].map((el) => anchorLocalBox(host, el));
    const want = avoidRects({ left: right - width, top: bottom - height, width, height }, avoid, 6);
    const at = width && height
      ? clampBox(want, anchorLocalBox(host, host), { pad: 6 })
      : want;
    node.style.left = `${at.left}px`;
    node.style.top = `${at.top}px`;
  };
  const clear = () => {
    clearTimeout(timer); timer = null; until = 0;
    node?.remove(); node = null;
  };
  const attach = (combatEl) => {
    host = combatEl || null;
    if (!node) return;
    if (now() >= until || !host) { clear(); return; }
    if (node.parentNode !== host) {
      // A re-inserted node restarts its CSS fade; resume it where it was.
      node.style.animationDelay = `-${Math.max(0, REACTION_NOTE_MS - (until - now()))}ms`;
      host.append(node);
    }
    // The tools row may still move this frame (its geometry flush); place again after it.
    place();
    globalThis.requestAnimationFrame?.(place);
  };
  const show = (text) => {
    if (!text) return;
    clearTimeout(timer);
    node?.remove();
    node = document.createElement('div');
    node.className = 'reaction-note';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.textContent = text;
    until = now() + REACTION_NOTE_MS;
    timer = setTimeout(clear, REACTION_NOTE_MS);
    if (host) { host.append(node); place(); globalThis.requestAnimationFrame?.(place); }
  };
  return { show, attach, clear, get node() { return node; } };
}
