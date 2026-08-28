#!/usr/bin/env node
// Runtime parity probe: gamepad Cancel is synthesized as window-targeted
// Escape. It must close the contextual menu, spend nothing, and restore focus.

// DOOR. The real input is src/ui/components/flask.js: it is IMPORTED and
// driven through the fake DOM below, and read as bytes for the lifecycle
// clauses. The `mutant removing…` lines at the foot test the predicate on an
// in-memory `.replace()` — the regex, not the road. `--selftest` plants each
// known-bad INTO A COPY of the real file on disk and re-runs this whole tool
// against it. (Vira's doors audit 2026-08-14 listed this tool NO-KNOWN-BAD.)
import { readFileSync } from 'node:fs';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'flask-menu-cancel.mjs',
    plants: [
      {
        name: 'the global cancel listener is never registered (the #22-shaped regression)',
        file: 'src/ui/components/flask.js',
        find: "window.addEventListener('keydown', onGlobalCancel);",
        replace: "/* planted: no global cancel listener */",
        expectRed: /FAIL window-targeted gamepad Escape closes the menu/,
      },
      {
        name: 'the listener is registered and never torn down',
        file: 'src/ui/components/flask.js',
        find: "window.removeEventListener('keydown', onGlobalCancel);",
        replace: "/* planted: no teardown */",
        expectRed: /FAIL global cancel listener has symmetric mounted teardown/,
      },
      {
        name: 'cancel closes the menu but never returns focus to the flask',
        file: 'src/ui/components/flask.js',
        find: "if (anchor.isConnected && typeof anchor.focus === 'function') anchor.focus();",
        replace: "/* planted: focus is dropped on close */",
        expectRed: /FAIL controller cancel restores focus to the selected flask/,
      },
      {
        name: 'cancel reports itself twice (a double onCancel at the seam)',
        file: 'src/ui/components/flask.js',
        find: "    if (cancelled && onCancel) onCancel();",
        replace: "    if (cancelled && onCancel) { onCancel(); onCancel(); }",
        expectRed: /FAIL controller cancel reports exactly one cancellation/,
      },
    ],
  }));
}

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
console.log('DOOR: src/ui/components/flask.js is imported and driven — the plants in `--selftest` enter');
console.log('      as bytes in a copy of that real file (observed red 2026-08-15, re-runnable).');
console.log('BOUNDARY, found by a plant that did NOT go red: this tool drives the WINDOW-level cancel');
console.log('      listener only. The element-level keydown handler (Escape/Backspace/arrows on the');
console.log('      menu root) is never dispatched here, so breaking it leaves this tool green — a real');
console.log('      hole, named rather than papered over with a plant aimed at the half already covered.');
if (fail) process.exit(1);
