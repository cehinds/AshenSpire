import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { gameProfileCatalog, gameProfileAuthors } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor, validateResolvedGameProfile } from '../engine/kernel/gameConfig.js';
import { resolveGameProfile, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
test('repeat catalog resolves equal a fresh full resolve and stay distinct objects', () => {
  const fresh = resolveGameAuthor(gameProfileAuthors.current, gameProfileCatalog);
  assert.deepEqual(resolveGameProfile('current'), fresh);
  assert.notEqual(resolveGameProfile('current'), resolveGameProfile('current'));
  assert.deepEqual(resolveGameProfile('current'), resolveGameProfile('current'));
});
test('parsed snapshots still take the full digest check and pinned runtimeHash', () => {
  const good = JSON.parse(JSON.stringify(resolveGameProfile('current')));
  assert.doesNotThrow(() => validateGameProfileSnapshot(good));
  const bad = { ...good, id: 'tampered' };
  assert.throws(() => validateGameProfileSnapshot(bad), /digest mismatch/);
  assert.throws(() => validateResolvedGameProfile(good, 'sha256:other'), /unsupported runtime artifact/);
});
test('runtimeHash is unchanged from origin/dev (saves stay loadable)', () => {
  let dev; try { dev = JSON.parse(execFileSync('git', ['show', 'origin/dev:games/ashenspire/game.lock.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { return; }
  for (const [id, p] of Object.entries(dev.profiles)) if (p.runtimeHash) assert.equal(gameProfileCatalog.runtimeHash, p.runtimeHash, id);
});
test('re-validating the exact verified object returns it; an unverified copy takes the full check', () => {
  const p = resolveGameProfile('current');
  assert.equal(validateGameProfileSnapshot(p), p);
  const copy = JSON.parse(JSON.stringify(p));
  const out = validateGameProfileSnapshot(copy);
  assert.notEqual(out, p);
  assert.equal(validateGameProfileSnapshot(out), out);
  assert.equal(p.lock.runtimeHash, gameProfileCatalog.runtimeHash);
});
