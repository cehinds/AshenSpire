import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { combatCardRange } from '../src/model/combatCardProfile.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { cardDetailHtml, cardPlainText } from '../src/ui/components/card.js';

const registries = createRegistries(contentBundle);
const rules = { combatExpansionVersion: 2, reactionRulesVersion: 2, breakMeterVersion: 2 };
test('compact and inspection use the same projected Counter definition and canonical identity', () => {
  const ref = { cardId: 'fireCounter' };
  const compact = cardPlainText(registries, ref, { rules });
  const detail = cardDetailHtml(registries, ref, { rules });
  assert.match(compact, /Gain 5 Barrier/);
  assert.match(detail, /SPELL · Prepare/);
  assert.match(detail, /Counter coverage:.*Spell/);
  assert.match(detail, /Defense range:.*Ranged/);
  assert.equal(combatCardRange(playingCardDefinition(registries, ref, { rules })), 'reach');
  assert.match(detail.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), /Spell counter Reach/);
  assert.match(detail, /Prepare a fire Counter: 2 Ward return/);
  assert.match(detail, /Return once after all covered damage and status pressure is resisted/);
});
test('inspection keeps the live Barrier stack count (no Block/Ward split)', () => {
  const ref = { cardId: 'fireCounter' };
  const preview = { cost: 1, manaCost: 0, staminaCost: 0, tokens: { gainBarrier: 11, 'gainBarrier.block': 5, 'gainBarrier.ward': 6 } };
  const detail = cardDetailHtml(registries, ref, { rules, preview });
  assert.match(detail, /11.*Barrier/);
  assert.match(cardPlainText(registries, ref, { rules, preview }), /11 Barrier/);
});

test('version-two Poise-only Counter returns show their offensive range', () => {
  const force = playingCardDefinition(registries, { cardId: 'forceCounter' }, { rules });
  assert.equal(force.counterPayload.hp, 0);
  assert.equal(force.counterPayload.ward, 0);
  assert.equal(combatCardRange(force), 'reach');
  assert.equal(combatCardRange({ ...force, defenseRulesVersion: undefined }), null, 'legacy Poise-only presentation is unchanged');
  assert.equal(combatCardRange({ ...force, counterPayload: { hp: 0, ward: 0, poise: 0 } }), null, 'protection without a reply has no offensive range');
});
