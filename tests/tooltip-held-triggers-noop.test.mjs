import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/dom.mjs';

// syncHeldTriggers runs on every class change in the hand. A second call over an unchanged hand
// must write nothing (no setAttribute, no dataset write), so no MutationObserver record is queued.
const dom = rewardDom();
const prototype = Object.getPrototypeOf(dom.document.body);
prototype.contains = function (other) { return other === this || this.children.some(child => child.contains(other)); };
const documentEvents = dom.document.createElement('document');
dom.document.addEventListener = documentEvents.addEventListener.bind(documentEvents);
dom.document.dispatchEvent = documentEvents.dispatchEvent.bind(documentEvents);
dom.document.documentElement = dom.document.body;
dom.document.getElementById = id => dom.document.querySelector(`#${id}`);
dom.window.document = dom.document;
dom.window.innerWidth = 1440; dom.window.innerHeight = 900;
const previous = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
Object.assign(globalThis, dom, { Node: dom.document.body.constructor, MutationObserver: class { observe() {} disconnect() {} }, setTimeout() { return 0; }, clearTimeout() {} });
const { syncHeldTriggers } = await import('../src/ui/components/tooltip.js');
test.after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

test('syncHeldTriggers: a second call over an unchanged hand writes nothing', () => {
  const hand = document.createElement('div'); hand.className = 'hand';
  const card = document.createElement('div'); card.className = 'card';
  const tag = document.createElement('span'); tag.className = 'card-tag-symbol';
  // The fake DOM's tabIndex is a plain field; a browser's writes the attribute, which the guard reads.
  Object.defineProperty(tag, 'tabIndex', { set(v) { this.setAttribute('tabindex', String(v)); }, get() { return Number(this.getAttribute('tabindex') ?? -1); } });
  card.appendChild(tag); hand.appendChild(card); document.body.appendChild(hand);
  syncHeldTriggers(hand);
  assert.equal(tag.getAttribute('tabindex'), '-1');
  assert.equal(tag.dataset.heldBack, 'true');
  let writes = 0;
  const setAttribute = tag.setAttribute.bind(tag);
  tag.setAttribute = (...args) => { writes++; return setAttribute(...args); };
  const dataset = tag.dataset;
  Object.defineProperty(tag, 'dataset', {
    value: new Proxy(dataset, {
      set(t, k, v) { writes++; t[k] = v; return true; },
      deleteProperty(t, k) { writes++; delete t[k]; return true; },
    }),
  });
  syncHeldTriggers(hand);
  assert.equal(writes, 0);
});
