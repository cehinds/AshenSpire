// Owner, 2026-11-15 (W25-BANDS): the `bands` rule block, its validator and its gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, FixCoreBands } from '../src/model/fixCoreMechanics.js';

const ctx = rules => ({ combatExpansionVersion: 2, fixCoreRules: rules });

test('the shipped rules carry a valid bands block with rows on', () => {
  assert.equal(fixCoreMechanics.bands.rows, true);
  assert.doesNotThrow(() => validateFixCoreRules(structuredClone(fixCoreMechanics)));
  assert.equal(FixCoreBands(ctx(fixCoreMechanics)).advancedTurnEnds, 2);
});

test('a rules snapshot without the block (a fight saved before rows) has no band rules', () => {
  const legacy = structuredClone(fixCoreMechanics); delete legacy.bands;
  assert.doesNotThrow(() => validateFixCoreRules(legacy));
  assert.equal(FixCoreBands(ctx(legacy)), null);
  const off = structuredClone(fixCoreMechanics); off.bands.rows = false;
  assert.equal(FixCoreBands(ctx(off)), null);
});

test('the validator names a malformed bands block', () => {
  for (const patch of [{ version: 2 }, { rows: 'yes' }, { advancedTurnEnds: 0 }, { formationBlock: -1 }, { unknown: 1 }, { retreatCardId: '' }]) {
    const rules = structuredClone(fixCoreMechanics); Object.assign(rules.bands, patch);
    assert.throws(() => validateFixCoreRules(rules), /bands/, JSON.stringify(patch));
  }
});
