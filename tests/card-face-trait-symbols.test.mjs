import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard } from '../src/ui/components/card.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const reg = createRegistries(contentBundle);

// The face carries only what the card does; trait words never print as face text.
test('a Flux card face prints no trait words, only its damage and effect text', () => withKitDom(dom => {
  const prototype = Object.getPrototypeOf(dom.document.body);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'innerHTML');
  const markup = new WeakMap();
  Object.defineProperty(prototype, 'innerHTML', { configurable: true,
    set(value) { markup.set(this, value); descriptor.set.call(this, value); } });
  const el = renderCard(reg, { cardId: 'starstonePebble' }, { inspection: false });
  // Attribute values (aria-label of symbols) are not face text.
  const text = markup.get(el).replace(/(aria-label|aria-description|data-tip|data-tag-id)="[^"]*"/g, '');
  assert.doesNotMatch(text, /Flux \d|Impact \d|Reaction\.|Counterstrike\./);
}));
