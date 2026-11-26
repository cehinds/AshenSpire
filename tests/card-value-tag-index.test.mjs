import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cardValueContract, cardValueIndexCases, cardValueOracleOutput } from './helpers/card-value-index-cases.mjs';
import * as model from '../src/model/attackCardDamage.js';

// Full output parity comes from the independently pinned pre-index model. Only
// the small fixture is recorded; authored catalogs never enter this oracle.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/card-value-index-controlled.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');
test('the independent parity oracle records this controlled fixture', () => {
  assert.equal(baseline.fixtureSha256, digest(cardValueContract()));
  assert.equal(baseline.modelSha256, '0ff1b72895151ead0a62edd338da3c80a1c84daaab306fb760ddc3f85c416dc1');
});
for (const [name, bundle] of cardValueIndexCases()) for (const method of ['materializeCardValueBonuses', 'projectAttackCardDamageBundle', 'attackCardDamageConfigProblems']) {
  const observed = { sha256: digest(cardValueOracleOutput(method, model[method](bundle))) };
  test(method + ' matches the independent controlled oracle: ' + name, () => assert.deepEqual(observed, baseline.cases[name][method]));
}

test('controlled formulas preserve authored deltas, fixed upgrade budgets and alternate schools', () => {
  const source = cardValueContract();
  source.balance.damage.attackCards.cardBonuses.strike = 1;
  source.balance.damage.potencyCards.cardBonuses.strike = 10;
  source.cards[0].costRule = 'fixed';
  const snapshot = structuredClone(source), projected = model.projectAttackCardDamageBundle(source).cards[0];
  assert.equal(projected.effects[0].amount, 3, '2 action value + 1 explicit bonus');
  assert.equal(projected.upgrade.effects[0].amount, 6, 'base budget plus authored +3, not upgraded cost');
  assert.equal(projected.schoolVariant.effects[0].amount, 12, 'magic uses its own +10 bonus');
  assert.equal(projected.schoolVariant.upgrade.effects[0].amount, 15);
  assert.deepEqual(model.attackCardDamageConfigProblems(source), []);
  assert.deepEqual(source, snapshot);
});

test('tag, formula and profile edits on the same object never reuse stale indexes', () => {
  const seen = [];
  for (const [name, bundle] of cardValueIndexCases()) {
    const before = structuredClone(bundle);
    const projected = model.projectAttackCardDamageBundle(bundle);
    const bonuses = model.materializeCardValueBonuses(bundle).balance.damage;
    seen.push([name, bonuses.potencyCards.cardBonuses.guard ?? null,
      bonuses.defenseCards.cardBonuses.guard ?? null, !!projected.cards[0].schoolVariant]);
    assert.deepEqual(bundle, before);
  }
  assert.deepEqual(seen, [
    ['controlled', null, 1, true], ['duplicate-magic-tags-and-null-row', null, 1, false],
    ['same-object-tag-edits', 1, null, true], ['same-object-formula-edits', -7, 17, true],
    ['same-object-profile-edit', -7, 17, false], ['priority-card-profiles', -7, 17, true],
  ]);
});

test('all five channels read action, mana, stamina and distinct status penalties before explicit bonuses', () => {
  const source = cardValueContract();
  source.equipment = {};
  const effects = [{ op: 'damage', amount: 8 }, { op: 'block', amount: 8 }, { op: 'poiseDamage', amount: 8 },
    { op: 'applyStatus', status: 'poison', stacks: 1 }, { op: 'applyStatus', status: 'poison', stacks: 2 }];
  source.cards = ['physical', 'magic'].map(id => ({ id, type: 'attack', cost: 1, manaCost: 2, staminaCost: 3,
    damageSchool: id, effects }));
  for (const [index, config] of Object.values(source.balance.damage).entries()) Object.assign(config, {
    globalMultiplier: 2, actionCostMultiplier: 3, manaCostMultiplier: 5, staminaCostMultiplier: 7,
    statusEffectReductionMultiplier: 3, cardBonuses: { physical: index + 1, magic: index + 1 },
  });
  const snapshot = structuredClone(source), projected = model.projectAttackCardDamageBundle(source).cards;
  // floor(2 × (1×3 + 2×5 + 3×7) - 3×2) = 62. A repeated status is penalized once.
  assert.deepEqual(projected[0].effects.slice(0, 3).map(row => row.amount), [63, 64, 66]);
  assert.deepEqual(projected[1].effects.slice(0, 3).map(row => row.amount), [65, 65, 67]);
  assert.deepEqual(source, snapshot);
});

