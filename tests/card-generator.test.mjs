import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { GenerateCard, GenerateFace, MaxCpOf } from '../src/model/cardGenerator.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { contentBundle } from '../src/content/index.js';
import { validateCardTemplates } from '../src/model/validate/templates.js';
import { scoring } from '../src/content/generated/scoring.js';

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
    if (card.manaCost > 0) assert.ok(card.cost >= 1, `${card.id}: a Mana card costs at least 1 action`);
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
