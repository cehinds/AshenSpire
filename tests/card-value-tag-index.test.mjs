import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cardValueIndexCases } from './helpers/card-value-index-cases.mjs';
import { contentBundle } from '../src/content/index.js';
import * as model from '../src/model/attackCardDamage.js';
// Recorded by invoking the unchanged model at c58cfef56 before indexing tags.
// Each hash covers the entire serialized projection/configuration/problem list.
const baseline = JSON.parse(readFileSync(new URL('./fixtures/card-value-tag-index-baseline.json', import.meta.url)));
for (const [name, bundle] of cardValueIndexCases()) {
  for (const method of ['materializeCardValueBonuses', 'projectAttackCardDamageBundle', 'attackCardDamageConfigProblems']) {
    // Evaluate immediately: the generator intentionally edits one bundle in place.
    let observed;
    try { observed = { sha256: createHash('sha256').update(JSON.stringify(model[method](bundle))).digest('hex') }; }
    catch (error) { observed = { error: error.message, type: error.constructor.name }; }
    test(`${method} preserves the pre-index result for ${name}`, () => {
      assert.deepEqual(observed, baseline.cases[name][method]);
    });
  }
}
for (const [method, scans] of [['materializeCardValueBonuses', 1], ['projectAttackCardDamageBundle', 2], ['attackCardDamageConfigProblems', 2]]) {
  test(`${method} reads each tag row once per local index, regardless of card count`, () => {
    let reads = 0;
    const bundle = { ...contentBundle, tagging: contentBundle.tagging.map(row => ({ ...row, get family() { reads++; return row.family; } })) };
    model[method](bundle);
    assert.equal(reads, bundle.tagging.length * scans);
  });
}
test('NaN object ids preserve the original strict-equality non-match', () => {
  const row = { ...contentBundle.cards[0], id: NaN, manaCost: 0, cardTags: undefined, damageSchool: undefined };
  const source = { ...contentBundle, cards: [row], tagging: [] };
  const without = model.materializeCardValueBonuses(source);
  const withNaN = model.materializeCardValueBonuses({ ...source, tagging: [{ family: 'card', objectId: NaN, tagId: 'magic' }] });
  assert.deepEqual(withNaN.balance.damage, without.balance.damage);
});
