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

