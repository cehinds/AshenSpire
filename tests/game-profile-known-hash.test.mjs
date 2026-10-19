import test from 'node:test';
import assert from 'node:assert/strict';
import { gameProfileCatalog, gameProfileAuthors, gameProfileHashes } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor, gameDigest, validateResolvedGameProfile } from '../engine/kernel/gameConfig.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
test('stored catalog hashes equal a full recomputation', () => {
  for (const [id, author] of Object.entries(gameProfileAuthors)) {
    const full = resolveGameAuthor(author, gameProfileCatalog);
    assert.equal(gameProfileHashes[id], full.hash, id);
    const { hash, ...rest } = JSON.parse(JSON.stringify(full));
    assert.equal(gameDigest(rest), hash, id);
    assert.deepEqual(resolveGameProfile(id), full);
  }
});
test('tampered snapshots still fail the digest check', () => {
  const copy = JSON.parse(JSON.stringify(resolveGameProfile('current')));
  copy.id = 'tampered';
  assert.throws(() => validateResolvedGameProfile(copy), /digest mismatch/);
  assert.doesNotThrow(() => validateResolvedGameProfile(JSON.parse(JSON.stringify(resolveGameProfile('current')))));
});
