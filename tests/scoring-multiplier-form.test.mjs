// Owner 2026-11-27: a cost, effect or status weight may carry `multiplier: true`. It then scores P x weight x units
// (P = the card's positive score from the flat parts) instead of weight x units, so a high-CP card pays more per SP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseFace, ScoreCard } from '../src/model/combatPower.js';
import { ValidateScoringConfig } from '../src/model/activeScoring.js';
import { scoringContract } from './helpers/scoring-contract.mjs';

const face = (o = {}) => ({ ...BaseFace(), sp: 2, mp: 0, dmg: 12, blk: 6, ...o });
const withEntry = (section, key, entry) => {
  const scoring = scoringContract();
  scoring[section][key] = { ...scoring[section][key], ...entry };
  return scoring;
};

test('multiplier form: false or absent scores exactly as the flat form', () => {
  const plain = scoringContract();
  const faces = [face(), face({ statuses: [['venom', 2, 'enemy'], ['strength', 2, 'self']] }), face({ tags: ['targeting:area'], poise: 3 })];
  for (const [section, key] of [['costs', 'sp'], ['effects', 'damage'], ['effects', 'block'], ['statuses', 'strength'], ['statuses', 'venom']]) {
    const off = withEntry(section, key, { multiplier: false });
    for (const f of faces) assert.deepEqual(ScoreCard(f, off), ScoreCard(f, plain), `${section}.${key}`);
  }
});

test('multiplier form: a cost scores P x weight x units and does not feed P', () => {
  const flat = ScoreCard(face(), scoringContract());
  // Damage 12/3 = 4, Block 6/3 = 2: P = 6 either way.
  assert.equal(flat.positive, 6);
  assert.equal(flat.parts.SP, -8);
  const scored = ScoreCard(face(), withEntry('costs', 'sp', { weight: -0.1, multiplier: true }));
  assert.equal(scored.positive, 6);
  assert.equal(scored.parts.SP, 6 * -0.1 * 2);
  const mp = ScoreCard(face({ mp: 3 }), withEntry('costs', 'mp', { weight: -0.2, multiplier: true }));
  assert.equal(mp.parts.MP, 6 * -0.2 * 3);
});

test('multiplier form: a negative cost multiplier takes CP in proportion to P', () => {
  const scoring = withEntry('costs', 'sp', { weight: -0.1, multiplier: true });
  const low = ScoreCard(face({ sp: 1, dmg: 6, blk: 0 }), scoring);
  const high = ScoreCard(face({ sp: 1, dmg: 60, blk: 0 }), scoring);
  assert.equal(low.positive, 2);
  assert.equal(high.positive, 20);
  assert.equal(low.parts.SP, 2 * -0.1 * 1);
  assert.equal(high.parts.SP, 20 * -0.1 * 1);
  assert.ok(high.parts.SP < low.parts.SP, 'the high-power card pays more for the same SP');
  assert.equal(high.parts.SP / low.parts.SP, high.positive / low.positive);
});

test('multiplier form: an effect scores P x weight x (amount / per), counts area, and does not feed P', () => {
  const scoring = withEntry('effects', 'block', { weight: 0.5, multiplier: true });
  const scored = ScoreCard(face(), scoring);
  // Block left P: only Damage (4) is positive before the multiplier parts.
  assert.equal(scored.positive, 4);
  assert.equal(scored.parts.block, 4 * 0.5 * (6 / 3));
  assert.equal(scored.parts['effect count'], 2, 'a multiplied effect is still an effect');
  const area = ScoreCard(face({ blk: 0, poise: 3, tags: ['targeting:area'] }), withEntry('effects', 'poiseDamage', { weight: 0.25, multiplier: true }));
  // Damage 12/3 x 2 enemies = 8 is P; Poise units are 3 / 1 x 2 enemies.
  assert.equal(area.positive, 8);
  assert.equal(area.parts.poise, 8 * 0.25 * (3 / 1 * 2));
});

