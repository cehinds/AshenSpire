// Card ranks 11d: a Core track level queues a rank-up and the existing reward-door picker raises a Core card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { awardSkillXp, xpToNext, pendingRankUpRows, coreCardRanks } from '../src/model/skills.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const level = (run, id, n) => awardSkillXp(registries, run, id, Array.from({ length: n }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0), { queueRewards: false, queueRankUps: coreCardRanks(run) });

test('pendingRankUpRows lists queued rank-ups that have a card to raise, and nothing at level 1', () => {
  const run = newRun();
  assert.deepEqual(pendingRankUpRows(registries, run), []);
  level(run, 'item:blade', 1);
  assert.deepEqual(pendingRankUpRows(registries, run), []);
  level(run, 'item:blade', 3);
  const rows = pendingRankUpRows(registries, run);
  assert.equal(rows.length, 1, 'draftsPerCombat caps one per track per door');
  assert.deepEqual([rows[0].skillId, rows[0].level], ['item:blade', 3]);
  // A track whose schools match no deck card offers nothing and keeps its rank-up queued.
  const spell = newRun(); spell.deck = spell.deck.filter((c) => !/cantrip|Spark/i.test(c.cardId));
  awardSkillXp(registries, spell, 'item:magic-focus', 5000, { queueRewards: false, queueRankUps: true });
  assert.ok(spell.skills['item:magic-focus'].pendingRankUps > 0);
});

test('the reward door shows the Core card at its next rank and raises it', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    const app = document.createElement('main'); document.body.append(app);
    const run = newRun();
    level(run, 'item:blade', 3);
    const strike = run.deck.find((c) => c.cardId === 'core.strike');
    let persisted = 0;
    mountRewards(app, { registries, run, onDone() {}, onPersist: () => { persisted += 1; },
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: {} }, skillRankUps: pendingRankUpRows(registries, run) } });
    const row = app.querySelector('.reward-kind[data-kind="skillRankUp"]');
    assert.ok(row, 'the rank-up stands in the list');
    row.click();
    const mine = [...app.querySelectorAll('.reward-row .card')].find((face) => face.dataset.pickId === strike.instanceId);
    assert.ok(mine, 'a Core Strike is offered');
    assert.match(mine.getAttribute('aria-label'), /rank 2$/);
    mine.click();
    app.querySelector('#reward-card-confirm').click();
    app.querySelector('#reward-card-confirm').click();
    assert.equal(strike.rank, 2);
    assert.equal(run.skills['item:blade'].pendingRankUps, 1);
    assert.ok(persisted > 0);
  } finally { Object.assign(globalThis, saved); }
});

test('main.js offers the rank-up door once per victory for Core runs only', () => {
  const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('function showGameProfileReward'), source.indexOf('function showShop'));
  assert.match(block, /coreCardRanks\(run\)/);
  assert.match(block, /pendingRankUpRows\(registries, run\)/);
  assert.match(block, /rankUpsOffered/);
  // A claim is saved with the door's rows and claim state, so a reload resumes it rather than re-offering.
  assert.match(block, /pending\.rankUpRows/);
  assert.match(block, /checkpoint: \(pending\.rankUpCheckpoint \|\|= \{\}\)/);
});

test('a Core run with queued rank-ups and ranked cards is a sound saved run', async () => {
  const { validateRunShape } = await import('../src/model/state.js');
  const run = newRun();
  level(run, 'item:blade', 3);
  run.deck.find((c) => c.cardId === 'core.strike').rank = 3;
  assert.deepEqual(validateRunShape(run), []);
});

test('a reload after a rank-up claim resumes the same door and offers no second rank-up there', async () => {
  const { mountRewards } = await import('../src/ui/screens/reward.js');
  const { rewardDom } = await import('./helpers/reward-dom.mjs');
  const { validateRunShape } = await import('../src/model/state.js');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    let run = newRun();
    level(run, 'item:blade', 5);
    assert.ok(run.skills['item:blade'].pendingRankUps >= 2, 'two rank-ups are queued on one track');
    const queued = run.skills['item:blade'].pendingRankUps;
    run.gameProfilePendingReward = { offerId: '1:n:combat', source: 'combat', after: 'map', levelOffers: 0 };
    let saves = 0, saveJson = null;
    // The same door main.js builds: rows fixed on first open, claim state in rankUpCheckpoint, saved at each claim.
    const open = () => {
      const pending = run.gameProfilePendingReward;
      const rows = pending.rankUpRows || pendingRankUpRows(registries, run);
      const app = document.createElement('main'); document.body.append(app);
      mountRewards(app, { registries, run, onDone() {}, saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
        rewards: { title: 'Rank up', xpGains: { level: 0, tracks: {} }, skillRankUps: (pending.rankUpRows = rows) },
        checkpoint: (pending.rankUpCheckpoint ||= {}),
        onPersist: () => { saves += 1; saveJson = JSON.stringify(run); } });
      return { app, rows };
    };
    const first = open();
    assert.equal(first.rows.length, 1, 'draftsPerCombat caps one per track per door');
    first.app.querySelector('.reward-kind[data-kind="skillRankUp"]').click();
    const strike = run.deck.find((c) => c.cardId === 'core.strike');
    [...first.app.querySelectorAll('.reward-row .card')].find((face) => face.dataset.pickId === strike.instanceId).click();
    first.app.querySelector('#reward-card-confirm').click();
    first.app.querySelector('#reward-card-confirm').click();
    assert.equal(strike.rank, 2);
    assert.equal(run.skills['item:blade'].pendingRankUps, queued - 1);
    // Reload: rebuild from the saved run.
    run = JSON.parse(saveJson);
    assert.deepEqual(validateRunShape(run), []);
    const again = open();
    assert.equal(again.rows.length, 1, 'the reloaded door holds the same one row, not a fresh one from the ledger');
    assert.equal(run.skills['item:blade'].pendingRankUps, queued - 1, 'nothing more is spent');
    const doorRow = again.app.querySelector('.reward-kind[data-kind="skillRankUp"]');
    assert.ok(doorRow, 'the row is still listed');
    assert.equal(doorRow.dataset.state, 'taken', 'the reloaded door shows the row as claimed, not offered again');
    assert.equal(run.gameProfilePendingReward.rankUpCheckpoint.states[doorRow.dataset.key], 'taken', 'the claim is saved on the pending reward');
    // The next victory's door (a new pending reward) offers the remaining rank-up.
    run.gameProfilePendingReward = { offerId: '1:m:combat', source: 'combat', after: 'map', levelOffers: 0 };
    assert.equal(pendingRankUpRows(registries, run).length, 1);
  } finally { Object.assign(globalThis, saved); }
});
