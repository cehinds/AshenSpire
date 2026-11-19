// tests/level-pace-sim.test.mjs — the pace tool, and the owner's 2026-11-18 targets
// (docs/balance/owner-ruling-2026-11-18.md §14, docs/balance/level-pace-2026-11-18.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FightCurveFactor } from '../src/model/levelup.js';
import { defaultRegistries, simulateRun, paceReport, percentile, bandCheck } from '../tools/level-pace-sim.mjs';

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

test('owner pace: end-of-act levels sit in the owner bands, floor 1 pays little, one fight climbs at most 2', () => {
  const rep = paceReport(reg, { seeds: 100 });
  // Known, owner-accepted overshoot: elite-heavy act 1 (elite x3) can end at level 4 (docs/balance/level-pace-2026-11-18.md).
  assert.deepEqual(bandCheck(rep).filter((b) => !b.startsWith('max act1 p90')), []);
  assert.ok(rep.max.acts[0].p90 <= 4);
  for (const p of ['min', 'typical', 'max']) {
    assert.ok(rep[p].maxLevelsInFight <= 2, `${p} climbed ${rep[p].maxLevelsInFight} in one fight`);
    assert.ok(rep[p].firstFightXp < 10, `first fight of act 1 pays ${rep[p].firstFightXp}`);
  }
  assert.ok(rep.max.acts[2].mean > rep.min.acts[2].mean, 'elite-heavy routes finish higher');
});

test('FightCurveFactor rises with floor and with act, and is neutral without a position', () => {
  assert.equal(FightCurveFactor(reg, null), 1);
  assert.ok(FightCurveFactor(reg, { floor: 1, floors: 10, act: 1 }) < FightCurveFactor(reg, { floor: 10, floors: 10, act: 1 }));
  assert.ok(FightCurveFactor(reg, { floor: 5, floors: 10, act: 1 }) < FightCurveFactor(reg, { floor: 5, floors: 10, act: 3 }));
});
