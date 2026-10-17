import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBaseCardPack, compileBaseCards } from '../tools/base-cards.mjs';

test('all seventy approved proposal identities occur once with unmodified source provenance', () => {
  const { rows } = loadBaseCardPack();
  const proposals = rows.filter(row => row.provenance.sourceProposal);
  assert.equal(proposals.length, 70);
  assert.equal(new Set(proposals.map(row => row.provenance.sourceProposal.id)).size, 70);
  assert.equal(proposals.filter(row => row.provenance.sourceProposal.entityKind === 'combatCard').length, 67);
  assert.equal(proposals.filter(row => row.provenance.sourceProposal.entityKind === 'statusCard').length, 3);
  assert.ok(proposals.every(row => row.authorDefaults.state === 'editable-author-defaults'));
});
test('every base card has concrete costs, executable effects or burdens, and explicit resource alternatives', () => {
  const { rows, variants } = loadBaseCardPack();
  for (const { definition: card, tags } of rows) {
    for (const price of [card.staminaCost, card.manaCost]) assert.ok(Number.isInteger(price) && price >= 0, card.id);
    assert.ok(card.effects.length || card.burden, card.id);
    if (tags.includes('camp:spell')) assert.ok(card.manaCost >= 1, `${card.id} MP floor`);
    for (const mode of ['sp,mp', 'sp', 'mp', 'none']) assert.ok(variants[card.id][mode], `${card.id} ${mode}`);
  }
  const strike = rows.find(row => row.definition.id === 'base.strike').definition;
  const smash = rows.find(row => row.definition.id === 'base.smash').definition;
  assert.equal(smash.effects[0].amount / strike.effects[0].amount, 2);
  assert.equal(smash.staminaCost, strike.staminaCost + 1);
});
test('authored core admission excludes elemental, hand-retaining and unavailable Ward designs', () => {
  const { rows, groups } = loadBaseCardPack();
  const selected = new Set(groups['base.core-rewards'].members);
  for (const row of rows) if (selected.has(row.definition.id)) {
    assert.deepEqual(row.requirements.elements, [], row.definition.id);
    assert.equal(row.requirements.features.includes('hand-retention'), false, row.definition.id);
    assert.equal(row.requirements.features.includes('ward-channel'), false, row.definition.id);
  }
  assert.equal(groups['base.current-rewards'].members.length, 67);
  assert.equal(groups['base.generated-burdens'].members.length, 3);
  assert.match(compileBaseCards(), /export const baseCardStatusRules = /);
});
