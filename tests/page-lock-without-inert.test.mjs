// tests/page-lock-without-inert.test.mjs — the page lock (src/ui/modalManager.js)
// hides the page with aria-hidden + data-page-locked, never `inert`, and keeps
// keyboard focus in the top dialog itself: Tab wraps, stray focus is bounced.
//
//   node --test tests/page-lock-without-inert.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withModalDom } from './helpers/modal-dom.mjs';
import { registerModal, resetModalState } from '../src/ui/modalManager.js';

function scene(fn) {
  return withModalDom((dom, win) => {
    const { document } = dom;
    globalThis.getComputedStyle = () => ({ visibility: 'visible' });
    document.documentElement = document.createElement('html');
    const app = document.createElement('main');
    app.id = 'app';
    document.body.appendChild(app);
    const screen = document.createElement('div');
    const back = document.createElement('button');
    screen.appendChild(back);
    app.appendChild(screen);
    const dialog = (...names) => {
      const panel = document.createElement('section');
      const buttons = names.map((name) => { const b = document.createElement('button'); b.id = name; panel.appendChild(b); return b; });
      document.body.appendChild(panel);
      return { panel, buttons };
    };
    resetModalState();
    try { return fn({ dom, win, document, screen, back, dialog }); } finally { resetModalState(); }
  });
}

test('a locked background carries aria-hidden and data-page-locked, never inert; both clear on release', () => {
  scene(({ screen, dialog }) => {
    const { panel } = dialog('a');
    const release = registerModal('door', panel, { dismiss() {} });
    assert.equal(screen.getAttribute('aria-hidden'), 'true');
    assert.equal(screen.hasAttribute('data-page-locked'), true);
    assert.equal(screen.hasAttribute('inert'), false);
    release();
    assert.equal(screen.hasAttribute('aria-hidden'), false);
    assert.equal(screen.hasAttribute('data-page-locked'), false);
  });
});

test('Tab from the last control of a bespoke modal wraps to its first, not into the page', () => {
  scene(({ win, document, back, dialog }) => {
    const { panel, buttons } = dialog('one', 'two');
    registerModal('bespoke', panel, { inert: true });
    buttons[1].focus();
    const tab = win.press('Tab', { cancelable: true });
    assert.equal(tab.defaultPrevented, true);
    assert.equal(document.activeElement, buttons[0]);
    const back2 = win.press('Tab', { shiftKey: true, cancelable: true });
    assert.equal(back2.defaultPrevented, true);
    assert.equal(document.activeElement, buttons[1]);
    assert.notEqual(document.activeElement, back);
  });
});

test('focus() on a background control while locked bounces back into the dialog', () => {
  scene(({ document, back, dialog }) => {
    const { panel, buttons } = dialog('one', 'two');
    registerModal('bespoke', panel, { inert: true });
    buttons[1].focus();
    back.focus();
    assert.equal(document.activeElement, buttons[1], 'back to where focus last was inside the dialog');
  });
});

test('an entry with inert:false locks nothing and contains nothing', () => {
  scene(({ document, screen, back, dialog }) => {
    const { panel, buttons } = dialog('one');
    registerModal('quiet', panel, { inert: false });
    assert.equal(screen.hasAttribute('data-page-locked'), false);
    assert.equal(screen.hasAttribute('aria-hidden'), false);
    buttons[0].focus();
    back.focus();
    assert.equal(document.activeElement, back);
  });
});

test('a lower dialog under a confirmation stays locked and the confirmation is reachable', () => {
  scene(({ document, screen, dialog }) => {
    const lower = dialog('settings');
    const upper = dialog('yes', 'no');
    registerModal('settings', lower.panel, { dismiss() {} });
    registerModal('confirm', upper.panel);
    assert.equal(screen.hasAttribute('data-page-locked'), true, 'the page stays locked under both');
    assert.equal(lower.panel.hasAttribute('data-page-locked'), false, 'a lower lock holder is kept live');
    upper.buttons[0].focus();
    assert.equal(document.activeElement, upper.buttons[0]);
    upper.buttons[1].focus();
    assert.equal(document.activeElement, upper.buttons[1]);
  });
});

test('focus taken before the lock arms is remembered: a background focus() bounces to it, not the first control', () => {
  scene(({ document, back, dialog }) => {
    const { panel, buttons } = dialog('one', 'two');
    const release = registerModal('door', panel, { dismiss() {}, deferInert: true });
    buttons[1].focus(); // like deferFocus: focus the primary, then arm a frame later
    release.arm();
    back.focus();
    assert.equal(document.activeElement, buttons[1], 'the primary, not controls[0]');
  });
});

test('after a confirmation closes, a bounce returns to the lower dialog\'s last-focused control', () => {
  scene(({ document, back, dialog }) => {
    const lower = dialog('a', 'b', 'c');
    const upper = dialog('yes', 'no');
    const releaseLower = registerModal('settings', lower.panel, { dismiss() {} });
    lower.buttons[1].focus();
    const releaseUpper = registerModal('confirm', upper.panel);
    upper.buttons[1].focus();
    releaseUpper();
    back.focus();
    assert.equal(document.activeElement, lower.buttons[1]);
    releaseLower();
  });
});
