// The Load door keeps its list while the review stands over it (CLEAN-CODE-PROMPT §3): Escape or
// Back out of the review puts the same list door back, rows and all, instead of drawing a new one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resetModalState } from '../src/ui/modalManager.js';
import { openSaveSlotSelector, closeSaveSlotSelector } from '../src/ui/components/saveSlotSelector.js';
import { withKitDom } from './helpers/dom.mjs';

const REG = createRegistries(contentBundle);
const summary = { className: 'Reaver', actNumber: 1, floor: 3, hp: 40, maxHp: 50, seed: 7 };
const slots = [{ slot: 1, summary }, { slot: 2, summary: null }, { slot: 3, summary: null }];

// The door focuses in a microtask; run those inside the fixture so none outlives its DOM.
function withDoorDom(fn) {
  const queued = [];
  const nativeQueue = globalThis.queueMicrotask;
  globalThis.queueMicrotask = (task) => queued.push(task);
  try { withKitDom((dom, win) => fn(dom, win, () => queued.splice(0).forEach((task) => task()))); }
  finally { globalThis.queueMicrotask = nativeQueue; }
}

function openDoor(dom) {
  resetModalState();
  openSaveSlotSelector({ host: dom.document.body, slots, registries: REG, inlineReview: true, onRequestLoad() {} });
  return dom.document.body.querySelector('.title-modal-veil');
}

const exits = {
  Escape: (dom, win) => win.press('Escape'),
  'the review\'s Back': (dom) => dom.document.body.querySelector('[data-title-action="review-back"]').click(),
};

for (const [exit, leave] of Object.entries(exits)) {
  test(`Load door: ${exit} out of the review shows the same list door again`, () => {
    withDoorDom((dom, win, flush) => {
      const veil = openDoor(dom);
      flush();
      const listDoor = veil.children[0];
      const rows = veil.querySelectorAll('[data-slot-pick]');
      veil.querySelector('[data-title-action="modal-continue"]').click();
      assert.notEqual(veil.children[0], listDoor, 'the review stands in the list\'s place');
      assert.ok(veil.querySelector('[data-title-action="review-load"]'), 'the review is open');
      leave(dom, win);
      assert.equal(dom.document.body.querySelector('.title-modal-veil'), veil, 'the veil is the same node');
      assert.equal(veil.children.length, 1);
      assert.equal(veil.children[0], listDoor, 'the list door is the same node');
      assert.deepEqual(veil.querySelectorAll('[data-slot-pick]'), rows, 'every row is the same node');
      assert.equal(veil.querySelector('[data-title-action="review-load"]'), null, 'the review is gone');
      assert.equal(dom.document.activeElement, veil.querySelector('[data-slot-pick="1"]'), 'focus is on the reviewed slot');
      closeSaveSlotSelector({ restoreFocus: false });
      flush();
      resetModalState();
    });
  });
}
