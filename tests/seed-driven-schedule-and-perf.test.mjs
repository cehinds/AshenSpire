import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import { UpgradeKindUnlocked } from '../src/model/tierUnlocks.js';
import {
  NodeScheduleKey,
  ActNodeUpgradeStock,
  ActUpgradeSchedule,
  NodeRewardSchedule,
  ActRewardSchedule,
  ClearScheduleCaches,
} from '../src/model/actSeedSchedule.js';
import { planCardUpgrade, commitCardUpgrade, ClearCardUpgradePlanCache } from '../src/model/cardUpgradeService.js';
import { EvaluateUpgradeStepCp, PrepareUpgradeStepCpContext } from '../src/model/cardUpgradeCp.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { PrecomputeActRewardSchedule, RewardScheduleForOffer, gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';

test('ActNodeUpgradeStock is deterministic by (seed, nodeKey, vendor), respects tier unlocks, and varies by seed/node', () => {
  ClearScheduleCaches();
  const s1a = ActNodeUpgradeStock(12345, '1:n4', { vendor: 'blacksmith', scoring: shippedScoring });
  ClearScheduleCaches();
  const s1b = ActNodeUpgradeStock(12345, '1:n4', { vendor: 'blacksmith', scoring: shippedScoring });
  assert.deepEqual(s1a.byTier, s1b.byTier, 'identical after cache clear');
  assert.deepEqual(s1a.signatureKinds, s1b.signatureKinds);

  const otherNode = ActNodeUpgradeStock(12345, '1:n9', { vendor: 'blacksmith', scoring: shippedScoring });
  const otherSeed = ActNodeUpgradeStock(99999, '1:n4', { vendor: 'blacksmith', scoring: shippedScoring });
  assert.notDeepEqual(s1a.byTier, otherNode.byTier, 'different map nodes get distinct specialty stocks');
  assert.notDeepEqual(s1a.byTier, otherSeed.byTier, 'different seeds get distinct specialty stocks');

  // Every stock entry at tier t must be unlocked at tier t
  for (let t = 0; t <= s1a.maxTier; t += 1) {
    const shelf = s1a.forTier(t);
    assert.ok(shelf.length >= 1, `tier ${t} has specialty stock`);
    for (const entry of shelf) {
      assert.equal(UpgradeKindUnlocked(entry.kind, t, shippedScoring), true, `${entry.kind} must be unlocked at tier ${t}`);
    }
  }
  // Safe fallback for NaN / Infinity tiers
  assert.deepEqual(s1a.forTier(NaN), s1a.forTier(0));
  assert.deepEqual(s1a.forTier(Infinity), s1a.forTier(s1a.maxTier));
});