test('multiplier form: a status scores P x weight x stacks (the formula value for a formula status), signed and per enemy', () => {
  const self = ScoreCard(face({ statuses: [['strength', 2, 'self']] }), withEntry('statuses', 'strength', { weight: 0.25, multiplier: true }));
  assert.equal(self.positive, 6);
  assert.equal(self.parts.strength, 6 * 0.25 * 2);
  // A self buff put on the enemy counts against the card, as the flat form does.
  const wrong = ScoreCard(face({ statuses: [['strength', 2, 'enemy']] }), withEntry('statuses', 'strength', { weight: 0.25, multiplier: true }));
  assert.equal(wrong.parts.strength, 6 * 0.25 * -2);
  // Venom's flat value is its formula (2 + 1 = 3 over 3 rounds), so its units are 3; on an area card, once per enemy.
  const flatVenom = ScoreCard(face({ blk: 0, statuses: [['venom', 2, 'enemy']] }), scoringContract());
  assert.equal(flatVenom.parts.venom, 3);
  const venom = ScoreCard(face({ blk: 0, tags: ['targeting:area'], statuses: [['venom', 2, 'enemy']] }), withEntry('statuses', 'venom', { weight: 0.1, multiplier: true }));
  assert.equal(venom.positive, 8);
  assert.equal(venom.parts.venom, 8 * 0.1 * (3 * 2));
});

test('multiplier form: multiplier parts read P only, never each other', () => {
  const scoring = scoringContract();
  Object.assign(scoring.costs.sp, { weight: -0.1, multiplier: true });
  Object.assign(scoring.effects.block, { weight: 0.5, multiplier: true });
  Object.assign(scoring.statuses.strength, { weight: 0.25, multiplier: true });
  const scored = ScoreCard(face({ statuses: [['strength', 2, 'self']] }), scoring);
  assert.equal(scored.positive, 4, 'only Damage is a flat positive part');
  assert.equal(scored.parts.SP, 4 * -0.1 * 2);
  assert.equal(scored.parts.block, 4 * 0.5 * 2);
  assert.equal(scored.parts.strength, 4 * 0.25 * 2);
});

test('multiplier form: the multi-effect bonus scores P x weight per extra effect', () => {
  const flat = ScoreCard(face(), scoringContract());
  // Damage and Block: one extra effect (skipFirst) at weight 2.
  assert.equal(flat.parts['effect count'], 2);
  const scoring = scoringContract();
  Object.assign(scoring.effectCount, { weight: 0.1, multiplier: true });
  const scored = ScoreCard(face({ draw: 1 }), scoring);
  // Damage 4 + Block 2 + Draw 2 = P 8; two extra effects.
  assert.equal(scored.positive, 8);
  assert.equal(scored.parts['effect count'], 8 * 0.1 * 2);
  const off = scoringContract();
  off.effectCount.multiplier = false;
  assert.deepEqual(ScoreCard(face({ draw: 1 }), off), ScoreCard(face({ draw: 1 }), scoringContract()));
});

test('multiplier form: a tag multiplies through pMultiplier, once per hit when its flat form counts hits', () => {
  const hitFace = face({ blk: 0, hits: 3, tags: ['damage:fire'] });
  // Flat per-hit tag: weight 2 x 3 hits.
  const flatScoring = scoringContract();
  flatScoring.tags['damage:fire'] = { weight: 2, per: 'hit' };
  assert.equal(ScoreCard(hitFace, flatScoring).parts['damage:fire'], 6);
  // The multiply form: weight goes to 0 and pMultiplier holds the share of P, per hit.
  const scoring = scoringContract();
  scoring.tags['damage:fire'] = { weight: 0, pMultiplier: 0.1, per: 'hit' };
  const scored = ScoreCard(hitFace, scoring);
  assert.equal(scored.positive, 4, 'the tag does not feed P');
  assert.equal(scored.parts['damage:fire'], 4 * 0.1 * 3);
  // Per action (no per): once per card, as before.
  scoring.tags['damage:fire'] = { weight: 0, pMultiplier: 0.1 };
  assert.equal(ScoreCard(hitFace, scoring).parts['damage:fire'], 4 * 0.1);
  // On an area card a per-hit share counts each enemy, like the flat form.
  scoring.tags['damage:fire'] = { weight: 0, pMultiplier: 0.1, per: 'hit' };
  const area = ScoreCard(face({ blk: 0, hits: 3, tags: ['damage:fire', 'targeting:area'] }), scoring);
  assert.equal(area.parts['damage:fire'], 8 * 0.1 * (3 * 2));
});

