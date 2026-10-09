import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { renderCard } from '../src/ui/components/card.js';
import { cardMarkupDom } from './helpers/card-markup-dom.mjs';

// Exercise the real renderer with production registries. This records markup;
// it does not claim to test browser geometry or accessibility trees.
Object.assign(globalThis, cardMarkupDom());
const registries = createRegistries(contentBundle);
const ref = { cardId: contentBundle.cards[0].id };
const render = (preview) => renderCard(registries, ref, { preview, tooltip: false, inspection: false }).innerHTML;
const face = render({ cost: 3, staminaCost: 3, manaCost: 4, tokens: {} });
assert.match(face, /data-cost-layout="staminaMana"/);
assert.match(face, /data-card-binding="stamina"[^>]*>3<\/div>/);
assert.match(face, /data-card-binding="mana"[^>]*>4<\/div>/);
assert.doesNotMatch(face, /data-component="energy-(icon|value)"/);
const variable = render({ costIsX: true, cost: 9, staminaCost: 9, manaCost: 0, tokens: {} });
assert.match(variable, /data-card-binding="stamina"[^>]*>X<\/div>/);
assert.doesNotMatch(variable, /data-component="mana-(icon|value)"/);
const free = render({ cost: 0, staminaCost: 0, manaCost: 0, tokens: {} });
assert.match(free, /data-card-binding="stamina"[^>]*>0<\/div>/);
assert.match(free, /data-cost-layout="staminaOnly"/);
assert.doesNotMatch(free, /data-component="mana-(icon|value)"/);
const flurry = renderCard(registries, { cardId: 'twinbladeFlurry' }, { tooltip: false, inspection: false,
  preview: { cost: 1, staminaCost: 1, manaCost: 0, tokens: { damage: 1, hits: 3 },
    damageSequences: [{ amountToken: 'damage', hitsToken: 'hits', hitDamages: [1, 3, 3], totalDamage: 7 }] } }).innerHTML;
assert.match(flurry, /1 \+ 3 \+ 3<\/span> damage \(7 total across 3 hits\)/);
assert.doesNotMatch(flurry, />1<\/span> damage <span class="val">3<\/span> times/);
assert.match(render(undefined), /illustrated-card-face/);
console.log('12 illustrated resource and tactical preview checks passed');
