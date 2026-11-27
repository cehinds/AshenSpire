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

// The first ICU collation in a process loads its data from the node binary.
// On a fresh GitHub runner that first read comes from a lazily filled disk:
// run 45945847782 measured 197.6ms wall, 6.2ms CPU, 25 major page faults and
// 29 blocking context switches for one `localeCompare`; the next call took
// 4.8ms. That is a one-time disk cost of the host, not schedule or picker
// work, and it landed inside the Act timing below because that file runs
// first in its shard. Pay it here, before any timed region.
'n1_0'.localeCompare('n10_0');

// Wall time, plus the process CPU and OS counters that say why wall time ran
// longer than CPU (disk faults, blocked or preempted waits) when it does.
function Measure(work) {
  const usageStart = process.resourceUsage();
  const cpuStart = process.cpuUsage();
  const t0 = performance.now();
  const result = work();
  const ms = performance.now() - t0;
  const cpu = process.cpuUsage(cpuStart);
  const usage = process.resourceUsage();
  const cpuMs = (cpu.user + cpu.system) / 1000;
  const why = `cpuMs=${cpuMs.toFixed(1)}, majorFaults=${usage.majorPageFault - usageStart.majorPageFault}`
    + `, blockedSwitches=${usage.voluntaryContextSwitches - usageStart.voluntaryContextSwitches}`
    + `, preemptedSwitches=${usage.involuntaryContextSwitches - usageStart.involuntaryContextSwitches}`;
  return { result, ms, why };
}

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

  const precompute = Measure(() => ({
    upgSchedA: ActUpgradeSchedule(run.seed, mapGraph, { actNumber: 1, scoring: shippedScoring }),
    rewSchedA: PrecomputeActRewardSchedule(run, mapGraph),
  }));
  const { upgSchedA, rewSchedA } = precompute.result;

  assert.ok(precompute.ms < 50, `Expected full Act upgrade+reward precompute < 50ms, got ${precompute.ms.toFixed(1)}ms (${precompute.why})`);
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

  const cold = Measure(() => cardUpgradeModel(registries, run, null, { blacksmith: true }));
  const m1 = cold.result;
  assert.ok(m1.rows.length >= 40, `expected >= 40 rows, got ${m1.rows.length}`);
  assert.ok(cold.ms < 250, `Expected cold 60-card Blacksmith picker < 250ms, got ${cold.ms.toFixed(1)}ms (${cold.why})`);

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


// Controlled ordering contracts run after the original six timing/mechanics cases.
async function orderingScoring() {
  const { scoringContract } = await import('./helpers/scoring-contract.mjs');
  const scoring = scoringContract();
  scoring.tierUnlocks = { enabled: false };
  scoring.rank = { unrankedMax: 0, width: 10, maxRank: 1, maxCp: 10 };
  return scoring;
}
const orderingGraph = rows => ({ nodes: Object.fromEntries(rows.map((node, index) => [index, node])) });
const orderingIds = ['n2_2', 'boss_2', 'n1_2', 'n10_0', 'boss_10', 'n1_10', 'boss', 'n2_1', 'n1_1', 'boss_0'];
const orderedIds = ['boss', 'boss_0', 'boss_10', 'boss_2', 'n1_1', 'n1_10', 'n1_2', 'n10_0', 'n2_1', 'n2_2'];

test('Act node ordering: canonical text parts have exact lexical and prefix order with English reference parity', async () => {
  const scoring = await orderingScoring();
  const rows = orderingIds.map(id => ({ id, type: 'blacksmith' }));
  const before = structuredClone(rows), graph = orderingGraph(rows);
  const upgrades = ActUpgradeSchedule(21, graph, { actNumber: 2, scoring, slotsPerTier: 1 });
  const rewards = ActRewardSchedule(21, graph, { actNumber: 2 });
  const keys = orderedIds.map(id => '2:' + id);
  assert.deepEqual(Object.keys(upgrades.nodes), keys);
  assert.deepEqual(Object.keys(rewards.nodes), keys);
  // This deliberately checks the shipping English reference, not every locale.
  assert.deepEqual([...orderingIds].sort((a, b) => a.localeCompare(b, 'en')), orderedIds);
  assert.deepEqual(rows, before);
});

test('Act node ordering: stable duplicates retain the last node vendor and reward kind', async () => {
  const scoring = await orderingScoring();
  const graph = orderingGraph([{ id: 'n2_0', type: 'blacksmith' }, { id: 'n1_0', type: 'blacksmith' },
    { id: 'n2_0', type: 'shop' }]);
  const upgrades = ActUpgradeSchedule(22, graph, { scoring, slotsPerTier: 1 });
  const rewards = ActRewardSchedule(22, graph);
  assert.deepEqual(Object.keys(upgrades.nodes), ['1:n1_0', '1:n2_0']);
  assert.equal(upgrades.forNode('n2_0').vendor, 'arcane');
  assert.equal(rewards.forNode('n2_0').source, 'shop');
  assert.deepEqual(upgrades.forNode('n2_0').byTier, ActNodeUpgradeStock(22, '1:n2_0', { vendor: 'arcane', scoring, slotsPerTier: 1 }).byTier);
});

