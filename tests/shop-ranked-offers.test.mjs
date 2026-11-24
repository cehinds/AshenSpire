// Owner 2026-11-23: Core shops sometimes stock ranked cards (shops.json rankedOfferChancePct: 20% Rank 1, 5% Rank 2). The
// roll is a hash of the run seed and the offer slot (no stream moves); the price reads the rank (+25% per rank), and the
// bought card keeps it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { gameProfileShopStock, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { ShopOfferRankChances, RollShopOfferRank } from '../src/model/shopOfferRank.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = (seed = 5) => createRunState({ seed, classId: 'reaver', registries: reg, runId: `ranked-offers-${seed}` });

test('the data holds the owner numbers: 20% Rank 1, 5% Rank 2', () => {
  assert.deepEqual(ShopOfferRankChances(fresh()), [[2, 5], [1, 20]]);
});

test('over many offer slots about 20% arrive at Rank 1 and 5% at Rank 2, the same every time asked', () => {
  const run = fresh(11), counts = { 0: 0, 1: 0, 2: 0 }, N = 4000;
  for (let n = 0; n < N; n += 1) {
    const rank = RollShopOfferRank(run, `k${n}`);
    assert.equal(RollShopOfferRank(run, `k${n}`), rank, 'stable');
    counts[rank] += 1;
  }
  assert.ok(Math.abs(counts[1] / N - 0.20) < 0.03, `Rank 1 ${counts[1]}`);
  assert.ok(Math.abs(counts[2] / N - 0.05) < 0.02, `Rank 2 ${counts[2]}`);
});

function rankedShop(run) {
  for (let n = 0; n < 200; n += 1) {
    const shopId = `1:r${n}`;
    const stock = gameProfileShopStock(reg, run, createRng(run.seed), { shopId });
    const index = stock.options.findIndex((option) => option.kind === 'combatCards' && option.rank > 0);
    if (index >= 0) return { shopId, stock, index };
  }
  return assert.fail('no shop stocked a ranked card in 200 tries');
}

test('a ranked card offer costs +25% per rank, keeps its rank on a revisit, and the bought card is ranked', () => {
  const run = fresh(7);
  run.cinders = 100000;
  const { shopId, stock, index } = rankedShop(run);
  const option = stock.options[index];
  const range = gameContent(run, 'shops').priceTable.card[reg.cards.get(option.id).rarity];
  const factor = 1 + 0.25 * option.rank;
  assert.ok(option.price >= Math.round(range[0] * factor) && option.price <= Math.round(range[1] * factor), `${option.price} for Rank ${option.rank}`);
  const again = gameProfileShopStock(reg, run, createRng(run.seed), { shopId });
  assert.deepEqual(again.options[index], option, 'the saved stock keeps the rank and price');
  const plan = gameProfileShopPurchasePlan(reg, run, shopId, index);
  assert.ok(plan.ok, plan.reason);
  const receipt = purchaseGameProfileShopOffer(reg, run, shopId, index, createRng(1), plan);
  const bought = run.sideboard.find((card) => card.instanceId === receipt.instanceId);
  assert.equal(bought.rank, option.rank);
  const loaded = deserializeRun(serializeRun(run));
  assert.deepEqual(validateRunShape(loaded), [], 'a ranked offer and card survive save and load');
});
