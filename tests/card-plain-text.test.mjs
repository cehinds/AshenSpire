// tests/card-plain-text.test.mjs — cardPlainText(registries, ref) is the rules
// text a card's choice button shows: a plain string from the same template the
// face fills, with no markup, and it follows the upgrade.
//   node --test tests/card-plain-text.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { cardPlainText } from '../src/ui/components/card.js';

const REG = createRegistries(contentBundle);

test('cardPlainText returns a plain string with no markup tags', () => {
  for (const cardId of ['frostNova', 'starstoneArc', 'scholarsInsight']) {
    const text = cardPlainText(REG, { cardId });
    assert.equal(typeof text, 'string', `${cardId} gives a string`);
    assert.ok(text.length > 0, `${cardId} has text`);
    assert.doesNotMatch(text, /[<>]/, `${cardId} has no angle brackets`);
  }
});

test('cardPlainText reads the upgraded face: a changed number changes the text', () => {
  const base = cardPlainText(REG, { cardId: 'strike' });
  const upgraded = cardPlainText(REG, { cardId: 'strike', upgraded: true });
  assert.equal(base, 'Deal 6 damage.');
  assert.equal(upgraded, 'Deal 9 damage.');
  assert.notEqual(upgraded, base);
});
