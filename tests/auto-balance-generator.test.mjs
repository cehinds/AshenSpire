import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scoring as shippedScoring } from '../src/content/generated/scoring.js';
const scoring=shippedScoring;
import { scoringContract } from './helpers/scoring-contract.mjs';
import { contentBundle } from '../src/content/index.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { GenerateCard, GenerateFace, GenerateCardBatch, RankBand, RankMaxCp } from '../src/model/cardGenerator.js';
import { GenerateItem, GenerateItemBatch, ScoreGeneratedItem } from '../src/model/itemGenerator.js';
import {
  ResolveQuotaCounts,
  BuildTargetSlots,
  TuneCardToTarget,
  AutoBalanceCards,
  AutoBalanceItems,
  HeadlessCardFace,
} from '../src/model/autoBalance.js';
import { buildItemRoster } from '../tools/score-studio/itemStudio.js';
import {
  createCustomClass,
  createCustomDeck,
  buildStudioBundle,
  parseStudioBundle,
  setActiveDeckList,
  assignDeckToClass,
} from '../tools/score-studio/customDecks.js';
import { saveStudioDecks, readStudioConfig } from '../tools/score-studio-save.mjs';

const controlledScoring = { ...scoring, ...scoringContract(), statuses:{...scoringContract().statuses,prepared:{weight:2,target:'self'},evade:{weight:2,target:'self'}}, items: scoring.items, naming: scoring.naming };
// Card quota tests use a deliberate four-point band; item tests retain authored
// item rules and independently verify measured scores rather than requested ranks.

test('ResolveQuotaCounts allocates exact totals deterministically for percent and flat modes', () => {
  const pct = ResolveQuotaCounts({ 0: 5, 1: 30, 2: 35, 3: 20, 4: 10, 5: 0 }, 20, 'percent');
  assert.equal(Object.values(pct).reduce((a, b) => a + b, 0), 20);
  assert.deepEqual(pct, { 0: 1, 1: 6, 2: 7, 3: 4, 4: 2, 5: 0 });
  const pct2 = ResolveQuotaCounts({ common: 55, uncommon: 30, rare: 15 }, 17, 'percent');
  assert.equal(Object.values(pct2).reduce((a, b) => a + b, 0), 17);
  assert.deepEqual(pct2, ResolveQuotaCounts({ common: 55, uncommon: 30, rare: 15 }, 17, 'percent'));
  const flat = ResolveQuotaCounts({ 1: 4, 2: 6, 3: 2 }, 99, 'flat');
  assert.deepEqual(flat, { 1: 4, 2: 6, 3: 2 });
  const slots = BuildTargetSlots(flat, { common: 7, uncommon: 3, rare: 2 });
  assert.equal(slots.length, 12);
  assert.equal(slots[0].targetRank, 1);
  assert.equal(slots[0].targetRarity, 'common');
  assert.equal(slots.at(-1).targetRank, 3);
  assert.equal(slots.at(-1).targetRarity, 'rare');
});

test('GenerateCard and GenerateCardBatch honour schools, stances, effectCount, keywords, and aimMaxCp', () => {
  const scoring=controlledScoring;
  const { face, cp } = GenerateFace({
    rarity: 'uncommon',
    rank: 3,
    aimMaxCp: true,
    camp: 'spell',
    school: 'fire',
    stances: ['prepared'],
    effectCount: 2,
    targeting: 'area',
    keywords: ['retain'],
    seed: 'fire_test',
  }, { scoring });
  assert.ok(cp <= RankMaxCp(3, scoring), `cp ${cp} <= max ${RankMaxCp(3, scoring)}`);
  assert.equal(RankOf(cp, scoring), 3);
  assert.ok(face.tags.includes('school:fire'));
  assert.ok(face.tags.includes('targeting:area'));
  assert.ok(face.kw.includes('retain'));

  const card = GenerateCard({
    rarity: 'rare',
    rank: 2,
    aimMaxCp: true,
    type: 'skill',
    stances: ['evade'],
    effectCount: 2,
    seed: 'evade_test',
  }, { scoring });
  assert.deepEqual(card.stanceTrigger, { stance: 'evade' });
  assert.ok(card.effects.some((e) => e.op === 'applyStatus' && e.status === 'evade'));

  const batchA = GenerateCardBatch({ count: 6, seed: 77, cls: 'starseer', rank: 2, aimMaxCp: true }, { scoring });
  const batchB = GenerateCardBatch({ count: 6, seed: 77, cls: 'starseer', rank: 2, aimMaxCp: true }, { scoring });
  assert.deepEqual(batchA.cards, batchB.cards, 'batch generation is deterministic by seed');
  assert.equal(batchA.cards.length, 6);
  for (const c of batchA.cards) {
    assert.equal(c.class, 'starseer');
    assert.ok(c.name.length <= 24, `convention name fits 24-char limit: ${c.name}`);
  }
});

