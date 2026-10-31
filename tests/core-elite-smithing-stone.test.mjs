// Owner, 2026-10-31: every elite drops a Smithing Stone, in Core too (SPEC §15.3 table).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { grantSmithingReward, smithingRewardId } from '../src/model/smithing.js';
import { createRunState } from '../src/model/state.js';
import { rewardPlan, smithingStoneRowCopy } from '../src/model/rewardplan.js';

const REG = createRegistries(contentBundle);
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function win(run, pool, rng) {
  run.actNumber = 1; run.floor = 3; run.mapNodeId = 'n1';
  return grantSmithingReward(REG, run, pool, smithingRewardId(run, pool), rng);
}

test('the combat door no longer skips configured (Core) runs', () => {
  assert.doesNotMatch(main, /isConfiguredRun\(run\) \? null : grantSmithingReward/);
  assert.match(main, /const smithingStoneReceipt = grantSmithingReward\(registries, run, enc\.pool/);
});

test('the Core victory receipt carries the stone receipt', () => {
  assert.match(main, /const victoryReceipt = \{ title: victoryTitle\(enc\), xpBefore, \.\.\.\(smithingStoneReceipt/);
});

test('an elite win pays 1 stone once; a reload replays the claim and pays 0', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });
  const before = run.smithingStones;
  const rng = createRng(3);
  const first = win(run, 'elite', rng);
  assert.equal(first.amount, 1);
  assert.equal(run.smithingStones, before + 1);
  const again = win(run, 'elite', rng);
  assert.equal(again.amount, 0);
  assert.equal(again.duplicate, true);
  assert.equal(run.smithingStones, before + 1);
});

test('a normal win pays 0 and a boss win pays 1', () => {
  const run = createRunState({ seed: 4, classId: 'reaver', registries: REG });
  const before = run.smithingStones;
  assert.equal(win(run, 'normal', createRng(4)).amount, 0);
  assert.equal(run.smithingStones, before);
  run.mapNodeId = 'n2';
  assert.equal(win(run, 'boss', createRng(4)).amount, 1);
  assert.equal(run.smithingStones, before + 1);
});

test('the receipt names the stone on the Victory screen', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
  const receipt = win(run, 'elite', createRng(5));
  const rows = rewardPlan({ title: 'Victory', smithingStoneReceipt: receipt }).rows;
  const row = rows.find((r) => r.kind === 'smithingStone');
  assert.ok(row, 'a smithingStone row is planned');
  const copy = smithingStoneRowCopy(row, (key, vars = {}) => `${key}:${vars.amount ?? vars.total ?? ''}`);
  assert.match(copy.title, /reward\.stone\.title:1/);
});
