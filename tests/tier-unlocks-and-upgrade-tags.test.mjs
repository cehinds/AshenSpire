import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import { ValidateScoringConfig } from '../src/model/activeScoring.js';
import { BaseFace, ScoreCard, UpgradeTagLabel, UpgradeTagSurcharge } from '../src/model/combatPower.js';
import { applyUpgradeSteps, upgradeTagStacks, upgradeStepsProblems, FlatSteps } from '../src/model/cardUpgrade.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { GenerateCard, GenerateFace } from '../src/model/cardGenerator.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import {
  EffectiveTier,
  CardEffectiveTier,
  UpgradeKindUnlocked,
  UpgradeRarityUnlocked,
  UpgradeTagStackUnlocked,
  ZeroCostUnlocked,
  HybridUnlocked,
  ElementUnlocked,
  StatusUnlocked,
  StatusStackCapAtTier,
  NumericCeilingAtTier,
  CompileTierCatalog,
} from '../src/model/tierUnlocks.js';

test('EffectiveTier grants +1 tier to Rare cards (Rank 1 Rare == Rank 2 Common == Tier 2)', () => {
  assert.equal(EffectiveTier(0, 'common', shippedScoring), 0);
  assert.equal(EffectiveTier(1, 'common', shippedScoring), 1);
  assert.equal(EffectiveTier(1, 'uncommon', shippedScoring), 1);
  assert.equal(EffectiveTier(1, 'rare', shippedScoring), 2);
  assert.equal(EffectiveTier(2, 'common', shippedScoring), 2);
  assert.equal(EffectiveTier(2, 'rare', shippedScoring), 3);
  assert.equal(CardEffectiveTier({ rarity: 'rare', rank: 1 }, null, shippedScoring), 2);
  assert.equal(CardEffectiveTier({ rarity: 'common' }, { rank: 1, rarityOverride: 'rare' }, shippedScoring), 2);
});

test('Improved+ is locked behind Tier 2 (Rank 2 Common or Rank 1 Rare), and Improved+2 behind Tier 3', () => {
  assert.equal(UpgradeTagStackUnlocked('improved', 1, 0, shippedScoring), true);
  assert.equal(UpgradeTagStackUnlocked('improved', 2, 1, shippedScoring), false);
  assert.equal(UpgradeTagStackUnlocked('improved', 2, 2, shippedScoring), true);
  assert.equal(UpgradeTagStackUnlocked('improved', 3, 2, shippedScoring), false);
  assert.equal(UpgradeTagStackUnlocked('improved', 3, 3, shippedScoring), true);

  const base = {
    id: 'test.blade',
    name: 'Test Blade',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    staminaCost: 1,
    manaCost: 0,
    damageSchool: 'physical',
    keywords: [],
    tags: ['camp:physical', 'maneuver:attack', 'classification.attack'],
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }],
    textTemplate: 'Deal {damage} damage.',
  };
  const alreadyImproved = [{ k: 'dmg', n: 1 }];
  // Rank 1 Common (Tier 1) cannot roll another dmg step (which would create Improved+)
  const tier1Opts = rollUpgradeOptions(base, alreadyImproved, 1, upgradeStepRng(99, 'c1', 1), { cardRank: 1, everyFamily: true }, 20);
  assert.ok(!tier1Opts.some((s) => s.k === 'dmg'), 'Rank 1 Common (Tier 1) cannot roll Improved+ dmg');

  // Rank 1 Rare (Tier 2) CAN roll dmg (Improved+)
  const rareBase = { ...base, rarity: 'rare' };
  const tier2RareOpts = rollUpgradeOptions(rareBase, alreadyImproved, 1, upgradeStepRng(99, 'c2', 1), { cardRank: 1, everyFamily: true }, 20);
  assert.ok(tier2RareOpts.some((s) => s.k === 'dmg'), 'Rank 1 Rare (Tier 2) unlocks Improved+ dmg');

  // Rank 2 Common (Tier 2) CAN also roll dmg (Improved+)
  const tier2CommonOpts = rollUpgradeOptions(base, alreadyImproved, 1, upgradeStepRng(99, 'c3', 1), { cardRank: 2, everyFamily: true }, 20);
  assert.ok(tier2CommonOpts.some((s) => s.k === 'dmg'), 'Rank 2 Common (Tier 2) unlocks Improved+ dmg');
});