test('GenerateItem and GenerateItemBatch report measured weapons, armours, and relics deterministically', () => {
  const scoring = shippedScoring;
  for (const [kind, rank, rarity] of [['weapon', 2, 'uncommon'], ['armour', 1, 'common'], ['relic', 3, 'rare']]) {
    const a = GenerateItem({ kind, rank, rarity, aimMaxCp: true, seed: 'item_det' }, { scoring });
    const b = GenerateItem({ kind, rank, rarity, aimMaxCp: true, seed: 'item_det' }, { scoring });
    assert.deepEqual(a.entry, b.entry, `${kind} generation is deterministic`);
    const band = RankBand(rank, scoring);
    const measured=ScoreGeneratedItem(a.entry,scoring);
    for(const key of ['raw','cp','rank','parts'])assert.deepEqual(a.score[key],measured[key], 'item measurement remains truthful for any current budget');
    assert.equal(a.score.rank, RankOf(a.score.cp, scoring), 'reported rank is measured rather than assumed');
    assert.ok(a.entry.name.length <= scoring.naming.item.limit.maxChars, `${kind} name <= 24 chars: ${a.entry.name}`);
  }
  const batch = GenerateItemBatch({ count: 9, seed: 99, element: 'fire', rank: 2 }, { scoring });
  assert.equal(batch.items.length, 9);
  assert.equal(new Set(batch.items.map((x) => x.key)).size, 9);
});

test('AutoBalanceCards hits quotas deterministically, aims near rank max CP, generates shortage, and optionally trims under explicit arithmetic weights', () => {
  const scoring = controlledScoring;
  const sample = Array.from({ length: 10 }, (_, i) => GenerateCard({
    rarity: 'common',
    rank: 1,
    cls: 'reaver',
    camp: 'physical',
    type: i % 3 === 0 ? 'skill' : 'attack',
    seed: `src_${i}`,
  }, { scoring }));

  const opts = {
    mode: 'flat',
    targetCount: 12,
    rankQuotas: { 0: 1, 1: 4, 2: 4, 3: 3, 4: 0, 5: 0 },
    rarityQuotas: { common: 6, uncommon: 4, rare: 2 },
    aimMaxCp: true,
    applyNaming: true,
    generateShortage: true,
    trimSurplus: false,
    seed: 123,
    scoring,
  };
  const run1 = AutoBalanceCards(sample, opts);
  const run2 = AutoBalanceCards(sample, opts);
  assert.deepEqual(run1, run2, 'AutoBalanceCards is 100% deterministic');
  assert.equal(run1.updated.length, 10);
  assert.equal(run1.created.length, 2, 'generates 2 missing cards to reach targetCount 12');
  assert.equal(run1.removedIds.length, 0);
  assert.deepEqual(run1.report.afterRarities, { common: 6, uncommon: 4, rare: 2 });
  assert.deepEqual(run1.report.afterRanks, { 0: 1, 1: 4, 2: 4, 3: 3 });

  // Verify each tuned card landed close to its rank's max allowed CP (never exceeding ceiling)
  for (const c of [...run1.updated, ...run1.created]) {
    const face = HeadlessCardFace(c, scoring);
    const cp = CombatPower(ScoreCard(face, scoring).raw, c.rarity, scoring);
    const rk = RankOf(cp, scoring);
    const band = RankBand(rk, scoring);
    assert.ok(cp <= band.max && cp >= band.max - 1, `card ${c.id} cp=${cp} should aim near rank ${rk} max=${band.max}`);
  }

  // Test surplus keeping vs trimming
  const kept = AutoBalanceCards(sample, {
    mode: 'flat', targetCount: 6, rankQuotas: { 1: 3, 2: 3 }, rarityQuotas: { common: 4, uncommon: 2 }, trimSurplus: false, scoring,
  });
  assert.equal(kept.updated.length, 6);
  assert.equal(kept.untouchedIds.length, 4);
  assert.equal(kept.removedIds.length, 0);

  const trimmed = AutoBalanceCards(sample, {
    mode: 'flat', targetCount: 6, rankQuotas: { 1: 3, 2: 3 }, rarityQuotas: { common: 4, uncommon: 2 }, trimSurplus: true, scoring,
  });
  assert.equal(trimmed.removedIds.length, 4);
});

