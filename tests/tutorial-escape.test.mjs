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
