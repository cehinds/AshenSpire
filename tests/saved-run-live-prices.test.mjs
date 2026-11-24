// Owner 2026-11-23: new shop prices apply to every run, saved ones included. A run saved on origin/dev (3bcf143a67, before
// the rebalance) pins its profile, shops content and all; its price keys read the current Core values at load, while its
// other pinned shops keys stay as saved. Fixture: a fresh Core run serialized inline on that commit, gzipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { deserializeRun } from '../src/model/state.js';
import { gameContent } from '../src/model/gameProfile.js';
import { blacksmithPrices } from '../src/model/blacksmithConfig.js';
import { CardCopyRule } from '../src/model/cardCopyService.js';
import { RankPricePct } from '../src/model/rankedCardPrice.js';
import { ShopRankUpPrice } from '../src/model/rankUpService.js';

const saved = () => deserializeRun(gunzipSync(readFileSync(new URL('./fixtures/dev-core-save-3bcf143a67.json.gz', import.meta.url))).toString('utf8'));

test('the fixture pins the old prices in its own profile', () => {
  const run = saved();
  const pinned = gameContent(run, 'shops');
  assert.deepEqual(pinned.blacksmith.prices, { tierUpgrade: [60, 100, 150], cardUpgrade: 50, cardUpgradePerUpgrade: 35, cardUpgradePerRank: 25, rankUp: 120 });
  assert.equal(pinned.rankPricePct, undefined);
});

test('a saved run reads the current upgrade, rank-up, copy and rank prices', () => {
  const run = saved();
  assert.deepEqual(blacksmithPrices(run), { tierUpgrade: [180, 300, 450], cardUpgrade: 150, cardUpgradePerUpgrade: 105, cardUpgradePerRank: 75, rankUp: 240 });
  assert.equal(ShopRankUpPrice(run), 240);
  assert.equal(CardCopyRule(run, 'trader').price, 320);
  assert.equal(CardCopyRule(run, 'blacksmith').price, 280);
  assert.equal(RankPricePct(run), 25);
});

test('only the price keys move: the pinned chances and uses stay as saved', () => {
  const run = saved();
  const pinned = gameContent(run, 'shops');
  assert.equal(CardCopyRule(run, 'trader').uses, pinned.cardCopy.uses);
  assert.equal(CardCopyRule(run, 'blacksmith').chancePct, pinned.blacksmith.cardCopy.stockChancePct);
  assert.equal(pinned.blacksmith.prices.cardUpgrade, 50, 'the pinned profile itself is not rewritten');
});
