// Card upgrades UI 3/5: in a Core run the Blacksmith's upgradeArt service upgrades any deck card through the card-upgrade
// service (no stones at the Blacksmith, 40 cinders each; no per-visit limit), and ~25% of Core shop nodes are a Blacksmith.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { shops as shippedShops } from '../src/content/shops.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { upgradeArtPlan, commitUpgradeArt, upgradeableArts, serviceIdleReason, serviceCandidates } from '../src/model/blacksmith.js';
import { upgradeCount } from '../src/model/cardUpgrade.js';
import { configuredShopIsBlacksmith, configuredShopBlacksmithChance } from '../src/model/gameProfileShopKind.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));

function smithRun(registries, stones, seed = 31, cinders = 2000) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'bs-cards' });
  run.smithingStones = stones;
  run.cinders = cinders;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  return run;
}
const strikes = (run) => run.deck.filter((c) => c.cardId === 'core.strike');
const upgrade = (run, instanceId) => {
  const plan = upgradeArtPlan(coreOut, run, instanceId);
  assert.equal(plan.ok, true, plan.reason);
  return commitUpgradeArt(coreOut, run, plan);
};

test('Core Blacksmith: any deck card upgrades for cinders and no stones, even past the free allowance', () => {
  const run = smithRun(coreOut, 0);
  const card = strikes(run)[0];
  const first = upgrade(run, card.instanceId);
  assert.deepEqual([first.n, first.spentStones, run.smithingStones, run.cinders], [1, 0, 0, 1960]);
  // A rest site charges 1 stone for this second upgrade; the Blacksmith takes one stone off, so 0.
  const second = upgrade(run, card.instanceId);
  assert.deepEqual([second.n, second.spentStones, run.smithingStones, run.cinders], [2, 0, 0, 1920]);
  assert.equal(upgradeCount(card), 2);
  assert.deepEqual(card.upgradeSteps, [first.step, second.step]);
});

test('Core Blacksmith: no per-visit limit; the player upgrades while they can pay cinders, and a short purse is refused', () => {
  const run = smithRun(coreOut, 3, 31, 200);
  const [a, b, c] = strikes(run);
  for (const card of [a, b, c, a, a]) upgrade(run, card.instanceId);
  assert.equal(run.smithingStones, 3, 'the stones are never touched');
  assert.equal(run.cinders, 0, 'five upgrades at 40 cinders');
  assert.equal(upgradeCount(a), 3);
  const refused = upgradeArtPlan(coreOut, run, a.instanceId);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /cinders/i);
  assert.throws(() => commitUpgradeArt(coreOut, run, refused));
  assert.equal(upgradeCount(a), 3);
  assert.equal(run.cinders, 0);
});

test('Core Blacksmith: the 10-upgrade cap refuses and the card drops out of the list', () => {
  const run = smithRun(coreOut, 50);
  const card = strikes(run)[0];
  card.upgraded = true; card.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
  const plan = upgradeArtPlan(coreOut, run, card.instanceId);
  assert.equal(plan.ok, false);
  assert.ok(!upgradeableArts(coreOut, run).some((row) => row.instanceId === card.instanceId));
});

test('Core Blacksmith: a stale quote (changed roll) is refused and spends nothing', () => {
  const run = smithRun(coreOut, 2);
  const card = strikes(run)[0];
  const plan = upgradeArtPlan(coreOut, run, card.instanceId);
  const stale = { ...plan, cardQuote: { ...plan.cardQuote, step: { k: 'dmg', n: 99 } } };
  assert.throws(() => commitUpgradeArt(coreOut, run, stale), /out of date/);
  assert.equal(upgradeCount(card), 0);
  assert.equal(run.smithingStones, 2);
  assert.equal(run.cinders, 2000);
});

test('Core Blacksmith: the idle line is the card one when nothing can be upgraded', () => {
  const run = smithRun(coreOut, 0);
  assert.match(serviceIdleReason('upgradeArt', run), /card/i);
});

test('Legacy Blacksmith upgradeArt is unchanged: only a loose weapon art with an authored upgrade', () => {
  const run = smithRun(legacyOut, 5);
  const plain = run.deck[0];
  const plan = upgradeArtPlan(legacyOut, run, plain.instanceId);
  assert.equal(plan.ok, false);
  assert.equal(plan.cardQuote, undefined);
});