test('Refined (drawback easing), Tempered (combat form), and Purified (healing/cleansing) tags apply, score, and render', () => {
  const card = {
    id: 'test.pact',
    name: 'Ash Pact',
    type: 'attack',
    rarity: 'rare',
    cost: 2,
    staminaCost: 2,
    manaCost: 0,
    damageSchool: 'physical',
    keywords: ['exhaust', 'ethereal'],
    tags: ['camp:physical', 'maneuver:attack', 'classification.attack'],
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'poiseDamage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'self', status: 'weak', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Deal {poiseDamage} Poise damage. Exhaust. Ethereal.',
  };

  // Refined: drawback easing steps stamp upgrade:refined / upgrade:refined+ / upgrade:refined+2
  const r1 = applyUpgradeSteps(card, [{ k: 'fx', fx: 'unethereal' }]);
  const r2 = applyUpgradeSteps(card, [{ k: 'fx', fx: 'unethereal' }, { k: 'fx', fx: 'unexhaust' }]);
  const r3 = applyUpgradeSteps(card, [{ k: 'fx', fx: 'unethereal' }, { k: 'fx', fx: 'unexhaust' }, { k: 'stk', status: 'weak', side: 'self', n: -1 }]);
  assert.equal(upgradeTagStacks(r1, 'refined'), 1);
  assert.equal(upgradeTagStacks(r2, 'refined'), 2);
  assert.equal(upgradeTagStacks(r3, 'refined'), 3);
  assert.equal(UpgradeTagLabel('upgrade:refined+'), 'Refined+');
  assert.equal(UpgradeTagSurcharge(shippedScoring.upgradeTags.refined, 1, 20), 6);
  assert.equal(UpgradeTagSurcharge(shippedScoring.upgradeTags.refined, 2, 20), 12);
  assert.equal(UpgradeTagSurcharge(shippedScoring.upgradeTags.refined, 3, 20), 24);

  // Tempered: combat form & forging steps (poise, hits, range, block, counter) stamp upgrade:tempered
  const t1 = applyUpgradeSteps(card, [{ k: 'poise', n: 2 }]);
  const t2 = applyUpgradeSteps(card, [{ k: 'poise', n: 2 }, { k: 'tag', tag: 'range:reach' }]);
  assert.equal(upgradeTagStacks(t1, 'tempered'), 1);
  assert.equal(upgradeTagStacks(t2, 'tempered'), 2);
  assert.equal(UpgradeTagSurcharge(shippedScoring.upgradeTags.tempered, 1, 20), 4);
  assert.equal(UpgradeTagSurcharge(shippedScoring.upgradeTags.tempered, 2, 20), 8);

  // Purified: healing & cleansing upgrade line (fx:heal, fx:cleanse) stamps upgrade:purified
  const p1 = applyUpgradeSteps(card, [{ k: 'fx', fx: 'heal', n: 3 }]);
  const p2 = applyUpgradeSteps(card, [{ k: 'fx', fx: 'heal', n: 3 }, { k: 'fx', fx: 'cleanse', status: 'weak', n: 1 }]);
  assert.equal(upgradeTagStacks(p1, 'purified'), 1);
  assert.equal(upgradeTagStacks(p2, 'purified'), 2);
  assert.ok(p2.effects.some((e) => e.op === 'heal' && e.amount === 3), 'fx:heal adds heal effect');
  assert.ok(p2.effects.some((e) => e.op === 'removeStatus' && e.status === 'weak'), 'fx:cleanse adds removeStatus effect');
  assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: [{ k: 'fx', fx: 'heal', n: 3 }, { k: 'fx', fx: 'cleanse', status: 'weak', n: 1 }] }, 'card'), []);

  // ScoreCard applies surcharges for refined, tempered, purified
  const baseFace = { ...BaseFace(), sp: 1, dmg: 12 };
  const s0 = ScoreCard(baseFace, shippedScoring).raw;
  assert.equal(ScoreCard({ ...baseFace, tags: ['upgrade:refined'] }, shippedScoring).raw - s0, 6);
  assert.equal(ScoreCard({ ...baseFace, tags: ['upgrade:tempered'] }, shippedScoring).raw - s0, 4);
  assert.equal(ScoreCard({ ...baseFace, tags: ['upgrade:purified'] }, shippedScoring).raw - s0, 4);

  // playingCardModel renders labels & tooltips cleanly
  const strike = registries.cards.get('core.strike');
  assert.ok(strike);
  const model = playingCardModel(registries, {
    instanceId: 'pur-1',
    cardId: 'core.strike',
    upgraded: true,
    upgradeSteps: [{ k: 'fx', fx: 'heal', n: 2 }, { k: 'tag', tag: 'range:reach' }],
  });
  const labels = model.tags.map((t) => t.label);
  assert.ok(labels.includes('Purified'), `expected Purified in ${JSON.stringify(labels)}`);
  assert.ok(labels.includes('Tempered'), `expected Tempered in ${JSON.stringify(labels)}`);
});

