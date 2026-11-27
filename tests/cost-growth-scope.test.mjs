// A rising cost (costGrowth, SPEC §4.3): scope 'copy' (default) counts one copy's plays; scope 'card' counts every copy's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCardBehavior } from '../src/engine/cardBehavior.js';
import { CostGrowthFaceText, CardRuleRiderLines } from '../src/model/cardFaceText.js';

const def = (scope) => ({ id: 'x', cost: 1, staminaCost: 1, manaCost: 0, costGrowth: { stamina: 1, perUse: 1, max: 3, ...(scope ? { scope } : {}) } });
const ctx = (instanceUses, cardUses) => ({ player: { abilityRiders: { instanceUsesCombat: instanceUses, cardUsesCombat: cardUses } } });

test('scope copy prices from this copy only; scope card from every copy', () => {
  const c = ctx({ a: 0 }, { x: 2 });
  assert.equal(projectCardBehavior(c, { instanceId: 'a', cardId: 'x' }, def(), { applyGear: false }).staminaCost, 1);
  assert.equal(projectCardBehavior(c, { instanceId: 'a', cardId: 'x' }, def('card'), { applyGear: false }).staminaCost, 3);
});

test('scope card costs 1, 2, 3, 4 then caps at +3', () => {
  const costs = [0, 1, 2, 3, 4, 5].map(n => projectCardBehavior(ctx({}, { x: n }), { instanceId: `i${n}`, cardId: 'x' }, def('card'), { applyGear: false }).staminaCost);
  assert.deepEqual(costs, [1, 2, 3, 4, 4, 4]);
});

test('the face prints the rising cost from data', () => {
  assert.equal(CostGrowthFaceText({ stamina: 1, perUse: 1, max: 3 }), '+1 SP each play this fight (max +3)');
  assert.equal(CostGrowthFaceText({ stamina: 1, perUse: 1, max: 3, scope: 'card' }), '+1 SP each time you play this card this fight (max +3)');
  assert.equal(CostGrowthFaceText({ stamina: 0, mana: 0 }), null);
  assert.equal(CostGrowthFaceText(undefined), null);
  const lines = CardRuleRiderLines({ wither: 3, costGrowth: { stamina: 1, max: 3, scope: 'card' } }).map(l => l.html.replace(/<[^>]+>/g, ''));
  assert.deepEqual(lines, ['Wither 3', '+1 SP each time you play this card this fight (max +3)']);
});
