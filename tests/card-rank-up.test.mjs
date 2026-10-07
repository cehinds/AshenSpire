// tests/card-rank-up.test.mjs — SPEC §13.4o B2b: each level of a card-school
// track from 2 on queues a rank-up; the reward door offers it beside the
// level's draft, and taking it raises one owned card of the track's schools
// by one rank, never past the track's level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyContentBundle as contentBundle } from './helpers/legacy-progression-content.mjs';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { awardSkillXp, xpToNext, rankUpCandidates, raiseCardRank, skillsProblems, bankSkillXp, claimBankedSkillLevel } from '../src/model/skills.js';
import { rewardPlan } from '../src/model/rewardplan.js';
import { mergeProgressionRewards, unclaimedProgressionRewards } from '../src/model/deferredProgression.js';

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
  run.deck.push({ instanceId: 'own-rend', cardId: 'rend', upgraded: false });
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
  bankSkillXp(registries, banked, BLADE, xpToNext(registries, 'weapon', 0) + xpToNext(registries, 'weapon', 1));
  claimBankedSkillLevel(registries, banked, BLADE);
  assert.equal(banked.skills[BLADE].pendingRankUps, undefined, 'claiming level 1 queues none');
  claimBankedSkillLevel(registries, banked, BLADE);
  assert.equal(banked.skills[BLADE].pendingRankUps, 1, 'claiming level 2 queues one');
  assert.deepEqual(skillsProblems(run.skills), []);
  assert.ok(skillsProblems({ [BLADE]: { xp: 0, level: 2, pendingDrafts: 0, pendingRankUps: -1 } }).length);
});

test('a rank-up raises an ordinary owned card of the schools, never past the track level', () => {
  const run = bladeRun(3);
  run.deck.push({ instanceId: 'own-bound', cardId: 'rend', upgraded: false, sourceArmamentId: 'x' });
  run.deck.push({ instanceId: 'own-top', cardId: 'rend', upgraded: false, rank: 3 });
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

test('rank-ups are keyed rows that survive a deferral without multiplying', () => {
  const run = bladeRun(3);
  const offer = { skillRankUps: [{ skillId: BLADE, level: 3, claimOrdinal: 0 }, { skillId: BLADE, level: 3, claimOrdinal: 0 }] };
  const rows = rewardPlan(offer).rows.filter((row) => row.kind === 'skillRankUp');
  assert.deepEqual(rows.map((row) => row.key), [`skillRankUp:${BLADE}:0`, `skillRankUp:${BLADE}:1`]);
  assert.ok(rows.every((row) => row.choice));
  const deferred = unclaimedProgressionRewards({ rewards: mergeProgressionRewards({}, offer, run), states: { [`skillRankUp:${BLADE}:0`]: 'taken' } });
  assert.equal(deferred.skillRankUps.length, 1);
  const next = mergeProgressionRewards(deferred, offer, run);
  assert.equal(next.skillRankUps.length, 2, 'the saved rank-up reserves one fresh one; the other is new');
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
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = bladeRun(2);
    let persisted = 0;
    mountRewards(app, { registries, run, onDone() {}, onPersist: () => { persisted += 1; },
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: {} }, skillRankUps: [{ skillId: BLADE, level: 2, claimOrdinal: 0 }] },
    });
    const row = app.querySelector('.reward-kind[data-kind="skillRankUp"]');
    assert.ok(row, 'the rank-up stands in the list');
    row.click();
    const faces = [...app.querySelectorAll('.reward-row .card')];
    const mine = faces.find((face) => face.dataset.pickId === 'own-rend');
    assert.ok(mine, 'the owned card is offered');
    assert.match(mine.getAttribute('aria-label'), /rank 2$/, 'shown at the rank it would rise to');
    mine.click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(run.deck.find((c) => c.instanceId === 'own-rend').rank, 2);
    assert.equal(run.skills[BLADE].pendingRankUps, 0);
    assert.ok(persisted > 0);
    assert.equal(app.querySelector('.reward-kind[data-kind="skillRankUp"]').dataset.state, 'taken');
  } finally { Object.assign(globalThis, saved); }
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
