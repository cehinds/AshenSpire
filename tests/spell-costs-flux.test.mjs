// Owner, 2026-11-15 (W25-F): spells cost 1 more Mana (and 1 more Stamina unless a cantrip); Prepared takes 1 SP off a spell; a Focus item takes 1 MP off;
// the last spell's element becomes a flux that lifts the next card of that element by x1.25 (each number floored). The numbers live in
// fixCoreMechanics.json `spellCosts` and `elementFlux`; a fight created before the ruling has neither block and plays today's costs with no flux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';

test('shipped data holds the approved spell cost and flux numbers and the validator guards them', () => {
  assert.deepEqual(shipped.spellCosts, { version: 1, manaSurcharge: 1, staminaSurcharge: 1, cantripTag: 'rank.cantrip', preparedStaminaDiscount: 1, focusManaDiscount: 1 });
  assert.deepEqual(shipped.elementFlux, { version: 1, multiplier: 1.25 });
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  const { spellCosts, elementFlux, ...saved } = shipped;
  assert.doesNotThrow(() => validateFixCoreRules(saved), 'a block saved before the ruling stays valid');
  const costs = patch => validateFixCoreRules({ ...shipped, spellCosts: { ...shipped.spellCosts, ...patch } });
  assert.throws(() => costs({ manaSurcharge: -1 }), /spellCosts/);
  assert.throws(() => costs({ staminaSurcharge: 0.5 }), /spellCosts/);
  assert.throws(() => costs({ extra: 1 }), /spellCosts/);
  assert.throws(() => costs({ version: 2 }), /spellCosts/);
  const flux = patch => validateFixCoreRules({ ...shipped, elementFlux: { ...shipped.elementFlux, ...patch } });
  assert.throws(() => flux({ multiplier: 0.5 }), /elementFlux/);
  assert.throws(() => flux({ extra: 1 }), /elementFlux/);
});
