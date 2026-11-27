import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gameProfileCatalog, gameProfileAuthors } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor, validateResolvedGameProfile, freezeGameData } from '../engine/kernel/gameConfig.js';
import { resolveGameProfile, validateGameProfileSnapshot, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { isVerifiedProfile, markVerifiedProfile, IsCanonicalVerifiedProfile } from '../src/model/verifiedProfiles.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
test('repeat catalog resolves equal a fresh full resolve and stay distinct objects', () => {
  const fresh = resolveGameAuthor(gameProfileAuthors.core, gameProfileCatalog);
  assert.deepEqual(resolveGameProfile('core'), fresh);
  assert.notEqual(resolveGameProfile('core'), resolveGameProfile('core'));
  assert.deepEqual(resolveGameProfile('core'), resolveGameProfile('core'));
});
test('parsed snapshots still take the full digest check and pinned runtimeHash', () => {
  const good = JSON.parse(JSON.stringify(resolveGameProfile('core')));
  assert.doesNotThrow(() => validateGameProfileSnapshot(good));
  const bad = { ...good, id: 'tampered' };
  assert.throws(() => validateGameProfileSnapshot(bad), /digest mismatch/);
  assert.throws(() => validateResolvedGameProfile(good, 'sha256:other'), /unsupported runtime artifact/);
});
test('catalog runtimeHash matches the committed game.lock.json (cache never serves a stale hash)', () => {
  const lockPath = fileURLToPath(new URL('../games/ashenspire/game.lock.json', import.meta.url));
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  for (const [id, p] of Object.entries(lock.profiles)) if (p.runtimeHash) assert.equal(gameProfileCatalog.runtimeHash, p.runtimeHash, id);
});
test('re-validating the exact verified object returns it; an unverified copy takes the full check', () => {
  const p = resolveGameProfile('core');
  assert.equal(validateGameProfileSnapshot(p), p);
  const copy = JSON.parse(JSON.stringify(p));
  const out = validateGameProfileSnapshot(copy);
  assert.notEqual(out, p);
  assert.equal(validateGameProfileSnapshot(out), out);
  assert.equal(p.lock.runtimeHash, gameProfileCatalog.runtimeHash);
});

const runWith = gameProfile => createRunState({ registries, gameProfile, classId: 'reaver', seed: 321, runId: 'profile-clone',
  profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });

test('a new run owns an exact, deeply detached JSON snapshot of a verified frozen profile', () => {
  const source = registries.gameProfile;
  assert.equal(isVerifiedProfile(source), true); assert.equal(Object.isFrozen(source), true);
  assert.equal(IsCanonicalVerifiedProfile(source), true);
  const text = JSON.stringify(source), snapshot = runWith(source).gameProfile;
  assert.equal(JSON.stringify(snapshot), text);
  assert.equal(snapshot.hash, source.hash);
  assert.equal(validateResolvedGameProfile(snapshot, source.lock.runtimeHash).hash, source.hash);
  const detached = (copy, original) => {
    if (!copy || typeof copy !== 'object') return;
    assert.notEqual(copy, original);
    assert.equal(Object.getPrototypeOf(copy), Array.isArray(copy) ? Array.prototype : Object.prototype);
    for (const key of Object.keys(copy)) detached(copy[key], original[key]);
  };
  detached(snapshot, source);
  snapshot.modules.cards.handBase = (snapshot.modules.cards.handBase || 0) + 1;
  assert.equal(JSON.stringify(source), text);
});

for (const mode of ['unverified', 'frozen-unverified', 'marked-mutable']) test('run profile cloning preserves native extras for ' + mode + ' inputs', () => {
  const source = structuredClone(registries.gameProfile);
  source.fixtureExtras = { $comment: 'retained native data', optional: undefined, timestamp: new Date(0), number: NaN };
  if (mode === 'frozen-unverified') Object.freeze(source);
  if (mode === 'marked-mutable') markVerifiedProfile(source);
  assert.equal(isVerifiedProfile(source) && Object.isFrozen(source), false);
  assert.equal(IsCanonicalVerifiedProfile(source), false);
  const snapshot = runWith(source).gameProfile;
  assert.deepEqual(snapshot, structuredClone(source));
  assert.equal(Object.hasOwn(snapshot.fixtureExtras, 'optional'), true);
  assert.equal(snapshot.fixtureExtras.$comment, 'retained native data');
  assert.ok(snapshot.fixtureExtras.timestamp instanceof Date);
  assert.equal(Number.isNaN(snapshot.fixtureExtras.number), true);
  snapshot.fixtureExtras.timestamp.setUTCFullYear(2000);
  assert.equal(source.fixtureExtras.timestamp.getUTCFullYear(), 1970);
});

test('a genuinely verified frozen combat-save profile keeps ignored metadata through binding and new-run cloning', () => {
  const source = structuredClone(registries.gameProfile);
  source.$comment = 'valid profile provenance retained by native clone';
  const run = runWith(source);
  const combat = createRunCombat({ registries, run, rng: createRng(321), enemyIds: ['wanderingSoldier'] });
  const first = serializeCombatSnapshot(combat), second = serializeCombatSnapshot(combat);
  assert.equal(first.gameProfile.$comment, source.$comment);
  assert.equal(second.gameProfile.$comment, source.$comment);
  assert.equal(isVerifiedProfile(second.gameProfile), true, 'the real second save grants digest verification');
  assert.equal(IsCanonicalVerifiedProfile(second.gameProfile), false, 'raw save marking never grants normalization');
  freezeGameData(second.gameProfile);
  const bound = bindGameProfileRegistries(registries, second.gameProfile);
  assert.equal(bound.gameProfile, second.gameProfile, 'fast validation preserves the exact raw graph');
  const rebound = createRunState({ registries: bound, classId: 'reaver', seed: 322, runId: 'raw-rebound',
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a','b','c'] } } } });
  assert.deepEqual(rebound.gameProfile, structuredClone(bound.gameProfile));
  assert.equal(rebound.gameProfile.$comment, source.$comment);
  assert.equal(rebound.gameProfile.hash, source.hash);
  assert.notEqual(rebound.gameProfile, bound.gameProfile);
});
