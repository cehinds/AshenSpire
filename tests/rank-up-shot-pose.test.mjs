// QA 2026-11-23: `?shot=reward&shotRankUp=1` broke when the rank-up door began skipping itself with no ready card.
// The pose fills the Blade's candidates first, so the door opens with them enabled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { pendingRankUpRows, RankUpRowsReady } from '../src/model/skills.js';
import { RankUpBlock } from '../src/model/rankUpService.js';
import { FillRankUpCandidateSlots } from '../src/dev/rankUpShotPose.js';

test('the rank-up shot pose fills the Blade candidates so the door opens', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.skills['item:blade'] = { ...(run.skills['item:blade'] || {}), level: 3, xp: 0, pendingRankUps: 1 };
  const rows = pendingRankUpRows(registries, run);
  assert.equal(RankUpRowsReady(registries, run, rows), false, 'a fresh deck has no ready card');
  const cards = FillRankUpCandidateSlots(registries, run, 'item:blade');
  assert.ok(cards.length > 0);
  assert.ok(cards.every((card) => RankUpBlock(run, card) === ''), 'every Blade candidate may rise');
  assert.equal(RankUpRowsReady(registries, run, rows), true);
});

test('shotStates.js fills the slots for both rank-up poses', () => {
  const source = readFileSync(new URL('../src/dev/shotStates.js', import.meta.url), 'utf8');
  assert.match(source, /rankUpPose === '1' \|\| rankUpPose === 'taken'\) \{[\s\S]{0,400}FillRankUpCandidateSlots\(ctx\.getRegistries\(\), run, 'item:blade'\)/);
});
