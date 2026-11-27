import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BaseFace, ScoreCard, PrepareCardScorer, CardCategories, CardKind, ScoreItem, CombatPower, RankOf, RankName, RankRange, CardName, CardNameParts, ItemName, ApplyScoringOverride } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { scoringContract } from './helpers/scoring-contract.mjs';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

// Explicit arithmetic and vocabulary fixtures protect formulas, independently of balance.
const arithmetic = scoringContract();

test('combat power: controlled effects, costs, riders and area score in the specified order', () => {
  const face = { ...BaseFace(), sp: 2, mp: 1, dmg: 12, blk: 6, poise: 3, tags: ['targeting:area'], kw: ['retain'] };
  const result = ScoreCard(face, arithmetic);
  // Damage (8), Block (2), Poise (6), costs (-16), Retain (3), extra effect (2).
  assert.deepEqual(result.parts, { SP: -8, MP: -8, damage: 8, block: 2, poise: 6, retain: 3, 'effect count': 2 });
  assert.equal(result.positive, 16);
  assert.equal(result.raw, 5);
  assert.equal(ScoreCard({ ...face, tags: [], categories: ['hybrid'] }, arithmetic).parts['category:hybrid'], 10);
});

test('a per-operation scorer preserves every score part and new operations read in-place weight edits', () => {
  const weights = scoringContract();
  const faces = [
    { ...BaseFace(), sp: 2, mp: 1, dmg: 12, blk: 6, poise: 3, tags: ['targeting:area'], kw: ['retain'] },
    { ...BaseFace(), sp: 0, draw: 2, heal: 3, statuses: [['venom', 2, 'enemy']] },
    { ...BaseFace(), sp: 0, dmg: 3, loseHp: 1, tags: ['damage:fire'] },
  ];
  const source = structuredClone(faces), score = PrepareCardScorer(weights);
  for (const face of faces) assert.deepEqual(score(face), ScoreCard(face, weights));
  assert.deepEqual(score(faces[0]).parts, { SP: -8, MP: -8, damage: 8, block: 2, poise: 6, retain: 3, 'effect count': 2 });
  assert.equal(score(faces[0]).raw, 5);
  weights.effects.damage.weight = 2;
  weights.costs.sp.weight = -5;
  const refreshed = PrepareCardScorer(weights);
  for (const face of faces) assert.deepEqual(refreshed(face), ScoreCard(face, weights));
  assert.equal(refreshed(faces[0]).raw, 11, 'new damage value adds 8, changed SP price subtracts 2');
  assert.deepEqual(faces, source);
});

test('combat power: every shipped item scores consistently and produces a convention name within the limit', async () => {
  const { itemFaces } = await import('../tools/combat-power-report.mjs');
  const { items, props } = (() => { const r = itemFaces(); return { items: r.items, props: r.rules }; })();
  assert.ok(items.length > 0);
  assert.deepEqual(Object.keys(itemCombatPower).sort(), items.map(item => `${item.kind}:${item.id}`).sort());
  for (const item of items) {
    const key = `${item.kind}:${item.id}`;
    const scored = ScoreItem(item, scoring, props);
    const expected = ApplyScoringOverride(
      { raw: scored.raw, cp: scored.cp, rank: RankOf(scored.cp), rarity: item.rarity },
      { ...scoring.overrides?.[key], ...item.scoringOverride },
      scoring,
    );
    assert.deepEqual(itemCombatPower[key], expected, key);
    const name = ItemName(item, 0, scoring, props);
    assert.ok(typeof name === 'string' && name.length > 0, `name of ${key}`);
    assert.ok(name.length <= scoring.naming.item.limit.maxChars, `name length of ${key}: ${name}`);
  }
});

