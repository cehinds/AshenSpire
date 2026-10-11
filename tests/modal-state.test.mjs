// tests/modal-state.test.mjs — explicit JS modal state (src/ui/modalState.js).
//
// "Is a modal open?" is answered by the registry, not by a DOM query. The four
// shared shells register themselves; this file pins the registry's rules, that
// each shell actually registers, and that a confirmation's open and close move
// the answer both ways.
//
//   node --test tests/modal-state.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withModalDom } from './helpers/modal-dom.mjs';
import {
  registerModal,
  modalOpen,
  topModal,
  openModals,
  onModalsClosed,
  resetModalState,
} from '../src/ui/modalState.js';
import { whenNoOverlay } from '../src/ui/whenNoOverlay.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

test('registerModal pushes an entry and release removes exactly that entry', () => {
  resetModalState();
  assert.equal(modalOpen(), false);
  assert.equal(topModal(), null);
  const a = {};
  const b = {};
  const releaseA = registerModal('a', a);
  assert.equal(modalOpen(), true);
  const releaseB = registerModal('b', b);
  assert.deepEqual(openModals().map((m) => m.name), ['a', 'b']);
  assert.equal(openModals()[0].element, a);
  releaseA();
  assert.deepEqual(openModals().map((m) => m.name), ['b'], 'releasing a left b standing');
  releaseB();
  assert.equal(modalOpen(), false);
  assert.deepEqual(openModals(), []);
});

test('release is idempotent and cannot remove a later entry', () => {
  resetModalState();
  const releaseFirst = registerModal('first', {});
  const releaseSecond = registerModal('second', {});
  releaseFirst();
  releaseFirst();
  assert.deepEqual(openModals().map((m) => m.name), ['second'], 'a second release removed nothing else');
  releaseSecond();
  assert.equal(modalOpen(), false);
});

test('topModal is the last registered modal still open', () => {
  resetModalState();
  const releaseBase = registerModal('base', {});
  const releaseTop = registerModal('top', {});
  assert.equal(topModal().name, 'top');
  releaseTop();
  assert.equal(topModal().name, 'base');
  releaseBase();
  assert.equal(topModal(), null);
});

test('openModals returns a copy that cannot change the stack', () => {
  resetModalState();
  const release = registerModal('only', {});
  openModals().pop();
  assert.equal(modalOpen(), true);
  release();
});

test('onModalsClosed runs once, when the stack becomes empty', () => {
  resetModalState();
  const releaseA = registerModal('a', {});
  const releaseB = registerModal('b', {});
  let calls = 0;
  onModalsClosed(() => { calls += 1; });
  releaseA();
  assert.equal(calls, 0, 'one modal still open: not yet');
  releaseB();
  assert.equal(calls, 1, 'the last close runs it');
  const releaseC = registerModal('c', {});
  releaseC();
  assert.equal(calls, 1, 'a later close does not run it again');
});

test('onModalsClosed runs immediately when nothing is open', () => {
  resetModalState();
  let calls = 0;
  onModalsClosed(() => { calls += 1; });
  assert.equal(calls, 1);
});

test('onModalsClosed can be cancelled before it fires', () => {
  resetModalState();
  const release = registerModal('a', {});
  let calls = 0;
  const cancel = onModalsClosed(() => { calls += 1; });
  cancel();
  release();
  assert.equal(calls, 0);
});

test('resetModalState clears the stack and pending waiters', () => {
  resetModalState();
  registerModal('left-open', {});
  let calls = 0;
  onModalsClosed(() => { calls += 1; });
  resetModalState();
  assert.equal(modalOpen(), false);
  assert.equal(calls, 0, 'reset does not fire waiters; it forgets them');
});

test('whenNoOverlay waits for a registered modal even when the DOM shows nothing', () => {
  resetModalState();
  const doc = { body: {}, querySelector: () => null };
  let observer = null;
  class Observer { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.off = true; } }
  const release = registerModal('confirmation', {});
  let ran = 0;
  whenNoOverlay(() => { ran += 1; }, { doc, Observer });
  assert.equal(ran, 0, 'a registered modal is open: not yet');
  release();
  assert.equal(ran, 1, 'the last registered modal closed: run');
  observer.fn();
  assert.equal(ran, 1, 'and only once');
});

