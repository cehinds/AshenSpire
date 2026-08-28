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
const sourceLines = (...rows) => {
  const source = readFileSync(new URL('../src/ui/components/flask.js', import.meta.url), 'utf8');
  for (const eol of ['\r\n', '\n']) {
    const candidate = rows.join(eol);
    if (source.includes(candidate)) return candidate;
  }
  return rows.join(source.includes('\r\n') ? '\r\n' : '\n');
};

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
        find: "    if (restoreFocus && anchor.isConnected && typeof anchor.focus === 'function') {",
        replace: "    if (false && restoreFocus && anchor.isConnected && typeof anchor.focus === 'function') { /* planted: focus is dropped */",
        expectRed: /FAIL controller cancel restores focus to the selected flask/,
      },
      {
        name: 'cancel reports itself twice (a double onCancel at the seam)',
        file: 'src/ui/components/flask.js',
        find: "    if (cancelled && onCancel) onCancel();",
        replace: "    if (cancelled && onCancel) { onCancel(); onCancel(); }",
        expectRed: /FAIL controller cancel reports exactly one cancellation/,
      },
      {
        name: 'same-flask re-click closes and immediately reopens',
        file: 'src/ui/components/flask.js',
        find: sourceLines('  if (activeFlaskActionMenu?.anchor === anchor) {',
          '    closeFlaskActionMenu({ cancelled: true, restoreFocus: true });', '    return null;', '  }'),
        replace: "  /* planted: same-flask activation falls through and reopens */",
        expectRed: /FAIL same-flask re-click toggles the menu off/,
      },
      {
        name: 'outside click does not dismiss the contextual menu',
        file: 'src/ui/components/flask.js',
        find: "  document.addEventListener('click', onDocumentClick, true);",
        replace: "  /* planted: no click-away listener */",
        expectRed: /FAIL outside click closes the contextual menu without stealing focus/,
      },
      {
        name: 'document click-away listener leaks across close and remount',
        file: 'src/ui/components/flask.js',
        find: "    document.removeEventListener('click', onDocumentClick, true);",
        replace: "    /* planted: click-away listener leaks */",
        expectRed: /FAIL close and remount retain one document listener and no stale owner/,
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
    this.style = {};
  }
  // ENOUGH DOM FOR THE MENU TO PLACE ITSELF, AND NOT ONE INCH MORE. Since
  // 2026-08-17 mountFlaskActionMenu calls fx.js placeAnchored, which measures
  // both boxes and reads --place-gap off the cascade; without these three stubs
  // the import throws and this tool tests nothing. THE NUMBERS BELOW ARE NOT A
  // PLACEMENT CHECK and must never be read as one — every rect is 0x0 at the
  // origin and the gap resolves to 0, so the arithmetic runs and asserts
  // nothing. Placement is measured on a real boot in tools/placement.mjs P5.
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  set innerHTML(value) { this._html = value; this._detail = new FakeElement('div'); this._detail.hidden = true; }
  get innerHTML() { return this._html || ''; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }
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

class TrackingTarget extends EventTarget {
  constructor() { super(); this.counts = new Map(); }
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    this.counts.set(type, (this.counts.get(type) || 0) + 1);
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, options);
    this.counts.set(type, Math.max(0, (this.counts.get(type) || 0) - 1));
  }
  listenerCount(type) { return this.counts.get(type) || 0; }
}

class FakeKeyboardEvent extends Event {
  constructor(type, init = {}) { super(type, init); this.key = init.key || ''; }
}

const win = new TrackingTarget();
globalThis.window = win;
globalThis.KeyboardEvent = FakeKeyboardEvent;
globalThis.innerWidth = 0;
globalThis.innerHeight = 0;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
const doc = new TrackingTarget();
Object.assign(doc, {
  activeElement: null,
  documentElement: new FakeElement('html'),
  body: new FakeElement('body'),
  createElement: (tag) => new FakeElement(tag),
});
globalThis.document = doc;
const mutationObservers = [];
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; this.connected = false; mutationObservers.push(this); }
  observe() { this.connected = true; }
  disconnect() { this.connected = false; }
};

const { closeFlaskActionMenu, mountFlaskActionMenu } = await import('../src/ui/components/flask.js');
const surface = new FakeElement('main');
const anchor = new FakeElement('button');
anchor.surface = surface;
surface.appendChild(anchor);
let actions = 0;
let cancels = 0;
const opts = {
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
};
const mounted = mountFlaskActionMenu(anchor, opts);

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

const toggled = mountFlaskActionMenu(anchor, opts);
check('same-flask first activation reopens after prior close', toggled?.root.isConnected === true);
const toggleOff = mountFlaskActionMenu(anchor, opts);
check('same-flask re-click toggles the menu off', toggleOff === null && toggled.root.isConnected === false);

const clickAway = mountFlaskActionMenu(anchor, opts);
const outside = new FakeElement('button');
document.activeElement = outside;
doc.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
check('outside click closes the contextual menu without stealing focus',
  clickAway.root.isConnected === false && document.activeElement === outside);

const competing = mountFlaskActionMenu(anchor, opts);
closeFlaskActionMenu({ cancelled: true });
check('competing surface closes the contextual menu through one owner', competing.root.isConnected === false);

const remounted = mountFlaskActionMenu(anchor, opts);
const oneMountedListener = doc.listenerCount('click') === 1 && win.listenerCount('keydown') === 1;
closeFlaskActionMenu({ cancelled: true });
const noLeakedListeners = doc.listenerCount('click') === 0 && win.listenerCount('keydown') === 0;
const remountedAgain = mountFlaskActionMenu(anchor, opts);
const oneRemountedListener = doc.listenerCount('click') === 1 && win.listenerCount('keydown') === 1;
closeFlaskActionMenu({ cancelled: true });
check('close and remount retain one document listener and no stale owner',
  oneMountedListener && noLeakedListeners && oneRemountedListener && remounted.root.isConnected === false
  && remountedAgain.root.isConnected === false);

const teardownMenu = mountFlaskActionMenu(anchor, opts);
anchor.isConnected = false;
for (const observer of mutationObservers.filter((row) => row.connected)) observer.callback();
check('host or seat teardown removes menu state and both global listeners',
  teardownMenu.root.isConnected === false && doc.listenerCount('click') === 0 && win.listenerCount('keydown') === 0);
anchor.isConnected = true;

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
