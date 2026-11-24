// W25-R step 1: "rank up a card" is a service any door can offer (combat reward, shop, event), not only the Blacksmith.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { UpgradeSlots } from '../src/model/cardUpgradeLimits.js';
import {
  RankUpCandidates, RaiseCardRank, RollRankUp, CombatRankUpChance, ShopRankUpChance, ShopRankUpPrice,
  CombatRewardRanksUp, ShopStocksRankUp, InstanceRank, RANK_CEILING,
} from '../src/model/rankUpService.js';
import { RankUpBlock, RankUpReady, RankUpNeedsFullUpgrades } from '../src/model/rankUpService.js';
import { FillUpgradeSlots } from './helpers/rank-up-ready.mjs';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile), {})), profile);
const newRun = (seed = 7) => createRunState({ seed, classId: 'reaver', registries, runId: 'w25-rankup' });

test('the data holds the owner numbers: 5% normal, 25% elite and boss, 15% per shop, the Blacksmith price', () => {
  const run = newRun();
  assert.equal(CombatRankUpChance(run, 'normal'), 5);
  assert.equal(CombatRankUpChance(run, 'elite'), 25);
  assert.equal(CombatRankUpChance(run, 'boss'), 25);
  assert.equal(ShopRankUpChance(run), 15);
  assert.equal(ShopRankUpPrice(run), 240);
});

test('raising a card adds one rank and its upgrade slots follow', () => {
  const run = newRun();
  const card = RankUpCandidates(registries, run)[0];
  assert.ok(card, 'a fresh run holds a rankable card');
  card.rank = 1; // a "Rank 1" card: slots are rank + 1, so each raise opens one
  FillUpgradeSlots(run, [card]); // the full-upgrade rule (on by default)
  const before = InstanceRank(card), slots = UpgradeSlots(run, card);
  const receipt = RaiseCardRank(registries, run, card.instanceId);
  assert.deepEqual([receipt.instanceId, receipt.rank], [card.instanceId, before + 1]);
  assert.equal(InstanceRank(card), before + 1);
  assert.equal(UpgradeSlots(run, card), slots + 1);
});

test('raising an unranked card (no badge, 1 slot) makes it Rank 1 with 2 slots: one slot per rank-up (owner 2026-11-23)', () => {
  const run = newRun();
  const card = RankUpCandidates(registries, run)[0];
  assert.equal(card.rank, undefined);
  assert.equal(UpgradeSlots(run, card), 1);
  FillUpgradeSlots(run, [card]);
  RaiseCardRank(registries, run, card.instanceId);
  assert.deepEqual([card.rank, UpgradeSlots(run, card)], [1, 2]);
  FillUpgradeSlots(run, [card]);
  RaiseCardRank(registries, run, card.instanceId);
  assert.deepEqual([card.rank, UpgradeSlots(run, card)], [2, 3]);
});

test('the full-upgrade rule (on by default): a card ranks up only once its slots are used, and keeps one free slot after', () => {
  const run = newRun();
  assert.equal(RankUpNeedsFullUpgrades(run), true, 'on unless the profile sets it false');
  const card = RankUpCandidates(registries, run)[0];
  assert.equal(RankUpBlock(run, card), 'Upgrade this card to its limit first.');
  assert.ok(!RankUpReady(registries, run).some((row) => row.instanceId === card.instanceId), 'shown as a candidate, not ready');
  assert.throws(() => RaiseCardRank(registries, run, card.instanceId), /limit first/);
  assert.equal(card.rank, undefined, 'a refused raise changes nothing');
  FillUpgradeSlots(run, [card]);
  assert.equal(RankUpBlock(run, card), '');
  RaiseCardRank(registries, run, card.instanceId);
  assert.equal(card.rank, 1);
  assert.equal(UpgradeSlots(run, card) - 1, 1, 'its upgrades stay and one slot is free');
  assert.ok(RankUpBlock(run, card), 'Rank 1 needs its second upgrade before the next rank-up');
  // A rank-up bonus step is a gift and uses no slot.
  card.upgradeSteps = [...card.upgradeSteps, { k: 'dmg', n: 1, bonus: true }];
  assert.ok(RankUpBlock(run, card), 'the bonus step does not fill the free slot');
});