test('combat power: rank bands and rarity discounts', () => {
  const legacy = arithmetic;
  assert.equal(RankOf(0, legacy), 0); assert.equal(RankOf(-7, legacy), 0);
  assert.equal(RankName(0), 'Unranked');
  assert.deepEqual([1, 4, 5, 8, 36, 37, 40, 99].map(cp => RankOf(cp, legacy)), [1, 1, 2, 2, 9, 10, 10, 10]);
  assert.equal(RankName(RankOf(4, legacy)), 'Rank 1');
  assert.equal(RankRange(0, legacy), '<= 0'); assert.equal(RankRange(4, legacy), '13-16'); assert.equal(RankRange(10, legacy), '37-40');
  assert.equal(legacy.rank.maxCp, 40);
  assert.equal(CombatPower(10, 'common', legacy), 10);
  assert.equal(CombatPower(10, 'uncommon', legacy), 8);
  assert.equal(CombatPower(10, 'rare', legacy), 5);
  assert.equal(CombatPower(10, 'boss', legacy), 3);
  assert.equal(CombatPower(10, 'starter', legacy), 10);
});

test('combat power: scoring overrides change the result and the shipped table is not mutated', () => {
  const face = { ...BaseFace(), sp: 2, dmg: 12 };
  const before = structuredClone(scoring);
  const edited = JSON.parse(JSON.stringify(scoring));
  edited.costs.sp.weight = -10;
  assert.equal(ScoreCard(face, edited).raw, ScoreCard(face).raw + face.sp * (-10 - scoring.costs.sp.weight)); // follows the shipped SP weight
  edited.rarity.discount.rare = 9;
  assert.equal(CombatPower(10, 'rare', edited), 1);
  assert.deepEqual(scoring, before, 'scoring overrides leave the source table immutable');
  const name=CardName(face);
  assert.ok(name.length>0 && name.length<=scoring.naming.card.limit.maxChars);
});

test('combat power: rounding is half away from zero for cards', () => {
  const face = { ...BaseFace(), statuses: [], kw: [], tags: [], sp: 0, mp: 0, dmg: 0, blk: 1, poise: 0, draw: 0, heal: 0, loseHp: 0 };
  // a face worth exactly half a point under the historical fixture weights (damage 1 per 3, HP cost -1 per 2)
  assert.equal(ScoreCard({ ...face, blk: 0, dmg: 3, loseHp: 1 }, arithmetic).raw, 1); // 0.5 -> 1
  assert.equal(ScoreCard({ ...face, blk: 0, loseHp: 1 }, arithmetic).raw, -1); // -0.5 -> -1
});

test('combat power: the generated table is fresh and covers every Core card and item', async () => {
  const { measureCards, itemFaces } = await import('../tools/combat-power-report.mjs');
  assert.deepEqual(Object.keys(cardCombatPower).sort(), Object.keys(measureCards()).sort());
  assert.deepEqual(Object.keys(itemCombatPower).sort(), itemFaces().items.map(item => `${item.kind}:${item.id}`).sort());
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/combat-power-report.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const source = JSON.parse(readFileSync(new URL('../content/source/scoring.json', import.meta.url), 'utf8'));
  assert.deepEqual(scoring, source, 'the authored weights reach runtime unchanged');
  for (const row of [...Object.values(cardCombatPower), ...Object.values(itemCombatPower)]) {
    assert.ok(Number.isFinite(row.raw) && Number.isFinite(row.cp), `non-finite score ${JSON.stringify(row)}`);
    if (!row.overridden) {
      assert.equal(row.cp, CombatPower(row.raw, row.rarity));
      assert.equal(row.rank, RankOf(row.cp));
    }
    assert.ok(row.rank >= 0 && row.rank <= scoring.rank.maxRank, `rank ${row.rank} outside 0..${scoring.rank.maxRank}`);
  }
});

test('RankRange labels agree with RankOf when unrankedMax is not 0', () => {
  const custom = { ...arithmetic, rank: { ...arithmetic.rank, unrankedMax: 2 } };
  const parse = label => { const m = /^(\d+)-(\d+)$/.exec(label); return m ? [Number(m[1]), Number(m[2])] : null; };
  assert.equal(RankRange(0, custom), '<= 2');
  assert.equal(RankRange(1, custom), '3-4', 'Rank 1 starts at unrankedMax + 1');
  assert.equal(RankRange(2, custom), '5-8');
  for (let cp = -1; cp <= arithmetic.rank.maxCp; cp++) {
    const k = RankOf(cp, custom);
    if (k === 0) { assert.ok(cp <= 2, `cp ${cp}`); continue; }
    const [lo, hi] = parse(RankRange(k, custom));
    assert.ok(cp >= lo && cp <= hi, `cp ${cp} is Rank ${k} but its label is ${RankRange(k, custom)}`);
  }
  assert.equal(RankRange(1, arithmetic), '1-4', 'the historical table (unrankedMax 0) is unchanged');
});

