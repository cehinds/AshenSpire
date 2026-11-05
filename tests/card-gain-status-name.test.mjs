// A status grant names the status: "Gain 1 Read Intent.", never a bare "Gain 1." (owner, 2026-11-05).
// The amount token resolves to a number only, so every authored template that gains/applies a status must carry the noun.
import test from 'node:test';
import assert from 'node:assert/strict';
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

test('Read Intent rules text and its face say "Gain 1 Read Intent"', () => {
  const def = registries.cards.get('base.reveal-opponent-hand');
  assert.match(def.textTemplate, /^Gain \{base\.read-intent\} Read Intent\./);
  assert.match(render(def), /^Gain 1 Read Intent\. Reveal the selected enemy's intent/);
  assert.equal(def.faceTemplate, undefined, 'the face reads the same template');
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