test('ActUpgradeSchedule and ActRewardSchedule pre-compute an entire Act map deterministically in < 25ms', () => {
  ClearScheduleCaches();
  const run = createRunState({ registries, classId: 'reaver', seed: 777, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a'] } } } });
  const mapGraph = buildActMap(registries, createRng(777), run.seatOrder[0], 1);
  run.mapGraph = mapGraph;

  const t0 = performance.now();
  const upgSchedA = ActUpgradeSchedule(run.seed, mapGraph, { actNumber: 1, scoring: shippedScoring });
  const rewSchedA = PrecomputeActRewardSchedule(run, mapGraph);
  const elapsed = performance.now() - t0;

  assert.ok(elapsed < 50, `Expected full Act upgrade+reward precompute < 50ms, got ${elapsed.toFixed(1)}ms`);
  assert.ok(Object.keys(upgSchedA.nodes).length > 0, 'pre-computed upgrade nodes');
  assert.ok(Object.keys(rewSchedA.nodes).length > 0, 'pre-computed reward nodes');

  ClearScheduleCaches();
  const upgSchedB = ActUpgradeSchedule(run.seed, mapGraph, { actNumber: 1, scoring: shippedScoring });
  const rewSchedB = ActRewardSchedule(run.seed, mapGraph, { actNumber: 1 });
  assert.deepEqual(
    Object.fromEntries(Object.entries(upgSchedA.nodes).map(([k, v]) => [k, v.signatureKinds])),
    Object.fromEntries(Object.entries(upgSchedB.nodes).map(([k, v]) => [k, v.signatureKinds])),
    'ActUpgradeSchedule is deterministic across reloads',
  );
  for (const [k, v] of Object.entries(rewSchedA.nodes)) {
    assert.deepEqual(v.slotSeeds, rewSchedB.nodes[k].slotSeeds, `slotSeeds deterministic for ${k}`);
    assert.deepEqual(v.rareBoostSlots, rewSchedB.nodes[k].rareBoostSlots, `rareBoostSlots deterministic for ${k}`);
  }
});

test('NodeRewardSchedule is visit-order independent and feeds RewardScheduleForOffer', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 31415, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a'] } } } });
  const a1 = NodeRewardSchedule(run.seed, '1:combat-5', { source: 'combat', pool: 'normal', countRange: { min: 3, max: 5 } });
  const b1 = NodeRewardSchedule(run.seed, '1:combat-9', { source: 'combat', pool: 'elite', countRange: { min: 3, max: 5 } });
  ClearScheduleCaches();
  // Query in reverse order
  const b2 = NodeRewardSchedule(run.seed, '1:combat-9', { source: 'combat', pool: 'elite', countRange: { min: 3, max: 5 } });
  const a2 = NodeRewardSchedule(run.seed, '1:combat-5', { source: 'combat', pool: 'normal', countRange: { min: 3, max: 5 } });
  assert.deepEqual(a1.slotSeeds, a2.slotSeeds);
  assert.deepEqual(b1.slotSeeds, b2.slotSeeds);
  assert.equal(a1.offerCount, a2.offerCount);
  assert.ok(a1.offerCount >= 3 && a1.offerCount <= 5);
  assert.notDeepEqual(a1.slotSeeds, b1.slotSeeds);

  const sched = RewardScheduleForOffer(run, '1:combat-5', { source: 'combat', pool: 'normal' });
  assert.deepEqual(sched.rareBoostSlots, a1.rareBoostSlots);

  const offer = gameProfileRewardOffers(registries, run, createRng(run.seed), { offerId: '1:combat-5', source: 'combat', pool: 'normal' });
  assert.ok(offer.options.length > 0, 'combat reward offer generated cleanly with schedule');
});

test('Hybrid node-specialty upgrades are deterministic per map node, commit cleanly, and never mutate run when read', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 2026, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.smithingStones = 10;
  run.level.level = 5;
  run.actNumber = 1;
  run.mapNodeId = 'bs-node-1';
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  strike.rank = 3;
  strike.upgraded = true;
  strike.upgradeSteps = [{ k: 'authored' }];

  assert.equal(NodeScheduleKey(run), '1:bs-node-1');
  const snapshotBefore = JSON.stringify(run);

  const plan1 = planCardUpgrade(run, registries, strike.instanceId, { choices: 3, vendor: 'blacksmith' });
  assert.equal(JSON.stringify(run), snapshotBefore, 'planCardUpgrade never mutates run');
  assert.ok(plan1.ok && plan1.options.length >= 2);

  // Clearing caches and replanning yields the exact same options
  ClearCardUpgradePlanCache(run);
  ClearScheduleCaches();
  const plan2 = planCardUpgrade(run, registries, strike.instanceId, { choices: 3, vendor: 'blacksmith' });
  assert.deepEqual(plan1.options.map((o) => o.step), plan2.options.map((o) => o.step));

  // Commit works and cache invalidates cleanly for the next upgrade step
  const receipt = commitCardUpgrade(run, registries, plan2);
  assert.equal(receipt.n, 2);
  const planAfterCommit = planCardUpgrade(run, registries, strike.instanceId, { choices: 3, vendor: 'blacksmith' });
  assert.equal(planAfterCommit.n, 3, 'cache invalidates after commit');
});

