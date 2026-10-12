import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

// v2 spell reach follows the delivery tag unless an expansion row or the far list sets it.
const registries = createRegistries(contentBundle);
const expanded = cardId => applyCombatExpansionCard(resolveCard(registries, { cardId }));

test('projectile spells reach far and melee spells reach contact under v2', () => {
  assert.equal(expanded('cometFragment').reach, 'far');
  assert.equal(expanded('starstonePebble').reach, 'far');
  assert.equal(expanded('starlance').reach, 'far');
  assert.equal(expanded('starbladePhalanx').reach, 'contact');
  assert(expanded('cometFragment').tags.includes('reach:far'));
  assert(expanded('starbladePhalanx').tags.includes('reach:contact'));
});

test('area spells keep near reach with area targeting under v2', () => {
  for (const cardId of ['frostNova', 'supernova']) {
    const card = expanded(cardId);
    assert.equal(card.reach, 'near', cardId);
    assert.equal(card.targeting, 'area', cardId);
  }
});

test('an equipment row reach wins over its projectile delivery tag', () => {
  const card = applyCombatExpansionCard(resolveCard(registries, { cardId: 'strike', profileId: 'staffMagicAttack' }));
  assert.equal(card.reach, 'near');
  assert(card.tags.includes('delivery:projectile'));
  assert(card.tags.includes('reach:near'));
});

test('an authored reach wins over the far list and the delivery tag under v2', () => {
  // rimeNeedle is authored reach:near.
  assert.equal(expanded('rimeNeedle').reach, 'near');
  // A reach:contact tag beats cometFragment's far-list reach.
  const base = resolveCard(registries, { cardId: 'cometFragment' });
  const tagged = [...(base.cardTags || base.tags || []).filter(tag => !tag.startsWith('reach:')), 'reach:contact'];
  assert.equal(applyCombatExpansionCard({ ...base, tags: tagged, cardTags: tagged }).reach, 'contact');
  // An authored reach:near beats a projectile delivery and the far list.
  assert.equal(applyCombatExpansionCard({ ...base, reach: 'near' }).reach, 'near');
});