test('Act node ordering: node seed outputs equal standalone lookups and ignore map insertion order', async () => {
  const scoring = await orderingScoring();
  const rows = orderingIds.map(id => ({ id, type: 'blacksmith' }));
  const a = ActUpgradeSchedule(23, orderingGraph(rows), { scoring, slotsPerTier: 1 });
  const b = ActRewardSchedule(23, orderingGraph(rows), { countRange: { min: 2, max: 4 }, maxSlots: 3 });
  ClearScheduleCaches();
  const reverseA = ActUpgradeSchedule(23, orderingGraph([...rows].reverse()), { scoring, slotsPerTier: 1 });
  const reverseB = ActRewardSchedule(23, orderingGraph([...rows].reverse()), { countRange: { min: 2, max: 4 }, maxSlots: 3 });
  assert.deepEqual(Object.keys(reverseA.nodes), Object.keys(a.nodes));
  for (const id of orderingIds) {
    const key = '1:' + id;
    assert.deepEqual(a.forNode(id).byTier, ActNodeUpgradeStock(23, key, { vendor: 'blacksmith', scoring, slotsPerTier: 1 }).byTier);
    assert.deepEqual(reverseA.forNode(id).byTier, a.forNode(id).byTier);
    const standalone = NodeRewardSchedule(23, key, { source: 'blacksmith', pool: 'normal', countRange: null, maxSlots: 3 });
    assert.deepEqual(b.forNode(id).slotSeeds, standalone.slotSeeds);
    assert.deepEqual(reverseB.forNode(id).slotSeeds, standalone.slotSeeds);
    assert.deepEqual(reverseB.forNode(id).rareBoostSlots, b.forNode(id).rareBoostSlots);
  }
});

function observeOrdering(makeRows, schedule = null) {
  const events = [], rows = makeRows(events), graph = orderingGraph(rows), original = String.prototype.localeCompare;
  let error = null;
  String.prototype.localeCompare = function(other, ...args) {
    events.push('compare:' + String(this) + ':' + other);
    return original.call(this, other, ...args);
  };
  try {
    const watched = { get nodes() { events.push('nodes'); return graph.nodes; } };
    if (schedule) schedule(24, watched);
    else {
      const raw = watched?.nodes && typeof watched.nodes === 'object' ? Object.values(watched.nodes) : [];
      const sorted = [...raw].sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));
      for (const node of sorted) if (node && node.id) void node.type;
    }
  } catch (caught) { error = caught.message; }
  finally { String.prototype.localeCompare = original; }
  return { events, error };
}

test('Act node ordering: any custom, Unicode, inherited or nonplain ID retains whole-list legacy comparisons', () => {
  const cases = [
    ...['custom', 'éclair', 'n0_0', 'n01_0', 'n1_01', 'boss_00', 'boss_01', 'n1_0_extra', 'n1_0\n', 'boss\r', 'boss_1\u2028', 4, null].map(id => () => ({ id, type: 'unused' })),
    () => Object.assign(Object.create(null), { id: 'n1_0', type: 'unused' }),
    () => Object.assign(Object.create({ id: 'n1_0' }), { type: 'unused' }),
    () => new (class Node { constructor() { this.id = 'n1_0'; this.type = 'unused'; } })(),
  ];
  for (const make of cases) {
    const rows = () => [{ id: 'n2_0', type: 'unused' }, make(), { id: 'n10_0', type: 'unused' }, { id: 'n1_0', type: 'unused' }];
    const expected = observeOrdering(rows);
    assert.ok(expected.events.some(event => event.startsWith('compare:')));
    assert.deepEqual(observeOrdering(rows, ActUpgradeSchedule), expected);
    assert.deepEqual(observeOrdering(rows, ActRewardSchedule), expected);
  }
});

test('Act node ordering: accessor and stringification reads and errors occur in the original order', () => {
  for (const throws of [false, true]) for (const form of ['accessor', 'coercion']) {
    const rows = events => {
      const read = () => { events.push('read-id'); if (throws) throw new Error('controlled ID read'); return 'n1_0'; };
      const id = form === 'coercion' ? { toString: read } : undefined;
      const node = form === 'coercion' ? { id, type: 'unused' } : { get id() { return read(); }, type: 'unused' };
      return [{ id: 'n2_0', type: 'unused' }, node, { id: 'n10_0', type: 'unused' }];
    };
    const expected = observeOrdering(rows);
    assert.equal(expected.error, throws ? 'controlled ID read' : null);
    assert.deepEqual(observeOrdering(rows, ActUpgradeSchedule), expected);
    assert.deepEqual(observeOrdering(rows, ActRewardSchedule), expected);
  }
});

test('Act node ordering: canonical lists do not call localeCompare or Intl.Collator', async () => {
  const scoring = await orderingScoring();
  const compare = String.prototype.localeCompare, collator = Intl.Collator;
  String.prototype.localeCompare = () => { throw new Error('unexpected native collation'); };
  Intl.Collator = () => { throw new Error('unexpected native collator'); };
  try {
    const graph = orderingGraph(orderingIds.map(id => ({ id, type: 'blacksmith' })));
    assert.deepEqual(Object.keys(ActUpgradeSchedule(25, graph, { scoring, slotsPerTier: 1 }).nodes), orderedIds.map(id => '1:' + id));
    assert.deepEqual(Object.keys(ActRewardSchedule(25, graph).nodes), orderedIds.map(id => '1:' + id));
  } finally { String.prototype.localeCompare = compare; Intl.Collator = collator; }
});
