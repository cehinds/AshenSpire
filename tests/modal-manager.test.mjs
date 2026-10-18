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
