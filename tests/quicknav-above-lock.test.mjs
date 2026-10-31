// tests/quicknav-above-lock.test.mjs — the quick-nav list opened from the in-run
// Menu (which holds the page lock) is a kept surface, not background: focus and
// Tab stay in its rows, Escape closes only the list, and the stack returns to
// the Menu alone when it closes.
//
//   node --test tests/quicknav-above-lock.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withModalDom } from './helpers/modal-dom.mjs';
import { registerModal, resetModalState, openModals, modalOpen, pageLockHeld } from '../src/ui/modalManager.js';
import { openQuickNav, closeQuickNav, quickNavIsOpen } from '../src/ui/components/quicknav.js';

// The list's focusFirst runs on a timer; a timer firing after the fixture is gone throws.
const realSetTimeout = globalThis.setTimeout;
const realMicrotask = globalThis.queueMicrotask;

function setup(document) {
  globalThis.setTimeout = () => 0;
  globalThis.queueMicrotask = () => {}; // closeQuickNav's focus restore reads `document` a tick later
  globalThis.getComputedStyle = () => ({ visibility: 'visible', getPropertyValue: () => '' });
  document.documentElement = document.createElement('html');
  const app = document.createElement('main');
  app.id = 'app';
  document.body.appendChild(app);
  const veil = document.createElement('div');
  const goTo = document.createElement('button');
  const tab = document.createElement('button');
  veil.append(goTo, tab);
  document.body.appendChild(veil);
  resetModalState();
  return { veil, goTo };
}

const noop = () => {};
const actions = { tab: noop, console: noop, inventory: noop, character: noop };

test('the list above the Menu lock stays live: not locked, focus and Tab stay in its rows', () => {
  withModalDom((dom, win) => {
    const { document } = dom;
    const { veil, goTo } = setup(document);
    try {
      const release = registerModal('overlay', veil, { inert: true });
      assert.equal(pageLockHeld(), true);
      const panel = openQuickNav(goTo, 'overlay', { actions, current: null });
      assert.ok(panel, 'the list opened');
      const qnVeil = panel.closest ? document.body.querySelector('.qn-veil') : null;
      assert.ok(qnVeil, 'list veil is in the page');
      assert.equal(openModals().at(-1).name, 'quicknav');
      assert.equal(qnVeil.hasAttribute('aria-hidden'), false);
      assert.equal(qnVeil.hasAttribute('data-page-locked'), false);
      const rows = [...qnVeil.querySelectorAll('.qn-row')];
      assert.ok(rows.length >= 2, 'at least two rows');
      rows[1].focus();
      assert.equal(document.activeElement, rows[1], 'focusin on a row is not bounced into the Menu');
      rows.at(-1).focus();
      win.press('Tab', { cancelable: true });
      assert.equal(document.activeElement, rows[0], 'Tab off the last row wraps to the first row');
      closeQuickNav({ restoreFocus: false });
      assert.deepEqual(openModals().map((e) => e.name), ['overlay'], 'the Menu is the top kept element again');
      release();
    } finally { closeQuickNav({ restoreFocus: false }); resetModalState(); globalThis.setTimeout = realSetTimeout; globalThis.queueMicrotask = realMicrotask; }
  });
});

test('Escape with the list above the Menu closes the list and leaves the Menu registered', () => {
  withModalDom((dom, win) => {
    const { document } = dom;
    const { veil, goTo } = setup(document);
    let dismissed = 0;
    try {
      registerModal('overlay', veil, { inert: true, dismiss: () => { dismissed++; } });
      openQuickNav(goTo, 'overlay', { actions });
      assert.equal(quickNavIsOpen(), true);
      win.press('Escape', { cancelable: true });
      assert.equal(quickNavIsOpen(), false);
      assert.equal(dismissed, 0, 'the Menu was not dismissed');
      assert.deepEqual(openModals().map((e) => e.name), ['overlay']);
    } finally { closeQuickNav({ restoreFocus: false }); resetModalState(); globalThis.setTimeout = realSetTimeout; globalThis.queueMicrotask = realMicrotask; }
  });
});

test('with no page lock (map or combat) the list does not register, so modalOpen() is unchanged', () => {
  withModalDom((dom) => {
    const { document } = dom;
    const { goTo } = setup(document);
    try {
      assert.equal(modalOpen(), false);
      openQuickNav(goTo, 'map', { actions });
      assert.equal(quickNavIsOpen(), true);
      assert.equal(modalOpen(), false);
      closeQuickNav({ restoreFocus: false });
      assert.equal(modalOpen(), false);
    } finally { closeQuickNav({ restoreFocus: false }); resetModalState(); globalThis.setTimeout = realSetTimeout; globalThis.queueMicrotask = realMicrotask; }
  });
});
