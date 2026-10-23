// tests/modal-manager.test.mjs — the one modal stack (src/ui/modalManager.js):
// page depth + inert, Escape for entries that opt in, and the back button.
//
//   node --test tests/modal-manager.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewardDom } from './helpers/reward-dom.mjs';
import { registerModal, registerPageChrome, resetModalState, openModals, modalOpen } from '../src/ui/modalManager.js';

// A page: <html> > <body> > #app > [screen, hud], with a veil per modal in body.
function withPage(fn) {
  const dom = rewardDom();
  const { document } = dom;
  const proto = Object.getPrototypeOf(document.body);
  proto.contains = function contains(node) { for (let at = node; at; at = at.parentNode) if (at === this) return true; return false; };
  document.documentElement = document.createElement('html');
  const app = document.createElement('main');
  app.id = 'app';
  document.body.appendChild(app);
  document.getElementById = (id) => (id === 'app' ? app : null);
  const screen = document.createElement('div');
  const hud = document.createElement('div');
  app.append(screen, hud);
  const had = 'document' in globalThis;
  const saved = globalThis.document;
  globalThis.document = document;
  resetModalState();
  try { return fn({ document, app, screen, hud }); } finally {
    resetModalState();
    if (had) globalThis.document = saved; else delete globalThis.document;
  }
}

const modalIn = (document, host = document.body) => {
  const veil = document.createElement('div');
  const panel = document.createElement('section');
  veil.appendChild(panel);
  host.appendChild(veil);
  return panel;
};

test('data-modal-depth follows the stack up and down', () => {
  withPage(({ document }) => {
    const root = document.documentElement;
    const a = registerModal('a', modalIn(document));
    assert.equal(root.dataset.modalDepth, '1');
    const b = registerModal('b', modalIn(document));
    assert.equal(root.dataset.modalDepth, '2');
    b();
    assert.equal(root.dataset.modalDepth, '1');
    a();
    assert.equal(root.dataset.modalDepth, '0');
  });
});

