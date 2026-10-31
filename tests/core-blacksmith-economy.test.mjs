// Owner ask 2026-10-31: the Core Blacksmith economy — rank-up, cinder prices, tiered armament stock, tier reach.
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
import { coreArmamentPlan, commitCoreArmament, coreWeaponArtPlan, commitCoreWeaponArt, rollTier } from '../src/model/blacksmithStock.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { smithingPlan } from '../src/model/smithing.js';
import { buildActMap } from '../src/engine/actmap.js';
import { rankUpPlan, commitRankUp, rankUpCards, serviceCandidates } from '../src/model/blacksmith.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const OUT_ROWS = Object.fromEntries(shippedShops.blacksmith.offerings.map((row) => [`gameConfig.shops.blacksmith.${row.id}.chance`, 100]));
const coreOut = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), OUT_ROWS)), profile);
const legacyOut = createRegistries(configuredContentBundle(contentBundle, OUT_ROWS));

function smithRun(registries, { stones = 3, cinders = 2000, seed = 31 } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'bs-economy' });
  run.smithingStones = stones;
  run.cinders = cinders;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(seed), run);
  return run;
}
const strike = (run) => run.deck.find((c) => c.cardId === 'core.strike');

test('rank-up: plan names 120 cinders and 1 stone; commit raises the rank by one and bumps the revision', () => {
  const run = smithRun(coreOut);
  const card = strike(run);
  const plan = rankUpPlan(coreOut, run, card.instanceId);
  assert.equal(plan.ok, true, plan.reason);
  assert.deepEqual([plan.cost, plan.stones, plan.from, plan.to], [120, 1, 1, 2]);
  const receipt = commitRankUp(coreOut, run, plan);
  assert.deepEqual([receipt.rank, run.smithingStones, run.cinders, card.rank], [2, 2, 1880, 2]);
  assert.equal(rankUpPlan(coreOut, run, card.instanceId).revision, plan.revision + 1);
  commitRankUp(coreOut, run, rankUpPlan(coreOut, run, card.instanceId));
  assert.equal(card.rank, 3, 'ranks stack');
});

test('rank-up: a stale quote is refused and spends nothing', () => {
  const run = smithRun(coreOut);
  const card = strike(run);
  const plan = rankUpPlan(coreOut, run, card.instanceId);
  commitRankUp(coreOut, run, plan);
  const before = [run.smithingStones, run.cinders, card.rank];
  assert.throws(() => commitRankUp(coreOut, run, plan), /changed|stale|again/i);
  assert.deepEqual([run.smithingStones, run.cinders, card.rank], before);
});

test('rank-up: refuses without cinders or without a stone, and in a Legacy run', () => {
  const poor = smithRun(coreOut, { cinders: 119 });
  const refused = rankUpPlan(coreOut, poor, strike(poor).instanceId);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /cinders/i);
  assert.throws(() => commitRankUp(coreOut, poor, refused));
  assert.equal(poor.cinders, 119);
  const dry = smithRun(coreOut, { stones: 0 });
  assert.match(rankUpPlan(coreOut, dry, strike(dry).instanceId).reason, /Smithing Stone/);
  const legacy = smithRun(legacyOut);
  assert.equal(rankUpPlan(legacyOut, legacy, legacy.deck[0].instanceId).ok, false);
  assert.deepEqual(rankUpCards(legacyOut, legacy), []);
});

test('rank-up: the rank ceiling refuses; the card list excludes equipment-bound cards', () => {
  const run = smithRun(coreOut);
  const card = strike(run);
  card.rank = 99;
  const plan = rankUpPlan(coreOut, run, card.instanceId);
  assert.equal(plan.ok, false);
  assert.ok(!rankUpCards(coreOut, run).some((c) => c.instanceId === card.instanceId));
  const bound = run.deck.find((c) => c.sourceArmamentId || c.equipmentRole);
  if (bound) assert.ok(!rankUpCards(coreOut, run).some((c) => c.instanceId === bound.instanceId));
  run.shopStock.offerings = run.shopStock.offerings.filter((id) => id !== 'rankUp');
  assert.equal(rankUpPlan(coreOut, run, strike(run).instanceId).ok, false, 'a visit that did not lay it out refuses');
  assert.ok(serviceCandidates(coreOut, smithRun(coreOut), 'rankUp').length > 0);
});

const coreReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const RARITY_RANGE = { common: [60, 75], uncommon: [90, 113], rare: [150, 180] };
const MULT = [1, 1.4, 1.8, 2.3];

test('stock: six distinct armaments, tiers within the authored weights, prices scale with the tier', () => {
  const tally = [0, 0, 0, 0];
  let n = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const run = smithRun(coreOut, { seed });
    const rack = run.shopStock.armaments;
    assert.equal(rack.length, 6);
    assert.equal(new Set(rack.map((row) => row.id)).size, 6, 'distinct pieces');
    for (const row of rack) {
      assert.ok(Number.isInteger(row.tier) && row.tier >= 0 && row.tier <= 3, `tier ${row.tier}`);
      tally[row.tier]++; n++;
      const rarity = coreOut.equipment.armaments.find((piece) => piece.id === row.id).rarity;
      const [lo, hi] = RARITY_RANGE[rarity] || RARITY_RANGE.common;
      assert.ok(row.price >= Math.round(lo * MULT[row.tier]) && row.price <= Math.round(hi * MULT[row.tier]), `${row.id} tier ${row.tier} price ${row.price} outside ${lo}-${hi} x ${MULT[row.tier]}`);
    }
  }
  // 20/40/30/10 with 720 draws: each tier within 8 points of its weight, and "usually higher than default".
  [0.2, 0.4, 0.3, 0.1].forEach((share, tier) => assert.ok(Math.abs(tally[tier] / n - share) < 0.08, `tier ${tier}: ${tally[tier] / n}`));
  assert.ok(1 - tally[0] / n > 0.7, 'most pieces are above the default tier');
  // The same seed rolls the same rack.
  assert.deepEqual(smithRun(coreOut, { seed: 9 }).shopStock, smithRun(coreOut, { seed: 9 }).shopStock);
});

test('rollTier never exceeds an item\'s ceiling', () => {
  const rng = createRng(5);
  for (let i = 0; i < 200; i++) assert.ok(rollTier({ 0: 20, 1: 40, 2: 30, 3: 10 }, rng, 1) <= 1);
  assert.equal(rollTier({ 0: 20, 1: 40 }, rng, 0), 0);
});

test('armament purchase: lands in storage, writes the tier, charges the price, leaves the rack, never lowers a tier', () => {
  const run = smithRun(coreOut);
  const row = run.shopStock.armaments.find((r) => r.tier >= 1) || (() => { run.shopStock.armaments[0].tier = 2; return run.shopStock.armaments[0]; })();
  const ref = `armament/${row.id}`;
  const plan = coreArmamentPlan(coreOut, run, row.id);
  assert.equal(plan.ok, true, plan.reason);
  assert.equal(plan.cost, row.price);
  const before = run.cinders;
  const receipt = commitCoreArmament(coreOut, run, plan);
  assert.equal(receipt.tier, row.tier);
  assert.ok(run.loadout.storage.includes(row.id));
  assert.equal(run.itemUpgradeLevels[ref], row.tier);
  assert.equal(run.cinders, before - row.price);
  assert.ok(!run.shopStock.armaments.some((r) => r.id === row.id));
  // A second copy at a lower tier never lowers the record.
  run.itemUpgradeLevels[ref] = 3;
  run.loadout.storage = run.loadout.storage.filter((id) => id !== row.id);
  run.shopStock.armaments.push({ id: row.id, tier: 1, price: 70 });
  commitCoreArmament(coreOut, run, coreArmamentPlan(coreOut, run, row.id));
  assert.equal(run.itemUpgradeLevels[ref], 3);
  // A tier 0 piece writes no record.
  const plain = smithRun(coreOut);
  const zero = plain.shopStock.armaments[0]; zero.tier = 0;
  commitCoreArmament(coreOut, plain, coreArmamentPlan(coreOut, plain, zero.id));
  assert.equal(plain.itemUpgradeLevels?.[`armament/${zero.id}`], undefined);
});

