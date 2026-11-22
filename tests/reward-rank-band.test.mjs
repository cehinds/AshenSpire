// Owner 2026-11-21: card and item rewards come from the act's combat-power rank band (model/levelLists.js); the scoring is used only here,
// in level lists and in the card generator, never live in combat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { rollCardRewardIds } from '../src/engine/encounters.js';
import { cardCombatPower } from '../src/content/generated/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed, actNumber = 1) => { const run = createRunState({ seed, classId: 'reaver', registries: reg, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } }); run.actNumber = actNumber; return run; };
const offer = (seed, act) => gameProfileRewardOffers(reg, fresh(seed, act), createRng(seed), { offerId: `t:${seed}:${act}`, source: 'combat', pool: 'normal' });
const cardsOf = (o) => o.options.filter(x => x.kind === 'combatCards').map(x => x.id);
const act1 = scoring.levelLists.tiers[0];
const SEEDS = Array.from({ length: 120 }, (_, i) => i + 1);

test('act 1 offers only Rank 0-3 cards when the band has any', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const id of cardsOf(offer(seed, 1))) {
    const row = cardCombatPower[id]; if (!row) continue; seen.add(id);
    assert.ok(row.rank >= act1.minRank && row.rank <= act1.maxRank, `${id} rank ${row.rank}`);
  }
  assert.ok(seen.size > 5, `only ${seen.size} distinct scored cards seen`);
});

test('a higher act reaches cards the act-1 band hides', () => {
  const high = new Set();
  for (const seed of SEEDS) for (const id of cardsOf(offer(seed, 3))) if (cardCombatPower[id]?.rank > act1.maxRank) high.add(id);
  assert.ok(high.size > 0);
});

test('the same seed gives the same offer', () => {
  for (const seed of [3, 17, 91]) assert.deepEqual(offer(seed, 1).options, offer(seed, 1).options);
});

test('an empty band falls back to the unfiltered pool (legacy door, synthetic registries)', () => {
  const mk = (ids) => ({
    balance: { rewards: { cardChoices: 3, rarityWeights: { normal: { common: 1 } } } },
    classes: { get: () => ({ cardPool: ids }) },
    cards: { get: (id) => ({ id, rarity: 'common' }), all: () => [] },
  });
  const high = Object.keys(cardCombatPower).filter(id => cardCombatPower[id].rank > act1.maxRank).slice(0, 4);
  const low = Object.keys(cardCombatPower).filter(id => cardCombatPower[id].rank <= act1.maxRank).slice(0, 4);
  assert.deepEqual(rollCardRewardIds(mk(high), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' }).every(id => high.includes(id)), true);
  assert.ok(rollCardRewardIds(mk(high), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' }).length > 0);
  const mixed = rollCardRewardIds(mk([...high, ...low]), createRng(5), { classId: 'x', pool: 'normal', tierId: 'act1' });
  assert.ok(mixed.every(id => low.includes(id)));
  const unfiltered = new Set(); for (let s = 1; s <= 40; s++) for (const id of rollCardRewardIds(mk([...high, ...low]), createRng(s), { classId: 'x', pool: 'normal' })) unfiltered.add(id);
  assert.ok(high.some(id => unfiltered.has(id)), 'without tierId the high cards are still offered');
  assert.deepEqual(rollCardRewardIds(mk([...high, ...low]), createRng(9), { classId: 'x', pool: 'normal', tierId: 'act1' }), rollCardRewardIds(mk([...high, ...low]), createRng(9), { classId: 'x', pool: 'normal', tierId: 'act1' }));
});
