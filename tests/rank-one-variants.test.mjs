// Owner 2026-11-23: a stored rank 1 is a real rank (an unranked card ranks up to Rank 1), so every "has a rank" check reads
// OwnCardRank > 0, never rank > 1. A Rank 1 copy is its own variant, is kept like any enhanced card, rides into combat with
// its rank, and a rank-up preview shows the rank the commit lands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat } from '../src/engine/combat.js';
import { cardVariantKey } from '../src/model/cardGroups.js';
import { deckVariantKey } from '../src/ui/models/DeckEditorModel.js';
import { isSetAsideBasic, isUnlimitedBasic } from '../src/model/deckRules.js';

const plain = { instanceId: 'a', cardId: 'core.strike', upgraded: false };
const rankOne = { ...plain, instanceId: 'b', rank: 1 };

test('a Rank 1 copy is a variant of its own, apart from an unranked one', () => {
  assert.notEqual(cardVariantKey(plain), cardVariantKey({ ...rankOne, instanceId: 'a' }));
  assert.notEqual(deckVariantKey(plain), deckVariantKey(rankOne));
  assert.equal(cardVariantKey(plain), cardVariantKey({ ...plain, instanceId: 'z' }), 'two unranked copies still group');
});

test('a Rank 1 unlimited Basic is kept like an enhanced card, never treated as pristine', () => {
  const strike = { instanceId: 's1', cardId: 'strike', upgraded: false };
  assert.equal(isUnlimitedBasic(strike, null), true, 'a Legacy Strike is an unlimited Basic');
  assert.equal(isSetAsideBasic(strike, null), false, 'an unranked Strike is a plain Basic');
  assert.equal(isSetAsideBasic({ ...strike, rank: 1 }, null), true, 'a Rank 1 Strike is kept');
});

test('a combat built from the deck keeps a stored Rank 1', () => {
  const base = createRegistries(contentBundle);
  const player = { id: 'p1', classId: 'reaver', maxHp: 80, hp: 80, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 5, relicIds: [],
    deck: Array.from({ length: 10 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'strike', upgraded: false, ...(i === 0 ? { rank: 1 } : {}) })) };
  const combat = createCombat({ registries: base, rng: createRng(9), player, enemyIds: ['wanderingSoldier'] });
  const zones = Object.values(combat.piles || {}).filter(Array.isArray).flat();
  const found = zones.find((card) => card.instanceId === 'd0');
  assert.ok(found, 'the card is in a pile');
  assert.equal(found.rank, 1);
});
