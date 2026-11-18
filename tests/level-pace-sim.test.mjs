// tests/level-pace-sim.test.mjs — the pace tool, and the owner's 2026-11-18 targets
// (docs/balance/owner-ruling-2026-11-18.md §14, docs/balance/level-pace-2026-11-18.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultRegistries, simulateRun, paceReport, percentile } from '../tools/level-pace-sim.mjs';

const reg = defaultRegistries();

test('simulateRun is deterministic on a fixed seed and policies order elites', () => {
  const a = simulateRun(reg, 1000, 'max');
  assert.deepEqual(simulateRun(reg, 1000, 'max'), a);
  assert.equal(a.levels.length, 3);
  assert.ok(a.levels[0] <= a.levels[1] && a.levels[1] <= a.levels[2]);
  assert.ok(simulateRun(reg, 1000, 'max').fights.elite >= simulateRun(reg, 1000, 'min').fights.elite);
});

test('percentile picks from a sorted list', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.1), 2);
  assert.equal(percentile([], 0.5), 0);
});

test('owner pace: elite-heavy ~level 8 by act 3, everyone at least 4, no act-1 flood', () => {
  const rep = paceReport(reg, { seeds: 100 });
  assert.ok(rep.max.acts[2].p50 >= 7 && rep.max.acts[2].p50 <= 8, `max p50 ${rep.max.acts[2].p50}`);
  assert.ok(rep.max.acts[2].p90 <= 9, `max p90 ${rep.max.acts[2].p90}`);
  assert.ok(rep.min.acts[2].p10 >= 4, `min p10 ${rep.min.acts[2].p10}`);
  for (const p of ['min', 'typical', 'max']) assert.ok(rep[p].maxLevelsInFight <= 2, `${p} climbed ${rep[p].maxLevelsInFight} in one fight`);
});
