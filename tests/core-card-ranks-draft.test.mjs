// Card ranks 11c: Core reward cards arrive ranked 1..min(track level, rankMax) (rollDraftRank, cardRewards stream).
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { cardTrackLevel } from '../src/model/skills.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const cardOptions = (run, seed, count = 40) => {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const offer = gameProfileRewardOffers(registries, run, createRng(seed + i), { offerId: `t:${seed}:${i}`, source: 'combat' });
    out.push(...offer.options.filter((o) => o.kind === 'combatCards'));
  }
  return out;
};

test('with no track level, offered cards carry no rank and the cardRewards stream draws nothing extra', () => {
  const run = newRun();
  const options = cardOptions(run, 1);
  assert.ok(options.length > 10);
  assert.ok(options.every((o) => o.rank === undefined));
});

test('with leveled tracks, offered cards roll a rank within their own track level and rankMax', () => {
  const run = newRun();
  run.skills = { 'item:blade': { level: 5, xp: 0, pendingDrafts: 0 }, 'item:magic-focus': { level: 2, xp: 0, pendingDrafts: 0 } };
  const options = cardOptions(run, 1);
  const ranked = options.filter((o) => o.rank > 1);
  assert.ok(ranked.length > 5, 'some cards arrive ranked up');
  for (const o of options) {
    const ceiling = Math.min(cardTrackLevel(registries, run, registries.cards.get(o.id)), registries.balance.skill.rankMax);
    assert.ok((o.rank ?? 1) <= Math.max(1, ceiling), `${o.id} rank ${o.rank} over its ceiling ${ceiling}`);
  }
  assert.ok(ranked.some((o) => o.rank >= 4), 'high ranks come up at track level 5');
  // Deterministic: the same seed rolls the same ranks.
  assert.deepEqual(cardOptions(run, 1), options);
});

test('claiming a ranked reward card lands it in the sideboard at that rank', () => {
  const run = newRun();
  run.skills = { 'item:blade': { level: 6, xp: 0, pendingDrafts: 0 } };
  for (let i = 0; i < 60; i += 1) {
    const offerId = `claim:${i}`;
    const offer = gameProfileRewardOffers(registries, run, createRng(900 + i), { offerId, source: 'combat' });
    const index = offer.options.findIndex((o) => o.kind === 'combatCards' && o.rank > 1);
    if (index < 0) continue;
    claimGameProfileReward(registries, run, offerId, index);
    const card = run.sideboard.find((c) => c.instanceId === `reward:${offerId}:${index}`);
    assert.equal(card.rank, offer.options[index].rank);
    return;
  }
  assert.fail('no ranked card was offered in 60 tries');
});
