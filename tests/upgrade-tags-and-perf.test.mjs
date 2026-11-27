import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { scoringContract } from './helpers/scoring-contract.mjs';
import { registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { StampOfferKey } from '../src/model/upgradeOffer.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { applyUpgradeSteps, ImprovedScaledAmount, UpgradeTagStacks } from '../src/model/cardUpgrade.js';
import { BaseFace, ScoreCard, ScoreItem, UpgradeTagFor, ParseUpgradeTag, UpgradeTagLabel, UpgradeTagSurcharge } from '../src/model/combatPower.js';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
import { resolveGearItem } from '../engine/kernel/gameConfig.js';
import { SmithOptionPool } from '../src/model/smithUpgrade.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { weightSentence, weightExample } from '../tools/score-studio/weightExamples.js';

const clone = (v) => structuredClone(v);
const arithmetic = scoringContract();

test('Blacksmith cardUpgradeModel is fast (< 500ms for 60 cards) and deterministic by run.seed + offerKey', () => {
  const runA = createRunState({ registries, classId: 'reaver', seed: 4242, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a'] } } } });
  const availableIds = [...registries.cards.ids()].filter((id) => id.startsWith('core.') && !registries.cards.get(id)?.ruleTemplate);
  assert.ok(availableIds.length>0,'at least one upgradeable authored definition');
  const poolIds=Array.from({length:40},(_,i)=>availableIds[i%availableIds.length]);
  runA.smithingStones = 20;
  runA.deck = poolIds.slice(0, 20).map((cardId, i) => ({ instanceId: `d-${i}`, cardId, rank: 1, upgraded: false, upgradeSteps: [] }));
  runA.sideboard = poolIds.slice(20, 40).map((cardId, i) => ({ instanceId: `s-${i}`, cardId, rank: 1, upgraded: false, upgradeSteps: [] }));
  // Duplicate another 20 sideboard cards for 60 total cards
  runA.sideboard.push(...poolIds.slice(0, 20).map((cardId, i) => ({ instanceId: `s2-${i}`, cardId, rank: 2, upgraded: false, upgradeSteps: [] })));
  assert.equal(runA.deck.length+runA.sideboard.length,60,'the cold workload always contains 60 distinct instances');
  const stockA = {};
  StampOfferKey(runA, stockA);

  const t0 = performance.now();
  const modelA1 = cardUpgradeModel(registries, runA, { source: 'blacksmith', offerKey: stockA.offerKey });
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 500, `Expected 60-card blacksmith cardUpgradeModel < 500ms, got ${elapsed.toFixed(1)}ms`);
  assert.ok(modelA1.rows.length > 0, 'built upgrade rows');

  // Same seed + same offerKey -> identical upgrade offers
  const modelA2 = cardUpgradeModel(registries, runA, { source: 'blacksmith', offerKey: stockA.offerKey });
  assert.deepEqual(
    modelA1.rows.map((r) => ({ id: r.instanceId, opts: (r.options || []).map((o) => o.step) })),
    modelA2.rows.map((r) => ({ id: r.instanceId, opts: (r.options || []).map((o) => o.step) })),
  );
});

test('Efficient tag stacks 10 / 20 / 40 CP flat, supports multiplicative mode, and respects surchargeEnabled toggle', () => {
  const shippedScoring = arithmetic; // Explicit flat-mode arithmetic fixture.
  assert.equal(UpgradeTagFor('efficient', 1), 'upgrade:efficient');
  assert.equal(UpgradeTagFor('efficient', 2), 'upgrade:efficient+');
  assert.equal(UpgradeTagFor('efficient', 3), 'upgrade:efficient+2');
  assert.deepEqual(ParseUpgradeTag('upgrade:efficient+2'), { family: 'efficient', stacks: 3 });
  assert.equal(UpgradeTagLabel('upgrade:efficient'), 'Efficient');
  assert.equal(UpgradeTagLabel('upgrade:efficient+'), 'Efficient+');
  assert.equal(UpgradeTagLabel('upgrade:efficient+2'), 'Efficient +2');

  const rule = shippedScoring.upgradeTags.efficient;
  assert.equal(UpgradeTagSurcharge(rule, 1, 20), 10);
  assert.equal(UpgradeTagSurcharge(rule, 2, 20), 20);
  assert.equal(UpgradeTagSurcharge(rule, 3, 20), 40);

  // Multiplicative mode
  const multRule = { ...rule, mode: 'multiplicative', pMultiplier: 0.25 };
  assert.equal(Math.round(UpgradeTagSurcharge(multRule, 1, 20) * 100) / 100, 5);
  assert.equal(Math.round(UpgradeTagSurcharge(multRule, 2, 20) * 100) / 100, 11.25);
  assert.equal(Math.round(UpgradeTagSurcharge(multRule, 3, 20) * 100) / 100, 19.06);

  // Toggle off
  const offRule = { ...rule, surchargeEnabled: false };
  assert.equal(UpgradeTagSurcharge(offRule, 3, 20), 0);

  // End-to-end ScoreCard with Efficient tag
  const baseFace = { ...BaseFace(), sp: 2, dmg: 12 };
  const s0 = ScoreCard(baseFace, shippedScoring).raw;
  const s1 = ScoreCard({ ...baseFace, tags: ['upgrade:efficient'] }, shippedScoring).raw;
  const s2 = ScoreCard({ ...baseFace, tags: ['upgrade:efficient+'] }, shippedScoring).raw;
  const s3 = ScoreCard({ ...baseFace, tags: ['upgrade:efficient+2'] }, shippedScoring).raw;
  assert.equal(s1 - s0, 10);
  assert.equal(s2 - s0, 20);
  assert.equal(s3 - s0, 40);

  // Card upgrade step applies Efficient tags cleanly
  const card = { id: 't.c', name: 'Test', type: 'attack', rarity: 'common', cost: 3, staminaCost: 3, manaCost: 0, keywords: [], tags: ['camp:physical'], effects: [{ op: 'damage', target: 'enemy', amount: 12 }] };
  const u1 = applyUpgradeSteps(card, [{ k: 'cost', pool: 'sp' }]);
  const u2 = applyUpgradeSteps(card, [{ k: 'cost', pool: 'sp' }, { k: 'cost', pool: 'sp' }]);
  const u3 = applyUpgradeSteps(card, [{ k: 'cost', pool: 'sp' }, { k: 'cost', pool: 'sp' }, { k: 'cost', pool: 'sp' }]);
  assert.equal(UpgradeTagStacks(u1, 'efficient'), 1);
  assert.equal(UpgradeTagStacks(u2, 'efficient'), 2);
  assert.equal(UpgradeTagStacks(u3, 'efficient'), 3);
  assert.ok(u3.tags.includes('upgrade:efficient+2'));
});

test('Improved tag scales effects by 1.10^n compounding and displays cleanly on playingCardModel', () => {
  assert.equal(ImprovedScaledAmount(100, 1, 1.1), 110);
  assert.equal(ImprovedScaledAmount(100, 2, 1.1), 121);
  assert.equal(ImprovedScaledAmount(100, 3, 1.1), 133);
  // Small numbers get at least +1 per stack
  assert.equal(ImprovedScaledAmount(6, 1, 1.1), 7);
  assert.equal(ImprovedScaledAmount(6, 2, 1.1), 8);
  assert.equal(ImprovedScaledAmount(6, 3, 1.1), 9);

  const strike = registries.cards.get('core.strike');
  const upgraded = applyUpgradeSteps(strike, [{ k: 'dmg', n: 1 }, { k: 'cost', pool: 'sp' }]);
  assert.ok(upgraded.tags.includes('upgrade:improved'));
  assert.ok(upgraded.tags.includes('upgrade:efficient'));
  const model = playingCardModel(registries, { instanceId: 'u1', cardId: 'core.strike', upgraded: true, upgradeSteps: [{ k: 'dmg', n: 1 }, { k: 'cost', pool: 'sp' }] });
  const tagLabels = model.tags.map((t) => t.label);
  assert.ok(tagLabels.includes('Improved'), `expected Improved label in ${JSON.stringify(tagLabels)}`);
  assert.ok(tagLabels.includes('Efficient'), `expected Efficient label in ${JSON.stringify(tagLabels)}`);
});

test('surchargeEnabled toggle works across keywords, tags, categories, effectCount, and gearAttribute + weightExamples', () => {
  const shippedScoring = arithmetic; // Explicit flat-mode arithmetic fixture.
  const custom = clone(shippedScoring);
  // Keywords toggle
  const faceKw = { ...BaseFace(), sp: 1, dmg: 12, kw: ['retain'] };
  const kwOn = ScoreCard(faceKw, custom).raw;
  custom.keywords.retain.surchargeEnabled = false;
  const kwOff = ScoreCard(faceKw, custom).raw;
  assert.ok(kwOff < kwOn, 'disabling keyword surcharge lowers raw score');
  assert.match(weightExample('keywords', 'retain', custom, 'retain'), /Surcharge disabled/);

  // Categories toggle
  const faceHybrid = { ...BaseFace(), sp: 1, dmg: 12, magicShare: 0.5 };
  const hybOn = ScoreCard(faceHybrid, custom).raw;
  custom.categories.hybrid.surchargeEnabled = false;
  const hybOff = ScoreCard(faceHybrid, custom).raw;
  assert.equal(hybOn - hybOff, 10, 'disabling hybrid category surcharge removes +10 CP');
  assert.match(weightExample('categories', 'hybrid', custom, 'Hybrid'), /Surcharge disabled/);

  // Tags toggle
  const faceTag = { ...BaseFace(), sp: 1, dmg: 12, tags: ['damage:fire'] };
  const tagOn = ScoreCard(faceTag, custom).raw;
  custom.tags['damage:fire'].surchargeEnabled = false;
  const tagOff = ScoreCard(faceTag, custom).raw;
  assert.ok(tagOff < tagOn, 'disabling weighted tag surcharge removes its CP');
  assert.match(weightExample('tags', 'damage:fire', custom, 'Fire'), /Surcharge disabled/);

  // Effect count toggle
  const faceMulti = { ...BaseFace(), sp: 1, dmg: 9, blk: 6 };
  const ecOn = ScoreCard(faceMulti, custom).raw;
  custom.effectCount.surchargeEnabled = false;
  const ecOff = ScoreCard(faceMulti, custom).raw;
  assert.equal(ecOn - ecOff, custom.effectCount.weight);
  assert.match(weightExample('rank', 'effectCount', custom, 'Multi-Effect Bonus'), /Surcharge disabled/);

  // Upgrade tags weightSentence + weightExample (flat, multiplicative, off)
  assert.match(weightSentence('upgradeTags', 'efficient', shippedScoring).mid, /doubles per stack/);
  assert.match(weightExample('upgradeTags', 'efficient', shippedScoring), /\+10 pts.*\+20 pts.*\+40 pts/);
  custom.upgradeTags.efficient.mode = 'multiplicative';
  assert.match(weightSentence('upgradeTags', 'efficient', custom).mid, /positive score/);
  assert.match(weightExample('upgradeTags', 'efficient', custom), /Positive score 20/);
  custom.upgradeTags.efficient.surchargeEnabled = false;
  assert.match(weightExample('upgradeTags', 'efficient', custom), /Surcharge disabled/);
});

test('flat gear attributes are rare, expensive CP-wise, cut into ratings/Poise budget, and capped at 1 Blacksmith pick', () => {
  const sp = { attributes: { common: 0, uncommon: 0, rare: 1 }, perRank: 0, attributeBudgetCost: 3 };

  // Gear with 1 flat attribute pays attributeBudgetCost against ratings/Poise pool
  const settings = {
    statPoints: sp,
    fillTo: 'max',
    maxAttributes: 2,
    poolSizes: { ratings: { common: { min: 4, max: 6 }, rare: { min: 6, max: 6 } }, bonus: { common: { min: 0, max: 0 }, rare: { min: 1, max: 1 } } },
    pointValues: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, poise: 1 },
    weights: { global: { ratings: { poise: 1 }, bonus: { strength: 1 } }, kinds: {}, slots: {} },
    tags: {},
  };
  const commonArmor = resolveGearItem({ id: 'a1', kind: 'armor', slot: 'armor', rarity: 'common', tags: [] }, settings);
  const rareArmor = resolveGearItem({ id: 'a2', kind: 'armor', slot: 'armor', rarity: 'rare', tags: [] }, settings);
  assert.equal(commonArmor.statPoints.total, 0);
  assert.equal(commonArmor.points.poise, 6);
  assert.equal(rareArmor.statPoints.total, 1);
  assert.equal(rareArmor.points.poise, 3, 'rare attribute deducts attributeBudgetCost (3) from ratings/Poise pool');

  // ScoreItem prices flat attribute mod + gearAttribute surcharge heavily, and respects toggle
  const plainSword = { kind: 'weapon', id: 'w1', name: 'Sword', rarity: 'common', poiseDamage: 2, mods: [] };
  const dexSword = { kind: 'weapon', id: 'w2', name: 'Dex Sword', rarity: 'common', poiseDamage: 2, mods: [['self.statDex', 1]] };
  const scPlain = ScoreItem(plainSword, arithmetic);
  const scDex = ScoreItem(dexSword, arithmetic);
  assert.equal(scDex.raw - scPlain.raw, arithmetic.items.gearFields.statDex.weight + 4, 'statDex weight + gearAttribute stack 1 surcharge (+4)');

  const noSurcharge = clone(arithmetic);
  noSurcharge.upgradeTags.gearAttribute.surchargeEnabled = false;
  const scDexOff = ScoreItem(dexSword, noSurcharge);
  assert.equal(scDexOff.raw - scPlain.raw, arithmetic.items.gearFields.statDex.weight, 'gearAttribute surcharge off removes +4 surcharge');

  // Blacksmith SmithOptionPool caps flat attribute picks to 1 per item
  const run = createRunState({ registries, classId: 'reaver', seed: 101 });
  run.gameProfile = profile;
  const itemRef = 'armament/straightSword';
  const pool1 = SmithOptionPool(run, itemRef);
  const isAttrOpt = (o) => o?.pick?.k === 'stat' && ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'].includes(o.pick.stat);
  assert.ok(pool1.some(isAttrOpt), 'fresh weapon can still rarely roll a flat attribute');
  run.itemUpgradePicks = { [itemRef]: [{ id: 'attr:strength', k: 'stat', stat: 'strength', n: 1 }] };
  const pool2 = SmithOptionPool(run, itemRef);
  assert.ok(!pool2.some(isAttrOpt), 'item that already took 1 flat attribute cannot roll another');
});


test('controlled multiplicative upgrade and hybrid weights reach ScoreCard and Studio descriptions', () => {
  const custom = scoringContract();
  custom.upgradeTags.efficient = { mode: 'multiplicative', pMultiplier: .5 };
  custom.categories.hybrid = { weight: 1.25, multiplier: true };
  assert.deepEqual([1, 2, 3].map(n => UpgradeTagSurcharge(custom.upgradeTags.efficient, n, 20)), [10, 25, 47.5]);
  assert.match(weightSentence('upgradeTags', 'efficient', custom).mid, /positive score/);
  const face = { ...BaseFace(), sp: 1, dmg: 12, magicShare: .5 };
  const on = ScoreCard(face, custom);
  const off = clone(custom); off.categories.hybrid.surchargeEnabled = false;
  assert.equal(on.parts['category:hybrid'], ScoreCard(face, off).positive * .25);
});
