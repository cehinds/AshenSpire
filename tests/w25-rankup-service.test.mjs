// W25-R step 1: "rank up a card" is a service any door can offer (combat reward, shop, event), not only the Blacksmith.
import test from 'node:test';
import {scoringContract} from './helpers/scoring-contract.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { UpgradeSlots } from '../src/model/cardUpgradeLimits.js';
import { GetActiveScoring, HasCustomScoring, SetCustomScoring, ClearCustomScoring } from '../src/model/activeScoring.js';
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

test('authored rank-up chances and the current Blacksmith price reach the runtime', () => {
  const run=newRun();
  const rewards=JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/rewards.json',import.meta.url)));
  const shops=JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/shops.json',import.meta.url)));
  for(const pool of ['normal','elite','boss'])assert.equal(CombatRankUpChance(run,pool),rewards.rankUp.chancePct[pool]);
  assert.equal(ShopRankUpChance(run),shops.rankUp.stockChancePct);
  assert.equal(ShopRankUpPrice(run),shops.blacksmith.prices.rankUp);
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

test('combat and shop doors read controlled profile chances and remain deterministic', () => {
  const run = newRun(5);
  run.gameProfile=structuredClone(run.gameProfile);
  run.gameProfile.content.rewards.rankUp.chancePct={normal:5,elite:25,boss:25};
  run.gameProfile.content.shops.rankUp.stockChancePct=15;
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

// Review fix (2026-11-23): rank-up bonus steps use no slot, so they do not count toward the 10-upgrade cap either.
// Five skill rank-ups leave a Rank 5 card with 5 bonus steps; it can still fill its 6 slots and rank up again.
test('five skill rank-ups: a Rank 5 card still fills its 6 slots and ranks up (bonus steps skip the 10 cap)', async () => {
  // This case isolates paid-slot and bonus-cap accounting. Explicit CP headroom
  // keeps the independent budget gate from advancing rank or ending the menu.
  // The default-budget behavior has its own regression below.
  const previousScoring = GetActiveScoring(), hadCustomScoring = HasCustomScoring();
  const accountingScoring = structuredClone(previousScoring);
  accountingScoring.rank = { unrankedMax: 0, width: 100000, maxRank: 10, maxCp: 1000000 };
  accountingScoring.tierUnlocks = { enabled: false };
  // Neutral CP isolates slot accounting from all authored scoring gates.
  accountingScoring.costs={sp:{weight:0},mp:{weight:0}};
  for(const row of Object.values(accountingScoring.effects))if(row&&typeof row==='object')row.weight=0;
  accountingScoring.statuses={}; accountingScoring.tags={}; accountingScoring.categories={};
  accountingScoring.keywords={}; accountingScoring.effectCount={weight:0};
  accountingScoring.upgradeTags={}; accountingScoring.rarity.discount={common:0,uncommon:0,rare:0,starter:0};
  assert.equal(SetCustomScoring(accountingScoring).ok, true);
  try {
    const { awardSkillXp, xpToNext, coreCardRanks, raiseCardRank } = await import('../src/model/skills.js');
    const { rankUpBonusOptions } = await import('../src/model/rankUpBonus.js');
    const { planCardUpgrade, commitCardUpgrade } = await import('../src/model/cardUpgradeService.js');
    const { canUpgrade } = await import('../src/model/cardUpgradeLimits.js');
    const { paidUpgradeCount, upgradeCount, upgradeStepsProblems } = await import('../src/model/cardUpgrade.js');
    const { registries: sourceRegistries } = await import('./helpers/fixcore-combat-rules.mjs');
    const definition={id:'fixture.slot-accounting',name:'Slot fixture',class:'reaver',rarity:'common',type:'attack',cost:3,staminaCost:3,manaCost:0,costRule:'fixed',icon:'attack',keywords:[],tags:['camp:physical','source:weapon','maneuver:attack'],effects:[{op:'damage',target:'enemy',amount:12}],textTemplate:'Deal {damage} damage.'};
    const registries={...sourceRegistries,cards:{...sourceRegistries.cards,get:id=>id===definition.id?definition:sourceRegistries.cards.get(id),has:id=>id===definition.id||sourceRegistries.cards.has(id),ids:()=>[...sourceRegistries.cards.ids(),definition.id],all:()=>[...sourceRegistries.cards.all(),definition]}};
    const run = createRunState({ registries, classId: 'reaver', seed: 17, runId: 'w25-cap', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    run.smithingStones = 99;
    const xp = Array.from({ length: 8 }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0);
    awardSkillXp(registries, run, 'item:blade', xp, { queueRewards: false, queueRankUps: coreCardRanks(run) });
    // The explicit accounting fixture leaves CP headroom across all six ranks.
    const card={instanceId:'fixture.accounting-owned',cardId:definition.id,upgraded:false,upgradeSteps:[]};
    run.deck.push(card);
    const fill = () => {
      while (paidUpgradeCount(card) < UpgradeSlots(run, card)) {
        const quote = planCardUpgrade(run, registries, card.instanceId, { choices: 3 });
        assert.equal(quote.ok, true, quote.reason);
        const step = (quote.options ?? [quote]).find((option) => option.step && option.step.nextRank === undefined)?.step;
        assert.ok(step, 'buy an upgrade that leaves rank advancement to the skill reward');
        commitCardUpgrade(run, registries, { ...quote, step });
      }
    };
    const rankUp = () => {
      const options = rankUpBonusOptions(registries, run, card);
      assert.ok(raiseCardRank(registries, run, 'item:blade', card.instanceId, options[0]?.step ?? null), 'the rank-up lands');
    };
    for (let i = 0; i < 5; i += 1) { fill(); rankUp(); }
    assert.equal(card.rank, 5);
    assert.equal(UpgradeSlots(run, card), 6);
    assert.equal(paidUpgradeCount(card), 5);
    assert.equal(upgradeCount(card), 10, 'five paid steps and five bonus steps');
    const sixth = canUpgrade(registries, run, card);
    assert.equal(sixth.ok, true, sixth.reason || 'the sixth slot can still be bought');
    fill();
    assert.equal(paidUpgradeCount(card), 6);
    assert.equal(RankUpBlock(run, card), '');
    rankUp();
    assert.equal(card.rank, 6);
    assert.deepEqual(upgradeStepsProblems(card, 'card'), [], 'a save holding the card stays valid');
  } finally {
    if (hadCustomScoring) assert.equal(SetCustomScoring(previousScoring).ok, true);
    else ClearCustomScoring();
    assert.equal(HasCustomScoring(), hadCustomScoring);
    assert.deepEqual(GetActiveScoring(), previousScoring, 'restore the actual previous scoring configuration');
  }
});

test('a controlled CP budget refuses a paid-slot quote and a level increase refreshes its legal rank transition', async () => {
  const previousScoring = GetActiveScoring(), hadCustomScoring = HasCustomScoring();
  try {
    const { planCardUpgrade, commitCardUpgrade } = await import('../src/model/cardUpgradeService.js');
    const { canUpgrade, nextUpgradeOptions, upgradeCost } = await import('../src/model/cardUpgradeLimits.js');
    const { paidUpgradeCount } = await import('../src/model/cardUpgrade.js');
    const { CardDefinitionToScoreFace, PrepareUpgradeStepCpContext, EvaluateUpgradeStepCp } = await import('../src/model/cardUpgradeCp.js');
    const { ScoreCard, CombatPower, RankOf } = await import('../src/model/combatPower.js');
    // A supported authored card isolates the damage family near the real budget.
    // Its weighted tags are intentional power, not an override of scoring or CP.
    const baseDef = { id: 'custom.budget.fixture', name: 'Budget fixture', class: 'reaver', rarity: 'rare', type: 'attack',
      cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', keywords: [],
      tags: ['camp:physical', 'source:weapon', 'maneuver:attack', 'range:ranged', 'trait:unavoidable'],
      effects: [{ op: 'damage', target: 'enemy', amount: 5 }], upgradeMenu: ['dmg'], textTemplate: 'Deal {damage} damage.' };
    const budgetRegistries = { ...registries, cards: { ...registries.cards,
      has: id => id === baseDef.id || registries.cards.has(id),
      get: id => id === baseDef.id ? baseDef : registries.cards.get(id),
      ids: () => [...registries.cards.ids(), baseDef.id], all: () => [...registries.cards.all(), baseDef],
    } };
    const policy={...previousScoring,...scoringContract(),tierUnlocks:{enabled:false}};
    policy.rarity.discount={common:0,uncommon:0,rare:0,starter:0};
    policy.effects.damage={weight:1,per:1};
    policy.upgradeTags.improved={mode:'flat',base:1};
    const initialRaw=ScoreCard(CardDefinitionToScoreFace(baseDef,{scoring:policy}),policy).raw;
    policy.tags['trait:unavoidable']={weight:policy.rank.width-initialRaw};
    assert.equal(SetCustomScoring(policy).ok,true);
    const run = createRunState({ registries: budgetRegistries, classId: 'reaver', seed: 17, runId: 'w25-cp-budget', profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    const card = { instanceId: 'budget-card', cardId: baseDef.id, rank: 1, rarityOverride: 'rare', upgraded: false, upgradeSteps: [] };
    run.deck = [card]; run.smithingStones = 99;
    const scoring = GetActiveScoring();
    const context = PrepareUpgradeStepCpContext({ baseDef, currentDef: baseDef, instance: card, playerLevel: run.level.level, registries: budgetRegistries });
    const raw = ScoreCard(CardDefinitionToScoreFace(baseDef, { registries: budgetRegistries }), scoring).raw;
    assert.equal(context.rawBefore, raw);
    assert.equal(RankOf(CombatPower(raw, card.rarityOverride, scoring), scoring), card.rank);
    assert.equal(context.maxAllowedRank, 1);
    assert.ok(paidUpgradeCount(card) < UpgradeSlots(run, card), 'the refusal must be CP, not spent slots');
    const before = structuredClone(run);
    const blocked = planCardUpgrade(run, budgetRegistries, card.instanceId, { choices: 3 });
    assert.equal(blocked.ok, false); assert.equal(blocked.code, 'maxed');
    assert.equal(canUpgrade(budgetRegistries, run, card).code, 'maxed');
    assert.equal(upgradeCost(run, card, baseDef, budgetRegistries), null);
    assert.deepEqual(nextUpgradeOptions(run, card, baseDef, budgetRegistries, 3, { everyFamily: true }), []);
    assert.throws(() => commitCardUpgrade(run, budgetRegistries, blocked), /fully upgraded/);
    assert.deepEqual(run, before, 'refused plans and commits preserve cards, currency and the pending ledger');
    run.level.level = 2;
    const beforeQuote = structuredClone(run);
    // No cache clear or scoring override: the ordinary level-aware key invalidates the refusal.
    const refreshed = planCardUpgrade(run, budgetRegistries, card.instanceId, { choices: 3 });
    assert.equal(refreshed.ok, true, refreshed.reason); assert.ok(refreshed.options.length > 0);
    for (const { step } of refreshed.options) {
      const lowLevel = EvaluateUpgradeStepCp({ baseDef, currentDef: baseDef, instance: card, step, playerLevel: 1, registries: budgetRegistries });
      const available = EvaluateUpgradeStepCp({ baseDef, currentDef: baseDef, instance: card, step, playerLevel: 2, registries: budgetRegistries });
      assert.equal(lowLevel.allowed, false, 'the offered step exceeds the previous level budget');
      assert.equal(available.allowed, true); assert.equal(available.rank, 2);
      assert.ok(available.cp > scoring.rank.width && available.cp <= scoring.rank.width * 2);
      assert.equal(available.rarity, 'rare', 'the transition respects the existing rare discount');
    }
    assert.deepEqual(run, beforeQuote, 'refreshing the quote remains read-only');
    const stonesBefore = run.smithingStones;
    commitCardUpgrade(run, budgetRegistries, refreshed);
    assert.equal(paidUpgradeCount(card), 1); assert.equal(card.rank, 2);
    assert.equal(run.smithingStones, stonesBefore - refreshed.cost);
  } finally {
    if (hadCustomScoring) assert.equal(SetCustomScoring(previousScoring).ok, true);
    else ClearCustomScoring();
    assert.equal(HasCustomScoring(), hadCustomScoring);
    assert.deepEqual(GetActiveScoring(), previousScoring);
  }
});

// Review fix (2026-11-23): a missing setting counts as on, so saved runs get the rule too; the help text says so.
test('the full-upgrade rule help text says it is on by default, not that it waits for new runs', async () => {
  const { uiStrings } = await import('../src/content/generated/uiStrings.js');
  const row = uiStrings.find((r) => r.id === 'gameProfile.settings.rankUpNeedsFull');
  assert.ok(row);
  const text = JSON.stringify(row);
  assert.doesNotMatch(text, /Applies to new runs/);
  assert.match(text, /On by default\./);
  const saved = newRun();
  delete saved.gameProfile.modules.progression.rankUpNeedsFullUpgrades;
  assert.equal(RankUpNeedsFullUpgrades(saved), true, 'a saved run without the setting gets the rule');
});
