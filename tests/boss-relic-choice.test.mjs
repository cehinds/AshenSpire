// tests/boss-relic-choice.test.mjs — a solo boss victory offers a CHOICE of up
// to balance.rewards.bossRelicChoices boss relics, and the player takes ONE.
//   node --test tests/boss-relic-choice.test.mjs
//
// Covers the engine half (rollRelicChoices), the reward object's source policy,
// the reward plan's relic row, and the run-state validator for the pending
// choice. The UI that shows the choice is a later wave and is not asserted here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { relicInRewardPool } from '../src/model/schemas.js';
import { createRng } from '../src/engine/rng.js';
import { rollRelicChoices, rollRelicReward } from '../src/engine/encounters.js';
import { configuredRewardOffer, pendingRewardCheckpoint } from '../src/model/rewardSourcePolicy.js';
import { resolveContinue, rewardClaimStatus, rewardPlan } from '../src/model/rewardplan.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const REG = createRegistries(contentBundle);
const BOSS_POOL = REG.relics.all().filter((r) => r.rarity === 'boss' && relicInRewardPool(r)).map((r) => r.id);
const rarityOf = (id) => REG.relics.get(id).rarity;

test('the shipped boss pool is large enough to offer three distinct relics', () => {
  assert.equal(REG.balance.rewards.bossRelicChoices, 3, 'the knob ships at 3');
  assert.ok(BOSS_POOL.length >= 3, `boss pool has ${BOSS_POOL.length} relics`);
});

test('rollRelicChoices returns distinct, unowned, boss-rarity relics up to count', () => {
  for (const seed of [1, 7, 0x10a5, 99991]) {
    const picks = rollRelicChoices(REG, createRng(seed), [], { rarities: ['boss'], count: 3 });
    assert.equal(picks.length, 3, `seed ${seed}: three relics offered`);
    assert.equal(new Set(picks).size, picks.length, `seed ${seed}: no repeats`);
    for (const id of picks) assert.equal(rarityOf(id), 'boss', `seed ${seed}: ${id} is a boss relic`);
  }
});

test('rollRelicChoices never offers a relic the run already owns', () => {
  const owned = BOSS_POOL.slice(0, 2);
  const picks = rollRelicChoices(REG, createRng(42), owned, { rarities: ['boss'], count: 3 });
  for (const id of picks) assert.ok(!owned.includes(id), `${id} is already owned`);
  assert.equal(picks.length, 3);
});

test('rollRelicChoices returns fewer when owned relics shrink the pool, and [] when all are owned', () => {
  const owned = BOSS_POOL.slice(0, BOSS_POOL.length - 2);
  const short = rollRelicChoices(REG, createRng(5), owned, { rarities: ['boss'], count: 3 });
  assert.equal(short.length, 2, 'two boss relics left, so two offered');
  assert.ok(short.every((id) => !owned.includes(id)));

  const none = rollRelicChoices(REG, createRng(5), BOSS_POOL, { rarities: ['boss'], count: 3 });
  assert.deepEqual(none, []);
});

test('rollRelicChoices is deterministic for a seed, and draws on the relicRewards stream only', () => {
  const a = createRng(0xbeef);
  const b = createRng(0xbeef);
  assert.deepEqual(rollRelicChoices(REG, a, [], { rarities: ['boss'], count: 3 }),
    rollRelicChoices(REG, b, [], { rarities: ['boss'], count: 3 }));
  const counters = a.getCounters();
  assert.ok(counters.relicRewards >= 3, 'three picks drew from relicRewards');
  for (const [stream, n] of Object.entries(counters)) {
    if (stream !== 'relicRewards') assert.equal(n, 0, `${stream} untouched`);
  }
});

test('rollRelicReward is unchanged for elite drops and still returns one id or null', () => {
  const one = rollRelicReward(REG, createRng(3), [], { rarities: ['boss'] });
  assert.ok(BOSS_POOL.includes(one));
  assert.equal(rollRelicReward(REG, createRng(3), BOSS_POOL, { rarities: ['boss'] }), null, 'null when the pool is empty');
});

test('configuredRewardOffer strips relicChoices when battle relics are off', () => {
  const offer = { relicChoices: ['crownOfStitches', 'wardenHorn', 'ashOfRemembrance'], cinders: 10 };
  const off = configuredRewardOffer(offer, 'boss', (key) => key !== 'rewardBattleRelics');
  assert.equal(off.relicChoices, undefined);
  assert.equal(off.cinders, 10);
  assert.equal(offer.relicChoices.length, 3, 'the rolled offer is not mutated');
  const on = configuredRewardOffer(offer, 'boss', () => true);
  assert.deepEqual(on.relicChoices, offer.relicChoices);
});

