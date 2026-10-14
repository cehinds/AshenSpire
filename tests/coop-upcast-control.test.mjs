import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { bindCardInspection } from '../src/ui/components/cardInspection.js';
import { clearSelection, litCard, resetSelection } from '../src/ui/components/cardSelection.js';
import { wireCoopUpcastControl } from '../src/ui/components/coopUpcastControl.js';

// This fixture's ordinary element dispatcher only bubbles. Add browser capture
// order so shared inspection really runs between the production capture/play doors.
function phaseEvents(dom) {
  const proto = Object.getPrototypeOf(dom.document.body);
  const records = new WeakMap();
  proto.addEventListener = function(type, fn, options) {
    const rows = records.get(this) || [];
    rows.push({ type, fn, capture: options === true || !!options?.capture });
    records.set(this, rows);
  };
  proto.removeEventListener = function(type, fn) {
    records.set(this, (records.get(this) || []).filter(row => row.type !== type || row.fn !== fn));
  };
  proto.dispatchEvent = function(event) {
    event.target ||= this;
    const path = []; for (let node = this; node; node = node.parentNode) path.push(node);
    const deliver = (node, capture) => {
      event.currentTarget = node;
      for (const row of [...(records.get(node) || [])]) {
        if (event.immediatePropagationStopped) break;
        if (row.type === event.type && row.capture === capture) row.fn(event);
      }
    };
    for (const node of [...path].reverse()) { deliver(node, true); if (event.propagationStopped) return !event.defaultPrevented; }
    for (const node of path) { deliver(node, false); if (!event.bubbles || event.propagationStopped) break; }
    return !event.defaultPrevented;
  };
}

function fixture(dom, { friendly = false, disabled = false } = {}) {
  phaseEvents(dom);
  resetSelection();
  const card = dom.document.createElement('div'); card.className = 'card';
  dom.document.body.appendChild(card);
  bindCardInspection(card, { title: 'Upcast test', identity: 'owned-card', actionOwnsTouch: true, open() {} });
  const state = { intents: [], energy: 3, rng: 0, opens: 0, arms: 0 };
  const controls = wireCoopUpcastControl(card, {
    disabled, selectBeforePlay: !friendly,
    onOpen: () => state.opens++,
    onPlay: () => { if (friendly) state.arms++; else { state.intents.push('play'); state.energy--; state.rng++; } },
  });
  return { card, controls, button: controls.querySelector('button'), state };
}

test('hostile Upcast first click selects without payment or RNG; second click submits once', () => {
  withKitDom(dom => {
    const { card, controls, state } = fixture(dom);
    card.click();
    assert.equal(litCard(), 'owned-card');
    assert.ok(card.classList.contains('inspection-selected'));
    assert.equal(controls.parentNode, card);
    assert.equal(controls.className, 'card-upcast-controls', 'same CSS/touch surface as solo');
    assert.deepEqual(state, { intents: [], energy: 3, rng: 0, opens: 0, arms: 0 });
    card.click();
    assert.deepEqual(state.intents, ['play']);
    assert.equal(state.energy, 2);
    assert.equal(state.rng, 1);
    clearSelection();
  });
});

test('Upcast pointer and keyboard gestures open only the chooser, preserving friendly arm', () => {
  withKitDom(dom => {
    const { card, button, state } = fixture(dom, { friendly: true });
    card.click(); assert.equal(state.arms, 1);
    let leaked = 0;
    for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) card.addEventListener(type, () => leaked++);
    for (const type of ['pointerdown', 'pointerup', 'keydown']) button.dispatchEvent(new dom.Event(type, { bubbles: true, key: 'Enter' }));
    button.click();
    assert.equal(state.opens, 1);
    assert.equal(leaked, 0);
    assert.equal(state.arms, 1);
    assert.deepEqual(state.intents, []);
    clearSelection();
  });
});

test('keyboard inspection selection exposes Upcast and clearing it restores the inert selecting beat', () => {
  withKitDom(dom => {
    const { card, button, state } = fixture(dom);
    card.dispatchEvent(new dom.Event('cardinspectionrequest'));
    assert.equal(litCard(), 'owned-card');
    button.click(); assert.equal(state.opens, 1);
    clearSelection();
    assert.equal(litCard(), null);
    assert.equal(card.classList.contains('inspection-selected'), false);
    card.click(); assert.deepEqual(state.intents, []);
    clearSelection();
  });
});

test('unavailable Upcast remains disabled and never opens the chooser', () => {
  withKitDom(dom => {
    const { button, state } = fixture(dom, { disabled: true });
    button.click();
    assert.equal(state.opens, 0);
    assert.deepEqual(state.intents, []);
    clearSelection();
  });
});
