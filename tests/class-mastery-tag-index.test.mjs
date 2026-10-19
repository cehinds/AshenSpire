import test from 'node:test';
import assert from 'node:assert/strict';
import { tagIndexFor } from '../src/model/classMasteryContent.js';
import { legacyContentBundle } from './helpers/legacy-progression-content.mjs';
test('tag index matches the old filter on real content', () => {
  const tagging = legacyContentBundle.tagging || [];
  assert.ok(tagging.length > 0);
  const old = (family, id) => tagging.filter(t => t.family === family && t.objectId === id).map(t => t.tagId);
  const fast = tagIndexFor(tagging);
  for (const t of tagging) assert.deepEqual(fast(t.family, t.objectId), old(t.family, t.objectId));
  assert.deepEqual(fast('card', 'no-such-id'), []);
});
