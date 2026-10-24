import test from 'node:test';
import assert from 'node:assert/strict';
import { withModalDom } from './helpers/modal-dom.mjs';
import { resetModalState } from '../src/ui/modalState.js';
import { openCombatLogModal } from '../src/ui/components/combatLogModal.js';
import { consoleRecorder } from '../src/ui/consoleLog.js';
import { DEBUG_CHROME_READY } from '../src/ui/components/debugChrome.js';

// The DOM helper is synchronous: keep it installed until async callbacks finish.
async function withViewer(fn) {
  let done, reject;
  const result = new Promise((resolve, fail) => { done = resolve; reject = fail; });
  const saved = {};
  withModalDom((dom, win) => {
    for (const key of Object.keys(win)) saved[key] = globalThis[key];
    queueMicrotask(async () => {
      Object.assign(globalThis, saved);
      try { resetModalState(); await fn(dom, win); done(); } catch (error) { reject(error); }
    });
  });
  const old = Object.fromEntries(Object.keys(saved).map(key => [key, globalThis[key]]));
  try { await result; } finally {
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}

test('Console retains earlier errors, updates live, and Escape restores focus to the full log', async () => {
  assert.equal(DEBUG_CHROME_READY, true);
  await withViewer(async (dom, win) => {
    const opener = dom.document.createElement('button'); dom.document.body.append(opener);
    consoleRecorder.append('error', new Error('earlier failure'));
    const log = openCombatLogModal({ opener });
    const shortcut = log.panel.querySelector('[data-console-shortcut]');
    assert.equal(shortcut.hidden, true);
    log.setConsoleEnabled(true); assert.equal(shortcut.hidden, false);
    shortcut.click();
    const viewer = dom.document.body.querySelector('.console-modal');
    const text = viewer.querySelector('textarea');
    assert.match(text.value, /earlier failure/);
    assert.equal(viewer.parentNode.hasAttribute('data-combat-read-only'), true);
    consoleRecorder.append('warn', 'live marker'); await Promise.resolve();
    assert.match(text.value, /live marker/);
    win.press('Escape');
    assert.equal(viewer.isConnected, false); assert.equal(log.panel.isConnected, true);
    assert.equal(dom.document.activeElement, shortcut);
    const before = text.value; consoleRecorder.append('log', 'after close'); await Promise.resolve();
    assert.equal(text.value, before, 'closed viewers unsubscribe');
    log.setConsoleEnabled(false); assert.equal(shortcut.hidden, true);
    log.close();
  });
});

test('clipboard rejection selects touch-copyable text and parent teardown closes Console', async () => {
  await withViewer(async dom => {
    const proto = Object.getPrototypeOf(dom.document.body), oldSelect = proto.select;
    let selected = false; proto.select = function () { selected = true; };
    try {
      const log = openCombatLogModal({ showConsole: true }); log.panel.querySelector('[data-console-shortcut]').click();
      const viewer = dom.document.body.querySelector('.console-modal');
      viewer.querySelector('#console-export').click(); await Promise.resolve(); await Promise.resolve();
      assert.match(viewer.querySelector('[role="status"]').textContent, /Export unavailable.*Use Copy/);
      viewer.querySelector('#console-copy').click(); await Promise.resolve(); await Promise.resolve();
      assert.equal(selected, true);
      assert.match(viewer.querySelector('[role="status"]').textContent, /Touch and hold to copy/);
      const text = viewer.querySelector('textarea'), before = text.value;
      consoleRecorder.append('log', 'selection must survive'); await Promise.resolve();
      assert.equal(text.value, before);
      log.close(); assert.equal(viewer.isConnected, false);
    } finally { if (oldSelect) proto.select = oldSelect; else delete proto.select; }
  });
});
