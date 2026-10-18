// tests/modal-manager.test.mjs — the one modal stack (src/ui/modalManager.js):
// page depth + inert, Escape for entries that opt in, and the back button.
//
//   node --test tests/modal-manager.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewardDom } from './helpers/reward-dom.mjs';
import { registerModal, resetModalState, openModals } from '../src/ui/modalManager.js';

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
    const release = registerModal('door', modalIn(document));
    assert.equal(screen.hasAttribute('inert'), true);
    assert.equal(hud.hasAttribute('inert'), true);
    release();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('lower modals go inert under a higher one and wake when it pops', () => {
  withPage(({ document }) => {
    const lower = modalIn(document);
    const upper = modalIn(document);
    const releaseLower = registerModal('lower', lower);
    assert.equal(lower.hasAttribute('inert'), false, 'the top modal is never inert');
    const releaseUpper = registerModal('upper', upper);
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
    const release = registerModal('in-screen', inside);
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(hud.hasAttribute('inert'), true);
    release();
    assert.equal(hud.hasAttribute('inert'), false);
  });
});

test('an inert the manager did not set survives the pop', () => {
  withPage(({ document, screen, hud }) => {
    screen.setAttribute('inert', '');
    const release = registerModal('door', modalIn(document));
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

test('a pruned (disconnected) entry clears its inert and depth', () => {
  withPage(({ document, screen }) => {
    const panel = modalIn(document);
    registerModal('ghost', panel);
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
    assert.equal(typeof history.state.ashenModal, 'number');
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
    assert.equal(history.pushes, 2);
    userBack();
    assert.deepEqual(log, ['b:back']);
    assert.deepEqual(openModals().map((m) => m.name), ['a']);
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
    assert.deepEqual(log, [], 'a was not dismissed by the pop that b caused');
    assert.deepEqual(openModals().map((m) => m.name), ['a']);
    assert.equal(history.backCalls, 1);
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
