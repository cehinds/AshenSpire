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
// PAGE CHROME: body-level elements (the co-op seat strip) that are not modals.
// They never hold the lock, never count in modalOpen() or data-modal-depth, and
// never stall a whenNoOverlay() redraw; they only go inert under a lock, exactly
// as an #app child does.
const chrome = new Set();

// An entry whose element left the page without its close path running (a
// screen remount wiped the host it was appended to) is not open any more.
// Dropping it here keeps one missed release() from reporting a modal open
// forever, which would hold every whenNoOverlay() redraw back.
function prune() {
  let dropped = false;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].element && stack[i].element.isConnected === false) {
      stack.splice(i, 1);
      leaveHistory();
      dropped = true;
    }
  }
  if (dropped) syncPage();
}

// BACK BUTTON. While any back-enabled entry is open, the history holds ONE
// sentinel state above the page's own: { ashenModal: LOAD } (LOAD is a nonce
// minted per page load, so a sentinel a reload left behind is never ours —
// boot replaces such a leftover with null). The browser/Android back button
// pops the sentinel: dismiss the top entry with 'back', and if back-enabled
// entries remain, push the sentinel again. A programmatic close of the LAST
// back-enabled entry pops the sentinel with history.back(); that back is
// async, so its popstate is counted and ignored — which also covers a modal
// opened in the same tick as that close (its sentinel push lands first, the
// queued back then pops it, and the count says that pop was ours).
const LOAD = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let popOn = null;
let sentinelUp = false; // our sentinel is the current history entry, as far as we know
let ignorePops = 0;     // popstates owed to our own history.back() calls

function canPush() {
  return typeof history !== 'undefined' && history && typeof history.pushState === 'function';
}

function ours(state) {
  return !!state && typeof state === 'object' && state.ashenModal === LOAD;
}

function backEntries() {
  return stack.filter((e) => e.back && e.dismiss && !e.closing);
}

function pushSentinel() {
  if (sentinelUp || !canPush()) return;
  history.pushState({ ashenModal: LOAD }, '');
  sentinelUp = true;
}

// A sentinel from an earlier load of this page (a reload with a modal open)
// is dead: going back() onto the entry below it would load the previous
// document. Replace it with nothing so neither path ever sees it.
function clearStaleSentinel() {
  if (!canPush() || typeof history.replaceState !== 'function') return;
  const state = history.state;
  if (state && typeof state === 'object' && 'ashenModal' in state && !ours(state)) history.replaceState(null, '');
}

function enterHistory(entry) {
  if (!entry.back || !entry.dismiss || !canPush()) return;
  ensurePopstate();
  pushSentinel();
}

// After a close that was not the browser's own pop: when no back-enabled entry
// is left and the sentinel is current, pop it. The popstate that follows is
// ours and is ignored.
function leaveHistory() {
  if (!sentinelUp || backEntries().length || !canPush() || typeof history.back !== 'function') return;
  if (!ours(history.state)) { sentinelUp = false; return; }
  sentinelUp = false;
  ignorePops++;
  history.back();
}

function onPopstate() {
  if (ignorePops > 0) { ignorePops--; return; }
  if (ours(typeof history !== 'undefined' ? history?.state : null)) return; // moved onto, not off, our sentinel
  const top = backEntries().at(-1);
  sentinelUp = false;
  if (!top) return;
  // Back is one-layer Back (SPEC §7.3). When a surface the manager does not
  // close sits above the top back-enabled entry (a confirmation over
  // Settings), that surface owns the moment: swallow the press by restoring
  // the sentinel and leave both standing, rather than closing the door
  // underneath the confirmation.
  const overall = stack.filter((e) => !e.closing).at(-1);
  if (overall !== top) { pushSentinel(); return; }
  top.popped = true;
  top.dismiss('back');
  // The entry below, if any, still needs a sentinel to catch the next back.
  if (backEntries().length) pushSentinel();
}

