// tests/buildversion-shard.test.mjs — the buildversion selftest's shard plan
// covers the whole corpus, each item once, and is balanced by measured cost.
//
// WHY (owner rule D38, 2026-10-02: every CI job finishes in 20 minutes or less).
// The Windows `reproducible` shards used to split each list by index mod count,
// so shard 0 always carried the extra plant, the extra row-H case AND the
// --which history; it ran 26-36 minutes while its siblings ran 13-24. The plan
// is now cost-balanced (tools/buildversion-selftest.mjs, planShards); this pins
// that no shard count drops or doubles an item and that no shard carries more
// than an even share plus one item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planShards, shardItems, SHARD_COST } from '../tools/buildversion-selftest.mjs';

const items = shardItems();

test('the real corpus is planned whole: every item in exactly one shard, at every count', () => {
  assert.ok(items.length > 10, `only ${items.length} items planned — the corpus did not load`);
  assert.equal(new Set(items.map((i) => i.key)).size, items.length, 'two items share a key');
  for (let count = 1; count <= 16; count++) {
    const plan = planShards(items, count);
    assert.equal(plan.size, items.length, `${count} shards plan ${plan.size} of ${items.length} items`);
    for (const item of items) {
      const shard = plan.get(item.key);
      assert.ok(Number.isInteger(shard) && shard >= 0 && shard < count, `${item.key} -> shard ${shard} of ${count}`);
    }
  }
});

test('the plan is deterministic, so every shard computes the same one', () => {
  for (const count of [2, 8, 12]) {
    assert.deepEqual([...planShards(items, count)], [...planShards(shardItems(), count)]);
  }
});

test('no shard carries more than an even share plus its largest item', () => {
  const largest = Math.max(...Object.values(SHARD_COST));
  const total = items.reduce((n, i) => n + i.cost, 0);
  for (let count = 1; count <= 16; count++) {
    const load = Array.from({ length: count }, () => 0);
    const plan = planShards(items, count);
    for (const item of items) load[plan.get(item.key)] += item.cost;
    assert.ok(Math.max(...load) <= total / count + largest + 1e-9,
      `${count} shards: heaviest ${Math.max(...load)} s against an even ${(total / count).toFixed(1)} s`);
  }
});

test('one shard is the whole corpus', () => {
  const plan = planShards(items, 1);
  assert.ok([...plan.values()].every((s) => s === 0));
});
