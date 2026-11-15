// The Popover API polyfill (Safari before 17, iOS 15 included): docs/qa/IOS15-COMPAT.md row 7.
import test from 'node:test';
import assert from 'node:assert/strict';
import { InstallPopoverPolyfill, IsPopoverOpen, OPEN_ATTRIBUTE, POPOVER_UA_CSS } from '../src/ui/popoverPolyfill.js';

// The smallest DOM the polyfill touches: elements with attributes, containment, ids and events.
function makeWindow({ native = false } = {}) {
  class Node_ extends EventTarget {
    constructor(tag = 'div') { super(); this.tagName = tag; this.attrs = new Map(); this.kids = []; this.parent = null; this.textContent = ''; }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    removeAttribute(k) { this.attrs.delete(k); }
    append(c) { c.parent = this; this.kids.push(c); return c; }
    contains(o) { for (let n = o; n; n = n.parent) if (n === this) return true; return false; }
    closest(sel) { const m = /^\[(\w+)\]$/.exec(sel); for (let n = this; n; n = n.parent) if (n.hasAttribute?.(m[1])) return n; return null; }
    matches(sel) { if (sel === ':popover-open') throw new SyntaxError('unknown pseudo-class'); return false; }
    get id() { return this.getAttribute('id'); }
    insertBefore(c) { this.append(c); }
  }
  class HTMLElement extends Node_ {}
  if (native) HTMLElement.prototype.showPopover = () => {};
  const doc = Object.assign(new EventTarget(), {
    head: new HTMLElement('head'), body: new HTMLElement('body'),
    createElement: (tag) => new HTMLElement(tag),
    getElementById(id) { const walk = (n) => (n.id === id ? n : n.kids.map(walk).find(Boolean) || null); return walk(doc.body); },
  });
  const win = { HTMLElement, Event, document: doc };
  const add = (parent, attrs = {}) => { const e = new HTMLElement(); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.append(e); return e; };
  return { win, doc, add, HTMLElement };
}
const key = (key) => Object.assign(new Event('keydown'), { key });
const press = (target, type) => { const e = new Event(type, { bubbles: true }); Object.defineProperty(e, 'target', { value: target }); return e; };

test('a browser with the real API is left alone', () => {
  const { win, doc } = makeWindow({ native: true });
  assert.equal(InstallPopoverPolyfill(win), false);
  assert.equal(doc.head.kids.length, 0, 'no stylesheet injected');
});

test('show, hide and toggle mark the popover and fire toggle with its states', () => {
  const { win, doc, add } = makeWindow();
  assert.equal(InstallPopoverPolyfill(win), true);
  const menu = add(doc.body, { popover: 'auto', id: 'menu' });
  const events = [];
  menu.addEventListener('toggle', (e) => events.push(`${e.oldState}>${e.newState}`));
  assert.equal(IsPopoverOpen(menu), false);
  menu.showPopover();
  assert.equal(menu.hasAttribute(OPEN_ATTRIBUTE), true);
  assert.equal(IsPopoverOpen(menu), true, 'matches(":popover-open") throws here; the marker answers');
  menu.showPopover();
  assert.deepEqual(events, ['closed>open'], 'showing an open popover does nothing');
  assert.equal(menu.togglePopover(), false);
  assert.equal(menu.togglePopover(true), true);
  menu.hidePopover();
  assert.deepEqual(events, ['closed>open', 'open>closed', 'closed>open', 'open>closed']);
  menu.removeAttribute('popover');
  menu.showPopover();
  assert.equal(IsPopoverOpen(menu), false, 'only an element with the attribute is a popover');
});

test('popovertarget invokers toggle, and a press on the invoker does not light-dismiss', () => {
  const { win, doc, add } = makeWindow();
  InstallPopoverPolyfill(win);
  const menu = add(doc.body, { popover: 'auto', id: 'menu' });
  const button = add(doc.body, { popovertarget: 'menu' });
  doc.dispatchEvent(press(button, 'pointerdown')); doc.dispatchEvent(press(button, 'click'));
  assert.equal(IsPopoverOpen(menu), true);
  doc.dispatchEvent(press(button, 'pointerdown')); doc.dispatchEvent(press(button, 'click'));
  assert.equal(IsPopoverOpen(menu), false, 'the invoker closes the menu it opened');
});

test('light dismiss: a press outside or Escape closes an auto popover; manual stays', () => {
  const { win, doc, add } = makeWindow();
  InstallPopoverPolyfill(win);
  const auto = add(doc.body, { popover: 'auto', id: 'a' });
  const inside = add(auto);
  const manual = add(doc.body, { popover: 'manual', id: 'm' });
  const elsewhere = add(doc.body);
  auto.showPopover(); manual.showPopover();
  doc.dispatchEvent(press(inside, 'pointerdown'));
  assert.equal(IsPopoverOpen(auto), true, 'a press inside stays open');
  doc.dispatchEvent(press(elsewhere, 'pointerdown'));
  assert.equal(IsPopoverOpen(auto), false);
  assert.equal(IsPopoverOpen(manual), true, 'manual never light-dismisses');
  auto.showPopover();
  doc.dispatchEvent(key('Escape'));
  assert.equal(IsPopoverOpen(auto), false);
  doc.dispatchEvent(key('Escape'));
  assert.equal(IsPopoverOpen(manual), true, 'Escape does not close a manual popover');
});

test('opening one auto popover closes the others', () => {
  const { win, doc, add } = makeWindow();
  InstallPopoverPolyfill(win);
  const a = add(doc.body, { popover: 'auto' }), b = add(doc.body, { popover: '' });
  a.showPopover(); b.showPopover();
  assert.equal(IsPopoverOpen(a), false);
  assert.equal(IsPopoverOpen(b), true);
});

test('the injected UA rules hide closed popovers and are zero-specificity', () => {
  const { win, doc } = makeWindow();
  InstallPopoverPolyfill(win);
  assert.equal(doc.head.kids.length, 1);
  assert.equal(doc.head.kids[0].textContent, POPOVER_UA_CSS);
  assert.match(POPOVER_UA_CSS, /:where\(\[popover\]:not\(\[data-popover-open\]\)\)\s*\{\s*display: none/);
});
