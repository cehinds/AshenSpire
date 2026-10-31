import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentValidationCache } from '../src/model/contentValidationCache.js';

function fixture() {
  const calls = [];
  const read = createContentValidationCache((profile, configuration) => {
    calls.push(structuredClone({ profile, configuration }));
    const invalid = configuration.invalid;
    return { result: { ok: !invalid, errors: invalid ? [{ path: 'configuration.invalid', msg: 'invalid configuration' }] : [], counts: { cards: 10 } },
      structuralProblems: configuration.structural ? ['invalid structure'] : [] };
  });
  return { read, calls };
}

test('identical complete profile/configuration values reuse validation despite key order and object identity', () => {
  const { read, calls } = fixture();
  const profile = { id: 'core', lock: { runtime: 'a', content: 'b' } };
  const first = read(profile, { amount: 7, audio: false });
  const second = read({ lock: { content: 'b', runtime: 'a' }, id: 'core' }, { audio: false, amount: 7 });
  assert.equal(calls.length, 1);
  assert.deepEqual(second, first);
  assert.notEqual(second, first); assert.notEqual(second.result.counts, first.result.counts);
});

test('configuration changes, same-id profile locks and mutated inputs trigger fresh validation', () => {
  const { read, calls } = fixture();
  const profile = { id: 'core', lock: { runtime: 'a' } }, configuration = { amount: 5 };
  read(profile, configuration);
  configuration.amount = 6; read(profile, configuration);
  profile.lock.runtime = 'b'; read(profile, configuration);
  read(profile, { ...configuration, extra: true });
  assert.equal(calls.length, 4);
});

test('external mutations cannot poison the private validation receipt or its later callers', () => {
  const { read, calls } = fixture();
  const profile = { id: 'core' };
  const first = read(profile, {});
  first.result.counts.cards = 999;
  first.result.ok = false;
  const second = read(profile, {});
  assert.equal(second.result.counts.cards, 10); assert.equal(second.result.ok, true);
  second.result.counts.cards = 123;
  assert.equal(read(profile, {}).result.counts.cards, 10);
  assert.equal(calls.length, 1);
});

test('invalid configurations retain their full diagnostics and are never cached', () => {
  const { read, calls } = fixture();
  const profile = { id: 'core' };
  read(profile, {});
  for (const configuration of [{ invalid: true }, { structural: true }]) {
    const first = read(profile, configuration), second = read(profile, configuration);
    assert.deepEqual(second, first);
  }
  assert.equal(calls.length, 5);
  assert.equal(read(profile, {}).result.ok, true);
  assert.equal(calls.length, 5, 'the previous valid projection survives a refused configuration');
});

test('non-JSON configuration values cannot collide with a valid cached input', () => {
  const { read, calls } = fixture();
  const profile = { id: 'core' };
  read(profile, { amount: null });
  read(profile, { amount: NaN }); read(profile, { amount: Infinity });
  read(profile, {}); read(profile, { amount: undefined });
  assert.equal(calls.length, 5);
});

test('a frozen profile with a digest is identified by its digest, an unfrozen one by value', () => {
  const { read, calls } = fixture();
  const frozen = hash => Object.freeze({ id: 'core', hash, lock: Object.freeze({ runtime: 'a' }) });
  read(frozen('sha256:1'), {});
  read(frozen('sha256:1'), {});
  assert.equal(calls.length, 1);
  read(frozen('sha256:2'), {});
  assert.equal(calls.length, 2);
  const open = { id: 'core', hash: 'sha256:1', lock: { runtime: 'a' } };
  read(open, {}); open.lock.runtime = 'b'; read(open, {});
  assert.equal(calls.length, 4);
});