test('the effect count sees a status even when a tag shares its part key', async () => {
  const { BaseFace } = await import('../src/model/combatPower.js');
  const face = tags => Object.assign(BaseFace(), { sp: 1, dmg: 4, statuses: [['venom', 2, 'enemy']], tags });
  const plain = ScoreCard(face([]), arithmetic), tagged = ScoreCard(face(['venom']), arithmetic);
  assert.ok(plain.parts['effect count'] > 0, 'damage + Venom is two effects');
  assert.equal(tagged.parts['effect count'], plain.parts['effect count'], 'a venom tag does not hide the Venom status');
});

test('ApplyScoringOverride leaves rows untouched when absent and overrides rank, cp, or rarity when set', () => {
  const base = { raw: 64, cp: CombatPower(64, 'rare', arithmetic), rank: RankOf(CombatPower(64, 'rare', arithmetic), arithmetic), rarity: 'rare' };
  assert.equal(ApplyScoringOverride(base, null, arithmetic), base);
  assert.equal(ApplyScoringOverride(base, {}, arithmetic), base);
  assert.deepEqual(ApplyScoringOverride(base, { rank: 5 }, arithmetic), { ...base, rank: 5, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rank: 99 }, arithmetic), { ...base, rank: arithmetic.rank.maxRank, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { cp: 14 }, arithmetic), { raw: 64, cp: 14, rank: RankOf(14, arithmetic), rarity: 'rare', overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rarity: 'common' }, arithmetic), { raw: 64, cp: 64, rank: RankOf(64, arithmetic), rarity: 'common', overridden: true });
});

test('combat power: category weights add flat or scale the positive score, and default to no change', () => {
  const face = { ...BaseFace(), sp: 1, dmg: 12 };
  const base = ScoreCard(face, arithmetic);
  assert.deepEqual(CardCategories({ camp: 'spell', type: 'skill' }), ['magic', 'spell']);
  assert.deepEqual(CardCategories({ camp: 'physical', type: 'attack', tags: ['maneuver:sweep'], magicShare: 0.5 }), ['martial', 'magic', 'hybrid', 'sweep']);
  assert.equal(CardKind({ type: 'attack', tags: ['maneuver:smash'] }), 'attack');
  assert.equal(CardKind({ type: 'power', tags: ['camp:spell'] }), 'power');
  assert.deepEqual(CardCategories({ camp: 'physical', type: 'attack', categories: ['martial', 'magic', 'sweep'] }), ['martial', 'magic', 'sweep']);
  const [school, type] = CardCategories(face);
  const withWeights = (categories) => ({ ...arithmetic, categories: { ...arithmetic.categories, ...categories } });
  const flat = ScoreCard(face, withWeights({ [school]: { weight: 3, multiplier: false } }));
  assert.equal(flat.parts[`category:${school}`], 3);
  const scaled = ScoreCard(face, withWeights({ [type]: { weight: 2, multiplier: true } }));
  assert.equal(scaled.parts[`category:${type}`], base.positive);
  assert.equal(ScoreCard(face, withWeights({ [type]: { weight: 1, multiplier: true } })).raw, base.raw);
});

// Owner 2026-11-24: <rarity> <second effect> <element (magic only)> <base> <rank numeral><upgrade mark>.
const nameFace = (o) => Object.assign(BaseFace(), o);
// The full convention, before naming.card.limit trims it (a config with no limit block has no limit).
const noLimit = structuredClone(arithmetic); delete noLimit.naming.card.limit;
const FullName = (face, ups = 0) => CardName(face, ups, noLimit);
const martialHit = (o = {}) => nameFace({ sp: 1, dmg: 3, tags: ['camp:physical', 'maneuver:attack', 'range:melee'], ...o });
const magicHit = (tags, o = {}) => nameFace({ camp: 'spell', sp: 0, mp: 1, dmg: 3, tags: ['camp:spell', ...tags], ...o });

