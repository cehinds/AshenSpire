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
// A ZERO ACTION COST IS A COST, AND IT IS PRINTED. This test used to assert
// the opposite — that the ◆ row was DROPPED at 0 — which is why every free
// card in the game (rogueShiv, and Shiv / Quick Cut / Comet Fragment / Warcry
// through it) shipped with no ◆ at all. An absent row reads as "no action cost
// printed", i.e. unknown, and the fan's left edge is exactly where a player
// counts what the turn can still afford. The SECONDARY pools keep eliding at
// zero: two empty rails on every card is noise, not information.
const free = render({ cost: 0, staminaCost: 0, manaCost: 0, tokens: {} });
assert.match(free, /class="cost"/);
assert.match(free, /cost: 0/);
assert.doesNotMatch(free, /class="(?:stamina|mana)-cost"/);
assert.match(render(undefined), /card-cost-rail/);
console.log('11 checks passed');