test('Drawback easing (Refined) is locked at Tier 0-1, unlocks mild easing at Tier 2, and Exhaust removal at Tier 3', () => {
  const drawbackCard = {
    id: 'test.curse',
    name: 'Heavy Toll',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    staminaCost: 1,
    manaCost: 0,
    damageSchool: 'physical',
    keywords: ['exhaust', 'ethereal'],
    tags: ['camp:physical', 'maneuver:attack', 'classification.attack'],
    effects: [
      { op: 'damage', target: 'enemy', amount: 8 },
      { op: 'applyStatus', target: 'self', status: 'weak', stacks: 2 },
    ],
    textTemplate: 'Deal {damage} damage. Exhaust. Ethereal.',
  };

  const t1 = rollUpgradeOptions(drawbackCard, [], 0, upgradeStepRng(7, 'd1', 0), { cardRank: 1, everyFamily: true }, 40);
  assert.ok(!FlatSteps(t1).some((s) => s.k === 'fx' && ['unethereal', 'unexhaust'].includes(s.fx)), 'Tier 1 locks drawback easing');
  assert.ok(!FlatSteps(t1).some((s) => s.k === 'stk' && s.n < 0), 'Tier 1 locks stkEase');

  const t2 = rollUpgradeOptions(drawbackCard, [], 0, upgradeStepRng(7, 'd2', 0), { cardRank: 2, everyFamily: true }, 40);
  assert.ok(FlatSteps(t2).some((s) => (s.k === 'fx' && s.fx === 'unethereal') || (s.k === 'stk' && s.n < 0)), 'Tier 2 unlocks unethereal / stkEase');
  assert.ok(!FlatSteps(t2).some((s) => s.k === 'fx' && s.fx === 'unexhaust'), 'Tier 2 still locks unexhaust');

  const t3 = rollUpgradeOptions(drawbackCard, [], 0, upgradeStepRng(7, 'd3', 0), { cardRank: 3, everyFamily: true }, 40);
  assert.ok(FlatSteps(t3).some((s) => s.k === 'fx' && s.fx === 'unexhaust'), 'Tier 3 unlocks unexhaust');
});