function ensurePopstate() {
  const add = globalThis.addEventListener;
  if (typeof add !== 'function' || popOn === add) return;
  popOn = add;
  clearStaleSentinel();
  globalThis.addEventListener('popstate', onPopstate);
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
  // An entry that has begun closing (release.unlock) no longer holds the page:
  // its opener must be focusable again BEFORE focus returns to it, and that
  // happens before the entry leaves the stack (the shell restores focus, then
  // removes its veil, then releases — so the waiters run last).
  const live = stack.filter((entry) => !entry.closing);
  if (root?.dataset) root.dataset.modalDepth = String(live.length);
  // The lock is held by the highest live entry that asked for it. A bespoke
  // surface opened above it (a confirmation over Settings) keeps that lock in
  // place — the page beneath must not wake while the lower dialog still stands —
  // and is itself left live along with everything that holds it. An entry above
  // the lock with no element cannot be exempted, so the lock lifts, as before.
  let lockAt = -1;
  for (let i = live.length - 1; i >= 0; i--) if (live[i].inert === true && live[i].element) { lockAt = i; break; }
  const above = lockAt >= 0 ? live.slice(lockAt + 1) : [];
  const want = new Set();
  if (lockAt >= 0 && above.every((entry) => entry.element)) {
    const kept = [live[lockAt].element, ...above.map((entry) => entry.element)];
    const holdsKept = (el) => kept.some((keep) => holds(el, keep));
    const app = typeof document.getElementById === 'function' ? document.getElementById('app') : null;
    for (const child of app?.children ? Array.from(app.children) : []) {
      if (!holdsKept(child)) want.add(child);
    }
    // Every registered surface beneath the lock goes inert, whether or not it
    // asked for a lock of its own: `inert` says what an entry does when it is
    // the lock, not whether a lock above may cover it (a legacy overlay whose
    // veil is a body sibling is not reached through #app).
    for (let i = 0; i < lockAt; i++) {
      const lower = live[i];
      if (lower.element && !holdsKept(lower.element)) want.add(lower.element);
    }
    // Page chrome under the lock goes inert too. A strip that left the page
    // without its release running is dropped (attribute reads only, no layout).
    for (const el of [...chrome]) {
      if (el?.isConnected === false) { chrome.delete(el); continue; }
      if (!holdsKept(el)) want.add(el);
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

// ESCAPE. One capture listener on the document, installed the first time an
// entry with `dismiss` registers (and again if the document object changes,
// which only tests do). It acts on the TOP entry only, and only when that entry
// has a `dismiss`; a bespoke surface that never passed one keeps its own Escape
// handler, and the manager neither closes it nor blocks it.
let escapeOn = null;

function onEscape(event) {
  if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) return;
  const top = topModal();
  if (!top || !top.dismiss) return;
  // A layer that is in the page but was never registered (the title's
  // `.title-modal-veil`, say) can sit above a registered door. The shell used
  // to refuse Escape unless its panel was the last `[aria-modal]`; keep that.
  const aria = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('[aria-modal="true"]') : null;
  const last = aria && aria.length ? aria[aria.length - 1] : null;
  if (last && last !== top.element && top.element?.isConnected && !holds(top.element, last)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  top.dismiss('escape');
}

function ensureEscape() {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  if (escapeOn === document) return;
  escapeOn = document;
  document.addEventListener('keydown', onEscape, true);
}

/**
 * registerModal(name, element, opts = {}) → release()
 *
 * Pushes the modal onto the stack. release() removes exactly that entry, once;
 * calling it again does nothing. Removing the last entry notifies the
 * onModalsClosed waiters.
 *
 * opts (all optional):
 *   dismiss(reason)  closes this modal; reason is 'escape' | 'back' | 'program'.
 *                    Without it the manager never closes the entry.
 *   back             true → the browser/Android back button dismisses it.
 *   inert            false → do not make the page behind it inert.
 */
export function registerModal(name, element, opts = {}) {
  const dismiss = typeof opts?.dismiss === 'function' ? opts.dismiss : null;
  const entry = {
    name,
    element,
    // The page lock is for entries the manager closes (the shared shell) or
    // that ask for it; a bespoke surface registered as it always was keeps
    // its own focus handling and its opener focusable (it restores focus
    // before it releases, and an inert opener cannot take focus).
    inert: opts?.inert === true ? true : opts?.inert === false ? false : !!dismiss,
    dismiss,
    back: opts?.back === true,
  };
  stack.push(entry);
  if (entry.dismiss) ensureEscape();
  enterHistory(entry);
  syncPage();
  let released = false;
  function release() {
    if (released) return;
    released = true;
    const at = stack.indexOf(entry);
    if (at >= 0) stack.splice(at, 1);
    leaveHistory();
    syncPage();
    notifyIfEmpty();
  }
  /**
   * release.unlock(): lift this entry's page effects (inert, scroll lock) NOW,
   * before the entry leaves the stack. A closing modal restores focus to its
   * opener first and releases last (so the onModalsClosed waiters run after the
   * veil is gone); an element inside an inert subtree cannot take focus, so the
   * inert must go before the focus does. modalOpen() still reports the entry
   * until release().
   */
  release.unlock = function unlock() {
    if (released || entry.closing) return;
    entry.closing = true;
    syncPage();
  };
  return release;
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

/**
 * Register body-level page chrome (not a modal) so a lock above it covers it.
 * Chrome never holds the lock and never counts in modalOpen()/openModals()/
 * data-modal-depth. Register it once it is IN the page: a disconnected element
 * is dropped on the next sync. Returns an idempotent release().
 */
export function registerPageChrome(element) {
  if (!element) return () => {};
  chrome.add(element);
  syncPage();
  return function releasePageChrome() {
    if (!chrome.delete(element)) return;
    syncPage();
  };
}

/** TESTS ONLY. Clears the stack and every pending waiter. */
export function resetModalState() {
  stack.length = 0;
  chrome.clear();
  waiters.length = 0;
  sentinelUp = false;
  ignorePops = 0;
  syncPage();
}
