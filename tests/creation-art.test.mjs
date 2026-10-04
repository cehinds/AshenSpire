import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { keepsakeChoiceButton } from '../src/ui/components/creationCards.js';
import { restoreArtPlaceholders } from '../src/ui/artFallback.js';

test('keepsake art survives a failed load and repeated Retry restoration', () => withKitDom(({ document, Event }) => {
  // The shared structural fixture has no replaceWith primitive yet.
  Object.getPrototypeOf(document.body).replaceWith = function replaceWith(node) {
    if (!this.parentNode) return;
    this.parentNode.insertBefore(node, this);
    this.remove();
  };
  const keepsake = { id: 'oldCinder', icon: '*', name: 'Old Cinder', desc: 'A keepsake.' };
  let chosen = 0;
  const button = keepsakeChoiceButton(keepsake, true, () => { chosen += 1; });
  document.body.appendChild(button);
  const image = button.querySelector('img');
  assert.ok(image, 'the painted keepsake is mounted');
  const source = image.getAttribute('src');
  for (let attempt = 0; attempt < 2; attempt++) {
    image.dispatchEvent(new Event('error'));
    assert.equal(button.querySelector('img'), null, 'the broken image is replaced');
    const placeholder = button.querySelector('[data-art-placeholder]');
    assert.equal(placeholder?.textContent, keepsake.icon, 'the marked glyph stands in');
    assert.equal(restoreArtPlaceholders(document), 1);
    assert.equal(button.querySelector('img'), image, 'Retry restores the same image and its error handler');
    assert.equal(image.getAttribute('src'), source);
    assert.equal(button.querySelector('[data-art-placeholder]'), null);
  }
  button.click();
  assert.equal(chosen, 1, 'selection still works after restoring the artwork');
  assert.equal(button.getAttribute('aria-label'), 'Old Cinder. A keepsake.');
}));
