import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of [...(this.listeners.get(event.type) || [])]) {
      listener(event);
      if (event.immediatePropagationStopped) break;
    }
    return !event.defaultPrevented;
  }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.isConnected = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    child.setConnected(this.isConnected);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  setConnected(connected) {
    this.isConnected = connected;
    this.children.forEach((child) => child.setConnected(connected));
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }
    this.setConnected(false);
    if (this.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body', this);
    this.body.setConnected(true);
    this.activeElement = this.body;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function fakeEvent(type, properties = {}) {
  return {
    type,
    target: null,
    defaultPrevented: false,
    immediatePropagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.immediatePropagationStopped = true; },
    ...properties,
  };
}

export async function runConfirmationModalContract() {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const mainSource = readFileSync(resolve(root, 'src/main.js'), 'utf8');
  const overlaySource = readFileSync(resolve(root, 'src/ui/components/overlay.js'), 'utf8');
  const sourceFiles = [
    mainSource,
    readFileSync(resolve(root, 'src/ui/components/confirmationModal.js'), 'utf8'),
  ];

  check(!sourceFiles.some((source) => /\b(?:window\.)?confirm\s*\(/.test(source)),
    'a native confirm call remains in the quit/load implementation');
  check((mainSource.match(/\bopenConfirmationModal\s*\(/g) || []).length === 2,
    'load and quit do not both use the shared confirmation surface');
  check(overlaySource.includes('if (topVeil() !== openVeil) return;'),
    'the underlying overlay can consume Escape before the confirmation');

  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    HTMLElement: globalThis.HTMLElement,
  };
  const document = new FakeDocument();
  const window = new FakeEventTarget();
  globalThis.document = document;
  globalThis.window = window;
  globalThis.HTMLElement = FakeElement;

  try {
    const { openConfirmationModal, closeConfirmationModal } = await import('../src/ui/components/confirmationModal.js');
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    let confirmed = 0;
    let cancelled = 0;
    const first = openConfirmationModal({
      title: 'Quit without saving?',
      message: '<p>Unsaved changes will be lost.</p>',
      confirmLabel: 'Quit without saving',
      consequence: 'LEAVES THE RUN',
      tone: 'danger',
      returnFocusElement: trigger,
      onConfirm: () => { confirmed += 1; },
      onCancel: () => { cancelled += 1; },
    });
    // Mirrors openQuickNav's awaited close, which restores its launcher in a
    // microtask. The confirmation must take focus after that close completes.
    queueMicrotask(() => trigger.focus());
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));

    check(first.dialog.getAttribute('role') === 'alertdialog', 'destructive confirmation is not an alertdialog');
    check(first.dialog.getAttribute('aria-modal') === 'true', 'confirmation is not exposed as modal');
    check(first.dialog.dataset.uiComponent === 'confirmation-modal', 'confirmation component id is absent');
    check(first.confirmButton.dataset.uiComponent === 'confirmation-action', 'confirmation action id is absent');
    check(first.cancelButton.textContent === 'Back' && first.confirmButton.textContent === 'Quit without saving',
      'safe and destructive actions are not labeled explicitly');
    check(document.activeElement === first.cancelButton, 'safe Back action does not receive initial focus');

    const reverseTab = fakeEvent('keydown', { key: 'Tab', shiftKey: true });
    window.dispatchEvent(reverseTab);
    check(reverseTab.defaultPrevented && document.activeElement === first.confirmButton,
      'reverse Tab escapes instead of wrapping inside the dialog');
    const forwardTab = fakeEvent('keydown', { key: 'Tab', shiftKey: false });
    window.dispatchEvent(forwardTab);
    check(forwardTab.defaultPrevented && document.activeElement === first.cancelButton,
      'forward Tab escapes instead of wrapping inside the dialog');

    const escape = fakeEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escape);
    check(escape.defaultPrevented && escape.immediatePropagationStopped,
      'Escape is not consumed by the top confirmation');
    check(cancelled === 1 && confirmed === 0, 'Escape committed the destructive action or missed cancellation');
    check(!first.veil.isConnected && document.activeElement === trigger,
      'cancellation did not remove the dialog and restore its trigger');

    const second = openConfirmationModal({
      title: 'Load slot 1?',
      message: '<p>Replace unsaved progress.</p>',
      confirmLabel: 'Load saved run',
      tone: 'danger',
      returnFocusElement: trigger,
      onConfirm: () => { confirmed += 1; },
      onCancel: () => { cancelled += 1; },
    });
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    second.confirmButton.dispatchEvent(fakeEvent('click'));
    second.confirmButton.dispatchEvent(fakeEvent('click'));
    check(confirmed === 1 && cancelled === 1, 'primary action did not commit exactly once');
    check(!second.veil.isConnected, 'confirmed dialog remains mounted');

    const third = openConfirmationModal({
      title: 'Cancel from scrim',
      message: '<p>Nothing commits.</p>',
      returnFocusElement: trigger,
      onConfirm: () => { confirmed += 1; },
      onCancel: () => { cancelled += 1; },
    });
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));
    third.veil.dispatchEvent(fakeEvent('click', { target: third.veil }));
    check(cancelled === 2 && confirmed === 1, 'backdrop cancellation committed or failed to cancel');
    closeConfirmationModal();
  } catch (error) {
    failures.push(error.stack || error.message || String(error));
  } finally {
    if (saved.document === undefined) delete globalThis.document;
    else globalThis.document = saved.document;
    if (saved.window === undefined) delete globalThis.window;
    else globalThis.window = saved.window;
    if (saved.HTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = saved.HTMLElement;
  }

  return {
    ok: failures.length === 0,
    detail: failures.length ? failures.join('; ') : 'load + quit share one themed dialog; cancel, focus trap, focus return, and single commit pass',
  };
}