test('armament purchase: refuses without cinders or room, and a stale quote spends nothing', () => {
  const poor = smithRun(coreOut, { cinders: 10 });
  const id = poor.shopStock.armaments[0].id;
  const refused = coreArmamentPlan(coreOut, poor, id);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /cinders/i);
  assert.throws(() => commitCoreArmament(coreOut, poor, refused));
  assert.equal(poor.cinders, 10);
  const run = smithRun(coreOut);
  const quote = coreArmamentPlan(coreOut, run, run.shopStock.armaments[0].id);
  commitCoreArmament(coreOut, run, coreArmamentPlan(coreOut, run, run.shopStock.armaments[1].id));
  const cinders = run.cinders;
  assert.throws(() => commitCoreArmament(coreOut, run, quote), /changed/);
  assert.equal(run.cinders, cinders);
  const full = smithRun(coreOut);
  full.loadout.storage = Array.from({ length: 8 }, (_, i) => `filler-${i}`);
  assert.match(coreArmamentPlan(coreOut, full, full.shopStock.armaments[0].id).reason, /storage/i);
});

test('weapon-art shelf: the Core art is sold at the weaponArt price, once, into the sideboard', () => {
  const run = smithRun(coreOut);
  assert.deepEqual(run.shopStock.weaponArts.map((row) => row.id), ['core.reaverSpecial']);
  const row = run.shopStock.weaponArts[0];
  assert.ok(row.price >= 68 && row.price <= 90);
  const before = run.cinders;
  const receipt = commitCoreWeaponArt(coreOut, run, coreWeaponArtPlan(coreOut, run, row.id));
  assert.equal(run.cinders, before - row.price);
  assert.ok(run.sideboard.some((card) => card.instanceId === receipt.instance.instanceId && card.cardId === 'core.reaverSpecial'));
  assert.equal(run.shopStock.weaponArts.length, 0);
  assert.equal(coreWeaponArtPlan(coreOut, run, row.id).ok, false);
  const poor = smithRun(coreOut, { cinders: 1 });
  assert.match(coreWeaponArtPlan(coreOut, poor, poor.shopStock.weaponArts[0].id).reason, /cinders/i);
});

test('blacksmith upgrade: insufficient cinders refuses and keeps both purses; stale quote refuses', () => {
  const run = smithRun(coreOut, { stones: 5, cinders: 59 });
  const plan = blacksmithUpgradePlan(coreOut, run, 'armament/greatsword');
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /cinders/i);
  assert.throws(() => commitBlacksmithUpgrade(coreOut, run, plan));
  assert.deepEqual([run.smithingStones, run.cinders, run.itemUpgradeLevels?.['armament/greatsword']], [5, 59, undefined]);
  run.cinders = 500;
  const quote = blacksmithUpgradePlan(coreOut, run, 'armament/greatsword');
  commitBlacksmithUpgrade(coreOut, run, quote);
  assert.throws(() => commitBlacksmithUpgrade(coreOut, run, quote), /changed/, 'the same quote commits once');
});

test('tier reach: the rest-site Smith stops at tier 2 and says it needs a Blacksmith; the Blacksmith reaches 3', () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: coreReg, runId: 'reach' });
  run.itemUpgradeLevels = { 'armament/greatsword': 2 };
  run.mapGraph = buildActMap(coreReg, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find((n) => n.type === 'shrine' && n.floor === 3).id;
  beginGameProfileRest(run, `1:${run.mapNodeId}`);
  assert.throws(() => commitGameProfileRest(coreReg, run, 'smith', { itemRef: 'armament/greatsword' }), /Needs a Blacksmith|needs a Blacksmith/);
  assert.equal(run.itemUpgradeLevels['armament/greatsword'], 2);
  // A rest still reaches tier 2 from tier 1.
  run.itemUpgradeLevels = { 'armament/greatsword': 1 };
  assert.equal(commitGameProfileRest(coreReg, run, 'smith', { itemRef: 'armament/greatsword' }) !== undefined, true);
  assert.equal(run.itemUpgradeLevels['armament/greatsword'], 2);
  // The Blacksmith takes tier 2 to 3, at 2 stones (the ladder's 3 less the discount) and 150 cinders.
  const smith = smithRun(coreOut, { stones: 4, cinders: 400 });
  smith.itemUpgradeLevels = { 'armament/greatsword': 2 };
  const plan = blacksmithUpgradePlan(coreOut, smith, 'armament/greatsword');
  assert.deepEqual([plan.ok, plan.stones, plan.cost], [true, 2, 150]);
  commitBlacksmithUpgrade(coreOut, smith, plan);
  assert.equal(smith.itemUpgradeLevels['armament/greatsword'], 3);
  assert.equal(smithingPlan(coreReg, smith).candidates.find((c) => c.itemRef === 'armament/greatsword'), undefined, 'no tier 4');
});
