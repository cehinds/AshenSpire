// tests/card-rank-up.test.mjs — SPEC §13.4o B2b: each level of a card-school
// track from 2 on queues a rank-up; the reward door offers it beside the
// level's draft, and taking it raises one owned card of the track's schools
// by one rank, never past the track's level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { awardSkillXp, xpToNext, rankUpCandidates, raiseCardRank, skillsProblems } from '../src/model/skills.js';
import { rewardPlan } from '../src/model/rewardplan.js';

const registries = createRegistries(contentBundle);
const BLADE = 'item:blade';
const levelUp = (run, track, kind, levels) => {
  let xp = 0;
  for (let l = 0; l < levels; l += 1) xp += xpToNext(registries, kind, l);
  return awardSkillXp(registries, run, track, xp);
};
const bladeRun = (level) => {
  const run = createRunState({ seed: 21, classId: 'reaver', registries });
  if (level) levelUp(run, BLADE, 'weapon', level);
  run.deck.push({ instanceId: 'own-rend', cardId: 'gorefireSlash', upgraded: false });
  return run;
};

test('a card-school track queues one rank-up per level from 2; armour queues none', () => {
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  levelUp(run, BLADE, 'weapon', 3);
  assert.equal(run.skills[BLADE].pendingDrafts, 3);
  assert.equal(run.skills[BLADE].pendingRankUps, 2, 'levels 2 and 3, not level 1');
  levelUp(run, 'armour:heavy', 'armour', 3);
  assert.equal(run.skills['armour:heavy'].pendingRankUps, undefined);
  const banked = createRunState({ seed: 3, classId: 'reaver', registries });
  awardSkillXp(registries, banked, BLADE, xpToNext(registries, 'weapon', 0));
  assert.equal(banked.skills[BLADE].pendingRankUps, undefined, 'reaching level 1 queues none');
  awardSkillXp(registries, banked, BLADE, xpToNext(registries, 'weapon', 1));
  assert.equal(banked.skills[BLADE].pendingRankUps, 1, 'reaching level 2 queues one');
  assert.deepEqual(skillsProblems(run.skills), []);
  assert.ok(skillsProblems({ [BLADE]: { xp: 0, level: 2, pendingDrafts: 0, pendingRankUps: -1 } }).length);
});

test('a rank-up raises an ordinary owned card of the schools, never past the track level', () => {
  const run = bladeRun(3);
  run.deck.push({ instanceId: 'own-bound', cardId: 'gorefireSlash', upgraded: false, sourceArmamentId: 'x' });
  run.deck.push({ instanceId: 'own-top', cardId: 'gorefireSlash', upgraded: false, rank: 3 });
  const ids = rankUpCandidates(registries, run, BLADE).map((inst) => inst.instanceId);
  assert.ok(ids.includes('own-rend'));
  assert.ok(!ids.includes('own-bound'), 'an equipment-bound card is the piece\'s');
  assert.ok(!ids.includes('own-top'), 'a card at the track level cannot rise');
  assert.equal(raiseCardRank(registries, run, BLADE, 'own-top'), null);
  assert.equal(run.skills[BLADE].pendingRankUps, 2, 'a refused raise spends nothing');
  assert.equal(raiseCardRank(registries, run, BLADE, 'own-rend').rank, 2);
  assert.equal(run.skills[BLADE].pendingRankUps, 1);
  raiseCardRank(registries, run, BLADE, 'own-rend');
  assert.equal(run.deck.find((c) => c.instanceId === 'own-rend').rank, 3);
  assert.equal(raiseCardRank(registries, run, BLADE, 'own-rend'), null, 'an empty ledger raises nothing');
  assert.deepEqual(validateRunShape(run).filter((p) => /rank/i.test(p)), []);
});

test('a pending rank-up offer and its pick are checked on load', () => {
  const run = bladeRun(3);
  const key = `skillRankUp:${BLADE}:0`;
  run.pendingReward = { schemaVersion: 1, source: 'normal', after: 'map', rewards: { skillRankUps: [{ skillId: BLADE, level: 3 }] }, states: { [key]: 'taken' }, chosenRankUps: { [key]: 'own-rend' } };
  assert.deepEqual(validateRunShape(run).filter((p) => /RankUp|rankUp/.test(p)), []);
  run.pendingReward.states = {};
  assert.ok(validateRunShape(run).some((p) => /chosenRankUps.*Taken/.test(p)));
  run.pendingReward.rewards.skillRankUps = [{ skillId: '', level: -1 }];
  assert.ok(validateRunShape(run).some((p) => /skillRankUps\[0\]\.skillId/.test(p)));
  run.deferredProgression = { skillRankUps: [{ skillId: BLADE, level: 2 }] };
  delete run.pendingReward;
  assert.deepEqual(validateRunShape(run).filter((p) => /deferredProgression/.test(p)), []);
});

test('the reward door raises the chosen card and spends the rank-up', async () => {
  const { MountRewards } = await import('../src/ui/screens/reward.js');
  const { withKitDom } = await import('./helpers/dom.mjs');
  // The kit DOM: the rank-up opens the shared card-upgrade modal (playtest 2026-11-17 item 45a).
  await withKitDom(async () => {
    const app = document.createElement('main'); document.body.append(app);
    const run = bladeRun(2);
    let persisted = 0;
    MountRewards(app, { registries, run, onDone() {}, onPersist: () => { persisted += 1; },
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: {} }, skillRankUps: [{ skillId: BLADE, level: 2, claimOrdinal: 0 }] },
    });
    const row = app.querySelector('.reward-kind[data-kind="skillRankUp"]');
    assert.ok(row, 'the rank-up stands in the list');
    row.click();
    // The rank-up opens the Blacksmith's card-upgrade picker (playtest 2026-11-17 item 45a).
    const mine = () => document.querySelector('.card-upgrade-row[data-instance-id="own-rend"]');
    assert.ok(mine(), 'the owned card is offered');
    assert.match(mine().querySelector('.co-chip').textContent, /Rank 1 → 2/, 'shown with the rank it would rise to');
    mine().click();
    assert.equal(run.deck.find(c => c.instanceId === 'own-rend').rank, undefined, 'choosing the card spends nothing');
    assert.ok(document.querySelector('.card-upgrade-faces'), 'the before and after faces open under it');
    document.querySelector('.card-upgrade-confirm').click();
    assert.equal(run.deck.find((c) => c.instanceId === 'own-rend').rank, 2);
    assert.equal(run.skills[BLADE].pendingRankUps, 0);
    assert.ok(persisted > 0);
    assert.equal(app.querySelector('.reward-kind[data-kind="skillRankUp"]').dataset.state, 'taken');
  });
});

test('a taken rank-up must name its card, and its track must be a card-school track', async () => {
  const { rewardClaimStatus } = await import('../src/model/rewardplan.js');
  const run = bladeRun(3);
  const key = `skillRankUp:${BLADE}:0`;
  run.pendingReward = { schemaVersion: 1, source: 'normal', after: 'map', rewards: { skillRankUps: [{ skillId: BLADE, level: 3 }] }, states: { [key]: 'taken' } };
  assert.ok(validateRunShape(run).some((p) => p.includes(`${key} Taken state requires its chosen card`)));
  const status = rewardClaimStatus(rewardPlan({ skillRankUps: [{ skillId: BLADE, level: 3 }], cardIds: ['rend', 'stomp'] }), {});
  assert.equal(status.requiredChoice.kind, 'card', 'a rank-up names no count, so the card offer is the choice the summary counts');
});