test('conditional numeric offsets survive projection and negative totals clamp at zero', () => {
  const source = cardValueContract();
  source.cards[0].effects = [{ op: 'damage', amount: 4, if: 'first' }, { op: 'damage', amount: 7, if: 'second' }];
  source.balance.damage.attackCards.cardBonuses.strike = 3;
  assert.deepEqual(model.projectAttackCardDamageBundle(source).cards[0].effects.map(row => row.amount), [5, 8]);
  source.balance.damage.attackCards.cardBonuses.strike = -20;
  assert.deepEqual(model.projectAttackCardDamageBundle(source).cards[0].effects.map(row => row.amount), [0, 3]);
});

test('formula-only faces, undefined tags and strict NaN non-matches retain authored values', () => {
  const source = cardValueContract();
  source.cards = [{ id: NaN, type: 'attack', cost: 1, effects: [{ op: 'damage', amount: 4 }] },
    { id: 'formula', type: 'attack', cost: 1, effects: [{ op: 'damage', amount: { f: 'add', args: [1, 2] } }],
      upgrade: { effects: [{ op: 'damage', amount: { f: 'add', args: [4, 5] } }] } }];
  const without = model.projectAttackCardDamageBundle(source);
  source.tagging = [{ family: 'card', objectId: NaN, tagId: 'magic' }, { family: 'card', objectId: 'formula', tagId: undefined }];
  const withTags = model.projectAttackCardDamageBundle(source);
  assert.deepEqual(withTags.cards, without.cards);
  assert.deepEqual(withTags.cards[1].effects, source.cards[1].effects);
  assert.deepEqual(withTags.cards[1].upgrade.effects, source.cards[1].upgrade.effects);
});

for (const value of [null, [], 3, 'bad']) test('malformed value containers are reported before repair: ' + JSON.stringify(value), () => {
  const source = cardValueContract();
  source.balance.damage.attackCards.cardBonuses = value;
  source.balance.damage.defenseCards.statusMultipliers = value;
  assert.deepEqual(model.attackCardDamageConfigProblems(source).map(row => row.path),
    ['balance.damage.attackCards.cardBonuses', 'balance.damage.defenseCards.statusMultipliers']);
  assert.deepEqual(source.balance.damage.attackCards.cardBonuses, value);
});

test('missing and malformed metadata retain validation and lazy-read contracts', () => {
  const source = cardValueContract();
  assert.deepEqual(model.attackCardDamageConfigProblems({ ...source, tagging: null }), []);
  assert.deepEqual(model.attackCardDamageConfigProblems({ ...source, equipment: { basicCardProfiles: {} } }), []);
  for (const method of ['materializeCardValueBonuses', 'projectAttackCardDamageBundle', 'attackCardDamageConfigProblems']) {
    assert.throws(() => model[method]({ ...source, tagging: {} }), TypeError);
    assert.throws(() => model[method]({ ...source, equipment: { basicCardProfiles: [null] } }), TypeError);
    assert.doesNotThrow(() => model[method]({ ...source, cards: [], tagging: {} }));
  }
  const missing = { ...source, balance: { damage: null } };
  assert.equal(model.materializeCardValueBonuses(missing), missing);
  assert.throws(() => model.projectAttackCardDamageBundle(missing), /balance.damage.attackCards is required/);
  assert.equal(model.attackCardDamageConfigProblems(missing).length, 5);
});

for (const [method, scans] of [['materializeCardValueBonuses', 1], ['projectAttackCardDamageBundle', 2], ['attackCardDamageConfigProblems', 2]]) {
  test(method + ' reads each tag row once per local index, regardless of card count', () => {
    let reads = 0;
    const bundle = cardValueContract();
    bundle.cards = Array.from({ length: 60 }, (_, n) => ({ ...bundle.cards[0], id: 'strike-' + n }));
    bundle.tagging = Array.from({ length: 60 }, (_, n) => ({ objectId: 'strike-' + n, tagId: 'physical', get family() { reads++; return 'card'; } }));
    model[method](bundle);
    assert.equal(reads, bundle.tagging.length * scans);
  });
}
