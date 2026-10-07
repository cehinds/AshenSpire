// src/model/playingCard.js is an EXTRACTION, not a rewrite: every body in it
// stood inside renderCard on its way to innerHTML. So the tests that earn
// their place are the ones that would catch the extraction having changed
// something — plus the ones that pin the properties the old tangle could not
// have, because a projection tangled into a renderer cannot be asked anything.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel, playingCardClasses, staticCardTokens } from '../src/model/playingCard.js';
import { staticTokens } from '../src/ui/components/card.js';

const REG = createRegistries(contentBundle);

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };
const eq = (a, b, what) => { checks++; assert.deepEqual(a, b, what); };

const every = REG.cards.all();
ok(every.length > 0, 'there are cards to project');

// ---- it is pure ------------------------------------------------------------
const stripComments = (text) => text
  .split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const source = stripComments(readFileSync(new URL('../src/model/playingCard.js', import.meta.url), 'utf8'));
ok(!/\bdocument\b|\bwindow\b|innerHTML|createElement/.test(source),
  'the model never touches the DOM');
ok(!/\.\.\/ui\//.test(source), 'the model never imports from the view layer');

// ---- every authored card projects, and the result is frozen ---------------
for (const def of every) {
  const model = playingCardModel(REG, { cardId: def.id, upgraded: false });
  checks++;
  assert.equal(model.id, def.id, `${def.id} keeps its id`);
  assert.equal(model.name, def.name, `${def.id} keeps its name`);
  assert.ok(Object.isFrozen(model), `${def.id} projects a frozen record`);
  assert.ok(Object.isFrozen(model.tags), `${def.id} freezes its tag list`);
  assert.ok(typeof model.type.label === 'string' && model.type.label.length,
    `${def.id} has a type label`);
  assert.ok(model.icon, `${def.id} has an art glyph — never an empty face`);
}

// ---- the token extraction is byte-faithful to what the renderer exported ---
for (const def of every) {
  eq(staticCardTokens(def), staticTokens(def), `${def.id} tokens match the renderer's own export`);
}

// ---- the class string is the one every instrument reads --------------------
const sample = playingCardModel(REG, { cardId: every[0].id, upgraded: false });
const upgraded = playingCardModel(REG, { cardId: every[0].id, upgraded: true });
ok(playingCardClasses(sample).startsWith('card as-card playing-poker-card rarity-'),
  'the face keeps the hooks the tools read');
ok(!playingCardClasses(sample).includes('upgraded'), 'a base card is not marked upgraded');
ok(playingCardClasses(upgraded).endsWith(' upgraded'), 'an upgraded card is');

// ---- a preview overrides the authored numbers, and only those --------------
const withPreview = playingCardModel(REG, { cardId: every[0].id, upgraded: false }, {
  preview: { cost: 9, manaCost: 3, staminaCost: 1, costIsX: false, tokens: {}, values: [] },
});
eq({ ...withPreview.costs }, { variable: false, action: 9, mana: 3, stamina: 1 },
  "a preview's already-resolved numbers are the card's costs");
ok(withPreview.hasPreview && !sample.hasPreview, 'the model says whether it read a preview');
eq(withPreview.id, sample.id, 'a preview does not change what card it is');

// ---- a variable cost survives as a flag, not as the string 'X' -------------
const variable = playingCardModel(REG, { cardId: every[0].id, upgraded: false }, {
  preview: { cost: 0, manaCost: 0, staminaCost: 0, costIsX: true, tokens: {}, values: [] },
});
ok(variable.costs.variable === true, "a variable cost is a flag — 'X' is the view's word for it");

// ---- inheritance sources are an array, because a model is serializable -----
for (const def of every.slice(0, 40)) {
  const model = playingCardModel(REG, { cardId: def.id, upgraded: false });
  for (const tag of model.tags) {
    checks++;
    assert.ok(Array.isArray(tag.inheritedFrom), `${def.id}/${tag.id} carries an array, never a Set`);
  }
  checks++;
  assert.doesNotThrow(() => JSON.stringify(model), `${def.id} survives JSON — it is a record, not an object graph`);
}

// ---- and the renderer no longer derives any of it --------------------------
const card = stripComments(readFileSync(new URL('../src/ui/components/card.js', import.meta.url), 'utf8'));
const renderBody = card.slice(card.indexOf('export function renderCard'), card.indexOf('export function scheduleCardFits'));
ok(!/costProfile/.test(renderBody), 'renderCard no longer resolves costs itself');
ok(!/balance\.ui\.cardTypes/.test(renderBody), 'renderCard no longer reads the type table itself');
ok(!/registries\.classes\.(has|get)/.test(renderBody), 'renderCard no longer looks up the class tint itself');
ok(!/tagService/.test(renderBody), 'renderCard no longer resolves the tag junction itself');

console.log(`PASS ${checks}/${checks}; the playing card projects to a frozen model and the renderer only draws`);
