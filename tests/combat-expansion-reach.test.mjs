import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

// v2 spell range follows the delivery tag unless an expansion row or the ranged list sets it.
const registries = createRegistries(contentBundle);
const expanded = cardId => applyCombatExpansionCard(resolveCard(registries, { cardId }));

test('projectile spells are ranged and melee spells are melee under v2', () => {
  assert.equal(expanded('cometFragment').range, 'ranged');
  assert.equal(expanded('starstonePebble').range, 'ranged');
  assert.equal(expanded('starlance').range, 'ranged');
  assert.equal(expanded('starbladePhalanx').range, 'melee');
  assert(expanded('cometFragment').tags.includes('range:ranged'));
  assert(expanded('starbladePhalanx').tags.includes('range:melee'));
});

test('area spells keep reach range with area targeting under v2', () => {
  for (const cardId of ['frostNova', 'supernova']) {
    const card = expanded(cardId);
    assert.equal(card.range, 'reach', cardId);
    assert.equal(card.targeting, 'area', cardId);
  }
});

test('an equipment row range wins over its projectile delivery tag', () => {
  const card = applyCombatExpansionCard(resolveCard(registries, { cardId: 'strike', profileId: 'staffMagicAttack' }));
  assert.equal(card.range, 'reach');
  assert(card.tags.includes('delivery:projectile'));
  assert(card.tags.includes('range:reach'));
});

test('an authored range wins over the ranged list and the delivery tag under v2', () => {
  // rimeNeedle is authored range:reach.
  assert.equal(expanded('rimeNeedle').range, 'reach');
  // A range:melee tag beats cometFragment's ranged-list range.
  const base = resolveCard(registries, { cardId: 'cometFragment' });
  const tagged = [...(base.cardTags || base.tags || []).filter(tag => !tag.startsWith('range:')), 'range:melee'];
  assert.equal(applyCombatExpansionCard({ ...base, tags: tagged, cardTags: tagged }).range, 'melee');
  // An authored range: 'reach' beats a projectile delivery and the ranged list.
  assert.equal(applyCombatExpansionCard({ ...base, range: 'reach' }).range, 'reach');
});

test('an untagged spell attack is Reach on the card face and in the Advance math; an explicit range:melee stays melee', async () => {
  const { combatCardRange, defaultRangeFor } = await import('../src/model/combatCardProfile.js');
  const { rangeSourceContact } = await import('../src/engine/combatEngagement.js');
  const { live } = await import('./helpers/fixcore-combat-rules.mjs');
  const spell = { id: 'x', type: 'attack', tags: ['camp:spell', 'maneuver:casting', 'school:fire', 'damage:fire'], effects: [{ op: 'damage', target: 'enemy', amount: 4 }] };
  assert.equal(combatCardRange(spell), 'reach');
  assert.equal(combatCardRange({ ...spell, tags: [...spell.tags, 'range:melee'] }), 'melee');
  assert.equal(defaultRangeFor({ camp: 'weapon' }), 'melee');
  const ctx = live();
  const carrier = { tags: spell.tags, combatProfile: { camp: 'spell', maneuver: 'casting' }, resolvedRangeSource: { sourceType: 'spell' } };
  assert.equal(rangeSourceContact(ctx, ctx.player, ctx.enemies[0], carrier, { op: 'damage' }).coverage, 'reach');
  const melee = { ...carrier, tags: [...spell.tags, 'range:melee'], combatProfile: { camp: 'spell', maneuver: 'casting', range: 'melee' } };
  assert.equal(rangeSourceContact(ctx, ctx.player, ctx.enemies[0], melee, { op: 'damage' }).coverage, 'melee');
});
