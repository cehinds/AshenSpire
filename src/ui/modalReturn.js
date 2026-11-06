// src/ui/modalReturn.js — PARENT → CHILD MODAL RETURN, ONCE, FOR EVERY MENU.
//
// A modal that opens a child (a list that opens one row's review) records itself
// here as the child's PARENT: { place, reopen(focus) }. The rules every flow shares:
//   - the child's confirm, or its cancel/back, lands back on the parent, redrawn
//     in place (`returnToModalParent`; focus goes back to the row that opened it);
//   - only the parent's own close / X / Leave exits fully (`dropModalParent`);
//   - the child's Back label names the parent (`modalParentLabel`).
// Headless: no DOM here. The parent supplies `reopen`; it knows how to draw itself.
import { t } from './strings.js';
import { onModalsClosed } from './modalManager.js';

const parents = [];
const pending = [];

/** Record `rec` ({ place, reopen(focus) }) as the parent of the next child. Returns `rec`. */
export function pushModalParent(rec) {
  if (!rec || typeof rec.reopen !== 'function') return null;
  parents.push(rec);
  return rec;
}

/** The parent a child opened now would return to, or null. */
export function modalParent() { return parents.length ? parents[parents.length - 1] : null; }

/** The parent closed on its own (close / X / Leave): forget it, and every parent it had. */
export function dropModalParent(rec) {
  const at = parents.indexOf(rec);
  if (at >= 0) parents.length = at;
}

/**
 * The child confirmed or cancelled: pop the parent and redraw it once no other modal
 * (a receipt the confirm opened) is up. `focus` names the row to refocus. True when a
 * parent was waiting.
 */
export function returnToModalParent(focus) {
  const rec = parents.pop();
  if (!rec) return false;
  // One macrotask first: a confirm that redraws the screen and opens a receipt does so synchronously, after this call.
  const job = { done: false, run: () => { if (job.done) return; job.done = true; clearTimeout(job.timer); const at = pending.indexOf(job); if (at >= 0) pending.splice(at, 1); onModalsClosed(() => rec.reopen(focus)); } };
  job.timer = setTimeout(job.run, 0);
  pending.push(job);
  return true;
}

/** The child's Back label, built from the template in uistrings: names the place that opened the flow (Blacksmith, Shrine, Merchant, Rest), or plain Back with none. */
export function modalParentLabel(rec) {
  return rec?.place ? t('common.backTo', { place: rec.place }) : t('common.back');
}

/** TESTS ONLY. Run the scheduled returns now, in order. */
export function flushModalReturns() { for (const job of pending.slice()) job.run(); }

/** TESTS ONLY. */
export function resetModalParents() { parents.length = 0; for (const job of pending.splice(0)) clearTimeout(job.timer); }
