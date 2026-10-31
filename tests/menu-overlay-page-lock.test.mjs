// tests/menu-overlay-page-lock.test.mjs — the in-run Menu overlay registers with
// the page lock: Tab stays in the Menu, the page behind is aria-hidden, and the
// lock clears on close.
//
//   node --test tests/menu-overlay-page-lock.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { withModalDom } from './helpers/modal-dom.mjs';
import { registerModal, resetModalState } from '../src/ui/modalManager.js';

test('overlay.js registers the Menu veil with the page lock', () => {
  const src = readFileSync(new URL('../src/ui/components/overlay.js', import.meta.url), 'utf8');
  assert.match(src, /registerModal\('overlay', veil, \{ inert: true \}\)/);
});

test('a Menu-style registration locks the map, wraps Tab, and releases with focus back on the opener', () => {
  withModalDom((dom, win) => {
    const { document } = dom;
    globalThis.getComputedStyle = () => ({ visibility: 'visible' });
    document.documentElement = document.createElement('html');
    const app = document.createElement('main');
    app.id = 'app';
    document.body.appendChild(app);
    const map = document.createElement('div');
    const opener = document.createElement('button');
    map.appendChild(opener);
    app.appendChild(map);
    const veil = document.createElement('div');
    const tabs = ['t1', 't2'].map((id) => { const b = document.createElement('button'); b.id = id; veil.appendChild(b); return b; });
    document.body.appendChild(veil);
    resetModalState();
    try {
      opener.focus();
      const release = registerModal('overlay', veil, { inert: true });
      assert.equal(map.getAttribute('aria-hidden'), 'true');
      assert.equal(map.hasAttribute('data-page-locked'), true);
      tabs[1].focus();
      win.press('Tab', { cancelable: true });
      assert.equal(document.activeElement, tabs[0]);
      opener.focus();
      assert.notEqual(document.activeElement, opener, 'while the lock is held, focus on the page behind is bounced into the Menu');
      assert.equal(veil.contains(document.activeElement), true);
      release();
      assert.equal(map.hasAttribute('aria-hidden'), false);
      assert.equal(map.hasAttribute('data-page-locked'), false);
      opener.focus();
      assert.equal(document.activeElement, opener, 'once released, focus on the opener is no longer bounced');
    } finally { resetModalState(); }
  });
});
