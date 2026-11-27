// A status grant names the status: "Gain 1 Read Intent.", never a bare "Gain 1." (owner, 2026-11-05).
// The amount token resolves to a number only, so every authored template that gains/applies a status must carry the noun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { staticCardTokens } from '../src/model/playingCard.js';

const registries = createRegistries(contentBundle);
const render = def => {
  const tokens = staticCardTokens(def, registries);
  return def.textTemplate.replace(/\{([\w.-]+)\}/g, (m, key) => (typeof tokens[key] === 'number' ? String(tokens[key]) : m));
};
// A status verb and its amount followed directly by punctuation, the end, or a conjunction: the noun is missing.
const BARE = /\b(?:[Gg]ain|[Gg]ains|[Aa]pply|[Ii]nflict) (?:\{[\w.-]+\}|\d+)(?=\s*(?:[.,;:]|$|\band\b|\bthen\b))/;

test('status tokens render amounts while the explicit template supplies the status name', () => {
  const def = { id: 'fixture.intent', type: 'skill', cost: 0,
    effects: [{ op: 'applyStatus', target: 'self', status: 'base.read-intent', stacks: 2 }],
    textTemplate: 'Gain {base.read-intent} Read Intent.' };
  assert.equal(render(def), 'Gain 2 Read Intent.');
  assert.equal(BARE.test(render(def)), false);
  assert.equal(BARE.test('Gain 2.'), true, 'a missing status noun is still detected');
});

test('current status templates and face overrides reach the runtime from authored JSON', () => {
  const source = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/base-cards/cards.json', import.meta.url))).cards.map(row => row.definition);
  for (const card of source) {
    const def = registries.cards.get(card.id);
    assert.ok(def, card.id);
    assert.equal(def.textTemplate, card.textTemplate, card.id);
    assert.deepEqual(def.faceTemplate, card.faceTemplate, card.id);
  }
});

test('no authored card text gains or applies a bare number with no status name', () => {
  const bad = [];
  for (const def of registries.cards.all()) {
    const sources = [['textTemplate', def.textTemplate], ...(def.faceTemplate || []).map((line, i) => [`faceTemplate[${i}]`, line]), ['upgrade.textTemplate', def.upgrade?.textTemplate]];
    for (const [field, text] of sources) {
      if (typeof text !== 'string') continue;
      for (const sentence of text.split(/(?<=[.!?])\s+/)) if (BARE.test(sentence)) bad.push(`${def.id} ${field}: ${sentence}`);
    }
  }
  assert.deepEqual(bad, []);
});