test('a 3-choice boss relic offer is one relic row with relicIds and choice true', () => {
  const choices = ['crownOfStitches', 'wardenHorn', 'ashOfRemembrance'];
  const plan = rewardPlan({ relicChoices: choices, cinders: 5 });
  const rows = plan.rows.filter((row) => row.kind === 'relic');
  assert.equal(rows.length, 1, 'one relic row');
  assert.deepEqual(rows[0].relicIds, choices);
  assert.equal(rows[0].choice, true);
});

test('a boss relic choice row is a required pick that is never auto-collected', () => {
  const choices = ['crownOfStitches', 'wardenHorn', 'ashOfRemembrance'];
  const plan = rewardPlan({ relicChoices: choices, cinders: 5 });
  const row = plan.rows.find((r) => r.kind === 'relic');
  const waiting = rewardClaimStatus(plan, {});
  assert.equal(waiting.requiredChoice?.kind, 'relic', 'Continue waits on the relic pick');
  assert.equal(waiting.requiredChoice.count, 3);
  for (const mode of ['auto', 'manual']) {
    const { take, leave } = resolveContinue(plan, {}, mode, () => 0);
    assert.ok(!take.some((r) => r.kind === 'relic'), `${mode}: the relic choice is not auto-collected`);
    assert.ok(leave.some((r) => r.kind === 'relic'), `${mode}: the relic choice is left for the player`);
  }
  assert.equal(rewardClaimStatus(plan, { [row.key]: 'skipped' }).requiredChoice, null, 'a skipped choice no longer blocks');
});

test('a single boss relic (relicId) keeps the one-relic row shape', () => {
  const rows = rewardPlan({ relicId: 'wardenHorn' }).rows.filter((row) => row.kind === 'relic');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].relicId, 'wardenHorn');
  assert.equal(rows[0].relicIds, undefined);
});

test('a pending reward checkpoint starts with no chosen relic', () => {
  const checkpoint = pendingRewardCheckpoint({ relicChoices: ['wardenHorn', 'crownOfStitches'] }, { source: 'boss', after: 'advanceAct' });
  assert.equal(checkpoint.chosenRelicId, null);
});

function bossPending(extra = {}) {
  return {
    schemaVersion: 1, source: 'boss', after: 'advanceAct',
    rewards: { relicChoices: ['crownOfStitches', 'wardenHorn', 'ashOfRemembrance'] },
    states: {}, chosenDraftCardIds: {}, chosenDraftNodeIds: {}, chosenCardId: null,
    ...extra,
  };
}
const pendingProblems = (run) => validateRunShape(run).filter((p) => p.startsWith('pendingReward'));

test('the run-state validator accepts a pending relic choice with a pick from the list', () => {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.pendingReward = bossPending({ chosenRelicId: 'wardenHorn' });
  assert.deepEqual(pendingProblems(run), []);
  run.pendingReward = bossPending({ chosenRelicId: null });
  assert.deepEqual(pendingProblems(run), [], 'no pick yet is fine');
});

test('the run-state validator refuses a chosen relic that is not in the offer', () => {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.pendingReward = bossPending({ chosenRelicId: 'paupersDiadem' });
  assert.ok(pendingProblems(run).some((p) => p.includes('chosenRelicId must belong to')), pendingProblems(run).join('; '));
});

test('the run-state validator refuses duplicate or empty relicChoices', () => {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.pendingReward = bossPending({ rewards: { relicChoices: ['wardenHorn', 'wardenHorn'] } });
  assert.ok(pendingProblems(run).some((p) => p.includes('relicChoices must be an array of distinct')));
  run.pendingReward = bossPending({ rewards: { relicChoices: ['wardenHorn', ''] } });
  assert.ok(pendingProblems(run).some((p) => p.includes('relicChoices must be an array of distinct')));
});

