// tests/boss-relic-choice.test.mjs — SPEC §6.1: a boss offers a choice of
// distinct boss relics and the player keeps exactly one (or none).
//
// Two halves. The ENGINE roll (encounters.js rollBossRelicChoices): distinct,
// deterministic by seed, never an owned or non-boss relic, fewer on a short
// pool, empty on an exhausted one. The REWARD FLOW (rewardplan.js + the real
// reward screen on the fake DOM helper): the row is a choice, a pick grants
// one, Skip grants none, auto-collect grants one, and a checkpoint saved with
// the choice pending or taken re-mounts without granting twice.

import test from 'node:test';
import assert from 'node:assert/strict';

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { rollBossRelicChoices } from '../src/engine/encounters.js';
import { rewardPlan, resolveContinue, unseenIds } from '../src/model/rewardplan.js';
import { mountRewards } from '../src/ui/screens/reward.js';
import { rewardDom } from './helpers/reward-dom.mjs';

const REG = createRegistries(contentBundle);
const BOSS = REG.relics.all().filter((r) => r.rarity === 'boss').map((r) => r.id);
const COUNT = REG.balance.rewards.bossRelicChoices;

test('the choice count and consolation are authored balance numbers', () => {
  assert.equal(COUNT, 3);
  assert.ok(REG.balance.rewards.bossRelicConsolationCinders > 0);
  assert.ok(BOSS.length > COUNT, 'enough boss relics ship for a full choice');
});

test('a boss roll offers 3 distinct boss relics', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const ids = rollBossRelicChoices(REG, createRng(seed), []);
    assert.equal(ids.length, COUNT, `seed ${seed} offers ${COUNT}`);
    assert.equal(new Set(ids).size, ids.length, `seed ${seed} ids are distinct`);
    for (const id of ids) assert.equal(REG.relics.get(id).rarity, 'boss', `${id} is a boss relic`);
  }
});

test('the roll is deterministic by seed and varies across seeds', () => {
  assert.deepEqual(rollBossRelicChoices(REG, createRng(7), [BOSS[0]]), rollBossRelicChoices(REG, createRng(7), [BOSS[0]]));
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) seen.add(rollBossRelicChoices(REG, createRng(seed), []).join(','));
  assert.ok(seen.size > 1, 'different seeds lay out different choices');
});

test('owned boss relics are never offered', () => {
  const owned = BOSS.slice(0, 2);
  for (let seed = 1; seed <= 40; seed++) {
    const ids = rollBossRelicChoices(REG, createRng(seed), owned);
    assert.equal(ids.length, Math.min(COUNT, BOSS.length - owned.length));
    for (const id of owned) assert.ok(!ids.includes(id), `seed ${seed} never offers owned ${id}`);
  }
});

test('a short pool offers fewer, an exhausted pool none', () => {
  const leaveTwo = BOSS.slice(0, BOSS.length - 2);
  const two = rollBossRelicChoices(REG, createRng(3), leaveTwo);
  assert.deepEqual([...two].sort(), BOSS.slice(-2).sort());
  const one = rollBossRelicChoices(REG, createRng(3), BOSS.slice(0, -1));
  assert.deepEqual(one, BOSS.slice(-1));
  assert.deepEqual(rollBossRelicChoices(REG, createRng(3), BOSS), []);
});

test('the plan derives one relic row: a choice for 2+, a take for 1, the single path unchanged', () => {
  const choice = rewardPlan({ relicIds: ['a', 'b', 'c'] }).rows;
  assert.equal(choice.length, 1);
  assert.equal(choice[0].kind, 'relic');
  assert.equal(choice[0].choice, true);
  assert.deepEqual(choice[0].relicIds, ['a', 'b', 'c']);
  assert.deepEqual(rewardPlan({ relicIds: ['a'] }).rows[0].relicId, 'a');
  assert.equal(rewardPlan({ relicIds: ['a'] }).rows[0].choice, undefined);
  assert.deepEqual(rewardPlan({ relicIds: [] }).rows, []);
  // The elite/treasure single relic (and a pre-choice boss save) reads as before.
  const single = rewardPlan({ relicId: 'forsakenMedallion' }).rows[0];
  assert.equal(single.relicId, 'forsakenMedallion');
  assert.equal(single.choice, undefined);
  // Auto-collect resolves the choice to exactly one id through the seeded pick.
  const { take } = resolveContinue({ rows: choice }, {}, 'auto', () => 2);
  assert.deepEqual(take.map((row) => row.relicId), ['c']);
  assert.equal(resolveContinue({ rows: choice }, { relic: 'skipped' }, 'auto').take.length, 0, 'an explicit skip is respected');
  assert.equal(resolveContinue({ rows: choice }, {}, 'manual').take.length, 0, 'manual Continue leaves it');
  assert.deepEqual(unseenIds({ relicIds: ['a', 'b'] }, { relics: new Set(['a']) }).relics, ['b']);
});

