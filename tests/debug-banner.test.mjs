// tests/debug-banner.test.mjs — what raises the red block, and what must not.
//
// A player met this on the character-creation screen: "SOMETHING JUST STOPPED
// WORKING / ResizeObserver loop completed with undelivered notifications. at
// :0". Nothing had stopped working. That message is the browser reporting it
// ran out of frame budget delivering resize callbacks and would deliver the
// rest on the next frame — no throw, no throw site (hence `at :0`), and the
// screen behind the banner was fine.
//
// The banner is the game's one claim that a control died, so the cost of a
// false one is the whole instrument: a player who sees a red block over a
// working screen learns to ignore red blocks. This file holds both edges —
// the notification is filtered, and a real error still lands.
//
//   node --test tests/debug-banner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// A DOM small enough to be honest about what the banner path touches: an
// element that can carry classes, text and children, and a body that can be
// prepended to. Installed BEFORE the import, because debuglog.js registers its
// window listeners at module scope.
class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.className = ''; this.isConnected = false; this.attrs = {}; }
  setAttribute(name, value) { this.attrs[name] = value; }
  appendChild(child) { this.children.push(child); child.isConnected = this.isConnected; return child; }
  insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); return child; }
  addEventListener() {}
  get text() { return [this.textContent, ...this.children.map((c) => c.text)].join(' ').trim(); }
}

const listeners = new Map();
const body = new Node('body');
body.isConnected = true;
body.prepend = (node) => { body.children.unshift(node); node.isConnected = true; markConnected(node); };
const markConnected = (node) => { for (const child of node.children) { child.isConnected = true; markConnected(child); } };

globalThis.document = { body, createElement: (tag) => new Node(tag) };
globalThis.window = {
  addEventListener: (type, fn) => { listeners.set(type, [...(listeners.get(type) || []), fn]); },
};

const { isBenignPageNotice, getEntries } = await import('../src/ui/debuglog.js');

const fire = (message, extra = {}) => {
  for (const fn of listeners.get('error') || []) fn({ message, ...extra });
};
const banners = () => body.children.filter((n) => /STOPPED WORKING/.test(n.text));

test('the classifier names the browser notification and nothing else', () => {
  for (const benign of [
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop completed with undelivered notifications',
    'Uncaught ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
    '  ResizeObserver loop limit exceeded  ',
  ]) assert.equal(isBenignPageNotice(benign), true, benign);

  // A GENUINE FAILURE THAT MERELY NAMES ResizeObserver IS STILL A FAILURE.
  // This is why the match is anchored rather than a substring search.
  for (const real of [
    "Failed to construct 'ResizeObserver': 1 argument required",
    "Cannot read properties of undefined (reading 'contentRect')",
    'ResizeObserver loop completed with undelivered notifications, and then the map died',
    '', null, undefined,
  ]) assert.equal(isBenignPageNotice(real), false, String(real));
});

test('the notification is logged and raises no banner', () => {
  const before = getEntries().length;
  fire('ResizeObserver loop completed with undelivered notifications.');
  assert.deepEqual(banners(), [], 'no red block over a working screen');
  const entry = getEntries().at(-1);
  assert.equal(getEntries().length, before + 1, 'it is still in the Command log');
  assert.equal(entry.kind, 'NOTICE', 'recorded as a notice, not an error');
  assert.match(entry.msg, /ResizeObserver loop completed/);
});

test('a real uncaught error still raises the banner', () => {
  fire("Cannot read properties of null (reading 'focus')", { filename: 'http://x/src/ui/screens/map.js', lineno: 12 });
  const raised = banners();
  assert.equal(raised.length, 1, 'the one claim that a control died is still made');
  assert.match(raised[0].text, /Cannot read properties of null/);
  assert.match(raised[0].text, /map\.js:12/, 'and it still says where');
  assert.equal(getEntries().at(-1).kind, 'ERROR');
});