test('about 25% of Core shop nodes are a Blacksmith, decided per node and the same every time; Legacy never', () => {
  const run = createRunState({ seed: 91, classId: 'reaver', registries: coreOut, runId: 'shop-kind' });
  assert.equal(configuredShopBlacksmithChance(run), 25);
  let hits = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const a = configuredShopIsBlacksmith(run, `1:node-${i}`);
    assert.equal(a, configuredShopIsBlacksmith(run, `1:node-${i}`));
    if (a) hits++;
  }
  assert.ok(hits / N > 0.21 && hits / N < 0.29, `share ${hits / N}`);
  const legacy = createRunState({ seed: 91, classId: 'reaver', registries: legacyOut, runId: 'shop-kind-l' });
  assert.equal(configuredShopBlacksmithChance(legacy), 0);
  assert.equal(configuredShopIsBlacksmith(legacy, '1:node-1'), false);
});

test('configuredShopKind (the call showShop makes): a saved merchandise offer stays a shop, an open Blacksmith stays one', async () => {
  const { configuredShopKind } = await import('../src/model/gameProfileShopKind.js');
  const run = createRunState({ seed: 91, classId: 'reaver', registries: coreOut, runId: 'shop-kind-saved' });
  const hashed = Array.from({ length: 400 }, (_, i) => `1:n${i}`).find((id) => configuredShopIsBlacksmith(run, id));
  assert.ok(hashed, 'some node hashes to a Blacksmith');
  assert.equal(configuredShopKind(run, hashed), 'blacksmith');
  // A save taken mid-shop already holds this node's merchandise offer: it must not flip to a Blacksmith.
  run.gameProfileRewardOffers = { [`shop:${hashed}`]: { source: 'shop', options: [] } };
  assert.equal(configuredShopKind(run, hashed), 'merchant');
  // An open Blacksmith visit stays one, saved offer or not.
  run.shopStock = { kind: 'blacksmith' };
  assert.equal(configuredShopKind(run, hashed), 'blacksmith');
  // A market-kind stock never turns into a Blacksmith.
  run.shopStock = { kind: 'market' }; delete run.gameProfileRewardOffers;
  assert.equal(configuredShopKind(run, hashed), 'merchant');
});

test('main.js showShop asks configuredShopKind (the roll is wired, not dropped)', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /configuredShopKind\(run, shopId\) === 'blacksmith'/);
});

test('a Core Blacksmith offers no extract or install service, and the commits refuse without touching the deck', async () => {
  const { blacksmithExtractPlan, commitBlacksmithExtract, blacksmithInstallPlan, commitBlacksmithInstall } = await import('../src/model/blacksmith.js');
  const { shopStockOfferings } = await import('../src/model/shopKinds.js');
  const run = smithRun(coreOut, 3);
  const offered = shopStockOfferings(run.shopStock);
  assert.ok(!offered.includes('extractArt') && !offered.includes('installArt'));
  assert.ok(offered.includes('upgradeArt') && offered.includes('upgrade'), 'equipment and card upgrades stay');
  // Even a stock forged (or saved by an older build) with the services cannot commit them.
  run.shopStock.offerings = [...run.shopStock.offerings, 'extractArt', 'installArt'];
  const deck = JSON.stringify(run.deck), sideboard = JSON.stringify(run.sideboard), mounts = JSON.stringify(run.itemMounts || null);
  const ex = blacksmithExtractPlan(coreOut, run, 'armament/greatsword', 'any');
  assert.equal(ex.ok, false);
  assert.throws(() => commitBlacksmithExtract(coreOut, run, ex));
  const inst = blacksmithInstallPlan(coreOut, run, 'armament/greatsword', 'any', run.deck[0].instanceId);
  assert.equal(inst.ok, false);
  assert.throws(() => commitBlacksmithInstall(coreOut, run, inst));
  assert.deepEqual([JSON.stringify(run.deck), JSON.stringify(run.sideboard), JSON.stringify(run.itemMounts || null)], [deck, sideboard, mounts]);
  // Legacy keeps both services.
  const legacy = smithRun(legacyOut, 3);
  assert.ok(shopStockOfferings(legacy.shopStock).includes('extractArt'));
});

test('Core Blacksmith: a sideboard card plans and commits an upgrade, and a sideboard-only candidate counts', () => {
  const run = smithRun(coreOut, 3);
  const [moved] = run.deck.splice(run.deck.findIndex((c) => c.cardId === 'core.strike'), 1);
  run.sideboard = [moved];
  assert.ok(upgradeableArts(coreOut, run).some((c) => c.instanceId === moved.instanceId), 'sideboard card is an upgrade candidate');
  upgrade(run, moved.instanceId);
  assert.equal(upgradeCount(run.sideboard[0]), 1);
  // Only sideboard cards upgradable: empty the deck of candidates by moving every card across.
  run.sideboard = [...run.sideboard, ...run.deck.splice(0)];
  assert.equal(run.deck.length, 0);
  assert.ok(upgradeableArts(coreOut, run).length > 0);
  assert.ok(serviceCandidates(coreOut, run, "upgradeArt").length > 0, "the Blacksmith button counts sideboard-only candidates");
});