test('turned off in the profile, any candidate may rank up', () => {
  const run = newRun();
  run.gameProfile = { ...run.gameProfile, modules: { ...run.gameProfile.modules, progression: { ...run.gameProfile.modules.progression, rankUpNeedsFullUpgrades: false } } };
  assert.equal(RankUpNeedsFullUpgrades(run), false);
  const card = RankUpCandidates(registries, run)[0];
  assert.equal(RankUpBlock(run, card), '');
  RaiseCardRank(registries, run, card.instanceId);
  assert.equal(card.rank, 1);
});

test('only rankable cards are offered: unknown ids, equipment-bound cards and cards at the ceiling are refused', () => {
  const run = newRun();
  const listed = RankUpCandidates(registries, run);
  assert.ok(listed.length > 0);
  for (const card of listed) {
    assert.ok(!card.sourceArmamentId && !card.grantedBy && card.equipmentRole !== 'granted' && card.equipmentRole !== 'weaponArt');
    assert.ok(InstanceRank(card) < RANK_CEILING);
  }
  assert.throws(() => RaiseCardRank(registries, run, 'nobody'), /cannot be ranked up/);
  const capped = listed[0];
  capped.rank = RANK_CEILING;
  assert.ok(!RankUpCandidates(registries, run).some((card) => card.instanceId === capped.instanceId));
  assert.throws(() => RaiseCardRank(registries, run, capped.instanceId), /cannot be ranked up/);
  const bound = run.deck.find((card) => card.sourceArmamentId || card.grantedBy || card.equipmentRole === 'granted');
  if (bound) assert.throws(() => RaiseCardRank(registries, run, bound.instanceId), /cannot be ranked up/);
});

test('a roll is seeded on the run and the door key: the same answer every time, different doors differ, the odds follow the data', () => {
  const run = newRun(11);
  assert.equal(RollRankUp(run, 'a'), RollRankUp(run, 'a'));
  assert.equal(RollRankUp(run, 'a', 0), false);
  assert.equal(RollRankUp(run, 'a', 100), true);
  const hits = (pct) => Array.from({ length: 4000 }, (_, i) => RollRankUp(run, `door:${i}`, pct)).filter(Boolean).length / 40;
  assert.ok(Math.abs(hits(25) - 25) < 3, `25% -> ${hits(25)}`);
  assert.ok(Math.abs(hits(5) - 5) < 2, `5% -> ${hits(5)}`);
  assert.ok(Math.abs(hits(15) - 15) < 2.5, `15% -> ${hits(15)}`);
  assert.notDeepEqual(Array.from({ length: 64 }, (_, i) => RollRankUp(newRun(1), `d${i}`, 50)), Array.from({ length: 64 }, (_, i) => RollRankUp(newRun(2), `d${i}`, 50)), 'the seed matters');
});

test('combat and shop doors read their chance from the profile data and are deterministic', () => {
  const run = newRun(5);
  const door = (id, pool) => CombatRewardRanksUp(registries, run, id, pool);
  for (const pool of ['normal', 'elite', 'boss']) assert.equal(door('1:n:combat', pool), door('1:n:combat', pool));
  const eliteHits = Array.from({ length: 2000 }, (_, i) => door(`1:${i}:combat`, 'elite')).filter(Boolean).length / 20;
  const normalHits = Array.from({ length: 2000 }, (_, i) => door(`1:${i}:combat`, 'normal')).filter(Boolean).length / 20;
  assert.ok(eliteHits > 18 && eliteHits < 32, `elite ${eliteHits}`);
  assert.ok(normalHits > 2 && normalHits < 9, `normal ${normalHits}`);
  const shopHits = Array.from({ length: 2000 }, (_, i) => ShopStocksRankUp(registries, run, `1:${i}`)).filter(Boolean).length / 20;
  assert.ok(shopHits > 11 && shopHits < 19, `shop ${shopHits}`);
});

test('a profile with no rankUp data, or a run that cannot rank cards, offers nothing and loads unchanged', () => {
  const run = newRun(5);
  const bare = structuredClone(run);
  delete bare.gameProfile.content.rewards.rankUp;
  delete bare.gameProfile.content.shops.rankUp;
  assert.equal(CombatRankUpChance(bare, 'elite'), 0);
  assert.equal(ShopRankUpChance(bare), 0);
  assert.equal(CombatRewardRanksUp(registries, bare, '1:n:combat', 'elite'), false);
  assert.equal(ShopStocksRankUp(registries, bare, '1:n'), false);
  const noRanks = structuredClone(run);
  noRanks.gameProfile.modules.progression.cardRanks = false;
  assert.deepEqual(RankUpCandidates(registries, noRanks), []);
  assert.equal(CombatRankUpChance(noRanks, 'elite'), 0);
});
