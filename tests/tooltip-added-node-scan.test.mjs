import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/dom.mjs';

// The page-wide held-trigger observer (tooltip.js wireTitles) scans only the element nodes a mutation
// burst added, not the whole page (combat perf, 2026-11-19). A newly inserted card's triggers must still
// leave the tab order; a trigger elsewhere on the page is not re-read; text nodes are skipped.
const dom = rewardDom();
const prototype = Object.getPrototypeOf(dom.document.body);
prototype.contains = function (other) { return other === this || this.children.some(child => child.contains(other)); };
Object.defineProperty(prototype, 'parentElement', { get() { return this.parentNode || null; }, configurable: true });
Object.defineProperty(prototype, 'nodeType', { get() { return String(this.tagName).toLowerCase() === 'text' ? 3 : 1; }, configurable: true });
const documentEvents = dom.document.createElement('document');
dom.document.addEventListener = documentEvents.addEventListener.bind(documentEvents);
dom.document.dispatchEvent = documentEvents.dispatchEvent.bind(documentEvents);
dom.document.documentElement = dom.document.body;
dom.document.getElementById = id => dom.document.querySelector(`#${id}`);
dom.window.document = dom.document;
dom.window.innerWidth = 1440; dom.window.innerHeight = 900;
const observers = [];
class RecordingObserver {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() {}
}
const previous = Object.fromEntries(['MutationObserver', 'Node', 'setTimeout', 'clearTimeout', ...Object.keys(dom)].map(key => [key, globalThis[key]]));
Object.assign(globalThis, dom, { Node: dom.document.body.constructor, MutationObserver: RecordingObserver, setTimeout() { return 0; }, clearTimeout() {} });
const { syncAddedHeldTriggers } = await import('../src/ui/components/tooltip.js');
test.after(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

const tabIndexed = el => Object.defineProperty(el, 'tabIndex', {
  set(v) { this.setAttribute('tabindex', String(v)); }, get() { return Number(this.getAttribute('tabindex') ?? -1); },
});
function cardWithTag() {
  const card = document.createElement('div'); card.className = 'card';
  const tag = tabIndexed(document.createElement('span')); tag.className = 'card-tag-symbol';
  card.appendChild(tag);
  return { card, tag };
}
const bodyObserver = () => observers.find(observer => observer.target === document.body && observer.options?.childList && observer.options?.subtree);

test('the page-wide observer arms held triggers on a newly inserted card', async () => {
  const observer = bodyObserver();
  assert.ok(observer, 'tooltip.js observes document.body for added nodes');
  const { card, tag } = cardWithTag();
  document.body.appendChild(card);
  const text = document.createTextNode('beat');
  document.body.appendChild(text);
  observer.callback([{ addedNodes: [text, card] }]);
  await Promise.resolve();
  assert.equal(tag.getAttribute('tabindex'), '-1');
  assert.equal(tag.dataset.heldBack, 'true');
});

test('the observer scans only the added nodes, not the rest of the page', async () => {
  const observer = bodyObserver();
  const { card: elsewhere, tag: untouched } = cardWithTag();
  document.body.appendChild(elsewhere); // present, but not in this burst's records
  const { card, tag } = cardWithTag();
  document.body.appendChild(card);
  let pageScans = 0;
  const query = document.body.querySelectorAll.bind(document.body);
  document.body.querySelectorAll = selector => { pageScans++; return query(selector); };
  observer.callback([{ addedNodes: [card] }]);
  observer.callback([{ addedNodes: [] }]); // a second record in the same burst queues nothing new
  await Promise.resolve();
  delete document.body.querySelectorAll;
  assert.equal(pageScans, 0, 'no page-wide query');
  assert.equal(tag.dataset.heldBack, 'true', 'the added card is armed');
  assert.equal(untouched.dataset.heldBack, undefined, 'a node outside the burst is not re-read');
});

test('syncAddedHeldTriggers handles a trigger added on its own, nested additions and text nodes', () => {
  const card = document.createElement('div'); card.className = 'card';
  document.body.appendChild(card);
  const lone = tabIndexed(document.createElement('span')); lone.className = 'tooltip-keyword';
  card.appendChild(lone);
  const { card: outer, tag: inner } = cardWithTag();
  document.body.appendChild(outer);
  syncAddedHeldTriggers([lone, outer, inner, document.createTextNode('x')]);
  assert.equal(lone.dataset.heldBack, 'true', 'an added trigger is matched itself, not only its descendants');
  assert.equal(inner.dataset.heldBack, 'true');
  // A detached node (added then removed within the burst) is skipped.
  const { card: gone, tag: goneTag } = cardWithTag();
  syncAddedHeldTriggers([gone]);
  assert.equal(goneTag.dataset.heldBack, undefined);
});
