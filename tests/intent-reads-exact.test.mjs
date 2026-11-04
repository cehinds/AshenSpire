// Archived Core1 preview route (owner, 2026-10-18): the intent module's `reads: exact` shows every enemy intent exactly and
// skips the hidden-intent roll (SPEC §4.7). A run without that setting (Current, the legacy fallback) keeps the roll.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameModule } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const ENEMIES = ['wanderingSoldier', 'wanderingSoldier'];
function fixture(profileName, seed) {
  const profile = profileName ? resolveGameProfile(profileName) : null;
  const registries = profile ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile) : createRegistries(contentBundle);
  const run = createRunState({ registries, seed, classId: 'reaver', enemyKnowledgeVersion: null }); // knowledge off: the roll path is under test
  const rng = createRng(seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ENEMIES });
  return { run, combat, rng };
}
function playTurns(combat, turns) {
  const reads = [];
  for (let t = 0; t < turns && combat.phase !== 'ended'; t++) {
    for (const e of combat.enemies) if (e.intent?.combatProfile?.camp) reads.push(e.intentRevealed);
    dispatch(combat, { type: 'endTurn' });
    let guard = 0;
    while (combat.pendingReaction && guard++ < 64) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  return reads;
}




