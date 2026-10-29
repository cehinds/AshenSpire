// Card ranks 11a: Core turns SPEC 13.4o card ranks on through progression.cardRanks; Legacy stays off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { awardSkillXp, xpToNext, coreCardRanks, rankUpCandidates, raiseCardRank, levelQueuesRankUp } from '../src/model/skills.js';
import { settleConfiguredSkillProgression } from '../src/engine/skillXp.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const toLevel = (run, id, level) => awardSkillXp(registries, run, id, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0), { queueRewards: false, queueRankUps: coreCardRanks(run) });

test('the Core profile turns card ranks on; a Legacy run does not', () => {
  assert.equal(profile.modules.progression.cardRanks, true);
  assert.equal(coreCardRanks(newRun()), true);
  const legacy = createRunState({ registries: createRegistries(contentBundle), classId: 'reaver', seed: 4 });
  assert.equal(coreCardRanks(legacy), false);
});

test('Core track levels queue a rank-up per level from 2, and nothing else', () => {
  const run = newRun();
  toLevel(run, 'item:blade', 4);
  const row = run.skills['item:blade'];
  assert.equal(row.level, 4);
  assert.equal(row.pendingRankUps, 3, 'levels 2, 3 and 4 each queue one');
  assert.equal(row.pendingDrafts, 0, 'no legacy draft is queued');
  assert.ok(levelQueuesRankUp('weapon', 2) && !levelQueuesRankUp('weapon', 1));
});

test('without queueRankUps (the old Core behaviour) nothing is queued', () => {
  const run = newRun();
  awardSkillXp(registries, run, 'item:blade', 5000, { queueRewards: false });
  assert.equal(run.skills['item:blade'].pendingRankUps, undefined);
});

test('settleConfiguredSkillProgression queues the rank-ups for a Core fight', () => {
  const run = newRun();
  const need = Array.from({ length: 3 }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0);
  settleConfiguredSkillProgression(registries, run, {}, { receipt: { 'item:blade': need } });
  assert.equal(run.skills['item:blade'].level, 3);
  assert.equal(run.skills['item:blade'].pendingRankUps, 2);
});

test('Core cards (camp:/maneuver: tags) are rank-up candidates of the matching track', () => {
  const run = newRun();
  toLevel(run, 'item:blade', 3);
  const ids = rankUpCandidates(registries, run, 'item:blade').map((c) => c.cardId);
  assert.ok(ids.includes('core.strike') || run.deck.some((c) => c.cardId === 'core.strike'));
  assert.ok(ids.length > 0, 'martial deck cards can be ranked by the blade track');
  assert.ok(!rankUpCandidates(registries, run, 'item:magic-focus').length, 'a track at level 0 ranks nothing');
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  const raised = raiseCardRank(registries, run, 'item:blade', strike.instanceId);
  assert.equal(raised.rank, 2);
  assert.equal(run.skills['item:blade'].pendingRankUps, 1);
  // The ceiling is the track level: at level 3 a rank-3 card is done.
  raiseCardRank(registries, run, 'item:blade', strike.instanceId);
  assert.equal(strike.rank, 3);
  assert.equal(rankUpCandidates(registries, run, 'item:blade').some((c) => c.instanceId === strike.instanceId), false);
});
