// Owner ruling 2026-10-28: upgrading at the Blacksmith and the merchant works in a Core run. Both used to throw
// "Configured equipment upgrades require a committed Smith rest service" because neither entered the 'smith' service.
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
import { blacksmithUpgradePlan, commitBlacksmithUpgrade } from '../src/model/blacksmith.js';
import { commitMerchantSmithing, smithingPlan } from '../src/model/smithing.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const coreReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));
const WEAPON = 'armament/greatsword';

function smithRun(registries, stones) {
  const run = createRunState({ seed: 31, classId: 'reaver', registries, runId: 'smith-svc' });
  run.smithingStones = stones;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(31), run);
  return run;
}
const upgrade = (registries, run, ref = WEAPON) => {
  const quote = blacksmithUpgradePlan(registries, run, ref);
  assert.equal(quote.ok, true, quote.reason);
  return commitBlacksmithUpgrade(registries, run, quote);
};

test('Core Blacksmith: tiers 1, 2, 3 cost 1, 2, 3 stones; a fourth is refused and keeps the stones', () => {
  const run = smithRun(coreOut, 7);
  const spent = [];
  for (let tier = 1; tier <= 3; tier++) {
    const before = run.smithingStones;
    const receipt = upgrade(coreOut, run);
    assert.equal(receipt.afterLevel, tier);
    spent.push(before - run.smithingStones);
  }
  assert.deepEqual(spent, [1, 2, 3]);
  assert.equal(run.itemUpgradeLevels[WEAPON], 3);
  const left = run.smithingStones;
  const quote = blacksmithUpgradePlan(coreOut, run, WEAPON);
  assert.equal(quote.ok, false);
  assert.throws(() => commitBlacksmithUpgrade(coreOut, run, quote));
  assert.equal(run.smithingStones, left);
  assert.equal(run.itemUpgradeLevels[WEAPON], 3);
});

test('Core merchant: an upgrade pays the plan price for tiers 1..3', () => {
  const run = createRunState({ seed: 32, classId: 'reaver', registries: coreReg, runId: 'smith-svc-m' });
  run.smithingStones = 6;
  const spent = [];
  for (let tier = 1; tier <= 3; tier++) {
    const price = smithingPlan(coreReg, run).candidates.find((row) => row.itemRef === WEAPON).cost;
    const before = run.smithingStones;
    const receipt = commitMerchantSmithing(coreReg, run, WEAPON);
    assert.equal(receipt.afterLevel, tier);
    assert.equal(before - run.smithingStones, price);
    spent.push(price);
  }
  assert.deepEqual(spent, [1, 2, 3]);
  assert.throws(() => commitMerchantSmithing(coreReg, run, WEAPON), /not an eligible Smithing candidate/);
  assert.equal(run.smithingStones, 0);
});

test('Legacy Blacksmith upgrade is unchanged: one tier for one stone', () => {
  const run = smithRun(legacyOut, 5);
  const ref = smithingPlan(legacyOut, run).candidates.find((row) => row.itemKind === 'armament').itemRef;
  const receipt = upgrade(legacyOut, run, ref);
  assert.equal(receipt.afterLevel, 1);
  assert.equal(run.smithingStones, 4);
  assert.equal(blacksmithUpgradePlan(legacyOut, run, ref).ok, false);
});
