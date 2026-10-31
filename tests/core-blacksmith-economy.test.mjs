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
