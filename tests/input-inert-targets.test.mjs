import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { focusElement, focusFirst } from '../src/ui/input.js';

test('the keyboard/gamepad cursor rejects inert fighters and their controls, then restores them on disarm', () => {
  withKitDom(() => {
    const originalStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
    try {
      const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
      const enemy = document.createElement('article'); enemy.dataset.focusable = ''; enemy.className = 'combatant enemy';
      const info = document.createElement('button'); info.className = 'enemy-info'; enemy.append(info); app.append(enemy);
      const self = document.createElement('article'); self.dataset.focusable = ''; self.className = 'combatant player'; app.append(self);
      enemy.setAttribute('inert', '');
      assert.equal(focusElement(enemy), false);
      assert.equal(focusElement(info), false, 'descendant inspection controls inherit target exclusion');
      assert.equal(focusFirst('.enemy-info'), false);
      assert.equal(focusElement(self), true, 'the legal self target remains reachable');
      enemy.removeAttribute('inert');
      assert.equal(focusElement(enemy), true, 'disarming restores normal combatant navigation');
      assert.equal(focusElement(info), true);
      self.setAttribute('inert', '');
      assert.equal(focusElement(self), false, 'hostile aiming excludes the player');
    } finally {
      if (originalStyle === undefined) delete globalThis.getComputedStyle;
      else globalThis.getComputedStyle = originalStyle;
    }
  });
});