test('scoring validation: multiplier on a cost, effect or status must be a boolean', () => {
  const ok = scoringContract();
  Object.assign(ok, { keywords: {}, rank: ok.rank, rarity: ok.rarity, tags: {} });
  ok.costs.sp.multiplier = true;
  ok.effects.block.multiplier = false;
  ok.statuses.venom.multiplier = true;
  assert.deepEqual(ValidateScoringConfig(ok), []);
  for (const [section, key, value] of [['costs', 'sp', 1], ['effects', 'damage', 'yes'], ['statuses', 'strength', null]]) {
    const bad = structuredClone(ok);
    bad[section][key].multiplier = value;
    assert.deepEqual(ValidateScoringConfig(bad), [`${section}.${key}.multiplier must be true or false.`]);
  }
  const badCount = structuredClone(ok);
  badCount.effectCount.multiplier = 'on';
  assert.deepEqual(ValidateScoringConfig(badCount), ['effectCount.multiplier must be true or false.']);
});

// No shipped data uses the multiplier form, so every card and item keeps its raw, CP, rank and parts.
test('multiplier form: the shipped scoring scores every authored card and item as before', async () => {
  const { scoring } = await import('../src/content/generated/scoring.js');
  const { cardCombatPower, itemCombatPower } = await import('../src/content/generated/combatPower.js');
  const { buildTable, itemFaces } = await import('../tools/combat-power-report.mjs');
  const { registries } = await import('../tools/lib/cardBudgetMeasure.mjs');
  const { CardDefinitionToScoreFace } = await import('../src/model/cardUpgradeCp.js');
  const { ScoreItem } = await import('../src/model/combatPower.js');
  for (const section of ['costs', 'effects', 'statuses']) {
    for (const [id, entry] of Object.entries(scoring[section])) assert.ok(!(entry && 'multiplier' in entry), `${section}.${id} ships without multiplier`);
  }
  assert.ok(!('multiplier' in scoring.effectCount), 'effectCount ships without multiplier');
  for (const [id, tag] of Object.entries(scoring.tags)) assert.ok(!(tag && tag.pMultiplier && tag.per !== undefined), `tags.${id}: no shipped pMultiplier tag counts per hit`);
  // The generated table was written before the multiplier form existed: the scorer still reproduces it exactly.
  const table = buildTable();
  assert.deepEqual(table.cardCombatPower, cardCombatPower);
  assert.deepEqual(table.itemCombatPower, itemCombatPower);
  // Spelling the default out (multiplier: false everywhere) changes no part of any card or item.
  const explicit = structuredClone(scoring);
  for (const section of ['costs', 'effects', 'statuses']) for (const entry of Object.values(explicit[section])) if (entry && typeof entry === 'object') entry.multiplier = false;
  explicit.effectCount.multiplier = false;
  let cards = 0;
  for (const def of registries.cards.all()) {
    const f = CardDefinitionToScoreFace(def, { scoring });
    assert.deepEqual(ScoreCard(f, explicit), ScoreCard(f, scoring), def.id);
    cards++;
  }
  const { items, rules } = itemFaces();
  for (const it of items) assert.deepEqual(ScoreItem(it, explicit, rules), ScoreItem(it, scoring, rules), `${it.kind}:${it.id}`);
  assert.ok(cards > 100 && items.length > 100, `${cards} cards, ${items.length} items`);
});
