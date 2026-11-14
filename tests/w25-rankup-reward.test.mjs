// W25-R step 1: a won fight can offer "Rank up a card" as one option of its reward door (5% normal, 25% elite/boss).
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
const newRun = (seed = 9) => createRunState({ seed, classId: 'reaver', registries, runId: 'w25-rankup-reward' });
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

test('claiming a rank-up raises the chosen card by one rank, its slots follow, and the offer is spent', () => {
  const run = newRun();
  let offer = null, n = 0;
  while (!offer) { const found = offerFor(run, n += 1, 'elite'); if (hasRankUp(found)) offer = found; assert.ok(n < 500, 'a rank-up offer exists'); }
  const index = offer.options.findIndex((option) => option.kind === 'rankUps');
  assert.deepEqual(offer.options[index], { kind: 'rankUps', id: 'cardRank' });
  const card = RankUpCandidates(registries, run)[0];
  const rank = InstanceRank(card), slots = UpgradeSlots(run, card);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index), /Choose a card/);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index, { instanceId: 'nobody' }), /cannot be ranked up/);
  assert.equal(InstanceRank(RankUpCandidates(registries, run).find((row) => row.instanceId === card.instanceId)), rank, 'a refused claim changes nothing');
  const receipt = claimGameProfileReward(registries, run, offer.id, index, { instanceId: card.instanceId });
  assert.deepEqual([receipt.kind, receipt.instanceId, receipt.rank], ['rankUps', card.instanceId, rank + 1]);
  const raised = RankUpCandidates(registries, run).find((row) => row.instanceId === card.instanceId); // a claim swaps in a clone
  assert.equal(InstanceRank(raised), rank + 1);
  assert.equal(UpgradeSlots(run, raised), slots + 1);
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, index);
  assert.throws(() => claimGameProfileReward(registries, run, offer.id, index, { instanceId: card.instanceId }), /already claimed/);
});

test('a run whose profile carries no rankUp data lays out the offer it always did', () => {
  const run = newRun();
  delete run.gameProfile.content.rewards.rankUp;
  for (let n = 0; n < 300; n += 1) assert.ok(!hasRankUp(offerFor(run, n, 'boss')));
});
