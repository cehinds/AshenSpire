// Owner ruling 2026-11-18 section 20: Gale Push (the owner's "Gale Palm") carries the Retreat tag and the Force tag.
// Its damage is Force (physical, half to Poise) and its moveEngagement effect is the Retreat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reg } from './elementFixture.mjs';
import { ElementOfHit } from '../src/model/elementIdentityRules.js';
import { magicShareOf } from '../src/model/combatRatings.js';

const card = reg.cards.get('core.galePush');

test('Gale Push carries the Retreat tag and the Force tag', () => {
  assert.ok(card.tags.includes('retreat'), 'the Retreat tag');
  assert.ok(card.tags.includes('school:force'), 'the Force tag');
});

test('Gale Push keeps its moveEngagement effect and reads as a Force hit that is physical', () => {
  assert.ok(card.effects.some(effect => effect.op === 'moveEngagement' && effect.bands === 1 && effect.target === 'enemy'));
  assert.equal(ElementOfHit({ tags: card.tags }), 'force');
  assert.equal(magicShareOf({ camp: 'spell', tags: card.tags }), 0);
});

test('every tag on Gale Push is in the tag vocabulary', async () => {
  const { tags } = await import('../src/content/generated/tags.js');
  const ids = new Set(tags.map(tag => tag.id));
  for (const tag of ['retreat', 'school:force']) assert.ok(ids.has(tag), tag);
});

test('Gale Push says it inflicts Retreat on its face and in its tag rail', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { cardSideTags } = await import('../src/ui/components/cardTagSymbols.js');
  const face = (cardFaceLines(card, null, reg) || []).map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  assert.match(face, /Inflict Retreat/, face);
  const rowTags = card.tags.map(id => reg.tags.find(tag => tag.id === id)).filter(Boolean);
  const rail = cardSideTags({ tags: rowTags }, card, reg);
  const retreat = rail.find(tag => tag.id === 'retreat');
  assert.ok(retreat, 'the Retreat tag shows in the rail: ' + rail.map(tag => tag.id).join(','));
  assert.match(retreat.blurb, /Inflicts Retreat/);
  assert.ok(rail.some(tag => tag.id === 'school:force'), 'and the Force tag');
});
