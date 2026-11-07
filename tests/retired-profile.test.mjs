import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { retiredProfileReason } from '../src/model/retiredProfile.js';

test('Core 2 profiles are supported', () => {
  assert.equal(retiredProfileReason(resolveGameProfile('default')), null);
  assert.equal(retiredProfileReason(resolveGameProfile('core')), null);
});
test('the legacy and Core 1 profiles are retired', () => {
  // The legacy and Core 1 profile data is deleted; the guard is proved on minimal inline profiles.
  const core = resolveGameProfile('core');
  assert.equal(retiredProfileReason({ ...core, foundation: { ...core.foundation, mode: 'legacy' } }), 'legacy-foundation');
  assert.equal(retiredProfileReason({ ...core, lock: { ...core.lock, core: 'ashen.core@1.0.0' } }), 'retired-core');
});
test('a missing profile is retired', () => {
  assert.equal(retiredProfileReason(null), 'missing-profile');
  assert.equal(retiredProfileReason(undefined), 'missing-profile');
});
test('a Core 2 variant with a module setting changed is still supported', () => {
  const p = resolveGameProfile('core');
  const stripped = { ...p, modules: { ...p.modules, effects: { ...p.modules.effects, fixCoreVersion: undefined } } };
  assert.equal(retiredProfileReason(stripped), null);
});
