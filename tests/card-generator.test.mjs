import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { GenerateCard, GenerateFace, MaxCpOf, CARD_TYPES, SCHOOLS, CAMPS, RANGES, KEYWORDS, RIDER_EFFECTS } from '../src/model/cardGenerator.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { contentBundle } from '../src/content/index.js';
import { validateCardTemplates } from '../src/model/validate/templates.js';
import { scoring } from '../src/content/generated/scoring.js';

const historicalScoring = JSON.parse(readFileSync(new URL('./fixtures/scoring-pre-starseer.json', import.meta.url), 'utf8'));

const RARITIES = ['common', 'uncommon', 'rare'];
const shapes = [];
for (const type of ['attack', 'skill']) for (const camp of ['physical', 'spell']) shapes.push({ type, camp });

test('card generator: every rarity x rank 0-5 x shape x seed lands exactly on its target combat power', () => {
  for (const rarity of RARITIES) for (let rank = 0; rank <= 5; rank++) for (const shape of shapes) for (let seed = 1; seed <= 25; seed++) {
    const { face, cp } = GenerateFace({ rarity, rank, seed, ...shape });
    assert.equal(RankOf(cp), rank, `${rarity} rank ${rank} seed ${seed}: cp ${cp}`);
    assert.equal(CombatPower(ScoreCard(face).raw, rarity), cp, `${rarity} rank ${rank} ${shape.type}/${shape.camp} seed ${seed}`);
  }
});

test('card generator: an explicit combatPower is honoured, including very low and very high', () => {
  for (const combatPower_ of [-12, -5, 0, 1, 7, 19, MaxCpOf(scoring)]) for (const rarity of ['common', 'rare']) {
    const { face, cp } = GenerateFace({ rarity, combatPower: combatPower_, seed: 3 });
    assert.equal(cp, combatPower_);
    assert.equal(CombatPower(ScoreCard(face).raw, rarity), combatPower_);
  }
});

test('card generator: never emits a card over the combat-power ceiling (scoring.rank.maxCp); every rank 0-max stays inside its band', () => {
  const ceiling = MaxCpOf(scoring);
  for (const rarity of RARITIES) for (let rank = 0; rank <= scoring.rank.maxRank; rank++) for (const shape of shapes) for (let seed = 1; seed <= 15; seed++) {
    const { face, cp } = GenerateFace({ rarity, rank, seed, ...shape });
    assert.ok(cp <= ceiling, `${rarity} rank ${rank} cp ${cp} over ${ceiling}`);
    assert.equal(RankOf(cp), rank);
    assert.ok(CombatPower(ScoreCard(face).raw, rarity) <= ceiling);
  }
  assert.throws(() => GenerateFace({ rarity: 'common', combatPower: ceiling + 1 }), /over the ceiling/);
  const low = { ...scoring, rank: { ...scoring.rank, maxCp: 10 } };
  assert.throws(() => GenerateFace({ rarity: 'common', combatPower: 11 }, { scoring: low }), /over the ceiling/);
  for (let seed = 1; seed <= 20; seed++) assert.equal(GenerateFace({ rarity: 'rare', rank: scoring.rank.maxRank, seed }, { scoring: low }).cp, 10);
});

test('card generator: output has the Core card shape and passes the card template validator', () => {
  const generated = [];
  for (const rarity of RARITIES) for (const shape of shapes) for (let rank = 0; rank <= 5; rank++) generated.push(GenerateCard({ rarity, rank, seed: 100 * rank + generated.length, ...shape }, { spellExposureBuildup: contentBundle.balance.exposure.elementUpgradeBuildup }));
  assert.equal(new Set(generated.map(c => c.id)).size, generated.length);
  const coreCards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
  const coreKeys = new Set(coreCards.flatMap(card => Object.keys(card)));
  const coreOps = new Set(coreCards.flatMap(card => card.effects.map(e => e.op)));
  const coreTags = new Set(coreCards.flatMap(card => card.tags));
  const problems = [];
  const err = (path, msg) => problems.push({ path, msg });
  for (const card of generated) {
    assert.match(card.id, /^gen\./);
    for (const key of Object.keys(card)) assert.ok(coreKeys.has(key), `${card.id}: ${key} is not a Core card field`);
    for (const key of ['id', 'name', 'class', 'rarity', 'cost', 'staminaCost', 'manaCost', 'costRule', 'type', 'icon', 'keywords', 'effects', 'tags', 'textTemplate']) assert.ok(key in card, `${card.id}: missing ${key}`);
    for (const e of card.effects) { assert.ok(coreOps.has(e.op), `${card.id}: effect op ${e.op}`); assert.ok(e.amount >= 1, `${card.id}: amount`); }
    for (const t of card.tags) assert.ok(coreTags.has(t), `${card.id}: tag ${t} is not used by a Core card`);
    assert.ok(card.cost >= 0, `${card.id}: no cost minimum (owner ruling 2026-11-22)`);
    if (card.effects.some(e => e.op === 'damage')) assert.ok(['physical', 'magic'].includes(card.damageSchool) && Number.isInteger(card.exposureBuildupPerHit), `${card.id}: damage carrier`);
    validateCardTemplates(card, `cards.${card.id}`, err);
  }
  assert.deepEqual(problems, []);
});

