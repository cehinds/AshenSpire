// W25-R step 1: a won fight can offer "Rank up a card" as one option of its reward door (5% normal, 25% elite/boss).
import { FillUpgradeSlots } from './helpers/rank-up-ready.mjs';
import { OwnCardRank } from '../src/model/cardRank.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { UpgradeSlots } from '../src/model/cardUpgradeLimits.js';
import { InstanceRank, RankUpCandidates } from '../src/model/rankUpService.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), {})), profile);
// Owner 2026-11-23: rank-up needs a fully upgraded card (on by default), so these runs start with every slot used.
const newRun = (seed = 9) => {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: 'w25-rankup-reward' });
  FillUpgradeSlots(run);
  return run;
};
const hasRankUp = (offer) => offer.options.some((option) => option.kind === 'rankUps');

function offerFor(run, n, pool) {
  const offerId = `1:n${n}:combat`;
  return gameProfileRewardOffers(registries, run, createRng(run.seed), { offerId, source: 'combat', pool });
}

test('the chance follows the fight tier and the seed: elite and boss about 25%, normal about 5%', () => {
  const rate = (pool) => {
    const run = newRun();
    let hits = 0;
    for (let n = 0; n < 600; n += 1) if (hasRankUp(offerFor(run, n, pool))) hits += 1;
    return hits / 6;
  };
  const [normal, elite, boss] = ['normal', 'elite', 'boss'].map(rate);
  assert.ok(normal > 2 && normal < 9, `normal ${normal}`);
  assert.ok(elite > 19 && elite < 31, `elite ${elite}`);
  assert.ok(boss > 19 && boss < 31, `boss ${boss}`);
});

test('the same door answers the same way every time, and it draws nothing from the streams', () => {
  const a = newRun(), b = newRun();
  const rngA = createRng(a.seed), rngB = createRng(b.seed);
  const first = gameProfileRewardOffers(registries, a, rngA, { offerId: '1:n:combat', source: 'combat', pool: 'elite' });
  const again = gameProfileRewardOffers(registries, a, rngA, { offerId: '1:n:combat', source: 'combat', pool: 'elite' });
  assert.equal(first, again, 'cached by id');
  const other = gameProfileRewardOffers(registries, b, rngB, { offerId: '1:n:combat', source: 'combat', pool: 'elite' });
  assert.deepEqual(other.options, first.options, 'deterministic on the seed');
  assert.deepEqual(rngA.getCounters(), rngB.getCounters());
  // The roll itself consumes no stream: the same offer without the option would leave the same counters.
  const normalA = newRun(), rngN = createRng(normalA.seed);
  gameProfileRewardOffers(registries, normalA, rngN, { offerId: '1:n:combat', source: 'combat', pool: 'normal' });
  assert.deepEqual(rngN.getCounters(), rngA.getCounters(), 'tier changes the roll, never the streams');
});

test('claiming a rank-up raises the chosen card by one rank, its slots follow, and the rank-up is spent', () => {
  const run = newRun();
  let offer = null, n = 0;
  while (!offer) { const found = offerFor(run, n += 1, 'elite'); if (hasRankUp(found)) offer = found; assert.ok(n < 500, 'a rank-up offer exists'); }
  const index = offer.options.findIndex((option) => option.kind === 'rankUps');
  // Owner 2026-11-18: a combat rank-up is always its own step (bonus: true), never one of the card picks.
  assert.deepEqual(offer.options[index], { kind: 'rankUps', id: 'cardRank', bonus: true });
  const card = RankUpCandidates(registries, run)[0];
  card.rank = 1; // a "Rank 1" card: slots are rank + 1, so each raise opens one
  FillUpgradeSlots(run, [card]);
  const rank = InstanceRank(card), slots = UpgradeSlots(run, card);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index), /Choose a card/);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index, { instanceId: 'nobody' }), /cannot be ranked up/);
  assert.equal(InstanceRank(RankUpCandidates(registries, run).find((row) => row.instanceId === card.instanceId)), rank, 'a refused claim changes nothing');
  const receipt = claimGameProfileReward(registries, run, offer.id, index, { instanceId: card.instanceId });
  assert.deepEqual([receipt.kind, receipt.instanceId, receipt.rank], ['rankUps', card.instanceId, rank + 1]);
  const raised = RankUpCandidates(registries, run).find((row) => row.instanceId === card.instanceId); // a claim swaps in a clone
  assert.equal(InstanceRank(raised), rank + 1);
  assert.equal(UpgradeSlots(run, raised), slots + 1);
  // Owner 2026-11-18: the rank-up is its own step, so it never closes the offer's card picks.
  assert.deepEqual(run.gameProfileRewardOffers[offer.id].taken, [index]);
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index, { instanceId: card.instanceId }), /already claimed/);
});