test('a modal marks the app behind it inert and clears exactly that on pop', () => {
  withPage(({ document, screen, hud }) => {
    const release = registerModal('door', modalIn(document), { dismiss() {} });
    assert.equal(screen.hasAttribute('inert'), true);
    assert.equal(hud.hasAttribute('inert'), true);
    release();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('release.unlock lifts the inert and the depth before the entry leaves the stack', () => {
  withPage(({ document, screen }) => {
    const release = registerModal('door', modalIn(document), { dismiss: () => {} });
    assert.equal(screen.hasAttribute('inert'), true);
    release.unlock();
    assert.equal(screen.hasAttribute('inert'), false, 'the opener can take focus again');
    assert.equal(document.documentElement.dataset.modalDepth, '0');
    assert.equal(modalOpen(), true, 'still open until release(): waiters have not run');
    release();
    assert.equal(modalOpen(), false);
  });
});

test('lower modals go inert under a higher one and wake when it pops', () => {
  withPage(({ document }) => {
    const lower = modalIn(document);
    const upper = modalIn(document);
    const releaseLower = registerModal('lower', lower, { dismiss() {} });
    assert.equal(lower.hasAttribute('inert'), false, 'the top modal is never inert');
    const releaseUpper = registerModal('upper', upper, { dismiss() {} });
    assert.equal(lower.hasAttribute('inert'), true);
    assert.equal(upper.hasAttribute('inert'), false);
    releaseUpper();
    assert.equal(lower.hasAttribute('inert'), false);
    releaseLower();
  });
});

test('an app child that holds the modal stays live; its siblings go inert', () => {
  withPage(({ document, screen, hud }) => {
    const inside = modalIn(document, screen);
    const release = registerModal('in-screen', inside, { dismiss() {} });
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(hud.hasAttribute('inert'), true);
    release();
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('an inert the manager did not set survives the pop', () => {
  withPage(({ document, screen, hud }) => {
    screen.setAttribute('inert', '');
    const release = registerModal('door', modalIn(document), { dismiss() {} });
    assert.equal(hud.hasAttribute('inert'), true);
    release();
    assert.equal(screen.hasAttribute('inert'), true, 'the other surface still owns its inert');
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('inert: false leaves the page behind interactive; depth still counts', () => {
  withPage(({ document, screen }) => {
    const release = registerModal('quiet', modalIn(document), { inert: false });
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(document.documentElement.dataset.modalDepth, '1');
    release();
  });
});

test('a bespoke surface above a locking modal keeps the page locked and stays live itself', () => {
  withPage(({ document, screen, hud }) => {
    const settings = modalIn(document);
    const releaseSettings = registerModal('settings', settings, { dismiss() {} });
    assert.equal(screen.hasAttribute('inert'), true);
    const confirm = modalIn(document);
    const releaseConfirm = registerModal('confirmation', confirm); // no dismiss, no inert: a bespoke dialog
    assert.equal(screen.hasAttribute('inert'), true, 'the page under Settings stays locked');
    assert.equal(hud.hasAttribute('inert'), true);
    assert.equal(confirm.hasAttribute('inert'), false, 'the confirmation is live');
    assert.equal(settings.hasAttribute('inert'), false, 'the confirmation does not hold the lock; Settings is not inert under it');
    releaseConfirm();
    assert.equal(screen.hasAttribute('inert'), true);
    releaseSettings();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('a bespoke surface beneath a locking modal goes inert under it and wakes when it pops', () => {
  withPage(({ document }) => {
    const overlay = modalIn(document); // a veil that is a body sibling, not an #app child
    const releaseOverlay = registerModal('overlay', overlay, { inert: false });
    assert.equal(overlay.hasAttribute('inert'), false);
    const shell = modalIn(document);
    const releaseShell = registerModal('offline-play', shell, { dismiss() {} });
    assert.equal(overlay.hasAttribute('inert'), true, 'the lock above covers the legacy surface');
    assert.equal(shell.hasAttribute('inert'), false);
    releaseShell();
    assert.equal(overlay.hasAttribute('inert'), false);
    releaseOverlay();
  });
});

test('a pruned (disconnected) entry clears its inert and depth', () => {
  withPage(({ document, screen }) => {
    const panel = modalIn(document);
    registerModal('ghost', panel, { dismiss() {} });
    assert.equal(screen.hasAttribute('inert'), true);
    panel.parentNode.remove();
    assert.equal(openModals().length, 0);
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(document.documentElement.dataset.modalDepth, '0');
  });
});

test('registering with no document at all does not throw', () => {
  resetModalState();
  const release = registerModal('headless', {});
  assert.equal(openModals().length, 1);
  release();
});

// --- Back button ----------------------------------------------------------
// A fake `history` with the browser's one important property: back() is async.
// It queues a traversal; settle() performs it and fires popstate.
function withHistory(fn) {
  const entries = [{ state: null }];
  let at = 0;
  let queued = 0;
  const popListeners = [];
  const history = {
    get state() { return entries[at].state; },
    backCalls: 0,
    pushes: 0,
    pushState(state) { entries.splice(at + 1); entries.push({ state }); at += 1; this.pushes += 1; },
    back() { this.backCalls += 1; queued += 1; },
  };
  const settle = () => {
    while (queued > 0) {
      queued -= 1;
      if (at > 0) at -= 1;
      for (const l of popListeners.slice()) l({ type: 'popstate', state: entries[at].state });
    }
  };
  // The user's own back press: the traversal happens, then popstate.
  const userBack = () => { queued += 1; settle(); };
  const keys = ['history', 'addEventListener', 'removeEventListener'];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  Object.defineProperty(globalThis, 'history', { value: history, configurable: true, writable: true });
  globalThis.addEventListener = (type, fn) => { if (type === 'popstate') popListeners.push(fn); };
  globalThis.removeEventListener = () => {};
  try { return fn({ history, settle, userBack }); } finally {
    for (const k of keys) {
      if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k];
    }
  }
}

test('back: opening pushes one history state; the browser back dismisses with "back"', () => {
  withHistory(({ history, userBack }) => {
    resetModalState();
    const reasons = [];
    let release = null;
    release = registerModal('door', {}, { dismiss: (reason) => { reasons.push(reason); release(); }, back: true });
    assert.equal(history.pushes, 1);
    assert.equal(typeof history.state.ashenModal, 'string', 'the sentinel carries this load\'s nonce');
    userBack();
    assert.deepEqual(reasons, ['back']);
    assert.equal(openModals().length, 0);
    assert.equal(history.backCalls, 0, 'closing after the browser popped it does not go back again');
  });
});

test('back: a programmatic close goes back once, and that popstate dismisses nothing', () => {
  withHistory(({ history, settle }) => {
    resetModalState();
    const reasons = [];
    const release = registerModal('door', {}, { dismiss: (reason) => reasons.push(reason), back: true });
    release();
    release();
    assert.equal(history.backCalls, 1, 'one back() for one push, however often release runs');
    settle();
    assert.deepEqual(reasons, [], 'the popstate from our own back() found nothing to dismiss');
    assert.equal(history.state, null);
  });
});

test('back: two stacked entries pop one at a time', () => {
  withHistory(({ history, userBack }) => {
    resetModalState();
    const log = [];
    const entry = (name) => {
      const release = registerModal(name, {}, { dismiss: (reason) => { log.push(`${name}:${reason}`); release(); }, back: true });
      return release;
    };
    entry('a');
    entry('b');
    assert.equal(history.pushes, 1, 'one sentinel however many are stacked');
    userBack();
    assert.deepEqual(log, ['b:back']);
    assert.deepEqual(openModals().map((m) => m.name), ['a']);
    assert.equal(history.pushes, 2, 'the sentinel is pushed again for the one still open');
    userBack();
    assert.deepEqual(log, ['b:back', 'a:back']);
    assert.equal(history.backCalls, 0);
  });
});

test('back: closing the top of two programmatically leaves the lower one standing', () => {
  withHistory(({ history, settle }) => {
    resetModalState();
    const log = [];
    registerModal('a', {}, { dismiss: (reason) => log.push(`a:${reason}`), back: true });
    const releaseB = registerModal('b', {}, { dismiss: (reason) => log.push(`b:${reason}`), back: true });
    releaseB();
    settle();
    assert.deepEqual(log, [], 'a was not dismissed');
    assert.deepEqual(openModals().map((m) => m.name), ['a']);
    assert.equal(history.backCalls, 0, 'the sentinel stays while a back-enabled entry remains');
    assert.ok(history.state && history.state.ashenModal, 'the sentinel is still current');
  });
});

test('back: entries without back, or without dismiss, never touch history', () => {
  withHistory(({ history, userBack }) => {
    resetModalState();
    const plain = registerModal('plain', {});
    const noBack = registerModal('no-back', {}, { dismiss() {} });
    assert.equal(history.pushes, 0);
    userBack();
    assert.equal(openModals().length, 2, 'a popstate closes neither');
    plain();
    noBack();
    assert.equal(history.backCalls, 0);
  });
});

test('back: a modal opened in the same tick as the last one closed is not dismissed by that close\'s pop', () => {
  withHistory(({ history, settle }) => {
    resetModalState();
    const log = [];
    const releaseB = registerModal('b', {}, { dismiss: (reason) => log.push(`b:${reason}`), back: true });
    releaseB(); // queues history.back() (async)
    const releaseC = registerModal('c', {}, { dismiss: (reason) => log.push(`c:${reason}`), back: true });
    assert.equal(history.pushes, 2, 'c pushed a fresh sentinel before the back landed');
    settle(); // the queued back lands on c's sentinel's predecessor… and is ours to ignore
    assert.deepEqual(log, [], 'c survives the pop our own back() caused');
    assert.deepEqual(openModals().map((m) => m.name), ['c']);
    releaseC();
    settle();
    assert.equal(openModals().length, 0);
  });
});

test('back: a sentinel left by an earlier load of the page is replaced, never gone back onto', () => {
  withHistory(({ history }) => {
    resetModalState();
    // A reload keeps history.state; this one is from a previous load (a foreign nonce).
    history.pushState({ ashenModal: 'stale-load' });
    const replaced = [];
    history.replaceState = (state) => { replaced.push(state); };
    registerModal('door', {}, { dismiss() {}, back: true });
    assert.deepEqual(replaced, [null], 'the stale sentinel was replaced with nothing');
  });
});

test('back: a bespoke surface above the top back-enabled entry owns the press; the door beneath stays', () => {
  withHistory(({ history, userBack }) => {
    resetModalState();
    const log = [];
    registerModal('settings', {}, { dismiss: (reason) => log.push(`settings:${reason}`), back: true });
    const confirm = registerModal('confirm', {}); // no dismiss, no back: a confirmation with its own handling
    userBack();
    assert.deepEqual(log, [], 'Settings is not closed underneath the confirmation');
    assert.deepEqual(openModals().map((m) => m.name), ['settings', 'confirm']);
    assert.ok(history.state && history.state.ashenModal, 'the sentinel is back in place for the next press');
    confirm();
    userBack();
    assert.deepEqual(log, ['settings:back']);
  });
});

test('back: the shared shell pushes on open, goes back on close, and closes on browser back', async () => {
  const { withModalDom } = await import('./helpers/modal-dom.mjs');
  const { openModal } = await import('../src/ui/components/modalShell.js');
  withModalDom(() => {
    withHistory(({ history, settle, userBack }) => {
      resetModalState();
      let closes = 0;
      const first = openModal({ title: 'One', onClose: () => { closes += 1; } });
      assert.equal(history.pushes, 1);
      first.close();
      assert.equal(first.veil.isConnected, false, 'the veil is gone synchronously, before any popstate');
      assert.equal(history.backCalls, 1);
      settle();
      const second = openModal({ title: 'Two', onClose: () => { closes += 1; } });
      userBack();
      assert.equal(closes, 2);
      assert.equal(second.veil.isConnected, false);
      assert.equal(history.backCalls, 1, 'no extra back() after the browser popped it');
    });
  });
});

// --- Escape ---------------------------------------------------------------
// The shell is exercised through withModalDom, whose window.press() replays a
// key the way a browser orders it (window capture, document capture, bubble).

test('Escape on a shell modal closes it through the manager, once', async () => {
  const { withModalDom } = await import('./helpers/modal-dom.mjs');
  const { openModal } = await import('../src/ui/components/modalShell.js');
  resetModalState();
  withModalDom((dom, win) => {
    let closes = 0;
    const shell = openModal({ title: 'Settings', onClose: () => { closes += 1; } });
    const event = win.press('Escape', { cancelable: true });
    assert.equal(closes, 1, 'closed once');
    assert.equal(shell.veil.isConnected, false, 'veil removed synchronously');
    assert.equal(event.defaultPrevented, true);
    assert.equal(openModals().length, 0);
    win.press('Escape');
    assert.equal(closes, 1, 'a second Escape finds nothing to close');
    shell.close();
    assert.equal(closes, 1, 'close after Escape is a no-op');
  });
});

test('Escape closes only the top of two shell modals', async () => {
  const { withModalDom } = await import('./helpers/modal-dom.mjs');
  const { openModal } = await import('../src/ui/components/modalShell.js');
  resetModalState();
  withModalDom((dom, win) => {
    const log = [];
    const lower = openModal({ title: 'Lower', onClose: () => log.push('lower') });
    const upper = openModal({ title: 'Upper', onClose: () => log.push('upper') });
    win.press('Escape');
    assert.deepEqual(log, ['upper']);
    assert.equal(lower.veil.isConnected, true);
    win.press('Escape');
    assert.deepEqual(log, ['upper', 'lower']);
    assert.equal(upper.veil.isConnected, false);
  });
});

test('Escape with a bespoke (no dismiss) entry on top is left alone', async () => {
  const { withModalDom } = await import('./helpers/modal-dom.mjs');
  const { openModal } = await import('../src/ui/components/modalShell.js');
  resetModalState();
  withModalDom((dom, win) => {
    let closes = 0;
    const shell = openModal({ title: 'Under', onClose: () => { closes += 1; } });
    const bespoke = dom.document.createElement('section');
    bespoke.setAttribute('aria-modal', 'true');
    dom.document.body.appendChild(bespoke);
    const release = registerModal('bespoke', bespoke);
    const event = win.press('Escape');
    assert.equal(closes, 0, 'the shell underneath did not close');
    assert.equal(event.defaultPrevented, false, 'the manager did not consume the key');
    assert.equal(shell.veil.isConnected, true);
    release();
    bespoke.remove();
    win.press('Escape');
    assert.equal(closes, 1, 'once the bespoke layer is gone the shell answers again');
  });
});

test('an entry registered with dismiss gets reason "escape"; repeats are ignored', () => {
  const calls = [];
  const listeners = [];
  const fake = {
    addEventListener: (type, fn) => listeners.push([type, fn]),
    removeEventListener() {},
    querySelectorAll: () => [],
  };
  const had = 'document' in globalThis;
  const saved = globalThis.document;
  globalThis.document = fake;
  try {
    resetModalState();
    const release = registerModal('mine', {}, { dismiss: (reason) => calls.push(reason) });
    const [, onKey] = listeners.find(([type]) => type === 'keydown');
    onKey({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(calls, ['escape']);
    onKey({ key: 'Escape', repeat: true, preventDefault() {}, stopPropagation() {} });
    onKey({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(calls, ['escape'], 'repeat and other keys are ignored');
    release();
  } finally {
    resetModalState();
    if (had) globalThis.document = saved; else delete globalThis.document;
  }
});

// ---- page chrome: body-level elements (the co-op seat strip) that are not modals ----

const chromeIn = (document) => {
  const strip = document.createElement('nav');
  document.body.appendChild(strip);
  return strip;
};

test('page chrome goes inert under a lock and wakes when it pops', () => {
  withPage(({ document }) => {
    const strip = chromeIn(document);
    const releaseChrome = registerPageChrome(strip);
    assert.equal(modalOpen(), false, 'chrome alone is not an open modal');
    assert.equal(document.documentElement.dataset.modalDepth, '0');
    assert.equal(openModals().length, 0);
    assert.equal(strip.hasAttribute('inert'), false);
    const releaseDoor = registerModal('door', modalIn(document), { dismiss() {} });
    assert.equal(strip.hasAttribute('inert'), true, 'the door covers the strip');
    assert.equal(openModals().length, 1, 'the strip does not appear on the stack');
    assert.equal(document.documentElement.dataset.modalDepth, '1');
    releaseDoor();
    assert.equal(strip.hasAttribute('inert'), false);
    releaseChrome();
    releaseChrome(); // idempotent
    assert.equal(strip.hasAttribute('inert'), false);
  });
});

test('page chrome stacking order: it stays inert while any lock stands and wakes with the last one', () => {
  withPage(({ document }) => {
    const strip = chromeIn(document);
    registerPageChrome(strip);
    const overlay = modalIn(document);
    const releaseOverlay = registerModal('overlay', overlay, { inert: false });
    assert.equal(strip.hasAttribute('inert'), false, 'an overlay that asked for no lock leaves the strip live');
    const shell = modalIn(document);
    const releaseShell = registerModal('offline-play', shell, { dismiss() {} });
    assert.equal(strip.hasAttribute('inert'), true);
    assert.equal(overlay.hasAttribute('inert'), true);
    assert.equal(shell.hasAttribute('inert'), false);
    const confirm = modalIn(document);
    const releaseConfirm = registerModal('confirmation', confirm); // bespoke, above the shell
    assert.equal(strip.hasAttribute('inert'), true, 'the strip stays covered under the confirmation');
    assert.equal(confirm.hasAttribute('inert'), false);
    assert.equal(shell.hasAttribute('inert'), false);
    releaseConfirm();
    assert.equal(strip.hasAttribute('inert'), true);
    assert.equal(overlay.hasAttribute('inert'), true);
    assert.equal(shell.hasAttribute('inert'), false);
    releaseShell();
    assert.equal(strip.hasAttribute('inert'), false);
    assert.equal(overlay.hasAttribute('inert'), false);
    releaseOverlay();
    assert.equal(strip.hasAttribute('inert'), false);
  });
});

test('chrome registered while the lock stands goes inert at once; releasing the old registration frees it', () => {
  withPage(({ document }) => {
    const releaseDoor = registerModal('door', modalIn(document), { dismiss() {} });
    const a = chromeIn(document);
    const releaseA = registerPageChrome(a);
    assert.equal(a.hasAttribute('inert'), true);
    const b = chromeIn(document);
    const releaseB = registerPageChrome(b);
    releaseA();
    assert.equal(b.hasAttribute('inert'), true);
    assert.equal(a.hasAttribute('inert'), false, 'the released strip is freed');
    // A strip removed from the page without its release running is dropped silently.
    b.remove();
    const c = chromeIn(document);
    registerPageChrome(c);
    assert.equal(c.hasAttribute('inert'), true);
    releaseB();
    assert.equal(c.hasAttribute('inert'), true, 'a stale release touches only its own element');
    releaseDoor();
    assert.equal(c.hasAttribute('inert'), false);
  });
});

test('a background/resume cycle changes nothing about the chrome lock and adds no lifecycle listener', () => {
  withPage(({ document }) => {
    const seen = [];
    const wrap = (target, label) => {
      const original = target.addEventListener?.bind(target);
      target.addEventListener = (type, ...rest) => { seen.push(`${label} ${type}`); return original?.(type, ...rest); };
    };
    const hadWindow = 'window' in globalThis;
    const savedWindow = globalThis.window;
    const win = globalThis.window ?? {};
    if (!hadWindow) globalThis.window = win;
    wrap(document, 'document');
    wrap(win, 'window');
    try {
      const strip = chromeIn(document);
      registerPageChrome(strip);
      const screenState = () => ({ inert: strip.hasAttribute('inert'), depth: document.documentElement.dataset.modalDepth, open: openModals().length });
      const releaseDoor = registerModal('door', modalIn(document), { dismiss() {} });
      const before = screenState();
      assert.deepEqual(before, { inert: true, depth: '1', open: 1 });
      const cycle = [
        ['window', 'blur'], ['document', 'visibilitychange'], ['window', 'pagehide'], ['document', 'freeze'],
        ['document', 'resume'], ['window', 'pageshow'], ['document', 'visibilitychange'], ['window', 'focus'],
      ];
      for (const [where, type] of cycle) (where === 'document' ? document : win).dispatchEvent?.({ type });
      assert.deepEqual(screenState(), before);
      assert.deepEqual(seen.filter((entry) => !/ keydown$/.test(entry)), [], 'the manager adds only keydown, never a lifecycle listener');
      releaseDoor();
      assert.equal(strip.hasAttribute('inert'), false);
    } finally {
      delete document.addEventListener;
      if (!hadWindow) delete globalThis.window; else globalThis.window = savedWindow;
    }
  });
});