test('card generator: deterministic by seed, different seeds differ, unknown input is refused', () => {
  const t = { rarity: 'uncommon', rank: 3, seed: 7 };
  assert.deepEqual(GenerateCard(t), GenerateCard({ ...t }));
  assert.equal(GenerateCard(t).id, 'gen.7');
  const ids = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify({ ...GenerateCard({ ...t, seed: i }), id: 0 })));
  assert.ok(ids.size > 3);
  assert.throws(() => GenerateCard({ rarity: 'mythic', rank: 1 }), /unknown rarity/);
  assert.throws(() => GenerateCard({ rarity: 'common' }), /rank or a combatPower/);
  assert.throws(() => GenerateCard({ rarity: 'common', rank: 11 }), /outside/);
  assert.equal(GenerateCard(t, { scoring }).name, GenerateCard(t).name);
});

// Owner, 2026-11-24: 1-3 effects, statuses, schools, costs, range, area, keyword and drawback, still at the exact target CP.
const RIDER_STATUSES = Object.keys(scoring.statuses);
const richTarget = (seed, rankCount = 8) => {
  const at = (list) => list[seed % list.length];
  return {
    rarity: at(RARITIES), rank: seed % rankCount, seed: `rich.${seed}`,
    camp: at(CAMPS), type: at(CARD_TYPES), school: at(SCHOOLS), range: at([...RANGES, undefined]),
    sp: seed % 4, mp: (seed >> 2) % 4, effects: 1 + (seed % 3),
    allowedEffects: RIDER_EFFECTS, allowedStatuses: RIDER_STATUSES,
    keyword: at([undefined, ...KEYWORDS, undefined]), drawback: seed % 5 === 0, area: seed % 7 === 0,
  };
};

test('card generator: multi-effect cards land exactly on their target combat power over many seeds under the historical scoring fixture', () => {
  const scoring = historicalScoring;
  let riders = 0, twoRiders = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const target = richTarget(seed);
    const { face, cp, riders: kept } = GenerateFace(target, { scoring });
    assert.equal(CombatPower(ScoreCard(face, scoring).raw, target.rarity, scoring), cp, `seed ${seed}: ${JSON.stringify(target)}`);
    assert.equal(RankOf(cp, scoring), target.rank, `seed ${seed}: rank`);
    assert.ok(kept.length <= target.effects - 1, `seed ${seed}: at most effects-1 riders`);
    riders += kept.length; if (kept.length === 2) twoRiders++;
  }
  assert.ok(riders > 500 && twoRiders > 100, `riders are kept on most cards (${riders} riders, ${twoRiders} cards with two)`);
});

