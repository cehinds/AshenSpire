// Card ranks 11d: a Core track level queues a rank-up and the existing reward-door picker raises a Core card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { rankUpBonusOptions } from '../src/model/rankUpBonus.js';
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
  const { MountRewards } = await import('../src/ui/screens/reward.js');
  const { withKitDom } = await import('./helpers/dom.mjs');
  // The kit DOM: the rank-up opens the shared card-upgrade modal (playtest 2026-11-17 item 45a).
  await withKitDom(async () => {
    const app = document.createElement('main'); document.body.append(app);
    const run = newRun();
    level(run, 'item:blade', 3);
    const strike = run.deck.find((c) => c.cardId === 'core.strike');
    let persisted = 0;
    MountRewards(app, { registries, run, onDone() {}, onPersist: () => { persisted += 1; },
      saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
      rewards: { xpGains: { level: 0, tracks: {} }, skillRankUps: pendingRankUpRows(registries, run) } });
    const row = app.querySelector('.reward-kind[data-kind="skillRankUp"]');
    assert.ok(row, 'the rank-up stands in the list');
    row.click();
    // The Blacksmith's card-upgrade picker (playtest 2026-11-17 item 45a): choose the card, its bonus options open
    // under it in the same option design the Blacksmith uses, and Rank up commits the picked one.
    const mine = () => document.querySelector(`.card-upgrade-row[data-instance-id="${strike.instanceId}"]`);
    assert.ok(mine(), 'a Core Strike is offered');
    assert.match(mine().querySelector('.co-chip').textContent, /Rank 1 → 2/);
    const expected = rankUpBonusOptions(registries, run, strike)[1].step;
    mine().click();
    const bonuses = [...document.querySelectorAll('.card-upgrade-option')];
    assert.ok(bonuses.length >= 2 && bonuses.length <= 3, `bonus options: ${bonuses.length}`);
    bonuses[1].click();
    assert.equal(document.querySelector('.card-upgrade-confirm').disabled, false);
    assert.equal(strike.rank, undefined, 'picking a bonus spends nothing');
    document.querySelector('.card-upgrade-confirm').click();
    assert.equal(strike.rank, 2);
    assert.equal(strike.upgradeSteps.length, 1, 'exactly the one picked bonus landed');
    assert.equal(strike.upgradeSteps[0].bonus, true);
    assert.deepEqual(strike.upgradeSteps[0], expected, 'the second option, the one picked');
    assert.equal(run.skills['item:blade'].pendingRankUps, 1);
    assert.ok(persisted > 0);
  });
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
  const { MountRewards } = await import('../src/ui/screens/reward.js');
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { validateRunShape } = await import('../src/model/state.js');
  // The kit DOM: the rank-up opens the shared card-upgrade modal (playtest 2026-11-17 item 45a).
  await withKitDom(async () => {
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
      MountRewards(app, { registries, run, onDone() {}, saves: { loadMeta: () => ({ settings: { levelUpRefillSeconds: 0 } }) },
        rewards: { title: 'Rank up', xpGains: { level: 0, tracks: {} }, skillRankUps: (pending.rankUpRows = rows) },
        checkpoint: (pending.rankUpCheckpoint ||= {}),
        onPersist: () => { saves += 1; saveJson = JSON.stringify(run); } });
      return { app, rows };
    };
    const first = open();
    assert.equal(first.rows.length, 1, 'draftsPerCombat caps one per track per door');
    first.app.querySelector('.reward-kind[data-kind="skillRankUp"]').click();
    const strike = run.deck.find((c) => c.cardId === 'core.strike');
    document.querySelector(`.card-upgrade-row[data-instance-id="${strike.instanceId}"]`).click();
    document.querySelector('.card-upgrade-option').click();
    document.querySelector('.card-upgrade-confirm').click();
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
  });
});

// Review on #2817: a rank-up with exactly one bonus option showed the bonus but committed the bare rise. With one
// option the picker has no choice to make and commits the row's plan, so the plan must carry that option's step.
test('a rank-up with one bonus option commits that bonus', async () => {
  const { RankUpUpgradeModel } = await import('../src/ui/models/CardUpgradeModel.js');
  const { MountCardUpgradeModal } = await import('../src/ui/components/cardUpgradeModal.js');
  const { projectGameCard } = await import('../src/model/gameProfile.js');
  const { resolveCard } = await import('../src/model/registries.js');
  const { withKitDom } = await import('./helpers/dom.mjs');
  const run = newRun();
  level(run, 'item:blade', 3);
  const strike = run.deck.find((c) => c.cardId === 'core.strike');
  const faceOf = (instance) => projectGameCard(run, instance) || resolveCard(registries, instance);
  const model = RankUpUpgradeModel(registries, run, 'item:blade', strike.instanceId, { faceOf });
  for (const row of model.rows) assert.deepEqual(row.plan.step, row.options[0].step, `${row.name}: the plan carries the first option's step`);
  const [lone] = model.selected.options;
  assert.ok(lone.step?.bonus, 'the first option is a bonus step');
  const oneOption = { ...model, selected: { ...model.selected, options: [lone] } };
  await withKitDom(async (dom) => {
    const host = dom.document.createElement('main'); dom.document.body.append(host);
    let confirmed = null;
    MountCardUpgradeModal(host, oneOption, { registries, meta: {}, onSelect() {}, onBack() {}, onConfirm: (id, plan) => { confirmed = { id, plan }; } });
    assert.equal(host.querySelector('.card-upgrade-options'), null, 'one option is no choice: no option list');
    host.querySelector('.card-upgrade-confirm').click();
    assert.equal(confirmed?.id, strike.instanceId);
    assert.deepEqual(confirmed.plan.step, lone.step, 'the lone bonus is what commits');
  });
});
