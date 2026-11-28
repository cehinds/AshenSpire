// Owner 2026-11-05: a combat door lays out a random 3..5 choices, skills and powers are offered more often than before,
// and first doors vary across seeds. Chests keep offerCount (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, deserializeRun, serializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileRewardPools } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
// The tuning below was measured on the whole colorless-plus-class pool; rewards.json classPools narrows it per class.
function withoutClassPools(run)
{
  const rewards = structuredClone(run.gameProfile.content.rewards);
  rewards.classPools.enabled = false;
  run.gameProfile = {
    ...run.gameProfile,
    content: {
      ...run.gameProfile.content,
      rewards,
    },
  };
  return run;
}
const reaverRun = (seed, classPools) =>
{
  const run = createRunState({ seed, classId: 'reaver', registries: reg });
  return classPools
    ? run
    : withoutClassPools(run);
};
const door = (seed, source = 'combat', floor = 1, classPools = true) => {
  const run = reaverRun(seed, classPools); run.floor = floor;
  return gameProfileRewardOffers(reg, run, createRng(seed), { offerId: `1:n:${source}`, source });
};
const nonAttackShare = classPools =>
{
  let cards = 0, nonAttack = 0;
  for (let s = 1; s <= 200; s++) for (const o of door(s, 'combat', 1 + (s % 8), classPools).options) if (o.kind === 'combatCards') { cards++; if (reg.cards.get(o.id).type !== 'attack') nonAttack++; }
  return { cards, nonAttack };
};
const firstDoorFrequency = classPools =>
{
  const freq = new Map();
  for (let s = 1; s <= 50; s++) for (const o of door(s, 'combat', 1, classPools).options) if (o.kind === 'combatCards' || o.kind === 'weaponArts') freq.set(o.id, (freq.get(o.id) || 0) + 1);
  return freq;
};

test('a combat door lays out 3, 4 or 5 choices, all three sizes occur, and a reload keeps the size', () => {
  const sizes = new Map();
  for (let s = 1; s <= 120; s++) { const n = door(s).options.length; sizes.set(n, (sizes.get(n) || 0) + 1); }
  assert.deepEqual([...sizes.keys()].sort(), [3, 4, 5], JSON.stringify([...sizes]));
  const run = createRunState({ seed: 9, classId: 'reaver', registries: reg });
  const first = gameProfileRewardOffers(reg, run, createRng(9), { offerId: 'x' });
  assert.equal(gameProfileRewardOffers(reg, run, createRng(77), { offerId: 'x' }).options.length, first.options.length);
});

test('chests keep their 3 choices', () => {
  for (let s = 1; s <= 40; s++) assert.equal(door(s, 'treasure').options.length, 3);
});

test('over 200 doors skills and powers are at least half the offered combat cards', () => {
  const { cards, nonAttack } = nonAttackShare(false);
  assert.ok(nonAttack / cards >= 0.5, `${nonAttack}/${cards}`);
  // With the Reaver's class list, offers still lean to skills and powers above their share of the pool.
  const listed = nonAttackShare(true);
  const pool = gameProfileRewardPools(reg, reaverRun(1, true)).combatCards;
  const poolShare = pool.filter(id => reg.cards.get(id).type !== 'attack').length / pool.length;
  assert.ok(listed.nonAttack / listed.cards > poolShare, `${listed.nonAttack}/${listed.cards} vs pool ${poolShare}`);
});

test('first doors vary across 50 seeds: no card in more than 35% of doors, 45+ distinct cards', () => {
  const freq = firstDoorFrequency(false);
  const top = Math.max(...freq.values());
  assert.ok(top <= 50 * 0.35, `top card in ${top}/50 doors`);
  assert.ok(freq.size >= 45, `${freq.size} distinct`);
  // The Reaver's class list is small, so its first doors cover at least 90% of it.
  const listed = firstDoorFrequency(true);
  const pools = gameProfileRewardPools(reg, reaverRun(1, true));
  const offerable = new Set([...pools.combatCards, ...pools.weaponArts]);
  assert.ok(listed.size >= offerable.size * 0.9, `${listed.size}/${offerable.size} distinct`);
});

test('new runs use 5% lower-rank fallback and old saves retain 10% and their cached offer', () => {
  const fresh = createRunState({ seed: 9, classId: 'reaver', registries: reg });
  assert.equal(fresh.gameProfile.content.rewards.eligibility.combatCards.lowerRankChance, 0.05);
  const bytes = readFileSync(new URL('./fixtures/pre-registry-dev-7dff4b03-save.json.gz', import.meta.url));
  const archived = deserializeRun(gunzipSync(bytes).toString('utf8'));
  const savedProfile = resolveGameProfile(archived.gameProfile);
  assert.equal(savedProfile.content.rewards.eligibility.combatCards.lowerRankChance, 0.1);
  assert.deepEqual(savedProfile.content.rewards.eligibility.combatCards.stanceCoverage,
    fresh.gameProfile.content.rewards.eligibility.combatCards.stanceCoverage);
  const savedReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, savedProfile)), savedProfile);
  const request = { offerId: 'legacy-lower-rank', source: 'combat' };
  const offer = gameProfileRewardOffers(savedReg, archived, createRng(9), request);
  assert.ok(offer.options.length >= 3);
  const restored = deserializeRun(serializeRun(archived, { inline: true }));
  assert.equal(restored.gameProfile.hash, savedProfile.hash);
  assert.equal(restored.gameProfile.content.rewards.eligibility.combatCards.lowerRankChance, 0.1);
  assert.deepEqual(gameProfileRewardOffers(savedReg, restored, createRng(77), request), offer);
});
