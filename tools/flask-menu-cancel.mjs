#!/usr/bin/env node
// Runtime parity probe: gamepad Cancel is synthesized as window-targeted
// Escape. It must close the contextual menu, spend nothing, and restore focus.

import { readFileSync } from 'node:fs';

class FakeElement extends EventTarget {
  constructor(tag = 'div') {
    super();
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.isConnected = true;
    this.hidden = false;
    this.parentNode = null;
    this.className = '';
  }
  set innerHTML(value) { this._html = value; this._detail = new FakeElement('div'); this._detail.hidden = true; }
  get innerHTML() { return this._html || ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  querySelector(selector) {
    if (selector === '.flask-action-detail') return this._detail || null;
    return this.children.find((child) => child.className === selector.slice(1)) || null;
  }
  closest(selector) { return selector === '.combat,.mapscreen' ? this.surface || null : null; }
  focus() { document.activeElement = this; this.focused = true; }
  remove() {
    this.isConnected = false;
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
  }
}

class FakeKeyboardEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.key = init.key || ''; }
}

const win = new EventTarget();
globalThis.window = win;
globalThis.KeyboardEvent = FakeKeyboardEvent;
globalThis.document = {
  activeElement: null,
  body: new FakeElement('body'),
  createElement: (tag) => new FakeElement(tag),
};

const { mountFlaskActionMenu } = await import('../src/ui/components/flask.js');
const surface = new FakeElement('main');
const anchor = new FakeElement('button');
anchor.surface = surface;
surface.appendChild(anchor);
let actions = 0;
let cancels = 0;
const mounted = mountFlaskActionMenu(anchor, {
  def: { name: 'Crimson Flask', textTemplate: 'Restore HP.' },
  plan: {
    commitOnSelect: false,
    actions: [
      { id: 'use', label: 'Use', enabled: true, reason: '' },
      { id: 'inspect', label: 'Inspect', enabled: true, reason: '' },
    ],
  },
  onAction: () => { actions += 1; },
  onCancel: () => { cancels += 1; },
});

let pass = 0;
let fail = 0;
function check(name, ok) {
  if (ok) { pass++; console.log(`PASS ${name}`); }
  else { fail++; console.error(`FAIL ${name}`); }
}

check('selection opens a menu without dispatching', mounted.root.isConnected && actions === 0);
win.dispatchEvent(new FakeKeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
check('window-targeted gamepad Escape closes the menu', mounted.root.isConnected === false);
check('controller cancel dispatches no flask action', actions === 0);
check('controller cancel reports exactly one cancellation', cancels === 1);
check('controller cancel restores focus to the selected flask', document.activeElement === anchor && anchor.focused === true);

// Mutation integrity: remove either lifecycle half and the parity seam is not
// acceptable. This judges the exact source construct the runtime drove above.
const source = readFileSync(new URL('../src/ui/components/flask.js', import.meta.url), 'utf8');
const lifecycle = (s) => s.includes("window.addEventListener('keydown', onGlobalCancel)")
  && s.includes("window.removeEventListener('keydown', onGlobalCancel)");
check('global cancel listener has symmetric mounted teardown', lifecycle(source));
check('mutant removing the global listener is caught',
  lifecycle(source.replace("window.addEventListener('keydown', onGlobalCancel);", '')) === false);
check('mutant removing listener teardown is caught',
  lifecycle(source.replace("window.removeEventListener('keydown', onGlobalCancel);", '')) === false);

console.log(`\nflask-menu-cancel: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
