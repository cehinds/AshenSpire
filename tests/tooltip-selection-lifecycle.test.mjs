import test from 'node:test';
import assert from 'node:assert/strict';
import { registerModal } from '../src/ui/modalManager.js';
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
let escaped = 0;
document.addEventListener('keydown', event => { if (event.key === 'Escape') escaped++; });
const fire = (el, type, options = {}) => el.dispatchEvent(new Event(type, { pointerType: 'mouse', ...options }));
const escape = () => fire(document, 'keydown', { key: 'Escape', target: document.activeElement });
const selected = el => el.classList.contains('tooltip-selected');
function advance(ms) {
  const end = clock + ms;
  for (;;) {
    const next = [...timers].filter(([, row]) => row.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, row] = next; timers.delete(id); clock = row.at; row.fn();
  }
  clock = end;
}
function control(options = {}) {
  const el = document.createElement('button');
  document.body.appendChild(el);
  attachTooltip(el, () => '<div>Explanation</div>', { selectionFirst: true, ...options });
  return el;
}
test.beforeEach(() => { clearControlSelection(); hideTooltip(); escaped = 0; timers.clear(); });
test.after(() => {
  clearControlSelection(); hideTooltip();
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

test('hiding a pending hover releases its owner so the first Escape reaches the armed card', () => {
  const info = control();
  fire(info, 'pointerenter');
  assert.equal(selected(info), true);
  hideTooltip();
  document.activeElement = document.createElement('div');
  assert.equal(selected(info), false);
  advance(2000);
  escape();
  assert.equal(escaped, 1);
  assert.equal(document.getElementById('tooltip')?.dataset.open ?? 'false', 'false');
});

test('leaving or blurring pending hover and focus cancels transient selection', () => {
  for (const [enter, leave] of [['pointerenter', 'pointerleave'], ['gpfocus', 'gpblur']]) {
    const info = control();
    fire(info, enter);
    fire(info, leave);
    advance(2000);
    assert.equal(selected(info), false);
    escape();
  }
  assert.equal(escaped, 2);
});

test('pending hover or focus cannot consume Escape before a panel opens', () => {
  for (const enter of ['pointerenter', 'gpfocus']) {
    const info = control();
    fire(info, enter);
    escape();
    assert.equal(selected(info), false);
    advance(2000);
    assert.equal(document.getElementById('tooltip')?.dataset.open ?? 'false', 'false');
  }
  assert.equal(escaped, 2, 'the same Escape reaches the downstream card handler');
});

test('an open hover panel still owns Escape before the downstream card handler', () => {
  const info = control();
  fire(info, 'pointerenter'); advance(1000);
  escape();
  assert.equal(escaped, 0);
  assert.equal(document.getElementById('tooltip').dataset.open, 'false');
  assert.equal(selected(info), false);
  escape(); assert.equal(escaped, 1);
});

test('hiding an open hover cancels its close timer and releases hidden selection immediately', () => {
  const info = control();
  fire(info, 'pointerenter'); advance(1000);
  assert.equal(document.getElementById('tooltip').dataset.open, 'true');
  fire(info, 'pointerleave');
  hideTooltip();
  assert.equal(selected(info), false);
  escape(); assert.equal(escaped, 1);
  advance(2000);
  assert.equal(document.getElementById('tooltip').dataset.open, 'false');
});

test('explicit mouse selection survives hide, hover, focus, leave and delayed close until Escape', () => {
  const info = control();
  fire(info, 'click'); advance(1000);
  fire(info, 'pointerenter'); fire(info, 'gpfocus');
  fire(info, 'pointerleave'); fire(info, 'gpblur'); advance(1000);
  assert.equal(selected(info), true, 'hover close must not erase deliberate selection');
  hideTooltip(); assert.equal(selected(info), true);
  escape();
  assert.equal(escaped, 0, 'an explicit selection legitimately owns Escape');
  assert.equal(selected(info), false);
  escape(); assert.equal(escaped, 1);
});

test('touch selection survives a render hide and focus so the second tap still activates', () => {
  let activated = 0;
  const info = control({ activate: () => activated++ });
  fire(info, 'click', { pointerType: 'touch' });
  hideTooltip(); fire(info, 'gpfocus'); fire(info, 'gpblur');
  assert.equal(selected(info), true);
  fire(info, 'click', { pointerType: 'touch' });
  assert.equal(activated, 1);
  assert.equal(selected(info), false);
});

test('two-tap explanation survives hide and selecting another owner resets selection provenance', () => {
  const detail = document.createElement('span'); document.body.appendChild(detail);
  attachTooltip(detail, () => '<div>Detail</div>', { tapToExplain: true });
  fire(detail, 'click'); hideTooltip();
  assert.equal(selected(detail), true);
  fire(detail, 'click');
  assert.equal(document.getElementById('tooltip').dataset.open, 'true');
  const info = control(); fire(info, 'pointerenter');
  assert.equal(selected(detail), false);
  assert.equal(selected(info), true);
  hideTooltip(); assert.equal(selected(info), false, 'new hover must not inherit the prior explicit origin');
  fire(detail, 'click'); clearControlSelection();
  fire(info, 'gpfocus'); hideTooltip();
  assert.equal(selected(info), false, 'explicit clearing resets the origin too');
});


test('a detached explicit owner cannot consume the first Escape from an inspection modal', () => {
  const info = control();
  fire(info, 'click');
  assert.equal(selected(info), true);
  // Opening the reading hides tooltips before the previous screen replaces
  // its selected control. No observer remains to clear that detached owner.
  hideTooltip(); info.remove();
  const modal = document.createElement('section');
  modal.setAttribute('aria-modal', 'true'); document.body.appendChild(modal);
  let dismissed = 0;
  const release = registerModal('Inspection', modal, { dismiss() { dismissed++; modal.remove(); release(); } });
  try {
    escape();
    assert.equal(dismissed, 1, 'the first Escape reaches the top inspection');
    assert.equal(modal.isConnected, false);
    assert.equal(selected(info), false, 'the stale explicit selection is cleared');
    assert.equal(document.getElementById('tooltip')?.dataset.open ?? 'false', 'false');
  } finally { release(); modal.remove(); }
});
