// src/ui/modalState.js — WHICH MODALS ARE OPEN, AS JS STATE.
//
// Until now "is a modal open?" was answered by the DOM: a query for
// `[aria-modal="true"]` or `.modal-veil`. This module is the explicit answer.
// A modal shell registers itself when it opens and calls the returned release()
// in the same code path that removes its veil, on every path (close, Escape,
// scrim, programmatic close). Nothing here touches the DOM.
//
// The stack is ordered: the last entry is the topmost modal.

const stack = [];
const waiters = [];

function notifyIfEmpty() {
  if (stack.length > 0) return;
  for (const fn of waiters.splice(0)) fn();
}

/**
 * registerModal(name, element) → release()
 *
 * Pushes the modal onto the stack. release() removes exactly that entry, once;
 * calling it again does nothing. Removing the last entry notifies the
 * onModalsClosed waiters.
 */
export function registerModal(name, element) {
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
  return stack.length > 0;
}

/** The topmost registered modal ({ name, element }), or null. */
export function topModal() {
  return stack.length ? stack[stack.length - 1] : null;
}

/** A copy of the stack, bottom to top. Mutating it changes nothing. */
export function openModals() {
  return stack.slice();
}

/**
 * onModalsClosed(fn) → cancel()
 *
 * Runs fn now if no modal is open. Otherwise runs it once, the next time the
 * stack becomes empty. cancel() drops a waiter that has not fired yet.
 */
export function onModalsClosed(fn) {
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