test('the four shared shells register with the modal state and release it', () => {
  const shells = [
    ['src/ui/components/modalShell.js', /registerModal\(\s*name \|\| title \|\| 'modal'/],
    ['src/ui/components/confirmationModal.js', /registerModal\(\s*'confirmation'/],
    ['src/ui/components/saveSlotSelector.js', /registerModal\(\s*'save-slots'/],
    ['src/ui/components/overlay.js', /registerModal\(\s*'overlay'/],
  ];
  for (const [path, call] of shells) {
    const source = read(path);
    assert.match(source, /import \{[^}]*\bregisterModal\b[^}]*\} from '[^']*modalState\.js';/, `${path} does not import registerModal`);
    assert.match(source, call, `${path} does not call registerModal with its name`);
    assert.match(source, /unregister\w*\?*\.?\(\)/, `${path} never calls its release`);
  }
});

test('a confirmation is a modal from open until confirm or cancel', async () => {
  const { openConfirmationModal } = await import('../src/ui/components/confirmationModal.js');
  resetModalState();
  const hadHTMLElement = Object.prototype.hasOwnProperty.call(globalThis, 'HTMLElement');
  const savedHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class {};
  // A confirmation's input shield releases on a timer that reads `window`. The
  // fixture removes its `window` when withModalDom returns, so a stand-in stays
  // in place until that timer has run, or the release throws after the test.
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const savedWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
  try {
    withModalDom(() => {
      let confirmed = 0;
      let cancelled = 0;

      const confirm = openConfirmationModal({
        title: 'Load slot 1?',
        message: 'Replace unsaved progress.',
        confirmLabel: 'Load saved run',
        returnFocusElement: null,
        inputShieldMs: 0,
        onConfirm: () => { confirmed += 1; },
        onCancel: () => { cancelled += 1; },
      });
      assert.equal(modalOpen(), true, 'confirmation open: modal state says open');
      assert.equal(topModal().name, 'confirmation');
      confirm.confirmButton.click();
      assert.equal(confirmed, 1, 'confirm committed');
      assert.equal(modalOpen(), false, 'after confirm: modal state says closed');

      const cancel = openConfirmationModal({
        title: 'Quit without saving?',
        message: 'Unsaved changes will be lost.',
        confirmLabel: 'Quit without saving',
        returnFocusElement: null,
        onConfirm: () => { confirmed += 1; },
        onCancel: () => { cancelled += 1; },
      });
      assert.equal(modalOpen(), true, 'second confirmation open');
      cancel.cancelButton.click();
      assert.equal(cancelled, 1, 'cancel reported');
      assert.equal(modalOpen(), false, 'after cancel: modal state says closed');
      assert.equal(confirmed, 1, 'cancel did not commit');
    });
    await new Promise((settle) => setTimeout(settle, 5));
  } finally {
    if (hadHTMLElement) globalThis.HTMLElement = savedHTMLElement;
    else delete globalThis.HTMLElement;
    if (hadWindow) globalThis.window = savedWindow;
    else delete globalThis.window;
  }
});

test('a modal whose element left the page without release() is not open', async () => {
  const { registerModal, modalOpen, openModals, onModalsClosed, resetModalState } = await import('../src/ui/modalState.js');
  resetModalState();
  const element = { isConnected: true };
  registerModal('wiped-by-remount', element);
  let fired = 0;
  onModalsClosed(() => { fired++; });
  assert.equal(modalOpen(), true);
  element.isConnected = false;
  assert.equal(modalOpen(), false, 'a detached element no longer counts as an open modal');
  assert.deepEqual(openModals(), []);
  assert.equal(fired, 1, 'waiters run once the stale entry is dropped');
  registerModal('no element', null);
  assert.equal(modalOpen(), true, 'an entry without an element is kept until released');
  resetModalState();
});
