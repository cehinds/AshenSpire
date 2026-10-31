import test from 'node:test';
import assert from 'node:assert/strict';
import { initInput, focusElement, clearFocus } from '../src/ui/input.js';
import { withKitDom } from './helpers/kit-dom.mjs';

function withInput(check) {
  withKitDom(({ document, Event }, _window, listeners) => {
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const previousStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
    globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
    try {
      const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
      const card = document.createElement('button'); card.className = 'card'; app.append(card);
      let cardActivations = 0;
      card.addEventListener('click', () => cardActivations++);
      assert.equal(focusElement(card), true);
      initInput();
      const press = (target, key) => {
        const down = new Event('keydown', { key, target, bubbles: true, cancelable: true });
        const handlers = listeners.get('keydown') || [];
        // Production window capture precedes the focused component's handlers.
        for (const handler of handlers.slice(0, 2)) {
          if (!down.immediatePropagationStopped) handler(down);
        }
        const captured = down.defaultPrevented;
        if (!down.propagationStopped) target.dispatchEvent(down);
        if (!down.propagationStopped) for (const handler of handlers.slice(2)) {
          if (!down.immediatePropagationStopped) handler(down);
        }
        const up = new Event('keyup', { key, target, bubbles: true, cancelable: true });
        for (const handler of listeners.get('keyup') || []) {
          if (!up.immediatePropagationStopped) handler(up);
        }
        return { down, up, captured };
      };
      check({ document, app, card, press, activations: () => cardActivations });
    } finally {
      clearFocus();
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
      else delete globalThis.navigator;
      if (previousStyle === undefined) delete globalThis.getComputedStyle;
      else globalThis.getComputedStyle = previousStyle;
    }
  });
}

test('damage numbers and keywords own Enter/Space while the game cursor remains on a card', () => {
  withInput(({ document, app, card, press, activations }) => {
    const number = document.createElement('span'); number.dataset.damageReceipt = 'true';
    const keyword = document.createElement('span'); keyword.className = 'tooltip-keyword'; keyword.dataset.tip = 'Per-hit damage';
    for (const control of [number, keyword]) {
      control.tabIndex = 0; control.setAttribute('role', 'button'); app.append(control);
      const explained = [];
      control.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation(); explained.push(event.key);
      });
      control.focus();
      assert.equal(document.activeElement, control);
      assert.equal(card.classList.contains('gp-focus'), true, 'DOM focus can move before the game cursor');
      for (const key of ['Enter', ' ']) {
        const event = press(control, key);
        assert.equal(activations(), 0, 'neither keydown nor keyup may activate the stale card');
        assert.equal(event.captured, false, 'window Confirm must defer to the native detail control');
        assert.equal(event.down.defaultPrevented, true, 'the detail handler receives its activation key');
      }
      assert.deepEqual(explained, ['Enter', ' ']);
    }
  });
});

test('ordinary card Confirm still activates once across the production keydown and keyup', () => {
  withInput(({ card, press, activations }) => {
    card.focus();
    const event = press(card, 'Enter');
    assert.equal(event.captured, true);
    assert.equal(activations(), 1);
  });
});

test('Enter on a keyword in an unselected hand card falls through to the game cursor; a selected card keeps it', () => {
  withInput(({ document, app, press, activations }) => {
    for (const [classes, owned] of [['card', false], ['card selected', true], ['card inspection-selected', true]]) {
      const hand = document.createElement('div'); hand.className = 'hand';
      const held = document.createElement('div'); held.className = classes;
      const keyword = document.createElement('span'); keyword.className = 'tooltip-keyword'; keyword.dataset.tip = 'Explained';
      keyword.tabIndex = 0; held.append(keyword); hand.append(held); app.append(hand);
      const before = activations();
      const event = press(keyword, 'Enter');
      assert.equal(event.captured, !owned, classes);
      assert.equal(activations() - before, owned ? 0 : 1, classes);
    }
  });
});
