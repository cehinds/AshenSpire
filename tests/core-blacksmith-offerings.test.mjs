// A Core Blacksmith offers only the equipment upgrade and the card upgrade (an allow-list); every legacy service is
// withheld from the stock, refused by its plan and commit, and (screen side) hidden even for an old saved stock.
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
import {
  BLACKSMITH_SERVICES, CORE_BLACKSMITH_OFFERINGS, blacksmithWithholds, blacksmithOffers,
  refinePlan, commitRefine, sigilSlotPlan, commitSigilSlot, sigilInstallPlan, stackCopyPlan, commitStackCopy,
  blacksmithExtractPlan, blacksmithInstallPlan, blacksmithUpgradePlan,
} from '../src/model/blacksmith.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));

function smithRun(registries) {
  const run = createRunState({ seed: 41, classId: 'reaver', registries, runId: 'bs-core-offers' });
  run.smithingStones = 12;
  run.cinders = 2000;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(41), run);
  return run;
}

test('Core Blacksmith stock offers only the equipment upgrade and the card upgrade', () => {
  const run = smithRun(coreOut);
  assert.deepEqual([...run.shopStock.offerings].sort(), [...CORE_BLACKSMITH_OFFERINGS].sort());
  assert.equal(run.shopStock.armaments, undefined);
  assert.equal(run.shopStock.smithStones, undefined);
});

test('Legacy Blacksmith stock is unchanged: every service is still offered', () => {
  const run = smithRun(legacyOut);
  for (const id of BLACKSMITH_SERVICES) assert.ok(run.shopStock.offerings.includes(id), id);
});

test('Core withholds every legacy service, even when an old saved stock lists it', () => {
  const run = smithRun(coreOut);
  run.shopStock.offerings = [...BLACKSMITH_SERVICES, 'armaments', 'smithStones'];
  for (const id of BLACKSMITH_SERVICES) assert.equal(blacksmithWithholds(run, id), !CORE_BLACKSMITH_OFFERINGS.includes(id), id);
  assert.equal(blacksmithWithholds(run, 'armaments'), true);
  assert.equal(blacksmithWithholds(run, 'smithStones'), true);
  for (const id of CORE_BLACKSMITH_OFFERINGS) assert.equal(blacksmithOffers(run, id), true, id);
  for (const id of BLACKSMITH_SERVICES.filter((s) => !CORE_BLACKSMITH_OFFERINGS.includes(s))) assert.equal(blacksmithOffers(run, id), false, id);
});

test('Core withheld services refuse to plan and to commit', () => {
  const run = smithRun(coreOut);
  run.shopStock.offerings = [...BLACKSMITH_SERVICES];
  run.sigils = [];
  const refine = refinePlan(coreOut, run);
  assert.equal(refine.ok, false);
  assert.throws(() => commitRefine(coreOut, run, refine), /not offering/);
  const cut = sigilSlotPlan(coreOut, run, 'armament/greatsword');
  assert.equal(cut.ok, false);
  assert.throws(() => commitSigilSlot(coreOut, run, cut), /not offering/);
  assert.equal(sigilInstallPlan(coreOut, run, 'armament/greatsword', 0, 'x').ok, false);
  const stack = stackCopyPlan(coreOut, run, 'core.strike');
  assert.equal(stack.ok, false);
  assert.throws(() => commitStackCopy(coreOut, run, stack), /not offering/);
  assert.equal(blacksmithExtractPlan(coreOut, run, 'armament/greatsword', 'x').ok, false);
  assert.equal(blacksmithInstallPlan(coreOut, run, 'armament/greatsword', 'x', 'y').ok, false);
  assert.equal(blacksmithUpgradePlan(coreOut, run, 'armament/greatsword', { purse: 'refined' }).ok, false);
  assert.equal(blacksmithUpgradePlan(coreOut, run, 'armament/greatsword').ok, true);
});