test('AutoBalanceItems rebalances weapons and armours with shortage generation and convention naming', () => {
  const { rules } = buildItemRoster(contentBundle);
  const weapons=Array.from({length:8},(_,i)=>GenerateItem({kind:'weapon',rank:1,rarity:'common',seed:`quota-weapon-${i}`},{scoring}).entry);
  const res = AutoBalanceItems(weapons, {
    mode: 'flat',
    targetCount: 10,
    rankQuotas: { 0: 1, 1: 4, 2: 3, 3: 2, 4: 0, 5: 0 },
    rarityQuotas: { common: 5, uncommon: 3, rare: 2, boss: 0 },
    aimMaxCp: true,
    applyNaming: true,
    generateShortage: true,
    defaultKind: 'weapon',
    seed: 55,
    scoring,
    rules,
  });
  assert.equal(res.updated.length, 8);
  assert.equal(res.created.length, 2);
  assert.deepEqual(res.report.afterRarities, { common: 5, uncommon: 3, rare: 2 });
  for (const w of [...res.updated, ...res.created]) {
    const sc = ScoreGeneratedItem(w, scoring, rules);
    assert.ok(sc.rank >= 0 && sc.rank <= 3);
    assert.ok(w.name.length <= scoring.naming.item.limit.maxChars, `item name <= 24 chars: ${w.name}`);
  }
});

