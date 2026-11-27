// Mechanics use a tiny independent pool; today's spells are checked against JSON
// in core-new-spells.test.mjs. Old wave rarity/count/dominance targets are balance choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, gameProfileRewardPools, cardPickWeight } from '../src/model/gameProfileRewards.js';
import { basicOrCantripMatcher } from '../src/model/stanceCoverage.js';

const definition = (id, extra = {}) => ({ id, name: id, class: 'starseer', type: 'attack', rarity: 'common',
  cost: 1, manaCost: 0, effects: [], keywords: [], tags: ['camp:physical'], ...extra });
const cards = [
  definition('fixture.basic'),
  definition('fixture.mana', { manaCost: 1 }),
  definition('fixture.dear', { manaCost: 4 }),
  definition('fixture.foreign', { class: 'herald' }),
  definition('fixture.shared', { class: 'colorless', manaCost: 1 }),
  definition('fixture.retired'),
];
const byId = new Map(cards.map(row => [row.id, row]));
const registries = { cards: { get: id => byId.get(id), has: id => byId.has(id) },
  relics: { all: () => [] }, flasks: { all: () => [] }, equipment: {} };
function fresh(seed = 1, floor = 1) {
  return { seed, floor, class: 'starseer', maxMana: 2, relics: [], flasks: [], deck: [], sideboard: [],
    loadout: { storage: [], sets: {} },
    gameProfile: { formatVersion: 1,
      modules: { cards: { mode: 'configured' }, rewards: { mode: 'configured' }, resources: { include: ['sp', 'mp'] } },
      content: { cards: structuredClone(cards), stats: { poolBasesByClass: { starseer: { mana: 1 } } },
        cardPools: { basics: { byTag: { attack: 'fixture.basic' } } },
        rewards: { offerCount: 1, takeCount: 1, categories: ['combatCards'],
          eligibility: { playableOnly: true, excludeCardIds: ['fixture.retired'], weaponArts: { cardIds: [] },
            combatCards: { skipOwned: true, ownedCopyWeight: 0.1, minRank: 1, rankOfRarity: { common: 1 },
              lowerRankChance: 0, tagWeights: { default: 1 }, typeWeights: { attack: 1 }, recentOfferWindow: 0,
              stanceCoverage: { enabled: false, reservedSlots: 0, excludePools: ['special'] },
              depthBias: { earlyMaxDepth: 3, early: { basicOrCantrip: 4, mana: 0.25 }, late: { mana: 4, highRankMin: 2, highRank: 1 } },
            },
          },
        },
      },
    },
  };
}
const offer = (run, rng = createRng(run.seed)) => gameProfileRewardOffers(registries, run, rng, { offerId: 'fixture' });

test('reward eligibility enforces class, affordability, retirement and current ownership', () => {
  const run = fresh();
  assert.deepEqual(gameProfileRewardPools(registries, run).combatCards, ['fixture.basic', 'fixture.mana', 'fixture.shared']);
  run.maxMana = 0;
  assert.deepEqual(gameProfileRewardPools(registries, run).combatCards, ['fixture.basic']);
  run.maxMana = 4;
  run.deck.push({ cardId: 'fixture.mana', instanceId: 'owned' });
  assert.deepEqual(gameProfileRewardPools(registries, run).combatCards, ['fixture.basic', 'fixture.dear', 'fixture.shared']);
  run.sideboard.push({ cardId: 'fixture.shared', instanceId: 'library' });
  assert.deepEqual(gameProfileRewardPools(registries, run).combatCards, ['fixture.basic', 'fixture.dear']);
});

test('basic/cantrip matching follows pools and tags rather than the mana price', () => {
  const run = fresh();
  const matches = basicOrCantripMatcher(registries, run);
  assert.equal(matches('fixture.basic'), true);
  assert.equal(matches('fixture.mana'), false);
  run.gameProfile.content.cardPools.basics.byTag.spell = 'fixture.mana';
  assert.equal(basicOrCantripMatcher(registries, run)('fixture.mana'), true);
});

test('explicit depth weights favor basic cards early and mana cards late', () => {
  const sample = floor => {
    let mana = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const picked = offer(fresh(seed, floor), createRng(seed + 50000)).options[0];
      assert.ok(['fixture.basic', 'fixture.mana', 'fixture.shared'].includes(picked.id));
      if (byId.get(picked.id).manaCost > 0) mana++;
    }
    return mana;
  };
  const early = sample(3), late = sample(4);
  assert.ok(early > 0 && early < 400, 'early bias keeps both kinds reachable');
  assert.ok(late > early, `late ${late} > early ${early}`);
  assert.ok(late < 400, 'late bias keeps basics reachable');
});

test('tag and repeated ownership weights multiply with explicit operands', () => {
  const rule = { tagWeights: { a: 2, b: 3, default: 1 }, ownedCopyWeight: 0.1 };
  assert.equal(cardPickWeight(rule, { tags: ['a', 'b'] }, 0), 6);
  assert.ok(Math.abs(cardPickWeight(rule, { tags: ['a', 'b'] }, 2) - 0.06) < 1e-12);
  assert.equal(cardPickWeight({}, { tags: [] }, 4), 1);
});

test('reward sampling is deterministic, cached and leaves authored definitions untouched', () => {
  const run = fresh(7, 4), before = JSON.stringify(run.gameProfile), first = offer(run);
  assert.deepEqual(first, offer(fresh(7, 4)));
  assert.equal(offer(run, { pick: () => assert.fail('cache drew RNG'), float: () => assert.fail('cache drew RNG') }), first);
  assert.equal(JSON.stringify(run.gameProfile), before);
  assert.deepEqual(run.rewardOfferHistory.cards, { [first.options[0].id]: 1 }, 'cached reads do not count another showing');
  const resumed = structuredClone(run);
  assert.deepEqual(offer(resumed), first, 'a saved offer keeps its definitions');
});