test('card generator: an explicit rider list, school, range and area reach the card', () => {
  const card = GenerateCard({ rarity: 'uncommon', rank: 4, seed: 11, camp: 'magic', type: 'attack', school: 'fire', riders: ['status:burn', 'draw'], sp: 1, mp: 1 });
  assert.ok(card.tags.includes('school:fire') && card.tags.includes('damage:fire') && card.tags.includes('camp:spell'));
  assert.deepEqual(card.effects.map((e) => e.op), ['damage', 'applyStatus', 'draw']);
  assert.equal(card.effects[1].status, 'burn');
  assert.equal(card.manaCost, 1);
  const sweep = GenerateCard({ rarity: 'common', rank: 2, seed: 4, type: 'sweep', effects: 1, range: 'reach' });
  assert.ok(sweep.tags.includes('targeting:area') && sweep.tags.includes('maneuver:sweep') && !sweep.tags.includes('range:reach'));
  assert.equal(sweep.effects[0].target, 'allEnemies');
  const shot = GenerateCard({ rarity: 'common', rank: 2, seed: 4, type: 'attack', effects: 1, range: 'reach' });
  assert.ok(shot.tags.includes('range:reach'));
  const hybrid = GenerateCard({ rarity: 'rare', rank: 5, seed: 9, camp: 'hybrid', school: 'frost', effects: 1 });
  assert.equal(hybrid.magicShare, 0.5);
  assert.ok(hybrid.tags.includes('camp:physical') && hybrid.tags.includes('school:frost'));
  const martial = GenerateCard({ rarity: 'common', rank: 1, seed: 2, camp: 'martial', mp: 2, effects: 1 });
  assert.equal(martial.manaCost, 0, 'a martial card costs no MP');
});

test('card generator: a target below the base raises costs and drops riders before any HP, and stays exact', () => {
  const target = { rarity: 'common', combatPower: -10, seed: 5, sp: 0, effects: 3, riders: ['status:strength', 'heal'], keyword: 'retain' };
  const { face, cp, riders, miss } = GenerateFace(target);
  assert.equal(cp, -10);
  assert.equal(miss, false);
  assert.equal(CombatPower(ScoreCard(face).raw, 'common'), -10);
  assert.ok(face.sp > 0, 'the SP cost was raised first');
  assert.equal(face.loseHp, 0, 'no HP without a drawback');
  assert.ok(riders.length < 2, 'a rider was dropped');
  // Too low to reach even at the highest costs: the nearest combat power, marked as a miss, with HP only up to the cap.
  const low = GenerateCard({ rarity: 'common', combatPower: -40, seed: 5, effects: 1, drawback: true });
  assert.ok(low._cpMiss === -40, 'the card is marked as a miss');
  assert.ok(low.effects.find((e) => e.op === 'loseHp').amount <= 6, 'HP cost stays under the cap');
});

test('card generator: no HP cost without a drawback, and never more than 6, over many seeds', () => {
  let under = 0, over = 0;
  for (const policy of [historicalScoring, scoring]) {
  for (let seed = 0; seed < 400; seed++) for (const type of CARD_TYPES) for (const drawback of [false, true]) {
    const target = { rarity: RARITIES[seed % 3], rank: 0, seed: `hp.${seed}`, camp: CAMPS[seed % 3], type, effects: 1 + (seed % 3), allowedEffects: RIDER_EFFECTS, allowedStatuses: RIDER_STATUSES, drawback };
    const generated = GenerateFace(target, { scoring: policy });
    const { face, cp, wanted, miss } = generated;
    assert.equal(cp, CombatPower(ScoreCard(face, policy).raw, target.rarity, policy));
    assert.equal(miss, cp !== wanted, 'the miss flag states the actual target difference');
    if (!drawback) assert.equal(face.loseHp, 0, `seed ${seed} ${type}: HP without a drawback`);
    assert.ok(face.loseHp <= 6, `seed ${seed} ${type}: HP ${face.loseHp} over the cap`);
    if (!miss) assert.equal(cp, wanted);
    else if (policy === historicalScoring) assert.ok(cp > wanted, 'the historical additive-weight miss is too strong');
    else {
      const key = face.type === 'attack' ? 'dmg' : 'blk';
      assert.equal(face[key], 1, 'a bounded fallback keeps its minimum primary');
      assert.equal(face.sp, 3); assert.equal(face.mp, target.camp === 'martial' ? 0 : 3);
      assert.deepEqual(generated, GenerateFace(structuredClone(target), { scoring: policy }), 'misses remain deterministic');
      if (cp < wanted) {
        under++;
        // Multiplicative category weights can skip an integer target. Verify the
        // exact target is absent throughout the permitted primary search.
        for (let amount = 1; amount <= 999; amount++) assert.notEqual(CombatPower(ScoreCard({ ...face, [key]: amount }, policy).raw, target.rarity, policy), wanted);
      } else over++;
      const card = GenerateCard(target, { scoring: policy });
      assert.equal(card._cpMiss, wanted, 'exported cards expose the missed target instead of a score pin');
    }
  }
  }
  assert.ok(under > 0 && over > 0, 'current weights exercise truthful misses on both sides');
  // the reviewer's case: a common martial counter at Rank 0
  for (let seed = 1; seed <= 40; seed++) assert.equal(GenerateFace({ rarity: 'common', rank: 0, seed, camp: 'martial', type: 'counter', effects: 1 }).face.loseHp, 0);
});