test('Statuses, stack caps, elements, magic+martial hybrids, cost reductions, and numeric ceilings obey tierUnlocks', () => {
  // Status unlocks & stack caps
  assert.equal(StatusUnlocked('weak', 0, shippedScoring), true);
  assert.equal(StatusUnlocked('burn', 0, shippedScoring), false);
  assert.equal(StatusUnlocked('burn', 1, shippedScoring), true);
  assert.equal(StatusUnlocked('ward', 1, shippedScoring), false);
  assert.equal(StatusUnlocked('ward', 2, shippedScoring), true);
  assert.equal(StatusStackCapAtTier('ward', 2, shippedScoring), 1);
  assert.equal(StatusStackCapAtTier('ward', 3, shippedScoring), 2);
  assert.equal(StatusUnlocked('evade', 2, shippedScoring), false);
  assert.equal(StatusUnlocked('evade', 3, shippedScoring), true);
  assert.equal(StatusUnlocked('strength', 3, shippedScoring), false);
  assert.equal(StatusUnlocked('strength', 4, shippedScoring), true);

  // Elements & hybrid
  assert.equal(HybridUnlocked(1, shippedScoring), false);
  assert.equal(HybridUnlocked(2, shippedScoring), true);
  assert.equal(ElementUnlocked('fire', 0, shippedScoring), true);
  assert.equal(ElementUnlocked('arcane', 0, shippedScoring), false);
  assert.equal(ElementUnlocked('arcane', 1, shippedScoring), true);
  assert.equal(ElementUnlocked('lightning', 1, shippedScoring), false);
  assert.equal(ElementUnlocked('lightning', 2, shippedScoring), true);
  assert.equal(ElementUnlocked('force', 2, shippedScoring), false);
  assert.equal(ElementUnlocked('force', 3, shippedScoring), true);

  // Cost changes & zero-cost gate
  assert.equal(UpgradeKindUnlocked('costSwap', 0, shippedScoring), false);
  assert.equal(UpgradeKindUnlocked('costSwap', 1, shippedScoring), true);
  assert.equal(UpgradeKindUnlocked('cost', 1, shippedScoring), false);
  assert.equal(UpgradeKindUnlocked('cost', 2, shippedScoring), true);
  assert.equal(ZeroCostUnlocked(2, shippedScoring), false);
  assert.equal(ZeroCostUnlocked(3, shippedScoring), true);

  // Ceilings & rarity sizes
  assert.equal(NumericCeilingAtTier('damage', 0, shippedScoring), 12);
  assert.equal(NumericCeilingAtTier('damage', 2, shippedScoring), 28);
  assert.equal(NumericCeilingAtTier('damage', 4, shippedScoring), Infinity);
  assert.equal(UpgradeRarityUnlocked(1, 0, shippedScoring), false);
  assert.equal(UpgradeRarityUnlocked(1, 1, shippedScoring), true);
  assert.equal(UpgradeRarityUnlocked(2, 2, shippedScoring), false);
  assert.equal(UpgradeRarityUnlocked(2, 3, shippedScoring), true);

  // Pre-compiled O(1) catalog agrees with direct checks
  const cat = CompileTierCatalog(shippedScoring);
  assert.equal(cat.enabled, true);
  assert.ok(!cat.statusesAtTier(1).has('ward'));
  assert.ok(cat.statusesAtTier(2).has('ward'));
  assert.ok(!cat.kindsAtTier(2).has('hits'));
  assert.ok(cat.kindsAtTier(3).has('hits'));
});

test('GenerateCard with enforceTierUnlocks respects hybrid, element, status, and zero-cost gates', () => {
  // Rank 1 Common (Tier 1) cannot generate a hybrid card or a Tier 4 status like strength
  const t1 = GenerateFace({
    rarity: 'common',
    rank: 1,
    camp: 'hybrid',
    school: 'lightning',
    effects: 2,
    allowedEffects: ['poise'],
    allowedStatuses: ['strength', 'weak'],
    seed: 'tier-gen-1',
    enforceTierUnlocks: true,
  }, { scoring: shippedScoring });
  assert.ok(!t1.face.magicShare, 'Tier 1 hybrid falls back to martial');
  assert.ok(!t1.face.statuses.some(([s]) => s === 'strength'), 'Tier 1 never receives Tier 4 status');

  // Rank 1 Rare (Tier 2) DOES allow hybrid + lightning
  const t2Rare = GenerateCard({
    rarity: 'rare',
    rank: 1,
    camp: 'hybrid',
    school: 'lightning',
    effects: 1,
    seed: 'tier-gen-2',
    enforceTierUnlocks: true,
  }, { scoring: shippedScoring });
  assert.equal(t2Rare.magicShare, 0.5, 'Rank 1 Rare (Tier 2) unlocks hybrid');
  assert.ok(t2Rare.tags.includes('school:lightning'), 'Rank 1 Rare (Tier 2) unlocks lightning');
});

test('ValidateScoringConfig accepts shipped tierUnlocks and rejects malformed tierUnlocks', () => {
  assert.deepEqual(ValidateScoringConfig(shippedScoring), []);
  const bad = structuredClone(shippedScoring);
  bad.tierUnlocks.upgrades.hits = -1;
  assert.ok(ValidateScoringConfig(bad).some((e) => e.includes('tierUnlocks.upgrades.hits')));
});

test('Purified fx:heal restores HP and fx:cleanse removes Weak in real combat', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push({
    instanceId: 'pur-play',
    cardId: 'core.defend',
    upgraded: true,
    upgradeSteps: [{ k: 'fx', fx: 'heal', n: 4 }, { k: 'fx', fx: 'cleanse', status: 'weak', n: 1 }],
  });
  combat.player.maxHp = 50;
  combat.player.hp = 30;
  combat.player.stamina = combat.player.maxStamina = 10;
  combat.player.statuses.weak = { stacks: 2 };
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'pur-play' });
  assert.equal(combat.player.hp, 34, 'fx:heal restores 4 HP');
  assert.equal(combat.player.statuses.weak?.stacks, 1, 'fx:cleanse removes 1 stack of Weak');
});
