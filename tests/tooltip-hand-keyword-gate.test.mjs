import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardDom } from './helpers/reward-dom.mjs';

// Exercise the real tooltip handlers with deterministic clocks. This fixture
// makes no browser layout or trusted pointer-delivery claims.
const dom = rewardDom();
const prototype = Object.getPrototypeOf(dom.document.body);
prototype.contains = function (other) { return other === this || this.children.some(child => child.contains(other)); };
Object.defineProperty(prototype, 'parentElement', { get() { return this.parentNode; } });
const documentEvents = dom.document.createElement('document');
dom.document.addEventListener = documentEvents.addEventListener.bind(documentEvents);
dom.document.dispatchEvent = documentEvents.dispatchEvent.bind(documentEvents);
dom.document.documentElement = dom.document.body;
dom.document.getElementById = id => dom.document.querySelector(`#${id}`);
dom.document.elementFromPoint = () => null;
dom.window.document = dom.document;
dom.window.innerWidth = 1440; dom.window.innerHeight = 900;
let clock = 0, serial = 0;
const timers = new Map();
const globals = { ...dom, Node: dom.document.body.constructor,
  MutationObserver: class { observe() {} disconnect() {} },
  setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, at: clock + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
};
const previous = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
Object.assign(globalThis, globals);
const { attachTooltip, hideTooltip, clearControlSelection } = await import('../src/ui/components/tooltip.js');
const fire = (el, type, options = {}) => el.dispatchEvent(new Event(type, { pointerType: 'mouse', ...options }));
function advance(ms) {
  const end = clock + ms;
  for (;;) {
    const next = [...timers].filter(([, row]) => row.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, row] = next; timers.delete(id); clock = row.at; row.fn();
  }
  clock = end;
}

const open = () => document.getElementById('tooltip')?.dataset.open === 'true';
function keywordIn(containerClass, cardClasses) {
  const host = document.createElement('div'); host.className = containerClass;
  const card = document.createElement('div'); card.className = cardClasses;
  const kw = document.createElement('span'); kw.className = 'tooltip-keyword'; kw.dataset.tip = 'Explained';
  card.appendChild(kw); host.appendChild(card); document.body.appendChild(host);
  attachTooltip(kw, () => '<div>Explained</div>');
  return kw;
}
const hover = (kw) => { fire(kw, 'pointerenter'); advance(2000); return open(); };
test.beforeEach(() => { clearControlSelection(); hideTooltip(); timers.clear(); });
test.after(() => {
  clearControlSelection(); hideTooltip();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

test('a keyword in an unselected hand card opens no tooltip on hover or focus', () => {
  const kw = keywordIn('hand', 'card');
  assert.equal(hover(kw), false);
  fire(kw, 'focus'); advance(2000);
  assert.equal(open(), false);
});

test('a keyword in a selected hand card opens its tooltip', () => {
  assert.equal(hover(keywordIn('hand', 'card selected')), true);
});

test('a keyword in an inspection-selected hand card opens its tooltip', () => {
  assert.equal(hover(keywordIn('hand', 'card inspection-selected')), true);
});

test('a keyword outside the hand opens its tooltip as before', () => {
  assert.equal(hover(keywordIn('reward-offers', 'card')), true);
});

test('a click on a held-back keyword is neither prevented nor stopped, so the card tap still works', () => {
  const kw = keywordIn('hand', 'card');
  let prevented = false;
  const event = new Event('click', { target: kw });
  event.preventDefault = () => { prevented = true; };
  document.dispatchEvent(event);
  assert.equal(prevented, false);
  assert.equal(open(), false);
});

function symbolIn(cardClasses, withLane = false) {
  const hand = document.createElement('div'); hand.className = 'hand';
  const card = document.createElement('div'); card.className = cardClasses;
  const sym = document.createElement('span'); sym.className = 'card-tag-symbol'; sym.dataset.tip = 'Explained';
  sym.box = { left: 0, top: 0, right: 50, bottom: 50, width: 50, height: 50 };
  const lane = document.createElement('div'); lane.className = 'hand-hit-lane';
  if (withLane) card.appendChild(lane);
  card.appendChild(sym); hand.appendChild(card); document.body.appendChild(hand);
  return { sym, lane };
}
function clickOn(target, options = {}) {
  let prevented = false;
  const event = new Event('click', { target, ...options });
  event.preventDefault = () => { prevented = true; };
  document.dispatchEvent(event);
  return prevented;
}

test('a tag symbol click on an unselected hand card opens nothing and is not prevented', () => {
  const { sym } = symbolIn('card');
  assert.equal(clickOn(sym), false);
  assert.equal(open(), false);
});

test('a tag symbol click on a selected hand card opens its tooltip', () => {
  const { sym } = symbolIn('card selected');
  clickOn(sym);
  assert.equal(open(), true);
});

test('a hit-lane press over a tag symbol on an unselected card is not redirected to the symbol', () => {
  const { lane } = symbolIn('card', true);
  assert.equal(clickOn(lane, { clientX: 10, clientY: 10 }), false);
  assert.equal(open(), false);
});
