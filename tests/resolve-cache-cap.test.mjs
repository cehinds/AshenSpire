import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard, resolveCacheSize } from '../src/model/registries.js';

// The per-registries resolve cache keys on every field that changes a card, so a long run adds keys without end.
// It is capped (RESOLVE_CACHE_LIMIT = 4096) and emptied at the cap; a repeat key still returns the same frozen object.
const LIMIT = 4096;

test('resolveCard cache never exceeds its cap and still memoises a repeat key', () => {
  const registries = createRegistries(contentBundle);
  const ref = (buildup) => ({ cardId: 'strike', upgraded: false, exposureBuildupPerHit: buildup });
  const first = resolveCard(registries, ref(1));
  assert.ok(Object.isFrozen(first));
  assert.equal(resolveCard(registries, ref(1)), first, 'repeat key returns the same object');
  let peak = 0;
  for (let level = 2; level < LIMIT * 2 + 50; level++) {
    resolveCard(registries, ref(level));
    peak = Math.max(peak, resolveCacheSize(registries));
  }
  assert.ok(peak <= LIMIT, `cache peaked at ${peak}`);
  assert.ok(peak >= LIMIT - 1, 'the cache did fill to the cap');
  const again = resolveCard(registries, ref(LIMIT * 2 + 49));
  assert.ok(Object.isFrozen(again));
  assert.equal(resolveCard(registries, ref(LIMIT * 2 + 49)), again, 'repeat key after a clear is memoised again');
});