function withDom(fn) {
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try { return fn(dom); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

const offer = () => ({ title: 'BOSS', relicIds: BOSS.slice(0, 3) });
const freshRun = () => ({ cinders: 0, deck: [], flasks: [], relics: [], loadout: { storage: [] } });

test('the reward screen grants exactly the one relic picked', () => withDom(() => {
  const app = document.createElement('main'); document.body.append(app);
  const run = freshRun();
  const checkpoint = { states: {}, chosenCardId: null, chosenRelicId: null };
  mountRewards(app, { registries: REG, run, checkpoint, rewards: offer(), onDone() {}, onPersist() {} });
  assert.ok(app.querySelector('.reward-claim-required'), 'the relic choice is a required choice');
  app.querySelector('[data-kind="relic"]').click();
  const tiles = app.querySelectorAll('.reward-row .reward-relic');
  assert.deepEqual(tiles.map((tile) => tile.dataset.relicId), BOSS.slice(0, 3), 'three tiles, in offer order');
  const confirm = app.querySelector('#reward-card-confirm');
  assert.equal(confirm.disabled, true, 'no selection cannot confirm');
  tiles[0].click(); tiles[1].click();
  assert.deepEqual(run.relics, [], 'selection never grants');
  confirm.click(); confirm.click();
  assert.deepEqual(run.relics, [BOSS[1]], 'exactly the chosen relic, once');
  assert.equal(checkpoint.states.relic, 'taken');
  assert.equal(checkpoint.chosenRelicId, BOSS[1]);
  assert.equal(app.querySelector('[data-kind="relic"]').dataset.state, 'taken');
  // A reload of the taken checkpoint re-mounts Taken and grants nothing more.
  const again = document.createElement('main'); document.body.append(again);
  mountRewards(again, { registries: REG, run, checkpoint, rewards: offer(), onDone() {}, onPersist() {} });
  assert.equal(again.querySelector('[data-kind="relic"]').dataset.state, 'taken');
  assert.deepEqual(run.relics, [BOSS[1]]);
}));

test('Skip leaves every boss relic behind', () => withDom(() => {
  const app = document.createElement('main'); document.body.append(app);
  const run = freshRun();
  const checkpoint = { states: {}, chosenCardId: null };
  let done = false;
  mountRewards(app, { registries: REG, run, checkpoint, rewards: offer(), onDone() { done = true; }, onPersist() {} });
  app.querySelector('[data-kind="relic"]').click();
  app.querySelector('#reward-relic-skip').click();
  assert.equal(checkpoint.states.relic, 'skipped');
  assert.equal(app.querySelector('[data-kind="relic"]').dataset.state, 'skipped');
  assert.deepEqual(run.relics, []);
  assert.equal(done, false);
}));

test('a refused save puts a boss relic Skip back, so the choice can be retried', () => withDom(() => {
  const app = document.createElement('main'); document.body.append(app);
  const run = freshRun();
  const checkpoint = { states: {}, chosenCardId: null, chosenRelicId: null };
  let refuse = true;
  mountRewards(app, { registries: REG, run, checkpoint, rewards: offer(), onDone() {}, onPersist: () => !refuse });
  app.querySelector('[data-kind="relic"]').click();
  const checkpointBefore = structuredClone(checkpoint);
  app.querySelector('#reward-relic-skip').click();
  assert.deepEqual(checkpoint, checkpointBefore, 'the refused skip leaves the checkpoint as it was');
  assert.ok(app.querySelector('#reward-relic-skip'), 'the chooser stays open');
  // The choice is still live: a relic can be kept on retry.
  refuse = false;
  app.querySelectorAll('.reward-row .reward-relic')[2].click();
  app.querySelector('#reward-card-confirm').click();
  assert.deepEqual(run.relics, [BOSS[2]]);
  assert.equal(checkpoint.states.relic, 'taken');
}));

test('a checkpoint saved with the chooser pending re-mounts the same choice, nothing granted', () => withDom(() => {
  const run = freshRun();
  // An older checkpoint has no chosenRelicId field at all.
  const checkpoint = structuredClone({ states: {}, chosenCardId: null });
  const app = document.createElement('main'); document.body.append(app);
  mountRewards(app, { registries: REG, run, checkpoint, rewards: offer(), onDone() {}, onPersist() {} });
  assert.equal(app.querySelector('[data-kind="relic"]').dataset.state, 'pending');
  app.querySelector('[data-kind="relic"]').click();
  assert.equal(app.querySelectorAll('.reward-row .reward-relic').length, 3);
  assert.deepEqual(run.relics, []);
}));

test('a refused Continue hands its auto-pick draws back, so the retry picks what a reload would', () => withDom((dom) => {
  dom.document.addEventListener = () => {};
  dom.document.removeEventListener = () => {};
  const saves = { loadMeta: () => ({ settings: { rewardCollect: 'auto' } }), saveMeta() {} };
  const collect = (seed, refuseFirst) => {
    const app = document.createElement('main'); document.body.append(app);
    const run = freshRun();
    const rng = createRng(seed);
    let refuse = refuseFirst;
    mountRewards(app, { registries: REG, run, rng, saves, checkpoint: { states: {}, chosenCardId: null, chosenRelicId: null }, rewards: offer(), onDone() {}, onPersist: () => !refuse });
    if (refuseFirst) {
      assert.throws(() => app.querySelector('#reward-continue').click(), /Reward save was refused/);
      assert.deepEqual(run.relics, [], 'the refused save granted nothing');
      refuse = false;
    }
    app.querySelector('#reward-continue').click();
    return { relics: run.relics, counters: rng.getCounters() };
  };
  for (let seed = 1; seed <= 12; seed++) {
    assert.deepEqual(collect(seed, true), collect(seed, false), `seed ${seed}: same relic, same counters`);
  }
}));

test('a corrupt or stale boss relic choice is refused at the save doors, by name', async () => {
  const { createRunState, validateRunShape } = await import('../src/model/state.js');
  const { createSaveManager, createMemoryStorage, RUN_KEY } = await import('../src/engine/save.js');
  const run = createRunState({ registries: REG, classId: 'reaver', seed: 4 });
  const pending = (rewards, extra = {}) => ({
    schemaVersion: 1, source: 'boss', after: 'advanceAct', rewards, states: {}, chosenCardId: null,
    chosenDraftCardIds: {}, chosenDraftNodeIds: {}, ...extra,
  });
  const shape = (rewards, extra) => { run.pendingReward = pending(rewards, extra); return validateRunShape(run).join(' | '); };
  const ids = BOSS.slice(0, 3);
  assert.equal(shape({ relicIds: ids }), '');
  assert.equal(shape({ relicIds: ids }, { states: { relic: 'taken' }, chosenRelicId: ids[1] }), '');
  assert.equal(shape({ relicIds: [] }), '', 'an empty pool (consolation) is a valid offer');
  assert.match(shape({ relicIds: 'x' }), /relicIds must be an array of relic ids/);
  assert.match(shape({ relicIds: [ids[0], 3] }), /relicIds must be an array of relic ids/);
  assert.match(shape({ relicIds: [ids[0], ids[0]] }), /relicIds must be distinct/);
  assert.match(shape({ relicIds: ids }, { states: { relic: 'taken' }, chosenRelicId: 'other' }), /chosenRelicId must belong to pendingReward\.rewards\.relicIds/);
  assert.match(shape({ relicIds: ids }, { chosenRelicId: ids[0] }), /chosenRelicId requires relic Taken state/);
  assert.match(shape({ relicIds: ids }, { states: { relic: 'taken' } }), /relic Taken state requires chosenRelicId/);
  assert.match(shape({ relicIds: ids }, { states: { relic: 'taken' }, chosenRelicId: 7 }), /chosenRelicId must be null or a non-empty string/);
  // Well-shaped but naming a relic the content does not hold: the load door refuses.
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const load = (relicIds) => {
    delete run.pendingReward;
    saves.saveRun(run, createRng(1));
    const raw = JSON.parse(storage.getItem(RUN_KEY));
    raw.pendingReward = pending({ relicIds });
    storage.setItem(RUN_KEY, JSON.stringify(raw));
    return saves.loadRun(REG) ? '' : saves.runStatus().reason;
  };
  assert.equal(load(ids), '');
  assert.match(load([ids[0], 'noSuchRelic']), /boss relic choice 'noSuchRelic' is unknown/);
});

test('a refused save puts a blocked row\'s menu Skip back, without throwing (#1287)', () => withDom(() => {
  const app = document.createElement('main'); document.body.append(app);
  const cap = REG.balance.equipment.storageSlots || 8;
  const armamentId = REG.equipment.armaments[0].id;
  const run = { ...freshRun(), loadout: { storage: Array.from({ length: cap }, () => armamentId) } };
  const checkpoint = { states: {}, chosenCardId: null, chosenRelicId: null };
  let refuse = true;
  mountRewards(app, { registries: REG, run, checkpoint, rewards: { title: 'ELITE', armamentId }, onDone() {}, onPersist: () => !refuse });
  const row = app.querySelector('[data-kind="armament"]');
  assert.equal(row.dataset.state, 'blocked', 'a full bag blocks the armament row');
  const checkpointBefore = structuredClone(checkpoint);
  assert.doesNotThrow(() => app.querySelector('[data-skip="armament"]').click(), 'a refused skip is not an uncaught throw');
  assert.deepEqual(checkpoint.states, checkpointBefore.states, 'the refused skip is rolled back');
  assert.match(app.querySelector('#reward-hold-copy').textContent, /could not be saved/);
  // The retry lands.
  refuse = false;
  app.querySelector('[data-skip="armament"]').click();
  assert.equal(checkpoint.states.armament, 'skipped');
  assert.equal(app.querySelector('[data-kind="armament"]').dataset.state, 'skipped');
}));
