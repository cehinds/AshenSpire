import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { mountTutorial } from '../src/ui/components/tutorial.js';

for (const [name, marker] of [
  ['enemy Attack', '<div class="enemy-row"><div class="combatant enemy targetable"></div></div>'],
  ['targeted flask without a selected card', '<div class="enemy-row"><div class="combatant enemy targetable"></div></div>'],
  ['self Counter', '<div class="combatant player armed"></div>'],
]) test(`tutorial Escape yields ${name} cancellation before its one-time exit`, () => {
  withKitDom((dom, win, listeners) => {
    const root = dom.document.createElement('main');
    root.innerHTML = `<div class="energy-orb"></div>${marker}<div class="hand"><div class="card${name === 'targeted flask without a selected card' ? '' : ' selected'}"></div></div>`;
    dom.document.body.appendChild(root);
    let done = 0;
    mountTutorial(root, { onDone: () => { done++; } });
    const key = () => {
      const event = new dom.Event('keydown', { key: 'Escape', cancelable: true, target: dom.document.body });
      for (const listener of [...listeners.get('keydown')]) listener(event);
      return event;
    };
    const cancelled = key();
    assert.equal(cancelled.defaultPrevented, false, 'the same key reaches combat');
    assert.equal(!!cancelled.propagationStopped, false, 'capture does not swallow cancellation');
    assert.equal(done, 0);
    assert.ok(root.querySelector('.tut-veil'));
    // Combat's existing bubble handler clears these rendered arm markers.
    root.querySelector('.enemy.targetable')?.classList.remove('targetable');
    root.querySelector('.player.armed')?.classList.remove('armed');
    root.querySelector('.card.selected')?.classList.remove('selected');
    const exit = key();
    assert.equal(exit.defaultPrevented, true);
    assert.equal(done, 1);
    assert.equal(root.querySelector('.tut-veil'), null);
    key();
    assert.equal(done, 1, 'the capture handler removes itself after completion');
  });
});


test('tutorial controls navigate all steps and remove their independent overlay exactly once', () => {
  withKitDom((dom) => {
    const root = dom.document.createElement('main');
    root.innerHTML = '<div class="energy-orb"></div><div class="enemy-row"><div class="intent"></div></div><div class="hand"><div class="card"></div></div><button class="end-turn"></button>';
    dom.document.body.appendChild(root);
    let done = 0;
    mountTutorial(root, { onDone: () => { done++; } });
    const veil = root.querySelector('.tut-veil'), row = root.querySelector('.tut-row');
    assert.equal(row.parentNode, veil, 'the real controls use the veil coordinate space independently of prose');
    assert.equal(veil.querySelector('.tut-next'), row.querySelector('.tut-next'));
    const next = row.querySelector('.tut-next');
    for (const label of ['Next (1/4)', 'Next (2/4)', 'Next (3/4)', 'Got it']) {
      assert.equal(next.textContent, label, 'step labels follow the moved button');
      assert.equal(done, 0);
      next.dispatchEvent(new dom.Event('click', { target: next }));
    }
    assert.equal(done, 1);
    assert.equal(root.querySelector('.tut-row'), null, 'completion removes the independent control layer');
    assert.equal(root.querySelector('.tut-veil'), null);
    next.dispatchEvent(new dom.Event('click', { target: next }));
    assert.equal(done, 1);
  });
});

test('tutorial Skip exits without advancing or leaving its control layer behind', () => {
  withKitDom((dom) => {
    const root = dom.document.createElement('main');
    root.innerHTML = '<div class="energy-orb"></div>';
    dom.document.body.appendChild(root);
    let done = 0;
    mountTutorial(root, { onDone: () => { done++; } });
    const skip = root.querySelector('.tut-skip');
    skip.dispatchEvent(new dom.Event('click', { target: skip }));
    assert.equal(done, 1);
    assert.equal(root.querySelector('.tut-row'), null);
    assert.equal(root.querySelector('.tut-veil'), null);
    skip.dispatchEvent(new dom.Event('click', { target: skip }));
    assert.equal(done, 1);
  });
});
