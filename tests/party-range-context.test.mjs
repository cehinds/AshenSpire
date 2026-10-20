import test from 'node:test';
import assert from 'node:assert/strict';
import { partyRangeContext } from '../src/model/partyRangeContext.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { RANGE_POLICY_DEFAULTS } from '../src/model/combatEngagement.js';
const profile = resolveGameProfile('core');
const core = () => ({ combatExpansionVersion: 2, gameProfile: profile, rangePolicy: structuredClone(RANGE_POLICY_DEFAULTS) });
test('all-Core party forwards one equal profile/policy without mutating saved runs', () => {
  const a = core(), b = core();
  b.rangePolicy = Object.fromEntries(Object.entries(b.rangePolicy).reverse());
  const before = structuredClone([a, b]);
  const ctx = partyRangeContext([a, b]);
  assert.equal(ctx.gameProfile.hash, profile.hash); assert.deepEqual(ctx.rangePolicy, RANGE_POLICY_DEFAULTS);
  assert.notEqual(ctx.gameProfile, a.gameProfile); assert.notEqual(ctx.rangePolicy, a.rangePolicy);
  assert.deepEqual([a, b], before);
});
test('mismatched explicit policies/profiles refuse; legacy or mixed parties retain old behavior', () => {
  const a = core(), b = core(); b.rangePolicy.advanceSpPerBand = 2;
  assert.throws(() => partyRangeContext([a, b]), /policies must match/);
  b.rangePolicy.advanceSpPerBand = -1;
  assert.throws(() => partyRangeContext([a, b]), /Invalid/);
  b.rangePolicy = a.rangePolicy; b.gameProfile = { ...profile, hash: 'different' };
  assert.throws(() => partyRangeContext([a, b]), /profiles must match/);
  assert.deepEqual(partyRangeContext([a, { combatExpansionVersion: 2 }]), {});
  assert.deepEqual(partyRangeContext([]), {});
});
test('an older Core run adopts defaults for a new encounter without changing the run here', () => {
  const a = core(), b = core(); delete a.rangePolicy;
  assert.deepEqual(partyRangeContext([a, b]).rangePolicy, RANGE_POLICY_DEFAULTS);
  assert.equal(Object.hasOwn(a, 'rangePolicy'), false);
});
