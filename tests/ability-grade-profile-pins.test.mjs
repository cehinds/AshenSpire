// Pins every ability card's grade profiles, except Feint, to hashes captured
// before the opt-in `alwaysRiders` recipe flag existed. Changing one recipe
// must leave every other recipe's authored profiles byte-identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { abilityCardUpdates } from '../src/content/progression/cards.js';

const pinned = JSON.parse(readFileSync(new URL('./fixtures/ability-grade-profile-hashes.json', import.meta.url), 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('every non-Feint ability card keeps its pre-flag grade profiles byte-for-byte', () => {
  const cards = abilityCardUpdates.filter(c => c.id !== 'feint');
  assert.deepEqual(cards.map(c => c.id).sort(), Object.keys(pinned).sort());
  for (const card of cards) assert.equal(hash(card.gradeProfiles), pinned[card.id], card.id);
});