test('card generator: a magic counter or defend is a skill, a magic smash or sweep an attack', () => {
  for (const [type, kind] of [['counter', 'skill'], ['defend', 'skill'], ['smash', 'attack'], ['sweep', 'attack']]) {
    const card = GenerateCard({ rarity: 'common', rank: 2, seed: 3, camp: 'magic', type, effects: 1 });
    assert.equal(card.type, kind, type);
    assert.ok(card.tags.includes('maneuver:casting'));
  }
});

test('card generator: multi-effect cards pass the card template validator and use only real ops under the historical scoring fixture', () => {
  const scoring = historicalScoring;
  const coreCards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
  const coreOps = new Set(coreCards.flatMap(card => card.effects.map(e => e.op)));
  const problems = [];
  const err = (path, msg) => problems.push({ path, msg });
  for (let seed = 0; seed < 400; seed++) {
    const card = GenerateCard(richTarget(seed), { scoring });
    for (const e of card.effects) assert.ok(coreOps.has(e.op), `${card.id}: op ${e.op}`);
    if (card.faceTemplate) assert.ok(card.faceTemplate.length <= 3);
    assert.ok(card.name.length > 0);
    validateCardTemplates(card, `cards.${card.id}`, err);
  }
  assert.deepEqual(problems, []);
});

test('card generator: multi-effect output is deterministic by seed and differs across seeds under the historical scoring fixture', () => {
  const scoring = historicalScoring;
  for (let seed = 0; seed < 60; seed++) assert.deepEqual(GenerateCard(richTarget(seed), { scoring }), GenerateCard(structuredClone(richTarget(seed)), { scoring }));
  const names = new Set(Array.from({ length: 60 }, (_, i) => JSON.stringify(GenerateCard({ ...richTarget(1), seed: `x${i}` }, { scoring }).effects)));
  assert.ok(names.size > 10, `different seeds give different cards (${names.size})`);
  assert.throws(() => GenerateCard({ rarity: 'common', rank: 1, effects: 4 }), /effects must be/);
  assert.throws(() => GenerateCard({ rarity: 'common', rank: 1, school: 'water' }), /unknown school/);
  assert.throws(() => GenerateCard({ rarity: 'common', rank: 1, type: 'dance' }), /type must be/);
});


test('shipped multi-effect generation covers every supported rank with truthful scores, legal effects and seeded variation', () => {
  const problems = [], ranks = new Set(), variants = new Set(); let riders = 0, twoRiders = 0;
  for (let seed = 0; seed < 400; seed++) {
    const target = richTarget(seed, scoring.rank.maxRank + 1), result = GenerateFace(target);
    ranks.add(target.rank);
    assert.equal(result.cp, CombatPower(ScoreCard(result.face, scoring).raw, target.rarity, scoring));
    assert.equal(result.miss, result.cp !== result.wanted);
    if (!result.miss) assert.equal(RankOf(result.cp, scoring), target.rank);
    assert.ok(result.riders.length <= target.effects - 1);
    riders += result.riders.length; if (result.riders.length === 2) twoRiders++;
    const card = GenerateCard(target); validateCardTemplates(card, card.id, (path, msg) => problems.push({ path, msg }));
    assert.equal(card._cpMiss, result.miss ? result.wanted : undefined);
    if (seed < 60) assert.deepEqual(GenerateCard(structuredClone(target)), card);
    variants.add(JSON.stringify(card.effects));
  }
  assert.deepEqual([...ranks].sort(), [0, 1, 2, 3, 4, 5]);
  assert.ok(riders > 100 && twoRiders > 20, 'real shipped weights retain multi-effect mechanics');
  assert.ok(variants.size > 100); assert.deepEqual(problems, []);
  assert.throws(() => GenerateCard({ rarity: 'common', rank: 6, effects: 3 }), /outside 0\.\.5/);
});