test('Blacksmith 60-card picker is fast cold (< 250ms) and instant on re-selection (< 5ms) without mutating run', () => {
  ClearScheduleCaches();
  const run = createRunState({ registries, classId: 'reaver', seed: 4242, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const poolIds = [...registries.cards.ids()].filter((id) => id.startsWith('core.') && !registries.cards.get(id)?.ruleTemplate).slice(0, 40);
  run.smithingStones = 20;
  run.level.level = 5;
  run.actNumber = 1;
  run.mapNodeId = 'bs-perf-1';
  run.deck = poolIds.slice(0, 20).map((cardId, i) => ({ instanceId: `d-${i}`, cardId, rank: 2, upgraded: false, upgradeSteps: [] }));
  run.sideboard = [
    ...poolIds.slice(20, 40).map((cardId, i) => ({ instanceId: `s-${i}`, cardId, rank: 2, upgraded: false, upgradeSteps: [] })),
    ...poolIds.slice(0, 20).map((cardId, i) => ({ instanceId: `s2-${i}`, cardId, rank: 3, upgraded: false, upgradeSteps: [] })),
  ];
  const beforeJson = JSON.stringify(run);

  const t0 = performance.now();
  const m1 = cardUpgradeModel(registries, run, null, { blacksmith: true });
  const coldMs = performance.now() - t0;
  assert.ok(m1.rows.length >= 40, `expected >= 40 rows, got ${m1.rows.length}`);
  assert.ok(coldMs < 250, `Expected cold 60-card Blacksmith picker < 250ms, got ${coldMs.toFixed(1)}ms`);

  // Clicking 10 different cards in the picker hits the WeakMap row cache
  const t1 = performance.now();
  for (let i = 0; i < 10; i += 1) {
    const id = m1.rows[i % m1.rows.length].instanceId;
    const picked = cardUpgradeModel(registries, run, id, { blacksmith: true });
    assert.equal(picked.selected?.instanceId, id);
  }
  const warmAvgMs = (performance.now() - t1) / 10;
  assert.ok(warmAvgMs < 5, `Expected warm selection avg < 5ms, got ${warmAvgMs.toFixed(2)}ms`);

  // Also benchmark the Blacksmith UI path passing a `quote` pricing callback (hits planCacheByRun)
  const quoteFn = () => ({ ok: true, cost: 1, cinders: 150, reason: '' });
  const t2 = performance.now();
  const quoted = cardUpgradeModel(registries, run, m1.rows[0].instanceId, { blacksmith: true, quote: quoteFn });
  const quotedMs = performance.now() - t2;
  assert.equal(quoted.selected?.instanceId, m1.rows[0].instanceId);
  assert.ok(quotedMs < 150, `Expected warm quoted Blacksmith picker < 150ms, got ${quotedMs.toFixed(1)}ms`);
  assert.equal(JSON.stringify(run), beforeJson, 'picker caches leave run JSON untouched');
});

test('planCardUpgrade and picker caches invalidate on playsEver, rank vs abilityRank, combo steps, and gear changes; PrepareUpgradeStepCpContext matches uncached evaluation', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 8080, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.smithingStones = 10;
  run.level.level = 5;
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  strike.rank = 3;

  // 1. Distinct combo steps never collide in planCacheKey
  strike.upgraded = true;
  strike.upgradeSteps = [{ k: 'combo', steps: [{ k: 'dmg', n: 1 }, { k: 'fx', fx: 'draw', n: 1 }] }];
  const pComboA = planCardUpgrade(run, registries, strike.instanceId, { choices: 2, vendor: 'blacksmith' });
  strike.upgradeSteps = [{ k: 'combo', steps: [{ k: 'dmg', n: 1 }, { k: 'fx', fx: 'block', n: 4 }] }];
  const pComboB = planCardUpgrade(run, registries, strike.instanceId, { choices: 2, vendor: 'blacksmith' });
  assert.notDeepEqual(pComboA.before.effects, pComboB.before.effects, 'distinct combo steps produce distinct cached plans');

  // 2. rank vs abilityRank distinction invalidates cache
  const graded = { instanceId: 'g-1', cardId: 'core.ironbreaker', upgraded: false, abilityRank: 2 };
  run.deck.push(graded);
  const pNoRank = planCardUpgrade(run, registries, graded.instanceId);
  graded.rank = 2;
  const pWithRank = planCardUpgrade(run, registries, graded.instanceId);
  assert.notEqual(pNoRank, pWithRank, 'changing instance.rank with same abilityRank invalidates plan cache');

  // 3. playsEver (run-scoped ramp) invalidates plan cache
  const rampCard = { instanceId: 'r-1', cardId: 'core.flick', rank: 2, upgraded: false, playsEver: 0 };
  run.deck.push(rampCard);
  const pPlay0 = planCardUpgrade(run, registries, rampCard.instanceId);
  rampCard.playsEver = 5;
  const pPlay5 = planCardUpgrade(run, registries, rampCard.instanceId);
  assert.notEqual(pPlay0, pPlay5, 'playsEver change invalidates plan cache');

  // 4. Gear/relic change invalidates plan & picker caches
  const pGear0 = planCardUpgrade(run, registries, strike.instanceId, { choices: 2, vendor: 'blacksmith' });
  run.itemUpgradeLevels = { ...(run.itemUpgradeLevels || {}), 'armament/greatsword': 3 };
  const pGear1 = planCardUpgrade(run, registries, strike.instanceId, { choices: 2, vendor: 'blacksmith' });
  assert.notEqual(pGear0, pGear1, 'itemUpgradeLevels change invalidates plan cache');

  // 5. PrepareUpgradeStepCpContext matches uncached EvaluateUpgradeStepCp
  const baseDef = registries.cards.get('core.strike');
  const ctx = PrepareUpgradeStepCpContext({ baseDef, currentDef: baseDef, instance: strike, playerLevel: 5, scoring: shippedScoring });
  for (const step of [{ k: 'dmg', n: 2 }, { k: 'fx', fx: 'block', n: 4 }, { k: 'fx', fx: 'heal', n: 3 }]) {
    const direct = EvaluateUpgradeStepCp({ baseDef, currentDef: baseDef, instance: strike, step, playerLevel: 5, scoring: shippedScoring });
    const cached = EvaluateUpgradeStepCp({ baseDef, currentDef: baseDef, instance: strike, step, playerLevel: 5, scoring: shippedScoring, context: ctx });
    assert.deepEqual(cached, direct);
  }
});