// ---- the reward screen: the chooser, the apply path and the checkpoint ----
// Mounts the production reward screen on the kit stub DOM (tests/helpers/kit-dom.mjs),
// the fixture the other reward-screen tests use.
function mountBossReward(dom, { relicChoices, run, checkpoint = pendingRewardCheckpoint({ relicChoices }, { source: 'boss', after: 'advanceAct' }) }) {
  // The card door's shape watcher reads document.documentElement.dataset; the
  // stub has no <html>, so the body stands in for it (the door reads no more).
  dom.document.documentElement ??= dom.document.body;
  const app = dom.document.createElement('main');
  dom.document.body.replaceChildren(app);
  mountRewards(app, {
    registries: REG, run, onDone() {}, checkpoint,
    onPersist: () => true,
    saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }), saveMeta() {} },
    rewards: { relicChoices },
  });
  return { app, checkpoint };
}
const pickButtons = (app) => app.querySelectorAll('.reward-row .reward-pick').filter((el) => el.tagName === 'BUTTON');
const CHOICES = ['crownOfStitches', 'wardenHorn', 'ashOfRemembrance'];

test('the boss relic choice opens a chooser with one tile per offered relic', () => {
  withKitDom((dom) => {
    const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
    run.relics = [];
    const { app } = mountBossReward(dom, { relicChoices: CHOICES, run });
    app.querySelector('.reward-kind[data-kind="relic"]').click();
    assert.deepEqual(pickButtons(app).map((el) => el.dataset.pickId), CHOICES, 'three relic options, in offer order');
    assert.equal(app.querySelector('#reward-card-confirm').disabled, true, 'nothing picked, nothing to confirm');
  });
});

test('confirming one boss relic adds exactly that relic and checkpoints the pick', () => {
  withKitDom((dom) => {
    const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
    run.relics = [];
    const { app, checkpoint } = mountBossReward(dom, { relicChoices: CHOICES, run });
    app.querySelector('.reward-kind[data-kind="relic"]').click();
    pickButtons(app)[1].click();
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(run.relics, ['wardenHorn'], 'exactly the picked relic is held');
    assert.equal(checkpoint.chosenRelicId, 'wardenHorn', 'the pick is checkpointed');
    assert.equal(checkpoint.states.relic, 'taken');
  });
});

test('a boss relic pick the run already holds lands nothing', () => {
  withKitDom((dom) => {
    const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
    run.relics = ['wardenHorn'];
    const { app, checkpoint } = mountBossReward(dom, { relicChoices: CHOICES, run });
    app.querySelector('.reward-kind[data-kind="relic"]').click();
    pickButtons(app)[1].click();
    app.querySelector('#reward-card-confirm').click();
    assert.deepEqual(run.relics, ['wardenHorn'], 'no second copy');
    assert.equal(checkpoint.states.relic, undefined, 'the row is not Taken');
    assert.equal(checkpoint.chosenRelicId, null);
  });
});

test('Continue holds on a boss relic choice until it is picked or skipped', () => {
  withKitDom((dom) => {
    const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
    run.relics = [];
    const { app, checkpoint } = mountBossReward(dom, { relicChoices: CHOICES, run });
    assert.equal(app.querySelector('#reward-continue').disabled, true, 'held while the choice waits');
    app.querySelector('.reward-kind[data-kind="relic"]').click();
    pickButtons(app)[0].click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(app.querySelector('#reward-continue').disabled, false, 'released once picked');
    assert.equal(checkpoint.chosenRelicId, 'crownOfStitches');
  });
});

test('Skip releases a boss relic choice without taking a relic', () => {
  withKitDom((dom) => {
    const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
    run.relics = [];
    const { app, checkpoint } = mountBossReward(dom, { relicChoices: CHOICES, run });
    app.querySelector('.reward-skip').click();
    assert.equal(checkpoint.states.relic, 'skipped');
    assert.equal(app.querySelector('#reward-continue').disabled, false, 'released once skipped');
    assert.deepEqual(run.relics, [], 'nothing taken');
  });
});

test('the run-state validator refuses a Taken relic choice with no chosen relic', () => {
  const run = createRunState({ seed: 0x10a5, classId: 'reaver', registries: REG });
  run.pendingReward = bossPending({ states: { relic: 'taken' }, chosenRelicId: null });
  assert.ok(pendingProblems(run).some((p) => p.includes('relic Taken state requires chosenRelicId')), pendingProblems(run).join('; '));
  run.pendingReward = bossPending({ states: { relic: 'taken' }, chosenRelicId: 'wardenHorn' });
  assert.deepEqual(pendingProblems(run), [], 'a Taken choice that names its pick is fine');
  run.pendingReward = bossPending({ states: { relic: 'skipped' }, chosenRelicId: null });
  assert.deepEqual(pendingProblems(run), [], 'a skipped choice needs no pick');
});
