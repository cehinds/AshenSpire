// src/ui/modalManager.js — THE ONE MODAL STACK.
//
// Owns which modals are open, in order (the last entry is the topmost). The
// four read APIs (modalOpen, topModal, openModals, onModalsClosed) and the
// register/release pair are what src/ui/modalState.js re-exports unchanged, so
// every existing importer keeps working. Nothing here touches the DOM unless
// the environment has one: guard every `document` / `history` access.
//
// An entry may carry `opts.dismiss(reason)`; the manager then owns Escape and
// the browser/Android back button for it. An entry WITHOUT `dismiss` behaves
// exactly as it always did: the manager never closes it.

const stack = [];
const waiters = [];
// Every element this module has marked `inert`. Only these are ever cleared:
// an inert some other surface set (deckEditor, gameProfileRest) is not ours.
const inertByUs = new Set();

// An entry whose element left the page without its close path running (a
// screen remount wiped the host it was appended to) is not open any more.
// Dropping it here keeps one missed release() from reporting a modal open
// forever, which would hold every whenNoOverlay() redraw back.
function prune() {
  let dropped = false;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].element && stack[i].element.isConnected === false) { stack.splice(i, 1); dropped = true; }
  }
  if (dropped) syncPage();
}

// a is b, or a contains b. A stand-in element with no DOM answers false.
function holds(a, b) {
  if (a === b) return true;
  try { return typeof a.contains === 'function' && a.contains(b); } catch { return false; }
}

/**
 * The page-level effects of the stack, recomputed on every push and pop:
 *   - `data-modal-depth` on <html> (CSS locks the body scroll off it);
 *   - `inert` on the app's children that do not hold the top modal, and on the
 *     lower modals' elements, while the top entry has not opted out.
 * Attribute reads and writes only; no layout is read, so a push or pop costs
 * no reflow.
 */
function syncPage() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (root?.dataset) root.dataset.modalDepth = String(stack.length);
  const top = stack.length ? stack[stack.length - 1] : null;
  const want = new Set();
  if (top && top.inert !== false && top.element) {
    const app = typeof document.getElementById === 'function' ? document.getElementById('app') : null;
    for (const child of app?.children ? Array.from(app.children) : []) {
      if (!holds(child, top.element)) want.add(child);
    }
    for (let i = 0; i < stack.length - 1; i++) {
      const lower = stack[i];
      if (lower.element && lower.inert !== false && !holds(lower.element, top.element)) want.add(lower.element);
    }
  }
  for (const el of [...inertByUs]) {
    if (want.has(el)) continue;
    inertByUs.delete(el);
    el.removeAttribute?.('inert');
  }
  for (const el of want) {
    if (inertByUs.has(el) || typeof el.setAttribute !== 'function') continue;
    if (el.hasAttribute?.('inert')) continue; // someone else's inert: leave it alone
    el.setAttribute('inert', '');
    inertByUs.add(el);
  }
}

function notifyIfEmpty() {
  if (stack.length > 0) return;
  for (const fn of waiters.splice(0)) fn();
}

/**
 * registerModal(name, element, opts = {}) → release()
 *
 * Pushes the modal onto the stack. release() removes exactly that entry, once;
 * calling it again does nothing. Removing the last entry notifies the
 * onModalsClosed waiters.
 */
export function registerModal(name, element, opts = {}) {
  const entry = {
    name,
    element,
    inert: opts?.inert,
    dismiss: typeof opts?.dismiss === 'function' ? opts.dismiss : null,
    back: opts?.back === true,
  };
  stack.push(entry);
  syncPage();
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    const at = stack.indexOf(entry);
    if (at >= 0) stack.splice(at, 1);
    syncPage();
    notifyIfEmpty();
  };
}

/** True while at least one registered modal is open. */
export function modalOpen() {
  prune();
  if (stack.length === 0) notifyIfEmpty();
  return stack.length > 0;
}

/** The topmost registered modal ({ name, element }), or null. */
export function topModal() {
  prune();
  return stack.length ? stack[stack.length - 1] : null;
}

/** A copy of the stack, bottom to top. Mutating it changes nothing. */
export function openModals() {
  prune();
  return stack.slice();
}

/**
 * onModalsClosed(fn) → cancel()
 *
 * Runs fn now if no modal is open. Otherwise runs it once, the next time the
 * stack becomes empty. cancel() drops a waiter that has not fired yet.
 */
export function onModalsClosed(fn) {
  prune();
  if (stack.length === 0) {
    fn();
    return () => {};
  }
  const waiter = () => fn();
  waiters.push(waiter);
  return () => {
    const at = waiters.indexOf(waiter);
    if (at >= 0) waiters.splice(at, 1);
  };
}

/** TESTS ONLY. Clears the stack and every pending waiter. */
export function resetModalState() {
  stack.length = 0;
  waiters.length = 0;
  syncPage();
}