test('card names: a common martial melee hit with only damage is "Strike"', () => {
  assert.equal(FullName(martialHit()), 'Strike');
  assert.equal(FullName(martialHit(), 1), 'Strike+');
  assert.equal(FullName(martialHit(), 2), 'Strike+2');
});

test('card names: rarity word and second-effect word', () => {
  const searing = martialHit({ rarity: 'uncommon', sp: 2, statuses: [['burn', 1, 'enemy']] });
  assert.equal(FullName(searing), 'Improved Searing Strike');
  const greater = martialHit({ rarity: 'rare', dmg: 21, statuses: [['burn', 2, 'enemy']] });
  assert.equal(CardNameParts(greater, 0, noLimit).rank, 2);
  assert.equal(FullName(greater, 1), 'Greater Searing Strike II+');
  assert.equal(FullName(greater, 2), 'Greater Searing Strike II+2');
});

test('card names: range picks the base word, and the base word names its range', () => {
  assert.equal(FullName(martialHit({ tags: ['camp:physical', 'range:reach'] })), 'Shot');
  assert.equal(FullName(martialHit({ tags: ['camp:physical'] })), 'Strike'); // martial defaults to melee
  assert.equal(FullName(magicHit(['school:fire', 'tradition:arcane'])), 'Flame Bolt'); // magic defaults to reach
  assert.equal(FullName(magicHit(['range:melee', 'tradition:arcane'])), 'Arcane Touch');
  assert.equal(FullName(magicHit(['targeting:area', 'school:frost'])), 'Frost Wave');
});

test('card names: magic always has an element word, from school, damage or tradition', () => {
  assert.equal(FullName(magicHit(['damage:fire'])), 'Flame Bolt');
  assert.equal(FullName(magicHit(['tradition:divine'])), 'Divine Bolt');
  assert.equal(FullName(magicHit(['tradition:arcane', 'tradition:divine'])), 'Arcane Bolt');
  assert.equal(FullName(magicHit([])), 'Arcane Bolt');
  // A hybrid hit (martial with a magic share) takes the magic words.
  assert.match(FullName(martialHit({ magicShare: 0.5, tags: ['camp:physical', 'range:melee', 'damage:frost'] })), /^Frost Touch( [IVX]+)?$/);
});

test('card names: a skill names its top effect; a heal-only divine rite is "Mending Divine Rite"', () => {
  const rite = nameFace({ camp: 'spell', type: 'skill', sp: 0, mp: 1, heal: 3, tags: ['camp:spell', 'tradition:divine'] });
  assert.match(FullName(rite), /^Mending Divine Rite( [IVX]+)?$/);
});

// Owner 2026-11-24: naming.card.limit {maxChars, keep}. Over maxChars, parts drop from the end of keep; base, rank and upgrade never drop.
const limitScoring = (limit) => { const s = structuredClone(arithmetic); s.naming.card.limit = limit; return s; };
const KEEP = ['base', 'rank', 'upgrade', 'element', 'effect', 'rarity'];
// A rare Rank 2 frost bolt that burns: 'Greater Searing Frost Bolt II+' in full (30 characters).
const frostBolt = magicHit(['school:frost'], { rarity: 'rare', mp: 0, dmg: 12, statuses: [['burn', 2, 'enemy']] });

test('card names: the explicit limit keeps the requested priority order', () => {
  assert.deepEqual(arithmetic.naming.card.limit, { maxChars: 24, keep: KEEP });
});

test('card names: the length limit trims rarity, then effect, then element', () => {
  assert.equal(FullName(frostBolt, 1), 'Greater Searing Frost Bolt II+');
  assert.equal(CardName(frostBolt, 1, limitScoring({ maxChars: 31, keep: KEEP })), 'Greater Searing Frost Bolt II+');
  const p1 = CardNameParts(frostBolt, 1, limitScoring({ maxChars: 22, keep: KEEP }));
  assert.equal(p1.name, 'Searing Frost Bolt II+');
  assert.deepEqual(p1.dropped, ['rarity']);
  const p2 = CardNameParts(frostBolt, 1, limitScoring({ maxChars: 20, keep: KEEP }));
  assert.equal(p2.name, 'Frost Bolt II+');
  assert.deepEqual(p2.dropped, ['rarity', 'effect']);
  assert.equal(CardName(frostBolt, 1, arithmetic), 'Searing Frost Bolt II+'); // the shipped limit (24)
});

