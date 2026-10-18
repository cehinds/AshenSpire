// THE FORM DRIVES THE BEHAVIOUR (owner, 2026-10-18). beatArmer's `arm` used to
// publish the beat form as `data-beat` while armHold ran the same hold-and-
// review whatever the form said, so a row ruled 'none' still opened the review
// on a tap. Now a 'none' form has no timer and commits on a tap; any other form
// is unchanged (a tap reviews, a completed hold commits). The form is read per
// press, because the state a row's stakes move with changes inside one screen.
//
// Driven on the real `eventChoice` row (stakes move with `ctx.binding`) through
// the real beatArmer and armHold, on a stand-in control that records its
// listeners so the click can be delivered synchronously.
import test from 'node:test';
import assert from 'node:assert/strict';
import { beatArmer } from '../src/ui/components/holdconfirm.js';

function fakeControl() {
  const handlers = new Map();
  const props = new Map();
  return {
    handlers,
    isConnected: true,
    dataset: {},
    classList: { add() {}, remove() {}, contains: () => false },
    style: { setProperty: (k, v) => props.set(k, v), getPropertyValue: (k) => props.get(k) ?? '', removeProperty: (k) => props.delete(k) },
    addEventListener(type, fn) { handlers.set(type, fn); },
    removeEventListener(type) { handlers.delete(type); },
    querySelector: () => null,
    matches: () => false,
    closest: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 40 }),
  };
}

const REGISTRIES = {
  balance: { ui: { holdConfirm: { def: 'normal', steps: { off: 0, normal: 600 } } } },
  framework: { confirmationTone: () => 'normal' },
};

// The review is the confirmation modal; its first act is to build a DOM node.
// A sentinel `document` makes "the tap opened the review" observable.
const REVIEW = 'review-opened';
function withReviewSentinel(fn) {
  const was = globalThis.document;
  globalThis.document = { activeElement: null, createElement() { throw new Error(REVIEW); } };
  try { return fn(); } finally {
    if (was === undefined) delete globalThis.document;
    else globalThis.document = was;
  }
}

// armHold listens for Escape on the page itself.
for (const k of ['addEventListener', 'removeEventListener']) if (typeof globalThis[k] !== 'function') globalThis[k] = () => {};

function tap(control) {
  const click = Object.assign(new Event('click', { cancelable: true }), { detail: 0 });
  control.handlers.get('click')(click);
}

test("a 'none' beat commits on a tap with no review and no timer; 'hold' still reviews", () => {
  const state = { binding: false };
  const control = fakeControl();
  const committed = [];
  const arm = beatArmer({ settings: {} }, REGISTRIES);
  const disarm = arm(control, 'eventChoice', { ctx: () => ({ binding: state.binding }), onConfirm: () => committed.push('commit'), showHint: false });
  try {
    assert.equal(control.dataset.beat, 'none', 'a non-binding choice owes no beat');
    assert.equal(control.dataset.holdMs, undefined, 'and draws no hold timer');
    withReviewSentinel(() => tap(control));
    assert.deepEqual(committed, ['commit'], "one tap commits when the form is 'none' (no review opened)");

    // The state changes inside the same mount; the very next press follows it.
    state.binding = true;
    disarm.refresh();
    assert.equal(control.dataset.beat, 'hold');
    assert.equal(control.dataset.holdMs, '600', 'the hold timer is back');
    committed.length = 0;
    assert.throws(() => withReviewSentinel(() => tap(control)), new RegExp(REVIEW), "a tap on a 'hold' beat opens the review");
    assert.deepEqual(committed, [], 'and commits nothing');

    // ...and back: the decision is per press, not per mount.
    state.binding = false;
    withReviewSentinel(() => tap(control));
    assert.deepEqual(committed, ['commit'], "the press after the state returns to 'none' commits directly again");
  } finally {
    disarm();
  }
});