test('customDecks helpers and saveStudioDecks round-trip custom classes, decks, and repo persistence', () => {
  const cls = createCustomClass({ name: 'Ashblade', maxHp: 80, tint: '#d97757', description: 'Burn & poise duelist.' });
  const deck = createCustomDeck({ name: 'Ashblade Starter', cardIds: ['core.strike', 'core.defend'], itemKeys: ['weapon:straightSword'] });
  const active = setActiveDeckList([deck], deck.id);
  assert.equal(active[0].isActiveDeckList, true);
  const assigned = assignDeckToClass(active, [cls], deck.id, cls.id);
  assert.equal(assigned.customDecks[0].assignedClassId, cls.id);
  assert.equal(assigned.customClasses[0].deckId, deck.id);

  const bundle = buildStudioBundle({
    name: 'Test Bundle',
    cards: [GenerateCard({ rarity: 'common', rank: 1, seed: 'b1' }, { scoring })],
    items: [GenerateItem({ kind: 'weapon', rarity: 'common', rank: 1, seed: 'i1' }, { scoring }).entry],
    customClasses: assigned.customClasses,
    customDecks: assigned.customDecks,
  });
  const parsed = parseStudioBundle(JSON.stringify(bundle));
  assert.equal(parsed.cards.length, 1);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.customClasses.length, 1);
  assert.equal(parsed.customDecks.length, 1);

  const tmp = mkdtempSync(join(tmpdir(), 'studio-decks-'));
  try {
    const saved = saveStudioDecks(tmp, { path: 'content/source/studioDecks.json', bundle });
    assert.equal(saved.deckCount, 1);
    assert.equal(saved.classCount, 1);
    const read = readStudioConfig(tmp);
    assert.equal(read.customDecksExists, true);
    assert.equal(read.customDecks.customDecks[0].name, 'Ashblade Starter');
    assert.throws(() => saveStudioDecks(tmp, { path: '../escape.json', bundle }), /escapes/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});


test('a controlled passive relic reports its nearest measured score when its target is unreachable', () => {
  const passiveMods=Object.fromEntries(['maxHp','poise','mana','stamina','magicDamage','physicalDamage','block'].map(key=>[`relic.${key}`,{label:key,calc:[['*',1]]}]));
  const scoring={...shippedScoring,rank:{unrankedMax:0,width:100,maxRank:5,maxCp:500},rarity:{discount:{common:0,uncommon:0,rare:0}},items:{...shippedScoring.items,mods:passiveMods,propertyTriggers:{...shippedScoring.items.propertyTriggers,passiveValue:0}}};
  for (const [kind, rank, rarity] of [['relic', 3, 'rare']]) {
    const target = { kind, rank, rarity, relicMode:'passive', aimMaxCp: true, seed: 'item_det' };
    const result = GenerateItem(target, { scoring });
    assert.deepEqual(GenerateItem(structuredClone(target), { scoring }), result);
    const measured = ScoreGeneratedItem(result.entry, scoring);
    assert.deepEqual([result.score.raw, result.score.cp, result.score.rank, result.score.parts], [measured.raw, measured.cp, measured.rank, measured.parts]);
    assert.equal(result.score.rank, RankOf(result.score.cp, scoring));
    assert.ok(result.score.cp <= RankBand(rank, scoring).max);
    assert.ok(result.entry.name.length <= scoring.naming.item.limit.maxChars);
    if (kind !== 'relic') { assert.equal(result.score.rank, rank); continue; }
    assert.deepEqual(result.entry.triggers, []);
    // This seed chooses the passive-only pool. Independently price every legal
    // passive magnitude rather than treating the requested rank as achieved.
    const pool = [['maxHp', 'relic.maxHp', 3, 20], ['poiseThresholdAdd', 'relic.poise', 1, 8], ['maxMana', 'relic.mana', 1, 4],
      ['maxStamina', 'relic.stamina', 1, 3], ['magicDamageAdd', 'relic.magicDamage', 1, 5], ['physicalDamageAdd', 'relic.physicalDamage', 1, 5], ['blockAdd', 'relic.block', 1, 6]];
    const scores = pool.flatMap(([key, mod, min, max]) => Array.from({ length: max - min + 1 }, (_, i) =>
      ScoreGeneratedItem({ ...result.entry, passives: { [key]: min + i }, mods: [`${mod}=+${min + i}`] }, scoring).cp));
    const maximum = Math.max(...scores);
    assert.ok(maximum < RankBand(rank, scoring).min, 'the complete bounded passive pool cannot reach requested Rank 3');
    assert.equal(result.score.cp, maximum, 'the returned measured result reaches the finite pool ceiling');
    assert.ok(result.entry.name.endsWith(` ${'I'.repeat(result.score.rank)}`), 'the convention name uses the actual rank');
  }
});

test('shipped auto-balance reports actual quotas and preserves a bounded tuning miss below its requested CP ceiling', () => {
  const sample = Array.from({ length: 10 }, (_, i) => GenerateCard({ rarity: 'common', rank: 1, cls: 'reaver', camp: 'physical', type: i % 3 === 0 ? 'skill' : 'attack', seed: `src_${i}` }, { scoring }));
  const original = structuredClone(sample);
  const options = { mode: 'flat', targetCount: 12, rankQuotas: { 0: 1, 1: 4, 2: 4, 3: 3 }, rarityQuotas: { common: 6, uncommon: 4, rare: 2 },
    aimMaxCp: true, applyNaming: true, generateShortage: true, trimSurplus: false, seed: 123, scoring };
  const result = AutoBalanceCards(sample, options);
  assert.deepEqual(result, AutoBalanceCards(sample, options)); assert.deepEqual(sample, original);
  assert.equal(result.updated.length, 10); assert.equal(result.created.length, 2);
  const ranks = {}, rarities = {};
  for (const card of [...result.updated, ...result.created]) {
    const cp = CombatPower(ScoreCard(HeadlessCardFace(card, scoring), scoring).raw, card.rarity, scoring), rank = RankOf(cp, scoring);
    ranks[rank] = (ranks[rank] || 0) + 1; rarities[card.rarity] = (rarities[card.rarity] || 0) + 1;
    assert.ok(cp <= RankBand(rank, scoring).max);
  }
  assert.deepEqual(result.report.afterRanks, ranks); assert.deepEqual(result.report.afterRarities, rarities);
  assert.deepEqual(rarities, options.rarityQuotas);
  const source={id:'fixture.bounded-card',name:'Bounded card',class:'reaver',rarity:'common',cost:1,staminaCost:1,manaCost:0,type:'attack',keywords:[],tags:['camp:physical'],effects:[{op:'damage',target:'enemy',amount:6}]};
  const bounded={...controlledScoring,rank:{unrankedMax:0,width:100,maxRank:5,maxCp:500}};
  const tuned = TuneCardToTarget(source, { targetRank: 2, targetRarity: 'common', aimMaxCp: true, scoring:bounded,allowExtraEffects:false,allowHpDrawback:false });
  assert.equal(tuned.targetCp, RankBand(2, bounded).max);
  assert.equal(tuned.score.rank, RankOf(tuned.score.cp,bounded)); assert.ok(tuned.score.cp < tuned.targetCp - 1);
  // The existing damage-only magnitude search stops at 60. Price its full
  // SP 0..3 domain to show this miss follows the bounded mechanical envelope.
  const cpOf = card => CombatPower(ScoreCard(HeadlessCardFace(card, bounded), bounded).raw, card.rarity, bounded);
  const reachable = [];
  for (let sp = 0; sp <= 3; sp++) for (let amount = 1; amount <= 60; amount++) reachable.push(cpOf({ ...source, cost: sp, staminaCost: sp, effects: source.effects.map((effect, i) => i === 0 ? { ...effect, amount } : effect) }));
  assert.equal(tuned.score.cp, Math.max(...reachable), 'the actual result reaches the bounded primary ceiling');
  assert.ok(Math.max(...reachable) < tuned.targetCp);
  assert.deepEqual(tuned.card.effects.map(effect => effect.op), source.effects.map(effect => effect.op));
  assert.deepEqual(sample,original,'bounded fixture tuning leaves current-catalog input untouched');
});
