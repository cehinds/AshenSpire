import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';

const cards = new Map(contentBundle.cards.map(card => [card.id, card]));
const buildupStatuses = effects => (effects || []).filter(effect => effect.op === 'buildup').map(effect => effect.status);

test('a damaging decay spell fills only the Necrotic Blight gauge, never Crimson Blight', () => {
  const card = applyCombatExpansionCard(cards.get('flagellation'));
  const statuses = buildupStatuses(card.effects);
  assert.equal(statuses.filter(status => status === 'necroticBlight').length, 1);
  assert.equal(statuses.includes('crimsonBlight'), false);
  const upgraded = buildupStatuses(card.upgrade.effects);
  assert.equal(upgraded.filter(status => status === 'necroticBlight').length, 1);
  assert.equal(upgraded.includes('crimsonBlight'), false);
});

test('the decay spell rider uses the curse recovery profile', () => {
  const card = applyCombatExpansionCard(cards.get('flagellation'));
  const rider = card.effects.find(effect => effect.op === 'buildup' && effect.status === 'necroticBlight');
  assert.equal(rider.recoveryProfile, 'curse');
});

test('a card that prints Crimson Blight keeps its printed Crimson Blight buildup', () => {
  const card = applyCombatExpansionCard(cards.get('rotMote'));
  assert.ok(buildupStatuses(card.effects).includes('crimsonBlight'));
});
