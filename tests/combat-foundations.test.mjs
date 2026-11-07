import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRules } from '../src/content/combatRules.js';
import { resolveDamageComponents } from '../src/model/combatRules.js';

test('typed mitigation applies flat damage once and floors each component', () => {
  const result = resolveDamageComponents(combatRules, { components: [{ type: 'slashing', amount: 10 }, { type: 'fire', amount: 10 }], armor: 100, resistances: { fire: 0.5 }, flatBonus: 4 });
  assert.deepEqual(result, [{ type: 'slashing', amount: 6 }, { type: 'fire', amount: 6 }]);
  assert.equal(resolveDamageComponents(combatRules, { components: [{ type: 'arcane', amount: 100 }], armor: 9999, immunities: ['arcane'] })[0].amount, 0);
});
