import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';

test('exact Core pins preserve their authored rules independently of the default', () => {
  const old = resolveGameProfile('ashen.core@1.0.0');
  const current = resolveGameProfile('ashen.core@2.0.0');
  assert.equal(old.lock.core, 'ashen.core@1.0.0');
  assert.equal(current.lock.core, 'ashen.core@2.0.0');
  assert.notEqual(old.hash, current.hash);
  assert.notEqual(old.modules.effects.fixCoreVersion, 1);
  assert.equal(current.modules.effects.fixCoreVersion, 1);
  assert.equal(resolveGameProfile('core').hash, current.hash);
  assert.equal(resolveGameProfile('ashen.current@1.0.0').lock.core, 'ashen.current@1.0.0');
  assert.throws(() => resolveGameProfile('ashen.core@9.0.0'), /unknown profile/);
});
