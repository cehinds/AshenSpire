// Playtest 2026-11-17 item 42: traders vary. Each stocks 3-6 shelves, always armaments, cards and relics; some keep a
// Blacksmith. Seeded per node: the same run and node always answer the same.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { ConfiguredTraderCategories, ConfiguredTraderOffersSmith } from '../src/model/gameProfileShopKind.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(configuredContentBundle(contentBundle, {}), profile)), profile);
const newRun = (seed) => createRunState({ seed, classId: 'reaver', registries, runId: 'trader-variety' });

// The dock a trader shows (screens/shop.js): one tab per kind its stock holds (the rank-up shelf included), then Sell,
// then the Blacksmith when it keeps one. Built from real stock, so a shelf added after the roll is counted too.
// The copy service (owner 2026-11-20) shares the SERVICES tab with a rank-up shelf, so it is one tab with it.
const tabOf = (stock, kind) => (kind === 'cardCopies' && stock.options.some((option) => option.kind === 'rankUps') ? 'rankUps' : kind);
const dockTabs = (run, shopId, stock) => [...new Set(stock.options.map((option) => tabOf(stock, option.kind))), 'sell', ...(ConfiguredTraderOffersSmith(run, shopId) ? ['smith'] : [])];

test('every trader shows 3-6 dock options in all (rank-up shelf, Sell and Blacksmith counted), always armaments, cards and relics', () => {
  const sizes = new Set();
  let smiths = 0, rankUps = 0;
  // Seeds 135 (1:node35) and 162 (1:node62) are the review's repros of a seventh tab (#2817, round 2).
  for (let n = 0; n < 400; n += 1) {
    const run = newRun(100 + n);
    const shopId = `1:node${n}`;
    const stock = gameProfileShopStock(registries, run, createRng(run.seed), { shopId });
    const tabs = dockTabs(run, shopId, stock);
    assert.ok(tabs.length >= 3 && tabs.length <= 6, `seed ${100 + n} ${shopId}: ${tabs.length} options (${tabs.join(', ')})`);
    for (const kind of ['weapons', 'combatCards', 'relics']) assert.ok(tabs.includes(kind), `seed ${100 + n}: ${kind} is always stocked`);
    // A fresh run with the same seed rolls the node again from nothing (no saved offer to read back), so the
    // dock is proved to come from the seed and the node, not from the cache.
    const twin = newRun(100 + n);
    assert.equal(twin.gameProfileRewardOffers?.[`shop:${shopId}`], undefined, 'the twin has no saved offer');
    const again = gameProfileShopStock(registries, twin, createRng(twin.seed), { shopId });
    assert.deepEqual(dockTabs(twin, shopId, again), tabs, 'seeded: the same run and node roll the same dock');
    sizes.add(tabs.length);
    if (tabs.includes('smith')) smiths += 1;
    if (tabs.includes('rankUps')) rankUps += 1;
  }
  assert.ok(sizes.size > 1, 'traders differ in how many options they show');
  assert.ok(smiths > 0 && smiths < 400, 'some traders, not all, keep a Blacksmith');
  assert.ok(rankUps > 0, 'the rank-up shelf is among the probed docks');
});

test('a stock saved before traders varied is held to the 3-6 options rule (Sell counted)', async () => {
  const { ConfiguredTraderDock } = await import('../src/model/gameProfileShopKind.js');
  const run = newRun(7);
  const every = ['weapons', 'relics', 'combatCards', 'weaponArts', 'potions', 'armor', 'rankUps'];
  for (const smith of [false, true]) {
    const dock = ConfiguredTraderDock(run, every, { smith });
    const options = dock.kinds.length + 1 + (dock.smith ? 1 : 0);
    assert.ok(options >= 3 && options <= 6, `${options} options`);
    for (const kind of ['weapons', 'combatCards', 'relics']) assert.ok(dock.kinds.includes(kind), `${kind} stays`);
    assert.equal(dock.smith, false, 'a full old dock has no room for the Blacksmith');
  }
  const fresh = ConfiguredTraderDock(run, ['weapons', 'relics', 'combatCards'], { smith: true });
  assert.deepEqual(fresh, { kinds: ['weapons', 'relics', 'combatCards'], smith: true }, 'a dock that fits comes back whole');
});