test('a run whose profile carries no rankUp data lays out the offer it always did', () => {
  const run = newRun();
  delete run.gameProfile.content.rewards.rankUp;
  for (let n = 0; n < 300; n += 1) assert.ok(!hasRankUp(offerFor(run, n, 'boss')));
});

// Owner 2026-11-15: "a chance for both, but usually one of the picks".
const bonusOf = (offer) => offer.options.findIndex((option) => option.kind === 'rankUps' && option.bonus);
const cardIndex = (offer) => offer.options.findIndex((option) => option.kind === 'combatCards');

test('a rank-up is always its own step, never a card pick (owner 2026-11-18, replaces rankUp.bonusPickPct); the roll draws no stream', () => {
  const run = newRun();
  let seen = 0;
  for (let n = 0; n < 800; n += 1) {
    const offer = offerFor(run, n, 'boss');
    if (!hasRankUp(offer)) continue;
    seen += 1;
    assert.ok(bonusOf(offer) >= 0, 'every combat rank-up carries bonus: true');
  }
  assert.ok(seen > 0, 'boss doors offer rank-ups');
  const a = newRun(), b = newRun();
  assert.deepEqual(offerFor(a, 3, 'boss'), offerFor(b, 3, 'boss'));
});

function runWithOffer(wantBonus) {
  for (let seed = 1; seed < 400; seed += 1) {
    const run = newRun(seed), offer = offerFor(run, 1, 'boss');
    if (hasRankUp(offer) && (bonusOf(offer) >= 0) === wantBonus) return { run, offer };
  }
  throw new Error('no seed');
}

test('the bonus offer lets you claim a card AND a rank-up, in either order', () => {
  for (const cardFirst of [true, false]) {
    const { run, offer } = runWithOffer(true);
    const rankAt = bonusOf(offer), card = cardIndex(offer);
    const target = RankUpCandidates(registries, run)[0].instanceId, before = OwnCardRank(RankUpCandidates(registries, run)[0]);
    const claimRank = () => claimGameProfileReward(registries, run, offer.id, rankAt, { instanceId: target });
    const claimCard = () => claimGameProfileReward(registries, run, offer.id, card);
    if (cardFirst) { claimCard(); assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null, 'the bonus is still open'); claimRank(); } else { claimRank(); assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null); claimCard(); }
    assert.notEqual(run.gameProfileRewardOffers[offer.id].claimed, null);
    assert.equal(OwnCardRank(run.deck.concat(run.sideboard).find((c) => c.instanceId === target)), before + 1);
    assert.ok(run.sideboard.some((c) => c.instanceId === `reward:${offer.id}:${card}`));
    const second = offer.options.findIndex((o, i) => i !== card && i !== rankAt && o.kind === 'combatCards');
    if (second >= 0) assert.throws(() => claimGameProfileReward(registries, run, offer.id, second));
  }
});

test('the offer lets you take the card and then the rank-up, its own step (owner 2026-11-18)', () => {
  const { run, offer } = runWithOffer(true);
  const rankAt = offer.options.findIndex((option) => option.kind === 'rankUps');
  claimGameProfileReward(registries, run, offer.id, cardIndex(offer));
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null, 'the rank-up is still owed');
  claimGameProfileReward(registries, run, offer.id, rankAt, { instanceId: RankUpCandidates(registries, run)[0].instanceId });
  assert.notEqual(run.gameProfileRewardOffers[offer.id].claimed, null);
});

test('a saved offer without the bonus field still claims the rank-up; its taken rank-up stays the plain pick it was (IsBonusOption, 2026-11-18)', () => {
  const { run, offer } = runWithOffer(true);
  for (const option of offer.options) delete option.bonus; // an older saved offer lists the rank-up without the field
  assert.ok(offer.options.every((option) => option.bonus === undefined));
  const rankAt = offer.options.findIndex((option) => option.kind === 'rankUps');
  claimGameProfileReward(registries, run, offer.id, rankAt, { instanceId: RankUpCandidates(registries, run)[0].instanceId });
  // Before the ruling that rank-up used the offer's pick, so once taken it is no bonus and the offer closes.
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, rankAt);
});
