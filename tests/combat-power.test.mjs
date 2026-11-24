import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BaseFace, ScoreCard, CardCategories, CardKind, ScoreItem, CombatPower, RankOf, RankName, RankRange, CardName, CardNameParts, ItemName, ApplyScoringOverride } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { cardCombatPower, itemCombatPower } from '../src/content/generated/combatPower.js';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

test('combat power: all 95 Core card faces score the expected raw value of the reference scorer', () => {
  const faces = fixture('combat-power-core-faces.json');
  assert.equal(faces.length, 95);
  for (const face of faces) assert.equal(ScoreCard(face).raw, face.pyScore, face.id);
});

test('combat power: every item scores what the standalone simulator scores (raw and convention name)', () => {
  const { items, props } = fixture('combat-power-items.json');
  const expected = fixture('combat-power-items-expected.json');
  assert.equal(items.length, 181);
  assert.equal(expected.length, items.length);
  items.forEach((item, i) => {
    assert.equal(`${item.kind}:${item.id}`, `${expected[i].kind}:${expected[i].id}`);
    assert.equal(ScoreItem(item, scoring, props).raw, expected[i].raw, `${item.kind}:${item.id}`);
    assert.equal(ItemName(item, 0, scoring, props), expected[i].name, `name of ${item.kind}:${item.id}`);
  });
});

test('combat power: rank bands and rarity discounts', () => {
  assert.equal(RankOf(0), 0); assert.equal(RankOf(-7), 0);
  assert.equal(RankName(0), 'Unranked');
  assert.deepEqual([1, 4, 5, 8, 36, 37, 40, 99].map(cp => RankOf(cp)), [1, 1, 2, 2, 9, 10, 10, 10]);
  assert.equal(RankName(RankOf(4)), 'Rank 1');
  assert.equal(RankRange(0), '<= 0'); assert.equal(RankRange(4), '13-16'); assert.equal(RankRange(10), '37-40');
  assert.equal(scoring.rank.maxCp, 40);
  assert.equal(CombatPower(10, 'common'), 10);
  assert.equal(CombatPower(10, 'uncommon'), 8);
  assert.equal(CombatPower(10, 'rare'), 5);
  assert.equal(CombatPower(10, 'boss'), 3);
  assert.equal(CombatPower(10, 'starter'), 10);
});

test('combat power: scoring overrides change the result and the shipped table is not mutated', () => {
  const face = fixture('combat-power-core-faces.json').find(f => f.id === 'smash');
  const edited = JSON.parse(JSON.stringify(scoring));
  edited.costs.sp.weight = -10;
  assert.equal(ScoreCard(face, edited).raw, ScoreCard(face).raw + face.sp * (-10 - scoring.costs.sp.weight)); // follows the shipped SP weight
  edited.rarity.discount.rare = 9;
  assert.equal(CombatPower(10, 'rare', edited), 1);
  assert.equal(scoring.rarity.discount.rare, 5);
  assert.match(CardName(face), /^\S+ \S+( [IVX]+)?$/);
});

test('combat power: rounding is half away from zero for cards', () => {
  const face = { ...fixture('combat-power-core-faces.json')[0], statuses: [], kw: [], tags: [], sp: 0, mp: 0, dmg: 0, blk: 1, poise: 0, draw: 0, heal: 0, loseHp: 0 };
  // a face worth exactly half a point under the shipped weights (damage 1 per 3, HP cost -1 per 2)
  assert.equal(ScoreCard({ ...face, blk: 0, dmg: 3, loseHp: 1 }).raw, 1); // 0.5 -> 1
  assert.equal(ScoreCard({ ...face, blk: 0, loseHp: 1 }).raw, -1); // -0.5 -> -1
});

test('combat power: the generated table is fresh and covers every Core card and item', () => {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/combat-power-report.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(Object.keys(cardCombatPower).length >= 95);
  assert.equal(Object.keys(itemCombatPower).length, 181);
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
  const custom = { ...scoring, rank: { ...scoring.rank, unrankedMax: 2 } };
  const parse = label => { const m = /^(\d+)-(\d+)$/.exec(label); return m ? [Number(m[1]), Number(m[2])] : null; };
  assert.equal(RankRange(0, custom), '<= 2');
  assert.equal(RankRange(1, custom), '3-4', 'Rank 1 starts at unrankedMax + 1');
  assert.equal(RankRange(2, custom), '5-8');
  for (let cp = -1; cp <= scoring.rank.maxCp; cp++) {
    const k = RankOf(cp, custom);
    if (k === 0) { assert.ok(cp <= 2, `cp ${cp}`); continue; }
    const [lo, hi] = parse(RankRange(k, custom));
    assert.ok(cp >= lo && cp <= hi, `cp ${cp} is Rank ${k} but its label is ${RankRange(k, custom)}`);
  }
  assert.equal(RankRange(1), '1-4', 'the shipped table (unrankedMax 0) is unchanged');
});

