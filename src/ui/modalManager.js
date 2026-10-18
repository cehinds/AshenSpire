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

// An entry whose element left the page without its close path running (a
// screen remount wiped the host it was appended to) is not open any more.
// Dropping it here keeps one missed release() from reporting a modal open
// forever, which would hold every whenNoOverlay() redraw back.
function prune() {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].element && stack[i].element.isConnected === false) stack.splice(i, 1);
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
  const entry = { name, element };
  stack.push(entry);
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    const at = stack.indexOf(entry);
    if (at >= 0) stack.splice(at, 1);
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
}
