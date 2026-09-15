import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard } from '../src/ui/components/card.js';

// Exercise the real renderer with production registries. This records markup;
// it does not claim to test browser geometry or accessibility trees.
globalThis.document = { createElement: () => ({
  dataset: {}, style: { setProperty() {} }, classList: { add() {} }, innerHTML: '',
}) };
globalThis.requestAnimationFrame = () => {};
const registries = createRegistries(contentBundle);
const ref = { cardId: contentBundle.cards[0].id };
const render = (preview) => renderCard(registries, ref, { preview, tooltip: false, inspection: false }).innerHTML;
const face = render({ cost: 3, staminaCost: 2, manaCost: 4, tokens: {} });
assert.ok(face.indexOf('class="cost"') < face.indexOf('class="stamina-cost"'));
assert.ok(face.indexOf('class="stamina-cost"') < face.indexOf('class="mana-cost"'));
assert.match(face, /cost: 3/);
assert.match(face, /cost: 2/);
assert.match(face, /cost: 4/);
const variable = render({ costIsX: true, cost: 9, staminaCost: 0, manaCost: 0, tokens: {} });
assert.match(variable, /cost: X/);
assert.doesNotMatch(variable, /class="(?:stamina|mana)-cost"/);
const free = render({ cost: 0, staminaCost: 0, manaCost: 0, tokens: {} });
assert.doesNotMatch(free, /class="cost"/);
assert.match(render(undefined), /card-cost-rail/);
console.log('9 checks passed');
