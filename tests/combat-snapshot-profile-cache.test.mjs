// Perf only: serializeCombatSnapshot must not re-hash an identical clone of the
// fight's game profile on every save, and must still validate it the first time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { resolveGameProfile } from '../src/model/gameProfile.js';
import { isVerifiedProfile } from '../src/model/verifiedProfiles.js';

test('a later snapshot of the same profile object skips re-validation', () => {
  const registries = createRegistries(contentBundle);
  const saves = createSaveManager(createMemoryStorage());
  saves.ensureProfile();
  const gameProfile = resolveGameProfile('current');
  const run = createRunState({ seed: 0x2b0d, classId: 'reaver', registries, profileMeta: saves.loadMeta(), gameProfile });
  const enc = registries.encounters.get('packHunt');
  const combat = createRunCombat({ registries, rng: createRng(0x2b0d), run, settings: {}, enemyIds: enc.enemies, hpMult: 1, enemyStatuses: [], playerStatuses: [] });
  assert.ok(combat.gameProfile, 'a profiled run carries a game profile');
  const first = serializeCombatSnapshot(combat);
  assert.equal(isVerifiedProfile(first.gameProfile), false, 'the first save validates its clone for real');
  const second = serializeCombatSnapshot(combat);
  assert.notEqual(second.gameProfile, combat.gameProfile, 'snapshot still carries its own copy');
  assert.equal(isVerifiedProfile(second.gameProfile), true);
  assert.deepEqual(second.gameProfile, first.gameProfile);
});
