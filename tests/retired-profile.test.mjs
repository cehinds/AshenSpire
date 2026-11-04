import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { retiredProfileReason } from '../src/model/retiredProfile.js';

test('Core 2 profiles are supported', () => {
  assert.equal(retiredProfileReason(resolveGameProfile('default')), null);
  assert.equal(retiredProfileReason(resolveGameProfile('core')), null);
});
test('the legacy and Core 1 profiles are retired', () => {
  assert.equal(retiredProfileReason(resolveGameProfile('current')), 'legacy-foundation');
  assert.equal(retiredProfileReason(resolveGameProfile('ashen.core@1.0.0')), 'retired-core');
});
test('a missing profile is retired', () => {
  assert.equal(retiredProfileReason(null), 'missing-profile');
  assert.equal(retiredProfileReason(undefined), 'missing-profile');
});
test('a Core 2 lock without the effects fix version is retired', () => {
  const p = resolveGameProfile('core');
  const stripped = { ...p, modules: { ...p.modules, effects: { ...p.modules.effects, fixCoreVersion: undefined } } };
  assert.equal(retiredProfileReason(stripped), 'retired-effects');
});