test('card names: base, rank and upgrade are never dropped, even when still too long', () => {
  const p = CardNameParts(frostBolt, 3, limitScoring({ maxChars: 1, keep: KEEP }));
  assert.deepEqual(p.dropped, ['rarity', 'effect', 'element']);
  assert.equal(p.name, 'Bolt II+3');
});

test('card names: a custom keep order drops its last part first', () => {
  const p = CardNameParts(frostBolt, 1, limitScoring({ maxChars: 25, keep: ['base', 'rank', 'upgrade', 'rarity', 'effect', 'element'] }));
  assert.equal(p.name, 'Greater Searing Bolt II+');
  assert.deepEqual(p.dropped, ['element']);
});

test('card names: no limit block means no limit', () => {
  const p = CardNameParts(frostBolt, 2, noLimit);
  assert.deepEqual(p.dropped, []);
  assert.equal(p.name, 'Greater Searing Frost Bolt II+2');
});

test('card names: the divine words are "Divine"', () => {
  assert.equal(FullName(magicHit(['school:divine'])), 'Divine Bolt');
  assert.equal(FullName(magicHit(['damage:sacred'])), 'Divine Bolt');
  assert.equal(FullName(magicHit(['tradition:divine'])), 'Divine Bolt');
});

test('card names: an effect word that shares its first 4 letters with the element or base word is dropped', () => {
  // Ward (Warded) on an alteration (Warding) rite, and Block (Guarding) on a Guard.
  const rite = nameFace({ camp: 'spell', type: 'skill', sp: 0, mp: 1, statuses: [['ward', 2, 'self']], tags: ['camp:spell', 'school:alteration'] });
  assert.match(FullName(rite), /^Warding Rite( [IVX]+)?$/);
  const parts = CardNameParts(rite, 0, noLimit);
  assert.equal(parts.effect, null);
  // Words that only share fewer letters stay: Searing Strike.
  assert.equal(FullName(martialHit({ rarity: 'uncommon', sp: 2, statuses: [['burn', 1, 'enemy']] })), 'Improved Searing Strike');
});

test('card names: a limit with a keep order but no maxChars is no limit', () => {
  const p = CardNameParts(frostBolt, 1, limitScoring({ keep: ['base', 'rank', 'upgrade', 'rarity', 'effect', 'element'] }));
  assert.deepEqual(p.dropped, []);
  assert.equal(p.name, 'Greater Searing Frost Bolt II+');
});

test('CardNameParts: a custom scoring table saved before the newer naming tables still names cards', () => {
  const old = structuredClone(arithmetic);
  for (const table of ['range', 'defaultRange', 'tradition', 'defaultTradition', 'limit']) delete old.naming.card[table];
  assert.equal(CardName(frostBolt, 0, old), CardName(frostBolt, 0, limitScoring(undefined)), 'missing tables fall back to the shipped words');
  assert.match(CardName({ ...BaseFace(), dmg: 6 }, 0, old), /Strike/);
});


test('authored rank bands and rarity discounts reach the shared scorer', () => {
  const { width, maxRank, unrankedMax } = scoring.rank;
  for (let rank = 1; rank <= maxRank; rank++) {
    const lo = Math.max(unrankedMax + 1, width * (rank - 1) + 1);
    assert.equal(RankOf(lo, scoring), rank);
    assert.equal(RankOf(width * rank, scoring), rank);
  }
  for (const [rarity, discount] of Object.entries(scoring.rarity.discount)) {
    assert.equal(CombatPower(30, rarity, scoring), 30 - discount, rarity);
  }
});

test('controlled scalar and utility effect readers retain their arithmetic values',()=>{
  const cases=[['draw',2,4],['heal',2,6],['discard',3,-3],['restoreSp',2,8],['restoreMp',2,16],['cleanse',2,4],['counter',2,4],['reflect',2,4],['pull',2,2],['move',2,2],['holdOne',2,2],['boost',2,4],['cull',2,4],['shuffle',2,2],['attr',2,2]];
  for(const [field,n,expected] of cases){const face={...BaseFace(),sp:0,mp:0,[field]:n};assert.equal(ScoreCard(face,arithmetic).raw,expected,field);}
});
