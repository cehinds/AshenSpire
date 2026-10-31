// tests/modal-lift-deferral.test.mjs — a door opened with `deferLift` (the combat
// hand's card inspection) mounts in one frame and locks the page a later one;
// on close the veil leaves first and the inert lift, the focus restore and the
// registry release follow in a later frame. Pixels are identical (inert has no
// rendering); what this holds is that focus still ends on the opener, the page
// still ends unlocked, and nothing locks or lifts in the frame that mounts or
// removes the veil.
//
//   node --test tests/modal-lift-deferral.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rewardDom } from './helpers/reward-dom.mjs';
import { resetModalState, modalOpen } from '../src/ui/modalManager.js';
import { openModal } from '../src/ui/components/modalShell.js';

function page(fn) {
  const dom = rewardDom();
  const { document } = dom;
  const proto = Object.getPrototypeOf(document.body);
  proto.contains = function contains(node) { for (let at = node; at; at = at.parentNode) if (at === this) return true; return false; };
  document.documentElement = document.createElement('html');
  document.addEventListener = () => {}; document.removeEventListener = () => {};
  const app = document.createElement('main');
  app.id = 'app';
  document.body.appendChild(app);
  document.getElementById = (id) => (id === 'app' ? app : null);
  const screen = document.createElement('div');
  const opener = document.createElement('button');
  Object.getPrototypeOf(opener).focus = function focus() { document.activeElement = this; };
  document.activeElement = opener;
  screen.appendChild(opener);
  app.appendChild(screen);
  const saved = { document: globalThis.document, raf: globalThis.requestAnimationFrame };
  let queue = [];
  globalThis.document = document;
  globalThis.requestAnimationFrame = (fn) => { queue.push(fn); return queue.length; };
  const frame = () => { const run = queue; queue = []; run.forEach((fn) => fn(0)); };
  resetModalState();
  try { return fn({ document, screen, opener, frame }); } finally {
    resetModalState();
    globalThis.document = saved.document;
    if (saved.raf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = saved.raf;
  }
}

const open = (document, opener, extra) => openModal({ title: 'Door', opener, deferFocus: true, host: document.body, primary: null, ...extra });

test('deferLift: the page locks a frame after the mount, focus lands first', () => {
  page(({ document, screen, opener, frame }) => {
    const shell = open(document, opener, { deferLift: true });
    assert.equal(screen.hasAttribute('inert'), false, 'the mounting frame restyles nothing behind the door');
    frame(); // focus frame
    assert.equal(screen.hasAttribute('inert'), false);
    frame(); // lock frame
    assert.equal(screen.hasAttribute('inert'), true);
    shell.close();
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), false);
  });
});

test('deferLift: close removes the veil now; lift, focus restore and release come later', () => {
  page(({ document, screen, opener, frame }) => {
    const shell = open(document, opener, { deferLift: true });
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), true);
    shell.close();
    assert.equal(shell.veil.isConnected, false, 'the veil goes in the closing frame');
    assert.equal(screen.hasAttribute('inert'), true, 'inert does not lift in the same frame');
    frame();
    frame();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(document.activeElement, opener, 'focus returns to the opener');
    assert.equal(modalOpen(), false);
    shell.close(); // idempotent
  });
});

test('without deferLift the door locks and releases synchronously, as before', () => {
  page(({ document, screen, opener }) => {
    const shell = open(document, opener, {});
    assert.equal(screen.hasAttribute('inert'), true);
    shell.close();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(document.activeElement, opener);
    assert.equal(modalOpen(), false);
  });
});

test('deferLift without deferFocus still locks the page, a few frames after the mount', () => {
  page(({ document, screen, opener, frame }) => {
    const shell = openModal({ title: 'Door', opener, host: document.body, primary: null, deferLift: true });
    assert.equal(screen.hasAttribute('inert'), false, 'the mounting frame restyles nothing behind the door');
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), true, 'the entry is armed although the door never deferred focus');
    shell.close();
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), false);
    assert.equal(modalOpen(), false);
  });
});

test('deferLift: close({ liftNow }) leaves the page live and focus on the opener before a follow-up action', () => {
  page(({ document, screen, opener, frame }) => {
    const shell = open(document, opener, { deferLift: true });
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), true);
    let seen = null;
    shell.close({ liftNow: true });
    seen = { inert: screen.hasAttribute('inert'), focus: document.activeElement }; // what the command finds
    assert.equal(seen.inert, false, 'the screen is not inert when the action runs');
    assert.equal(seen.focus, opener);
    assert.equal(shell.veil.isConnected, false);
    assert.equal(modalOpen(), false);
    frame(); frame();
    assert.equal(screen.hasAttribute('inert'), false);
  });
});