test('the effect count sees a status even when a tag shares its part key', async () => {
  const { BaseFace } = await import('../src/model/combatPower.js');
  const face = tags => Object.assign(BaseFace(), { sp: 1, dmg: 4, statuses: [['venom', 2, 'enemy']], tags });
  const plain = ScoreCard(face([])), tagged = ScoreCard(face(['venom']));
  assert.ok(plain.parts['effect count'] > 0, 'damage + Venom is two effects');
  assert.equal(tagged.parts['effect count'], plain.parts['effect count'], 'a venom tag does not hide the Venom status');
});

test('ApplyScoringOverride leaves rows untouched when absent and overrides rank, cp, or rarity when set', () => {
  const base = { raw: 64, cp: 59, rank: 10, rarity: 'rare' };
  assert.equal(ApplyScoringOverride(base, null), base);
  assert.equal(ApplyScoringOverride(base, {}), base);
  assert.deepEqual(ApplyScoringOverride(base, { rank: 5 }), { ...base, rank: 5, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rank: 99 }), { ...base, rank: scoring.rank.maxRank, overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { cp: 14 }), { raw: 64, cp: 14, rank: RankOf(14), rarity: 'rare', overridden: true });
  assert.deepEqual(ApplyScoringOverride(base, { rarity: 'common' }), { raw: 64, cp: 64, rank: 10, rarity: 'common', overridden: true });
});

test('combat power: category weights add flat or scale the positive score, and default to no change', () => {
  const face = { ...fixture('combat-power-core-faces.json')[0] };
  const base = ScoreCard(face, scoring);
  assert.deepEqual(CardCategories({ camp: 'spell', type: 'skill' }), ['magic', 'spell']);
  assert.deepEqual(CardCategories({ camp: 'physical', type: 'attack', tags: ['maneuver:sweep'], magicShare: 0.5 }), ['martial', 'magic', 'hybrid', 'sweep']);
  assert.equal(CardKind({ type: 'attack', tags: ['maneuver:smash'] }), 'attack');
  assert.equal(CardKind({ type: 'power', tags: ['camp:spell'] }), 'power');
  assert.deepEqual(CardCategories({ camp: 'physical', type: 'attack', categories: ['martial', 'magic', 'sweep'] }), ['martial', 'magic', 'sweep']);
  const [school, type] = CardCategories(face);
  const withWeights = (categories) => ({ ...scoring, categories: { ...scoring.categories, ...categories } });
  const flat = ScoreCard(face, withWeights({ [school]: { weight: 3, multiplier: false } }));
  assert.equal(flat.parts[`category:${school}`], 3);
  const scaled = ScoreCard(face, withWeights({ [type]: { weight: 2, multiplier: true } }));
  assert.equal(scaled.parts[`category:${type}`], base.positive);
  assert.equal(ScoreCard(face, withWeights({ [type]: { weight: 1, multiplier: true } })).raw, base.raw);
});

// Owner 2026-11-24: <rarity> <second effect> <element (magic only)> <base> <rank numeral><upgrade mark>.
const nameFace = (o) => Object.assign(BaseFace(), o);
// The full convention, before naming.card.limit trims it (a config with no limit block has no limit).
const noLimit = JSON.parse(JSON.stringify(scoring)); delete noLimit.naming.card.limit;
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
  const greater = martialHit({ rarity: 'rare', dmg: 12, statuses: [['burn', 2, 'enemy']] });
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
const limitScoring = (limit) => { const s = JSON.parse(JSON.stringify(scoring)); s.naming.card.limit = limit; return s; };
const KEEP = ['base', 'rank', 'upgrade', 'element', 'effect', 'rarity'];
// A rare Rank 2 frost bolt that burns: 'Greater Searing Frost Bolt II+' in full (31 characters).
const frostBolt = magicHit(['school:frost'], { rarity: 'rare', mp: 0, dmg: 6, statuses: [['burn', 2, 'enemy']] });

test('card names: the shipped limit is 20 characters, keeping base, rank, upgrade, element, effect, rarity', () => {
  assert.deepEqual(scoring.naming.card.limit, { maxChars: 20, keep: KEEP });
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
  assert.equal(CardName(frostBolt, 1), 'Frost Bolt II+'); // the shipped limit
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
