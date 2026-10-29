// Card upgrades UI 3/5: in a Core run the Blacksmith's upgradeArt service upgrades any deck card through the card-upgrade
// service (Free, then 1 Smithing Stone; no per-visit limit), and ~25% of Core shop nodes are a Blacksmith.
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
import { upgradeArtPlan, commitUpgradeArt, upgradeableArts, serviceIdleReason } from '../src/model/blacksmith.js';
import { upgradeCount } from '../src/model/cardUpgrade.js';
import { configuredShopIsBlacksmith, configuredShopBlacksmithChance } from '../src/model/gameProfileShopKind.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));

function smithRun(registries, stones, seed = 31) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'bs-cards' });
  run.smithingStones = stones;
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

test('Core Blacksmith: any deck card upgrades; the first upgrade is free, the second costs a stone', () => {
  const run = smithRun(coreOut, 1);
  const card = strikes(run)[0];
  const first = upgrade(run, card.instanceId);
  assert.deepEqual([first.n, first.spentStones, run.smithingStones], [1, 0, 1]);
  const second = upgrade(run, card.instanceId);
  assert.deepEqual([second.n, second.spentStones, run.smithingStones], [2, 1, 0]);
  assert.equal(upgradeCount(card), 2);
  assert.deepEqual(card.upgradeSteps, [first.step, second.step]);
});

test('Core Blacksmith: no per-visit limit; the player upgrades while they can pay, and a short purse is refused', () => {
  const run = smithRun(coreOut, 3);
  const [a, b, c] = strikes(run);
  for (const card of [a, b, c, a, a]) upgrade(run, card.instanceId);
  assert.equal(run.smithingStones, 1, 'three free first upgrades, then one stone for each of a\'s next two');
  assert.equal(upgradeCount(a), 3);
  const poor = smithRun(coreOut, 0);
  const x = strikes(poor)[0];
  upgrade(poor, x.instanceId);
  const refused = upgradeArtPlan(coreOut, poor, x.instanceId);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /Smithing Stone/);
  assert.throws(() => commitUpgradeArt(coreOut, poor, refused));
  assert.equal(upgradeCount(x), 1);
  assert.equal(poor.smithingStones, 0);
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
