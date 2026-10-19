// A typo'd placeholder in a card's wardOffTextTemplate must fail validation, not render raw on Core faces.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';

const withTemplate = (id, wardOffTextTemplate) => ({ ...contentBundle, cards: contentBundle.cards.map(c => c.id === id ? { ...c, wardOffTextTemplate } : c) });
const authored = contentBundle.cards.filter(c => typeof c.wardOffTextTemplate === 'string');

test('the shipped wardOffTextTemplate cards validate', () => {
  assert.ok(authored.length >= 2);
  const result = validateContent(contentBundle);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('a typo in wardOffTextTemplate fails validation; {poiseDamage} is allowed', () => {
  const id = authored[0].id;
  const bad = validateContent(withTemplate(id, 'Deal {poiseDamge}'));
  assert.equal(bad.ok, false);
  assert.ok(JSON.stringify(bad.errors).includes('poiseDamge'));
  const good = validateContent(withTemplate(id, 'Deal {poiseDamage} Poise damage.'));
  assert.equal(good.ok, true, JSON.stringify(good.errors));
});
