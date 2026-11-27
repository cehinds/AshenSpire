import test from 'node:test';
import assert from 'node:assert/strict';
import { SpellCategory, SpellScalingValue, SpellTraditionLabel } from '../src/model/spellTraditions.js';

const spell = (school, extraTags = []) => ({
  id: 'spell-category-probe', tags: ['camp:spell', ...(school ? ['school:' + school] : []), ...extraTags],
});

test('the school decides the spell category', () => {
  for (const school of ['force', 'alteration', 'illusion']) assert.equal(SpellCategory(spell(school)), 'arcane', school);
  for (const school of ['divine', 'decay']) assert.equal(SpellCategory(spell(school)), 'divine', school);
  for (const school of ['fire', 'frost', 'lightning', 'earth']) assert.equal(SpellCategory(spell(school)), 'shared', school);
});

test('a schoolless spell is a plain Spell that still scales with max(INT, WIS)', () => {
  const card = spell(null);
  assert.equal(SpellCategory(card), null);
  assert.equal(SpellTraditionLabel(card), 'Spell');
  assert.equal(SpellScalingValue({ intelligence: 3, wisdom: 9 }, card), 9);
  assert.equal(SpellScalingValue({ intelligence: 9, wisdom: 3 }, card), 9);
});

test('every school source and explicit tradition tags count', () => {
  assert.equal(SpellCategory({ combatProfile: { school: 'force' } }), 'arcane');
  assert.equal(SpellCategory({ school: 'decay' }), 'divine');
  assert.equal(SpellCategory({ damageSchool: 'fire' }), 'shared');
  assert.equal(SpellCategory(spell(null, ['tradition:divine'])), 'divine');
  assert.equal(SpellCategory(spell(null, ['tradition:arcane', 'tradition:divine'])), 'shared');
  assert.equal(SpellTraditionLabel(spell('fire')), 'Spell');
  assert.equal(SpellTraditionLabel(spell('force')), 'Arcane');
  assert.equal(SpellTraditionLabel(spell('decay')), 'Divine');
});

test('a profile stamps tradition tags on schooled Spells only, so a schoolless Spell stays plain', async () => {
  const { CardTraditionTags } = await import('../src/model/spellTraditions.js');
  assert.deepEqual(CardTraditionTags(spell(null)), []);
  assert.deepEqual(CardTraditionTags(spell('fire')), ['tradition:arcane', 'tradition:divine']);
  assert.deepEqual(CardTraditionTags(spell('decay')), ['tradition:divine']);
});
